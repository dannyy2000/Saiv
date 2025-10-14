const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');
const contractService = require('../services/contractService');

const authController = {
  async registerWithEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
          {
            userId: user._id,
            email: user.email,
            address: user.address,
            registrationType: user.registrationType
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          success: true,
          message: 'User logged in successfully',
          data: {
            user: {
              id: user._id,
              email: user.email,
              eoaAddress: user.eoaAddress,
              address: user.address,
              savingsAddress: user.savingsAddress,
              balance: user.balance,
              registrationType: user.registrationType,
              profile: user.profile
            },
            token
          }
        });
      }

      // Create a temporary user identifier for email users
      const tempUserIdentifier = ethers.Wallet.createRandom().address;

      // Create smart contract wallets for the user
      const emailHash = ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase()));
      const wallets = await contractService.createEmailUserWallets(emailHash, tempUserIdentifier);

      user = new User({
        email: email.toLowerCase(),
        address: wallets.mainWallet, // Main wallet address for balance
        balance: '0',
        savingsAddress: wallets.savingsWallet,
        registrationType: 'email',
        profile: {
          name: email.split('@')[0]
        }
      });

      await user.save();

      console.log(`Created email user ${email} -> main wallet: ${user.address}, savings wallet: ${user.savingsAddress}`);

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          address: user.address,
          registrationType: user.registrationType
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully with email',
        data: {
          user: {
            id: user._id,
            email: user.email,
            address: user.address,
            savingsAddress: user.savingsAddress,
            balance: user.balance,
            registrationType: user.registrationType,
            profile: user.profile
          },
          token
        }
      });

    } catch (error) {
      console.error('Email registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async registerWithWallet(req, res) {
    try {
      const { eoaAddress } = req.body;

      if (!eoaAddress) {
        return res.status(400).json({
          success: false,
          message: 'EOA address is required'
        });
      }

      if (!contractService.validateAddress(eoaAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid EOA address format'
        });
      }

      // Check if user already exists
      let user = await User.findOne({ eoaAddress: eoaAddress });
      if (user) {
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
          {
            userId: user._id,
            eoaAddress: user.eoaAddress,
            address: user.address,
            registrationType: user.registrationType
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        return res.status(200).json({
          success: true,
          message: 'User logged in successfully',
          data: {
            user: {
              id: user._id,
              email: user.email,
              eoaAddress: user.eoaAddress,
              address: user.address,
              savingsAddress: user.savingsAddress,
              balance: user.balance,
              registrationType: user.registrationType,
              profile: user.profile
            },
            token
          }
        });
      }

      // Create smart contract wallets for the wallet user
      const wallets = await contractService.createUserWallets(eoaAddress);

      user = new User({
        eoaAddress: eoaAddress,
        address: wallets.mainWallet, // Main wallet address for balance
        balance: '0',
        savingsAddress: wallets.savingsWallet,
        registrationType: 'wallet',
        profile: {
          name: `User_${eoaAddress.slice(-6)}`
        }
      });

      await user.save();

      console.log(`Created wallet user ${user.eoaAddress} -> main wallet: ${user.address}, savings wallet: ${user.savingsAddress}`);

      const token = jwt.sign(
        {
          userId: user._id,
          eoaAddress: user.eoaAddress,
          address: user.address,
          registrationType: user.registrationType
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully with wallet',
        data: {
          user: {
            id: user._id,
            email: user.email,
            eoaAddress: user.eoaAddress,
            address: user.address,
            savingsAddress: user.savingsAddress,
            balance: user.balance,
            registrationType: user.registrationType,
            profile: user.profile
          },
          token
        }
      });

    } catch (error) {
      console.error('Wallet registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId)
        .populate('groups')
        .populate('savings');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            eoaAddress: user.eoaAddress,
            address: user.address,
            savingsAddress: user.savingsAddress,
            balance: user.balance,
            registrationType: user.registrationType,
            profile: user.profile,
            groups: user.groups,
            savings: user.savings,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async updateBalance(req, res) {
    try {
      const userId = req.user.userId;
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount is required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update user balance in database
      user.balance = amount;
      await user.save();

      // Note: Balance is managed by the wallet smart contract directly
      // ETH and tokens are held in the actual wallet contract
      console.log(`Updated database balance for ${user.address}: ${amount}`);

      res.status(200).json({
        success: true,
        message: 'Balance updated successfully',
        data: {
          balance: user.balance,
          address: user.address
        }
      });

    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update balance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = authController;