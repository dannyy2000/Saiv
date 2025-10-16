const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const authController = require('../../src/controllers/authController');
const User = require('../../src/models/User');
const contractService = require('../../src/services/contractService');
const gaslessService = require('../../src/services/gaslessService');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('ethers');
jest.mock('../../src/models/User');
jest.mock('../../src/services/contractService');
jest.mock('../../src/services/gaslessService');

describe('AuthController', () => {
  let mockUser;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    // Mock user object
    mockUser = {
      _id: 'mockUserId',
      email: 'test@example.com',
      address: '0x1234567890123456789012345678901234567890',
      savingsAddress: '0x0987654321098765432109876543210987654321',
      balance: '100',
      registrationType: 'email',
      profile: { name: 'test' },
      lastLogin: new Date(),
      save: jest.fn().mockResolvedValue(true)
    };

    mockReq = {
      body: {},
      user: { userId: 'mockUserId' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('registerWithEmail', () => {
    it('should register new user with email successfully', async () => {
      const mockWallets = {
        mainWallet: '0x1234567890123456789012345678901234567890',
        savingsWallet: '0x0987654321098765432109876543210987654321'
      };

      mockReq.body = { email: 'test@example.com' };

      User.findOne.mockResolvedValue(null);
      gaslessService.isReady.mockReturnValue(true);
      gaslessService.createEmailUserWalletsGasless.mockResolvedValue(mockWallets);
      ethers.Wallet.createRandom.mockReturnValue({ address: '0xtemp123' });

      const mockUserInstance = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true)
      };
      User.mockImplementation(() => mockUserInstance);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithEmail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully with email',
        data: expect.objectContaining({
          user: expect.any(Object),
          token: 'mock-jwt-token'
        })
      });
      expect(gaslessService.createEmailUserWalletsGasless).toHaveBeenCalled();
    });

    it('should login existing user', async () => {
      mockReq.body = { email: 'test@example.com' };

      User.findOne.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithEmail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User logged in successfully',
        data: expect.objectContaining({
          token: 'mock-jwt-token'
        })
      });
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should use fallback when gasless service not ready', async () => {
      const mockWallets = {
        mainWallet: '0x1234567890123456789012345678901234567890',
        savingsWallet: '0x0987654321098765432109876543210987654321'
      };

      mockReq.body = { email: 'test@example.com' };

      User.findOne.mockResolvedValue(null);
      gaslessService.isReady.mockReturnValue(false);
      ethers.keccak256.mockReturnValue('0xhashed');
      ethers.toUtf8Bytes.mockReturnValue('bytes');
      ethers.Wallet.createRandom.mockReturnValue({ address: '0xtemp123' });
      contractService.createEmailUserWallets.mockResolvedValue(mockWallets);

      const mockUserInstance = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true)
      };
      User.mockImplementation(() => mockUserInstance);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithEmail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(contractService.createEmailUserWallets).toHaveBeenCalled();
    });

    it('should return 400 if email is missing', async () => {
      mockReq.body = {};

      await authController.registerWithEmail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    it('should handle registration errors', async () => {
      mockReq.body = { email: 'test@example.com' };

      User.findOne.mockRejectedValue(new Error('Database error'));

      await authController.registerWithEmail(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Registration failed'
      });
    });
  });

  describe('registerWithWallet', () => {
    const mockEOAAddress = '0x1234567890123456789012345678901234567890';

    it('should register new user with wallet successfully', async () => {
      const mockWallets = {
        mainWallet: '0x1234567890123456789012345678901234567890',
        savingsWallet: '0x0987654321098765432109876543210987654321'
      };

      mockReq.body = { eoaAddress: mockEOAAddress };

      User.findOne.mockResolvedValue(null);
      contractService.validateAddress.mockReturnValue(true);
      gaslessService.isReady.mockReturnValue(true);
      gaslessService.createEOAUserWalletsGasless = jest.fn().mockResolvedValue(mockWallets);

      const mockUserInstance = {
        ...mockUser,
        eoaAddress: mockEOAAddress,
        save: jest.fn().mockResolvedValue(true)
      };
      User.mockImplementation(() => mockUserInstance);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithWallet(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully with wallet',
        data: expect.objectContaining({
          token: 'mock-jwt-token'
        })
      });
    });

    it('should login existing wallet user', async () => {
      mockReq.body = { eoaAddress: mockEOAAddress };

      User.findOne.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithWallet(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User logged in successfully',
        data: expect.objectContaining({
          token: 'mock-jwt-token'
        })
      });
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 400 if EOA address is missing', async () => {
      mockReq.body = {};

      await authController.registerWithWallet(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'EOA address is required'
      });
    });

    it('should return 400 for invalid EOA address', async () => {
      mockReq.body = { eoaAddress: 'invalid-address' };

      contractService.validateAddress.mockReturnValue(false);

      await authController.registerWithWallet(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid EOA address format'
      });
    });

    it('should use fallback when gasless service not ready', async () => {
      const mockWallets = {
        mainWallet: '0x1234567890123456789012345678901234567890',
        savingsWallet: '0x0987654321098765432109876543210987654321'
      };

      mockReq.body = { eoaAddress: mockEOAAddress };

      User.findOne.mockResolvedValue(null);
      contractService.validateAddress.mockReturnValue(true);
      gaslessService.isReady.mockReturnValue(false);
      contractService.createEOAUserWallets = jest.fn().mockResolvedValue(mockWallets);

      const mockUserInstance = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true)
      };
      User.mockImplementation(() => mockUserInstance);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.registerWithWallet(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(contractService.createEOAUserWallets).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUserWithPopulate = {
        ...mockUser,
        groups: [],
        savings: [],
        createdAt: new Date(),
        lastLogin: new Date()
      };

      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUserWithPopulate)
      });

      await authController.getProfile(mockReq, mockRes);

      expect(User.findById).toHaveBeenCalledWith(mockUser._id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: mockUserWithPopulate._id,
            email: mockUserWithPopulate.email,
            address: mockUserWithPopulate.address
          })
        }
      });
    });

    it('should handle missing user', async () => {
      User.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle database errors', async () => {
      User.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateBalance', () => {
    it('should update user balance successfully', async () => {
      mockReq.body = { amount: '150' };

      const foundUser = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(foundUser);

      await authController.updateBalance(mockReq, mockRes);

      expect(User.findById).toHaveBeenCalledWith(mockUser._id);
      expect(foundUser.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Balance updated successfully',
        data: {
          balance: '150',
          address: foundUser.address
        }
      });
    });

    it('should return 400 if amount is missing', async () => {
      mockReq.body = {};

      await authController.updateBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Amount is required'
      });
    });

    it('should handle user not found', async () => {
      mockReq.body = { amount: '150' };

      User.findById.mockResolvedValue(null);

      await authController.updateBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    it('should handle database errors', async () => {
      mockReq.body = { amount: '150' };

      User.findById.mockRejectedValue(new Error('Database error'));

      await authController.updateBalance(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});