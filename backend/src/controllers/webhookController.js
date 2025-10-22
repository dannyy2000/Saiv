const webhookService = require('../services/webhookService');
const { catchAsync } = require('../middleware/errorHandler');

const webhookController = {
  // Get webhook service status
  getStatus: catchAsync(async (req, res) => {
    const status = webhookService.getStatus();

    res.status(200).json({
      success: true,
      data: {
        ...status,
        timestamp: new Date().toISOString()
      }
    });
  }),

  // Start listening to events from a contract
  startListening: catchAsync(async (req, res) => {
    const { contractAddress, eventFilters = [] } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: 'Contract address is required'
      });
    }

    // Get contract ABI from artifacts (simplified)
    const contractABI = getContractABI(contractAddress);

    const success = await webhookService.startListening(
      contractAddress,
      contractABI,
      eventFilters
    );

    if (success) {
      res.status(200).json({
        success: true,
        message: `Started listening to events from ${contractAddress}`,
        data: {
          contractAddress,
          eventFilters: eventFilters.length > 0 ? eventFilters : 'all events'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to start listening to events'
      });
    }
  }),

  // Stop listening to events from a contract
  stopListening: catchAsync(async (req, res) => {
    const { contractAddress, eventName } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: 'Contract address is required'
      });
    }

    const success = await webhookService.stopListening(contractAddress, eventName);

    if (success) {
      res.status(200).json({
        success: true,
        message: `Stopped listening to events from ${contractAddress}`,
        data: {
          contractAddress,
          eventName: eventName || 'all events'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to stop listening to events'
      });
    }
  }),

  // Manual webhook trigger for testing
  triggerWebhook: catchAsync(async (req, res) => {
    const { eventName, mockData } = req.body;

    if (!eventName) {
      return res.status(400).json({
        success: false,
        message: 'Event name is required'
      });
    }

    // Create mock event object
    const mockEvent = {
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      address: mockData?.contractAddress || '0x0000000000000000000000000000000000000000',
      ...mockData
    };

    const mockArgs = mockData?.args || [];

    await webhookService.handleEvent(eventName, mockEvent, mockArgs);

    res.status(200).json({
      success: true,
      message: `Webhook triggered for ${eventName}`,
      data: {
        eventName,
        mockEvent,
        mockArgs
      }
    });
  }),

  // Get event logs from blockchain
  getEventLogs: catchAsync(async (req, res) => {
    const { contractAddress, eventName, fromBlock = 'latest', toBlock = 'latest' } = req.query;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: 'Contract address is required'
      });
    }

    try {
      // This would query the blockchain for past events
      const logs = await getEventLogsFromBlockchain(contractAddress, eventName, fromBlock, toBlock);

      res.status(200).json({
        success: true,
        data: {
          contractAddress,
          eventName,
          fromBlock,
          toBlock,
          logs
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch event logs',
        error: error.message
      });
    }
  }),

  // Health check for webhook service
  healthCheck: catchAsync(async (req, res) => {
    const status = webhookService.getStatus();

    const health = {
      status: status.isListening ? 'healthy' : 'inactive',
      activeListeners: status.activeListeners,
      registeredHandlers: status.registeredHandlers,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.status(200).json({
      success: true,
      data: health
    });
  })
};

// Helper function to get contract ABI (simplified)
function getContractABI(contractAddress) {
  // In a real implementation, this would:
  // 1. Check if the contract address matches known contracts
  // 2. Load the appropriate ABI from artifacts
  // 3. Return the ABI array

  // For now, return a basic ABI with common events
  return [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "identifier",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "mainWallet",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "savingsWallet",
          "type": "address"
        }
      ],
      "name": "UserWalletsCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "emailHash",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "mainWallet",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "savingsWallet",
          "type": "address"
        }
      ],
      "name": "EmailUserWalletsCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "string",
          "name": "groupIdentifier",
          "type": "string"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "poolAddress",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "GroupPoolCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "EthDeposited",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "EthWithdrawn",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "TokenDeposited",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "token",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "TokenWithdrawn",
      "type": "event"
    }
  ];
}

// Helper function to get event logs from blockchain
async function getEventLogsFromBlockchain(contractAddress, eventName, fromBlock, toBlock) {
  // In a real implementation, this would query the blockchain
  // For now, return mock data
  return [
    {
      transactionHash: '0x123...',
      blockNumber: 12345,
      eventName: eventName || 'MockEvent',
      args: ['0x456...', '1000000000000000000']
    }
  ];
}

module.exports = webhookController;