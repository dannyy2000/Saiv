// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
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
    event SpendingLimitSet(address indexed asset, uint256 dailyLimit, uint256 monthlyLimit);
    event ScheduledTransactionCreated(uint256 indexed txId, address indexed to, address indexed asset, uint256 amount, uint256 executeTime);
    event ScheduledTransactionExecuted(uint256 indexed txId, bool success);
    event ScheduledTransactionCancelled(uint256 indexed txId);
    event RecoveryAddressAdded(address indexed recovery);
    event WalletFrozen(bool frozen);

    // Address manager contract that can perform operations
    address public manager;

    // Initialization flag
    bool private _initialized;

    // Aave integration
    address public aavePool; // Aave V3 Pool address
    mapping(address => address) public assetToAToken; // Maps asset to its aToken
    mapping(address => uint256) public suppliedToAave; // Track amount supplied to Aave per asset

    // Mapping to track token balances
    mapping(address => uint256) public tokenBalances;

    // List of supported tokens
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;

    // Spending limits
    struct SpendingLimit {
        uint256 dailyLimit;
        uint256 monthlyLimit;
        uint256 dailySpent;
        uint256 monthlySpent;
        uint256 lastDayReset;
        uint256 lastMonthReset;
    }
    mapping(address => SpendingLimit) public spendingLimits; // asset => spending limits

    // Scheduled transactions
    struct ScheduledTransaction {
        uint256 id;
        address to;
        address asset; // address(0) for ETH
        uint256 amount;
        uint256 executeTime;
        bool executed;
        bool cancelled;
        uint256 interval; // 0 for one-time, >0 for recurring (in seconds)
        uint256 executionCount;
        uint256 maxExecutions; // 0 for unlimited
    }
    mapping(uint256 => ScheduledTransaction) public scheduledTransactions;
    uint256 public nextScheduledTxId;

    // Wallet security
    mapping(address => bool) public recoveryAddresses;
    address[] public recoveryAddressList;
    bool public isFrozen;

    modifier onlyOwnerOrManager() {
        require(msg.sender == owner() || msg.sender == manager, "Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Temporary owner, will be transferred in initialize()
    }

    /**
     * @dev Initialize the wallet with owner and manager
     * @param _owner The owner of the wallet
     * @param _manager The address manager contract
     */
    function initialize(address _owner, address _manager) external {
        require(!_initialized, "Already initialized");
        require(_owner != address(0), "Invalid owner");
        require(_manager != address(0), "Invalid manager");

        _initialized = true;
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

    /**
     * @dev Withdraw from Aave back to savings wallet (for when lock expires)
     * @param asset Asset to withdraw (address(0) for ETH, token address for ERC20)
     * @param amount Amount to withdraw (use type(uint256).max for all)
     * @return Amount actually withdrawn
     */
    function withdrawFromAave(address asset, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
        returns (uint256)
    {
        require(aavePool != address(0), "Aave pool not set");
        address aToken = assetToAToken[asset];
        require(aToken != address(0), "aToken not set for asset");

        uint256 aTokenBalance = IAToken(aToken).balanceOf(address(this));
        require(aTokenBalance > 0, "No aToken balance");

        // If amount is max uint256, withdraw all
        if (amount == type(uint256).max) {
            amount = aTokenBalance;
        }

        require(amount <= aTokenBalance, "Insufficient aToken balance");

        // Withdraw from Aave back to this wallet
        uint256 withdrawnAmount = IAavePool(aavePool).withdraw(
            asset,
            amount,
            address(this)
        );

        // Update supplied tracking
        if (withdrawnAmount <= suppliedToAave[asset]) {
            suppliedToAave[asset] -= withdrawnAmount;
        } else {
            // If we withdrew more than originally supplied (due to yield), reset to 0
            suppliedToAave[asset] = 0;
        }

        // Update token balance if it's an ERC20 token
        if (asset != address(0)) {
            tokenBalances[asset] += withdrawnAmount;
        }

        emit WithdrawnFromAave(asset, withdrawnAmount);

        return withdrawnAmount;
    }

    /**
     * @dev Check if there are funds in Aave for this asset
     * @param asset Asset address to check
     * @return hasBalance True if there are aTokens for this asset
     * @return aTokenBalance Current aToken balance
     * @return suppliedAmount Original amount supplied to Aave
     * @return yieldEarned Yield earned so far
     */
    function checkAaveSavings(address asset)
        external
        view
        returns (
            bool hasBalance,
            uint256 aTokenBalance,
            uint256 suppliedAmount,
            uint256 yieldEarned
        )
    {
        address aToken = assetToAToken[asset];
        if (aToken == address(0)) {
            return (false, 0, 0, 0);
        }

        aTokenBalance = IAToken(aToken).balanceOf(address(this));
        suppliedAmount = suppliedToAave[asset];
        hasBalance = aTokenBalance > 0;

        if (aTokenBalance > suppliedAmount) {
            yieldEarned = aTokenBalance - suppliedAmount;
        } else {
            yieldEarned = 0;
        }
    }

    // ============================================
    // COMPOUND INTEREST CALCULATIONS
    // ============================================

    /**
     * @dev Calculate compound interest for a given principal, rate, and time
     * @param principal Initial amount
     * @param annualRatePercent Annual interest rate as percentage (e.g., 500 = 5%)
     * @param timeInSeconds Time period in seconds
     * @param compoundingFrequency How many times per year to compound (1=yearly, 12=monthly, 365=daily)
     * @return Final amount after compound interest
     */
    function calculateCompoundInterest(
        uint256 principal,
        uint256 annualRatePercent,
        uint256 timeInSeconds,
        uint256 compoundingFrequency
    ) public pure returns (uint256) {
        if (principal == 0 || annualRatePercent == 0 || timeInSeconds == 0) {
            return principal;
        }

        require(compoundingFrequency > 0, "Compounding frequency must be positive");

        // Convert time to years (scaled by 1e18 for precision)
        uint256 timeInYears = (timeInSeconds * 1e18) / (365 * 24 * 60 * 60);

        // Calculate rate per period: (rate / 100) / compounding_frequency (scaled by 1e18)
        uint256 ratePerPeriod = (annualRatePercent * 1e18) / (100 * compoundingFrequency);

        // Calculate number of compounding periods
        uint256 numPeriods = (timeInYears * compoundingFrequency) / 1e18;

        // Use exponential approximation for compound interest: A = P * (1 + r)^n
        // We'll use Taylor series approximation for (1 + r)^n
        return _compoundInterestApproximation(principal, ratePerPeriod, numPeriods);
    }

    /**
     * @dev Calculate projected savings with regular contributions and compound interest
     * @param initialAmount Starting balance
     * @param monthlyContribution Amount added each month
     * @param annualRatePercent Annual interest rate as percentage
     * @param months Number of months to project
     * @return projectedTotal Total amount after specified time
     * @return totalContributions Sum of all contributions made
     * @return totalInterest Total interest earned
     */
    function calculateSavingsProjection(
        uint256 initialAmount,
        uint256 monthlyContribution,
        uint256 annualRatePercent,
        uint256 months
    ) public pure returns (
        uint256 projectedTotal,
        uint256 totalContributions,
        uint256 totalInterest
    ) {
        totalContributions = initialAmount + (monthlyContribution * months);

        if (annualRatePercent == 0) {
            projectedTotal = totalContributions;
            totalInterest = 0;
            return (projectedTotal, totalContributions, totalInterest);
        }

        // Monthly interest rate (scaled by 1e18)
        uint256 monthlyRate = (annualRatePercent * 1e18) / (100 * 12);

        // Start with initial amount
        projectedTotal = initialAmount;

        // Compound each month with new contribution
        for (uint256 i = 0; i < months; i++) {
            // Add interest to current amount
            projectedTotal = projectedTotal + (projectedTotal * monthlyRate) / 1e18;
            // Add monthly contribution
            projectedTotal += monthlyContribution;
        }

        totalInterest = projectedTotal - totalContributions;
    }

    /**
     * @dev Calculate the time needed to reach a savings goal
     * @param currentAmount Current savings balance
     * @param targetAmount Goal amount to reach
     * @param monthlyContribution Amount added each month
     * @param annualRatePercent Annual interest rate as percentage
     * @return monthsNeeded Approximate months to reach goal (0 if unreachable)
     */
    function calculateTimeToGoal(
        uint256 currentAmount,
        uint256 targetAmount,
        uint256 monthlyContribution,
        uint256 annualRatePercent
    ) public pure returns (uint256 monthsNeeded) {
        if (currentAmount >= targetAmount) {
            return 0; // Already reached goal
        }

        if (monthlyContribution == 0 && annualRatePercent == 0) {
            return 0; // Impossible to reach goal
        }

        // If no interest, simple calculation
        if (annualRatePercent == 0) {
            if (monthlyContribution == 0) return 0;
            return (targetAmount - currentAmount + monthlyContribution - 1) / monthlyContribution;
        }

        // Binary search for months needed (max 1200 months = 100 years)
        uint256 low = 0;
        uint256 high = 1200;
        uint256 result = 0;

        while (low <= high && high > low) {
            uint256 mid = (low + high) / 2;

            (uint256 projected, , ) = calculateSavingsProjection(
                currentAmount,
                monthlyContribution,
                annualRatePercent,
                mid
            );

            if (projected >= targetAmount) {
                result = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return result;
    }

    /**
     * @dev Get current Aave APY for an asset (approximation based on recent yield)
     * @param asset Asset address
     * @param timeWindowSeconds Time window to calculate APY over
     * @return apyPercent Estimated APY as percentage (scaled by 100)
     */
    function estimateAaveAPY(address asset, uint256 timeWindowSeconds) external view returns (uint256 apyPercent) {
        if (timeWindowSeconds == 0 || suppliedToAave[asset] == 0) {
            return 0;
        }

        uint256 currentYield = this.getAaveYield(asset);
        if (currentYield == 0) {
            return 0;
        }

        // Estimate APY: (yield / principal) * (seconds_per_year / time_window) * 100
        uint256 principal = suppliedToAave[asset];
        uint256 secondsPerYear = 365 * 24 * 60 * 60;

        // Calculate yield rate over time window
        uint256 yieldRate = (currentYield * 1e18) / principal;

        // Annualize and convert to percentage
        apyPercent = (yieldRate * secondsPerYear * 100) / (timeWindowSeconds * 1e18);
    }

    /**
     * @dev Internal function for compound interest approximation using Taylor series
     * @param principal Initial amount
     * @param rate Interest rate per period (scaled by 1e18)
     * @param periods Number of periods
     * @return Final amount
     */
    function _compoundInterestApproximation(
        uint256 principal,
        uint256 rate,
        uint256 periods
    ) internal pure returns (uint256) {
        if (periods == 0) return principal;

        // For small rates and reasonable periods, use simplified compound formula
        // A ≈ P * (1 + rate)^periods

        // For efficiency, use binomial approximation for small rates
        if (rate < 1e17) { // Less than 10% per period
            // Use: (1 + r)^n ≈ 1 + nr + n(n-1)r²/2 + n(n-1)(n-2)r³/6
            uint256 term1 = 1e18; // 1
            uint256 term2 = (periods * rate); // nr
            uint256 term3 = 0;
            uint256 term4 = 0;

            if (periods > 1 && rate > 0) {
                // n(n-1)r²/2
                term3 = (periods * (periods - 1) * rate * rate) / (2 * 1e18);

                if (periods > 2) {
                    // n(n-1)(n-2)r³/6
                    term4 = (periods * (periods - 1) * (periods - 2) * rate * rate * rate) / (6 * 1e36);
                }
            }

            uint256 multiplier = term1 + term2 + term3 + term4;
            return (principal * multiplier) / 1e18;
        } else {
            // For larger rates, use iterative calculation
            uint256 result = principal;
            for (uint256 i = 0; i < periods && i < 100; i++) { // Cap at 100 iterations
                result = result + (result * rate) / 1e18;
            }
            return result;
        }
    }

    /**
     * @dev Calculate break-even analysis for different savings strategies
     * @param strategy1Contribution Monthly contribution for strategy 1
     * @param strategy1Rate Annual rate for strategy 1 (as percentage)
     * @param strategy2Contribution Monthly contribution for strategy 2
     * @param strategy2Rate Annual rate for strategy 2 (as percentage)
     * @param months Time horizon in months
     * @return strategy1Total Final amount for strategy 1
     * @return strategy2Total Final amount for strategy 2
     * @return betterStrategy 1 if strategy1 is better, 2 if strategy2 is better, 0 if equal
     */
    function compareStrategies(
        uint256 strategy1Contribution,
        uint256 strategy1Rate,
        uint256 strategy2Contribution,
        uint256 strategy2Rate,
        uint256 months
    ) public pure returns (
        uint256 strategy1Total,
        uint256 strategy2Total,
        uint8 betterStrategy
    ) {
        (strategy1Total, , ) = calculateSavingsProjection(0, strategy1Contribution, strategy1Rate, months);
        (strategy2Total, , ) = calculateSavingsProjection(0, strategy2Contribution, strategy2Rate, months);

        if (strategy1Total > strategy2Total) {
            betterStrategy = 1;
        } else if (strategy2Total > strategy1Total) {
            betterStrategy = 2;
        } else {
            betterStrategy = 0;
        }
    }

    // ============================================
    // SPENDING LIMITS AND CONTROLS
    // ============================================

    modifier notFrozen() {
        require(!isFrozen, "Wallet is frozen");
        _;
    }

    modifier withinSpendingLimits(address asset, uint256 amount) {
        _updateSpendingPeriods(asset);
        _checkSpendingLimits(asset, amount);
        _;
        _recordSpending(asset, amount);
    }

    /**
     * @dev Set spending limits for an asset
     * @param asset Asset address (address(0) for ETH)
     * @param dailyLimit Maximum amount per day (0 for no limit)
     * @param monthlyLimit Maximum amount per month (0 for no limit)
     */
    function setSpendingLimit(
        address asset,
        uint256 dailyLimit,
        uint256 monthlyLimit
    ) external onlyOwnerOrManager {
        SpendingLimit storage limit = spendingLimits[asset];

        limit.dailyLimit = dailyLimit;
        limit.monthlyLimit = monthlyLimit;

        // Initialize periods if not set
        if (limit.lastDayReset == 0) {
            limit.lastDayReset = block.timestamp;
        }
        if (limit.lastMonthReset == 0) {
            limit.lastMonthReset = block.timestamp;
        }

        emit SpendingLimitSet(asset, dailyLimit, monthlyLimit);
    }

    /**
     * @dev Get spending limit information for an asset
     * @param asset Asset address
     * @return dailyLimit Maximum daily limit
     * @return monthlyLimit Maximum monthly limit
     * @return dailySpent Amount spent today
     * @return monthlySpent Amount spent this month
     * @return dailyRemaining Amount remaining today
     * @return monthlyRemaining Amount remaining this month
     */
    function getSpendingLimitInfo(address asset) external view returns (
        uint256 dailyLimit,
        uint256 monthlyLimit,
        uint256 dailySpent,
        uint256 monthlySpent,
        uint256 dailyRemaining,
        uint256 monthlyRemaining
    ) {
        SpendingLimit storage limit = spendingLimits[asset];

        dailyLimit = limit.dailyLimit;
        monthlyLimit = limit.monthlyLimit;
        dailySpent = limit.dailySpent;
        monthlySpent = limit.monthlySpent;

        // Calculate remaining amounts
        if (dailyLimit > 0) {
            dailyRemaining = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0;
        } else {
            dailyRemaining = type(uint256).max; // No limit
        }

        if (monthlyLimit > 0) {
            monthlyRemaining = monthlyLimit > monthlySpent ? monthlyLimit - monthlySpent : 0;
        } else {
            monthlyRemaining = type(uint256).max; // No limit
        }
    }

    /**
     * @dev Internal function to update spending periods (reset if new day/month)
     */
    function _updateSpendingPeriods(address asset) internal {
        SpendingLimit storage limit = spendingLimits[asset];

        // Reset daily spending if new day
        if (block.timestamp >= limit.lastDayReset + 1 days) {
            limit.dailySpent = 0;
            limit.lastDayReset = block.timestamp;
        }

        // Reset monthly spending if new month (approximately)
        if (block.timestamp >= limit.lastMonthReset + 30 days) {
            limit.monthlySpent = 0;
            limit.lastMonthReset = block.timestamp;
        }
    }

    /**
     * @dev Internal function to check spending limits
     */
    function _checkSpendingLimits(address asset, uint256 amount) internal view {
        SpendingLimit storage limit = spendingLimits[asset];

        // Check daily limit
        if (limit.dailyLimit > 0) {
            require(limit.dailySpent + amount <= limit.dailyLimit, "Exceeds daily spending limit");
        }

        // Check monthly limit
        if (limit.monthlyLimit > 0) {
            require(limit.monthlySpent + amount <= limit.monthlyLimit, "Exceeds monthly spending limit");
        }
    }

    /**
     * @dev Internal function to record spending
     */
    function _recordSpending(address asset, uint256 amount) internal {
        SpendingLimit storage limit = spendingLimits[asset];
        limit.dailySpent += amount;
        limit.monthlySpent += amount;
    }

    // ============================================
    // SCHEDULED TRANSACTIONS
    // ============================================

    /**
     * @dev Schedule a transaction for future execution
     * @param to Recipient address
     * @param asset Asset address (address(0) for ETH)
     * @param amount Amount to send
     * @param executeTime When to execute (timestamp)
     * @param interval Recurring interval in seconds (0 for one-time)
     * @param maxExecutions Maximum executions (0 for unlimited recurring)
     * @return txId Transaction ID
     */
    function scheduleTransaction(
        address to,
        address asset,
        uint256 amount,
        uint256 executeTime,
        uint256 interval,
        uint256 maxExecutions
    ) external onlyOwnerOrManager returns (uint256 txId) {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(executeTime > block.timestamp, "Execute time must be in future");

        txId = nextScheduledTxId++;

        scheduledTransactions[txId] = ScheduledTransaction({
            id: txId,
            to: to,
            asset: asset,
            amount: amount,
            executeTime: executeTime,
            executed: false,
            cancelled: false,
            interval: interval,
            executionCount: 0,
            maxExecutions: maxExecutions
        });

        emit ScheduledTransactionCreated(txId, to, asset, amount, executeTime);
    }

    /**
     * @dev Execute a scheduled transaction
     * @param txId Transaction ID to execute
     */
    function executeScheduledTransaction(uint256 txId) external nonReentrant notFrozen {
        ScheduledTransaction storage scheduledTx = scheduledTransactions[txId];

        require(scheduledTx.id == txId, "Transaction does not exist");
        require(!scheduledTx.executed || scheduledTx.interval > 0, "Transaction already executed");
        require(!scheduledTx.cancelled, "Transaction cancelled");
        require(block.timestamp >= scheduledTx.executeTime, "Not yet time to execute");

        // Check if recurring transaction has reached max executions
        if (scheduledTx.maxExecutions > 0 && scheduledTx.executionCount >= scheduledTx.maxExecutions) {
            revert("Max executions reached");
        }

        bool success = false;

        // Check spending limits
        _updateSpendingPeriods(scheduledTx.asset);
        _checkSpendingLimits(scheduledTx.asset, scheduledTx.amount);

        if (scheduledTx.asset == address(0)) {
            // ETH transfer
            if (address(this).balance >= scheduledTx.amount) {
                payable(scheduledTx.to).transfer(scheduledTx.amount);
                success = true;
            }
        } else {
            // Token transfer
            IERC20 token = IERC20(scheduledTx.asset);
            if (token.balanceOf(address(this)) >= scheduledTx.amount) {
                success = token.transfer(scheduledTx.to, scheduledTx.amount);
            }
        }

        if (success) {
            _recordSpending(scheduledTx.asset, scheduledTx.amount);
            scheduledTx.executionCount++;

            // Handle recurring transactions
            if (scheduledTx.interval > 0) {
                scheduledTx.executeTime += scheduledTx.interval; // Schedule next execution
            } else {
                scheduledTx.executed = true; // Mark one-time transaction as executed
            }
        }

        emit ScheduledTransactionExecuted(txId, success);
    }

    /**
     * @dev Cancel a scheduled transaction
     * @param txId Transaction ID to cancel
     */
    function cancelScheduledTransaction(uint256 txId) external onlyOwnerOrManager {
        ScheduledTransaction storage scheduledTx = scheduledTransactions[txId];

        require(scheduledTx.id == txId, "Transaction does not exist");
        require(!scheduledTx.executed, "Cannot cancel executed transaction");
        require(!scheduledTx.cancelled, "Transaction already cancelled");

        scheduledTx.cancelled = true;

        emit ScheduledTransactionCancelled(txId);
    }

    /**
     * @dev Get scheduled transaction details
     * @param txId Transaction ID
     * @return to Recipient address
     * @return asset Asset address
     * @return amount Transaction amount
     * @return executeTime Execution time
     * @return executed Whether executed
     * @return cancelled Whether cancelled
     * @return interval Recurrence interval
     * @return executionCount Number of executions
     * @return maxExecutions Maximum executions
     */
    function getScheduledTransaction(uint256 txId) external view returns (
        address to,
        address asset,
        uint256 amount,
        uint256 executeTime,
        bool executed,
        bool cancelled,
        uint256 interval,
        uint256 executionCount,
        uint256 maxExecutions
    ) {
        ScheduledTransaction storage scheduledTx = scheduledTransactions[txId];
        require(scheduledTx.id == txId, "Transaction does not exist");

        return (
            scheduledTx.to,
            scheduledTx.asset,
            scheduledTx.amount,
            scheduledTx.executeTime,
            scheduledTx.executed,
            scheduledTx.cancelled,
            scheduledTx.interval,
            scheduledTx.executionCount,
            scheduledTx.maxExecutions
        );
    }

    // ============================================
    // WALLET SECURITY
    // ============================================

    /**
     * @dev Add a recovery address
     * @param recovery Recovery address to add
     */
    function addRecoveryAddress(address recovery) external onlyOwnerOrManager {
        require(recovery != address(0), "Invalid recovery address");
        require(!recoveryAddresses[recovery], "Recovery address already added");

        recoveryAddresses[recovery] = true;
        recoveryAddressList.push(recovery);

        emit RecoveryAddressAdded(recovery);
    }

    /**
     * @dev Freeze wallet (emergency function)
     * @param freeze True to freeze, false to unfreeze
     */
    function freezeWallet(bool freeze) external {
        require(
            msg.sender == owner() ||
            msg.sender == manager ||
            recoveryAddresses[msg.sender],
            "Not authorized to freeze wallet"
        );

        isFrozen = freeze;

        emit WalletFrozen(freeze);
    }

    /**
     * @dev Get all recovery addresses
     * @return Array of recovery addresses
     */
    function getRecoveryAddresses() external view returns (address[] memory) {
        return recoveryAddressList;
    }

    /**
     * @dev Check if address is a recovery address
     * @param addr Address to check
     * @return True if it's a recovery address
     */
    function isRecoveryAddress(address addr) external view returns (bool) {
        return recoveryAddresses[addr];
    }

    // ============================================
    // ENHANCED TRANSFER FUNCTIONS
    // ============================================

    /**
     * @dev Enhanced ETH withdrawal with spending limits
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawEthWithLimits(address payable to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
        notFrozen
        withinSpendingLimits(address(0), amount)
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= amount, "Insufficient balance");

        to.transfer(amount);
        emit EthWithdrawn(to, amount);
    }

    /**
     * @dev Enhanced token withdrawal with spending limits
     * @param tokenAddress Token contract address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawTokenWithLimits(address tokenAddress, address to, uint256 amount)
        external
        onlyOwnerOrManager
        nonReentrant
        notFrozen
        withinSpendingLimits(tokenAddress, amount)
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(address(this)) >= amount, "Insufficient token balance");

        require(token.transfer(to, amount), "Token transfer failed");
        emit TokenWithdrawn(tokenAddress, to, amount);
    }
}