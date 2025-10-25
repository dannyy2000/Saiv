const request = require('supertest');
const { ethers } = require('ethers');

// ⚠️ Mock services BEFORE requiring app
jest.mock('../../src/services/aaveService', () => {
  const { ethers } = require('ethers'); // ✅ move inside
  return {
    initialize: jest.fn().mockResolvedValue(true),
    supplyGroupPoolToAave: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0x' + '1'.repeat(64),
      aTokenBalance: ethers.parseEther('10.2').toString()
    }),
    supplyToAave: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0x' + '2'.repeat(64)
    }),
    withdrawFromAave: jest.fn().mockResolvedValue({
      success: true,
      transactionHash: '0x' + '3'.repeat(64)
    }),
    getAaveBalance: jest.fn().mockResolvedValue({
      aTokenBalance: ethers.parseEther('10.2').toString(),
      underlyingBalance: ethers.parseEther('10.2').toString()
    }),
    getUserAavePositions: jest.fn().mockResolvedValue([]),
    getGroupPoolAavePositions: jest.fn().mockResolvedValue([])
  };
});

jest.mock('../../src/services/contractService', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  deployAddressManager: jest.fn().mockResolvedValue('0x' + 'a'.repeat(40)),
  createUserWallets: jest.fn().mockResolvedValue({
    mainWallet: '0x' + 'b'.repeat(40),
    savingsWallet: '0x' + 'c'.repeat(40)
  }),
  createGroupPool: jest.fn().mockResolvedValue({
    poolAddress: '0x' + 'd'.repeat(40)
  }),
  callWalletFunction: jest.fn().mockResolvedValue({
    success: true,
    transactionHash: '0x123'
  }),
  callGroupPoolFunction: jest.fn().mockResolvedValue({
    success: true,
    transactionHash: '0x456'
  }),
  validateAddress: jest.fn().mockReturnValue(true)
}));


// NOW it's safe to require app
const app = require('../../src/app');
const User = require('../../src/models/User');
const Group = require('../../src/models/Group');
const Savings = require('../../src/models/Savings');
const MockContractHelpers = require('../helpers/mockContracts');
const { testUser, testUser2, testGroup, amounts } = require('../fixtures/testData');

const aaveService = require('../../src/services/aaveService');
const contractService = require('../../src/services/contractService');

