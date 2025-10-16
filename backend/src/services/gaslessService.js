const { ethers } = require('ethers');

class GaslessService {
  constructor() {
    this.provider = null;
    this.backendWallet = null;
    this.addressManagerContract = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!privateKey) {
        console.warn('ADMIN_PRIVATE_KEY not set - gasless transactions will be disabled');
        return false;
      }

      this.backendWallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`Backend wallet initialized: ${this.backendWallet.address}`);

      const balance = await this.provider.getBalance(this.backendWallet.address);
      console.log(`Backend wallet balance: ${ethers.formatEther(balance)} ETH`);

      if (process.env.ADDRESS_MANAGER_CONTRACT) {
        await this.loadContract(process.env.ADDRESS_MANAGER_CONTRACT);
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing gasless service:', error);
      return false;
    }
  }

  async loadContract(contractAddress) {
    try {
      const addressManagerABI = [
        "function createUserWallets(address userIdentifier) external returns (address mainWallet, address savingsWallet)",
        "function createEmailUserWallets(bytes32 emailHash, address userIdentifier) external returns (address mainWallet, address savingsWallet)",
        "function createGroupPool(string memory groupIdentifier, address groupOwner, string memory groupName, uint256 paymentWindowDuration, uint256 minContribution, uint256 maxMembers) external returns (address poolAddress)",
        "function getUserMainWallet(address userIdentifier) external view returns (address)",
        "function getUserSavingsWallet(address userIdentifier) external view returns (address)",
        "function getEmailUserMainWallet(bytes32 emailHash) external view returns (address)",
        "function getEmailUserSavingsWallet(bytes32 emailHash) external view returns (address)",
        "function getGroupPool(string memory groupIdentifier) external view returns (address)",
        "function addMemberToGroupPool(address poolAddress, address member) external",
        "function removeMemberFromGroupPool(address poolAddress, address member) external",
        "event UserWalletsCreated(address indexed identifier, address indexed mainWallet, address indexed savingsWallet)",
        "event EmailUserWalletsCreated(bytes32 indexed emailHash, address indexed mainWallet, address indexed savingsWallet)",
        "event GroupPoolCreated(string indexed groupIdentifier, address indexed poolAddress, address indexed owner)"
      ];

      this.addressManagerContract = new ethers.Contract(
        contractAddress,
        addressManagerABI,
        this.backendWallet
      );

      console.log(`Address Manager contract loaded at: ${contractAddress}`);
      return true;
    } catch (error) {
      console.error('Error loading contract:', error);
      return false;
    }
  }

  async createUserWalletsGasless(userAddress) {
    try {
      if (!this.isInitialized || !this.addressManagerContract) {
        throw new Error('Gasless service not initialized');
      }

      console.log(`Creating wallets for user: ${userAddress} (Backend pays gas)`);

      const tx = await this.addressManagerContract.createUserWallets(userAddress, {
        gasLimit: 500000
      });

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      const event = receipt.logs.find(log => {
        try {
          const parsed = this.addressManagerContract.interface.parseLog(log);
          return parsed.name === 'UserWalletsCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.addressManagerContract.interface.parseLog(event);
        return {
          mainWallet: parsed.args.mainWallet,
          savingsWallet: parsed.args.savingsWallet,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        };
      }

      return null;
    } catch (error) {
      console.error('Error creating user wallets gasless:', error);
      throw error;
    }
  }

  async createEmailUserWalletsGasless(email, userAddress) {
    try {
      if (!this.isInitialized || !this.addressManagerContract) {
        throw new Error('Gasless service not initialized');
      }

      const emailHash = ethers.keccak256(ethers.toUtf8Bytes(email.toLowerCase()));
      console.log(`Creating wallets for email user: ${email} (Backend pays gas)`);

      const tx = await this.addressManagerContract.createEmailUserWallets(
        emailHash,
        userAddress,
        {
          gasLimit: 500000
        }
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      const event = receipt.logs.find(log => {
        try {
          const parsed = this.addressManagerContract.interface.parseLog(log);
          return parsed.name === 'EmailUserWalletsCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.addressManagerContract.interface.parseLog(event);
        return {
          mainWallet: parsed.args.mainWallet,
          savingsWallet: parsed.args.savingsWallet,
          emailHash: emailHash,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        };
      }

      return null;
    } catch (error) {
      console.error('Error creating email user wallets gasless:', error);
      throw error;
    }
  }

  async createGroupPoolGasless(groupIdentifier, ownerAddress, groupName, settings = {}) {
    try {
      if (!this.isInitialized || !this.addressManagerContract) {
        throw new Error('Gasless service not initialized');
      }

      const paymentWindowDuration = settings.paymentWindowDuration || 2592000; // 30 days
      const minContribution = settings.minContribution || 0;
      const maxMembers = settings.maxMembers || 100;

      console.log(`Creating group pool: ${groupName} (Backend pays gas)`);

      const tx = await this.addressManagerContract.createGroupPool(
        groupIdentifier,
        ownerAddress,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers,
        {
          gasLimit: 800000
        }
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      const event = receipt.logs.find(log => {
        try {
          const parsed = this.addressManagerContract.interface.parseLog(log);
          return parsed.name === 'GroupPoolCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.addressManagerContract.interface.parseLog(event);
        return {
          poolAddress: parsed.args.poolAddress,
          groupIdentifier: parsed.args.groupIdentifier,
          owner: parsed.args.owner,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber
        };
      }

      return null;
    } catch (error) {
      console.error('Error creating group pool gasless:', error);
      throw error;
    }
  }

  async addMemberToGroupGasless(poolAddress, memberAddress) {
    try {
      if (!this.isInitialized || !this.addressManagerContract) {
        throw new Error('Gasless service not initialized');
      }

      console.log(`Adding member ${memberAddress} to pool ${poolAddress} (Backend pays gas)`);

      const tx = await this.addressManagerContract.addMemberToGroupPool(
        poolAddress,
        memberAddress,
        {
          gasLimit: 300000
        }
      );

      const receipt = await tx.wait();
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('Error adding member gasless:', error);
      throw error;
    }
  }

  async getBackendWalletBalance() {
    try {
      if (!this.backendWallet) {
        return null;
      }

      const balance = await this.provider.getBalance(this.backendWallet.address);
      return {
        address: this.backendWallet.address,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString()
      };
    } catch (error) {
      console.error('Error getting backend wallet balance:', error);
      return null;
    }
  }

  async estimateGasForUserCreation() {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const dummyAddress = '0x0000000000000000000000000000000000000001';
      const gasEstimate = await this.addressManagerContract.createUserWallets.estimateGas(
        dummyAddress
      );

      const gasPrice = await this.provider.getFeeData();

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0',
        estimatedCost: ethers.formatEther(gasEstimate * (gasPrice.gasPrice || 0n)),
        operation: 'User Wallet Creation'
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      return null;
    }
  }

  async estimateGasForGroupCreation() {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const dummyId = 'test-group-' + Date.now();
      const dummyAddress = '0x0000000000000000000000000000000000000001';

      const gasEstimate = await this.addressManagerContract.createGroupPool.estimateGas(
        dummyId,
        dummyAddress,
        'Test Group',
        2592000,
        0,
        100
      );

      const gasPrice = await this.provider.getFeeData();

      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: gasPrice.gasPrice?.toString() || '0',
        estimatedCost: ethers.formatEther(gasEstimate * (gasPrice.gasPrice || 0n)),
        operation: 'Group Pool Creation'
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      return null;
    }
  }

  isReady() {
    return this.isInitialized && this.addressManagerContract !== null;
  }

  getContractAddress() {
    return this.addressManagerContract?.target || null;
  }
}

module.exports = new GaslessService();