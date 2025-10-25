const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * WebhookService - Listens to blockchain events and triggers webhooks
 * Monitors smart contract events and notifies the backend of important state changes
 */
class WebhookService {
  constructor() {
    this.provider = null;
    this.listeners = new Map();
    this.isListening = false;
    this.eventHandlers = new Map();
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      // Test connection
      await this.provider.getNetwork();

      this.setupEventHandlers();

      logger.info('✅ Webhook Service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize webhook service', { error: error.message });
      return false;
    }
  }

  /**
   * Setup event handlers for different contract events
   */
  setupEventHandlers() {
    // User wallet creation events
    this.registerEventHandler('UserWalletsCreated', this.handleUserWalletsCreated.bind(this));
    this.registerEventHandler('EmailUserWalletsCreated', this.handleEmailUserWalletsCreated.bind(this));

    // Group pool events
    this.registerEventHandler('GroupPoolCreated', this.handleGroupPoolCreated.bind(this));

    // Wallet events
    this.registerEventHandler('EthDeposited', this.handleEthDeposited.bind(this));
    this.registerEventHandler('EthWithdrawn', this.handleEthWithdrawn.bind(this));
    this.registerEventHandler('TokenDeposited', this.handleTokenDeposited.bind(this));
    this.registerEventHandler('TokenWithdrawn', this.handleTokenWithdrawn.bind(this));

    // Group pool contribution events
    this.registerEventHandler('ContributionMade', this.handleContributionMade.bind(this));
    this.registerEventHandler('PaymentWindowCompleted', this.handlePaymentWindowCompleted.bind(this));

    // Aave integration events
    this.registerEventHandler('AaveSupplyCompleted', this.handleAaveSupplyCompleted.bind(this));
    this.registerEventHandler('AaveYieldClaimed', this.handleAaveYieldClaimed.bind(this));
  }

  /**
   * Register an event handler for a specific event type
   */
  registerEventHandler(eventName, handler) {
    this.eventHandlers.set(eventName, handler);
    logger.debug(`Registered event handler for ${eventName}`);
  }

  /**
   * Start listening to events from a specific contract
   */
  async startListening(contractAddress, contractABI, eventFilters = []) {
    try {
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }

      const contract = new ethers.Contract(contractAddress, contractABI, this.provider);

      // Listen to all events if no specific filters provided
      if (eventFilters.length === 0) {
        eventFilters = contractABI.filter(item => item.type === 'event').map(event => event.name);
      }

      // Set up listeners for each event
      for (const eventName of eventFilters) {
        try {
          const listener = (...args) => {
            const event = args[args.length - 1]; // Last argument is always the event object
            this.handleEvent(eventName, event, args.slice(0, -1));
          };

          contract.on(eventName, listener);

          this.listeners.set(`${contractAddress}_${eventName}`, {
            contract,
            eventName,
            listener,
            contractAddress
          });

          logger.info(`Started listening to ${eventName} events from ${contractAddress}`);
        } catch (eventError) {
          logger.warn(`Failed to set up listener for ${eventName}`, { error: eventError.message });
        }
      }

      this.isListening = true;
      return true;
    } catch (error) {
      logger.error('Failed to start listening to events', {
        error: error.message,
        contractAddress
      });
      return false;
    }
  }

  /**
   * Stop listening to events from a specific contract
   */
  async stopListening(contractAddress, eventName = null) {
    try {
      const keysToRemove = [];

      for (const [key, listenerInfo] of this.listeners) {
        if (listenerInfo.contractAddress === contractAddress) {
          if (!eventName || listenerInfo.eventName === eventName) {
            listenerInfo.contract.off(listenerInfo.eventName, listenerInfo.listener);
            keysToRemove.push(key);
            logger.info(`Stopped listening to ${listenerInfo.eventName} from ${contractAddress}`);
          }
        }
      }

      keysToRemove.forEach(key => this.listeners.delete(key));

      if (this.listeners.size === 0) {
        this.isListening = false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to stop listening to events', { error: error.message });
      return false;
    }
  }

  /**
   * Handle incoming blockchain events
   */
  async handleEvent(eventName, event, args) {
    try {
      logger.info(`Received ${eventName} event`, {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        contractAddress: event.address
      });

      const handler = this.eventHandlers.get(eventName);
      if (handler) {
        await this.executeWithRetry(() => handler(event, args));
      } else {
        logger.warn(`No handler registered for event: ${eventName}`);
        // Still log the event for debugging
        await this.logUnhandledEvent(eventName, event, args);
      }
    } catch (error) {
      logger.error(`Error handling ${eventName} event`, {
        error: error.message,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    }
  }

  /**
   * Execute function with retry logic
   */
  async executeWithRetry(fn, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === attempts - 1) {
          throw error;
        }
        logger.warn(`Retry attempt ${i + 1}/${attempts} failed`, { error: error.message });
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  /**
   * Event Handlers
   */
  async handleUserWalletsCreated(event, args) {
    const [identifier, mainWallet, savingsWallet] = args;

    logger.info('User wallets created', {
      identifier,
      mainWallet,
      savingsWallet,
      transactionHash: event.transactionHash
    });

    // Update database with wallet addresses
    try {
      const User = require('../models/User');
      await User.findOneAndUpdate(
        { address: identifier },
        {
          address: mainWallet,
          savingsAddress: savingsWallet,
          $push: {
            transactionHistory: {
              type: 'wallet_created',
              transactionHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: new Date()
            }
          }
        }
      );
    } catch (dbError) {
      logger.error('Failed to update user with wallet addresses', {
        error: dbError.message,
        identifier,
        mainWallet,
        savingsWallet
      });
    }
  }

  async handleEmailUserWalletsCreated(event, args) {
    const [emailHash, mainWallet, savingsWallet] = args;

    logger.info('Email user wallets created', {
      emailHash,
      mainWallet,
      savingsWallet,
      transactionHash: event.transactionHash
    });

    // Update database for email-based users
    try {
      const User = require('../models/User');
      await User.findOneAndUpdate(
        { emailHash },
        {
          address: mainWallet,
          savingsAddress: savingsWallet,
          $push: {
            transactionHistory: {
              type: 'email_wallet_created',
              transactionHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: new Date()
            }
          }
        }
      );
    } catch (dbError) {
      logger.error('Failed to update email user with wallet addresses', {
        error: dbError.message,
        emailHash,
        mainWallet,
        savingsWallet
      });
    }
  }

  async handleGroupPoolCreated(event, args) {
    const [groupIdentifier, poolAddress, owner] = args;

    logger.info('Group pool created', {
      groupIdentifier,
      poolAddress,
      owner,
      transactionHash: event.transactionHash
    });

    // Update database with pool address
    try {
      const Group = require('../models/Group');
      await Group.findOneAndUpdate(
        { name: groupIdentifier }, // Assuming groupIdentifier maps to group name
        {
          address: poolAddress,
          $push: {
            transactionHistory: {
              type: 'pool_created',
              transactionHash: event.transactionHash,
              blockNumber: event.blockNumber,
              timestamp: new Date()
            }
          }
        }
      );
    } catch (dbError) {
      logger.error('Failed to update group with pool address', {
        error: dbError.message,
        groupIdentifier,
        poolAddress
      });
    }
  }

  async handleEthDeposited(event, args) {
    const [from, amount] = args;

    logger.info('ETH deposited', {
      from,
      amount: ethers.formatEther(amount),
      transactionHash: event.transactionHash,
      walletAddress: event.address
    });

    // Update user balance in database
    await this.updateUserBalance(from, 'ETH', amount, 'deposit', event);
  }

  async handleEthWithdrawn(event, args) {
    const [to, amount] = args;

    logger.info('ETH withdrawn', {
      to,
      amount: ethers.formatEther(amount),
      transactionHash: event.transactionHash,
      walletAddress: event.address
    });

    // Update user balance in database
    await this.updateUserBalance(to, 'ETH', amount, 'withdrawal', event);
  }

  async handleTokenDeposited(event, args) {
    const [token, from, amount] = args;

    logger.info('Token deposited', {
      token,
      from,
      amount: amount.toString(),
      transactionHash: event.transactionHash,
      walletAddress: event.address
    });

    await this.updateUserBalance(from, token, amount, 'token_deposit', event);
  }

  async handleTokenWithdrawn(event, args) {
    const [token, to, amount] = args;

    logger.info('Token withdrawn', {
      token,
      to,
      amount: amount.toString(),
      transactionHash: event.transactionHash,
      walletAddress: event.address
    });

    await this.updateUserBalance(to, token, amount, 'token_withdrawal', event);
  }

  async handleContributionMade(event, args) {
    // This would be a custom event from GroupPool contract
    logger.info('Contribution made to group pool', {
      transactionHash: event.transactionHash,
      poolAddress: event.address
    });
  }

  async handlePaymentWindowCompleted(event, args) {
    // This would be a custom event from GroupPool contract
    logger.info('Payment window completed', {
      transactionHash: event.transactionHash,
      poolAddress: event.address
    });
  }

  async handleAaveSupplyCompleted(event, args) {
    // This would be a custom event when funds are supplied to Aave
    logger.info('Aave supply completed', {
      transactionHash: event.transactionHash
    });
  }

  async handleAaveYieldClaimed(event, args) {
    // This would be a custom event when Aave yield is claimed
    logger.info('Aave yield claimed', {
      transactionHash: event.transactionHash
    });
  }

  /**
   * Update user balance in database
   */
  async updateUserBalance(userAddress, asset, amount, type, event) {
    try {
      const User = require('../models/User');

      const user = await User.findOne({
        $or: [
          { address: userAddress },
          { savingsAddress: userAddress }
        ]
      });

      if (user) {
        user.transactionHistory.push({
          type,
          asset,
          amount: amount.toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: new Date()
        });

        await user.save();
      }
    } catch (error) {
      logger.error('Failed to update user balance', {
        error: error.message,
        userAddress,
        asset,
        amount: amount.toString()
      });
    }
  }

  /**
   * Log unhandled events for debugging
   */
  async logUnhandledEvent(eventName, event, args) {
    logger.info(`Unhandled event: ${eventName}`, {
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      contractAddress: event.address,
      args: args.map(arg => arg.toString())
    });
  }

  /**
   * Get listening status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      activeListeners: this.listeners.size,
      registeredHandlers: this.eventHandlers.size,
      listeners: Array.from(this.listeners.keys())
    };
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    logger.info('Shutting down webhook service...');

    for (const [key, listenerInfo] of this.listeners) {
      try {
        listenerInfo.contract.off(listenerInfo.eventName, listenerInfo.listener);
      } catch (error) {
        logger.warn(`Failed to remove listener ${key}`, { error: error.message });
      }
    }

    this.listeners.clear();
    this.isListening = false;

    logger.info('Webhook service shutdown complete');
  }
}

module.exports = new WebhookService();