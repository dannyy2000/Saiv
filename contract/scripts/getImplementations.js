const hre = require("hardhat");

async function main() {
  const addressManagerAddress = "0x807035ec27D5A09424029F71Ca394a051618640f";

  console.log("Fetching implementation addresses from AddressManager...");
  console.log("AddressManager:", addressManagerAddress);

  const addressManager = await hre.ethers.getContractAt("AddressManager", addressManagerAddress);

  const walletImpl = await addressManager.walletImplementation();
  const poolImpl = await addressManager.groupPoolImplementation();

  console.log("\n✅ Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("AddressManager:           ", addressManagerAddress);
  console.log("UserWallet Implementation:", walletImpl);
  console.log("GroupPool Implementation: ", poolImpl);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n📋 Add to backend .env:");
  console.log(`ADDRESS_MANAGER_CONTRACT=${addressManagerAddress}`);
  console.log(`USER_WALLET_IMPLEMENTATION=${walletImpl}`);
  console.log(`GROUP_POOL_IMPLEMENTATION=${poolImpl}`);
  console.log(`RPC_URL=https://sepolia.optimism.io`);
  console.log(`CHAIN_ID=11155420`);

  console.log("\n🔗 Block Explorer:");
  console.log(`AddressManager: https://sepolia-optimism.etherscan.io/address/${addressManagerAddress}`);
  console.log(`UserWallet: https://sepolia-optimism.etherscan.io/address/${walletImpl}`);
  console.log(`GroupPool: https://sepolia-optimism.etherscan.io/address/${poolImpl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
