const { ethers } = require('ethers');
const Group = require('../models/Group');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Withdrawal Event Handler
 * Processes blockchain events related to automatic withdrawals and updates database
 */
class WithdrawalEventHandler {
  constructor() {
    this.provider = null;
    this.isListening = false;
    this.eventListeners = new Map();
    this.contractABI = [
      "event AutomaticWithdrawalProcessed(uint256 totalAmount, uint256 principal, uint256 interest, uint256 systemFee, uint256 timestamp)",
      "event MemberPayout(address indexed member, uint256 amount, uint256 contribution, uint256 timestamp)",
      "event GroupCompleted(uint256 timestamp)",
      "event WithdrawnFromAave(address indexed asset, uint256 amount)"
    ];
  }

  /**
   * Initialize the withdrawal event handler
   */
  async initialize() {
    try {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error('RPC_URL not found in environment variables');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      logger.info('Withdrawal event handler initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize withdrawal event handler', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Start listening for withdrawal events on a specific group contract
   */
  async startListening(groupAddress) {
    try {
      if (!ethers.isAddress(groupAddress)) {
        throw new Error('Invalid group contract address');
      }

      if (this.eventListeners.has(groupAddress)) {
        logger.warn('Already listening for events on group', { groupAddress });
        return;
      }

      const contract = new ethers.Contract(groupAddress, this.contractABI, this.provider);

      // Set up event listeners
      const listeners = {
        automaticWithdrawal: contract.on('AutomaticWithdrawalProcessed',
          (...args) => this.handleAutomaticWithdrawalEvent(groupAddress, ...args)
        ),
        memberPayout: contract.on('MemberPayout',
          (...args) => this.handleMemberPayoutEvent(groupAddress, ...args)
        ),
        groupCompleted: contract.on('GroupCompleted',
          (...args) => this.handleGroupCompletedEvent(groupAddress, ...args)
        ),
        withdrawnFromAave: contract.on('WithdrawnFromAave',
          (...args) => this.handleWithdrawnFromAaveEvent(groupAddress, ...args)
        )
      };

      this.eventListeners.set(groupAddress, {
        contract,
        listeners
      });

      logger.info('Started listening for withdrawal events', { groupAddress });
      return true;

    } catch (error) {
      logger.error('Failed to start listening for withdrawal events', {
        groupAddress,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Stop listening for events on a specific group contract
   */
  stopListening(groupAddress) {
    try {
      const eventListener = this.eventListeners.get(groupAddress);
      if (!eventListener) {
        logger.warn('Not listening for events on group', { groupAddress });
        return;
      }

      const { contract } = eventListener;
      contract.removeAllListeners();

      this.eventListeners.delete(groupAddress);
      logger.info('Stopped listening for withdrawal events', { groupAddress });

    } catch (error) {
      logger.error('Failed to stop listening for withdrawal events', {
        groupAddress,
        error: error.message
      });
    }
  }

  /**
   * Handle AutomaticWithdrawalProcessed event
   */
  async handleAutomaticWithdrawalEvent(groupAddress, totalAmount, principal, interest, systemFee, timestamp, event) {
    try {
      logger.info('Processing AutomaticWithdrawalProcessed event', {
        groupAddress,
        totalAmount: totalAmount.toString(),
        principal: principal.toString(),
        interest: interest.toString(),
        systemFee: systemFee.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // Get the transaction receipt for gas information
      const receipt = await this.provider.getTransactionReceipt(event.transactionHash);

      // Update group in database
      const group = await Group.findOne({ address: groupAddress });
      if (!group) {
        logger.error('Group not found in database', { groupAddress });
        return;
      }

      // Determine the asset from the transaction logs
      const asset = await this.determineAssetFromTransaction(event);

      // Create withdrawal transaction record
      const withdrawalTransaction = {
        asset: asset || ethers.ZeroAddress,
        transactionHash: event.transactionHash,
        totalAmount: totalAmount.toString(),
        principal: principal.toString(),
        interest: interest.toString(),
        systemFee: systemFee.toString(),
        distributedAmount: (totalAmount - systemFee).toString(),
        memberPayouts: [], // Will be populated by MemberPayout events
        blockNumber: event.blockNumber,
        gasUsed: receipt?.gasUsed?.toString() || '0',
        timestamp: new Date(Number(timestamp) * 1000)
      };

      // Update group status
      group.groupStatus = 'completed';
      group.automaticWithdrawal.processedAt = new Date();

      // Add transaction to withdrawal history
      if (!group.automaticWithdrawal.transactions) {
        group.automaticWithdrawal.transactions = [];
      }
      group.automaticWithdrawal.transactions.push(withdrawalTransaction);

      await group.save();

      logger.info('Updated group with withdrawal transaction', {
        groupAddress,
        transactionHash: event.transactionHash
      });

    } catch (error) {
      logger.error('Failed to handle AutomaticWithdrawalProcessed event', {
        groupAddress,
        transactionHash: event?.transactionHash,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Handle MemberPayout event
   */
  async handleMemberPayoutEvent(groupAddress, memberAddress, amount, contribution, timestamp, event) {
    try {
      logger.info('Processing MemberPayout event', {
        groupAddress,
        memberAddress,
        amount: amount.toString(),
        contribution: contribution.toString(),
        transactionHash: event.transactionHash
      });

      // Find the group and latest withdrawal transaction
      const group = await Group.findOne({ address: groupAddress });
      if (!group || !group.automaticWithdrawal.transactions.length) {
        logger.error('Group or withdrawal transaction not found', { groupAddress });
        return;
      }

      // Get the latest withdrawal transaction (should match the current transaction)
      const latestTransaction = group.automaticWithdrawal.transactions[
        group.automaticWithdrawal.transactions.length - 1
      ];

      if (latestTransaction.transactionHash !== event.transactionHash) {
        logger.error('Transaction hash mismatch for member payout', {
          groupAddress,
          expected: latestTransaction.transactionHash,
          received: event.transactionHash
        });
        return;
      }

      // Find user by wallet address
      const user = await User.findOne({ walletAddress: memberAddress });
      if (!user) {
        logger.warn('User not found for member payout', {
          groupAddress,
          memberAddress
        });
      }

      // Add member payout to the transaction
      const memberPayout = {
        userId: user?._id || null,
        walletAddress: memberAddress,
        contribution: contribution.toString(),
        payout: amount.toString(),
        timestamp: new Date(Number(timestamp) * 1000)
      };

      latestTransaction.memberPayouts.push(memberPayout);

      await group.save();

      logger.info('Added member payout to withdrawal transaction', {
        groupAddress,
        memberAddress,
        amount: amount.toString(),
        transactionHash: event.transactionHash
      });

    } catch (error) {
      logger.error('Failed to handle MemberPayout event', {
        groupAddress,
        memberAddress,
        transactionHash: event?.transactionHash,
        error: error.message
      });
    }
  }

  /**
   * Handle GroupCompleted event
   */
  async handleGroupCompletedEvent(groupAddress, timestamp, event) {
    try {
      logger.info('Processing GroupCompleted event', {
        groupAddress,
        timestamp: timestamp.toString(),
        transactionHash: event.transactionHash
      });

      // Update group status
      const group = await Group.findOne({ address: groupAddress });
      if (!group) {
        logger.error('Group not found in database', { groupAddress });
        return;
      }

      group.groupStatus = 'completed';
      group.isActive = false;

      await group.save();

      // Stop listening for events on this group
      this.stopListening(groupAddress);

      logger.info('Group marked as completed', {
        groupAddress,
        transactionHash: event.transactionHash
      });

    } catch (error) {
      logger.error('Failed to handle GroupCompleted event', {
        groupAddress,
        transactionHash: event?.transactionHash,
        error: error.message
      });
    }
  }

  /**
   * Handle WithdrawnFromAave event
   */
  async handleWithdrawnFromAaveEvent(groupAddress, asset, amount, event) {
    try {
      logger.info('Processing WithdrawnFromAave event', {
        groupAddress,
        asset,
        amount: amount.toString(),
        transactionHash: event.transactionHash
      });

      // This event provides additional context about the Aave withdrawal
      // The main processing is done in AutomaticWithdrawalProcessed event

    } catch (error) {
      logger.error('Failed to handle WithdrawnFromAave event', {
        groupAddress,
        asset,
        transactionHash: event?.transactionHash,
        error: error.message
      });
    }
  }

  /**
   * Determine the asset being withdrawn from transaction logs
   */
  async determineAssetFromTransaction(event) {
    try {
      const receipt = await this.provider.getTransactionReceipt(event.transactionHash);

      // Parse logs to find WithdrawnFromAave event
      const iface = new ethers.Interface(this.contractABI);

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'WithdrawnFromAave') {
            return parsed.args.asset;
          }
        } catch (error) {
          // Log might not be from our contract, continue
          continue;
        }
      }

      return ethers.ZeroAddress; // Default to ETH if not found
    } catch (error) {
      logger.error('Failed to determine asset from transaction', {
        transactionHash: event.transactionHash,
        error: error.message
      });
      return ethers.ZeroAddress;
    }
  }

  /**
   * Process past events for a group (useful for syncing missed events)
   */
  async processPastEvents(groupAddress, fromBlock = 0) {
    try {
      const contract = new ethers.Contract(groupAddress, this.contractABI, this.provider);

      const currentBlock = await this.provider.getBlockNumber();
      const toBlock = currentBlock;

      logger.info('Processing past withdrawal events', {
        groupAddress,
        fromBlock,
        toBlock
      });

      // Get all past events
      const events = await Promise.all([
        contract.queryFilter('AutomaticWithdrawalProcessed', fromBlock, toBlock),
        contract.queryFilter('MemberPayout', fromBlock, toBlock),
        contract.queryFilter('GroupCompleted', fromBlock, toBlock),
        contract.queryFilter('WithdrawnFromAave', fromBlock, toBlock)
      ]);

      const allEvents = events.flat().sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber;
        }
        return a.logIndex - b.logIndex;
      });

      // Process events in order
      for (const event of allEvents) {
        switch (event.eventName) {
          case 'AutomaticWithdrawalProcessed':
            await this.handleAutomaticWithdrawalEvent(groupAddress, ...event.args, event);
            break;
          case 'MemberPayout':
            await this.handleMemberPayoutEvent(groupAddress, ...event.args, event);
            break;
          case 'GroupCompleted':
            await this.handleGroupCompletedEvent(groupAddress, ...event.args, event);
            break;
          case 'WithdrawnFromAave':
            await this.handleWithdrawnFromAaveEvent(groupAddress, ...event.args, event);
            break;
        }
      }

      logger.info('Finished processing past withdrawal events', {
        groupAddress,
        eventsProcessed: allEvents.length
      });

    } catch (error) {
      logger.error('Failed to process past withdrawal events', {
        groupAddress,
        fromBlock,
        error: error.message
      });
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.provider !== null,
      listeningGroups: Array.from(this.eventListeners.keys()),
      totalListeners: this.eventListeners.size
    };
  }

  /**
   * Stop listening for all events
   */
  stopAll() {
    for (const groupAddress of this.eventListeners.keys()) {
      this.stopListening(groupAddress);
    }
    this.isListening = false;
  }
}

module.exports = new WithdrawalEventHandler();