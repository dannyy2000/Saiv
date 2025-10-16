const automaticWithdrawalService = require('./automaticWithdrawalService');
const withdrawalEventHandler = require('./withdrawalEventHandler');
const Group = require('../models/Group');
const logger = require('../utils/logger');

/**
 * Withdrawal Integration Service
 * Manages the integration between automatic withdrawal monitoring and event handling
 */
class WithdrawalIntegrationService {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
  }

  /**
   * Initialize the withdrawal integration service
   */
  async initialize() {
    try {
      logger.info('Initializing withdrawal integration service...');

      // Initialize automatic withdrawal service
      const withdrawalInitialized = await automaticWithdrawalService.initialize();
      if (!withdrawalInitialized) {
        throw new Error('Failed to initialize automatic withdrawal service');
      }

      // Initialize event handler
      const eventHandlerInitialized = await withdrawalEventHandler.initialize();
      if (!eventHandlerInitialized) {
        throw new Error('Failed to initialize withdrawal event handler');
      }

      // Load active groups and start monitoring
      await this.loadAndMonitorActiveGroups();

      this.isInitialized = true;
      logger.info('Withdrawal integration service initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize withdrawal integration service', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Start the withdrawal integration service
   */
  async start() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize withdrawal integration service');
      }
    }

    if (this.isRunning) {
      logger.warn('Withdrawal integration service is already running');
      return;
    }

    try {
      // Start automatic withdrawal scheduler
      automaticWithdrawalService.start();

      this.isRunning = true;
      logger.info('Withdrawal integration service started successfully');

    } catch (error) {
      logger.error('Failed to start withdrawal integration service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop the withdrawal integration service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Withdrawal integration service is not running');
      return;
    }

    try {
      // Stop automatic withdrawal scheduler
      automaticWithdrawalService.stop();

      // Stop all event listeners
      withdrawalEventHandler.stopAll();

      this.isRunning = false;
      logger.info('Withdrawal integration service stopped');

    } catch (error) {
      logger.error('Failed to stop withdrawal integration service', {
        error: error.message
      });
    }
  }

  /**
   * Add a new group to withdrawal monitoring
   */
  async addGroupToMonitoring(groupData) {
    try {
      const {
        address,
        lockPeriod,
        name,
        owner,
        _id
      } = groupData;

      // Validate required fields
      if (!address || !lockPeriod) {
        throw new Error('Group address and lock period are required');
      }

      // Add to automatic withdrawal monitoring
      const added = await automaticWithdrawalService.addGroupToMonitor(address, {
        name,
        owner,
        mongoId: _id,
        lockPeriod: new Date(lockPeriod).getTime() / 1000 // Convert to Unix timestamp
      });

      if (!added) {
        throw new Error('Failed to add group to automatic withdrawal monitoring');
      }

      // Start listening for withdrawal events
      const listening = await withdrawalEventHandler.startListening(address);
      if (!listening) {
        logger.warn('Failed to start event listening for group', { address });
      }

      logger.info('Group added to withdrawal monitoring', {
        address,
        name,
        lockPeriod
      });

      return true;

    } catch (error) {
      logger.error('Failed to add group to withdrawal monitoring', {
        groupData,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Remove a group from withdrawal monitoring
   */
  removeGroupFromMonitoring(groupAddress) {
    try {
      // Remove from automatic withdrawal monitoring
      automaticWithdrawalService.removeGroupFromMonitor(groupAddress);

      // Stop listening for events
      withdrawalEventHandler.stopListening(groupAddress);

      logger.info('Group removed from withdrawal monitoring', { groupAddress });
      return true;

    } catch (error) {
      logger.error('Failed to remove group from withdrawal monitoring', {
        groupAddress,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Load active groups from database and start monitoring them
   */
  async loadAndMonitorActiveGroups() {
    try {
      // Find active groups with lock periods
      const activeGroups = await Group.find({
        groupStatus: 'active',
        lockPeriod: { $exists: true, $ne: null },
        'automaticWithdrawal.enabled': { $ne: false }
      }).select('address name owner lockPeriod automaticWithdrawal');

      logger.info('Loading active groups for withdrawal monitoring', {
        count: activeGroups.length
      });

      for (const group of activeGroups) {
        await this.addGroupToMonitoring(group);
      }

      logger.info('Finished loading active groups for withdrawal monitoring', {
        loaded: activeGroups.length
      });

    } catch (error) {
      logger.error('Failed to load active groups for withdrawal monitoring', {
        error: error.message
      });
    }
  }

  /**
   * Manually trigger withdrawal check for a specific group
   */
  async triggerManualWithdrawal(groupAddress) {
    try {
      const result = await automaticWithdrawalService.checkSpecificGroup(groupAddress);

      logger.info('Manual withdrawal trigger result', {
        groupAddress,
        result
      });

      return result;

    } catch (error) {
      logger.error('Failed to trigger manual withdrawal', {
        groupAddress,
        error: error.message
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Process past events for a group (useful for syncing)
   */
  async syncGroupEvents(groupAddress, fromBlock = 0) {
    try {
      await withdrawalEventHandler.processPastEvents(groupAddress, fromBlock);

      logger.info('Group events synced successfully', {
        groupAddress,
        fromBlock
      });

      return true;

    } catch (error) {
      logger.error('Failed to sync group events', {
        groupAddress,
        fromBlock,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get comprehensive status of withdrawal services
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      automaticWithdrawal: automaticWithdrawalService.getStatus(),
      eventHandler: withdrawalEventHandler.getStatus()
    };
  }

  /**
   * Get detailed information about monitored groups
   */
  getMonitoredGroups() {
    return automaticWithdrawalService.getTrackedGroups();
  }

  /**
   * Health check for withdrawal services
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      const issues = [];

      if (!status.isInitialized) {
        issues.push('Service not initialized');
      }

      if (!status.isRunning) {
        issues.push('Service not running');
      }

      if (!status.automaticWithdrawal.isRunning) {
        issues.push('Automatic withdrawal scheduler not running');
      }

      if (!status.eventHandler.isInitialized) {
        issues.push('Event handler not initialized');
      }

      return {
        healthy: issues.length === 0,
        issues,
        status
      };

    } catch (error) {
      return {
        healthy: false,
        issues: [`Health check failed: ${error.message}`],
        status: null
      };
    }
  }
}

module.exports = new WithdrawalIntegrationService();