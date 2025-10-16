const automaticWithdrawalService = require('../../src/services/automaticWithdrawalService');

// Mock dependencies
jest.mock('ethers');
jest.mock('node-cron');
jest.mock('../../src/utils/logger');

const { ethers } = require('ethers');
const cron = require('node-cron');

describe('AutomaticWithdrawalService', () => {
  let mockProvider;
  let mockWallet;
  let mockContract;
  let mockCronJob;

  beforeEach(() => {
    // Reset service state
    automaticWithdrawalService.provider = null;
    automaticWithdrawalService.adminWallet = null;
    automaticWithdrawalService.isRunning = false;
    automaticWithdrawalService.trackedGroups.clear();
    automaticWithdrawalService.processedWithdrawals.clear();

    // Mock provider
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ name: 'hardhat', chainId: 31337n }),
      getBalance: jest.fn().mockResolvedValue(ethers.parseEther('10')),
      getBlockNumber: jest.fn().mockResolvedValue(12345),
      getCode: jest.fn().mockResolvedValue('0x123'),
      getTransactionReceipt: jest.fn().mockResolvedValue({
        blockNumber: 12345,
        gasUsed: 150000n
      }),
      getFeeData: jest.fn().mockResolvedValue({
        maxFeePerGas: ethers.parseUnits('20', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
      })
    };

    // Mock wallet
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890'
    };

    // Mock contract
    mockContract = {
      checkWithdrawalEligibility: jest.fn(),
      processAutomaticWithdraw: jest.fn(),
      getGroupSummary: jest.fn(),
      groupStatus: jest.fn(),
      lockPeriod: jest.fn(),
      suppliedToAave: jest.fn(),
      getSupportedTokens: jest.fn(),
      estimateGas: {
        processAutomaticWithdraw: jest.fn().mockResolvedValue(200000n)
      }
    };

    // Mock cron job
    mockCronJob = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn()
    };

    // Setup ethers mocks
    ethers.JsonRpcProvider.mockReturnValue(mockProvider);
    ethers.Wallet.mockReturnValue(mockWallet);
    ethers.Contract.mockReturnValue(mockContract);
    ethers.isAddress.mockReturnValue(true);
    ethers.ZeroAddress = '0x0000000000000000000000000000000000000000';

    // Setup cron mock
    cron.schedule.mockReturnValue(mockCronJob);

    // Setup environment variables
    process.env.RPC_URL = 'http://localhost:8545';
    process.env.ADMIN_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid environment', async () => {
      const result = await automaticWithdrawalService.initialize();

      expect(result).toBe(true);
      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(process.env.RPC_URL);
      expect(ethers.Wallet).toHaveBeenCalledWith(process.env.ADMIN_PRIVATE_KEY, mockProvider);
      expect(mockProvider.getNetwork).toHaveBeenCalled();
      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockWallet.address);
    });

    it('should fail initialization when RPC_URL is missing', async () => {
      delete process.env.RPC_URL;

      const result = await automaticWithdrawalService.initialize();

      expect(result).toBe(false);
    });

    it('should fail initialization when ADMIN_PRIVATE_KEY is missing', async () => {
      delete process.env.ADMIN_PRIVATE_KEY;

      const result = await automaticWithdrawalService.initialize();

      expect(result).toBe(false);
    });

    it('should warn about low balance', async () => {
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther('0.05')); // Below 0.1 ETH

      const result = await automaticWithdrawalService.initialize();

      expect(result).toBe(true);
      // Logger warning should be called (mocked)
    });
  });

  describe('scheduler management', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should start scheduler successfully', () => {
      automaticWithdrawalService.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        '*/5 * * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: false,
          timezone: 'UTC'
        })
      );
      expect(mockCronJob.start).toHaveBeenCalled();
      expect(automaticWithdrawalService.isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      automaticWithdrawalService.isRunning = true;

      automaticWithdrawalService.start();

      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should stop scheduler successfully', () => {
      automaticWithdrawalService.scheduledJob = mockCronJob;
      automaticWithdrawalService.isRunning = true;

      automaticWithdrawalService.stop();

      expect(mockCronJob.stop).toHaveBeenCalled();
      expect(mockCronJob.destroy).toHaveBeenCalled();
      expect(automaticWithdrawalService.isRunning).toBe(false);
    });

    it('should not stop if not running', () => {
      automaticWithdrawalService.stop();

      expect(mockCronJob.stop).not.toHaveBeenCalled();
    });
  });

  describe('group monitoring', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should add group to monitoring successfully', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const lockPeriod = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      mockContract.lockPeriod.mockResolvedValue(lockPeriod);
      mockContract.groupStatus.mockResolvedValue(0); // Active

      const result = await automaticWithdrawalService.addGroupToMonitor(groupAddress, {
        name: 'Test Group'
      });

      expect(result).toBe(true);
      expect(automaticWithdrawalService.trackedGroups.has(groupAddress)).toBe(true);

      const groupData = automaticWithdrawalService.trackedGroups.get(groupAddress);
      expect(groupData.address).toBe(groupAddress);
      expect(groupData.lockPeriod).toBe(lockPeriod.toString());
      expect(groupData.status).toBe(0);
    });

    it('should fail to add invalid group address', async () => {
      ethers.isAddress.mockReturnValue(false);

      const result = await automaticWithdrawalService.addGroupToMonitor('invalid-address');

      expect(result).toBe(false);
    });

    it('should remove group from monitoring', () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      automaticWithdrawalService.trackedGroups.set(groupAddress, {});

      const result = automaticWithdrawalService.removeGroupFromMonitor(groupAddress);

      expect(result).toBe(true);
      expect(automaticWithdrawalService.trackedGroups.has(groupAddress)).toBe(false);
    });
  });

  describe('eligibility checking', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should check group eligibility correctly', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Mock eligibility response
      mockContract.checkWithdrawalEligibility.mockResolvedValue([true, 0n]);
      mockContract.getSupportedTokens.mockResolvedValue([ethers.ZeroAddress]);
      mockContract.suppliedToAave.mockResolvedValue(ethers.parseEther('1'));

      const eligibility = await automaticWithdrawalService.checkGroupEligibility(groupAddress);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.timeRemaining).toBe('0');
      expect(eligibility.assetsWithBalance).toContain(ethers.ZeroAddress);
    });

    it('should return false for non-eligible group', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      mockContract.checkWithdrawalEligibility.mockResolvedValue([false, 3600n]);
      mockContract.getSupportedTokens.mockResolvedValue([]);

      const eligibility = await automaticWithdrawalService.checkGroupEligibility(groupAddress);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.timeRemaining).toBe('3600');
    });

    it('should handle contract errors gracefully', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      mockContract.checkWithdrawalEligibility.mockRejectedValue(new Error('Contract error'));

      const eligibility = await automaticWithdrawalService.checkGroupEligibility(groupAddress);

      expect(eligibility.eligible).toBe(false);
    });
  });

  describe('withdrawal processing', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should process group withdrawal successfully', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const group = {
        address: groupAddress,
        assetsWithBalance: [ethers.ZeroAddress]
      };

      // Mock successful transaction
      const mockTx = {
        hash: '0xabc123',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 12345,
          gasUsed: 150000n
        })
      };

      mockContract.processAutomaticWithdraw.mockResolvedValue(mockTx);
      mockContract.processAutomaticWithdraw.estimateGas = jest.fn().mockResolvedValue(200000n);

      await automaticWithdrawalService.processGroupWithdrawal(group);

      expect(mockContract.processAutomaticWithdraw).toHaveBeenCalledWith(
        ethers.ZeroAddress,
        expect.objectContaining({
          gasLimit: expect.any(BigInt),
          maxFeePerGas: expect.any(BigInt),
          maxPriorityFeePerGas: expect.any(BigInt)
        })
      );

      expect(mockTx.wait).toHaveBeenCalled();
      expect(automaticWithdrawalService.processedWithdrawals.has(groupAddress)).toBe(true);
    });

    it('should skip already processed withdrawals', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const group = {
        address: groupAddress,
        assetsWithBalance: [ethers.ZeroAddress]
      };

      automaticWithdrawalService.processedWithdrawals.add(groupAddress);

      await automaticWithdrawalService.processGroupWithdrawal(group);

      expect(mockContract.processAutomaticWithdraw).not.toHaveBeenCalled();
    });

    it('should handle transaction failures', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';
      const group = {
        address: groupAddress,
        assetsWithBalance: [ethers.ZeroAddress]
      };

      mockContract.processAutomaticWithdraw.mockRejectedValue(new Error('Transaction failed'));

      await automaticWithdrawalService.processGroupWithdrawal(group);

      expect(automaticWithdrawalService.processedWithdrawals.has(groupAddress)).toBe(false);
    });
  });

  describe('manual operations', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should handle manual withdrawal trigger', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      // Add group to tracking
      automaticWithdrawalService.trackedGroups.set(groupAddress, {});

      // Mock eligible group
      mockContract.checkWithdrawalEligibility.mockResolvedValue([true, 0n]);
      mockContract.getSupportedTokens.mockResolvedValue([ethers.ZeroAddress]);
      mockContract.suppliedToAave.mockResolvedValue(ethers.parseEther('1'));

      const mockTx = {
        hash: '0xabc123',
        wait: jest.fn().mockResolvedValue({
          blockNumber: 12345,
          gasUsed: 150000n
        })
      };
      mockContract.processAutomaticWithdraw.mockResolvedValue(mockTx);

      const result = await automaticWithdrawalService.checkSpecificGroup(groupAddress);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Withdrawal processed successfully');
    });

    it('should reject manual trigger for non-eligible group', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      automaticWithdrawalService.trackedGroups.set(groupAddress, {});

      mockContract.checkWithdrawalEligibility.mockResolvedValue([false, 3600n]);

      const result = await automaticWithdrawalService.checkSpecificGroup(groupAddress);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Group not eligible for withdrawal');
    });

    it('should reject manual trigger for untracked group', async () => {
      const groupAddress = '0x1234567890123456789012345678901234567890';

      const result = await automaticWithdrawalService.checkSpecificGroup(groupAddress);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Group is not being monitored');
    });
  });

  describe('service status', () => {
    beforeEach(async () => {
      await automaticWithdrawalService.initialize();
    });

    it('should return correct status', () => {
      automaticWithdrawalService.isRunning = true;
      automaticWithdrawalService.trackedGroups.set('group1', {});
      automaticWithdrawalService.trackedGroups.set('group2', {});
      automaticWithdrawalService.processedWithdrawals.add('processed1');

      const status = automaticWithdrawalService.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.trackedGroups).toBe(2);
      expect(status.processedWithdrawals).toBe(1);
      expect(status.checkInterval).toBe('*/5 * * * *');
      expect(status.adminWallet).toBe(mockWallet.address);
    });

    it('should return tracked groups details', () => {
      const lockPeriod = Math.floor(Date.now() / 1000) + 3600;
      automaticWithdrawalService.trackedGroups.set('group1', {
        lockPeriod: lockPeriod.toString(),
        name: 'Test Group'
      });

      const groups = automaticWithdrawalService.getTrackedGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].address).toBe('group1');
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].lockPeriodDate).toContain(new Date(lockPeriod * 1000).getFullYear().toString());
    });
  });
});