const request = require('supertest');
const { ethers } = require('ethers');

// Mock ethers Contract and providers BEFORE requiring app
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers');
  const createMockTx = (hash) => ({
    hash: hash || '0x' + Math.random().toString(16).substr(2, 64),
    wait: jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 12345,
      transactionHash: hash || '0x' + Math.random().toString(16).substr(2, 64)
    })
  });
  const mockContractInstance = {
    sendEth: jest.fn().mockImplementation(() => Promise.resolve(createMockTx('0x123'))),
    transferToWallet: jest.fn().mockImplementation(() => Promise.resolve(createMockTx('0x456')))
  };
  return {
    ...actualEthers,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
    Wallet: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn().mockImplementation(() => mockContractInstance)
  };
});

// Mock the services
jest.mock('../../src/services/aaveService');
jest.mock('../../src/services/contractService');

const app = require('../../src/app');
const User = require('../../src/models/User');
const Group = require('../../src/models/Group');
const Savings = require('../../src/models/Savings');
const MockContractHelpers = require('../helpers/mockContracts');
const { testUser, testUser2, testGroup } = require('../fixtures/testData');

const aaveService = require('../../src/services/aaveService');
const contractService = require('../../src/services/contractService');

// Set NODE_ENV and required environment variables
process.env.NODE_ENV = 'development';
process.env.ADMIN_PRIVATE_KEY = '0x' + '1'.repeat(64);
process.env.RPC_URL = 'http://localhost:8545';

