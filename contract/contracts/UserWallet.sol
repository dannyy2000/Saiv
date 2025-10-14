// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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

    // Address manager contract that can perform operations
    address public manager;

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
}