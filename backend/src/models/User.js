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
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 });
userSchema.index({ eoaAddress: 1 });
userSchema.index({ address: 1 });
userSchema.index({ savingsAddress: 1 });
userSchema.index({ registrationType: 1 });

module.exports = mongoose.model('User', userSchema);