const Savings = require('../models/Savings');
const User = require('../models/User');
const Group = require('../models/Group');
const { ethers } = require('ethers');

const savingsController = {
  // Create personal savings
  async createPersonalSavings(req, res) {
    try {
      const userId = req.user.userId;
      const {
        name,
        description,
        targetAmount,
        currency = 'ETH',
        tokenAddress = null,
        interest = 0,
        settings = {},
        milestones = []
      } = req.body;

      if (!name || !targetAmount) {
        return res.status(400).json({
          success: false,
          message: 'Name and target amount are required'
        });
      }

      if (parseFloat(targetAmount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Target amount must be greater than 0'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const savings = new Savings({
        name: name.trim(),
        description: description || '',
        type: 'personal',
        owner: userId,
        targetAmount: targetAmount.toString(),
        currency: currency,
        tokenAddress: tokenAddress,
        interest: interest,
        settings: {
          autoSave: settings.autoSave || false,
          autoSaveAmount: settings.autoSaveAmount || '0',
          autoSaveFrequency: settings.autoSaveFrequency || 'monthly',
          minContribution: settings.minContribution || '0',
          allowWithdrawal: settings.allowWithdrawal !== undefined ? settings.allowWithdrawal : true,
          lockUntilTarget: settings.lockUntilTarget || false,
          lockUntilDate: settings.lockUntilDate ? new Date(settings.lockUntilDate) : null
        },
        milestones: milestones.map(m => ({
          percentage: m.percentage,
          amount: (parseFloat(targetAmount) * m.percentage / 100).toString(),
          reward: m.reward || ''
        })),
        contributors: [{
          user: userId,
          role: 'owner'
        }]
      });

      await savings.save();

      // Update user's savings reference
      if (!user.savings) {
        user.savings = savings._id;
        await user.save();
      }

      await savings.populate('owner', 'email address profile');

      res.status(201).json({
        success: true,
        message: 'Personal savings created successfully',
        data: {
          savings: {
            id: savings._id,
            name: savings.name,
            description: savings.description,
            type: savings.type,
            targetAmount: savings.targetAmount,
            currentAmount: savings.currentAmount,
            currency: savings.currency,
            tokenAddress: savings.tokenAddress,
            progressPercentage: savings.progressPercentage,
            remainingAmount: savings.remainingAmount,
            settings: savings.settings,
            milestones: savings.milestones,
            status: savings.status,
            isLocked: savings.isLocked,
            createdAt: savings.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Create personal savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create personal savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Create group savings
  async createGroupSavings(req, res) {
    try {
      const userId = req.user.userId;
      const {
        groupId,
        name,
        description,
        targetAmount,
        currency = 'ETH',
        tokenAddress = null,
        interest = 0,
        settings = {},
        milestones = []
      } = req.body;

      if (!groupId || !name || !targetAmount) {
        return res.status(400).json({
          success: false,
          message: 'Group ID, name and target amount are required'
        });
      }

      if (parseFloat(targetAmount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Target amount must be greater than 0'
        });
      }

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // Check if user is group owner or admin
      const isOwnerOrAdmin = group.owner.toString() === userId ||
        group.members.find(m => m.user.toString() === userId && m.role === 'admin');

      if (!isOwnerOrAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only group owner or admin can create group savings'
        });
      }

      // Check if group already has a savings account
      if (group.savings) {
        return res.status(400).json({
          success: false,
          message: 'Group already has a savings account'
        });
      }

      const savings = new Savings({
        name: name.trim(),
        description: description || '',
        type: 'group',
        owner: userId,
        group: groupId,
        targetAmount: targetAmount.toString(),
        currency: currency,
        tokenAddress: tokenAddress,
        interest: interest,
        settings: {
          autoSave: settings.autoSave || false,
          autoSaveAmount: settings.autoSaveAmount || '0',
          autoSaveFrequency: settings.autoSaveFrequency || 'monthly',
          minContribution: settings.minContribution || '0',
          allowWithdrawal: settings.allowWithdrawal !== undefined ? settings.allowWithdrawal : true,
          lockUntilTarget: settings.lockUntilTarget || false,
          lockUntilDate: settings.lockUntilDate ? new Date(settings.lockUntilDate) : null
        },
        milestones: milestones.map(m => ({
          percentage: m.percentage,
          amount: (parseFloat(targetAmount) * m.percentage / 100).toString(),
          reward: m.reward || ''
        })),
        contributors: [{
          user: userId,
          role: 'owner'
        }]
      });

      await savings.save();

      // Update group's savings reference
      group.savings = savings._id;
      await group.save();

      await savings.populate(['owner', 'group'], 'email address profile name');

      res.status(201).json({
        success: true,
        message: 'Group savings created successfully',
        data: {
          savings: {
            id: savings._id,
            name: savings.name,
            description: savings.description,
            type: savings.type,
            targetAmount: savings.targetAmount,
            currentAmount: savings.currentAmount,
            currency: savings.currency,
            tokenAddress: savings.tokenAddress,
            progressPercentage: savings.progressPercentage,
            remainingAmount: savings.remainingAmount,
            settings: savings.settings,
            milestones: savings.milestones,
            status: savings.status,
            isLocked: savings.isLocked,
            group: savings.group,
            createdAt: savings.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Create group savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create group savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get user's savings accounts
  async getUserSavings(req, res) {
    try {
      const userId = req.user.userId;
      const { type } = req.query; // 'personal', 'group', or 'all'

      let query = {
        $or: [
          { owner: userId },
          { 'contributors.user': userId }
        ]
      };

      if (type && type !== 'all') {
        query.type = type;
      }

      const savings = await Savings.find(query)
        .populate('owner', 'email address profile')
        .populate('group', 'name description')
        .populate('contributors.user', 'email address profile')
        .sort({ createdAt: -1 });

      const formattedSavings = savings.map(saving => ({
        id: saving._id,
        name: saving.name,
        description: saving.description,
        type: saving.type,
        targetAmount: saving.targetAmount,
        currentAmount: saving.currentAmount,
        currency: saving.currency,
        tokenAddress: saving.tokenAddress,
        progressPercentage: saving.progressPercentage,
        remainingAmount: saving.remainingAmount,
        status: saving.status,
        isLocked: saving.isLocked,
        group: saving.group,
        owner: saving.owner,
        contributors: saving.contributors,
        stats: saving.stats,
        createdAt: saving.createdAt,
        completedAt: saving.completedAt
      }));

      res.status(200).json({
        success: true,
        data: {
          savings: formattedSavings,
          totalSavings: formattedSavings.length
        }
      });

    } catch (error) {
      console.error('Get user savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get savings by ID
  async getSavingsById(req, res) {
    try {
      const { savingsId } = req.params;
      const userId = req.user.userId;

      const savings = await Savings.findById(savingsId)
        .populate('owner', 'email address profile')
        .populate('group', 'name description members')
        .populate('contributors.user', 'email address profile')
        .populate('transactions.fromUser', 'email address profile');

      if (!savings) {
        return res.status(404).json({
          success: false,
          message: 'Savings not found'
        });
      }

      // Check access permissions
      const hasAccess = savings.owner.toString() === userId ||
        savings.contributors.some(c => c.user._id.toString() === userId) ||
        (savings.group && savings.group.members &&
         savings.group.members.some(m => m.user.toString() === userId));

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          savings: {
            id: savings._id,
            name: savings.name,
            description: savings.description,
            type: savings.type,
            targetAmount: savings.targetAmount,
            currentAmount: savings.currentAmount,
            currency: savings.currency,
            tokenAddress: savings.tokenAddress,
            progressPercentage: savings.progressPercentage,
            remainingAmount: savings.remainingAmount,
            settings: savings.settings,
            milestones: savings.milestones,
            contributors: savings.contributors,
            transactions: savings.transactions.slice(-50), // Last 50 transactions
            stats: savings.stats,
            status: savings.status,
            isLocked: savings.isLocked,
            group: savings.group,
            owner: savings.owner,
            createdAt: savings.createdAt,
            completedAt: savings.completedAt
          }
        }
      });

    } catch (error) {
      console.error('Get savings by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Deposit to savings
  async deposit(req, res) {
    try {
      const { savingsId } = req.params;
      const { amount, description } = req.body;
      const userId = req.user.userId;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid deposit amount is required'
        });
      }

      const savings = await Savings.findById(savingsId);
      if (!savings) {
        return res.status(404).json({
          success: false,
          message: 'Savings not found'
        });
      }

      // Check if user can contribute
      const canContribute = savings.owner.toString() === userId ||
        savings.contributors.some(c => c.user.toString() === userId) ||
        (savings.type === 'group');

      if (!canContribute) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to contribute to this savings'
        });
      }

      // Check minimum contribution
      const minContribution = parseFloat(savings.settings.minContribution) || 0;
      if (parseFloat(amount) < minContribution) {
        return res.status(400).json({
          success: false,
          message: `Minimum contribution is ${minContribution} ${savings.currency}`
        });
      }

      // Add transaction
      savings.addTransaction({
        type: 'deposit',
        amount: amount,
        fromUser: userId,
        description: description || 'Manual deposit'
      });

      // Update contributor stats
      savings.updateContributor(userId, amount);

      await savings.save();

      res.status(200).json({
        success: true,
        message: 'Deposit successful',
        data: {
          savings: {
            id: savings._id,
            currentAmount: savings.currentAmount,
            progressPercentage: savings.progressPercentage,
            remainingAmount: savings.remainingAmount,
            status: savings.status
          },
          transaction: {
            type: 'deposit',
            amount: amount,
            timestamp: new Date(),
            balanceAfter: savings.currentAmount
          }
        }
      });

    } catch (error) {
      console.error('Deposit to savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process deposit',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Withdraw from savings
  async withdraw(req, res) {
    try {
      const { savingsId } = req.params;
      const { amount, description } = req.body;
      const userId = req.user.userId;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid withdrawal amount is required'
        });
      }

      const savings = await Savings.findById(savingsId);
      if (!savings) {
        return res.status(404).json({
          success: false,
          message: 'Savings not found'
        });
      }

      // Check if user can withdraw (only owner for personal, owner/admin for group)
      const canWithdraw = savings.owner.toString() === userId ||
        (savings.type === 'group' && savings.group &&
         // You'd need to check group admin status here
         false); // Simplified for now

      if (!canWithdraw) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to withdraw from this savings'
        });
      }

      // Check if withdrawal is allowed
      if (!savings.canWithdraw(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Withdrawal not allowed due to savings settings or insufficient balance'
        });
      }

      // Check if sufficient balance
      if (parseFloat(amount) > parseFloat(savings.currentAmount)) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // Add transaction
      savings.addTransaction({
        type: 'withdrawal',
        amount: amount,
        fromUser: userId,
        description: description || 'Manual withdrawal'
      });

      await savings.save();

      res.status(200).json({
        success: true,
        message: 'Withdrawal successful',
        data: {
          savings: {
            id: savings._id,
            currentAmount: savings.currentAmount,
            progressPercentage: savings.progressPercentage,
            remainingAmount: savings.remainingAmount,
            status: savings.status
          },
          transaction: {
            type: 'withdrawal',
            amount: amount,
            timestamp: new Date(),
            balanceAfter: savings.currentAmount
          }
        }
      });

    } catch (error) {
      console.error('Withdraw from savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process withdrawal',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Update savings settings
  async updateSavings(req, res) {
    try {
      const { savingsId } = req.params;
      const userId = req.user.userId;
      const updates = req.body;

      const savings = await Savings.findById(savingsId);
      if (!savings) {
        return res.status(404).json({
          success: false,
          message: 'Savings not found'
        });
      }

      // Only owner can update savings
      if (savings.owner.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the owner can update savings settings'
        });
      }

      // Update allowed fields
      const allowedUpdates = ['name', 'description', 'targetAmount', 'settings', 'milestones', 'status'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          if (field === 'settings') {
            savings.settings = { ...savings.settings, ...updates[field] };
          } else if (field === 'milestones') {
            savings.milestones = updates[field].map(m => ({
              percentage: m.percentage,
              amount: (parseFloat(savings.targetAmount) * m.percentage / 100).toString(),
              achieved: m.achieved || false,
              achievedAt: m.achievedAt || null,
              reward: m.reward || ''
            }));
          } else {
            savings[field] = updates[field];
          }
        }
      });

      await savings.save();

      res.status(200).json({
        success: true,
        message: 'Savings updated successfully',
        data: {
          savings: {
            id: savings._id,
            name: savings.name,
            description: savings.description,
            targetAmount: savings.targetAmount,
            settings: savings.settings,
            milestones: savings.milestones,
            status: savings.status,
            updatedAt: savings.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Update savings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get savings transactions
  async getTransactions(req, res) {
    try {
      const { savingsId } = req.params;
      const userId = req.user.userId;
      const { page = 1, limit = 20, type } = req.query;

      const savings = await Savings.findById(savingsId)
        .populate('transactions.fromUser', 'email address profile');

      if (!savings) {
        return res.status(404).json({
          success: false,
          message: 'Savings not found'
        });
      }

      // Check access permissions
      const hasAccess = savings.owner.toString() === userId ||
        savings.contributors.some(c => c.user.toString() === userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      let transactions = savings.transactions;

      // Filter by type if specified
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedTransactions = transactions.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        data: {
          transactions: paginatedTransactions,
          totalTransactions: transactions.length,
          currentPage: parseInt(page),
          totalPages: Math.ceil(transactions.length / limit),
          hasNextPage: endIndex < transactions.length,
          hasPrevPage: startIndex > 0
        }
      });

    } catch (error) {
      console.error('Get savings transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve transactions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // NEW: Deposit to savings wallet and auto-supply to Aave
  async depositToSavingsWallet(req, res) {
    try {
      const { amount, asset = 'ETH' } = req.body;
      const userId = req.user.userId;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const contractService = require('../services/contractService');
      const aaveService = require('../services/aaveService');

      const assetAddress = asset === 'ETH' ? ethers.ZeroAddress : asset;
      const amountWei = ethers.parseEther(amount.toString());

      console.log(`💰 User ${user.email || user.eoaAddress} saving ${amount} ${asset}`);
      console.log(`   Main Wallet: ${user.address}`);
      console.log(`   Savings Wallet: ${user.savingsAddress}`);

      // Step 1: Transfer from main wallet → savings wallet
      console.log('📤 Step 1: Transferring from main → savings wallet...');

      const mainWalletABI = [
        "function sendEth(address payable to, uint256 amount) external",
        "function transferToWallet(address token, address to, uint256 amount) external"
      ];

      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const backendWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);

      const mainWalletContract = new ethers.Contract(
        user.address,
        mainWalletABI,
        backendWallet
      );

      let transferTx;
      if (assetAddress === ethers.ZeroAddress) {
        transferTx = await mainWalletContract.sendEth(user.savingsAddress, amountWei, {
          gasLimit: 200000
        });
      } else {
        transferTx = await mainWalletContract.transferToWallet(
          assetAddress,
          user.savingsAddress,
          amountWei,
          { gasLimit: 200000 }
        );
      }

      console.log(`   Transfer tx: ${transferTx.hash}`);
      await transferTx.wait();
      console.log(`   ✅ Transfer complete`);

      // Step 2: Auto-supply to Aave from savings wallet
      console.log('📤 Step 2: Auto-supplying to Aave...');

      const aaveResult = await aaveService.supplyPersonalSavingsToAave(
        user.savingsAddress,
        assetAddress,
        amountWei
      );

      console.log(`   ✅ Supplied to Aave: ${aaveResult.transactionHash}`);

      // Step 3: Update Savings record
      let savings = await Savings.findOne({
        owner: userId,
        type: 'personal',
        tokenAddress: assetAddress === ethers.ZeroAddress ? null : assetAddress
      });

      if (!savings) {
        savings = new Savings({
          name: `${asset} Savings`,
          description: `Personal ${asset} savings with Aave yield`,
          type: 'personal',
          owner: userId,
          currency: asset,
          tokenAddress: assetAddress === ethers.ZeroAddress ? null : assetAddress,
          targetAmount: '0',
          currentAmount: amount.toString(),
          aavePosition: {
            isSupplied: true,
            suppliedAmount: amountWei.toString(),
            aTokenBalance: aaveResult.aTokenBalance,
            lastSupplyTimestamp: new Date(),
            supplyTransactions: [{
              amount: amountWei.toString(),
              timestamp: new Date(),
              transactionHash: aaveResult.transactionHash,
              type: 'supply'
            }]
          }
        });

        savings.addTransaction({
          type: 'deposit',
          amount: amount.toString(),
          fromUser: userId,
          description: `Deposited ${amount} ${asset} and supplied to Aave`,
          metadata: { aaveTransactionHash: aaveResult.transactionHash }
        });

        await savings.save();

        if (!user.savings.includes(savings._id)) {
          user.savings.push(savings._id);
          await user.save();
        }
      } else {
        const newAmount = parseFloat(savings.currentAmount) + parseFloat(amount);
        savings.currentAmount = newAmount.toString();

        savings.aavePosition.isSupplied = true;
        savings.aavePosition.suppliedAmount = (
          BigInt(savings.aavePosition.suppliedAmount) + BigInt(amountWei)
        ).toString();
        savings.aavePosition.aTokenBalance = aaveResult.aTokenBalance;
        savings.aavePosition.lastSupplyTimestamp = new Date();
        savings.aavePosition.supplyTransactions.push({
          amount: amountWei.toString(),
          timestamp: new Date(),
          transactionHash: aaveResult.transactionHash,
          type: 'supply'
        });

        savings.addTransaction({
          type: 'deposit',
          amount: amount.toString(),
          fromUser: userId,
          description: `Deposited ${amount} ${asset} and supplied to Aave`,
          metadata: { aaveTransactionHash: aaveResult.transactionHash }
        });

        await savings.save();
      }

      const currentYield = await aaveService.getAaveYield(user.savingsAddress, assetAddress);

      res.status(200).json({
        success: true,
        message: 'Successfully deposited to savings and supplied to Aave',
        data: {
          savings: {
            id: savings._id,
            name: savings.name,
            currentAmount: savings.currentAmount,
            currency: asset,
            aavePosition: {
              isSupplied: true,
              suppliedAmount: ethers.formatEther(savings.aavePosition.suppliedAmount),
              aTokenBalance: ethers.formatEther(savings.aavePosition.aTokenBalance),
              currentYield: ethers.formatEther(currentYield)
            }
          },
          transactions: {
            transfer: transferTx.hash,
            aaveSupply: aaveResult.transactionHash
          }
        }
      });

    } catch (error) {
      console.error('❌ Deposit to savings wallet error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deposit to savings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // NEW: Get Aave yield information for user's savings
  async getAaveYield(req, res) {
    try {
      const userId = req.user.userId;
      const { type } = req.query; // 'personal' or 'group'

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const aaveService = require('../services/aaveService');

      // Query for savings with Aave positions
      let query = {
        owner: userId,
        'aavePosition.isSupplied': true
      };

      if (type) {
        query.type = type;
      }

      const savings = await Savings.find(query)
        .populate('owner', 'email address savingsAddress')
        .populate('group', 'name address');

      const yieldData = await Promise.all(savings.map(async (saving) => {
        let walletAddress;

        // Determine wallet address based on savings type
        if (saving.type === 'personal') {
          walletAddress = user.savingsAddress;
        } else if (saving.type === 'group' && saving.group) {
          walletAddress = saving.group.address;
        } else {
          return null;
        }

        if (!walletAddress) return null;

        const assetAddress = saving.tokenAddress || ethers.ZeroAddress;

        try {
          // Get current aToken balance and yield
          const aTokenBalance = await aaveService.getATokenBalance(walletAddress, assetAddress);
          const currentYield = await aaveService.getAaveYield(walletAddress, assetAddress);

          // Calculate APY (simplified - would need historical data for accurate calculation)
          const suppliedAmount = BigInt(saving.aavePosition.suppliedAmount);
          const yieldAmount = BigInt(currentYield);

          let estimatedAPY = 0;
          if (suppliedAmount > 0n && saving.aavePosition.lastSupplyTimestamp) {
            const timeElapsed = Date.now() - new Date(saving.aavePosition.lastSupplyTimestamp).getTime();
            const daysElapsed = timeElapsed / (1000 * 60 * 60 * 24);

            if (daysElapsed > 0) {
              const yieldPercentage = Number(yieldAmount * 10000n / suppliedAmount) / 100;
              estimatedAPY = (yieldPercentage / daysElapsed) * 365;
            }
          }

          return {
            savingsId: saving._id,
            name: saving.name,
            type: saving.type,
            currency: saving.currency,
            walletAddress: walletAddress,
            aavePosition: {
              suppliedAmount: ethers.formatEther(saving.aavePosition.suppliedAmount),
              aTokenBalance: ethers.formatEther(aTokenBalance),
              currentYield: ethers.formatEther(currentYield),
              estimatedAPY: estimatedAPY.toFixed(2),
              lastSupplyTimestamp: saving.aavePosition.lastSupplyTimestamp,
              supplyTransactionsCount: saving.aavePosition.supplyTransactions?.length || 0
            }
          };
        } catch (err) {
          console.error(`Error fetching yield for savings ${saving._id}:`, err);
          return {
            savingsId: saving._id,
            name: saving.name,
            type: saving.type,
            error: 'Failed to fetch yield data'
          };
        }
      }));

      // Filter out null results
      const validYieldData = yieldData.filter(d => d !== null);

      // Calculate total yield across all savings
      const totalYield = validYieldData.reduce((sum, data) => {
        if (data.aavePosition?.currentYield) {
          return sum + parseFloat(data.aavePosition.currentYield);
        }
        return sum;
      }, 0);

      res.status(200).json({
        success: true,
        data: {
          savings: validYieldData,
          summary: {
            totalSavingsWithYield: validYieldData.length,
            totalYieldEarned: totalYield.toFixed(6),
            currency: 'ETH' // Simplified - would need to handle multiple currencies
          }
        }
      });

    } catch (error) {
      console.error('Get Aave yield error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve Aave yield information',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = savingsController;