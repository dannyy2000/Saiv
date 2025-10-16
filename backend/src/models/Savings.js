const mongoose = require('mongoose');

const savingsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    comment: 'Name/title of the savings goal'
  },
  description: {
    type: String,
    default: '',
    comment: 'Description of the savings purpose'
  },
  type: {
    type: String,
    enum: ['personal', 'group'],
    required: true,
    comment: 'Type of savings account'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    comment: 'User who owns this savings account'
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: function() {
      return this.type === 'group';
    },
    comment: 'Group this savings belongs to (required for group savings)'
  },
  targetAmount: {
    type: String,
    default: '0',
    comment: 'Target savings amount in wei or smallest token unit'
  },
  currentAmount: {
    type: String,
    default: '0',
    comment: 'Current savings balance in wei or smallest token unit'
  },
  currency: {
    type: String,
    default: 'ETH',
    comment: 'Currency type (ETH or token symbol)'
  },
  tokenAddress: {
    type: String,
    default: null,
    comment: 'Token contract address, null for ETH'
  },
  interest: {
    type: Number,
    default: 0,
    comment: 'Interest rate percentage (e.g., 5.5 for 5.5%)'
  },
  settings: {
    autoSave: {
      type: Boolean,
      default: false,
      comment: 'Automatic savings from wallet balance'
    },
    autoSaveAmount: {
      type: String,
      default: '0',
      comment: 'Amount to auto-save periodically'
    },
    autoSaveFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'monthly'
    },
    minContribution: {
      type: String,
      default: '0',
      comment: 'Minimum contribution amount'
    },
    allowWithdrawal: {
      type: Boolean,
      default: true,
      comment: 'Allow withdrawals before target reached'
    },
    lockUntilTarget: {
      type: Boolean,
      default: false,
      comment: 'Lock funds until target amount is reached'
    },
    lockUntilDate: {
      type: Date,
      default: null,
      comment: 'Lock funds until specific date'
    }
  },
  contributors: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    totalContributed: {
      type: String,
      default: '0',
      comment: 'Total amount contributed by this user'
    },
    lastContribution: {
      type: Date,
      default: null
    },
    role: {
      type: String,
      enum: ['owner', 'contributor'],
      default: 'contributor'
    }
  }],
  transactions: [{
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'auto_save', 'interest', 'penalty'],
      required: true
    },
    amount: {
      type: String,
      required: true,
      comment: 'Transaction amount in wei or smallest token unit'
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      comment: 'User who made the transaction'
    },
    description: {
      type: String,
      default: ''
    },
    balanceAfter: {
      type: String,
      required: true,
      comment: 'Savings balance after this transaction'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reference: {
      type: String,
      comment: 'Reference ID for transaction tracking'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      comment: 'Additional transaction metadata'
    }
  }],
  milestones: [{
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    amount: {
      type: String,
      required: true
    },
    achieved: {
      type: Boolean,
      default: false
    },
    achievedAt: {
      type: Date,
      default: null
    },
    reward: {
      type: String,
      default: '',
      comment: 'Reward or bonus for reaching milestone'
    }
  }],
  aavePosition: {
    isSupplied: {
      type: Boolean,
      default: false,
      comment: 'Whether funds are currently supplied to Aave'
    },
    aTokenAddress: {
      type: String,
      default: null,
      comment: 'Aave aToken address (receipt token)'
    },
    suppliedAmount: {
      type: String,
      default: '0',
      comment: 'Amount supplied to Aave in wei'
    },
    aTokenBalance: {
      type: String,
      default: '0',
      comment: 'Current aToken balance (increases with yield)'
    },
    lastSupplyTimestamp: {
      type: Date,
      default: null
    },
    lastWithdrawTimestamp: {
      type: Date,
      default: null
    },
    totalYieldEarned: {
      type: String,
      default: '0',
      comment: 'Total yield earned from Aave'
    },
    currentAPY: {
      type: Number,
      default: 0,
      comment: 'Current Aave supply APY percentage'
    },
    supplyTransactions: [{
      amount: String,
      timestamp: Date,
      transactionHash: String,
      type: {
        type: String,
        enum: ['supply', 'withdraw'],
        required: true
      }
    }]
  },
  stats: {
    totalDeposited: {
      type: String,
      default: '0'
    },
    totalWithdrawn: {
      type: String,
      default: '0'
    },
    totalInterestEarned: {
      type: String,
      default: '0'
    },
    transactionCount: {
      type: Number,
      default: 0
    },
    averageMonthlyContribution: {
      type: String,
      default: '0'
    },
    daysActive: {
      type: Number,
      default: 0
    },
    lastInterestCalculation: {
      type: Date,
      default: Date.now
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active'
  },
  completedAt: {
    type: Date,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false,
    comment: 'Whether this savings goal is visible to others'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
savingsSchema.index({ owner: 1 });
savingsSchema.index({ group: 1 });
savingsSchema.index({ type: 1 });
savingsSchema.index({ status: 1 });
savingsSchema.index({ 'contributors.user': 1 });
savingsSchema.index({ createdAt: -1 });
savingsSchema.index({ targetAmount: 1, currentAmount: 1 });

// Virtual for progress percentage
savingsSchema.virtual('progressPercentage').get(function() {
  const target = parseFloat(this.targetAmount) || 1;
  const current = parseFloat(this.currentAmount) || 0;
  return Math.min((current / target) * 100, 100);
});

// Virtual for remaining amount
savingsSchema.virtual('remainingAmount').get(function() {
  const target = parseFloat(this.targetAmount) || 0;
  const current = parseFloat(this.currentAmount) || 0;
  return Math.max(target - current, 0).toString();
});

// Virtual for checking if locked
savingsSchema.virtual('isLocked').get(function() {
  if (this.settings.lockUntilTarget && parseFloat(this.currentAmount) < parseFloat(this.targetAmount)) {
    return true;
  }
  if (this.settings.lockUntilDate && new Date() < this.settings.lockUntilDate) {
    return true;
  }
  return false;
});

// Method to add transaction
savingsSchema.methods.addTransaction = function(transactionData) {
  const { type, amount, fromUser, description, metadata } = transactionData;

  // Calculate new balance
  const currentBalance = parseFloat(this.currentAmount) || 0;
  const transactionAmount = parseFloat(amount);

  let newBalance;
  if (type === 'deposit' || type === 'auto_save' || type === 'interest') {
    newBalance = currentBalance + transactionAmount;
  } else if (type === 'withdrawal' || type === 'penalty') {
    newBalance = Math.max(currentBalance - transactionAmount, 0);
  } else {
    newBalance = currentBalance;
  }

  // Add transaction record
  this.transactions.push({
    type,
    amount: amount.toString(),
    fromUser: fromUser || this.owner,
    description: description || '',
    balanceAfter: newBalance.toString(),
    timestamp: new Date(),
    reference: `${this.type}_${this._id}_${Date.now()}`,
    metadata: metadata || {}
  });

  // Update current amount
  this.currentAmount = newBalance.toString();

  // Update stats
  this.stats.transactionCount += 1;
  if (type === 'deposit' || type === 'auto_save' || type === 'interest') {
    const totalDeposited = parseFloat(this.stats.totalDeposited) + transactionAmount;
    this.stats.totalDeposited = totalDeposited.toString();
  } else if (type === 'withdrawal') {
    const totalWithdrawn = parseFloat(this.stats.totalWithdrawn) + transactionAmount;
    this.stats.totalWithdrawn = totalWithdrawn.toString();
  }

  // Check milestones
  this.checkMilestones();

  // Check if target reached
  if (parseFloat(this.currentAmount) >= parseFloat(this.targetAmount) && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  return this;
};

// Method to check and update milestones
savingsSchema.methods.checkMilestones = function() {
  const progressPercentage = this.progressPercentage;

  this.milestones.forEach(milestone => {
    if (!milestone.achieved && progressPercentage >= milestone.percentage) {
      milestone.achieved = true;
      milestone.achievedAt = new Date();
    }
  });
};

// Method to update contributor stats
savingsSchema.methods.updateContributor = function(userId, contributionAmount) {
  let contributor = this.contributors.find(c => c.user.toString() === userId.toString());

  if (!contributor) {
    contributor = {
      user: userId,
      totalContributed: '0',
      lastContribution: null,
      role: userId.toString() === this.owner.toString() ? 'owner' : 'contributor'
    };
    this.contributors.push(contributor);
  }

  const currentTotal = parseFloat(contributor.totalContributed) || 0;
  const newTotal = currentTotal + parseFloat(contributionAmount);
  contributor.totalContributed = newTotal.toString();
  contributor.lastContribution = new Date();

  return this;
};

// Method to calculate current interest
savingsSchema.methods.calculateCurrentInterest = function() {
  const now = new Date();
  const timeDiff = now - this.stats.lastInterestCalculation;
  const daysElapsed = timeDiff / (1000 * 60 * 60 * 24);

  const currentBalance = parseFloat(this.currentAmount);
  const dailyInterestRate = this.interest / 365 / 100;
  const interestEarned = currentBalance * dailyInterestRate * daysElapsed;

  return interestEarned.toString();
};

// Method to check if savings can be withdrawn
savingsSchema.methods.canWithdraw = function(amount = null) {
  if (!this.settings.allowWithdrawal) return false;
  if (this.isLocked) return false;

  if (amount) {
    const currentBalance = parseFloat(this.currentAmount);
    if (parseFloat(amount) > currentBalance) return false;
  }

  return true;
};

// Pre-save middleware to update stats
savingsSchema.pre('save', function(next) {
  if (this.isModified('transactions')) {
    // Update days active
    const daysDiff = Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
    this.stats.daysActive = Math.max(daysDiff, 0);

    // Calculate average monthly contribution
    if (this.stats.daysActive > 0) {
      const totalDeposited = parseFloat(this.stats.totalDeposited) || 0;
      const monthsActive = Math.max(this.stats.daysActive / 30, 1);
      this.stats.averageMonthlyContribution = (totalDeposited / monthsActive).toString();
    }
  }

  next();
});

module.exports = mongoose.model('Savings', savingsSchema);