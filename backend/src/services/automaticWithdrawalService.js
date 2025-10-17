const { ethers } = require('ethers');
const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Automatic Withdrawal Service
 * Monitors group pools and executes automatic withdrawals when lock periods expire
 */
class AutomaticWithdrawalService {
  constructor() {
    this.provider = null;
    this.adminWallet = null;
    this.isRunning = false;
    this.scheduledJob = null;
    this.checkInterval = '*/5 * * * *'; // Every 5 minutes
    this.contractABI = [
      "function checkWithdrawalEligibility() external view returns (bool eligible, uint256 timeRemaining)",
      "function processAutomaticWithdraw(address asset) external",
      "function getGroupSummary(address asset) external view returns (uint256 principal, uint256 currentYield, uint256 totalMembers, uint256 totalContributions, bool withdrawalEligible, uint256 lockTimeRemaining)",
      "function groupStatus() external view returns (uint8)",
      "function lockPeriod() external view returns (uint256)",
      "function suppliedToAave(address asset) external view returns (uint256)",
      "function getSupportedTokens() external view returns (address[])"
    ];
    this.trackedGroups = new Map(); // groupAddress -> groupInfo
    this.processedWithdrawals = new Set(); // Track processed withdrawals
  }

  /**
   * Initialize the automatic withdrawal service
   */
  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error('RPC_URL not found in environment variables');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      logger.info('Automatic withdrawal service connected to network');

