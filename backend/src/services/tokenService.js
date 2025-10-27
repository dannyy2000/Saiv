const { ethers } = require('ethers');
const { getStablecoinsForChain, getStablecoinAddresses } = require('../config/stablecoins');

/**
 * TokenService - Manages supported tokens for wallets
 */
class TokenService {
  constructor() {
    this.provider = null;
    this.backendWallet = null;
    this.chainId = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!privateKey) {
        console.warn('ADMIN_PRIVATE_KEY not set - token service will be limited');
        return false;
      }

      this.backendWallet = new ethers.Wallet(privateKey, this.provider);

      // Get chain ID
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId.toString();

      this.isInitialized = true;
      console.log(`✅ Token Service initialized for chain ID: ${this.chainId}`);

      return true;
    } catch (error) {
      console.error('Error initializing token service:', error);
      return false;
    }
  }

  /**
   * Get supported stablecoins for current network
   * @returns {Object} Supported stablecoins
   */
  getSupportedStablecoins() {
    if (!this.chainId) {
      console.warn('Chain ID not set, using default configuration');
      return {};
    }
    return getStablecoinsForChain(this.chainId);
  }

  /**
   * Get stablecoin addresses for current network
   * @returns {string[]} Array of stablecoin addresses
   */
  getStablecoinAddresses() {
    if (!this.chainId) {
      return [];
    }
    return getStablecoinAddresses(this.chainId);
  }

  /**
   * Add supported stablecoins to a wallet
   * @param {string} walletAddress - Wallet address
   * @param {Object} addressManagerContract - AddressManager contract instance
   * @returns {Object} Result
   */
  async addStablecoinsToWallet(walletAddress, addressManagerContract) {
    try {
      if (!this.isInitialized) {
        throw new Error('Token service not initialized');
      }

      const stablecoinAddresses = this.getStablecoinAddresses();

      if (stablecoinAddresses.length === 0) {
        console.log(`ℹ️ No stablecoins configured for chain ${this.chainId}`);
        return {
          success: true,
          message: 'No stablecoins to add',
          tokensAdded: []
        };
      }

      console.log(`📋 Adding ${stablecoinAddresses.length} stablecoins to wallet ${walletAddress}`);

      const results = [];

      for (const tokenAddress of stablecoinAddresses) {
        try {
          console.log(`  → Adding token: ${tokenAddress}`);

          const tx = await addressManagerContract.addSupportedTokenToWallet(
            walletAddress,
            tokenAddress,
            {
              gasLimit: 200000
            }
          );

          await tx.wait();

          results.push({
            address: tokenAddress,
            success: true
          });

          console.log(`  ✅ Token added: ${tokenAddress}`);
        } catch (error) {
          // Token might already be supported, continue with others
          console.log(`  ⚠️ Could not add token ${tokenAddress}: ${error.message}`);
          results.push({
            address: tokenAddress,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: 'Stablecoins processed',
        tokensAdded: results
      };

    } catch (error) {
      console.error('Error adding stablecoins to wallet:', error);
      throw error;
    }
  }

  /**
   * Get token info (symbol, decimals, name)
   * @param {string} tokenAddress - Token address
   * @returns {Object} Token info
   */
  async getTokenInfo(tokenAddress) {
    try {
      const tokenABI = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const tokenContract = new ethers.Contract(
        tokenAddress,
        tokenABI,
        this.provider
      );

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals)
      };

    } catch (error) {
      console.error(`Error getting token info for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get token balance for a wallet
   * @param {string} walletAddress - Wallet address
   * @param {string} tokenAddress - Token address
   * @returns {Object} Token balance info
   */
  async getTokenBalance(walletAddress, tokenAddress) {
    try {
      const tokenABI = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      const tokenContract = new ethers.Contract(
        tokenAddress,
        tokenABI,
        this.provider
      );

      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      return {
        address: tokenAddress,
        symbol,
        decimals: Number(decimals),
        balance: balance.toString(),
        formatted: ethers.formatUnits(balance, decimals)
      };

    } catch (error) {
      console.error(`Error getting token balance:`, error);
      return null;
    }
  }

  /**
   * Get all stablecoin balances for a wallet
   * @param {string} walletAddress - Wallet address
   * @returns {Array} Array of token balances
   */
  async getAllStablecoinBalances(walletAddress) {
    const stablecoinAddresses = this.getStablecoinAddresses();
    const balances = [];

    for (const tokenAddress of stablecoinAddresses) {
      const balance = await this.getTokenBalance(walletAddress, tokenAddress);
      if (balance) {
        balances.push(balance);
      }
    }

    return balances;
  }

  isReady() {
    return this.isInitialized;
  }
}

module.exports = new TokenService();
