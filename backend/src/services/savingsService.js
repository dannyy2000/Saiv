const { ethers } = require('ethers');
const logger = require('../utils/logger');
const SavingsLock = require('../models/SavingsLock');
const User = require('../models/User');
const notificationService = require('./notificationService');

/**
 * Savings Service
 * Handles personal savings operations including lock management and Aave integration
 */
class SavingsService {
  constructor() {
    this.provider = null;
    this.adminSigner = null;
    this.userWalletABI = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the savings service
   */
  async initialize() {
    try {
      logger.info('Initializing savings service...');

      // Initialize provider and signer
      this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      this.adminSigner = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, this.provider);

      // Load UserWallet ABI (you would need to import the compiled ABI)
      // For now, we'll define the essential functions we need
      this.userWalletABI = [
        "function withdrawFromAave(address asset, uint256 amount) external returns (uint256)",
        "function supplyToAave(address asset, uint256 amount) external",
        "function checkAaveSavings(address asset) external view returns (bool hasBalance, uint256 aTokenBalance, uint256 suppliedAmount, uint256 yieldEarned)",
        "function getATokenBalance(address asset) external view returns (uint256)",
        "function getAaveYield(address asset) external view returns (uint256)",
        "function withdrawToken(address token, address to, uint256 amount) external",
        "function withdrawEth(address payable to, uint256 amount) external"
      ];

      this.isInitialized = true;
      logger.info('Savings service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize savings service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create a new savings lock
   * @param {Object} lockData Lock configuration
   */
  async createSavingsLock(lockData) {
    try {
      const { userId, walletAddress, asset, assetSymbol, amount, lockPeriodDays, autoWithdraw } = lockData;

      logger.info('Creating savings lock', { userId, walletAddress, asset, amount });

      // Calculate lock period in seconds
      const lockPeriodSeconds = lockPeriodDays * 24 * 60 * 60;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (lockPeriodSeconds * 1000));

      // Supply to Aave first
      const txHash = await this.supplyToAave(walletAddress, asset, amount);

      // Create savings lock record
      const savingsLock = await SavingsLock.createLock({
        userId,
        walletAddress,
        asset,
        assetSymbol,
        principal: amount.toString(),
        lockPeriod: lockPeriodSeconds,
        startTime,
        endTime,
        aaveSupplyTxHash: txHash,
        autoWithdraw: autoWithdraw || { enabled: false, destination: 'main_wallet' }
      });

      // Send notification
      await this.sendLockCreatedNotification(userId, {
        amount: amount.toString(),
        asset: assetSymbol,
        lockPeriod: lockPeriodDays,
        endTime: endTime.toISOString()
      });

      logger.info('Savings lock created successfully', {
        lockId: savingsLock._id,
        userId,
        txHash
      });

      return { success: true, savingsLock, txHash };

    } catch (error) {
      logger.error('Failed to create savings lock', {
        lockData,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Supply funds to Aave
   * @param {string} walletAddress User's savings wallet address
   * @param {string} asset Asset address (address(0) for ETH)
   * @param {string} amount Amount to supply
   * @returns {string} Transaction hash
   */
  async supplyToAave(walletAddress, asset, amount) {
    if (!this.isInitialized) {
      throw new Error('Savings service not initialized');
    }

    try {
      const walletContract = new ethers.Contract(walletAddress, this.userWalletABI, this.adminSigner);

      logger.info('Supplying to Aave', { walletAddress, asset, amount });

      const tx = await walletContract.supplyToAave(asset, amount, {
        gasLimit: 500000
      });

      const receipt = await tx.wait();

      logger.info('Successfully supplied to Aave', {
        walletAddress,
        asset,
        amount,
        txHash: receipt.hash
      });

      return receipt.hash;

    } catch (error) {
      logger.error('Failed to supply to Aave', {
        walletAddress,
        asset,
        amount,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Withdraw funds from Aave back to savings wallet
   * @param {string} walletAddress User's savings wallet address
   * @param {string} asset Asset address (address(0) for ETH)
   * @param {string} amount Amount to withdraw (or 'max' for all)
   * @returns {Object} Result with txHash and withdrawnAmount
   */
  async withdrawFromAave(walletAddress, asset, amount = 'max') {
    if (!this.isInitialized) {
      throw new Error('Savings service not initialized');
    }

    try {
      const walletContract = new ethers.Contract(walletAddress, this.userWalletABI, this.adminSigner);

      logger.info('Withdrawing from Aave', { walletAddress, asset, amount });

      // Use max uint256 for withdrawing all
      const withdrawAmount = amount === 'max'
        ? ethers.MaxUint256
        : ethers.parseUnits(amount.toString(), 18);

      const tx = await walletContract.withdrawFromAave(asset, withdrawAmount, {
        gasLimit: 500000
      });

      const receipt = await tx.wait();

      // Parse events to get actual withdrawn amount
      const withdrawnAmount = await this.getWithdrawnAmountFromReceipt(receipt);

      logger.info('Successfully withdrew from Aave', {
        walletAddress,
        asset,
        withdrawnAmount,
        txHash: receipt.hash
      });

      return {
        success: true,
        txHash: receipt.hash,
        withdrawnAmount: withdrawnAmount.toString()
      };

    } catch (error) {
      logger.error('Failed to withdraw from Aave', {
        walletAddress,
        asset,
        amount,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process expired savings locks
   */
  async processExpiredLocks() {
    try {
      const expiredLocks = await SavingsLock.findExpiredLocks(50);

      if (expiredLocks.length === 0) {
        logger.debug('No expired locks to process');
        return { success: true, processed: 0 };
      }

      logger.info('Processing expired savings locks', { count: expiredLocks.length });

      let processedCount = 0;
      let failedCount = 0;

      for (const lock of expiredLocks) {
        try {
          await this.processExpiredLock(lock);
          processedCount++;
        } catch (error) {
          failedCount++;
          await lock.markAsFailed(error);
          logger.error('Failed to process expired lock', {
            lockId: lock._id,
            error: error.message
          });
        }
      }

      logger.info('Completed processing expired locks', {
        total: expiredLocks.length,
        processed: processedCount,
        failed: failedCount
      });

      return { success: true, processed: processedCount, failed: failedCount };

    } catch (error) {
      logger.error('Failed to process expired locks', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process a single expired lock
   * @param {Object} lock SavingsLock document
   */
  async processExpiredLock(lock) {
    logger.info('Processing expired lock', {
      lockId: lock._id,
      userId: lock.userId,
      walletAddress: lock.walletAddress,
      asset: lock.asset
    });

    // Update yield information before processing
    await this.updateLockYield(lock);

    // Withdraw from Aave back to savings wallet
    const withdrawResult = await this.withdrawFromAave(
      lock.walletAddress,
      lock.asset,
      'max' // Withdraw all (principal + yield)
    );

    if (!withdrawResult.success) {
      throw new Error(`Failed to withdraw from Aave: ${withdrawResult.error}`);
    }

    // Check if user wants to auto-relock
    if (lock.autoWithdraw.enabled && lock.autoWithdraw.destination === 'relock') {
      await this.handleAutoRelock(lock, withdrawResult.withdrawnAmount, withdrawResult.txHash);
    } else {
      // Mark as withdrawn - funds are now in savings wallet
      await lock.markAsProcessed(withdrawResult.txHash, 'withdrawn');

      // Send notification about successful withdrawal
      await this.sendLockExpiredNotification(lock, withdrawResult.withdrawnAmount);
    }
  }

  /**
   * Handle automatic re-locking of savings
   * @param {Object} lock Original lock document
   * @param {string} withdrawnAmount Amount withdrawn from Aave
   * @param {string} txHash Withdrawal transaction hash
   */
  async handleAutoRelock(lock, withdrawnAmount, txHash) {
    try {
      const newLockPeriod = lock.autoWithdraw.newLockPeriod || lock.lockPeriod;

      // Supply back to Aave with new amount (principal + yield)
      const supplyTxHash = await this.supplyToAave(
        lock.walletAddress,
        lock.asset,
        withdrawnAmount
      );

      // Create new lock with withdrawn amount as principal
      await lock.relock(newLockPeriod, supplyTxHash);

      // Send notification about auto-relock
      await this.sendAutoRelockNotification(lock, withdrawnAmount, newLockPeriod);

      logger.info('Successfully auto-relocked savings', {
        originalLockId: lock._id,
        newPrincipal: withdrawnAmount,
        newLockPeriod
      });

    } catch (error) {
      // If relock fails, just mark as withdrawn and notify user
      await lock.markAsProcessed(txHash, 'withdrawn');
      await this.sendRelockFailedNotification(lock, error.message);
      throw error;
    }
  }

  /**
   * Update lock yield information
   * @param {Object} lock SavingsLock document
   */
  async updateLockYield(lock) {
    try {
      const walletContract = new ethers.Contract(lock.walletAddress, this.userWalletABI, this.provider);

      const [hasBalance, aTokenBalance, suppliedAmount, yieldEarned] =
        await walletContract.checkAaveSavings(lock.asset);

      if (hasBalance) {
        await lock.updateYield(
          ethers.formatUnits(aTokenBalance, 18),
          ethers.formatUnits(yieldEarned, 18)
        );

        logger.debug('Updated lock yield', {
          lockId: lock._id,
          aTokenBalance: ethers.formatUnits(aTokenBalance, 18),
          yieldEarned: ethers.formatUnits(yieldEarned, 18)
        });
      }

    } catch (error) {
      logger.error('Failed to update lock yield', {
        lockId: lock._id,
        error: error.message
      });
      // Don't throw - this is not critical for processing
    }
  }

  /**
   * Get user's active savings locks
   * @param {string} userId User ID
   */
  async getUserActiveLocks(userId) {
    try {
      const locks = await SavingsLock.findUserActiveLocks(userId);

      // Update yield for each active lock
      for (const lock of locks.filter(l => l.status === 'active')) {
        await this.updateLockYield(lock);
      }

      return { success: true, locks };

    } catch (error) {
      logger.error('Failed to get user active locks', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's savings history
   * @param {string} userId User ID
   * @param {number} limit Number of records to return
   */
  async getUserSavingsHistory(userId, limit = 20) {
    try {
      const history = await SavingsLock.findUserLockHistory(userId, limit);

      return { success: true, history };

    } catch (error) {
      logger.error('Failed to get user savings history', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update all active locks with current yield
   */
  async updateAllActiveLocksYield() {
    try {
      const activeLocks = await SavingsLock.find({ status: 'active' });

      logger.info('Updating yield for active locks', { count: activeLocks.length });

      for (const lock of activeLocks) {
        try {
          await this.updateLockYield(lock);
        } catch (error) {
          logger.error('Failed to update yield for lock', {
            lockId: lock._id,
            error: error.message
          });
        }
      }

      return { success: true, updated: activeLocks.length };

    } catch (error) {
      logger.error('Failed to update active locks yield', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // NOTIFICATION METHODS
  // ============================================

  async sendLockCreatedNotification(userId, lockData) {
    try {
      await notificationService.sendNotificationToUser(userId, 'savings_lock_created', lockData, ['email', 'push']);
    } catch (error) {
      logger.error('Failed to send lock created notification', { userId, error: error.message });
    }
  }

  async sendLockExpiredNotification(lock, withdrawnAmount) {
    try {
      const user = await User.findById(lock.userId);
      if (!user) return;

      const notificationData = {
        amount: withdrawnAmount,
        asset: lock.assetSymbol,
        yieldEarned: lock.yieldEarned,
        lockPeriod: Math.floor(lock.lockPeriod / (24 * 60 * 60)) // Convert to days
      };

      await notificationService.sendNotificationToUser(
        lock.userId,
        'savings_lock_expired',
        notificationData,
        ['email', 'sms', 'push']
      );
    } catch (error) {
      logger.error('Failed to send lock expired notification', {
        lockId: lock._id,
        error: error.message
      });
    }
  }

  async sendAutoRelockNotification(lock, newPrincipal, newLockPeriod) {
    try {
      const notificationData = {
        newAmount: newPrincipal,
        asset: lock.assetSymbol,
        newLockPeriod: Math.floor(newLockPeriod / (24 * 60 * 60)),
        yieldEarned: lock.yieldEarned
      };

      await notificationService.sendNotificationToUser(
        lock.userId,
        'savings_auto_relocked',
        notificationData,
        ['email', 'push']
      );
    } catch (error) {
      logger.error('Failed to send auto-relock notification', {
        lockId: lock._id,
        error: error.message
      });
    }
  }

  async sendRelockFailedNotification(lock, errorMessage) {
    try {
      const notificationData = {
        asset: lock.assetSymbol,
        errorMessage
      };

      await notificationService.sendNotificationToUser(
        lock.userId,
        'savings_relock_failed',
        notificationData,
        ['email', 'sms']
      );
    } catch (error) {
      logger.error('Failed to send relock failed notification', {
        lockId: lock._id,
        error: error.message
      });
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Parse withdrawn amount from transaction receipt
   * @param {Object} receipt Transaction receipt
   * @returns {BigNumber} Withdrawn amount
   */
  async getWithdrawnAmountFromReceipt(receipt) {
    try {
      // Look for WithdrawnFromAave event
      for (const log of receipt.logs) {
        try {
          // This would need proper event parsing based on your contract events
          // For now, return a placeholder
          return ethers.parseUnits("1000", 18); // Placeholder
        } catch (e) {
          continue;
        }
      }
      return ethers.parseUnits("0", 18);
    } catch (error) {
      logger.error('Failed to parse withdrawn amount from receipt', { error: error.message });
      return ethers.parseUnits("0", 18);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      provider: this.provider ? 'connected' : 'disconnected',
      adminSigner: this.adminSigner ? 'available' : 'unavailable'
    };
  }
}

module.exports = new SavingsService();