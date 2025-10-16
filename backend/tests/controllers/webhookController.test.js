const webhookController = require('../../src/controllers/webhookController');
const webhookService = require('../../src/services/webhookService');

// Mock dependencies
jest.mock('../../src/services/webhookService');

describe('WebhookController', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return webhook service status', async () => {
      const mockStatus = {
        isListening: true,
        activeContracts: ['0xcontract1', '0xcontract2'],
        totalEvents: 150,
        lastEventTimestamp: new Date().toISOString()
      };

      webhookService.getStatus.mockReturnValue(mockStatus);

      await webhookController.getStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          isListening: true,
          activeContracts: ['0xcontract1', '0xcontract2'],
          totalEvents: 150,
          timestamp: expect.any(String)
        })
      });
    });

    it('should handle service status errors', async () => {
      webhookService.getStatus.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      await expect(
        webhookController.getStatus(mockReq, mockRes)
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('startListening', () => {
    it('should start listening to contract events successfully', async () => {
      mockReq.body = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventFilters: ['Transfer', 'Approval']
      };

      webhookService.startListening.mockResolvedValue(true);

      // Mock the getContractABI function
      global.getContractABI = jest.fn().mockReturnValue([]);

      await webhookController.startListening(mockReq, mockRes);

      expect(webhookService.startListening).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        [],
        ['Transfer', 'Approval']
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining('Started listening to events from'),
        data: {
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventFilters: ['Transfer', 'Approval']
        }
      });
    });

    it('should validate required contract address', async () => {
      mockReq.body = {}; // missing contractAddress

      await webhookController.startListening(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Contract address is required'
      });
    });

    it('should handle service failures', async () => {
      mockReq.body = {
        contractAddress: '0x1234567890123456789012345678901234567890'
      };

      webhookService.startListening.mockResolvedValue(false);
      global.getContractABI = jest.fn().mockReturnValue([]);

      await webhookController.startListening(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to start listening to events'
      });
    });
  });

  describe('stopListening', () => {
    it('should stop listening to contract events successfully', async () => {
      mockReq.body = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Transfer'
      };

      webhookService.stopListening.mockResolvedValue(true);

      await webhookController.stopListening(mockReq, mockRes);

      expect(webhookService.stopListening).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'Transfer'
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining('Stopped listening to events from'),
        data: {
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventName: 'Transfer'
        }
      });
    });

    it('should validate required contract address', async () => {
      mockReq.body = {}; // missing contractAddress

      await webhookController.stopListening(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Contract address is required'
      });
    });

    it('should handle service failures', async () => {
      mockReq.body = {
        contractAddress: '0x1234567890123456789012345678901234567890'
      };

      webhookService.stopListening.mockResolvedValue(false);

      await webhookController.stopListening(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to stop listening to events'
      });
    });
  });

  describe('triggerWebhook', () => {
    it('should trigger webhook successfully for testing', async () => {
      mockReq.body = {
        eventName: 'Transfer',
        mockData: {
          contractAddress: '0x1234567890123456789012345678901234567890',
          from: '0xuser1',
          to: '0xuser2',
          amount: '1000'
        }
      };

      webhookService.processEvent.mockResolvedValue(true);

      await webhookController.triggerWebhook(mockReq, mockRes);

      expect(webhookService.processEvent).toHaveBeenCalledWith(
        'Transfer',
        expect.objectContaining({
          transactionHash: expect.any(String),
          blockNumber: expect.any(Number),
          address: '0x1234567890123456789012345678901234567890'
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should validate required event name', async () => {
      mockReq.body = {}; // missing eventName

      await webhookController.triggerWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Event name is required'
      });
    });

    it('should handle webhook processing failures', async () => {
      mockReq.body = {
        eventName: 'Transfer'
      };

      webhookService.processEvent.mockResolvedValue(false);

      await webhookController.triggerWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to process webhook event'
      });
    });
  });
});