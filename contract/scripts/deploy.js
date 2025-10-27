const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy contracts
  const deployedContracts = {};

  console.log("\n📦 Deploying AddressManager contract...");
  console.log("ℹ️  AddressManager deploys UserWallet and GroupPool implementations internally");

  const AddressManager = await hre.ethers.getContractFactory("AddressManager");
  const addressManager = await AddressManager.deploy();
  await addressManager.waitForDeployment();
  deployedContracts.addressManager = await addressManager.getAddress();
  console.log("✅ AddressManager deployed to:", deployedContracts.addressManager);

  // Get implementation addresses from AddressManager
  deployedContracts.userWalletImpl = await addressManager.walletImplementation();
  deployedContracts.groupPoolImpl = await addressManager.groupPoolImplementation();

  console.log("✅ UserWallet implementation:", deployedContracts.userWalletImpl);
  console.log("✅ GroupPool implementation:", deployedContracts.groupPoolImpl);

  // Deploy a test ERC20 token for testing purposes (optional)
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("\n📦 Deploying test ERC20 token...");
    const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
    const testToken = await ERC20Mock.deploy("Test Token", "TEST", hre.ethers.parseEther("1000000"));
    await testToken.waitForDeployment();
    deployedContracts.testToken = await testToken.getAddress();
    console.log("✅ Test ERC20 token deployed to:", deployedContracts.testToken);
  }

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("AddressManager:", deployedContracts.addressManager);
  console.log("UserWallet Implementation:", deployedContracts.userWalletImpl);
  console.log("GroupPool Implementation:", deployedContracts.groupPoolImpl);
  if (deployedContracts.testToken) {
    console.log("Test Token:", deployedContracts.testToken);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔗 Block Explorer:");
  if (hre.network.name === "liskSepolia") {
    console.log(`AddressManager: https://sepolia-blockscout.lisk.com/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://sepolia-blockscout.lisk.com/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://sepolia-blockscout.lisk.com/address/${deployedContracts.groupPoolImpl}`);
  } else if (hre.network.name === "lisk") {
    console.log(`AddressManager: https://blockscout.lisk.com/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://blockscout.lisk.com/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://blockscout.lisk.com/address/${deployedContracts.groupPoolImpl}`);
  } else if (hre.network.name === "polygonMumbai") {
    console.log(`AddressManager: https://mumbai.polygonscan.com/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://mumbai.polygonscan.com/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://mumbai.polygonscan.com/address/${deployedContracts.groupPoolImpl}`);
  } else if (hre.network.name === "polygon") {
    console.log(`AddressManager: https://polygonscan.com/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://polygonscan.com/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://polygonscan.com/address/${deployedContracts.groupPoolImpl}`);
  } else if (hre.network.name === "optimismSepolia") {
    console.log(`AddressManager: https://sepolia-optimism.etherscan.io/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://sepolia-optimism.etherscan.io/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://sepolia-optimism.etherscan.io/address/${deployedContracts.groupPoolImpl}`);
  } else if (hre.network.name === "optimism") {
    console.log(`AddressManager: https://optimistic.etherscan.io/address/${deployedContracts.addressManager}`);
    console.log(`UserWallet: https://optimistic.etherscan.io/address/${deployedContracts.userWalletImpl}`);
    console.log(`GroupPool: https://optimistic.etherscan.io/address/${deployedContracts.groupPoolImpl}`);
  }

  console.log("\n📝 Next Steps:");
  console.log("1. Add these to your backend .env file:");
  console.log(`   ADDRESS_MANAGER_CONTRACT=${deployedContracts.addressManager}`);
  console.log(`   USER_WALLET_IMPLEMENTATION=${deployedContracts.userWalletImpl}`);
  console.log(`   GROUP_POOL_IMPLEMENTATION=${deployedContracts.groupPoolImpl}`);
  if (deployedContracts.testToken) {
    console.log(`   TEST_TOKEN_CONTRACT=${deployedContracts.testToken}`);
  }
  console.log(`   RPC_URL=${hre.network.config.url}`);
  console.log("\n2. Verify contracts (optional):");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${deployedContracts.addressManager}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${deployedContracts.userWalletImpl}`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${deployedContracts.groupPoolImpl}`);
  console.log("\n3. Fund your backend wallet with native tokens");
  console.log("   (ETH for Ethereum, MATIC for Polygon, LSK for Lisk)");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    contracts: deployedContracts,
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `${deploymentsDir}/${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
