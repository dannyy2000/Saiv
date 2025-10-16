const mongoose = require('mongoose');

/**
 * Savings Lock Schema
 * Tracks personal savings lock periods and their status
 */
const savingsLockSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  walletAddress: {
    type: String,
    required: true,
    lowercase: true
  },

  // Lock Details
  asset: {
    type: String,
    required: true,
    lowercase: true // address(0) for ETH, token address for ERC20
  },

  assetSymbol: {
    type: String,
    required: true,
    uppercase: true // ETH, USDC, etc.
  },

  principal: {
    type: String,
    required: true // Amount originally locked (as string to avoid precision issues)
  },

  // Lock Period
  lockPeriod: {
    type: Number,
    required: true // Lock duration in seconds
  },

  startTime: {
    type: Date,
    required: true
  },

  endTime: {
    type: Date,
    required: true
  },

  // Status Tracking
  status: {
    type: String,
    enum: ['active', 'expired', 'withdrawn', 'relocked', 'cancelled'],
    default: 'active'
  },

  // Aave Integration
  aaveSupplyTxHash: {
    type: String, // Transaction hash when supplied to Aave
    required: true
  },

  aaveWithdrawTxHash: {
    type: String // Transaction hash when withdrawn from Aave
  },

  // Yield Tracking
  currentBalance: {
    type: String, // Current aToken balance (updates periodically)
    default: '0'
  },

  yieldEarned: {
    type: String, // Calculated yield earned
    default: '0'
  },

  lastYieldUpdate: {
    type: Date,
    default: Date.now
  },

  // Auto-withdrawal Settings
  autoWithdraw: {
    enabled: {
      type: Boolean,
      default: false
    },
    destination: {
      type: String,
      enum: ['main_wallet', 'relock'],
      default: 'main_wallet'
    },
    newLockPeriod: {
      type: Number // If destination is 'relock', how long to lock for
    }
  },

  // Processing Status
  processed: {
    type: Boolean,
    default: false
  },

  processedAt: Date,

  errorMessage: String,

  retryCount: {
    type: Number,
    default: 0
  },

  // Metadata
  interestRate: {
    type: Number, // Annual interest rate at time of locking
    default: 0
  },

  notes: String,

  tags: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
savingsLockSchema.index({ userId: 1 });
savingsLockSchema.index({ walletAddress: 1 });
savingsLockSchema.index({ endTime: 1, status: 1 });
savingsLockSchema.index({ status: 1 });
savingsLockSchema.index({ processed: 1, status: 1 });

// Instance Methods
savingsLockSchema.methods.isExpired = function() {
  return new Date() > this.endTime && this.status === 'active';
};

savingsLockSchema.methods.canProcess = function() {
  return this.isExpired() && !this.processed && this.retryCount < 3;
};

savingsLockSchema.methods.markAsProcessed = function(txHash, newStatus = 'withdrawn') {
  this.processed = true;
  this.processedAt = new Date();
  this.status = newStatus;
  this.aaveWithdrawTxHash = txHash;
  this.errorMessage = null;

  return this.save();
};

savingsLockSchema.methods.markAsFailed = function(error) {
  this.retryCount++;
  this.errorMessage = error.message || error;

  if (this.retryCount >= 3) {
    this.status = 'cancelled';
  }

  return this.save();
};

savingsLockSchema.methods.updateYield = function(currentBalance, yieldEarned) {
  this.currentBalance = currentBalance.toString();
  this.yieldEarned = yieldEarned.toString();
  this.lastYieldUpdate = new Date();

  return this.save();
};

savingsLockSchema.methods.relock = function(newLockPeriod, txHash) {
  const now = new Date();

  // Mark current lock as relocked
  this.status = 'relocked';
  this.processed = true;
  this.processedAt = now;

  // Create new lock document
  const newLock = new this.constructor({
    userId: this.userId,
    walletAddress: this.walletAddress,
    asset: this.asset,
    assetSymbol: this.assetSymbol,
    principal: this.currentBalance, // Use current balance as new principal
    lockPeriod: newLockPeriod,
    startTime: now,
    endTime: new Date(now.getTime() + (newLockPeriod * 1000)),
    aaveSupplyTxHash: txHash,
    autoWithdraw: this.autoWithdraw,
    interestRate: this.interestRate
  });

  return Promise.all([this.save(), newLock.save()]);
};

// Static Methods
savingsLockSchema.statics.findExpiredLocks = function(limit = 50) {
  return this.find({
    status: 'active',
    endTime: { $lte: new Date() },
    processed: false,
    retryCount: { $lt: 3 }
  })
  .sort({ endTime: 1 })
  .limit(limit);
};

savingsLockSchema.statics.findUserActiveLocks = function(userId) {
  return this.find({
    userId,
    status: { $in: ['active', 'expired'] }
  })
  .sort({ endTime: 1 });
};

savingsLockSchema.statics.findUserLockHistory = function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

savingsLockSchema.statics.createLock = async function(lockData) {
  const lock = new this(lockData);
  return await lock.save();
};

savingsLockSchema.statics.getSavingsStats = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalPrincipal: {
          $sum: { $toDouble: '$principal' }
        },
        totalYield: {
          $sum: { $toDouble: '$yieldEarned' }
        }
      }
    }
  ]);

  const result = {
    active: { count: 0, totalPrincipal: 0, totalYield: 0 },
    expired: { count: 0, totalPrincipal: 0, totalYield: 0 },
    withdrawn: { count: 0, totalPrincipal: 0, totalYield: 0 },
    relocked: { count: 0, totalPrincipal: 0, totalYield: 0 },
    cancelled: { count: 0, totalPrincipal: 0, totalYield: 0 }
  };

  stats.forEach(stat => {
    if (result[stat._id]) {
      result[stat._id] = {
        count: stat.count,
        totalPrincipal: stat.totalPrincipal,
        totalYield: stat.totalYield
      };
    }
  });

  return result;
};

// Virtuals
savingsLockSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'active') return 0;

  const now = new Date();
  const remaining = this.endTime.getTime() - now.getTime();
  return Math.max(0, Math.floor(remaining / 1000)); // Return seconds
});

savingsLockSchema.virtual('isActive').get(function() {
  return this.status === 'active' && new Date() < this.endTime;
});

savingsLockSchema.virtual('totalReturn').get(function() {
  const principal = parseFloat(this.principal || '0');
  const yield_ = parseFloat(this.yieldEarned || '0');
  return principal + yield_;
});

savingsLockSchema.virtual('returnPercentage').get(function() {
  const principal = parseFloat(this.principal || '0');
  const yield_ = parseFloat(this.yieldEarned || '0');

  if (principal === 0) return 0;

  return (yield_ / principal) * 100;
});

module.exports = mongoose.model('SavingsLock', savingsLockSchema);