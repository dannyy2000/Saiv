const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    required: true,
    unique: true,
    comment: 'Group address that maps to Savings'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  paymentWindowDuration: {
    type: Number,
    required: true,
    comment: 'Payment window duration in seconds'
  },
  savings: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Savings',
    comment: 'Reference to the group savings account'
  },
  poolSettings: {
    minContribution: {
      type: Number,
      default: 0
    },
    maxMembers: {
      type: Number,
      default: 100
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    contributionFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'monthly',
      comment: 'How often members should contribute'
    }
  },
  totalPoolValue: {
    type: String,
    default: '0',
    comment: 'Total pool value in wei or token units'
  },
  paymentWindows: [{
    windowNumber: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    contributors: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      transactionHash: String,
      tokenAddress: {
        type: String,
        default: null,
        comment: 'Token address for ERC-20 contributions, null for ETH'
      }
    }],
    contributionsReceived: [{
      member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      amount: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      transactionHash: String,
      tokenAddress: {
        type: String,
        default: null,
        comment: 'Token address for ERC-20 contributions, null for ETH'
      }
    }],
    totalContributions: {
      type: String,
      default: '0',
      comment: 'Total contributions for this window'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  }],
  currentPaymentWindow: {
    type: Number,
    default: 1,
    comment: 'Current active payment window number'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lockPeriod: {
    type: Date,
    comment: 'When the group lock period expires and automatic withdrawal becomes available'
  },
  groupStatus: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    comment: 'Current status of the group pool'
  },
  automaticWithdrawal: {
    enabled: {
      type: Boolean,
      default: true,
      comment: 'Whether automatic withdrawal is enabled for this group'
    },
    eligibilityChecked: {
      type: Date,
      comment: 'Last time withdrawal eligibility was checked'
    },
    processedAt: {
      type: Date,
      comment: 'When automatic withdrawal was processed'
    },
    transactions: [{
      asset: {
        type: String,
        required: true,
        comment: 'Asset address (0x0 for ETH or token address)'
      },
      transactionHash: {
        type: String,
        required: true
      },
      totalAmount: {
        type: String,
        required: true,
        comment: 'Total amount withdrawn from Aave (principal + interest)'
      },
      principal: {
        type: String,
        required: true,
        comment: 'Original principal amount'
      },
      interest: {
        type: String,
        required: true,
        comment: 'Interest earned'
      },
      systemFee: {
        type: String,
        required: true,
        comment: 'System fee deducted (3% of interest)'
      },
      distributedAmount: {
        type: String,
        required: true,
        comment: 'Amount distributed to members'
      },
      memberPayouts: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        walletAddress: {
          type: String,
          required: true
        },
        contribution: {
          type: String,
          required: true,
          comment: 'Member total contribution for this asset'
        },
        payout: {
          type: String,
          required: true,
          comment: 'Amount paid out to this member'
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }],
      blockNumber: {
        type: Number
      },
      gasUsed: {
        type: String
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    errors: [{
      message: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      retryCount: {
        type: Number,
        default: 0
      }
    }]
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    comment: 'Additional group metadata including invite codes, settings, etc.'
  }
}, {
  timestamps: true
});

groupSchema.index({ owner: 1 });
// Note: address already has a unique index from unique: true property
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ savings: 1 });
groupSchema.index({ currentPaymentWindow: 1 });
groupSchema.index({ 'paymentWindows.isActive': 1 });
groupSchema.index({ 'paymentWindows.windowNumber': 1 });
groupSchema.index({ lockPeriod: 1 });
groupSchema.index({ groupStatus: 1 });
groupSchema.index({ 'automaticWithdrawal.enabled': 1 });
groupSchema.index({ 'automaticWithdrawal.processedAt': 1 });

module.exports = mongoose.model('Group', groupSchema);