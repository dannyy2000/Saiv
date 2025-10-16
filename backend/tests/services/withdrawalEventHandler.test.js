const withdrawalEventHandler = require('../../src/services/withdrawalEventHandler');
const Group = require('../../src/models/Group');
const User = require('../../src/models/User');

// Mock dependencies
jest.mock('ethers');
jest.mock('../../src/models/Group');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger');

const { ethers } = require('ethers');

describe('WithdrawalEventHandler', () => {
  let mockProvider;
  let mockContract;
  let mockGroup;
  let mockUser;

  beforeEach(() => {
    // Reset service state
    withdrawalEventHandler.provider = null;
    withdrawalEventHandler.eventListeners.clear();

    // Mock provider
    mockProvider = {
      getTransactionReceipt: jest.fn().mockResolvedValue({
        gasUsed: 150000n,
        logs: [
          {
            address: '0x123',
            topics: ['0xWithdrawnFromAave'],
            data: '0x456'
          }
        ]
      })
    };

    // Mock contract
    mockContract = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      queryFilter: jest.fn()
    };

    // Mock database models
    mockGroup = {
      _id: 'group123',
      address: '0x1234567890123456789012345678901234567890',
      groupStatus: 'active',
      automaticWithdrawal: {
        enabled: true,
        transactions: []
      },
      save: jest.fn().mockResolvedValue(true)
    };

    mockUser = {
      _id: 'user123',
      walletAddress: '0x9876543210987654321098765432109876543210'
    };

    // Setup ethers mocks
    ethers.JsonRpcProvider.mockReturnValue(mockProvider);
    ethers.Contract.mockReturnValue(mockContract);
    ethers.isAddress.mockReturnValue(true);
    ethers.ZeroAddress = '0x0000000000000000000000000000000000000000';
    ethers.Interface = jest.fn().mockReturnValue({
      parseLog: jest.fn().mockReturnValue({
        name: 'WithdrawnFromAave',
        args: { asset: ethers.ZeroAddress }
      })
    });

    // Setup database mocks
    Group.findOne.mockResolvedValue(mockGroup);
    User.findOne.mockResolvedValue(mockUser);

    // Setup environment variables
    process.env.RPC_URL = 'http://localhost:8545';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid RPC URL', async () => {
      const result = await withdrawalEventHandler.initialize();

      expect(result).toBe(true);
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(process.env.RPC_URL);
    });

    it('should fail initialization when RPC_URL is missing', async () => {
      delete process.env.RPC_URL;

      const result = await withdrawalEventHandler.initialize();

      expect(result).toBe(false);
    });

    it('should handle provider connection errors', async () => {
      ethers.JsonRpcProvider.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = await withdrawalEventHandler.initialize();

      expect(result).toBe(false);
    });
  });

  describe('event listening management', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should start listening for events on a group', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      const result = await withdrawalEventHandler.startListening(groupAddress);

      expect(result).toBe(true);
      expect(ethers.Contract).toHaveBeenCalledWith(
        groupAddress,
        expect.any(Array),
        mockProvider
      );
      expect(mockContract.on).toHaveBeenCalledTimes(4); // 4 event types
      expect(withdrawalEventHandler.eventListeners.has(groupAddress)).toBe(true);
    });

    it('should not start listening if already listening', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Set up existing listener
      withdrawalEventHandler.eventListeners.set(groupAddress, {
        contract: mockContract,
        listeners: {}
      });

      await withdrawalEventHandler.startListening(groupAddress);

      expect(ethers.Contract).not.toHaveBeenCalled();
    });

    it('should reject invalid group address', async () => {
      ethers.isAddress.mockReturnValue(false);

      const result = await withdrawalEventHandler.startListening('invalid-address');

      expect(result).toBe(false);
    });

    it('should stop listening for events', () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Set up existing listener
      withdrawalEventHandler.eventListeners.set(groupAddress, {
        contract: mockContract,
        listeners: {}
      });

      withdrawalEventHandler.stopListening(groupAddress);

      expect(mockContract.removeAllListeners).toHaveBeenCalled();
      expect(withdrawalEventHandler.eventListeners.has(groupAddress)).toBe(false);
    });

    it('should handle stopping non-existent listener', () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Should not throw error
      withdrawalEventHandler.stopListening(groupAddress);

      expect(mockContract.removeAllListeners).not.toHaveBeenCalled();
    });
  });

  describe('AutomaticWithdrawalProcessed event handling', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should handle AutomaticWithdrawalProcessed event correctly', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const totalAmount = ethers.parseEther('2.6');
      const principal = ethers.parseEther('2.5');
      const interest = ethers.parseEther('0.1');
      const systemFee = ethers.parseEther('0.003');
      const timestamp = Math.floor(Date.now() / 1000);

      const mockEvent = {
        transactionHash: '0xabc123',
        blockNumber: 12345
      };

      await withdrawalEventHandler.handleAutomaticWithdrawalEvent(
        groupAddress,
        totalAmount,
        principal,
        interest,
        systemFee,
        timestamp,
        mockEvent
      );

      expect(Group.findOne).toHaveBeenCalledWith({ address: groupAddress });
      expect(mockGroup.save).toHaveBeenCalled();
      expect(mockGroup.groupStatus).toBe('completed');
      expect(mockGroup.automaticWithdrawal.transactions).toHaveLength(1);

      const transaction = mockGroup.automaticWithdrawal.transactions[0];
      expect(transaction.transactionHash).toBe('0xabc123');
      expect(transaction.totalAmount).toBe(totalAmount.toString());
      expect(transaction.principal).toBe(principal.toString());
      expect(transaction.interest).toBe(interest.toString());
      expect(transaction.systemFee).toBe(systemFee.toString());
    });

    it('should handle missing group gracefully', async () => {
      Group.findOne.mockResolvedValue(null);

      const groupAddress = '0x1234567890123456789012345678901234567890';
      const mockEvent = { transactionHash: '0xabc123', blockNumber: 12345 };

      await withdrawalEventHandler.handleAutomaticWithdrawalEvent(
        groupAddress,
        ethers.parseEther('1'),
        ethers.parseEther('1'),
        ethers.parseEther('0'),
        ethers.parseEther('0'),
        Math.floor(Date.now() / 1000),
        mockEvent
      );

      expect(mockGroup.save).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockGroup.save.mockRejectedValue(new Error('Database error'));

      const groupAddress = '0x1234567890123456789012345678901234567890';
      const mockEvent = { transactionHash: '0xabc123', blockNumber: 12345 };

      // Should not throw
      await withdrawalEventHandler.handleAutomaticWithdrawalEvent(
        groupAddress,
        ethers.parseEther('1'),
        ethers.parseEther('1'),
        ethers.parseEther('0'),
        ethers.parseEther('0'),
        Math.floor(Date.now() / 1000),
        mockEvent
      );
    });
  });

  describe('MemberPayout event handling', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
      // Set up a withdrawal transaction
      mockGroup.automaticWithdrawal.transactions = [{
        transactionHash: '0xabc123',
        memberPayouts: []
      }];
    });

    it('should handle MemberPayout event correctly', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const memberAddress = '0x9876543210987654321098765432109876543210';
      const amount = ethers.parseEther('1.5');
      const contribution = ethers.parseEther('1');
      const timestamp = Math.floor(Date.now() / 1000);

      const mockEvent = {
        transactionHash: '0xabc123',
        blockNumber: 12345
      };

      await withdrawalEventHandler.handleMemberPayoutEvent(
        groupAddress,
        memberAddress,
        amount,
        contribution,
        timestamp,
        mockEvent
      );

      expect(User.findOne).toHaveBeenCalledWith({ walletAddress: memberAddress });
      expect(mockGroup.save).toHaveBeenCalled();

      const transaction = mockGroup.automaticWithdrawal.transactions[0];
      expect(transaction.memberPayouts).toHaveLength(1);

      const payout = transaction.memberPayouts[0];
      expect(payout.userId).toBe('user123');
      expect(payout.walletAddress).toBe(memberAddress);
      expect(payout.contribution).toBe(contribution.toString());
      expect(payout.payout).toBe(amount.toString());
    });

    it('should handle member not found in database', async () => {
      User.findOne.mockResolvedValue(null);

      const groupAddress = '0x1234567890123456789012345678901234567890';
      const memberAddress = '0x9876543210987654321098765432109876543210';
      const mockEvent = { transactionHash: '0xabc123', blockNumber: 12345 };

      await withdrawalEventHandler.handleMemberPayoutEvent(
        groupAddress,
        memberAddress,
        ethers.parseEther('1'),
        ethers.parseEther('1'),
        Math.floor(Date.now() / 1000),
        mockEvent
      );

      const transaction = mockGroup.automaticWithdrawal.transactions[0];
      const payout = transaction.memberPayouts[0];
      expect(payout.userId).toBe(null);
      expect(payout.walletAddress).toBe(memberAddress);
    });

    it('should handle transaction hash mismatch', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const mockEvent = { transactionHash: '0xdifferent', blockNumber: 12345 };

      await withdrawalEventHandler.handleMemberPayoutEvent(
        groupAddress,
        '0x9876543210987654321098765432109876543210',
        ethers.parseEther('1'),
        ethers.parseEther('1'),
        Math.floor(Date.now() / 1000),
        mockEvent
      );

      const transaction = mockGroup.automaticWithdrawal.transactions[0];
      expect(transaction.memberPayouts).toHaveLength(0); // No payout added
    });
  });

  describe('GroupCompleted event handling', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should handle GroupCompleted event correctly', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const timestamp = Math.floor(Date.now() / 1000);
      const mockEvent = { transactionHash: '0xabc123', blockNumber: 12345 };

      // Spy on stopListening method
      const stopListeningSpy = jest.spyOn(withdrawalEventHandler, 'stopListening');

      await withdrawalEventHandler.handleGroupCompletedEvent(
        groupAddress,
        timestamp,
        mockEvent
      );

      expect(mockGroup.groupStatus).toBe('completed');
      expect(mockGroup.isActive).toBe(false);
      expect(mockGroup.save).toHaveBeenCalled();
      expect(stopListeningSpy).toHaveBeenCalledWith(groupAddress);
    });
  });

  describe('past events processing', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should process past events in correct order', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Mock past events
      const withdrawalEvent = {
        eventName: 'AutomaticWithdrawalProcessed',
        blockNumber: 12345,
        logIndex: 1,
        args: [
          ethers.parseEther('1'),
          ethers.parseEther('1'),
          ethers.parseEther('0'),
          ethers.parseEther('0'),
          Math.floor(Date.now() / 1000)
        ]
      };

      const completedEvent = {
        eventName: 'GroupCompleted',
        blockNumber: 12345,
        logIndex: 2,
        args: [Math.floor(Date.now() / 1000)]
      };

      mockContract.queryFilter
        .mockResolvedValueOnce([withdrawalEvent]) // AutomaticWithdrawalProcessed
        .mockResolvedValueOnce([]) // MemberPayout
        .mockResolvedValueOnce([completedEvent]) // GroupCompleted
        .mockResolvedValueOnce([]); // WithdrawnFromAave

      mockProvider.getBlockNumber.mockResolvedValue(12350);

      // Spy on event handlers
      const withdrawalSpy = jest.spyOn(withdrawalEventHandler, 'handleAutomaticWithdrawalEvent');
      const completedSpy = jest.spyOn(withdrawalEventHandler, 'handleGroupCompletedEvent');

      await withdrawalEventHandler.processPastEvents(groupAddress, 12340);

      expect(mockContract.queryFilter).toHaveBeenCalledTimes(4);
      expect(withdrawalSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should handle empty past events', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      mockContract.queryFilter.mockResolvedValue([]);
      mockProvider.getBlockNumber.mockResolvedValue(12350);

      await withdrawalEventHandler.processPastEvents(groupAddress);

      expect(mockContract.queryFilter).toHaveBeenCalledTimes(4);
    });
  });

  describe('service status and management', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should return correct service status', () => {
      withdrawalEventHandler.eventListeners.set('group1', {});
      withdrawalEventHandler.eventListeners.set('group2', {});

      const status = withdrawalEventHandler.getStatus();

      expect(status.isInitialized).toBe(true);
      expect(status.listeningGroups).toEqual(['group1', 'group2']);
      expect(status.totalListeners).toBe(2);
    });

    it('should stop all listeners', () => {
      const stopSpy = jest.spyOn(withdrawalEventHandler, 'stopListening');

      withdrawalEventHandler.eventListeners.set('group1', {});
      withdrawalEventHandler.eventListeners.set('group2', {});

      withdrawalEventHandler.stopAll();

      expect(stopSpy).toHaveBeenCalledWith('group1');
      expect(stopSpy).toHaveBeenCalledWith('group2');
      expect(withdrawalEventHandler.isListening).toBe(false);
    });
  });

  describe('asset determination', () => {
    beforeEach(async () => {
      await withdrawalEventHandler.initialize();
    });

    it('should determine asset from transaction logs', async () => {
      const mockEvent = { transactionHash: '0xabc123' };

      const asset = await withdrawalEventHandler.determineAssetFromTransaction(mockEvent);

      expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith('0xabc123');
      expect(asset).toBe(ethers.ZeroAddress);
    });

    it('should default to ETH if asset not found', async () => {
      const mockEvent = { transactionHash: '0xabc123' };

      ethers.Interface.mockReturnValue({
        parseLog: jest.fn().mockImplementation(() => {
          throw new Error('Not our log');
        })
      });

      const asset = await withdrawalEventHandler.determineAssetFromTransaction(mockEvent);

      expect(asset).toBe(ethers.ZeroAddress);
    });
  });
});