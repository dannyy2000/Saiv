const request = require('supertest');
const express = require('express');
const gasController = require('../../src/controllers/gasController');
const gaslessService = require('../../src/services/gaslessService');

// Mock the gasless service
jest.mock('../../src/services/gaslessService');

describe('GasController', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup routes
    app.get('/gas/backend-wallet', gasController.getBackendWalletInfo);
    app.get('/gas/estimates', gasController.getGasEstimates);
    app.get('/gas/status', gasController.getServiceStatus);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getBackendWalletInfo', () => {
    it('should return backend wallet info successfully', async () => {
      const mockBalance = {
        address: '0x1234567890123456789012345678901234567890',
        balance: '1.5',
        balanceWei: '1500000000000000000'
      };

      gaslessService.getBackendWalletBalance.mockResolvedValue(mockBalance);
      gaslessService.isReady.mockReturnValue(true);

      const response = await request(app).get('/gas/backend-wallet');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        address: mockBalance.address,
        balance: mockBalance.balance,
        balanceWei: mockBalance.balanceWei,
        status: 'ready'
      });
      expect(gaslessService.getBackendWalletBalance).toHaveBeenCalled();
      expect(gaslessService.isReady).toHaveBeenCalled();
    });

    it('should return 503 when backend wallet not initialized', async () => {
      gaslessService.getBackendWalletBalance.mockResolvedValue(null);

      const response = await request(app).get('/gas/backend-wallet');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Backend wallet not initialized');
    });

    it('should return not ready status when service not ready', async () => {
      const mockBalance = {
        address: '0x1234567890123456789012345678901234567890',
        balance: '1.5',
        balanceWei: '1500000000000000000'
      };

      gaslessService.getBackendWalletBalance.mockResolvedValue(mockBalance);
      gaslessService.isReady.mockReturnValue(false);

      const response = await request(app).get('/gas/backend-wallet');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('not ready');
    });

    it('should handle service errors gracefully', async () => {
      gaslessService.getBackendWalletBalance.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app).get('/gas/backend-wallet');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get backend wallet info');
    });
  });

  describe('getGasEstimates', () => {
    it('should return gas estimates successfully', async () => {
      const mockUserCreationEstimate = {
        gasLimit: '300000',
        gasPrice: '20000000000',
        estimatedCostEth: '0.006',
        estimatedCostUsd: '15.50'
      };

      const mockGroupCreationEstimate = {
        gasLimit: '500000',
        gasPrice: '20000000000',
        estimatedCostEth: '0.010',
        estimatedCostUsd: '25.80'
      };

      gaslessService.estimateGasForUserCreation.mockResolvedValue(mockUserCreationEstimate);
      gaslessService.estimateGasForGroupCreation.mockResolvedValue(mockGroupCreationEstimate);

      const response = await request(app).get('/gas/estimates');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userCreation).toEqual(mockUserCreationEstimate);
      expect(response.body.data.groupCreation).toEqual(mockGroupCreationEstimate);
      expect(response.body.data.note).toContain('estimated costs');
      expect(gaslessService.estimateGasForUserCreation).toHaveBeenCalled();
      expect(gaslessService.estimateGasForGroupCreation).toHaveBeenCalled();
    });

    it('should handle gas estimation errors', async () => {
      gaslessService.estimateGasForUserCreation.mockRejectedValue(new Error('Gas estimation failed'));

      const response = await request(app).get('/gas/estimates');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get gas estimates');
    });

    it('should handle partial gas estimation failures', async () => {
      const mockUserCreationEstimate = {
        gasLimit: '300000',
        gasPrice: '20000000000',
        estimatedCostEth: '0.006'
      };

      gaslessService.estimateGasForUserCreation.mockResolvedValue(mockUserCreationEstimate);
      gaslessService.estimateGasForGroupCreation.mockRejectedValue(new Error('Group estimation failed'));

      const response = await request(app).get('/gas/estimates');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('getServiceStatus', () => {
    it('should return complete service status when gasless enabled', async () => {
      const mockBalance = {
        address: '0x1234567890123456789012345678901234567890',
        balance: '1.5'
      };

      gaslessService.isReady.mockReturnValue(true);
      gaslessService.getContractAddress.mockReturnValue('0xcontract123');
      gaslessService.getBackendWalletBalance.mockResolvedValue(mockBalance);

      const response = await request(app).get('/gas/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        gaslessEnabled: true,
        contractAddress: '0xcontract123',
        backendWallet: {
          address: mockBalance.address,
          balance: mockBalance.balance
        },
        features: {
          gaslessRegistration: true,
          gaslessGroupCreation: true,
          userPaysNothing: true
        }
      });
    });

    it('should return service status when gasless disabled', async () => {
      gaslessService.isReady.mockReturnValue(false);
      gaslessService.getContractAddress.mockReturnValue(null);
      gaslessService.getBackendWalletBalance.mockResolvedValue(null);

      const response = await request(app).get('/gas/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        gaslessEnabled: false,
        contractAddress: null,
        backendWallet: null,
        features: {
          gaslessRegistration: false,
          gaslessGroupCreation: false,
          userPaysNothing: false
        }
      });
    });

    it('should handle mixed service states', async () => {
      const mockBalance = {
        address: '0x1234567890123456789012345678901234567890',
        balance: '0.1'
      };

      gaslessService.isReady.mockReturnValue(false); // Service not ready
      gaslessService.getContractAddress.mockReturnValue('0xcontract123'); // But contract exists
      gaslessService.getBackendWalletBalance.mockResolvedValue(mockBalance); // And wallet exists

      const response = await request(app).get('/gas/status');

      expect(response.status).toBe(200);
      expect(response.body.data.gaslessEnabled).toBe(false);
      expect(response.body.data.contractAddress).toBe('0xcontract123');
      expect(response.body.data.backendWallet).toEqual({
        address: mockBalance.address,
        balance: mockBalance.balance
      });
      expect(response.body.data.features.gaslessRegistration).toBe(false);
    });

    it('should handle service status errors', async () => {
      gaslessService.isReady.mockReturnValue(true);
      gaslessService.getContractAddress.mockReturnValue('0xcontract123');
      gaslessService.getBackendWalletBalance.mockRejectedValue(new Error('Wallet error'));

      const response = await request(app).get('/gas/status');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get service status');
    });
  });
});