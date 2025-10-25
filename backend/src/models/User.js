const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    sparse: true,
    unique: true,
    lowercase: true,
    trim: true,
    comment: 'Email for passwordless registration (optional)'
  },
  eoaAddress: {
    type: String,
    sparse: true,
    unique: true,
    comment: 'User EOA address (only for wallet connection registration)'
  },
  address: {
    type: String,
    required: true,
    unique: true,
    comment: 'Main system-generated address for balance holder and transactions'
  },
  balance: {
    type: String,
    default: '0',
    comment: 'User balance stored in main address'
  },
  savingsAddress: {
    type: String,
    required: true,
    unique: true,
    comment: 'System-generated address for user savings'
  },
  registrationType: {
    type: String,
    enum: ['email', 'wallet'],
    required: true,
    comment: 'How user registered: email passwordless or wallet connection'
  },
  profile: {
    name: {
      type: String,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    }
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  savings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Savings'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    comment: 'Whether email has been verified'
  },
  emailVerificationToken: {
    type: String,
    comment: 'Token for email verification'
  },
  emailVerificationExpires: {
    type: Date,
    comment: 'When email verification token expires'
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Note: email, eoaAddress, address, and savingsAddress already have unique indexes
// from the unique: true property, so we don't need to declare them again
userSchema.index({ registrationType: 1 });

module.exports = mongoose.model('User', userSchema);