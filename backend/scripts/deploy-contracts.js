const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Automated Contract Deployment Script
 * Deploys all contracts and updates environment configuration
 */
class ContractDeployer {
  constructor() {
    this.provider = null;
    this.deployer = null;
    this.deployedContracts = {};
    this.gasLimit = 5000000; // 5M gas limit
    this.maxFeePerGas = ethers.parseUnits('20', 'gwei');
    this.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei');
  }

  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        throw new Error('RPC_URL not found in environment variables');
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      console.log('📡 Connected to network:', await this.provider.getNetwork());

      // Initialize deployer wallet
      const privateKey = process.env.ADMIN_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
      }

      this.deployer = new ethers.Wallet(privateKey, this.provider);
      console.log('👛 Deployer address:', this.deployer.address);

      // Check deployer balance
      const balance = await this.provider.getBalance(this.deployer.address);
      console.log('💰 Deployer balance:', ethers.formatEther(balance), 'ETH');

      if (balance < ethers.parseEther('0.1')) {
        console.warn('⚠️ Low balance! You may need more ETH for deployment');
      }

      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  async loadContractArtifacts() {
    try {
      const contractsDir = path.join(__dirname, '../../contract/artifacts/contracts');

      // Load AddressManager artifact
      const addressManagerPath = path.join(contractsDir, 'AddressManager.sol/AddressManager.json');
      if (!fs.existsSync(addressManagerPath)) {
        throw new Error('AddressManager artifact not found. Run: cd contract && npx hardhat compile');
      }

      const addressManagerArtifact = JSON.parse(fs.readFileSync(addressManagerPath, 'utf8'));

      // Load UserWallet artifact
      const userWalletPath = path.join(contractsDir, 'UserWallet.sol/UserWallet.json');
      const userWalletArtifact = fs.existsSync(userWalletPath)
        ? JSON.parse(fs.readFileSync(userWalletPath, 'utf8'))
        : null;

      // Load GroupPool artifact
      const groupPoolPath = path.join(contractsDir, 'GroupPool.sol/GroupPool.json');
      const groupPoolArtifact = fs.existsSync(groupPoolPath)
        ? JSON.parse(fs.readFileSync(groupPoolPath, 'utf8'))
        : null;

      return {
        AddressManager: addressManagerArtifact,
        UserWallet: userWalletArtifact,
        GroupPool: groupPoolArtifact
      };
    } catch (error) {
      console.error('❌ Failed to load contract artifacts:', error.message);
      throw error;
    }
  }

  async deployContract(name, artifact, constructorArgs = []) {
    try {
      console.log(`\n🚀 Deploying ${name}...`);

      const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        this.deployer
      );

      // Estimate gas
      const estimatedGas = await factory.getDeployTransaction(...constructorArgs).gasLimit;
      console.log(`⛽ Estimated gas: ${estimatedGas?.toString() || 'unknown'}`);

      // Deploy contract
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: this.gasLimit,
        maxFeePerGas: this.maxFeePerGas,
        maxPriorityFeePerGas: this.maxPriorityFeePerGas
      });

      console.log(`📄 ${name} deployment transaction: ${contract.deploymentTransaction().hash}`);
      console.log('⏳ Waiting for confirmation...');

      // Wait for deployment
      await contract.waitForDeployment();
      const address = await contract.getAddress();

      console.log(`✅ ${name} deployed to: ${address}`);

      // Store deployment info
      this.deployedContracts[name] = {
        address,
        deploymentTransaction: contract.deploymentTransaction().hash,
        abi: artifact.abi,
        deployedAt: new Date().toISOString()
      };

      return contract;
    } catch (error) {
      console.error(`❌ Failed to deploy ${name}:`, error.message);
      throw error;
    }
  }

  async verifyDeployment(name, address, abi) {
    try {
      console.log(`🔍 Verifying ${name} deployment...`);

      const contract = new ethers.Contract(address, abi, this.provider);

      // Basic verification - check if contract exists
      const code = await this.provider.getCode(address);
      if (code === '0x') {
        throw new Error(`No contract code found at ${address}`);
      }

      // Try to call a view function to verify contract is working
      if (name === 'AddressManager') {
        try {
          const totalWallets = await contract.getTotalWallets();
          console.log(`📊 ${name} total wallets: ${totalWallets}`);
        } catch (error) {
          console.warn(`⚠️ Could not verify ${name} functionality:`, error.message);
        }
      }

      console.log(`✅ ${name} verification successful`);
      return true;
    } catch (error) {
      console.error(`❌ ${name} verification failed:`, error.message);
      return false;
    }
  }

  async updateEnvironmentFile() {
    try {
      console.log('\n📝 Updating environment configuration...');

      const envPath = path.join(__dirname, '../.env');
      const envExamplePath = path.join(__dirname, '../.env.example');

      // Read existing .env file or create from example
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      } else if (fs.existsSync(envExamplePath)) {
        envContent = fs.readFileSync(envExamplePath, 'utf8');
        console.log('📋 Creating .env from .env.example');
      }

      // Update contract addresses
      for (const [contractName, info] of Object.entries(this.deployedContracts)) {
        const envVarName = `${contractName.toUpperCase()}_CONTRACT`;
        const pattern = new RegExp(`^${envVarName}=.*$`, 'm');
        const replacement = `${envVarName}=${info.address}`;

        if (pattern.test(envContent)) {
          envContent = envContent.replace(pattern, replacement);
        } else {
          envContent += `\n${replacement}`;
        }

        console.log(`✅ Updated ${envVarName}=${info.address}`);
      }

      // Write updated .env file
      fs.writeFileSync(envPath, envContent);
      console.log('💾 Environment file updated successfully');

      return true;
    } catch (error) {
      console.error('❌ Failed to update environment file:', error.message);
      return false;
    }
  }

  async saveDeploymentRecord() {
    try {
      console.log('\n📋 Saving deployment record...');

      const deploymentsDir = path.join(__dirname, '../deployments');
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }

      const network = await this.provider.getNetwork();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `deployment-${network.name}-${timestamp}.json`;

      const deploymentRecord = {
        network: {
          name: network.name,
          chainId: network.chainId.toString()
        },
        deployer: this.deployer.address,
        timestamp: new Date().toISOString(),
        contracts: this.deployedContracts,
        gasSettings: {
          gasLimit: this.gasLimit,
          maxFeePerGas: this.maxFeePerGas.toString(),
          maxPriorityFeePerGas: this.maxPriorityFeePerGas.toString()
        }
      };

      const filePath = path.join(deploymentsDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(deploymentRecord, null, 2));

      console.log(`📄 Deployment record saved: ${filename}`);

      // Also save as latest.json
      const latestPath = path.join(deploymentsDir, 'latest.json');
      fs.writeFileSync(latestPath, JSON.stringify(deploymentRecord, null, 2));

      return true;
    } catch (error) {
      console.error('❌ Failed to save deployment record:', error.message);
      return false;
    }
  }

  async deployAll() {
    try {
      console.log('🎯 Starting automated contract deployment...\n');

      // Initialize
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Deployment initialization failed');
      }

      // Load artifacts
      const artifacts = await this.loadContractArtifacts();

      // Deploy AddressManager (main contract)
      const addressManager = await this.deployContract(
        'AddressManager',
        artifacts.AddressManager
      );

      // Verify deployment
      await this.verifyDeployment(
        'AddressManager',
        await addressManager.getAddress(),
        artifacts.AddressManager.abi
      );

      // Update environment file
      await this.updateEnvironmentFile();

      // Save deployment record
      await this.saveDeploymentRecord();

      console.log('\n🎉 Contract deployment completed successfully!');
      console.log('\n📋 Deployment Summary:');
      for (const [name, info] of Object.entries(this.deployedContracts)) {
        console.log(`   ${name}: ${info.address}`);
      }

      console.log('\n🔧 Next steps:');
      console.log('1. Update your frontend contract addresses');
      console.log('2. Initialize webhook service with contract addresses');
      console.log('3. Test contract functionality');
      console.log('4. Verify contracts on block explorer (optional)');

      return true;
    } catch (error) {
      console.error('\n💥 Deployment failed:', error.message);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  // Helper method to check if contracts are already deployed
  async checkExistingDeployments() {
    try {
      const latestPath = path.join(__dirname, '../deployments/latest.json');
      if (fs.existsSync(latestPath)) {
        const deployment = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
        console.log('📋 Found existing deployment:');

        for (const [name, info] of Object.entries(deployment.contracts)) {
          console.log(`   ${name}: ${info.address}`);

          // Verify contracts still exist
          const code = await this.provider.getCode(info.address);
          if (code === '0x') {
            console.warn(`⚠️ Contract ${name} at ${info.address} no longer exists`);
          } else {
            console.log(`   ✅ ${name} verified`);
          }
        }

        return deployment;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to check existing deployments:', error.message);
      return null;
    }
  }
}

// CLI usage
async function main() {
  const deployer = new ContractDeployer();

  // Check command line arguments
  const args = process.argv.slice(2);
  const forceRedeploy = args.includes('--force') || args.includes('-f');
  const checkOnly = args.includes('--check') || args.includes('-c');

  if (checkOnly) {
    console.log('🔍 Checking existing deployments...');
    await deployer.initialize();
    await deployer.checkExistingDeployments();
    return;
  }

  if (!forceRedeploy) {
    await deployer.initialize();
    const existing = await deployer.checkExistingDeployments();
    if (existing) {
      console.log('\n❓ Contracts already deployed. Use --force to redeploy.');
      console.log('   Or use --check to verify existing deployments.');
      return;
    }
  }

  const success = await deployer.deployAll();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ContractDeployer;