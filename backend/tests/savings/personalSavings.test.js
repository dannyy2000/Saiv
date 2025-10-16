const request = require('supertest');
const { ethers } = require('ethers');

// Mock ethers Contract and providers BEFORE requiring app
jest.mock('ethers', () => {
  const actualEthers = jest.requireActual('ethers');

  // Create mock transaction response
  const createMockTx = (hash) => ({
    hash: hash || '0x' + Math.random().toString(16).substr(2, 64),
    wait: jest.fn().mockResolvedValue({
      status: 1,
      blockNumber: 12345,
      transactionHash: hash || '0x' + Math.random().toString(16).substr(2, 64)
    })
  });

  // Create mock contract instance
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
const Savings = require('../../src/models/Savings');
const MockContractHelpers = require('../helpers/mockContracts');
const { testUser, amounts } = require('../fixtures/testData');

const aaveService = require('../../src/services/aaveService');
const contractService = require('../../src/services/contractService');

// Set NODE_ENV to development to see error messages
process.env.NODE_ENV = 'development';
// Set required environment variables for ethers
process.env.ADMIN_PRIVATE_KEY = '0x' + '1'.repeat(64); // Valid private key format
process.env.RPC_URL = 'http://localhost:8545'; // Mock RPC URL

// Ensure aaveService and contractService have initialize method before app loads
aaveService.initialize = jest.fn().mockResolvedValue(true);
aaveService.isReady = jest.fn().mockReturnValue(true);
contractService.initialize = jest.fn().mockResolvedValue(undefined);

describe('Personal Savings with Aave Integration', () => {
  let authToken;
  let userId;
  let user;

  beforeAll(() => {
    // Setup mocks
    Object.assign(aaveService, MockContractHelpers.mockAaveService());
    Object.assign(contractService, MockContractHelpers.mockContractService());

    // Ensure initialize methods exist
    aaveService.initialize = jest.fn().mockResolvedValue(true);
    contractService.initialize = jest.fn().mockResolvedValue(undefined);
  });

  beforeEach(async () => {
    // Create test user
    user = await User.create({
      ...testUser,
      savings: []
    });
    userId = user._id;

    // Generate auth token (simplified - adjust based on your auth implementation)
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET);
  });

  describe('POST /api/savings/wallet/deposit - Deposit to Savings Wallet and Auto-Supply to Aave', () => {
    it('should deposit ETH to savings wallet and automatically supply to Aave', async () => {
      const depositAmount = '5.0';

      const response = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: depositAmount,
          asset: 'ETH'
        });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}. Body: ${JSON.stringify(response.body)}`);
      }
      // Test passed validation, remove debug code
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('supplied to Aave');

      // Check response data
      expect(response.body.data.savings).toBeDefined();
      expect(response.body.data.savings.currency).toBe('ETH');
      expect(response.body.data.savings.currentAmount).toBe(depositAmount);
      expect(response.body.data.savings.aavePosition).toBeDefined();
      expect(response.body.data.savings.aavePosition.isSupplied).toBe(true);
      expect(parseFloat(response.body.data.savings.aavePosition.suppliedAmount)).toBe(parseFloat(depositAmount));
      expect(parseFloat(response.body.data.savings.aavePosition.currentYield)).toBeGreaterThan(0);

      // Check transactions returned
      expect(response.body.data.transactions).toBeDefined();
      expect(response.body.data.transactions.transfer).toBeDefined();
      expect(response.body.data.transactions.aaveSupply).toBeDefined();

      // Verify aaveService was called correctly
      expect(aaveService.supplyPersonalSavingsToAave).toHaveBeenCalledWith(
        user.savingsAddress,
        ethers.ZeroAddress,
        ethers.parseEther(depositAmount)
      );
    });

    it('should create a new Savings record if none exists', async () => {
      const depositAmount = '3.0';

      await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: depositAmount,
          asset: 'ETH'
        });

      // Check database
      const savings = await Savings.findOne({
        owner: userId,
        type: 'personal',
        tokenAddress: null
      });

      expect(savings).toBeDefined();
      expect(savings.name).toContain('ETH Savings');
      expect(savings.currentAmount).toBe(depositAmount);
      expect(savings.aavePosition.isSupplied).toBe(true);
      expect(savings.aavePosition.suppliedAmount).toBe(ethers.parseEther(depositAmount).toString());
      expect(savings.aavePosition.supplyTransactions).toHaveLength(1);
      expect(savings.aavePosition.supplyTransactions[0].type).toBe('supply');
    });

    it('should update existing Savings record on subsequent deposits', async () => {
      const firstDeposit = '2.0';
      const secondDeposit = '3.0';

      // First deposit
      await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: firstDeposit, asset: 'ETH' });

      // Second deposit
      await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: secondDeposit, asset: 'ETH' });

      // Check database
      const savings = await Savings.findOne({
        owner: userId,
        type: 'personal',
        tokenAddress: null
      });

      expect(savings).toBeDefined();
      expect(parseFloat(savings.currentAmount)).toBe(
        parseFloat(firstDeposit) + parseFloat(secondDeposit)
      );
      expect(savings.aavePosition.supplyTransactions).toHaveLength(2);
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '-1.0',
          asset: 'ETH'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for zero amount', async () => {
      const response = await request(app)
        .post('/api/savings/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: '0',
          asset: 'ETH'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/savings/wallet/deposit')
        .send({
          amount: '5.0',
          asset: 'ETH'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/savings/aave/yield - Get Aave Yield Information', () => {
    beforeEach(async () => {
      // Create savings with Aave position
      await Savings.create({
        name: 'ETH Savings',
        type: 'personal',
        owner: userId,
        currency: 'ETH',
        tokenAddress: null,
        targetAmount: '10',
        currentAmount: '5.0',
        aavePosition: {
          isSupplied: true,
          suppliedAmount: ethers.parseEther('5.0').toString(),
          aTokenBalance: ethers.parseEther('5.1').toString(),
          lastSupplyTimestamp: new Date(),
          supplyTransactions: [{
            amount: ethers.parseEther('5.0').toString(),
            timestamp: new Date(),
            transactionHash: '0x123',
            type: 'supply'
          }]
        }
      });
    });

    it('should return Aave yield information for user savings', async () => {
      const response = await request(app)
        .get('/api/savings/aave/yield')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.savings).toHaveLength(1);

      const savingsData = response.body.data.savings[0];
      expect(savingsData.type).toBe('personal');
      expect(savingsData.currency).toBe('ETH');
      expect(savingsData.aavePosition).toBeDefined();
      expect(parseFloat(savingsData.aavePosition.suppliedAmount)).toBe(5.0);
      expect(parseFloat(savingsData.aavePosition.currentYield)).toBeGreaterThan(0);
      expect(parseFloat(savingsData.aavePosition.estimatedAPY)).toBeGreaterThanOrEqual(0);

      // Check summary
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalSavingsWithYield).toBe(1);
      expect(parseFloat(response.body.data.summary.totalYieldEarned)).toBeGreaterThan(0);
    });

    it('should filter by savings type', async () => {
      const response = await request(app)
        .get('/api/savings/aave/yield?type=personal')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.savings.every(s => s.type === 'personal')).toBe(true);
    });

    it('should return empty array if no Aave positions exist', async () => {
      // Clear all savings
      await Savings.deleteMany({});

      const response = await request(app)
        .get('/api/savings/aave/yield')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.savings).toHaveLength(0);
      expect(response.body.data.summary.totalSavingsWithYield).toBe(0);
    });
  });
});
