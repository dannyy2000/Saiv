const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const crypto = require('crypto');
const User = require('../models/User');
const contractService = require('../services/contractService');
const gaslessService = require('../services/gaslessService');
const notificationService = require('../services/notificationService');

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
        // If user exists but email not verified, resend verification
        if (!user.isEmailVerified) {
          const verificationToken = crypto.randomBytes(32).toString('hex');
          user.emailVerificationToken = verificationToken;
          user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          await user.save();

          // Send verification email
          await authController.sendVerificationEmail(user.email, verificationToken);

          return res.status(200).json({
            success: true,
            message: 'Please check your email to verify your account',
            data: {
              requiresVerification: true,
              email: user.email
            }
          });
        }

        // If verified, log in user
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
              profile: user.profile,
              isEmailVerified: user.isEmailVerified
            },
            token
          }
        });
      }

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create a temporary user identifier for email users
      const tempUserIdentifier = ethers.Wallet.createRandom().address;

      // Create smart contract wallets for the user (GASLESS - Backend pays gas)
      let wallets;
      if (gaslessService.isReady()) {
        console.log('✅ Creating wallets GASLESS - Backend pays all gas fees');
        wallets = await gaslessService.createEmailUserWalletsGasless(
          email.toLowerCase(),
          tempUserIdentifier
        );
      } else {
        console.warn('⚠️ Gasless service not ready, using fallback');
        const emailHash = ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase()));
        wallets = await contractService.createEmailUserWallets(emailHash, tempUserIdentifier);
      }

      user = new User({
        email: email.toLowerCase(),
        address: wallets.mainWallet, // Main wallet address for balance
        balance: '0',
        savingsAddress: wallets.savingsWallet,
        registrationType: 'email',
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: tokenExpiry,
        profile: {
          name: email.split('@')[0]
        }
      });

      await user.save();

      console.log(`Created email user ${email} -> main wallet: ${user.address}, savings wallet: ${user.savingsAddress}`);

      // Send verification email
      await authController.sendVerificationEmail(email.toLowerCase(), verificationToken);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          requiresVerification: true,
          email: user.email,
          message: 'A verification email has been sent to your email address.'
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

      // Create smart contract wallets for the wallet user (GASLESS - Backend pays gas)
      let wallets;
      if (gaslessService.isReady()) {
        console.log('✅ Creating wallets GASLESS - Backend pays all gas fees');
        wallets = await gaslessService.createUserWalletsGasless(eoaAddress);
      } else {
        console.warn('⚠️ Gasless service not ready, using fallback');
        wallets = await contractService.createUserWallets(eoaAddress);
      }

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
  },

  async sendVerificationEmail(email, token) {
    try {
      console.log(`🚀 Starting sendVerificationEmail for: ${email}`);
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

      // Log verification link for testing purposes
      console.log('='.repeat(80));
      console.log('📧 EMAIL VERIFICATION LINK');
      console.log('='.repeat(80));
      console.log(`📮 Email: ${email}`);
      console.log(`🔗 Verification Link: ${verificationUrl}`);
      console.log(`🎫 Token: ${token}`);
      console.log(`⏰ Expires: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}`);
      console.log('='.repeat(80));

      const emailContent = {
        to: email,
        subject: 'Verify Your Email - Saiv Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">Welcome to Saiv! 🎉</h1>
            </div>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h2 style="color: #1e293b; margin-top: 0;">Verify Your Email Address</h2>
              <p style="color: #475569; line-height: 1.6;">Thanks for signing up! To complete your registration and start your gasless Web3 savings journey, please verify your email address.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                ⚠️ This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 5px 0 0 0;">${verificationUrl}</p>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 14px;">
              <p>Best regards,<br>The Saiv Team</p>
            </div>
          </div>
        `
      };

      console.log(`📤 Attempting to send email via notificationService...`);
      const result = await notificationService.sendEmail(emailContent);
      console.log(`📧 Email send result:`, result);
      console.log(`✅ Verification email sent to ${email}`);
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  },

  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Verify the user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const jwtToken = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          address: user.address,
          registrationType: user.registrationType
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      console.log(`Email verified for user ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            address: user.address,
            savingsAddress: user.savingsAddress,
            balance: user.balance,
            registrationType: user.registrationType,
            profile: user.profile,
            isEmailVerified: user.isEmailVerified
          },
          token: jwtToken
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email verification failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();

      // Send verification email
      await authController.sendVerificationEmail(user.email, verificationToken);

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification email',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = authController;