const { ethers } = require('ethers');

/**
 * AaveService - Backend service to trigger Aave operations on UserWallet and GroupPool contracts
 * Backend pays gas, but contracts do the actual Aave interaction
 */
class AaveService {
  constructor() {
    this.provider = null;
    this.backendWallet = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!privateKey) {
        console.warn('ADMIN_PRIVATE_KEY not set - Aave service will be disabled');
        return false;
      }

      this.backendWallet = new ethers.Wallet(privateKey, this.provider);

      this.isInitialized = true;
      console.log('✅ Aave Service initialized - Backend wallet:', this.backendWallet.address);

      return true;
    } catch (error) {
      console.error('Error initializing Aave service:', error.message);
      return false;
    }
  }

  /**
   * Supply from personal savings wallet to Aave
   * @param {string} savingsWalletAddress - User's savings wallet address (UserWallet contract)
   * @param {string} asset - Asset address (address(0) for ETH)
   * @param {string} amount - Amount to supply in wei
   * @returns {Object} Transaction result
   */
  async supplyPersonalSavingsToAave(savingsWalletAddress, asset, amount) {
    try {
      if (!this.isInitialized) {
        throw new Error('Aave service not initialized');
      }

      console.log(`📤 Supplying personal savings to Aave:`);
      console.log(`   Savings Wallet: ${savingsWalletAddress}`);
      console.log(`   Asset: ${asset}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);

      // UserWallet ABI for Aave functions
      const userWalletABI = [
        "function supplyToAave(address asset, uint256 amount) external",
        "function getATokenBalance(address asset) external view returns (uint256)",
        "function getAaveYield(address asset) external view returns (uint256)"
      ];

      const userWalletContract = new ethers.Contract(
        savingsWalletAddress,
        userWalletABI,
        this.backendWallet // Backend pays gas
      );

      // Call supplyToAave on UserWallet contract
      const tx = await userWalletContract.supplyToAave(asset, amount, {
        gasLimit: 500000
      });

      console.log(`   Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Supply confirmed in block: ${receipt.blockNumber}`);

      // Get aToken balance after supply
      const aTokenBalance = await userWalletContract.getATokenBalance(asset);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        aTokenBalance: aTokenBalance.toString(),
        suppliedAmount: amount.toString()
      };
    } catch (error) {
      console.error('❌ Error supplying personal savings to Aave:', error);
      throw error;
    }
  }

  /**
   * Supply from group pool to Aave
   * @param {string} groupPoolAddress - Group pool address (GroupPool contract)
   * @param {string} asset - Asset address (address(0) for ETH)
   * @param {string} amount - Amount to supply in wei
   * @returns {Object} Transaction result
   */
  async supplyGroupPoolToAave(groupPoolAddress, asset, amount) {
    try {
      if (!this.isInitialized) {
        throw new Error('Aave service not initialized');
      }

      console.log(`📤 Supplying group pool to Aave:`);
      console.log(`   Group Pool: ${groupPoolAddress}`);
      console.log(`   Asset: ${asset}`);
      console.log(`   Amount: ${ethers.formatEther(amount)} ETH`);

      // GroupPool ABI for Aave functions
      const groupPoolABI = [
        "function supplyToAave(address asset, uint256 amount) external",
        "function getATokenBalance(address asset) external view returns (uint256)",
        "function getAaveYield(address asset) external view returns (uint256)"
      ];

      const groupPoolContract = new ethers.Contract(
        groupPoolAddress,
        groupPoolABI,
        this.backendWallet // Backend pays gas
      );

      // Call supplyToAave on GroupPool contract
      const tx = await groupPoolContract.supplyToAave(asset, amount, {
        gasLimit: 500000
      });

      console.log(`   Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Supply confirmed in block: ${receipt.blockNumber}`);

      // Get aToken balance after supply
      const aTokenBalance = await groupPoolContract.getATokenBalance(asset);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        aTokenBalance: aTokenBalance.toString(),
        suppliedAmount: amount.toString()
      };
    } catch (error) {
      console.error('❌ Error supplying group pool to Aave:', error);
      throw error;
    }
  }

  /**
   * Get aToken balance for a wallet
   * @param {string} walletAddress - Wallet address (UserWallet or GroupPool)
   * @param {string} asset - Asset address
   * @returns {string} aToken balance
   */
  async getATokenBalance(walletAddress, asset) {
    try {
      const abi = ["function getATokenBalance(address asset) external view returns (uint256)"];

      const contract = new ethers.Contract(
        walletAddress,
        abi,
        this.provider
      );

      const balance = await contract.getATokenBalance(asset);
      return balance.toString();
    } catch (error) {
      console.error('Error getting aToken balance:', error);
      return '0';
    }
  }

  /**
   * Get yield earned from Aave
   * @param {string} walletAddress - Wallet address (UserWallet or GroupPool)
   * @param {string} asset - Asset address
   * @returns {string} Yield amount
   */
  async getAaveYield(walletAddress, asset) {
    try {
      const abi = ["function getAaveYield(address asset) external view returns (uint256)"];

      const contract = new ethers.Contract(
        walletAddress,
        abi,
        this.provider
      );

      const yield_ = await contract.getAaveYield(asset);
      return yield_.toString();
    } catch (error) {
      console.error('Error getting Aave yield:', error);
      return '0';
    }
  }

  isReady() {
    return this.isInitialized;
  }
}

module.exports = new AaveService();
