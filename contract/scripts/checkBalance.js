const hre = require("hardhat");

async function main() {
  console.log("Checking wallet balance...");
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);

  const [signer] = await hre.ethers.getSigners();
  const address = signer.address;

  console.log("\n📍 Wallet Address:", address);

  const balance = await hre.ethers.provider.getBalance(address);
  const balanceInEth = hre.ethers.formatEther(balance);

  console.log("💰 Balance:", balanceInEth, getNetworkToken());
  console.log("   (", balance.toString(), "wei )");

  const balanceNum = parseFloat(balanceInEth);
  if (balanceNum < 0.01) {
    console.log("\n⚠️  WARNING: Balance is very low!");
    console.log("   You may not have enough funds to deploy contracts.");
    console.log("\n   Get funds from:");
    if (hre.network.name === "liskSepolia") {
      console.log("   - Lisk Sepolia Faucet: https://sepolia-faucet.lisk.com");
    } else if (hre.network.name === "lisk") {
      console.log("   - Buy LSK from exchanges (Binance, Kraken, etc.)");
    } else if (hre.network.name === "polygonMumbai") {
      console.log("   - Polygon Mumbai Faucet: https://faucet.polygon.technology");
    } else if (hre.network.name === "polygon") {
      console.log("   - Buy MATIC from exchanges");
    }
  } else if (balanceNum < 0.1) {
    console.log("\n⚡ Balance is acceptable for deployment");
  } else {
    console.log("\n✅ Balance is good!");
  }

  console.log("\n🔗 View on Explorer:");
  console.log(getExplorerUrl(address));

  const gasPrice = await hre.ethers.provider.getFeeData();
  console.log("\n⛽ Current Gas Price:", hre.ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"), "gwei");

  console.log("\n📊 Estimated Deployment Costs:");
  const deploymentGas = 3000000n; // Estimated gas for deployment
  const deploymentCost = deploymentGas * (gasPrice.gasPrice || 0n);
  console.log("   Deployment: ~", hre.ethers.formatEther(deploymentCost), getNetworkToken());
  console.log("   (at current gas price)");
}

function getNetworkToken() {
  const network = hre.network.name;
  if (network.includes("lisk")) return "LSK";
  if (network.includes("polygon")) return "MATIC";
  return "ETH";
}

function getExplorerUrl(address) {
  const network = hre.network.name;
  if (network === "liskSepolia") {
    return `https://sepolia-blockscout.lisk.com/address/${address}`;
  } else if (network === "lisk") {
    return `https://blockscout.lisk.com/address/${address}`;
  } else if (network === "polygonMumbai") {
    return `https://mumbai.polygonscan.com/address/${address}`;
  } else if (network === "polygon") {
    return `https://polygonscan.com/address/${address}`;
  }
  return `Localhost - no explorer`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
