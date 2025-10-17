const groupController = require('../../src/controllers/groupController');
const Group = require('../../src/models/Group');
const User = require('../../src/models/User');
const contractService = require('../../src/services/contractService');
const gaslessService = require('../../src/services/gaslessService');

// Mock dependencies
jest.mock('../../src/models/Group');
jest.mock('../../src/models/User');
jest.mock('../../src/services/contractService');
jest.mock('../../src/services/gaslessService');

describe('GroupController', () => {
  let mockUser;
  let mockGroup;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockUser = {
      _id: 'user123',
      address: '0x1234567890123456789012345678901234567890',
      savingsAddress: '0x0987654321098765432109876543210987654321',
      email: 'test@example.com',
      groups: [],
      save: jest.fn().mockResolvedValue(true)
    };

    mockGroup = {
      _id: 'group123',
      name: 'Test Group',
      description: 'Test Description',
      address: '0xgroup123',
      owner: 'user123',
      members: [
        {
          user: 'user123',
          role: 'admin',
          joinedAt: new Date()
        }
      ],
      paymentWindowDuration: 86400,
      poolSettings: {
        minContribution: 0,
        maxMembers: 100,
        isPrivate: false
      },
      paymentWindows: [{
        windowNumber: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400 * 1000),
        contributionsReceived: [],
        contributors: [],
        totalContributions: '0',
        isActive: true,
        isCompleted: false
      }],
      currentPaymentWindow: 1,
      totalPoolValue: '0',
      isActive: true,
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockReturnThis()
    };

    mockReq = {
      user: { userId: 'user123' },
      body: {},
      params: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create group successfully with gasless service', async () => {
      mockReq.body = {
        name: 'Test Group',
        description: 'Test Description',
        paymentWindowDuration: 86400
      };

      User.findById.mockResolvedValue(mockUser);
      gaslessService.isReady.mockReturnValue(true);
      gaslessService.createGroupPoolGasless.mockResolvedValue({
        poolAddress: '0xpool123'
      });
      contractService.addMemberToGroupPool.mockResolvedValue(true);

      const mockGroupInstance = {
        ...mockGroup,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockGroup)
      };
      Group.mockImplementation(() => mockGroupInstance);

      await groupController.createGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group created successfully',
        data: expect.objectContaining({
          group: expect.any(Object)
        })
      });
      expect(gaslessService.createGroupPoolGasless).toHaveBeenCalled();
    });

    it('should create group with fallback when gasless not ready', async () => {
      mockReq.body = {
        name: 'Test Group',
        description: 'Test Description'
      };

      User.findById.mockResolvedValue(mockUser);
      gaslessService.isReady.mockReturnValue(false);
      contractService.createGroupPool.mockResolvedValue({
        poolAddress: '0xpool123'
      });

      const mockGroupInstance = {
        ...mockGroup,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockGroup)
      };
      Group.mockImplementation(() => mockGroupInstance);

      await groupController.createGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(contractService.createGroupPool).toHaveBeenCalled();
    });

    it('should validate required group name', async () => {
      mockReq.body = {}; // missing name

      await groupController.createGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group name is required'
      });
    });

    it('should return 404 if user not found', async () => {
      mockReq.body = { name: 'Test Group' };
      User.findById.mockResolvedValue(null);

      await groupController.createGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle contract creation errors gracefully', async () => {
      mockReq.body = { name: 'Test Group' };

      User.findById.mockResolvedValue(mockUser);
      gaslessService.isReady.mockReturnValue(true);
      gaslessService.createGroupPoolGasless.mockRejectedValue(new Error('Contract error'));

      const mockGroupInstance = {
        ...mockGroup,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockGroup)
      };
      Group.mockImplementation(() => mockGroupInstance);

      await groupController.createGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      // Should still create group even if contract fails
    });
  });

  describe('getUserGroups', () => {
    it('should return user groups successfully', async () => {
      const mockGroups = [mockGroup];
      Group.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockGroups)
      });

      await groupController.getUserGroups(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          groups: expect.any(Array)
        }
      });
    });

    it('should handle database errors', async () => {
      Group.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await groupController.getUserGroups(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getGroupById', () => {
    it('should return group details for member', async () => {
      mockReq.params = { groupId: 'group123' };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockGroup)
      });

      await groupController.getGroupById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          group: expect.any(Object)
        }
      });
    });

    it('should return 404 if group not found', async () => {
      mockReq.params = { groupId: 'nonexistent' };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await groupController.getGroupById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group not found'
      });
    });

    it('should return 403 if user not a member', async () => {
      mockReq.params = { groupId: 'group123' };

      const groupWithoutUser = {
        ...mockGroup,
        members: [] // user not in members
      };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(groupWithoutUser)
      });

      await groupController.getGroupById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. You are not a member of this group.'
      });
    });
  });

  describe('joinGroup', () => {
    it('should join group successfully', async () => {
      mockReq.params = { groupId: 'group123' };

      const groupToJoin = {
        ...mockGroup,
        members: [], // empty members so user can join
        owner: { _id: 'owner123' },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(groupToJoin)
      });
      User.findById.mockResolvedValue(mockUser);
      contractService.addMemberToGroupPool.mockResolvedValue(true);

      await groupController.joinGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully joined the group',
        data: expect.any(Object)
      });
    });

    it('should prevent joining if already a member', async () => {
      mockReq.params = { groupId: 'group123' };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockGroup) // user already in members
      });

      await groupController.joinGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'You are already a member of this group'
      });
    });

    it('should prevent joining if group is full', async () => {
      mockReq.params = { groupId: 'group123' };

      const fullGroup = {
        ...mockGroup,
        members: new Array(100).fill({ user: 'other' }), // at max capacity
        poolSettings: { maxMembers: 100 }
      };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(fullGroup)
      });

      await groupController.joinGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('maximum member limit')
      });
    });
  });

  describe('leaveGroup', () => {
    it('should leave group successfully', async () => {
      mockReq.params = { groupId: 'group123' };

      const groupWithUser = {
        ...mockGroup,
        owner: 'owner123', // different from user
        members: [{ user: 'user123', role: 'member' }],
        save: jest.fn().mockResolvedValue(true)
      };

      Group.findById.mockResolvedValue(groupWithUser);
      User.findById.mockResolvedValue(mockUser);
      contractService.removeMemberFromGroupPool.mockResolvedValue(true);

      await groupController.leaveGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Successfully left the group',
        data: expect.any(Object)
      });
    });

    it('should prevent owner from leaving', async () => {
      mockReq.params = { groupId: 'group123' };

      const groupOwnedByUser = {
        ...mockGroup,
        owner: 'user123', // same as requesting user
        members: [{ user: 'user123', role: 'admin' }]
      };

      Group.findById.mockResolvedValue(groupOwnedByUser);

      await groupController.leaveGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Group owner cannot leave')
      });
    });

    it('should return 400 if user not a member', async () => {
      mockReq.params = { groupId: 'group123' };

      const groupWithoutUser = {
        ...mockGroup,
        members: [] // user not in members
      };

      Group.findById.mockResolvedValue(groupWithoutUser);

      await groupController.leaveGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'You are not a member of this group'
      });
    });
  });

  describe('contribute', () => {
    it('should process ETH contribution successfully', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = { amount: '1.0' };

      Group.findById.mockResolvedValue(mockGroup);
      User.findById.mockResolvedValue(mockUser);
      contractService.callGroupPoolFunction.mockResolvedValue({
        transactionHash: '0xtxhash123'
      });

      await groupController.contribute(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'ETH contributed successfully',
        data: expect.objectContaining({
          contribution: expect.objectContaining({
            amount: '1.0'
          })
        })
      });
    });

    it('should validate contribution amount', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = { amount: '0' }; // invalid amount

      await groupController.contribute(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid contribution amount is required'
      });
    });

    it('should restrict contributions to members only', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = { amount: '1.0' };

      const groupWithoutUser = {
        ...mockGroup,
        members: [] // user not in members
      };

      Group.findById.mockResolvedValue(groupWithoutUser);

      await groupController.contribute(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only group members can contribute'
      });
    });

    it('should handle contract errors gracefully', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = { amount: '1.0' };

      Group.findById.mockResolvedValue(mockGroup);
      User.findById.mockResolvedValue(mockUser);
      contractService.callGroupPoolFunction.mockRejectedValue(new Error('Contract error'));

      await groupController.contribute(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      // Should still process contribution even if contract fails
    });
  });

  describe('contributeToken', () => {
    it('should process token contribution successfully', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = {
        tokenAddress: '0xtoken123',
        amount: '100'
      };

      Group.findById.mockResolvedValue(mockGroup);
      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.callGroupPoolFunction.mockResolvedValue({
        transactionHash: '0xtxhash456'
      });

      await groupController.contributeToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'ERC20 token contributed successfully',
        data: expect.any(Object)
      });
    });

    it('should validate token address', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = {
        tokenAddress: 'invalid',
        amount: '100'
      };

      contractService.validateAddress.mockReturnValue(false);

      await groupController.contributeToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token address'
      });
    });

    it('should require token address and amount', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = {}; // missing required fields

      await groupController.contributeToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token address and valid amount are required'
      });
    });
  });

  describe('getUserContributions', () => {
    it('should return user contributions for self', async () => {
      mockReq.params = { groupId: 'group123', userId: 'user123' };

      const groupWithContributions = {
        ...mockGroup,
        paymentWindows: [{
          windowNumber: 1,
          contributionsReceived: [{
            member: { _id: 'user123' },
            amount: '1.0',
            timestamp: new Date(),
            transactionHash: '0xtx1'
          }]
        }]
      };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(groupWithContributions)
      });

      await groupController.getUserContributions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          contributions: expect.any(Array)
        })
      });
    });

    it('should deny access to other user contributions for non-admin', async () => {
      mockReq.params = { groupId: 'group123', userId: 'other_user' };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockGroup)
      });

      await groupController.getUserContributions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'You can only view your own contributions'
      });
    });

    it('should allow admin to view any user contributions', async () => {
      mockReq.params = { groupId: 'group123', userId: 'other_user' };

      const adminGroup = {
        ...mockGroup,
        owner: 'user123', // user is owner
        paymentWindows: [{
          windowNumber: 1,
          contributionsReceived: [{
            member: { _id: 'other_user' },
            amount: '2.0',
            timestamp: new Date()
          }]
        }]
      };

      Group.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(adminGroup)
      });

      await groupController.getUserContributions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully by owner', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = {
        name: 'Updated Group Name',
        description: 'Updated description'
      };

      Group.findById.mockResolvedValue(mockGroup);

      await groupController.updateGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group updated successfully',
        data: expect.any(Object)
      });
    });

    it('should deny update by non-owner', async () => {
      mockReq.params = { groupId: 'group123' };
      mockReq.body = { name: 'New Name' };

      const groupWithDifferentOwner = {
        ...mockGroup,
        owner: 'different_user'
      };

      Group.findById.mockResolvedValue(groupWithDifferentOwner);

      await groupController.updateGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only group owner can update group settings'
      });
    });

    it('should return 404 if group not found', async () => {
      mockReq.params = { groupId: 'nonexistent' };
      mockReq.body = { name: 'New Name' };

      Group.findById.mockResolvedValue(null);

      await groupController.updateGroup(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group not found'
      });
    });
  });
});