const Group = require('../models/Group');
const User = require('../models/User');
const contractService = require('../services/contractService');
const gaslessService = require('../services/gaslessService');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');

const groupController = {
  async createGroup(req, res) {
    try {
      const { name, description, paymentWindowDuration, poolSettings = {} } = req.body;
      const userId = req.user.userId;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Group name is required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Use user's main wallet address + timestamp as unique group identifier
      const groupIdentifier = `${user.address}_${Date.now()}`;
      console.log(`Creating group with identifier: ${groupIdentifier}`);
      console.log(`Group owner address: ${user.address}`);

      const windowDuration = paymentWindowDuration || 86400; // Default 1 day
      const minContribution = poolSettings.minContribution || 0;
      const maxMembers = poolSettings.maxMembers || 100;

      let poolAddress = null;

      // Create group pool GASLESS - Backend pays all gas fees
      try {
        if (gaslessService.isReady()) {
          console.log('✅ Creating group pool GASLESS - Backend pays all gas fees');
          const poolData = await gaslessService.createGroupPoolGasless(
            groupIdentifier,
            user.address,
            name.trim(),
            {
              paymentWindowDuration: windowDuration,
              minContribution: minContribution,
              maxMembers: maxMembers
            }
          );
          if (poolData) {
            poolAddress = poolData.poolAddress;
            console.log(`✅ Group pool created at ${poolAddress} - Gas paid by backend`);
          }
        } else {
          console.warn('⚠️ Gasless service not ready, using fallback');
          const poolData = await contractService.createGroupPool(
            groupIdentifier,
            user.address,
            name.trim(),
            windowDuration,
            minContribution,
            maxMembers
          );
          if (poolData) {
            poolAddress = poolData.poolAddress;
          }
        }
      } catch (contractError) {
        console.warn('Contract pool creation failed:', contractError.message);
        poolAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
      }

      const group = new Group({
        name: name.trim(),
        description: description || '',
        address: poolAddress, // Use address field from Group model
        owner: userId,
        members: [{
          user: userId,
          role: 'admin',
          joinedAt: new Date()
        }],
        paymentWindowDuration: windowDuration,
        poolSettings: {
          minContribution: minContribution,
          maxMembers: maxMembers,
          isPrivate: poolSettings.isPrivate || false,
          contributionFrequency: poolSettings.contributionFrequency || 'monthly'
        },
        paymentWindows: [{
          windowNumber: 1,
          startDate: new Date(),
          endDate: new Date(Date.now() + windowDuration * 1000),
          contributionsReceived: [],
          totalContributions: '0',
          isActive: true,
          isCompleted: false
        }]
      });

      await group.save();

      user.groups.push(group._id);
      await user.save();

      // Add creator as member to smart contract pool
      try {
        if (poolAddress) {
          await contractService.addMemberToGroupPool(poolAddress, user.address);
        }
      } catch (contractError) {
        console.warn('Failed to add creator to contract pool:', contractError.message);
      }

      await group.populate(['owner', 'members.user']);

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: {
          group: {
            id: group._id,
            name: group.name,
            description: group.description,
            address: group.address,
            paymentWindowDuration: group.paymentWindowDuration,
            owner: {
              id: group.owner._id,
              email: group.owner.email,
              address: group.owner.address,
              savingsAddress: group.owner.savingsAddress
            },
            members: group.members,
            poolSettings: group.poolSettings,
            totalPoolValue: group.totalPoolValue,
            currentPaymentWindow: group.currentPaymentWindow,
            createdAt: group.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create group',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getUserGroups(req, res) {
    try {
      const userId = req.user.userId;

      const groups = await Group.find({
        'members.user': userId,
        isActive: true
      })
      .populate('owner', 'email address savingsAddress profile')
      .populate('members.user', 'email address savingsAddress profile')
      .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          groups: groups.map(group => ({
            id: group._id,
            name: group.name,
            description: group.description,
            address: group.address,
            paymentWindowDuration: group.paymentWindowDuration,
            owner: group.owner,
            membersCount: group.members.length,
            userRole: group.members.find(m => m.user._id.toString() === userId)?.role,
            poolSettings: group.poolSettings,
            totalPoolValue: group.totalPoolValue,
            currentPaymentWindow: group.currentPaymentWindow,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
          }))
        }
      });

    } catch (error) {
      console.error('Get user groups error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve groups',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getGroupById(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId)
        .populate('owner', 'email address savingsAddress profile')
        .populate('members.user', 'email address savingsAddress profile');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user._id.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this group.'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          group: {
            id: group._id,
            name: group.name,
            description: group.description,
            address: group.address,
            paymentWindowDuration: group.paymentWindowDuration,
            owner: group.owner,
            members: group.members,
            poolSettings: group.poolSettings,
            totalPoolValue: group.totalPoolValue,
            currentPaymentWindow: group.currentPaymentWindow,
            paymentWindows: group.paymentWindows,
            isActive: group.isActive,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Get group by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve group',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async joinGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId)
        .populate('owner', 'email address profile')
        .populate('savings', 'name targetAmount currentAmount');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      if (!group.isActive) {
        return res.status(400).json({
          success: false,
          message: 'This group is no longer active'
        });
      }

      const isAlreadyMember = group.members.some(member => member.user.toString() === userId);
      if (isAlreadyMember) {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this group'
        });
      }

      if (group.members.length >= group.poolSettings.maxMembers) {
        return res.status(400).json({
          success: false,
          message: `Group has reached maximum member limit of ${group.poolSettings.maxMembers}`
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Add user to group members
      group.members.push({
        user: userId,
        role: 'member',
        joinedAt: new Date()
      });

      await group.save();

      // Add group to user's groups list
      if (!user.groups.includes(groupId)) {
        user.groups.push(groupId);
        await user.save();
      }

      // Add member to smart contract pool (if using smart contracts)
      let contractIntegrationSuccess = false;
      try {
        if (group.address) {
          await contractService.addMemberToGroupPool(group.address, user.address);
          contractIntegrationSuccess = true;
        }
      } catch (contractError) {
        console.warn('Failed to add member to contract pool:', contractError.message);
      }

      // If group has savings, add user as contributor
      let savingsIntegrationSuccess = false;
      try {
        if (group.savings) {
          const Savings = require('../models/Savings');
          const savings = await Savings.findById(group.savings);
          if (savings) {
            // Check if user is already a contributor
            const isContributor = savings.contributors.some(c => c.user.toString() === userId);
            if (!isContributor) {
              savings.contributors.push({
                user: userId,
                role: 'contributor'
              });
              await savings.save();
              savingsIntegrationSuccess = true;
            }
          }
        }
      } catch (savingsError) {
        console.warn('Failed to add member to group savings:', savingsError.message);
      }

      await group.populate('members.user', 'email address savingsAddress profile');

      // Prepare response
      const response = {
        success: true,
        message: 'Successfully joined the group',
        data: {
          group: {
            id: group._id,
            name: group.name,
            description: group.description,
            membersCount: group.members.length,
            owner: {
              id: group.owner._id,
              email: group.owner.email,
              profile: group.owner.profile
            },
            poolSettings: group.poolSettings,
            currentPaymentWindow: group.currentPaymentWindow,
            userRole: 'member',
            joinedAt: new Date()
          }
        }
      };

      // Include savings information if available
      if (group.savings) {
        response.data.group.savings = {
          id: group.savings._id,
          name: group.savings.name,
          targetAmount: group.savings.targetAmount,
          currentAmount: group.savings.currentAmount,
          progressPercentage: parseFloat(group.savings.currentAmount) / parseFloat(group.savings.targetAmount) * 100
        };
      }

      res.status(200).json(response);

    } catch (error) {
      console.error('Join group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join group',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async leaveGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // Check if user is a member
      const memberIndex = group.members.findIndex(member => member.user.toString() === userId);
      if (memberIndex === -1) {
        return res.status(400).json({
          success: false,
          message: 'You are not a member of this group'
        });
      }

      // Prevent owner from leaving (they should transfer ownership first)
      if (group.owner.toString() === userId) {
        return res.status(400).json({
          success: false,
          message: 'Group owner cannot leave. Transfer ownership first or delete the group.'
        });
      }

      // Remove user from group members
      group.members.splice(memberIndex, 1);
      await group.save();

      // Remove group from user's groups list
      const user = await User.findById(userId);
      if (user) {
        user.groups = user.groups.filter(gId => gId.toString() !== groupId);
        await user.save();
      }

      // Remove member from smart contract pool
      try {
        if (group.address && user) {
          await contractService.removeMemberFromGroupPool(group.address, user.address);
        }
      } catch (contractError) {
        console.warn('Failed to remove member from contract pool:', contractError.message);
      }

      // Remove from group savings contributors (but keep their contribution history)
      try {
        if (group.savings) {
          const Savings = require('../models/Savings');
          const savings = await Savings.findById(group.savings);
          if (savings) {
            // Don't remove contributor record to maintain history, just mark as inactive
            const contributor = savings.contributors.find(c => c.user.toString() === userId);
            if (contributor) {
              contributor.role = 'former_contributor';
              await savings.save();
            }
          }
        }
      } catch (savingsError) {
        console.warn('Failed to update member in group savings:', savingsError.message);
      }

      res.status(200).json({
        success: true,
        message: 'Successfully left the group',
        data: {
          groupId: groupId,
          groupName: group.name,
          remainingMembers: group.members.length
        }
      });

    } catch (error) {
      console.error('Leave group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to leave group',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },


  async getGroupMembers(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId)
        .populate('members.user', 'email address profile createdAt')
        .populate('owner', 'email address profile');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // Check if user is a member
      const isMember = group.members.some(member => member.user._id.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this group.'
        });
      }

      const members = group.members.map(member => ({
        id: member.user._id,
        email: member.user.email,
        address: member.user.address,
        profile: member.user.profile,
        role: member.role,
        joinedAt: member.joinedAt,
        isOwner: member.user._id.toString() === group.owner._id.toString()
      }));

      res.status(200).json({
        success: true,
        data: {
          groupId: group._id,
          groupName: group.name,
          totalMembers: members.length,
          maxMembers: group.poolSettings.maxMembers,
          owner: {
            id: group.owner._id,
            email: group.owner.email,
            profile: group.owner.profile
          },
          members: members
        }
      });

    } catch (error) {
      console.error('Get group members error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve group members',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async updateGroup(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;
      const { name, description, poolSettings } = req.body;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      if (group.owner.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only group owner can update group settings'
        });
      }

      if (name) group.name = name.trim();
      if (description !== undefined) group.description = description;
      if (poolSettings) {
        group.poolSettings = {
          ...group.poolSettings,
          ...poolSettings
        };
      }

      await group.save();

      res.status(200).json({
        success: true,
        message: 'Group updated successfully',
        data: {
          group: {
            id: group._id,
            name: group.name,
            description: group.description,
            poolSettings: group.poolSettings,
            updatedAt: group.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update group',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async createPaymentWindow(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isOwnerOrAdmin = group.owner.toString() === userId ||
        group.members.find(m => m.user.toString() === userId && m.role === 'admin');

      if (!isOwnerOrAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only group owner or admin can create payment windows'
        });
      }

      // Create new payment window in smart contract
      try {
        if (group.address) {
          await contractService.callGroupPoolFunction(group.address, 'createNewPaymentWindow');
        }
      } catch (contractError) {
        console.warn('Failed to create payment window in contract:', contractError.message);
      }

      // Update database
      const newWindowNumber = group.currentPaymentWindow + 1;
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + group.paymentWindowDuration * 1000);

      group.paymentWindows.push({
        windowNumber: newWindowNumber,
        startDate: startDate,
        endDate: endDate,
        contributionsReceived: [],
        totalContributions: '0',
        isActive: true,
        isCompleted: false
      });

      // Mark previous window as inactive
      const previousWindow = group.paymentWindows.find(w => w.windowNumber === group.currentPaymentWindow);
      if (previousWindow) {
        previousWindow.isActive = false;
        previousWindow.isCompleted = true;
      }

      group.currentPaymentWindow = newWindowNumber;
      await group.save();

      res.status(201).json({
        success: true,
        message: 'Payment window created successfully',
        data: {
          windowNumber: newWindowNumber,
          startDate: startDate,
          endDate: endDate
        }
      });

    } catch (error) {
      console.error('Create payment window error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment window',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async completePaymentWindow(req, res) {
    try {
      const { groupId, windowNumber } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isOwnerOrAdmin = group.owner.toString() === userId ||
        group.members.find(m => m.user.toString() === userId && m.role === 'admin');

      if (!isOwnerOrAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only group owner or admin can complete payment windows'
        });
      }

      const window = group.paymentWindows.find(w => w.windowNumber === parseInt(windowNumber));
      if (!window) {
        return res.status(404).json({
          success: false,
          message: 'Payment window not found'
        });
      }

      if (window.isCompleted) {
        return res.status(400).json({
          success: false,
          message: 'Payment window already completed'
        });
      }

      // Complete window in smart contract
      try {
        if (group.address) {
          await contractService.callGroupPoolFunction(group.address, 'completeCurrentWindow');
        }
      } catch (contractError) {
        console.warn('Failed to complete payment window in contract:', contractError.message);
      }

      // Update database
      window.isActive = false;
      window.isCompleted = true;
      await group.save();

      res.status(200).json({
        success: true,
        message: 'Payment window completed successfully',
        data: {
          windowNumber: parseInt(windowNumber),
          totalContributions: window.totalContributions
        }
      });

    } catch (error) {
      console.error('Complete payment window error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete payment window',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getPaymentWindow(req, res) {
    try {
      const { groupId, windowNumber } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId)
        .populate('paymentWindows.contributionsReceived.member', 'email address profile');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this group.'
        });
      }

      const window = group.paymentWindows.find(w => w.windowNumber === parseInt(windowNumber));
      if (!window) {
        return res.status(404).json({
          success: false,
          message: 'Payment window not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          window: {
            windowNumber: window.windowNumber,
            startDate: window.startDate,
            endDate: window.endDate,
            totalContributions: window.totalContributions,
            contributionsReceived: window.contributionsReceived,
            isActive: window.isActive,
            isCompleted: window.isCompleted
          }
        }
      });

    } catch (error) {
      console.error('Get payment window error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment window',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getPaymentWindows(req, res) {
    try {
      const { groupId } = req.params;
      const userId = req.user.userId;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this group.'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          paymentWindows: group.paymentWindows.map(window => ({
            windowNumber: window.windowNumber,
            startDate: window.startDate,
            endDate: window.endDate,
            totalContributions: window.totalContributions,
            contributionsCount: window.contributionsReceived.length,
            isActive: window.isActive,
            isCompleted: window.isCompleted
          })),
          currentPaymentWindow: group.currentPaymentWindow
        }
      });

    } catch (error) {
      console.error('Get payment windows error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment windows',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async contribute(req, res) {
    try {
      const { groupId } = req.params;
      const { amount } = req.body;
      const userId = req.user.userId;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid contribution amount is required'
        });
      }

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Only group members can contribute'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Make contribution through smart contract
      let transactionHash = null;
      try {
        if (group.address) {
          const amountWei = ethers.parseEther(amount.toString());
          const result = await contractService.callGroupPoolFunction(
            group.address,
            'contribute',
            [],
            amountWei
          );
          transactionHash = result.transactionHash;
        }
      } catch (contractError) {
        return res.status(500).json({
          success: false,
          message: 'Contribution failed in smart contract',
          error: contractError.message
        });
      }

      // Update database
      const currentWindow = group.paymentWindows.find(w => w.windowNumber === group.currentPaymentWindow);
      if (currentWindow) {
        const existingContribution = currentWindow.contributionsReceived.find(
          c => c.member.toString() === userId
        );

        if (existingContribution) {
          existingContribution.amount = (parseFloat(existingContribution.amount) + parseFloat(amount)).toString();
          existingContribution.timestamp = new Date();
          if (transactionHash) existingContribution.transactionHash = transactionHash;
        } else {
          currentWindow.contributionsReceived.push({
            member: userId,
            amount: amount.toString(),
            timestamp: new Date(),
            transactionHash: transactionHash,
            tokenAddress: null
          });
        }

        currentWindow.totalContributions = (
          parseFloat(currentWindow.totalContributions) + parseFloat(amount)
        ).toString();
      }

      group.totalPoolValue = (parseFloat(group.totalPoolValue) + parseFloat(amount)).toString();
      await group.save();

      res.status(200).json({
        success: true,
        message: 'Contribution successful',
        data: {
          amount: amount,
          transactionHash: transactionHash,
          windowNumber: group.currentPaymentWindow
        }
      });

    } catch (error) {
      console.error('Contribute error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process contribution',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async contributeToken(req, res) {
    try {
      const { groupId } = req.params;
      const { tokenAddress, amount } = req.body;
      const userId = req.user.userId;

      if (!tokenAddress || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Token address and valid amount are required'
        });
      }

      if (!contractService.validateAddress(tokenAddress)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token address'
        });
      }

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user.toString() === userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Only group members can contribute'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Make token contribution through smart contract
      let transactionHash = null;
      try {
        if (group.address) {
          const result = await contractService.callGroupPoolFunction(
            group.address,
            'contributeToken',
            [tokenAddress, amount]
          );
          transactionHash = result.transactionHash;
        }
      } catch (contractError) {
        return res.status(500).json({
          success: false,
          message: 'Token contribution failed in smart contract',
          error: contractError.message
        });
      }

      // Update database
      const currentWindow = group.paymentWindows.find(w => w.windowNumber === group.currentPaymentWindow);
      if (currentWindow) {
        const existingContribution = currentWindow.contributionsReceived.find(
          c => c.member.toString() === userId && c.tokenAddress === tokenAddress
        );

        if (existingContribution) {
          existingContribution.amount = (parseFloat(existingContribution.amount) + parseFloat(amount)).toString();
          existingContribution.timestamp = new Date();
          if (transactionHash) existingContribution.transactionHash = transactionHash;
        } else {
          currentWindow.contributionsReceived.push({
            member: userId,
            amount: amount.toString(),
            timestamp: new Date(),
            transactionHash: transactionHash,
            tokenAddress: tokenAddress
          });
        }

        // Note: For simplicity, adding token amounts to total contributions
        // In production, you might want to convert to a common denomination
        currentWindow.totalContributions = (
          parseFloat(currentWindow.totalContributions) + parseFloat(amount)
        ).toString();
      }

      await group.save();

      res.status(200).json({
        success: true,
        message: 'Token contribution successful',
        data: {
          tokenAddress: tokenAddress,
          amount: amount,
          transactionHash: transactionHash,
          windowNumber: group.currentPaymentWindow
        }
      });

    } catch (error) {
      console.error('Contribute token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process token contribution',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getUserContributions(req, res) {
    try {
      const { groupId, userId: targetUserId } = req.params;
      const requestUserId = req.user.userId;

      const group = await Group.findById(groupId)
        .populate('paymentWindows.contributionsReceived.member', 'email address profile');

      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      const isMember = group.members.some(member => member.user.toString() === requestUserId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this group.'
        });
      }

      // Only allow users to see their own contributions unless they are admin/owner
      const isOwnerOrAdmin = group.owner.toString() === requestUserId ||
        group.members.find(m => m.user.toString() === requestUserId && m.role === 'admin');

      if (targetUserId !== requestUserId && !isOwnerOrAdmin) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own contributions'
        });
      }

      const contributions = [];
      group.paymentWindows.forEach(window => {
        const userContributions = window.contributionsReceived.filter(
          c => c.member._id.toString() === targetUserId
        );
        userContributions.forEach(contribution => {
          contributions.push({
            windowNumber: window.windowNumber,
            amount: contribution.amount,
            tokenAddress: contribution.tokenAddress,
            timestamp: contribution.timestamp,
            transactionHash: contribution.transactionHash
          });
        });
      });

      res.status(200).json({
        success: true,
        data: {
          contributions: contributions,
          totalContributed: contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0).toString()
        }
      });

    } catch (error) {
      console.error('Get user contributions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user contributions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = groupController;