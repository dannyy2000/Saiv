const mongoose = require('mongoose');

/**
 * Scheduled Notification Schema
 * Manages scheduled and recurring notifications
 */
const scheduledNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Notification Configuration
  type: {
    type: String,
    required: true,
    enum: [
      'payment_reminder',
      'milestone_check',
      'weekly_digest',
      'monthly_summary',
      'balance_check',
      'group_reminder',
      'savings_goal_reminder',
      'custom'
    ]
  },

  channel: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'push']
  },

  // Template and Content
  templateId: {
    type: String,
    required: true
  },

  templateVariables: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Scheduling Configuration
  scheduling: {
    // When to send
    scheduledFor: {
      type: Date,
      required: true
    },

    // Recurring configuration
    recurring: {
      enabled: {
        type: Boolean,
        default: false
      },
      pattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        default: 'daily'
      },
      interval: {
        type: Number,
        default: 1 // Every N periods
      },
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6 // 0 = Sunday, 6 = Saturday
      }],
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31
      },
      endDate: Date,
      maxOccurrences: Number
    },

    // Timezone
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Execution Status
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending'
  },

  // Execution History
  executions: [{
    executedAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true
    },
    response: mongoose.Schema.Types.Mixed,
    error: String,
    nextExecution: Date
  }],

  // Retry Configuration
  retryConfig: {
    maxRetries: {
      type: Number,
      default: 3
    },
    currentRetries: {
      type: Number,
      default: 0
    },
    retryDelay: {
      type: Number,
      default: 300000 // 5 minutes
    }
  },

  // Metadata
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  tags: [String],

  createdBy: {
    type: String,
    enum: ['system', 'user', 'admin'],
    default: 'system'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
scheduledNotificationSchema.index({ userId: 1 });
scheduledNotificationSchema.index({ 'scheduling.scheduledFor': 1 });
scheduledNotificationSchema.index({ status: 1 });
scheduledNotificationSchema.index({ type: 1 });
scheduledNotificationSchema.index({ 'scheduling.scheduledFor': 1, status: 1 });

// Instance Methods
scheduledNotificationSchema.methods.markAsSent = function(response) {
  this.status = 'sent';
  this.executions.push({
    executedAt: new Date(),
    status: 'success',
    response,
    nextExecution: this.calculateNextExecution()
  });

  // Schedule next occurrence if recurring
  if (this.scheduling.recurring.enabled) {
    this.scheduleNextOccurrence();
  }

  return this.save();
};

scheduledNotificationSchema.methods.markAsFailed = function(error) {
  this.retryConfig.currentRetries++;

  this.executions.push({
    executedAt: new Date(),
    status: 'failed',
    error: error.message || error,
    nextExecution: this.shouldRetry() ? this.calculateRetryTime() : null
  });

  if (this.shouldRetry()) {
    this.scheduling.scheduledFor = this.calculateRetryTime();
  } else {
    this.status = 'failed';
  }

  return this.save();
};

scheduledNotificationSchema.methods.shouldRetry = function() {
  return this.retryConfig.currentRetries < this.retryConfig.maxRetries;
};

scheduledNotificationSchema.methods.calculateRetryTime = function() {
  const baseDelay = this.retryConfig.retryDelay;
  const exponentialDelay = baseDelay * Math.pow(2, this.retryConfig.currentRetries - 1);
  return new Date(Date.now() + exponentialDelay);
};

scheduledNotificationSchema.methods.calculateNextExecution = function() {
  if (!this.scheduling.recurring.enabled) {
    return null;
  }

  const now = new Date();
  const currentScheduled = this.scheduling.scheduledFor;
  let nextExecution = new Date(currentScheduled);

  switch (this.scheduling.recurring.pattern) {
    case 'daily':
      nextExecution.setDate(nextExecution.getDate() + this.scheduling.recurring.interval);
      break;

    case 'weekly':
      nextExecution.setDate(nextExecution.getDate() + (7 * this.scheduling.recurring.interval));
      break;

    case 'monthly':
      nextExecution.setMonth(nextExecution.getMonth() + this.scheduling.recurring.interval);
      break;

    case 'yearly':
      nextExecution.setFullYear(nextExecution.getFullYear() + this.scheduling.recurring.interval);
      break;

    case 'custom':
      // Handle custom patterns based on daysOfWeek
      if (this.scheduling.recurring.daysOfWeek.length > 0) {
        const currentDay = nextExecution.getDay();
        const targetDays = this.scheduling.recurring.daysOfWeek.sort();

        let nextDay = targetDays.find(day => day > currentDay);
        if (!nextDay) {
          nextDay = targetDays[0];
          nextExecution.setDate(nextExecution.getDate() + (7 - currentDay) + nextDay);
        } else {
          nextExecution.setDate(nextExecution.getDate() + (nextDay - currentDay));
        }
      }
      break;
  }

  // Check if we've exceeded end date or max occurrences
  if (this.scheduling.recurring.endDate && nextExecution > this.scheduling.recurring.endDate) {
    return null;
  }

  if (this.scheduling.recurring.maxOccurrences) {
    const executionCount = this.executions.filter(exec => exec.status === 'success').length;
    if (executionCount >= this.scheduling.recurring.maxOccurrences) {
      return null;
    }
  }

  return nextExecution;
};

scheduledNotificationSchema.methods.scheduleNextOccurrence = function() {
  const nextExecution = this.calculateNextExecution();

  if (nextExecution) {
    // Create new scheduled notification for next occurrence
    const nextNotification = new this.constructor({
      userId: this.userId,
      type: this.type,
      channel: this.channel,
      templateId: this.templateId,
      templateVariables: this.templateVariables,
      scheduling: {
        ...this.scheduling.toObject(),
        scheduledFor: nextExecution
      },
      priority: this.priority,
      tags: this.tags,
      createdBy: this.createdBy
    });

    return nextNotification.save();
  }

  return Promise.resolve(null);
};

// Static Methods
scheduledNotificationSchema.statics.findDueNotifications = function(limit = 100) {
  return this.find({
    'scheduling.scheduledFor': { $lte: new Date() },
    status: 'pending'
  })
  .sort({ 'scheduling.scheduledFor': 1, priority: -1 })
  .limit(limit);
};

scheduledNotificationSchema.statics.scheduleNotification = async function(config) {
  const notification = new this(config);
  return await notification.save();
};

scheduledNotificationSchema.statics.scheduleRecurringNotification = async function(config) {
  // Ensure recurring is enabled
  config.scheduling.recurring.enabled = true;

  const notification = new this(config);
  return await notification.save();
};

scheduledNotificationSchema.statics.cancelUserNotifications = async function(userId, type = null) {
  const query = { userId, status: 'pending' };
  if (type) {
    query.type = type;
  }

  return await this.updateMany(query, { status: 'cancelled' });
};

scheduledNotificationSchema.statics.getNotificationStats = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
  });

  return result;
};

// Virtuals
scheduledNotificationSchema.virtual('isDue').get(function() {
  return this.scheduling.scheduledFor <= new Date() && this.status === 'pending';
});

scheduledNotificationSchema.virtual('isRecurring').get(function() {
  return this.scheduling.recurring.enabled;
});

scheduledNotificationSchema.virtual('executionCount').get(function() {
  return this.executions.length;
});

scheduledNotificationSchema.virtual('successfulExecutions').get(function() {
  return this.executions.filter(exec => exec.status === 'success').length;
});

module.exports = mongoose.model('ScheduledNotification', scheduledNotificationSchema);