const mongoose = require('mongoose');

/**
 * User Notification Preferences Schema
 * Stores user-specific notification settings and preferences
 */
const notificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Contact Information
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  phoneNumber: {
    type: String,
    trim: true
  },

  deviceTokens: [{
    token: String,
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true
    },
    active: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],

  // Notification Channel Preferences
  channels: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      types: {
        welcome: { type: Boolean, default: true },
        transactionConfirmation: { type: Boolean, default: true },
        groupInvitation: { type: Boolean, default: true },
        groupRoundCompletion: { type: Boolean, default: true },
        milestone: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        system: { type: Boolean, default: true }
      }
    },

    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      types: {
        welcome: { type: Boolean, default: false },
        transactionAlert: { type: Boolean, default: true },
        securityAlert: { type: Boolean, default: true },
        paymentReminder: { type: Boolean, default: true },
        milestone: { type: Boolean, default: false },
        lowBalance: { type: Boolean, default: true },
        autoWithdrawal: { type: Boolean, default: true }
      }
    },

    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      types: {
        welcome: { type: Boolean, default: true },
        transaction: { type: Boolean, default: true },
        paymentReminder: { type: Boolean, default: true },
        milestone: { type: Boolean, default: true },
        groupActivity: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        system: { type: Boolean, default: true }
      }
    }
  },

  // Timing Preferences
  timing: {
    timezone: {
      type: String,
      default: 'UTC'
    },

    quietHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      start: {
        type: String,
        default: '22:00'
      },
      end: {
        type: String,
        default: '08:00'
      }
    },

    frequency: {
      digest: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'weekly'
      },
      reminders: {
        type: String,
        enum: ['immediate', 'hourly', 'daily'],
        default: 'daily'
      }
    }
  },

  // Language and Localization
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko']
  },

  // Advanced Settings
  advanced: {
    retryFailedNotifications: {
      type: Boolean,
      default: true
    },

    batchNotifications: {
      type: Boolean,
      default: true
    },

    priorityFiltering: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationPreferenceSchema.index({ userId: 1 });
notificationPreferenceSchema.index({ email: 1 });
notificationPreferenceSchema.index({ 'deviceTokens.token': 1 });

// Instance Methods
notificationPreferenceSchema.methods.shouldReceiveNotification = function(channel, type) {
  if (!this.channels[channel] || !this.channels[channel].enabled) {
    return false;
  }

  if (!this.channels[channel].types[type]) {
    return false;
  }

  // Check quiet hours for non-urgent notifications
  const urgentTypes = ['securityAlert', 'security', 'system'];
  if (!urgentTypes.includes(type) && this.timing.quietHours.enabled) {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' +
                       now.getMinutes().toString().padStart(2, '0');

    const startTime = this.timing.quietHours.start;
    const endTime = this.timing.quietHours.end;

    if (startTime > endTime) {
      // Quiet hours span midnight
      if (currentTime >= startTime || currentTime <= endTime) {
        return false;
      }
    } else {
      // Quiet hours within same day
      if (currentTime >= startTime && currentTime <= endTime) {
        return false;
      }
    }
  }

  return true;
};

notificationPreferenceSchema.methods.getActiveDeviceTokens = function(platform = null) {
  let tokens = this.deviceTokens.filter(device => device.active);

  if (platform) {
    tokens = tokens.filter(device => device.platform === platform);
  }

  return tokens.map(device => device.token);
};

notificationPreferenceSchema.methods.addDeviceToken = function(token, platform) {
  // Remove existing token if it exists
  this.deviceTokens = this.deviceTokens.filter(device => device.token !== token);

  // Add new token
  this.deviceTokens.push({
    token,
    platform,
    active: true,
    lastUsed: new Date()
  });

  return this.save();
};

notificationPreferenceSchema.methods.removeDeviceToken = function(token) {
  this.deviceTokens = this.deviceTokens.filter(device => device.token !== token);
  return this.save();
};

notificationPreferenceSchema.methods.updateDeviceTokenActivity = function(token, active = true) {
  const device = this.deviceTokens.find(device => device.token === token);

  if (device) {
    device.active = active;
    device.lastUsed = new Date();
  }

  return this.save();
};

// Static Methods
notificationPreferenceSchema.statics.createDefaultPreferences = async function(userId, email, phoneNumber = null) {
  const preferences = new this({
    userId,
    email,
    phoneNumber,
    // Default settings are defined in schema
  });

  return await preferences.save();
};

notificationPreferenceSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId }).populate('userId');
};

notificationPreferenceSchema.statics.updatePreferences = async function(userId, updates) {
  return await this.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: false }
  );
};

// Virtual for contact summary
notificationPreferenceSchema.virtual('contactSummary').get(function() {
  return {
    email: this.email,
    phoneNumber: this.phoneNumber,
    hasActiveDevices: this.deviceTokens.some(device => device.active),
    activeDeviceCount: this.deviceTokens.filter(device => device.active).length
  };
});

// Virtual for enabled channels
notificationPreferenceSchema.virtual('enabledChannels').get(function() {
  const enabled = [];

  if (this.channels.email.enabled) enabled.push('email');
  if (this.channels.sms.enabled) enabled.push('sms');
  if (this.channels.push.enabled) enabled.push('push');

  return enabled;
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);