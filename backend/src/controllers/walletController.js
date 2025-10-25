const { ethers } = require('ethers');
const contractService = require('../services/contractService');
const currencyService = require('../services/currencyService');
const User = require('../models/User');

const walletController = {
  async getWalletBalance(req, res) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get ETH balance from main wallet
      const ethBalance = await contractService.getWalletBalance(user.address);

      // Get ETH balance from savings wallet
      const savingsEthBalance = await contractService.getWalletBalance(user.savingsAddress);

      // Basic wallet data
      const walletData = {
        mainWallet: {
          address: user.address,
          balance: ethBalance.ether,
          ethBalance: ethBalance
        },
        savingsWallet: {
          address: user.savingsAddress,
          balance: savingsEthBalance.ether,
          ethBalance: savingsEthBalance
        },
        databaseBalance: user.balance
      };

      // Enhance with USDC conversions
      const enhancedWalletData = currencyService.enhanceWalletBalance(walletData);

      res.status(200).json({
        success: true,
        data: enhancedWalletData
      });

    } catch (error) {
      console.error('Get wallet balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get wallet balance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getTokenBalance(req, res) {
    try {
      const userId = req.user.userId;
      const { tokenAddress, walletType = 'main' } = req.query;

      if (!tokenAddress) {
        return res.status(400).json({
          success: false,
          message: 'Token address is required'
        });
      }

      if (!contractService.validateAddress(tokenAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token address'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const walletAddress = walletType === 'savings' ? user.savingsAddress : user.address;
      const tokenBalance = await contractService.getWalletTokenBalance(walletAddress, tokenAddress);

      res.status(200).json({
        success: true,
        data: {
          walletAddress: walletAddress,
          walletType: walletType,
          tokenAddress: tokenAddress,
          balance: tokenBalance
        }
      });

    } catch (error) {
      console.error('Get token balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get token balance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async withdrawEth(req, res) {
    try {
      const userId = req.user.userId;
      const { toAddress, amount, walletType = 'main' } = req.body;

      if (!toAddress || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Recipient address and amount are required'
        });
      }

      if (!contractService.validateAddress(toAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient address'
        });
      }

      if (parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const walletAddress = walletType === 'savings' ? user.savingsAddress : user.address;
      const amountWei = ethers.parseEther(amount.toString());

      // Call wallet contract to withdraw ETH
      const result = await contractService.callWalletFunction(
        walletAddress,
        'withdrawEth',
        [toAddress, amountWei]
      );

      res.status(200).json({
        success: true,
        message: 'ETH withdrawal successful',
        data: {
          transactionHash: result.transactionHash,
          fromWallet: walletAddress,
          toAddress: toAddress,
          amount: amount,
          walletType: walletType
        }
      });

    } catch (error) {
      console.error('Withdraw ETH error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to withdraw ETH',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async withdrawToken(req, res) {
    try {
      const userId = req.user.userId;
      const { tokenAddress, toAddress, amount, walletType = 'main' } = req.body;

      if (!tokenAddress || !toAddress || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Token address, recipient address, and amount are required'
        });
      }

      if (!contractService.validateAddress(tokenAddress) || !contractService.validateAddress(toAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token or recipient address'
        });
      }

      if (parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const walletAddress = walletType === 'savings' ? user.savingsAddress : user.address;

      // Call wallet contract to withdraw token
      const result = await contractService.callWalletFunction(
        walletAddress,
        'withdrawToken',
        [tokenAddress, toAddress, amount]
      );

      res.status(200).json({
        success: true,
        message: 'Token withdrawal successful',
        data: {
          transactionHash: result.transactionHash,
          fromWallet: walletAddress,
          toAddress: toAddress,
          tokenAddress: tokenAddress,
          amount: amount,
          walletType: walletType
        }
      });

    } catch (error) {
      console.error('Withdraw token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to withdraw token',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async sendEth(req, res) {
    try {
      const userId = req.user.userId;
      const { toAddress, amount, walletType = 'main' } = req.body;

      if (!toAddress || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Recipient address and amount are required'
        });
      }

      if (!contractService.validateAddress(toAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient address'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const walletAddress = walletType === 'savings' ? user.savingsAddress : user.address;
      const amountWei = ethers.parseEther(amount.toString());

      // Call wallet contract to send ETH
      const result = await contractService.callWalletFunction(
        walletAddress,
        'sendEth',
        [toAddress, amountWei]
      );

      res.status(200).json({
        success: true,
        message: 'ETH sent successfully',
        data: {
          transactionHash: result.transactionHash,
          fromWallet: walletAddress,
          toAddress: toAddress,
          amount: amount,
          walletType: walletType
        }
      });

    } catch (error) {
      console.error('Send ETH error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send ETH',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async addSupportedToken(req, res) {
    try {
      const userId = req.user.userId;
      const { tokenAddress, walletType = 'both' } = req.body;

      if (!tokenAddress) {
        return res.status(400).json({
          success: false,
          message: 'Token address is required'
        });
      }

      if (!contractService.validateAddress(tokenAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token address'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const results = [];

      // Add token to main wallet
      if (walletType === 'main' || walletType === 'both') {
        try {
          const mainResult = await contractService.addSupportedToken(user.address, tokenAddress);
          results.push({
            wallet: 'main',
            address: user.address,
            result: mainResult
          });
        } catch (error) {
          results.push({
            wallet: 'main',
            address: user.address,
            error: error.message
          });
        }
      }

      // Add token to savings wallet
      if (walletType === 'savings' || walletType === 'both') {
        try {
          const savingsResult = await contractService.addSupportedToken(user.savingsAddress, tokenAddress);
          results.push({
            wallet: 'savings',
            address: user.savingsAddress,
            result: savingsResult
          });
        } catch (error) {
          results.push({
            wallet: 'savings',
            address: user.savingsAddress,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Token support added',
        data: {
          tokenAddress: tokenAddress,
          results: results
        }
      });

    } catch (error) {
      console.error('Add supported token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add token support',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getSupportedTokens(req, res) {
    try {
      const userId = req.user.userId;
      const { walletType = 'main' } = req.query;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const walletAddress = walletType === 'savings' ? user.savingsAddress : user.address;

      // Get supported tokens from wallet contract
      const result = await contractService.callWalletFunction(
        walletAddress,
        'getSupportedTokens'
      );

      res.status(200).json({
        success: true,
        data: {
          walletAddress: walletAddress,
          walletType: walletType,
          supportedTokens: result.result
        }
      });

    } catch (error) {
      console.error('Get supported tokens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get supported tokens',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async transferBetweenWallets(req, res) {
    try {
      const userId = req.user.userId;
      const { tokenAddress, amount, fromWallet = 'main', toWallet = 'savings' } = req.body;

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

      const fromWalletAddress = fromWallet === 'savings' ? user.savingsAddress : user.address;
      const toWalletAddress = toWallet === 'savings' ? user.savingsAddress : user.address;

      if (fromWalletAddress === toWalletAddress) {
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer to the same wallet'
        });
      }

      let result;

      if (tokenAddress) {
        // Transfer ERC-20 token
        if (!contractService.validateAddress(tokenAddress)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid token address'
          });
        }

        result = await contractService.callWalletFunction(
          fromWalletAddress,
          'transferToWallet',
          [tokenAddress, toWalletAddress, amount]
        );
      } else {
        // Transfer ETH
        const amountWei = ethers.parseEther(amount.toString());
        result = await contractService.callWalletFunction(
          fromWalletAddress,
          'sendEth',
          [toWalletAddress, amountWei]
        );
      }

      res.status(200).json({
        success: true,
        message: `${tokenAddress ? 'Token' : 'ETH'} transferred successfully`,
        data: {
          transactionHash: result.transactionHash,
          fromWallet: fromWalletAddress,
          toWallet: toWalletAddress,
          amount: amount,
          tokenAddress: tokenAddress || null
        }
      });

    } catch (error) {
      console.error('Transfer between wallets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to transfer between wallets',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = walletController;