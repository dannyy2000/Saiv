// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAave.sol";

/**
 * @title GroupPool
 * @dev Smart contract for managing group pool funds and contributions
 */
contract GroupPool is ReentrancyGuard, Ownable {
    // Struct for payment window
    struct PaymentWindow {
        uint256 windowNumber;
        uint256 startTime;
        uint256 endTime;
        uint256 totalContributions;
        bool isActive;
        bool isCompleted;
        mapping(address => uint256) memberContributions;
        mapping(address => mapping(address => uint256)) tokenContributions; // member => token => amount
    }

    // Events
    event ContributionMade(
        address indexed member,
        uint256 indexed windowNumber,
        uint256 amount,
        address indexed token,
        uint256 timestamp
    );
    event PaymentWindowCreated(
        uint256 indexed windowNumber,
        uint256 startTime,
        uint256 endTime
    );
    event PaymentWindowCompleted(uint256 indexed windowNumber, uint256 totalContributions);
    event FundsWithdrawn(address indexed to, uint256 amount, address indexed token);
    event GroupPoolInitialized(address indexed owner, address indexed manager);
    event SuppliedToAave(address indexed asset, uint256 amount, address indexed aToken);
    event WithdrawnFromAave(address indexed asset, uint256 amount);

    // State variables
    address public manager; // AddressManager contract

    // Aave integration
    address public aavePool; // Aave V3 Pool address
    mapping(address => address) public assetToAToken; // Maps asset to its aToken
    mapping(address => uint256) public suppliedToAave; // Track amount supplied to Aave per asset
    string public groupName;
    uint256 public paymentWindowDuration;
    uint256 public currentWindowNumber;
    uint256 public minContribution;
    uint256 public maxMembers;

    // Mappings
    mapping(uint256 => PaymentWindow) public paymentWindows;
    mapping(address => bool) public isGroupMember;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public totalMemberContributions;
    mapping(address => mapping(address => uint256)) public totalMemberTokenContributions;

    address[] public groupMembers;
    address[] public supportedTokensList;

    modifier onlyOwnerOrManager() {
        require(msg.sender == owner() || msg.sender == manager, "Not authorized");
        _;
    }

    modifier onlyGroupMember() {
        require(isGroupMember[msg.sender], "Not a group member");
        _;
    }

    modifier validPaymentWindow(uint256 windowNumber) {
        require(windowNumber > 0 && windowNumber <= currentWindowNumber, "Invalid window number");
        _;
    }

    constructor() {
        // Constructor is empty as we use initialize pattern
    }

    /**
     * @dev Initialize the group pool
     * @param _owner The owner of the group
     * @param _manager The address manager contract
     * @param _groupName Name of the group
     * @param _paymentWindowDuration Duration of each payment window in seconds
     * @param _minContribution Minimum contribution amount
     * @param _maxMembers Maximum number of members
     */
    function initialize(
        address _owner,
        address _manager,
        string memory _groupName,
        uint256 _paymentWindowDuration,
        uint256 _minContribution,
        uint256 _maxMembers
    ) external {
        require(owner() == address(0), "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_manager != address(0), "Invalid manager");
        require(_paymentWindowDuration > 0, "Invalid payment window duration");

        _transferOwnership(_owner);
        manager = _manager;
        groupName = _groupName;
        paymentWindowDuration = _paymentWindowDuration;
        minContribution = _minContribution;
        maxMembers = _maxMembers;

        // Create first payment window
        _createPaymentWindow();

        emit GroupPoolInitialized(_owner, _manager);
    }

    /**
     * @dev Receive ETH contributions
     */
    receive() external payable {
        if (msg.value > 0) {
            contribute();
        }
    }

    /**
     * @dev Make ETH contribution to current payment window
     */
    function contribute() public payable onlyGroupMember nonReentrant {
        require(msg.value >= minContribution, "Contribution below minimum");
        require(currentWindowNumber > 0, "No active payment window");

        PaymentWindow storage currentWindow = paymentWindows[currentWindowNumber];
        require(currentWindow.isActive, "Payment window not active");
        require(block.timestamp <= currentWindow.endTime, "Payment window expired");

        // Update contributions
        currentWindow.memberContributions[msg.sender] += msg.value;
        currentWindow.totalContributions += msg.value;
        totalMemberContributions[msg.sender] += msg.value;

        emit ContributionMade(
            msg.sender,
            currentWindowNumber,
            msg.value,
            address(0), // ETH
            block.timestamp
        );

        // Check if window should be completed
        _checkWindowCompletion();
    }

    /**
     * @dev Make ERC-20 token contribution to current payment window
     * @param tokenAddress Address of the ERC-20 token
     * @param amount Amount of tokens to contribute
     */
    function contributeToken(address tokenAddress, uint256 amount)
        external
        onlyGroupMember
        nonReentrant
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(supportedTokens[tokenAddress], "Token not supported");
        require(amount >= minContribution, "Contribution below minimum");
        require(currentWindowNumber > 0, "No active payment window");

        PaymentWindow storage currentWindow = paymentWindows[currentWindowNumber];
        require(currentWindow.isActive, "Payment window not active");
        require(block.timestamp <= currentWindow.endTime, "Payment window expired");

        IERC20 token = IERC20(tokenAddress);

        // Transfer tokens from contributor to this contract
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        // Update contributions
        currentWindow.tokenContributions[msg.sender][tokenAddress] += amount;
        currentWindow.totalContributions += amount; // Note: This mixes ETH and token amounts
        totalMemberTokenContributions[msg.sender][tokenAddress] += amount;

        emit ContributionMade(
            msg.sender,
            currentWindowNumber,
            amount,
            tokenAddress,
            block.timestamp
        );

        // Check if window should be completed
        _checkWindowCompletion();
    }

    /**
     * @dev Add a member to the group
     * @param member Address of the new member
     */
    function addMember(address member) external onlyOwnerOrManager {
        require(member != address(0), "Invalid member address");
        require(!isGroupMember[member], "Already a member");
        require(groupMembers.length < maxMembers, "Group is full");

        isGroupMember[member] = true;
        groupMembers.push(member);
    }

    /**
     * @dev Remove a member from the group
     * @param member Address of the member to remove
     */
    function removeMember(address member) external onlyOwnerOrManager {
        require(isGroupMember[member], "Not a member");

        isGroupMember[member] = false;

        // Remove from array
        for (uint i = 0; i < groupMembers.length; i++) {
            if (groupMembers[i] == member) {
                groupMembers[i] = groupMembers[groupMembers.length - 1];
                groupMembers.pop();
                break;
            }
        }
    }

    /**
     * @dev Add supported token
     * @param tokenAddress Address of the token to support
     */
    function addSupportedToken(address tokenAddress) external onlyOwnerOrManager {
        require(tokenAddress != address(0), "Invalid token address");
        require(!supportedTokens[tokenAddress], "Token already supported");

        supportedTokens[tokenAddress] = true;
        supportedTokensList.push(tokenAddress);
    }

    /**
     * @dev Create a new payment window
     */
    function createNewPaymentWindow() external onlyOwnerOrManager {
        _createPaymentWindow();
    }

    /**
     * @dev Complete current payment window
     */
    function completeCurrentWindow() external onlyOwnerOrManager {
        require(currentWindowNumber > 0, "No active window");

        PaymentWindow storage currentWindow = paymentWindows[currentWindowNumber];
        require(currentWindow.isActive, "Window not active");

        currentWindow.isActive = false;
        currentWindow.isCompleted = true;

        emit PaymentWindowCompleted(currentWindowNumber, currentWindow.totalContributions);

        // Create next payment window
        _createPaymentWindow();
    }

    /**
     * @dev Withdraw ETH from the pool
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawEth(address payable to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient balance");

        to.transfer(amount);
        emit FundsWithdrawn(to, amount, address(0));
    }

    /**
     * @dev Withdraw tokens from the pool
     * @param tokenAddress Token contract address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawToken(address tokenAddress, address to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(address(this)) >= amount, "Insufficient token balance");

        require(token.transfer(to, amount), "Token transfer failed");
        emit FundsWithdrawn(to, amount, tokenAddress);
    }

    /**
     * @dev Get payment window details
     * @param windowNumber Window number to query
     * @return Window details
     */
    function getPaymentWindow(uint256 windowNumber)
        external
        view
        validPaymentWindow(windowNumber)
        returns (
            uint256 start,
            uint256 end,
            uint256 total,
            bool active,
            bool completed
        )
    {
        PaymentWindow storage window = paymentWindows[windowNumber];
        return (
            window.startTime,
            window.endTime,
            window.totalContributions,
            window.isActive,
            window.isCompleted
        );
    }

    /**
     * @dev Get member contribution for specific window
     * @param member Member address
     * @param windowNumber Window number
     * @return ETH contribution amount
     */
    function getMemberContribution(address member, uint256 windowNumber)
        external
        view
        validPaymentWindow(windowNumber)
        returns (uint256)
    {
        return paymentWindows[windowNumber].memberContributions[member];
    }

    /**
     * @dev Get member token contribution for specific window
     * @param member Member address
     * @param windowNumber Window number
     * @param tokenAddress Token address
     * @return Token contribution amount
     */
    function getMemberTokenContribution(
        address member,
        uint256 windowNumber,
        address tokenAddress
    ) external view validPaymentWindow(windowNumber) returns (uint256) {
        return paymentWindows[windowNumber].tokenContributions[member][tokenAddress];
    }

    /**
     * @dev Get group members
     * @return Array of member addresses
     */
    function getGroupMembers() external view returns (address[] memory) {
        return groupMembers;
    }

    /**
     * @dev Get supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokensList;
    }

    /**
     * @dev Get pool balances
     * @return ETH balance and token balances
     */
    function getPoolBalances()
        external
        view
        returns (uint256 ethBalance, address[] memory tokens, uint256[] memory tokenBalances)
    {
        ethBalance = address(this).balance;
        tokens = supportedTokensList;
        tokenBalances = new uint256[](tokens.length);

        for (uint i = 0; i < tokens.length; i++) {
            tokenBalances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }

    /**
     * @dev Internal function to create new payment window
     */
    function _createPaymentWindow() internal {
        currentWindowNumber++;

        PaymentWindow storage newWindow = paymentWindows[currentWindowNumber];
        newWindow.windowNumber = currentWindowNumber;
        newWindow.startTime = block.timestamp;
        newWindow.endTime = block.timestamp + paymentWindowDuration;
        newWindow.isActive = true;
        newWindow.isCompleted = false;

        emit PaymentWindowCreated(
            currentWindowNumber,
            newWindow.startTime,
            newWindow.endTime
        );
    }

    /**
     * @dev Internal function to check if window should be completed
     */
    function _checkWindowCompletion() internal {
        PaymentWindow storage currentWindow = paymentWindows[currentWindowNumber];

        // Auto-complete if window time has expired
        if (block.timestamp > currentWindow.endTime && currentWindow.isActive) {
            currentWindow.isActive = false;
            currentWindow.isCompleted = true;

            emit PaymentWindowCompleted(currentWindowNumber, currentWindow.totalContributions);

            // Create next payment window
            _createPaymentWindow();
        }
    }

    // ============================================
    // AAVE GROUP SAVINGS INTEGRATION
    // ============================================

    /**
     * @dev Set Aave pool address (only manager can set)
     * @param _aavePool Aave V3 Pool contract address
     */
    function setAavePool(address _aavePool) external onlyOwnerOrManager {
        require(_aavePool != address(0), "Invalid Aave pool address");
        aavePool = _aavePool;
    }

    /**
     * @dev Set aToken address for an asset
     * @param asset Asset address
     * @param aToken Corresponding aToken address
     */
    function setAToken(address asset, address aToken) external onlyOwnerOrManager {
        require(aToken != address(0), "Invalid aToken address");
        assetToAToken[asset] = aToken;
    }

    /**
     * @dev Supply group funds to Aave when payment window completes
     * @param asset Asset to supply (address(0) for ETH, token address for ERC20)
     * @param amount Amount to supply
     */
    function supplyToAave(address asset, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(aavePool != address(0), "Aave pool not set");
        require(amount > 0, "Amount must be greater than 0");

        // Check balance
        uint256 availableBalance;
        if (asset == address(0)) {
            availableBalance = address(this).balance;
        } else {
            availableBalance = IERC20(asset).balanceOf(address(this));
        }
        require(availableBalance >= amount, "Insufficient balance");

        // Approve Aave pool if it's a token
        if (asset != address(0)) {
            IERC20(asset).approve(aavePool, amount);
        }

        // Supply to Aave - this pool receives aTokens
        IAavePool(aavePool).supply(
            asset,
            amount,
            address(this), // This pool receives the aTokens
            0 // referral code
        );

        // Track supplied amount
        suppliedToAave[asset] += amount;

        // Get aToken address
        address aToken = assetToAToken[asset];

        emit SuppliedToAave(asset, amount, aToken);
    }

    /**
     * @dev Get aToken balance for this pool (principal + yield)
     * @param asset Asset address
     * @return aToken balance
     */
    function getATokenBalance(address asset) external view returns (uint256) {
        address aToken = assetToAToken[asset];
        if (aToken == address(0)) return 0;

        return IAToken(aToken).balanceOf(address(this));
    }

    /**
     * @dev Calculate yield earned from Aave
     * @param asset Asset address
     * @return Yield amount (aToken balance - supplied amount)
     */
    function getAaveYield(address asset) external view returns (uint256) {
        address aToken = assetToAToken[asset];
        if (aToken == address(0)) return 0;

        uint256 aTokenBalance = IAToken(aToken).balanceOf(address(this));
        uint256 supplied = suppliedToAave[asset];

        if (aTokenBalance > supplied) {
            return aTokenBalance - supplied;
        }
        return 0;
    }
}