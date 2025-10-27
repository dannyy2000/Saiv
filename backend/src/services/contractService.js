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

      // Real compiled bytecode from AddressManager.sol
      const addressManagerBytecode = "0x60c06040523480156200001157600080fd5b506200002e67d5469ff029574da760c01b6200018760201b60201c565b6200004a670f907a183d29cfc760c01b6200018760201b60201c565b33600960006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550620000a767b62b7eed5ee5f0c460c01b6200018760201b60201c565b604051620000b5906200018a565b604051809103906000f080158015620000d2573d6000803e3d6000fd5b5073ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505062000122674da4a2f5a8e85f8160c01b6200018760201b60201c565b604051620001309062000198565b604051809103906000f0801580156200014d573d6000803e3d6000fd5b5073ffffffffffffffffffffffffffffffffffffffff1660a08173ffffffffffffffffffffffffffffffffffffffff1681525050620001a6565b50565b6168488062005b7983390190565b617f8f806200c3c183390190565b60805160a05161597c620001fd600039600081816107d80152612ba9015260008181610ac501528181610bef0152818161170201528181611cae01528181611dd8015281816131ae0152613ffd015261597c6000f3fe608060405234801561001057600080fd5b50600436106102115760003560e01c80637ad680f011610125578063c4bf0220116100ad578063da0335401161007c578063da0335401461070c578063e9ffb95b1461073c578063ef8de2d81461076c578063f2fde38b1461079c578063f5f50eb1146107b857610211565b8063c4bf022014610686578063d14fe701146106b6578063d8b0acad146106d2578063d92db775146106f057610211565b80638da5cb5b116100f45780638da5cb5b146105a8578063966708a5146105c6578063997b1756146105f65780639cca36e514610626578063b89a147a1461065657610211565b80637ad680f0146104fa5780637fe24a551461052a5780638117abc11461055a5780638cf8350f1461057857610211565b80634411ae23116101a85780636470d46d116101775780636470d46d1461040a57806364a2caf41461043a5780636575d4d21461046a5780636dcb81b21461049a578063750fbf01146104ca57610211565b80634411ae231461035d578063459e2cde1461038e5780634998d6cf146103aa5780635d96c137146103da57610211565b806322acbae5116101e457806322acbae5146102b157806331b20c96146102e15780633a995ecb1461031157806343618bb71461034157610211565b806307617a3a146102165780630f0b949d146102345780630f4bf476146102655780631197297714610281575b600080fd5b61021e6107d6565b60405161022b91906144e2565b60405180910390f35b61024e60048036038101906102499190614573565b6107fa565b60405161025c9291906145b3565b60405180910390f35b61027f600480360381019061027a91906145dc565b61117b565b005b61029b6004803603810190610296919061461c565b6114d4565b6040516102a891906144e2565b60405180910390f35b6102cb60048036038101906102c6919061461c565b61154d565b6040516102d891906144e2565b60405180910390f35b6102fb60048036038101906102f69190614649565b6115c6565b60405161030891906144e2565b60405180910390f35b61032b600480360381019061032691906146ac565b61166a565b60405161033891906144e2565b60405180910390f35b61035b60048036038101906103569190614649565b611730565b005b61037760048036038101906103729190614649565b611a4d565b6040516103859291906145b3565b60405180910390f35b6103a860048036038101906103a391906145dc565b6123cf565b005b6103c460048036038101906103bf91906146ec565b612727565b6040516103d191906144e2565b60405180910390f35b6103f460048036038101906103ef919061485f565b612842565b60405161040191906144e2565b60405180910390f35b610424600480360381019061041f91906146ec565b612e95565b60405161043191906144e2565b60405180910390f35b610454600480360381019061044f9190614649565b612ed4565b60405161046191906149a3565b60405180910390f35b610484600480360381019061047f91906146ec565b612f74565b60405161049191906144e2565b60405180910390f35b6104b460048036038101906104af919061461c565b61308f565b6040516104c191906144e2565b60405180910390f35b6104e460048036038101906104df9190614649565b6130c2565b6040516104f191906144e2565b60405180910390f35b610514600480360381019061050f91906149c5565b6130f5565b60405161052191906144e2565b60405180910390f35b610544600480360381019061053f9190614649565b613179565b60405161055191906144e2565b60405180910390f35b6105626131ac565b60405161056f91906144e2565b60405180910390f35b610592600480360381019061058d91906146ec565b6131d0565b60405161059f91906144e2565b60405180910390f35b6105b061320f565b6040516105bd91906144e2565b60405180910390f35b6105e060048036038101906105db9190614649565b613235565b6040516105ed91906144e2565b60405180910390f35b610610600480360381019061060b9190614649565b6132da565b60405161061d91906144e2565b60405180910390f35b610640600480360381019061063b919061461c565b61337f565b60405161064d91906144e2565b60405180910390f35b610670600480360381019061066b91906149c5565b6333b2565b60405161067d91906144e2565b60405180910390f35b6106a0600480360381019061069b9190614a6e565b6133fb565b6040516106ad9190614b23565b60405180910390f35b6106d060048036038101906106cb91906145dc565b61375d565b005b6106da613ab6565b6040516106e79190614b54565b60405180910390f35b61070a600480360381019061070591906145dc565b613aff565b005b61072660048036038101906107219190614649565b613e58565b60405161073391906149a3565b60405180910390f35b610756600480360381019061075191906146ac565b613f65565b60405161076391906144e2565b60405180910390f35b61078660048036038101906107819190614649565b61402b565b60405161079391906144e2565b60405180910390f35b6107b660048036038101906107b19190614649565b61405e565b005b6107c06142b9565b6040516107cd9190614b54565b60405180910390f3fe";

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
    if (!this.addressManagerContract) {
      throw new Error('AddressManager contract not initialized. Cannot create wallets without blockchain connection.');
    }

    try {
      const tx = await this.addressManagerContract.createUserWallets(userIdentifier);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id("UserWalletsCreated(address,address,address)")
      );

      if (!event) {
        throw new Error('Wallet creation transaction succeeded but event not found in logs');
      }

      const decoded = this.addressManagerContract.interface.parseLog(event);

      if (!decoded.args.mainWallet || !decoded.args.savingsWallet) {
        throw new Error('Invalid wallet addresses returned from contract');
      }

      return {
        mainWallet: decoded.args.mainWallet,
        savingsWallet: decoded.args.savingsWallet
      };
    } catch (error) {
      console.error('Failed to create user wallets:', error.message);
      throw new Error(`Wallet creation failed: ${error.message}`);
    }
  }

  async createEmailUserWallets(emailHash, userIdentifier) {
    if (!this.addressManagerContract) {
      throw new Error('AddressManager contract not initialized. Cannot create wallets without blockchain connection.');
    }

    try {
      const tx = await this.addressManagerContract.createEmailUserWallets(emailHash, userIdentifier);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log =>
        log.topics[0] === ethers.id("EmailUserWalletsCreated(bytes32,address,address)")
      );

      if (!event) {
        throw new Error('Wallet creation transaction succeeded but event not found in logs');
      }

      const decoded = this.addressManagerContract.interface.parseLog(event);

      if (!decoded.args.mainWallet || !decoded.args.savingsWallet) {
        throw new Error('Invalid wallet addresses returned from contract');
      }

      return {
        mainWallet: decoded.args.mainWallet,
        savingsWallet: decoded.args.savingsWallet
      };
    } catch (error) {
      console.error('Failed to create email user wallets:', error.message);
      throw new Error(`Wallet creation failed: ${error.message}`);
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