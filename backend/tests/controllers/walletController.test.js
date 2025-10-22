const walletController = require('../../src/controllers/walletController');
const contractService = require('../../src/services/contractService');
const User = require('../../src/models/User');

// Mock dependencies
jest.mock('../../src/services/contractService');
jest.mock('../../src/models/User');

describe('WalletController', () => {
  let mockUser;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockUser = {
      _id: 'user123',
      address: '0x1234567890123456789012345678901234567890',
      savingsAddress: '0x0987654321098765432109876543210987654321',
      balance: '100'
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

  describe('getWalletBalance', () => {
    it('should return wallet balances successfully', async () => {
      User.findById.mockResolvedValue(mockUser);
      contractService.getWalletBalance
        .mockResolvedValueOnce('1.5') // main wallet ETH
        .mockResolvedValueOnce('2.0'); // savings wallet ETH

      await walletController.getWalletBalance(mockReq, mockRes);

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(contractService.getWalletBalance).toHaveBeenCalledTimes(2);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          mainWallet: {
            address: mockUser.address,
            ethBalance: '1.5'
          },
          savingsWallet: {
            address: mockUser.savingsAddress,
            ethBalance: '2.0'
          },
          databaseBalance: mockUser.balance
        }
      });
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await walletController.getWalletBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle service errors gracefully', async () => {
      User.findById.mockResolvedValue(mockUser);
      contractService.getWalletBalance.mockRejectedValue(new Error('RPC Error'));

      await walletController.getWalletBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getTokenBalance', () => {
    it('should return token balance successfully', async () => {
      mockReq.query = { tokenAddress: '0xtoken123' };
      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.getWalletTokenBalance.mockResolvedValue('100.5');

      await walletController.getTokenBalance(mockReq, mockRes);

      expect(contractService.getWalletTokenBalance).toHaveBeenCalledWith(
        mockUser.address,
        '0xtoken123'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          walletAddress: mockUser.address,
          walletType: 'main',
          tokenAddress: '0xtoken123',
          balance: '100.5'
        }
      });
    });

    it('should return 400 if token address is missing', async () => {
      mockReq.query = {};

      await walletController.getTokenBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token address is required'
      });
    });

    it('should return 400 for invalid token address', async () => {
      mockReq.query = { tokenAddress: 'invalid-address' };
      contractService.validateAddress.mockReturnValue(false);

      await walletController.getTokenBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token address'
      });
    });
  });

  describe('withdrawEth', () => {
    it('should process ETH withdrawal successfully', async () => {
      mockReq.body = {
        toAddress: '0xrecipient123',
        amount: '1.0'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.callWalletFunction.mockResolvedValue({
        transactionHash: '0xtxhash123'
      });

      await walletController.withdrawEth(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'withdrawEth',
        ['0xrecipient123', 1000000000000000000n]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'ETH withdrawal successful',
        data: {
          transactionHash: '0xtxhash123',
          fromWallet: mockUser.address,
          toAddress: '0xrecipient123',
          amount: '1.0',
          walletType: 'main'
        }
      });
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing required fields

      await walletController.withdrawEth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Recipient address and amount are required'
      });
    });

    it('should validate invalid address', async () => {
      mockReq.body = {
        toAddress: 'invalid-address',
        amount: '1.0'
      };

      contractService.validateAddress.mockReturnValue(false);

      await walletController.withdrawEth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid recipient address'
      });
    });
  });

  describe('withdrawToken', () => {
    it('should process token withdrawal successfully', async () => {
      mockReq.body = {
        tokenAddress: '0xtoken123',
        toAddress: '0xrecipient123',
        amount: '50.0'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.callWalletFunction.mockResolvedValue({
        transactionHash: '0xtxhash456'
      });

      await walletController.withdrawToken(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'withdrawToken',
        ['0xtoken123', '0xrecipient123', '50.0']
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing required fields

      await walletController.withdrawToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token address, recipient address, and amount are required'
      });
    });
  });

  describe('sendEth', () => {
    it('should send ETH successfully', async () => {
      mockReq.body = {
        toAddress: '0xrecipient123',
        amount: '0.5'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.callWalletFunction.mockResolvedValue({
        transactionHash: '0xtxhash789'
      });

      await walletController.sendEth(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'sendEth',
        ['0xrecipient123', 500000000000000000n]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing required fields

      await walletController.sendEth(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Recipient address and amount are required'
      });
    });
  });

  describe('addSupportedToken', () => {
    it('should add supported token successfully', async () => {
      mockReq.body = {
        tokenAddress: '0xtoken123'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.addSupportedToken
        .mockResolvedValueOnce({ transactionHash: '0xtxhash101' }) // main wallet
        .mockResolvedValueOnce({ transactionHash: '0xtxhash102' }); // savings wallet

      await walletController.addSupportedToken(mockReq, mockRes);

      expect(contractService.addSupportedToken).toHaveBeenCalledTimes(2);
      expect(contractService.addSupportedToken).toHaveBeenCalledWith(
        mockUser.address,
        '0xtoken123'
      );
      expect(contractService.addSupportedToken).toHaveBeenCalledWith(
        mockUser.savingsAddress,
        '0xtoken123'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate required fields', async () => {
      mockReq.body = {}; // missing tokenAddress

      await walletController.addSupportedToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token address is required'
      });
    });
  });

  describe('getSupportedTokens', () => {
    it('should return supported tokens successfully', async () => {
      User.findById.mockResolvedValue(mockUser);
      contractService.callWalletFunction.mockResolvedValue({
        result: ['0xtoken123', '0xtoken456']
      });

      await walletController.getSupportedTokens(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'getSupportedTokens'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          walletAddress: mockUser.address,
          walletType: 'main',
          supportedTokens: ['0xtoken123', '0xtoken456']
        }
      });
    });
  });

  describe('transferBetweenWallets', () => {
    it('should transfer ETH between wallets successfully', async () => {
      mockReq.body = {
        fromWallet: 'main',
        toWallet: 'savings',
        amount: '2.0'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.callWalletFunction.mockResolvedValue({
        transactionHash: '0xtxhash202'
      });

      await walletController.transferBetweenWallets(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'sendEth',
        [mockUser.savingsAddress, 2000000000000000000n]
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should transfer token between wallets successfully', async () => {
      mockReq.body = {
        tokenAddress: '0xtoken123',
        fromWallet: 'main',
        toWallet: 'savings',
        amount: '50.0'
      };

      User.findById.mockResolvedValue(mockUser);
      contractService.validateAddress.mockReturnValue(true);
      contractService.callWalletFunction.mockResolvedValue({
        transactionHash: '0xtxhash203'
      });

      await walletController.transferBetweenWallets(mockReq, mockRes);

      expect(contractService.callWalletFunction).toHaveBeenCalledWith(
        mockUser.address,
        'transferToWallet',
        ['0xtoken123', mockUser.savingsAddress, '50.0']
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate required amount', async () => {
      mockReq.body = {}; // missing amount

      await walletController.transferBetweenWallets(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Amount is required'
      });
    });

    it('should prevent transfer to same wallet', async () => {
      mockReq.body = {
        fromWallet: 'main',
        toWallet: 'main',
        amount: '1.0'
      };

      User.findById.mockResolvedValue(mockUser);

      await walletController.transferBetweenWallets(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot transfer to the same wallet'
      });
    });
  });
});