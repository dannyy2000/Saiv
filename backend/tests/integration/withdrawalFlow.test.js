const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../../server');
const Group = require('../../src/models/Group');
const User = require('../../src/models/User');
const withdrawalIntegrationService = require('../../src/services/withdrawalIntegrationService');

// Mock external services
jest.mock('../../src/services/automaticWithdrawalService');
jest.mock('../../src/services/withdrawalEventHandler');
jest.mock('../../src/utils/logger');

const automaticWithdrawalService = require('../../src/services/automaticWithdrawalService');
const withdrawalEventHandler = require('../../src/services/withdrawalEventHandler');

describe('Withdrawal Integration Flow', () => {
  let mongoServer;
  let testUser;
  let testGroup;
  let authToken;

  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await Group.deleteMany({});

    // Create test user
    testUser = await User.create({
      username: 'testuser',
      walletAddress: '0x1234567890123456789012345678901234567890',
      isActive: true
    });

    // Create test group
    testGroup = await Group.create({
      name: 'Test Group',
      description: 'A test group for withdrawal testing',
      address: '0x9876543210987654321098765432109876543210',
      owner: testUser._id,
      members: [{
        user: testUser._id,
        role: 'admin'
      }],
      paymentWindowDuration: 604800, // 7 days
      lockPeriod: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      groupStatus: 'active',
      automaticWithdrawal: {
        enabled: true,
        transactions: [],
        errors: []
      },
      poolSettings: {
        minContribution: 100000,
        maxMembers: 10
      }
    });

    // Mock auth token (simplified for testing)
    authToken = 'mock-jwt-token';

    // Reset service mocks
    jest.clearAllMocks();

    // Setup default service mocks
    automaticWithdrawalService.initialize.mockResolvedValue(true);
    automaticWithdrawalService.start.mockImplementation(() => {});
    automaticWithdrawalService.stop.mockImplementation(() => {});
    automaticWithdrawalService.addGroupToMonitor.mockResolvedValue(true);
    automaticWithdrawalService.removeGroupFromMonitor.mockReturnValue(true);
    automaticWithdrawalService.getStatus.mockReturnValue({
      isRunning: true,
      trackedGroups: 1,
      processedWithdrawals: 0,
      adminWallet: '0xadmin123'
    });
    automaticWithdrawalService.getTrackedGroups.mockReturnValue([{
      address: testGroup.address,
      name: testGroup.name,
      lockPeriod: testGroup.lockPeriod.getTime() / 1000
    }]);

    withdrawalEventHandler.initialize.mockResolvedValue(true);
    withdrawalEventHandler.startListening.mockResolvedValue(true);
    withdrawalEventHandler.stopListening.mockImplementation(() => {});
    withdrawalEventHandler.getStatus.mockReturnValue({
      isInitialized: true,
      listeningGroups: [testGroup.address],
      totalListeners: 1
    });

    // Mock auth middleware (simplified)
    jest.doMock('../../src/middleware/auth', () => ({
      authMiddleware: (req, res, next) => {
        req.user = testUser;
        next();
      }
    }));
  });

  describe('Service Status Endpoints', () => {
    it('should return withdrawal service status', async () => {
      const response = await request(app)
        .get('/api/withdrawal/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isRunning');
      expect(response.body.data).toHaveProperty('trackedGroups');
    });

    it('should return health check status', async () => {
      withdrawalIntegrationService.healthCheck = jest.fn().mockResolvedValue({
        healthy: true,
        issues: [],
        status: {
          isInitialized: true,
          isRunning: true
        }
      });

      const response = await request(app)
        .get('/api/withdrawal/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.healthy).toBe(true);
    });

    it('should return unhealthy status when service has issues', async () => {
      withdrawalIntegrationService.healthCheck = jest.fn().mockResolvedValue({
        healthy: false,
        issues: ['Service not running'],
        status: null
      });

      const response = await request(app)
        .get('/api/withdrawal/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.issues).toContain('Service not running');
    });
  });

  describe('Group Monitoring Management', () => {
    it('should add group to monitoring successfully', async () => {
      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/monitor`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group added to withdrawal monitoring');
      expect(response.body.data.address).toBe(testGroup.address);
      expect(automaticWithdrawalService.addGroupToMonitor).toHaveBeenCalledWith(
        expect.objectContaining({
          address: testGroup.address,
          name: testGroup.name
        })
      );
    });

    it('should reject monitoring request for non-existent group', async () => {
      const fakeGroupId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/withdrawal/groups/${fakeGroupId}/monitor`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Group not found');
    });

    it('should reject monitoring request from non-owner', async () => {
      // Create another user
      const otherUser = await User.create({
        username: 'otheruser',
        walletAddress: '0x9999999999999999999999999999999999999999',
        isActive: true
      });

      // Mock auth to return other user
      jest.doMock('../../src/middleware/auth', () => ({
        authMiddleware: (req, res, next) => {
          req.user = otherUser;
          next();
        }
      }));

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/monitor`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized to manage this group');
    });

    it('should remove group from monitoring successfully', async () => {
      const response = await request(app)
        .delete(`/api/withdrawal/groups/${testGroup._id}/monitor`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group removed from withdrawal monitoring');
      expect(automaticWithdrawalService.removeGroupFromMonitor).toHaveBeenCalledWith(testGroup.address);
    });

    it('should handle monitoring service failure gracefully', async () => {
      automaticWithdrawalService.addGroupToMonitor.mockResolvedValue(false);

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/monitor`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to add group to withdrawal monitoring');
    });
  });

  describe('Manual Withdrawal Triggers', () => {
    it('should trigger manual withdrawal successfully', async () => {
      automaticWithdrawalService.checkSpecificGroup.mockResolvedValue({
        success: true,
        message: 'Withdrawal processed successfully'
      });

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/trigger`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Withdrawal processed successfully');
      expect(automaticWithdrawalService.checkSpecificGroup).toHaveBeenCalledWith(testGroup.address);
    });

    it('should handle withdrawal failure', async () => {
      automaticWithdrawalService.checkSpecificGroup.mockResolvedValue({
        success: false,
        message: 'Group not eligible for withdrawal'
      });

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/trigger`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Group not eligible for withdrawal');
    });
  });

  describe('Withdrawal History', () => {
    beforeEach(async () => {
      // Add withdrawal history to test group
      testGroup.automaticWithdrawal.transactions = [{
        asset: '0x0000000000000000000000000000000000000000',
        transactionHash: '0xabc123def456',
        totalAmount: '2600000000000000000', // 2.6 ETH
        principal: '2500000000000000000', // 2.5 ETH
        interest: '100000000000000000', // 0.1 ETH
        systemFee: '3000000000000000', // 0.003 ETH
        distributedAmount: '2597000000000000000', // 2.597 ETH
        memberPayouts: [{
          userId: testUser._id,
          walletAddress: testUser.walletAddress,
          contribution: '1000000000000000000', // 1 ETH
          payout: '1038800000000000000', // 1.0388 ETH
          timestamp: new Date()
        }],
        blockNumber: 12345,
        gasUsed: '150000',
        timestamp: new Date()
      }];

      testGroup.groupStatus = 'completed';
      await testGroup.save();
    });

    it('should return group withdrawal history', async () => {
      const response = await request(app)
        .get(`/api/withdrawal/groups/${testGroup._id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe(testGroup.address);
      expect(response.body.data.groupStatus).toBe('completed');
      expect(response.body.data.automaticWithdrawal.transactions).toHaveLength(1);

      const transaction = response.body.data.automaticWithdrawal.transactions[0];
      expect(transaction.transactionHash).toBe('0xabc123def456');
      expect(transaction.totalAmount).toBe('2600000000000000000');
      expect(transaction.memberPayouts).toHaveLength(1);
    });

    it('should populate member payout user information', async () => {
      const response = await request(app)
        .get(`/api/withdrawal/groups/${testGroup._id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const payout = response.body.data.automaticWithdrawal.transactions[0].memberPayouts[0];
      expect(payout.walletAddress).toBe(testUser.walletAddress);
    });
  });

  describe('Event Synchronization', () => {
    it('should sync group events from blockchain', async () => {
      withdrawalIntegrationService.syncGroupEvents = jest.fn().mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/sync`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fromBlock: 12000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group events synced successfully');
      expect(withdrawalIntegrationService.syncGroupEvents).toHaveBeenCalledWith(
        testGroup.address,
        12000
      );
    });

    it('should handle sync failure', async () => {
      withdrawalIntegrationService.syncGroupEvents = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/sync`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fromBlock: 12000 })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to sync group events');
    });

    it('should default fromBlock to 0 if not provided', async () => {
      withdrawalIntegrationService.syncGroupEvents = jest.fn().mockResolvedValue(true);

      await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/sync`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(withdrawalIntegrationService.syncGroupEvents).toHaveBeenCalledWith(
        testGroup.address,
        0
      );
    });
  });

  describe('Service Control', () => {
    it('should start withdrawal service', async () => {
      withdrawalIntegrationService.start = jest.fn().mockResolvedValue();

      const response = await request(app)
        .post('/api/withdrawal/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Withdrawal service started successfully');
      expect(withdrawalIntegrationService.start).toHaveBeenCalled();
    });

    it('should handle service start failure', async () => {
      withdrawalIntegrationService.start = jest.fn().mockRejectedValue(new Error('Start failed'));

      const response = await request(app)
        .post('/api/withdrawal/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to start withdrawal service');
    });

    it('should stop withdrawal service', async () => {
      withdrawalIntegrationService.stop = jest.fn();

      const response = await request(app)
        .post('/api/withdrawal/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Withdrawal service stopped successfully');
      expect(withdrawalIntegrationService.stop).toHaveBeenCalled();
    });
  });

  describe('Monitored Groups Listing', () => {
    it('should return list of monitored groups', async () => {
      const response = await request(app)
        .get('/api/withdrawal/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.groups[0].address).toBe(testGroup.address);
    });

    it('should return empty list when no groups monitored', async () => {
      automaticWithdrawalService.getTrackedGroups.mockReturnValue([]);

      const response = await request(app)
        .get('/api/withdrawal/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      // Test without auth token
      await request(app)
        .get('/api/withdrawal/status')
        .expect(401);

      await request(app)
        .post(`/api/withdrawal/groups/${testGroup._id}/monitor`)
        .expect(401);

      await request(app)
        .get(`/api/withdrawal/groups/${testGroup._id}/history`)
        .expect(401);
    });

    it('should allow access for group members', async () => {
      // Add another member to the group
      const memberUser = await User.create({
        username: 'memberuser',
        walletAddress: '0x8888888888888888888888888888888888888888',
        isActive: true
      });

      testGroup.members.push({
        user: memberUser._id,
        role: 'member'
      });
      await testGroup.save();

      // Mock auth to return member user
      jest.doMock('../../src/middleware/auth', () => ({
        authMiddleware: (req, res, next) => {
          req.user = memberUser;
          next();
        }
      }));

      const response = await request(app)
        .get(`/api/withdrawal/groups/${testGroup._id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Temporarily close database connection
      await mongoose.disconnect();

      const response = await request(app)
        .get(`/api/withdrawal/groups/${testGroup._id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });

    it('should handle service initialization failures', async () => {
      automaticWithdrawalService.initialize.mockResolvedValue(false);

      withdrawalIntegrationService.initialize = jest.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/withdrawal/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .get('/api/withdrawal/groups/invalid-id/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});