describe('Integration: Complete Savings Flow with Aave', () => {
  let authToken;
  let userId;
  let user;

  beforeAll(() => {
    // Setup mocks
    Object.assign(aaveService, MockContractHelpers.mockAaveService());
    Object.assign(contractService, MockContractHelpers.mockContractService());
  });

  beforeEach(async () => {
    // Create test user
    user = await User.create({
      ...testUser,
      savings: []
    });
    userId = user._id;

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET);
  });

  describe('End-to-End Personal Savings Flow', () => {
    it('should complete full personal savings flow: deposit → transfer → Aave supply → yield tracking', async () => {
      const depositAmount = '5.0';

      // Step 1: Deposit to savings wallet
      const depositResponse = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: depositAmount,
          asset: 'ETH'
        });

      expect(depositResponse.status).toBe(200);
      expect(depositResponse.body.success).toBe(true);

      // Verify transfer transaction occurred
      expect(depositResponse.body.data.transactions.transfer).toBeDefined();

      // Verify Aave supply transaction occurred
      expect(depositResponse.body.data.transactions.aaveSupply).toBeDefined();

      // Verify Savings record was created with Aave position
      const savings = depositResponse.body.data.savings;
      expect(savings.type).toBe('personal');
      expect(savings.currentAmount).toBe(depositAmount);
      expect(savings.aavePosition.isSupplied).toBe(true);
      expect(parseFloat(savings.aavePosition.suppliedAmount)).toBe(parseFloat(depositAmount));

      // Step 2: Check that aaveService was called correctly
      expect(aaveService.supplyPersonalSavingsToAave).toHaveBeenCalledWith(
        user.savingsAddress,
        ethers.ZeroAddress,
        ethers.parseEther(depositAmount)
      );

      // Step 3: Make another deposit to test accumulation
      const secondDeposit = '3.0';
      const secondResponse = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: secondDeposit,
          asset: 'ETH'
        });

      expect(secondResponse.status).toBe(200);
      expect(parseFloat(secondResponse.body.data.savings.currentAmount)).toBe(
        parseFloat(depositAmount) + parseFloat(secondDeposit)
      );

      // Step 4: Get Aave yield information
      const yieldResponse = await request(app)
        .get('/api/savings/aave/yield?type=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(yieldResponse.status).toBe(200);
      expect(yieldResponse.body.data.savings).toHaveLength(1);

      const yieldData = yieldResponse.body.data.savings[0];
      expect(yieldData.type).toBe('personal');
      expect(parseFloat(yieldData.aavePosition.currentYield)).toBeGreaterThan(0);
      expect(yieldData.aavePosition.supplyTransactions).toHaveLength(2);

      // Step 5: Verify database state
      const dbSavings = await Savings.findOne({
        owner: userId,
        type: 'personal',
        tokenAddress: null
      });

      expect(dbSavings).toBeDefined();
      expect(parseFloat(dbSavings.currentAmount)).toBe(8.0); // 5.0 + 3.0
      expect(dbSavings.aavePosition.isSupplied).toBe(true);
      expect(dbSavings.aavePosition.supplyTransactions).toHaveLength(2);
    });

    it('should complete full personal savings flow with ERC20 token (USDC)', async () => {
      const usdcAddress = '0x' + 'c'.repeat(40);
      const depositAmount = '1000.0'; // 1000 USDC

      // Deposit USDC to savings wallet
      const depositResponse = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: depositAmount,
          asset: usdcAddress
        });

      expect(depositResponse.status).toBe(200);
      expect(depositResponse.body.success).toBe(true);

      // Verify Aave supply was called with USDC address
      expect(aaveService.supplyPersonalSavingsToAave).toHaveBeenCalledWith(
        user.savingsAddress,
        usdcAddress,
        expect.any(BigInt)
      );

      // Verify Savings record has correct token address
      const savings = depositResponse.body.data.savings;
      expect(savings.tokenAddress).toBe(usdcAddress);
      expect(savings.currency).not.toBe('ETH');

      // Get yield information
      const yieldResponse = await request(app)
        .get('/api/savings/aave/yield?type=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(yieldResponse.status).toBe(200);
      const yieldData = yieldResponse.body.data.savings[0];
      expect(yieldData.tokenAddress).toBe(usdcAddress);
      expect(parseFloat(yieldData.aavePosition.currentYield)).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Group Savings Flow', () => {
    let groupId;
    let group;
    let member2Token;

    beforeEach(async () => {
      // Create a second user
      const user2 = await User.create({
        ...testUser2,
        savings: []
      });

      const jwt = require('jsonwebtoken');
      member2Token = jwt.sign({ userId: user2._id.toString() }, process.env.JWT_SECRET);

      // Create test group with both users as members
      group = await Group.create({
        ...testGroup,
        owner: userId,
        members: [
          { user: userId, role: 'admin', joinedAt: new Date() },
          { user: user2._id, role: 'member', joinedAt: new Date() }
        ],
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

    it('should complete full group savings flow: contributions → window completion → Aave supply → yield tracking', async () => {
      // Step 1: First member contributes
      const contribution1 = '2.0';
      const contrib1Response = await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: contribution1 });

      expect(contrib1Response.status).toBe(200);
      expect(contrib1Response.body.success).toBe(true);

      // Step 2: Second member contributes
      const contribution2 = '3.0';
      const contrib2Response = await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${member2Token}`)
        .send({ amount: contribution2 });

      expect(contrib2Response.status).toBe(200);

      // Verify both contributions are recorded
      const groupAfterContribs = await Group.findById(groupId);
      const window = groupAfterContribs.paymentWindows[0];

      expect(parseFloat(window.totalContributions)).toBe(
        parseFloat(contribution1) + parseFloat(contribution2)
      );
      expect(window.contributors).toHaveLength(2);

      // Step 3: Complete payment window (triggers Aave supply)
      const completeResponse = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.success).toBe(true);

      // Verify window is completed
      expect(completeResponse.body.data.window.isCompleted).toBe(true);
      expect(completeResponse.body.data.window.isActive).toBe(false);

      // Verify Aave supply occurred
      expect(completeResponse.body.data.aaveSupply).toBeDefined();
      expect(completeResponse.body.data.aaveSupply.success).toBe(true);

      // Verify aaveService was called with total contributions
      expect(aaveService.supplyGroupPoolToAave).toHaveBeenCalledWith(
        group.address,
        ethers.ZeroAddress,
        ethers.parseEther('5.0') // 2.0 + 3.0
      );

      // Step 4: Verify Savings record was created/updated
      const dbSavings = await Savings.findOne({
        group: groupId,
        type: 'group',
        tokenAddress: null
      });

      expect(dbSavings).toBeDefined();
      expect(parseFloat(dbSavings.currentAmount)).toBe(5.0);
      expect(dbSavings.aavePosition.isSupplied).toBe(true);
      expect(dbSavings.aavePosition.suppliedAmount).toBe(ethers.parseEther('5.0').toString());

      // Step 5: Get Aave yield information for group
      const yieldResponse = await request(app)
        .get('/api/savings/aave/yield?type=group')
        .set('Authorization', `Bearer ${authToken}`);

      expect(yieldResponse.status).toBe(200);
      expect(yieldResponse.body.data.savings).toHaveLength(1);

      const yieldData = yieldResponse.body.data.savings[0];
      expect(yieldData.type).toBe('group');
      expect(parseFloat(yieldData.aavePosition.currentYield)).toBeGreaterThan(0);
      expect(parseFloat(yieldData.aavePosition.estimatedAPY)).toBeGreaterThanOrEqual(0);
    });

    it('should complete full group savings flow with multiple payment windows', async () => {
      // Window 1: Contribute and complete
      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '2.0' });

      const window1Complete = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      expect(window1Complete.status).toBe(200);

      // Add Window 2
      const groupWithWindow2 = await Group.findById(groupId);
      groupWithWindow2.paymentWindows.push({
        windowNumber: 2,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        isActive: true,
        isCompleted: false,
        totalContributions: '0',
        contributors: []
      });
      await groupWithWindow2.save();

      // Window 2: Contribute and complete
      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '3.0' });

      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${member2Token}`)
        .send({ amount: '2.0' });

      const window2Complete = await request(app)
        .post(`/api/groups/${groupId}/windows/2/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      expect(window2Complete.status).toBe(200);

      // Verify total savings accumulated
      const dbSavings = await Savings.findOne({
        group: groupId,
        type: 'group',
        tokenAddress: null
      });

      expect(dbSavings).toBeDefined();
      expect(parseFloat(dbSavings.currentAmount)).toBe(7.0); // 2.0 + 3.0 + 2.0
      expect(dbSavings.aavePosition.supplyTransactions).toHaveLength(2);

      // Verify both supplies to Aave occurred
      expect(aaveService.supplyGroupPoolToAave).toHaveBeenCalledTimes(2);
    });

    it('should complete full group savings flow with ERC20 token (USDC)', async () => {
      const usdcAddress = '0x' + 'c'.repeat(40);

      // Contribute USDC
      const contribution = '500.0';
      await request(app)
        .post(`/api/groups/${groupId}/contribute-token`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tokenAddress: usdcAddress,
          amount: contribution
        });

      // Complete window
      const completeResponse = await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: usdcAddress });

      expect(completeResponse.status).toBe(200);

      // Verify Aave supply was called with USDC
      expect(aaveService.supplyGroupPoolToAave).toHaveBeenCalledWith(
        group.address,
        usdcAddress,
        expect.any(BigInt)
      );

      // Verify Savings record has correct token
      const dbSavings = await Savings.findOne({
        group: groupId,
        type: 'group'
      });

      expect(dbSavings.tokenAddress).toBe(usdcAddress);
    });
  });

  describe('Mixed Personal and Group Savings Flow', () => {
    let groupId;

    beforeEach(async () => {
      // Create group
      const group = await Group.create({
        ...testGroup,
        owner: userId,
        members: [
          { user: userId, role: 'admin', joinedAt: new Date() }
        ],
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

    it('should handle both personal and group savings with Aave yield tracking', async () => {
      // Personal savings deposit
      await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '5.0',
          asset: 'ETH'
        });

      // Group contribution and completion
      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '3.0' });

      await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Get all Aave yield information (both personal and group)
      const yieldResponse = await request(app)
        .get('/api/savings/aave/yield')
        .set('Authorization', `Bearer ${authToken}`);

      expect(yieldResponse.status).toBe(200);
      expect(yieldResponse.body.data.savings).toHaveLength(2);

      // Verify both types are present
      const types = yieldResponse.body.data.savings.map(s => s.type);
      expect(types).toContain('personal');
      expect(types).toContain('group');

      // Verify summary data
      const summary = yieldResponse.body.data.summary;
      expect(summary.totalSavingsWithYield).toBe(2);
      expect(parseFloat(summary.totalYieldEarned)).toBeGreaterThan(0);

      // Verify both have Aave positions
      yieldResponse.body.data.savings.forEach(savings => {
        expect(savings.aavePosition).toBeDefined();
        expect(savings.aavePosition.isSupplied).toBe(true);
        expect(parseFloat(savings.aavePosition.currentYield)).toBeGreaterThan(0);
      });
    });

    it('should correctly filter yield by type (personal vs group)', async () => {
      // Create both personal and group savings
      await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '5.0', asset: 'ETH' });

      await request(app)
        .post(`/api/groups/${groupId}/contribute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: '3.0' });

      await request(app)
        .post(`/api/groups/${groupId}/windows/1/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ asset: 'ETH' });

      // Get only personal savings yield
      const personalResponse = await request(app)
        .get('/api/savings/aave/yield?type=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(personalResponse.status).toBe(200);
      expect(personalResponse.body.data.savings).toHaveLength(1);
      expect(personalResponse.body.data.savings[0].type).toBe('personal');

      // Get only group savings yield
      const groupResponse = await request(app)
        .get('/api/savings/aave/yield?type=group')
        .set('Authorization', `Bearer ${authToken}`);

      expect(groupResponse.status).toBe(200);
      expect(groupResponse.body.data.savings).toHaveLength(1);
      expect(groupResponse.body.data.savings[0].type).toBe('group');
    });
  });
});
