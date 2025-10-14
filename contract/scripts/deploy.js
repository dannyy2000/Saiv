const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  console.log("\n📦 Deploying AddressManager contract...");

  const AddressManager = await hre.ethers.getContractFactory("AddressManager");
  const addressManager = await AddressManager.deploy();

  await addressManager.waitForDeployment();
  const addressManagerAddress = await addressManager.getAddress();

  console.log("✅ AddressManager deployed to:", addressManagerAddress);

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("AddressManager:", addressManagerAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n🔗 Block Explorer:");
  if (hre.network.name === "liskSepolia") {
    console.log(`https://sepolia-blockscout.lisk.com/address/${addressManagerAddress}`);
  } else if (hre.network.name === "lisk") {
    console.log(`https://blockscout.lisk.com/address/${addressManagerAddress}`);
  } else if (hre.network.name === "polygonMumbai") {
    console.log(`https://mumbai.polygonscan.com/address/${addressManagerAddress}`);
  } else if (hre.network.name === "polygon") {
    console.log(`https://polygonscan.com/address/${addressManagerAddress}`);
  }

  console.log("\n📝 Next Steps:");
  console.log("1. Add this to your backend .env file:");
  console.log(`   ADDRESS_MANAGER_CONTRACT=${addressManagerAddress}`);
  console.log(`   RPC_URL=${hre.network.config.url}`);
  console.log("\n2. Verify contract (optional):");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${addressManagerAddress}`);
  console.log("\n3. Fund your backend wallet with native tokens");
  console.log("   (ETH for Ethereum, MATIC for Polygon, LSK for Lisk)");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    addressManager: addressManagerAddress,
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