      // Initialize admin wallet
      const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!adminPrivateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
      }

      this.adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);
      logger.info('Admin wallet initialized for automatic withdrawals', {
        address: this.adminWallet.address
      });

      // Load existing groups from database or contract events
      await this.loadTrackedGroups();

      logger.info('Automatic withdrawal service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize automatic withdrawal service', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Start the automatic withdrawal scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('Automatic withdrawal service is already running');
      return;
    }

    try {
      this.scheduledJob = cron.schedule(this.checkInterval, async () => {
        await this.checkAndProcessWithdrawals();
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.scheduledJob.start();
      this.isRunning = true;

      logger.info('Automatic withdrawal scheduler started', {
        interval: this.checkInterval,
        trackedGroups: this.trackedGroups.size
      });
    } catch (error) {
      logger.error('Failed to start automatic withdrawal scheduler', {
        error: error.message
      });
    }
  }

  /**
   * Stop the automatic withdrawal scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Automatic withdrawal service is not running');
      return;
    }

    try {
      if (this.scheduledJob) {
        this.scheduledJob.stop();
        this.scheduledJob.destroy();
        this.scheduledJob = null;
      }

      this.isRunning = false;
      logger.info('Automatic withdrawal scheduler stopped');
    } catch (error) {
      logger.error('Failed to stop automatic withdrawal scheduler', {
        error: error.message
      });
    }
  }

  /**
   * Add a group to be monitored for automatic withdrawals
   */
  async addGroupToMonitor(groupAddress, groupInfo = {}) {
    try {
      if (!ethers.isAddress(groupAddress)) {
        throw new Error('Invalid group contract address');
      }

      // Get group contract instance
      const groupContract = new ethers.Contract(groupAddress, this.contractABI, this.provider);

      // Verify it's a valid group contract
      const lockPeriod = await groupContract.lockPeriod();
      const groupStatus = await groupContract.groupStatus();

      const groupData = {
        address: groupAddress,
        lockPeriod: lockPeriod.toString(),
        status: groupStatus,
        addedAt: Date.now(),
        lastChecked: 0,
        ...groupInfo
      };

      this.trackedGroups.set(groupAddress, groupData);

      logger.info('Group added to automatic withdrawal monitoring', {
        groupAddress,
        lockPeriod: new Date(Number(lockPeriod) * 1000).toISOString(),
        groupData
      });

      return true;
    } catch (error) {
      logger.error('Failed to add group to monitoring', {
        groupAddress,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Remove a group from monitoring
   */
  removeGroupFromMonitor(groupAddress) {
    if (this.trackedGroups.has(groupAddress)) {
      this.trackedGroups.delete(groupAddress);
      logger.info('Group removed from automatic withdrawal monitoring', {
        groupAddress
      });
      return true;
    }
    return false;
  }

  /**
   * Check all tracked groups and process withdrawals for eligible ones
   */
  async checkAndProcessWithdrawals() {
    if (this.trackedGroups.size === 0) {
      logger.debug('No groups to monitor for automatic withdrawals');
      return;
    }

    logger.info('Checking groups for automatic withdrawal eligibility', {
      totalGroups: this.trackedGroups.size
    });

    const eligibleGroups = [];
    const now = Date.now();

    for (const [groupAddress, groupInfo] of this.trackedGroups.entries()) {
      try {
        // Skip if checked recently (within last 2 minutes)
        if (now - groupInfo.lastChecked < 2 * 60 * 1000) {
          continue;
        }

        // Update last checked time
        groupInfo.lastChecked = now;

        // Check if group is eligible for withdrawal
        const eligibility = await this.checkGroupEligibility(groupAddress);

        if (eligibility.eligible) {
          eligibleGroups.push({
            address: groupAddress,
            info: groupInfo,
            ...eligibility
          });
        }

      } catch (error) {
        logger.error('Error checking group eligibility', {
          groupAddress,
          error: error.message
        });
      }
    }

    // Process eligible groups
    if (eligibleGroups.length > 0) {
      logger.info('Found eligible groups for automatic withdrawal', {
        count: eligibleGroups.length,
        groups: eligibleGroups.map(g => g.address)
      });

      for (const group of eligibleGroups) {
        await this.processGroupWithdrawal(group);
      }
    }
  }

  /**
   * Check if a specific group is eligible for automatic withdrawal
   */
  async checkGroupEligibility(groupAddress) {
    try {
      const groupContract = new ethers.Contract(groupAddress, this.contractABI, this.provider);

      // Check withdrawal eligibility
      const [eligible, timeRemaining] = await groupContract.checkWithdrawalEligibility();

      // Get supported tokens to know what assets to withdraw
      const supportedTokens = await groupContract.getSupportedTokens();

      // Check which assets have been supplied to Aave
      const assetsWithBalance = [];

      // Check ETH
      const ethSupplied = await groupContract.suppliedToAave(ethers.ZeroAddress);
      if (ethSupplied > 0) {
        assetsWithBalance.push(ethers.ZeroAddress);
      }

      // Check supported tokens
      for (const token of supportedTokens) {
        const tokenSupplied = await groupContract.suppliedToAave(token);
        if (tokenSupplied > 0) {
          assetsWithBalance.push(token);
        }
      }

      return {
        eligible: eligible && assetsWithBalance.length > 0,
        timeRemaining: timeRemaining.toString(),
        assetsWithBalance
      };

    } catch (error) {
      logger.error('Failed to check group eligibility', {
        groupAddress,
        error: error.message
      });
      return { eligible: false, timeRemaining: '0', assetsWithBalance: [] };
    }
  }

  /**
   * Process automatic withdrawal for a specific group
   */
  async processGroupWithdrawal(group) {
    const { address: groupAddress, assetsWithBalance } = group;

    try {
      // Check if already processed
      const processKey = `${groupAddress}`;
      if (this.processedWithdrawals.has(processKey)) {
        logger.info('Withdrawal already processed for group', { groupAddress });
        return;
      }

      logger.info('Processing automatic withdrawal for group', {
        groupAddress,
        assetsCount: assetsWithBalance.length
      });

      const groupContract = new ethers.Contract(groupAddress, this.contractABI, this.adminWallet);

      // Process withdrawal for each asset
      for (const asset of assetsWithBalance) {
        await this.processAssetWithdrawal(groupContract, asset, groupAddress);
      }

      // Mark as processed
      this.processedWithdrawals.add(processKey);

      // Remove from monitoring (group is now completed)
      this.removeGroupFromMonitor(groupAddress);

      logger.info('Automatic withdrawal completed successfully', {
        groupAddress,
        processedAssets: assetsWithBalance.length
      });

    } catch (error) {
      logger.error('Failed to process automatic withdrawal', {
        groupAddress,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Process withdrawal for a specific asset
   */
  async processAssetWithdrawal(groupContract, asset, groupAddress) {
    try {
      // Get gas estimate
      const gasEstimate = await groupContract.processAutomaticWithdraw.estimateGas(asset);
      const gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer

      // Get current gas price
      const feeData = await this.provider.getFeeData();

      logger.info('Executing automatic withdrawal transaction', {
        groupAddress,
        asset: asset === ethers.ZeroAddress ? 'ETH' : asset,
        gasLimit: gasLimit.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
      });

      // Execute withdrawal
      const tx = await groupContract.processAutomaticWithdraw(asset, {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      });

      logger.info('Automatic withdrawal transaction sent', {
        groupAddress,
        asset: asset === ethers.ZeroAddress ? 'ETH' : asset,
        transactionHash: tx.hash
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      logger.info('Automatic withdrawal transaction confirmed', {
        groupAddress,
        asset: asset === ethers.ZeroAddress ? 'ETH' : asset,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      return receipt;

    } catch (error) {
      logger.error('Failed to process asset withdrawal', {
        groupAddress,
        asset: asset === ethers.ZeroAddress ? 'ETH' : asset,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load tracked groups from database or other sources
   */
  async loadTrackedGroups() {
    try {
      // TODO: Load from database
      // For now, this would be populated by other services when groups are created
      logger.info('Loaded tracked groups for automatic withdrawal monitoring', {
        count: this.trackedGroups.size
      });
    } catch (error) {
      logger.error('Failed to load tracked groups', {
        error: error.message
      });
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      trackedGroups: this.trackedGroups.size,
      processedWithdrawals: this.processedWithdrawals.size,
      checkInterval: this.checkInterval,
      lastCheck: this.lastCheck || null,
      adminWallet: this.adminWallet?.address || null
    };
  }

  /**
   * Get detailed information about tracked groups
   */
  getTrackedGroups() {
    const groups = [];
    for (const [address, info] of this.trackedGroups.entries()) {
      groups.push({
        address,
        ...info,
        lockPeriodDate: new Date(Number(info.lockPeriod) * 1000).toISOString()
      });
    }
    return groups;
  }

  /**
   * Manual trigger for checking a specific group
   */
  async checkSpecificGroup(groupAddress) {
    try {
      if (!this.trackedGroups.has(groupAddress)) {
        throw new Error('Group is not being monitored');
      }

      const eligibility = await this.checkGroupEligibility(groupAddress);

      if (eligibility.eligible) {
        const group = {
          address: groupAddress,
          info: this.trackedGroups.get(groupAddress),
          ...eligibility
        };

        await this.processGroupWithdrawal(group);
        return { success: true, message: 'Withdrawal processed successfully' };
      } else {
        return {
          success: false,
          message: 'Group not eligible for withdrawal',
          eligibility
        };
      }
    } catch (error) {
      logger.error('Failed to manually check group', {
        groupAddress,
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }
}

module.exports = new AutomaticWithdrawalService();