describe('Group Savings with Aave Integration', () => {
  let authToken;
  let userId;
  let user;
  let groupId;
  let group;

  beforeAll(() => {
    // Setup mocks - this now just configures additional behavior
    const aaveMocks = MockContractHelpers.mockAaveService();
    Object.keys(aaveMocks).forEach(key => {
      if (aaveService[key] && typeof aaveService[key].mockImplementation === 'function') {
        aaveService[key].mockImplementation(aaveMocks[key]);
      }
    });
    
    const contractMocks = MockContractHelpers.mockContractService();
    Object.keys(contractMocks).forEach(key => {
      if (contractService[key] && typeof contractService[key].mockImplementation === 'function') {
        contractService[key].mockImplementation(contractMocks[key]);
      }
    });
  });

  beforeEach(async () => {
    // Clear all mock call history before each test
    jest.clearAllMocks();
    
    // Create test user
    user = await User.create({
      ...testUser,
      savings: []
    });
    userId = user._id;

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET);

    // Create test group with payment window
    group = await Group.create({
      ...testGroup,
      owner: userId,
      members: [{
        user: userId,
        role: 'admin',
        joinedAt: new Date()
      }],
      paymentWindows: [{
        windowNumber: 1,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        isActive: true,
        isCompleted: false,
        totalContributions: '0',
        contributors: []
      }]
    });
    groupId = group._id;
  });

  afterAll(async () => {
    // Close database connection to prevent open handles
    const mongoose = require('mongoose');
    await mongoose.connection.close();
  });

  describe('POST /api/groups/:groupId/contribute - Contribute ETH to Group', () => {
    it('should contribute ETH from user main wallet to group pool', async () => {
      const contributionAmount = '2.0';

      const response = await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: contributionAmount
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('contributed');

      // Check response data
      expect(response.body.data.contribution).toBeDefined();
      expect(response.body.data.contribution.amount).toBe(contributionAmount);
      expect(response.body.data.contribution.asset).toBe('ETH');
      expect(response.body.data.transactionHash).toBeDefined();

      // Verify contractService was called to contribute
      expect(contractService.callGroupPoolFunction).toHaveBeenCalled();
    });

    it('should update payment window with contribution', async () => {
      const contributionAmount = '2.0';

      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: contributionAmount });

      // Check database
      const updatedGroup = await Group.findById(groupId);
      const window = updatedGroup.paymentWindows[0];

      expect(parseFloat(window.totalContributions)).toBe(parseFloat(contributionAmount));
      expect(window.contributors).toHaveLength(1);
      expect(window.contributors[0].userId.toString()).toBe(userId.toString());
      expect(window.contributors[0].amount).toBe(contributionAmount);
    });

    it('should accumulate multiple contributions from same user', async () => {
      const firstContribution = '1.0';
      const secondContribution = '1.5';

      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: firstContribution });

      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: secondContribution });

      const updatedGroup = await Group.findById(groupId);
      const window = updatedGroup.paymentWindows[0];

      expect(parseFloat(window.totalContributions)).toBe(
        parseFloat(firstContribution) + parseFloat(secondContribution)
      );
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '-1.0' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .send({ amount: '2.0' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/groups/:groupId/contribute-token - Contribute ERC20 Token to Group', () => {
    const usdcAddress = '0x' + 'c'.repeat(40);

    it('should contribute ERC20 token from user main wallet to group pool', async () => {
      const contributionAmount = '100.0'; // 100 USDC

      const response = await request(app)
        .post(`/api/groups/${groupId}/contribute-token`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenAddress: usdcAddress,
          amount: contributionAmount
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('token contributed');

      // Check response data
      expect(response.body.data.contribution).toBeDefined();
      expect(response.body.data.contribution.amount).toBe(contributionAmount);
      expect(response.body.data.contribution.tokenAddress).toBe(usdcAddress);
      expect(response.body.data.transactionHash).toBeDefined();

      // Verify contractService was called
      expect(contractService.callGroupPoolFunction).toHaveBeenCalled();
    });

    it('should update payment window with token contribution', async () => {
      const contributionAmount = '100.0';

      await request(app)
        .post(`/api/groups/${groupId}/contribute-token`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenAddress: usdcAddress,
          amount: contributionAmount
        });

      const updatedGroup = await Group.findById(groupId);
      const window = updatedGroup.paymentWindows[0];

      expect(parseFloat(window.totalContributions)).toBe(parseFloat(contributionAmount));
      expect(window.contributors[0].tokenAddress).toBe(usdcAddress);
    });

    it('should return 400 for missing token address', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/contribute-token`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '100.0' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/groups/:groupId/windows/:windowNumber/complete - Complete Payment Window and Auto-Supply to Aave', () => {
    beforeEach(async () => {
      // Add contributions to the window
      const updatedGroup = await Group.findById(groupId);
      updatedGroup.paymentWindows[0].totalContributions = '5.0';
      updatedGroup.paymentWindows[0].contributors = [{
        userId: userId,
        amount: '5.0',
        timestamp: new Date()
      }];
      await updatedGroup.save();
    });

    it('should complete payment window and automatically supply to Aave', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset: 'ETH'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completed');

      // Check response data
      expect(response.body.data.window).toBeDefined();
      expect(response.body.data.window.isCompleted).toBe(true);
      expect(response.body.data.window.isActive).toBe(false);

      // Check Aave supply data
      expect(response.body.data.aaveSupply).toBeDefined();
      expect(response.body.data.aaveSupply.success).toBe(true);
      expect(response.body.data.aaveSupply.transactionHash).toBeDefined();

      // Verify contractService was called to complete window
      expect(contractService.callGroupPoolFunction).toHaveBeenCalledWith(
        group.address,
        'completeCurrentWindow'
      );

      // Verify aaveService was called to supply to Aave
      expect(aaveService.supplyGroupPoolToAave).toHaveBeenCalledWith(
        group.address,
        ethers.ZeroAddress,
        ethers.parseEther('5.0')
      );
    });

    it('should create Savings record with Aave position after window completion', async () => {
      await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Check database for Savings record
      const savings = await Savings.findOne({
        group: groupId,
        type: 'group',
        tokenAddress: null
      });

      expect(savings).toBeDefined();
      expect(savings.name).toContain('Group ETH Savings');
      expect(savings.currentAmount).toBe('5.0');
      expect(savings.aavePosition.isSupplied).toBe(true);
      expect(savings.aavePosition.suppliedAmount).toBe(ethers.parseEther('5.0').toString());
      expect(savings.aavePosition.supplyTransactions).toHaveLength(1);
    });

    it('should update existing Savings record on subsequent window completions', async () => {
      // First window completion
      await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Add a second window
      const updatedGroup = await Group.findById(groupId);
      updatedGroup.paymentWindows.push({
        windowNumber: 2,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        isActive: true,
        isCompleted: false,
        totalContributions: '3.0',
        contributors: [{
          userId: userId,
          amount: '3.0',
          timestamp: new Date()
        }]
      });
      await updatedGroup.save();

      // Complete second window
      await request(app)
        .post(`/api/groups/${groupId}/windows/2/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Check database
      const savings = await Savings.findOne({
        group: groupId,
        type: 'group',
        tokenAddress: null
      });

      expect(savings).toBeDefined();
      expect(parseFloat(savings.currentAmount)).toBe(8.0); // 5.0 + 3.0
      expect(savings.aavePosition.supplyTransactions).toHaveLength(2);
    });

    it('should handle ERC20 token supply to Aave', async () => {
      const usdcAddress = '0x' + 'c'.repeat(40);

      // Update group to have USDC contributions
      const updatedGroup = await Group.findById(groupId);
      updatedGroup.paymentWindows[0].totalContributions = '1000.0';
      updatedGroup.paymentWindows[0].contributors[0].tokenAddress = usdcAddress;
      await updatedGroup.save();

      const response = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset: usdcAddress
        });

      expect(response.status).toBe(200);

      // Verify aaveService was called with token address
      expect(aaveService.supplyGroupPoolToAave).toHaveBeenCalledWith(
        group.address,
        usdcAddress,
        expect.any(BigInt)
      );
    });

    it('should return 400 if window is already completed', async () => {
      // Complete the window first
      await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Try to complete again
      const response = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should skip Aave supply if no contributions were made', async () => {
      // Update window to have zero contributions
      const updatedGroup = await Group.findById(groupId);
      updatedGroup.paymentWindows[0].totalContributions = '0';
      updatedGroup.paymentWindows[0].contributors = [];
      await updatedGroup.save();

      const response = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      expect(response.status).toBe(200);
      expect(response.body.data.window.isCompleted).toBe(true);

      // Aave service should not be called
      expect(aaveService.supplyGroupPoolToAave).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/savings/aave/yield?type=group - Get Aave Yield for Group Savings', () => {
    beforeEach(async () => {
      // Create group savings with Aave position
      await Savings.create({
        name: 'Group ETH Savings',
        type: 'group',
        owner: userId,  // Add required owner field
        group: groupId,
        currency: 'ETH',
        tokenAddress: null,
        targetAmount: '50',
        currentAmount: '10.0',
        aavePosition: {
          isSupplied: true,
          suppliedAmount: ethers.parseEther('10.0').toString(),
          aTokenBalance: ethers.parseEther('10.2').toString(),
          lastSupplyTimestamp: new Date(),
          supplyTransactions: [{
            amount: ethers.parseEther('10.0').toString(),
            timestamp: new Date(),
            transactionHash: '0x456',
            type: 'supply'
          }]
        }
      });
    });

    it('should return Aave yield information for group savings', async () => {
      const response = await request(app)
        .get('/api/savings/aave/yield?type=group')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.savings).toHaveLength(1);

      const savingsData = response.body.data.savings[0];
      expect(savingsData.type).toBe('group');
      expect(savingsData.currency).toBe('ETH');
      expect(savingsData.aavePosition).toBeDefined();
      expect(parseFloat(savingsData.aavePosition.suppliedAmount)).toBe(10.0);
      expect(parseFloat(savingsData.aavePosition.currentYield)).toBeGreaterThan(0);
    });

    it('should return empty array if no group Aave positions exist', async () => {
      await Savings.deleteMany({});

      const response = await request(app)
        .get('/api/savings/aave/yield?type=group')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.savings).toHaveLength(0);
    });
  });


});


  afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});
