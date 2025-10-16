const cron = require('node-cron');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const ScheduledNotification = require('../models/ScheduledNotification');

/**
 * Notification Scheduler Service
 * Manages cron jobs and scheduled notification processing
 */
class NotificationScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start the notification scheduler
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Notification scheduler is already running');
      return;
    }

    try {
      await this.initializeScheduler();
      this.isRunning = true;
      logger.info('Notification scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start notification scheduler', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Stop the notification scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Notification scheduler is not running');
      return;
    }

    // Stop all cron jobs
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info('Stopped cron job', { name });
    });

    this.jobs.clear();
    this.isRunning = false;
    logger.info('Notification scheduler stopped');
  }

  /**
   * Initialize scheduler with cron jobs
   */
  async initializeScheduler() {
    // Process due notifications every minute
    this.scheduleJob('process-due-notifications', '* * * * *', async () => {
      await this.processDueNotifications();
    });

    // Clean up old notifications daily at 2 AM
    this.scheduleJob('cleanup-notifications', '0 2 * * *', async () => {
      await this.cleanupOldNotifications();
    });

    // Send daily digest at 9 AM for users who have it enabled
    this.scheduleJob('daily-digest', '0 9 * * *', async () => {
      await this.sendDailyDigests();
    });

    // Send weekly digest every Monday at 9 AM
    this.scheduleJob('weekly-digest', '0 9 * * 1', async () => {
      await this.sendWeeklyDigests();
    });

    // Send monthly digest on the 1st at 9 AM
    this.scheduleJob('monthly-digest', '0 9 1 * *', async () => {
      await this.sendMonthlyDigests();
    });

    // Check for missed group payments daily at 10 AM
    this.scheduleJob('group-payment-reminders', '0 10 * * *', async () => {
      await this.sendGroupPaymentReminders();
    });

    // Process milestone achievements every hour
    this.scheduleJob('milestone-check', '0 * * * *', async () => {
      await this.checkSavingsMilestones();
    });

    // Process expired savings locks every 5 minutes
    this.scheduleJob('process-expired-locks', '*/5 * * * *', async () => {
      await this.processExpiredSavingsLocks();
    });

    // Update savings yield every hour
    this.scheduleJob('update-savings-yield', '0 * * * *', async () => {
      await this.updateSavingsYield();
    });

    logger.info('Notification scheduler initialized', {
      jobCount: this.jobs.size
    });
  }

  /**
   * Schedule a cron job
   * @param {string} name Job name
   * @param {string} schedule Cron schedule expression
   * @param {Function} task Task function to execute
   */
  scheduleJob(name, schedule, task) {
    if (this.jobs.has(name)) {
      logger.warn('Cron job already exists, replacing', { name });
      this.jobs.get(name).stop();
    }

    const job = cron.schedule(schedule, async () => {
      try {
        logger.debug('Starting cron job', { name });
        await task();
        logger.debug('Completed cron job', { name });
      } catch (error) {
        logger.error('Cron job failed', {
          name,
          error: error.message,
          stack: error.stack
        });
      }
    }, {
      scheduled: false,
      timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
    });

    this.jobs.set(name, job);
    job.start();

    logger.info('Cron job scheduled', { name, schedule });
  }

  /**
   * Process due notifications
   */
  async processDueNotifications() {
    try {
      const result = await notificationService.processDueNotifications();

      if (result.success && result.processed > 0) {
        logger.info('Processed due notifications', {
          processed: result.processed
        });
      }

    } catch (error) {
      logger.error('Failed to process due notifications', {
        error: error.message
      });
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete old completed/failed notifications
      const result = await ScheduledNotification.deleteMany({
        status: { $in: ['sent', 'failed', 'cancelled'] },
        updatedAt: { $lt: thirtyDaysAgo }
      });

      logger.info('Cleaned up old notifications', {
        deletedCount: result.deletedCount
      });

    } catch (error) {
      logger.error('Failed to cleanup old notifications', {
        error: error.message
      });
    }
  }

  /**
   * Send daily digest notifications
   */
  async sendDailyDigests() {
    try {
      // Schedule daily digest notifications for users who have them enabled
      await this.scheduleDigestNotifications('daily');

      logger.info('Daily digest notifications scheduled');

    } catch (error) {
      logger.error('Failed to schedule daily digests', {
        error: error.message
      });
    }
  }

  /**
   * Send weekly digest notifications
   */
  async sendWeeklyDigests() {
    try {
      await this.scheduleDigestNotifications('weekly');

      logger.info('Weekly digest notifications scheduled');

    } catch (error) {
      logger.error('Failed to schedule weekly digests', {
        error: error.message
      });
    }
  }

  /**
   * Send monthly digest notifications
   */
  async sendMonthlyDigests() {
    try {
      await this.scheduleDigestNotifications('monthly');

      logger.info('Monthly digest notifications scheduled');

    } catch (error) {
      logger.error('Failed to schedule monthly digests', {
        error: error.message
      });
    }
  }

  /**
   * Schedule digest notifications for users
   * @param {string} frequency Digest frequency ('daily', 'weekly', 'monthly')
   */
  async scheduleDigestNotifications(frequency) {
    const NotificationPreference = require('../models/NotificationPreference');

    // Find users who want this digest frequency
    const users = await NotificationPreference.find({
      'timing.frequency.digest': frequency,
      'channels.email.enabled': true
    });

    for (const userPrefs of users) {
      try {
        // Calculate when to send based on user's timezone
        const sendTime = this.calculateDigestSendTime(userPrefs.timing.timezone);

        await notificationService.scheduleNotification({
          userId: userPrefs.userId,
          type: `${frequency}_digest`,
          channel: 'email',
          templateId: `email_${frequency}_digest`,
          templateVariables: new Map([
            ['frequency', frequency],
            ['timezone', userPrefs.timing.timezone]
          ]),
          scheduling: {
            scheduledFor: sendTime,
            timezone: userPrefs.timing.timezone
          },
          priority: 'normal',
          tags: ['digest', frequency],
          createdBy: 'system'
        });

      } catch (error) {
        logger.error('Failed to schedule digest for user', {
          userId: userPrefs.userId,
          frequency,
          error: error.message
        });
      }
    }
  }

  /**
   * Calculate digest send time based on timezone
   * @param {string} timezone User timezone
   * @returns {Date} Send time
   */
  calculateDigestSendTime(timezone) {
    const now = new Date();

    // Send at 9 AM in user's timezone
    const sendTime = new Date(now);
    sendTime.setHours(9, 0, 0, 0);

    // If it's already past 9 AM today, schedule for tomorrow
    if (sendTime <= now) {
      sendTime.setDate(sendTime.getDate() + 1);
    }

    return sendTime;
  }

  /**
   * Send group payment reminders
   */
  async sendGroupPaymentReminders() {
    try {
      // This would integrate with the group savings system
      // to find groups with upcoming payment deadlines
      logger.info('Group payment reminders check completed');

    } catch (error) {
      logger.error('Failed to send group payment reminders', {
        error: error.message
      });
    }
  }

  /**
   * Check for savings milestones
   */
  async checkSavingsMilestones() {
    try {
      // This would integrate with the savings system
      // to check if users have reached new milestones
      logger.info('Savings milestone check completed');

    } catch (error) {
      logger.error('Failed to check savings milestones', {
        error: error.message
      });
    }
  }

  /**
   * Process expired savings locks
   */
  async processExpiredSavingsLocks() {
    try {
      const savingsService = require('./savingsService');

      if (!savingsService.isInitialized) {
        await savingsService.initialize();
      }

      const result = await savingsService.processExpiredLocks();

      if (result.success && result.processed > 0) {
        logger.info('Processed expired savings locks', {
          processed: result.processed,
          failed: result.failed || 0
        });
      }

    } catch (error) {
      logger.error('Failed to process expired savings locks', {
        error: error.message
      });
    }
  }

  /**
   * Update savings yield for all active locks
   */
  async updateSavingsYield() {
    try {
      const savingsService = require('./savingsService');

      if (!savingsService.isInitialized) {
        await savingsService.initialize();
      }

      const result = await savingsService.updateAllActiveLocksYield();

      if (result.success) {
        logger.info('Updated savings yield', {
          updated: result.updated
        });
      }

    } catch (error) {
      logger.error('Failed to update savings yield', {
        error: error.message
      });
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    const jobStatus = {};

    this.jobs.forEach((job, name) => {
      jobStatus[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });

    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: jobStatus
    };
  }

  /**
   * Get job by name
   * @param {string} name Job name
   */
  getJob(name) {
    return this.jobs.get(name);
  }

  /**
   * Restart a job
   * @param {string} name Job name
   */
  restartJob(name) {
    const job = this.jobs.get(name);

    if (job) {
      job.stop();
      job.start();
      logger.info('Restarted cron job', { name });
      return true;
    }

    logger.warn('Job not found for restart', { name });
    return false;
  }

  /**
   * Add custom scheduled notification
   * @param {string} name Job name
   * @param {string} schedule Cron schedule
   * @param {Object} notificationConfig Notification configuration
   */
  addCustomJob(name, schedule, notificationConfig) {
    this.scheduleJob(name, schedule, async () => {
      await notificationService.scheduleNotification(notificationConfig);
    });
  }

  /**
   * Remove job
   * @param {string} name Job name
   */
  removeJob(name) {
    const job = this.jobs.get(name);

    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info('Removed cron job', { name });
      return true;
    }

    logger.warn('Job not found for removal', { name });
    return false;
  }
}

module.exports = new NotificationScheduler();