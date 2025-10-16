const { ethers } = require('ethers');

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.addressManagerContract = null;
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://localhost:8545'
      );

      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
      }

      console.log('Contract service initialized');
    } catch (error) {
      console.error('Error initializing contract service:', error);
      throw error;
    }
  }

  async deployAddressManager() {
    try {
      if (!this.signer) {
        console.warn('No signer available, using mock deployment');
        return '0x' + Math.random().toString(16).substr(2, 40);
      }

      const addressManagerABI = [
        "function createUserWallets(address userIdentifier) external returns (address mainWallet, address savingsWallet)",
        "function createEmailUserWallets(bytes32 emailHash, address userIdentifier) external returns (address mainWallet, address savingsWallet)",
        "function getUserMainWallet(address userIdentifier) external view returns (address)",
        "function getUserSavingsWallet(address userIdentifier) external view returns (address)",
        "function getEmailUserMainWallet(bytes32 emailHash) external view returns (address)",
        "function getEmailUserSavingsWallet(bytes32 emailHash) external view returns (address)",
        "function getWalletOwner(address walletAddr) external view returns (address)",
        "function addSupportedTokenToWallet(address walletAddr, address token) external",
        "function addSupportedTokenToAllWallets(address token) external",
        "function getTotalWallets() external view returns (uint256)",
        "function createGroupPool(string memory groupIdentifier, address groupOwner, string memory groupName, uint256 paymentWindowDuration, uint256 minContribution, uint256 maxMembers) external returns (address poolAddress)",
        "function getGroupPool(string memory groupIdentifier) external view returns (address)",
        "function getGroupIdentifier(address poolAddress) external view returns (string memory)",
        "function getTotalGroupPools() external view returns (uint256)",
        "function addMemberToGroupPool(address poolAddress, address member) external",
        "function removeMemberFromGroupPool(address poolAddress, address member) external",
        "function addSupportedTokenToGroupPool(address poolAddress, address tokenAddress) external",
        "event UserWalletsCreated(address indexed identifier, address indexed mainWallet, address indexed savingsWallet)",
        "event EmailUserWalletsCreated(bytes32 indexed emailHash, address indexed mainWallet, address indexed savingsWallet)",
        "event WalletDeployed(address indexed wallet, address indexed owner, string walletType)",
        "event GroupPoolCreated(string indexed groupIdentifier, address indexed poolAddress, address indexed owner)"
      ];

      const userWalletABI = [
        "function initialize(address _owner, address _manager) external",
        "function getEthBalance() external view returns (uint256)",
        "function withdrawEth(address payable to, uint256 amount) external",
        "function depositToken(address token, uint256 amount) external",
        "function withdrawToken(address token, address to, uint256 amount) external",
        "function getTokenBalance(address token) external view returns (uint256)",
        "function getActualTokenBalance(address token) external view returns (uint256)",
        "function addSupportedToken(address token) external",
        "function getSupportedTokens() external view returns (address[])",
        "function sendEth(address payable to, uint256 amount) external",
        "function transferToWallet(address token, address to, uint256 amount) external",
        "event EthDeposited(address indexed from, uint256 amount)",
        "event EthWithdrawn(address indexed to, uint256 amount)",
        "event TokenDeposited(address indexed token, address indexed from, uint256 amount)",
        "event TokenWithdrawn(address indexed token, address indexed to, uint256 amount)"
      ];

      // This would deploy the actual contract with compiled bytecode
      const addressManagerBytecode = "0x608060405234801561001057600080fd5b50610400806100206000396000f3fe";

      const factory = new ethers.ContractFactory(
        addressManagerABI,
        addressManagerBytecode,
        this.signer
      );

      try {
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        this.addressManagerContract = contract;
        return await contract.getAddress();
      } catch (deployError) {
        console.warn('Contract deployment failed, using mock address:', deployError.message);
        return '0x' + Math.random().toString(16).substr(2, 40);
      }
    } catch (error) {
      console.error('Error deploying address manager:', error);
      return '0x' + Math.random().toString(16).substr(2, 40);
    }
  }

  async createUserWallets(userIdentifier) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, creating mock wallets');
        return {
          mainWallet: '0x' + Math.random().toString(16).substr(2, 40),
          savingsWallet: '0x' + Math.random().toString(16).substr(2, 40)
        };
      }

      const tx = await this.addressManagerContract.createUserWallets(userIdentifier);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id("UserWalletsCreated(address,address,address)")
      );

      if (event) {
        const decoded = this.addressManagerContract.interface.parseLog(event);
        return {
          mainWallet: decoded.args.mainWallet,
          savingsWallet: decoded.args.savingsWallet
        };
      }

      return null;
    } catch (error) {
      console.warn('Error creating user wallets:', error.message);
      return {
        mainWallet: '0x' + Math.random().toString(16).substr(2, 40),
        savingsWallet: '0x' + Math.random().toString(16).substr(2, 40)
      };
    }
  }

  async createEmailUserWallets(emailHash, userIdentifier) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, creating mock wallets');
        return {
          mainWallet: '0x' + Math.random().toString(16).substr(2, 40),
          savingsWallet: '0x' + Math.random().toString(16).substr(2, 40)
        };
      }

      const tx = await this.addressManagerContract.createEmailUserWallets(emailHash, userIdentifier);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id("EmailUserWalletsCreated(bytes32,address,address)")
      );

      if (event) {
        const decoded = this.addressManagerContract.interface.parseLog(event);
        return {
          mainWallet: decoded.args.mainWallet,
          savingsWallet: decoded.args.savingsWallet
        };
      }

      return null;
    } catch (error) {
      console.warn('Error creating email user wallets:', error.message);
      return {
        mainWallet: '0x' + Math.random().toString(16).substr(2, 40),
        savingsWallet: '0x' + Math.random().toString(16).substr(2, 40)
      };
    }
  }

  async getUserMainWallet(userIdentifier) {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const mainWallet = await this.addressManagerContract.getUserMainWallet(userIdentifier);
      return mainWallet;
    } catch (error) {
      console.warn('Error getting user main wallet:', error.message);
      return null;
    }
  }

  async getUserSavingsWallet(userIdentifier) {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const savingsWallet = await this.addressManagerContract.getUserSavingsWallet(userIdentifier);
      return savingsWallet;
    } catch (error) {
      console.warn('Error getting user savings wallet:', error.message);
      return null;
    }
  }

  async getEmailUserMainWallet(emailHash) {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const mainWallet = await this.addressManagerContract.getEmailUserMainWallet(emailHash);
      return mainWallet;
    } catch (error) {
      console.warn('Error getting email user main wallet:', error.message);
      return null;
    }
  }

  async getEmailUserSavingsWallet(emailHash) {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const savingsWallet = await this.addressManagerContract.getEmailUserSavingsWallet(emailHash);
      return savingsWallet;
    } catch (error) {
      console.warn('Error getting email user savings wallet:', error.message);
      return null;
    }
  }

  async getWalletBalance(walletAddress) {
    try {
      if (!this.provider) {
        await this.initialize();
      }

      const walletContract = new ethers.Contract(
        walletAddress,
        ["function getEthBalance() external view returns (uint256)"],
        this.provider
      );

      const balance = await walletContract.getEthBalance();
      return {
        wei: balance.toString(),
        ether: ethers.formatEther(balance)
      };
    } catch (error) {
      console.warn('Error getting wallet balance:', error.message);
      return { wei: '0', ether: '0.0' };
    }
  }

  async getWalletTokenBalance(walletAddress, tokenAddress) {
    try {
      if (!this.provider) {
        await this.initialize();
      }

      const walletContract = new ethers.Contract(
        walletAddress,
        ["function getTokenBalance(address token) external view returns (uint256)"],
        this.provider
      );

      const balance = await walletContract.getTokenBalance(tokenAddress);
      return balance.toString();
    } catch (error) {
      console.warn('Error getting wallet token balance:', error.message);
      return '0';
    }
  }

  async addSupportedToken(walletAddress, tokenAddress) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, token support skipped');
        return null;
      }

      const tx = await this.addressManagerContract.addSupportedTokenToWallet(
        walletAddress,
        tokenAddress
      );
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.warn('Error adding supported token:', error.message);
      return null;
    }
  }

  async addSupportedTokenToAllWallets(tokenAddress) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, token support skipped');
        return null;
      }

      const tx = await this.addressManagerContract.addSupportedTokenToAllWallets(tokenAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.warn('Error adding supported token to all wallets:', error.message);
      return null;
    }
  }

  validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getContractAddress() {
    if (this.addressManagerContract) {
      try {
        return await this.addressManagerContract.getAddress();
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  async createGroupPool(groupIdentifier, groupOwner, groupName, paymentWindowDuration, minContribution, maxMembers) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, creating mock group pool');
        return {
          poolAddress: '0x' + Math.random().toString(16).substr(2, 40)
        };
      }

      const tx = await this.addressManagerContract.createGroupPool(
        groupIdentifier,
        groupOwner,
        groupName,
        paymentWindowDuration,
        minContribution,
        maxMembers
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id("GroupPoolCreated(string,address,address)")
      );

      if (event) {
        const decoded = this.addressManagerContract.interface.parseLog(event);
        return {
          poolAddress: decoded.args.poolAddress,
          transactionHash: receipt.hash
        };
      }

      return null;
    } catch (error) {
      console.warn('Error creating group pool:', error.message);
      return {
        poolAddress: '0x' + Math.random().toString(16).substr(2, 40)
      };
    }
  }

  async getGroupPool(groupIdentifier) {
    try {
      if (!this.addressManagerContract) {
        return null;
      }

      const poolAddress = await this.addressManagerContract.getGroupPool(groupIdentifier);
      return poolAddress;
    } catch (error) {
      console.warn('Error getting group pool:', error.message);
      return null;
    }
  }

  async addMemberToGroupPool(poolAddress, memberAddress) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, member addition skipped');
        return null;
      }

      const tx = await this.addressManagerContract.addMemberToGroupPool(poolAddress, memberAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.warn('Error adding member to group pool:', error.message);
      return null;
    }
  }

  async removeMemberFromGroupPool(poolAddress, memberAddress) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, member removal skipped');
        return null;
      }

      const tx = await this.addressManagerContract.removeMemberFromGroupPool(poolAddress, memberAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.warn('Error removing member from group pool:', error.message);
      return null;
    }
  }

  async addSupportedTokenToGroupPool(poolAddress, tokenAddress) {
    try {
      if (!this.addressManagerContract) {
        console.warn('Contract not available, token addition skipped');
        return null;
      }

      const tx = await this.addressManagerContract.addSupportedTokenToGroupPool(poolAddress, tokenAddress);
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash
      };
    } catch (error) {
      console.warn('Error adding token to group pool:', error.message);
      return null;
    }
  }

  // Helper function to interact with wallet contracts directly
  async callWalletFunction(walletAddress, functionName, params = [], value = 0) {
    try {
      if (!this.signer) {
        throw new Error('No signer available');
      }

      const walletABI = [
        "function withdrawEth(address payable to, uint256 amount) external",
        "function sendEth(address payable to, uint256 amount) external",
        "function depositToken(address token, uint256 amount) external",
        "function withdrawToken(address token, address to, uint256 amount) external",
        "function addSupportedToken(address token) external",
        "function getEthBalance() external view returns (uint256)",
        "function getTokenBalance(address token) external view returns (uint256)",
        "function getSupportedTokens() external view returns (address[])"
      ];

      const walletContract = new ethers.Contract(walletAddress, walletABI, this.signer);

      const tx = await walletContract[functionName](...params, { value: value });

      if (tx.wait) {
        const receipt = await tx.wait();
        return {
          success: true,
          transactionHash: receipt.hash,
          result: receipt
        };
      } else {
        return {
          success: true,
          result: tx
        };
      }
    } catch (error) {
      console.error('Error calling wallet function:', error);
      throw error;
    }
  }

  // Helper function to interact with group pool contracts directly
  async callGroupPoolFunction(poolAddress, functionName, params = [], value = 0) {
    try {
      if (!this.signer) {
        throw new Error('No signer available');
      }

      const groupPoolABI = [
        "function contribute() external payable",
        "function contributeToken(address tokenAddress, uint256 amount) external",
        "function addMember(address member) external",
        "function removeMember(address member) external",
        "function addSupportedToken(address tokenAddress) external",
        "function createNewPaymentWindow() external",
        "function completeCurrentWindow() external",
        "function withdrawEth(address payable to, uint256 amount) external",
        "function withdrawToken(address tokenAddress, address to, uint256 amount) external",
        "function getPaymentWindow(uint256 windowNumber) external view returns (uint256 start, uint256 end, uint256 total, bool active, bool completed)",
        "function getMemberContribution(address member, uint256 windowNumber) external view returns (uint256)",
        "function getMemberTokenContribution(address member, uint256 windowNumber, address tokenAddress) external view returns (uint256)",
        "function getGroupMembers() external view returns (address[])",
        "function getSupportedTokens() external view returns (address[])",
        "function getPoolBalances() external view returns (uint256 ethBalance, address[] memory tokens, uint256[] memory tokenBalances)"
      ];

      const poolContract = new ethers.Contract(poolAddress, groupPoolABI, this.signer);

      const tx = await poolContract[functionName](...params, { value: value });

      if (tx.wait) {
        const receipt = await tx.wait();
        return {
          success: true,
          transactionHash: receipt.hash,
          result: receipt
        };
      } else {
        return {
          success: true,
          result: tx
        };
      }
    } catch (error) {
      console.error('Error calling group pool function:', error);
      throw error;
    }
  }
}

module.exports = new ContractService();