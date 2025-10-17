const savingsController = require('../../src/controllers/savingsController');
const Savings = require('../../src/models/Savings');
const User = require('../../src/models/User');
const Group = require('../../src/models/Group');

// Mock dependencies
jest.mock('../../src/models/Savings');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Group');

describe('SavingsController', () => {
  let mockUser;
  let mockGroup;
  let mockSavings;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockUser = {
      _id: 'user123',
      address: '0x1234567890123456789012345678901234567890',
      savingsAddress: '0x0987654321098765432109876543210987654321',
      email: 'test@example.com',
      savings: null,
      save: jest.fn().mockResolvedValue(true)
    };

    mockGroup = {
      _id: 'group123',
      name: 'Test Group',
      owner: 'user123',
      members: [
        { user: 'user123', role: 'admin' }
      ],
      savings: null,
      save: jest.fn().mockResolvedValue(true)
    };

    mockSavings = {
      _id: 'savings123',
      name: 'Test Savings',
      description: 'Test Description',
      type: 'personal',
      owner: 'user123',
      targetAmount: '1000',
      currentAmount: '500',
      currency: 'ETH',
      progressPercentage: 50,
      remainingAmount: '500',
      settings: {
        autoSave: false,
        allowWithdrawal: true
      },
      milestones: [],
      contributors: [
        { user: 'user123', role: 'owner' }
      ],
      transactions: [],
      stats: {},
      status: 'active',
      isLocked: false,
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue(true),
      populate: jest.fn().mockReturnThis(),
      addTransaction: jest.fn()
    };

    mockReq = {
      user: { userId: 'user123' },
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('createPersonalSavings', () => {
    it('should create personal savings successfully', async () => {
      mockReq.body = {
        name: 'My Savings',
        description: 'Personal savings goal',
        targetAmount: '1000',
        currency: 'ETH'
      };

      User.findById.mockResolvedValue(mockUser);
      const mockSavingsInstance = {
        ...mockSavings,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockSavings)
      };
      Savings.mockImplementation(() => mockSavingsInstance);

      await savingsController.createPersonalSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Personal savings created successfully',
        data: expect.objectContaining({
          savings: expect.any(Object)
        })
      });
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing name and targetAmount

      await savingsController.createPersonalSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name and target amount are required'
      });
    });

    it('should validate target amount is positive', async () => {
      mockReq.body = {
        name: 'My Savings',
        targetAmount: '-100'
      };

      await savingsController.createPersonalSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Target amount must be greater than 0'
      });
    });

    it('should return 404 if user not found', async () => {
      mockReq.body = {
        name: 'My Savings',
        targetAmount: '1000'
      };

      User.findById.mockResolvedValue(null);

      await savingsController.createPersonalSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle milestones correctly', async () => {
      mockReq.body = {
        name: 'My Savings',
        targetAmount: '1000',
        milestones: [
          { percentage: 25, reward: 'Quarter way!' },
          { percentage: 50, reward: 'Halfway there!' }
        ]
      };

      User.findById.mockResolvedValue(mockUser);
      const mockSavingsInstance = {
        ...mockSavings,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockSavings)
      };
      Savings.mockImplementation(() => mockSavingsInstance);

      await savingsController.createPersonalSavings(mockReq, mockRes);

      expect(Savings).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: expect.arrayContaining([
            expect.objectContaining({
              percentage: 25,
              amount: '250',
              reward: 'Quarter way!'
            })
          ])
        })
      );
    });
  });

  describe('createGroupSavings', () => {
    it('should create group savings successfully', async () => {
      mockReq.body = {
        groupId: 'group123',
        name: 'Group Savings',
        targetAmount: '5000'
      };

      Group.findById.mockResolvedValue(mockGroup);
      const mockSavingsInstance = {
        ...mockSavings,
        type: 'group',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(mockSavings)
      };
      Savings.mockImplementation(() => mockSavingsInstance);

      await savingsController.createGroupSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group savings created successfully',
        data: expect.objectContaining({
          savings: expect.any(Object)
        })
      });
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing required fields

      await savingsController.createGroupSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group ID, name and target amount are required'
      });
    });

    it('should return 404 if group not found', async () => {
      mockReq.body = {
        groupId: 'nonexistent',
        name: 'Group Savings',
        targetAmount: '5000'
      };

      Group.findById.mockResolvedValue(null);

      await savingsController.createGroupSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group not found'
      });
    });

    it('should restrict creation to owner/admin only', async () => {
      mockReq.body = {
        groupId: 'group123',
        name: 'Group Savings',
        targetAmount: '5000'
      };

      const groupWithDifferentOwner = {
        ...mockGroup,
        owner: 'different_user',
        members: [{ user: 'different_user', role: 'member' }]
      };

      Group.findById.mockResolvedValue(groupWithDifferentOwner);

      await savingsController.createGroupSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only group owner or admin can create group savings'
      });
    });

    it('should prevent duplicate savings for same group', async () => {
      mockReq.body = {
        groupId: 'group123',
        name: 'Group Savings',
        targetAmount: '5000'
      };

      const groupWithExistingSavings = {
        ...mockGroup,
        savings: 'existing_savings_id'
      };

      Group.findById.mockResolvedValue(groupWithExistingSavings);

      await savingsController.createGroupSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Group already has a savings account'
      });
    });
  });

  describe('getUserSavings', () => {
    it('should return user savings successfully', async () => {
      const mockSavingsArray = [mockSavings];

      Savings.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockSavingsArray)
      });

      await savingsController.getUserSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          savings: expect.any(Array),
          totalSavings: 1
        }
      });
    });

    it('should filter by type when specified', async () => {
      mockReq.query = { type: 'personal' };

      Savings.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([])
      });

      await savingsController.getUserSavings(mockReq, mockRes);

      expect(Savings.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'personal'
        })
      );
    });

    it('should handle database errors', async () => {
      Savings.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await savingsController.getUserSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSavingsById', () => {
    it('should return savings details for authorized user', async () => {
      mockReq.params = { savingsId: 'savings123' };

      Savings.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSavings)
      });

      await savingsController.getSavingsById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          savings: expect.any(Object)
        }
      });
    });

    it('should return 404 if savings not found', async () => {
      mockReq.params = { savingsId: 'nonexistent' };

      Savings.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await savingsController.getSavingsById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Savings not found'
      });
    });

    it('should deny access to unauthorized users', async () => {
      mockReq.params = { savingsId: 'savings123' };

      const unauthorizedSavings = {
        ...mockSavings,
        owner: 'different_user',
        contributors: [{ user: 'different_user', role: 'owner' }],
        group: null
      };

      Savings.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(unauthorizedSavings)
      });

      await savingsController.getSavingsById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
    });
  });

  describe('deposit', () => {
    it('should process deposit successfully', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = {
        amount: '100',
        description: 'Monthly savings'
      };

      Savings.findById.mockResolvedValue(mockSavings);

      await savingsController.deposit(mockReq, mockRes);

      expect(mockSavings.addTransaction).toHaveBeenCalledWith({
        type: 'deposit',
        amount: '100',
        fromUser: 'user123',
        description: 'Monthly savings'
      });
      expect(mockSavings.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate deposit amount', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = { amount: '0' }; // invalid amount

      await savingsController.deposit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid deposit amount is required'
      });
    });

    it('should return 404 if savings not found', async () => {
      mockReq.params = { savingsId: 'nonexistent' };
      mockReq.body = { amount: '100' };

      Savings.findById.mockResolvedValue(null);

      await savingsController.deposit(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Savings not found'
      });
    });
  });

  describe('withdraw', () => {
    it('should process withdrawal successfully', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = {
        amount: '50',
        description: 'Emergency withdrawal'
      };

      const savingsWithBalance = {
        ...mockSavings,
        currentAmount: '500',
        settings: { allowWithdrawal: true }
      };

      Savings.findById.mockResolvedValue(savingsWithBalance);

      await savingsController.withdraw(mockReq, mockRes);

      expect(savingsWithBalance.addTransaction).toHaveBeenCalledWith({
        type: 'withdrawal',
        amount: '50',
        fromUser: 'user123',
        description: 'Emergency withdrawal'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate withdrawal amount', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = { amount: '0' }; // invalid amount

      await savingsController.withdraw(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid withdrawal amount is required'
      });
    });

    it('should prevent withdrawal when not allowed', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = { amount: '50' };

      const restrictedSavings = {
        ...mockSavings,
        settings: { allowWithdrawal: false }
      };

      Savings.findById.mockResolvedValue(restrictedSavings);

      await savingsController.withdraw(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Withdrawals are not allowed for this savings account'
      });
    });
  });

  describe('updateSavings', () => {
    it('should update savings successfully by owner', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = {
        name: 'Updated Savings Name',
        description: 'Updated description'
      };

      Savings.findById.mockResolvedValue(mockSavings);

      await savingsController.updateSavings(mockReq, mockRes);

      expect(mockSavings.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should deny update by non-owner', async () => {
      mockReq.params = { savingsId: 'savings123' };
      mockReq.body = { name: 'Updated Name' };

      const savingsWithDifferentOwner = {
        ...mockSavings,
        owner: 'different_user'
      };

      Savings.findById.mockResolvedValue(savingsWithDifferentOwner);

      await savingsController.updateSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only the owner can update savings settings'
      });
    });

    it('should return 404 if savings not found', async () => {
      mockReq.params = { savingsId: 'nonexistent' };
      mockReq.body = { name: 'Updated Name' };

      Savings.findById.mockResolvedValue(null);

      await savingsController.updateSavings(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Savings not found'
      });
    });
  });

  describe('getTransactions', () => {
    it('should return savings transactions for authorized user', async () => {
      mockReq.params = { savingsId: 'savings123' };

      const savingsWithTransactions = {
        ...mockSavings,
        transactions: [
          {
            type: 'deposit',
            amount: '100',
            timestamp: new Date(),
            fromUser: { _id: 'user123', email: 'test@example.com' }
          }
        ]
      };

      Savings.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(savingsWithTransactions)
      });

      await savingsController.getTransactions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          transactions: expect.any(Array),
          totalTransactions: 1,
          currentPage: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    });

    it('should deny access to unauthorized users', async () => {
      mockReq.params = { savingsId: 'savings123' };

      const unauthorizedSavings = {
        ...mockSavings,
        owner: 'different_user',
        contributors: []
      };

      Savings.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(unauthorizedSavings)
      });

      await savingsController.getTransactions(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
    });
  });
});