// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAave.sol";

/**
 * @title UserWallet
 * @dev Smart contract wallet for individual users to hold ETH and ERC-20 tokens
 */
contract UserWallet is ReentrancyGuard, Ownable {
    // Events
    event EthDeposited(address indexed from, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokenDeposited(address indexed token, address indexed from, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event WalletInitialized(address indexed owner, address indexed manager);
    event SuppliedToAave(address indexed asset, uint256 amount, address indexed aToken);
    event WithdrawnFromAave(address indexed asset, uint256 amount);

    // Address manager contract that can perform operations
    address public manager;

    // Aave integration
    address public aavePool; // Aave V3 Pool address
    mapping(address => address) public assetToAToken; // Maps asset to its aToken
    mapping(address => uint256) public suppliedToAave; // Track amount supplied to Aave per asset

    // Mapping to track token balances
    mapping(address => uint256) public tokenBalances;

    // List of supported tokens
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;

    modifier onlyOwnerOrManager() {
        require(msg.sender == owner() || msg.sender == manager, "Not authorized");
        _;
    }

    constructor() {
        // Constructor is empty as we use initialize pattern
    }

    /**
     * @dev Initialize the wallet with owner and manager
     * @param _owner The owner of the wallet
     * @param _manager The address manager contract
     */
    function initialize(address _owner, address _manager) external {
        require(owner() == address(0), "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_manager != address(0), "Invalid manager");

        _transferOwnership(_owner);
        manager = _manager;

        emit WalletInitialized(_owner, _manager);
    }

    /**
     * @dev Receive ETH deposits
     */
    receive() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Fallback function to receive ETH
     */
    fallback() external payable {
        emit EthDeposited(msg.sender, msg.value);
    }

    /**
     * @dev Get ETH balance of the wallet
     * @return ETH balance in wei
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Withdraw ETH from the wallet
     * @param to Recipient address
     * @param amount Amount in wei to withdraw
     */
    function withdrawEth(address payable to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient ETH balance");

        to.transfer(amount);
        emit EthWithdrawn(to, amount);
    }

    /**
     * @dev Add support for a new ERC-20 token
     * @param token Token contract address
     */
    function addSupportedToken(address token) external onlyOwnerOrManager {
        require(token != address(0), "Invalid token address");
        require(!isTokenSupported[token], "Token already supported");

        supportedTokens.push(token);
        isTokenSupported[token] = true;
    }

    /**
     * @dev Remove support for an ERC-20 token
     * @param token Token contract address
     */
    function removeSupportedToken(address token) external onlyOwnerOrManager {
        require(isTokenSupported[token], "Token not supported");

        isTokenSupported[token] = false;

        // Remove from array
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
    }

    /**
     * @dev Deposit ERC-20 tokens to the wallet
     * @param token Token contract address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(isTokenSupported[token], "Token not supported");

        IERC20 tokenContract = IERC20(token);

        // Transfer tokens from sender to this wallet
        require(
            tokenContract.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        tokenBalances[token] += amount;
        emit TokenDeposited(token, msg.sender, amount);
    }

    /**
     * @dev Withdraw ERC-20 tokens from the wallet
     * @param token Token contract address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawToken(address token, address to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(isTokenSupported[token], "Token not supported");
        require(tokenBalances[token] >= amount, "Insufficient token balance");

        IERC20 tokenContract = IERC20(token);

        tokenBalances[token] -= amount;

        require(
            tokenContract.transfer(to, amount),
            "Token transfer failed"
        );

        emit TokenWithdrawn(token, to, amount);
    }

    /**
     * @dev Get token balance
     * @param token Token contract address
     * @return Token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        require(token != address(0), "Invalid token address");
        return tokenBalances[token];
    }

    /**
     * @dev Get actual token balance from contract
     * @param token Token contract address
     * @return Actual token balance
     */
    function getActualTokenBalance(address token) external view returns (uint256) {
        require(token != address(0), "Invalid token address");
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Get list of supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @dev Sync token balance with actual contract balance
     * @param token Token contract address
     */
    function syncTokenBalance(address token) external onlyOwnerOrManager {
        require(token != address(0), "Invalid token address");
        require(isTokenSupported[token], "Token not supported");

        uint256 actualBalance = IERC20(token).balanceOf(address(this));
        tokenBalances[token] = actualBalance;
    }

    /**
     * @dev Emergency withdraw all ETH (only owner)
     */
    function emergencyWithdrawEth() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
            emit EthWithdrawn(owner(), balance);
        }
    }

    /**
     * @dev Emergency withdraw all tokens (only owner)
     * @param token Token contract address
     */
    function emergencyWithdrawToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");

        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));

        if (balance > 0) {
            tokenBalances[token] = 0;
            require(
                tokenContract.transfer(owner(), balance),
                "Token transfer failed"
            );
            emit TokenWithdrawn(token, owner(), balance);
        }
    }

    /**
     * @dev Transfer tokens between wallets (internal use)
     * @param token Token contract address
     * @param to Recipient wallet address
     * @param amount Amount to transfer
     */
    function transferToWallet(address token, address to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(isTokenSupported[token], "Token not supported");
        require(tokenBalances[token] >= amount, "Insufficient token balance");

        IERC20 tokenContract = IERC20(token);

        tokenBalances[token] -= amount;

        require(
            tokenContract.transfer(to, amount),
            "Token transfer failed"
        );

        emit TokenWithdrawn(token, to, amount);
    }

    /**
     * @dev Send ETH to another address
     * @param to Recipient address
     * @param amount Amount in wei to send
     */
    function sendEth(address payable to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient ETH balance");

        to.transfer(amount);
        emit EthWithdrawn(to, amount);
    }

    // ============================================
    // AAVE SAVINGS INTEGRATION
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
     * @dev Supply to Aave to earn yield (for savings wallet)
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

        // Supply to Aave - this wallet receives aTokens
        IAavePool(aavePool).supply(
            asset,
            amount,
            address(this), // This wallet receives the aTokens
            0 // referral code
        );

        // Track supplied amount
        suppliedToAave[asset] += amount;

        // Get aToken address
        address aToken = assetToAToken[asset];

        emit SuppliedToAave(asset, amount, aToken);
    }

    /**
     * @dev Get aToken balance for this wallet (principal + yield)
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