# Smart Contract Deployment Guide

## Lisk Network Deployment

This guide covers deploying the AddressManager contract to Lisk Sepolia (testnet) and Lisk Mainnet.

## Prerequisites

1. **Node.js & npm** installed
2. **Hardhat** installed (included in dependencies)
3. **Wallet with funds**:
   - Lisk Sepolia: Get free testnet LSK from faucet
   - Lisk Mainnet: Purchase LSK tokens

## Network Information

### Lisk Sepolia Testnet
- **Chain ID**: 4202
- **RPC URL**: https://rpc.sepolia-api.lisk.com
- **Block Explorer**: https://sepolia-blockscout.lisk.com
- **Faucet**: https://sepolia-faucet.lisk.com

### Lisk Mainnet
- **Chain ID**: 1135
- **RPC URL**: https://rpc.api.lisk.com
- **Block Explorer**: https://blockscout.lisk.com
- **Native Token**: LSK

## Setup

### 1. Install Dependencies

```bash
cd contract
npm install
npm install --save-dev dotenv
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Your deployer wallet private key
PRIVATE_KEY=0xYourPrivateKeyHere
```

**Generate a new wallet (if needed)**:
```javascript
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

### 3. Fund Your Wallet

#### Lisk Sepolia (Testnet)
1. Visit: https://sepolia-faucet.lisk.com
2. Enter your deployer address
3. Request testnet LSK tokens
4. Wait for confirmation

#### Lisk Mainnet
1. Purchase LSK from exchanges (Binance, Kraken, etc.)
2. Transfer to your deployer address
3. Keep ~0.5-1 LSK for deployment gas

### 4. Verify Balance

```bash
npx hardhat run scripts/checkBalance.js --network liskSepolia
```

Or manually check on block explorer.

## Deployment

### Deploy to Lisk Sepolia (Testnet)

```bash
npx hardhat run scripts/deploy.js --network liskSepolia
```

Expected output:
```
Starting deployment...
Network: liskSepolia
Deploying contracts with account: 0x742d35Cc...
Account balance: 10.0 ETH

📦 Deploying AddressManager contract...
✅ AddressManager deployed to: 0x1234567890abcdef...

📋 Deployment Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network: liskSepolia
Chain ID: 4202
Deployer: 0x742d35Cc...
AddressManager: 0x1234567890abcdef...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Block Explorer:
https://sepolia-blockscout.lisk.com/address/0x1234567890abcdef...

📝 Next Steps:
1. Add this to your backend .env file:
   ADDRESS_MANAGER_CONTRACT=0x1234567890abcdef...
   RPC_URL=https://rpc.sepolia-api.lisk.com
```

### Deploy to Lisk Mainnet

⚠️ **WARNING**: Deploying to mainnet costs real money!

```bash
# Double-check everything first
npx hardhat compile

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network lisk
```

## Post-Deployment

### 1. Verify Contract (Optional)

Lisk uses Blockscout, which may auto-verify. If not:

```bash
npx hardhat verify --network liskSepolia 0xYourContractAddress
```

### 2. Update Backend Configuration

Copy the deployed contract address to backend `.env`:

```env
# Backend .env
ADDRESS_MANAGER_CONTRACT=0xYourDeployedContractAddress
RPC_URL=https://rpc.sepolia-api.lisk.com  # or mainnet URL
ADMIN_PRIVATE_KEY=0xYourBackendWalletPrivateKey
```

### 3. Fund Backend Wallet

The backend wallet (different from deployer) needs LSK for gasless operations:

```bash
# For testnet
Send 5-10 LSK to backend wallet address

# For mainnet
Send 50-100 LSK to backend wallet address
```

### 4. Test Deployment

Test the deployment:

```bash
# Start backend
cd ../backend
npm run dev

# Check if gasless service initialized
curl http://localhost:3001/api/gas/status
```

Expected response:
```json
{
  "success": true,
  "data": {
    "gaslessEnabled": true,
    "contractAddress": "0x1234...",
    "backendWallet": {
      "address": "0x742d...",
      "balance": "10.5"
    },
    "features": {
      "gaslessRegistration": true,
      "gaslessGroupCreation": true,
      "userPaysNothing": true
    }
  }
}
```

## Gas Cost Estimates

### Lisk Sepolia (Testnet)
- **Deployment**: ~0.015 LSK (FREE with faucet)
- **User Registration**: ~0.0005 LSK per user
- **Group Creation**: ~0.001 LSK per group

### Lisk Mainnet
- **Deployment**: ~0.015 LSK (~$0.02)
- **User Registration**: ~0.0005 LSK per user (~$0.0006)
- **Group Creation**: ~0.001 LSK per group (~$0.0012)

**Monthly Cost Examples (Mainnet)**:
- 1,000 users: ~$0.60
- 500 groups: ~$0.60
- Total: ~$1.20/month for 1,000 active users

💡 **Much cheaper than Ethereum mainnet!**

## Troubleshooting

### "Insufficient funds for gas"

**Problem**: Deployer wallet doesn't have enough LSK.

**Solution**:
```bash
# Check balance
npx hardhat run scripts/checkBalance.js --network liskSepolia

# Get more from faucet (testnet)
# Or buy more LSK (mainnet)
```

### "nonce has already been used"

**Problem**: Transaction already submitted.

**Solution**:
```bash
# Wait for previous transaction to complete
# Check on block explorer
# Try again in 30 seconds
```

### "Cannot connect to network"

**Problem**: RPC endpoint unreachable.

**Solution**:
- Check internet connection
- Verify RPC URL in `hardhat.config.js`
- Try alternative RPC: `https://rpc.sepolia-api.lisk.com`

### Deployment times out

**Problem**: Network congestion.

**Solution**:
- Wait and retry
- Increase timeout in script
- Check network status on block explorer

## Network Comparison

| Network | Gas Cost | Speed | Recommended For |
|---------|----------|-------|-----------------|
| **Lisk Sepolia** | FREE | Fast | Development & Testing |
| **Lisk Mainnet** | Very Low | Fast | Production |
| Polygon Mumbai | FREE | Medium | Alternative Testnet |
| Polygon | Low | Medium | Alternative Mainnet |
| Ethereum | High | Medium | Not Recommended |

## Group Identifier Format

Groups are identified by: `{userMainAddress}_{timestamp}`

Example:
```
0x742d35Cc6634C0532925a3b8D0Ed62FDa2c0e7A6_1697123456789
```

Where:
- `0x742d35Cc...` is the user's main wallet address
- `1697123456789` is the Unix timestamp

This ensures:
- ✅ Unique group identifiers
- ✅ Traceable to user's main wallet
- ✅ Time-ordered groups
- ✅ Easy querying by user address

## Additional Scripts

### Check Contract Owner

```bash
npx hardhat run scripts/checkOwner.js --network liskSepolia
```

### Transfer Ownership

```bash
npx hardhat run scripts/transferOwnership.js --network liskSepolia
```

### Interact with Contract

```bash
npx hardhat console --network liskSepolia
```

Then in console:
```javascript
const AddressManager = await ethers.getContractFactory("AddressManager");
const contract = await AddressManager.attach("0xYourContractAddress");

// Check total wallets
const total = await contract.getTotalWallets();
console.log("Total wallets:", total.toString());

// Check total groups
const groups = await contract.getTotalGroupPools();
console.log("Total groups:", groups.toString());
```

## Security Checklist

Before mainnet deployment:

- [ ] Code reviewed and audited
- [ ] Tests passing (run `npx hardhat test`)
- [ ] `.env` file in `.gitignore`
- [ ] Deployer private key secured
- [ ] Backend wallet private key secured
- [ ] Sufficient funds in both wallets
- [ ] Network configuration verified
- [ ] Contract ownership verified
- [ ] Backup of private keys stored securely

## Support

- **Lisk Docs**: https://docs.lisk.com
- **Lisk Discord**: https://lisk.chat
- **Block Explorer**: https://blockscout.lisk.com
- **GitHub Issues**: Report issues in project repo

## Quick Commands Reference

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.js --network liskSepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network lisk

# Verify contract
npx hardhat verify --network liskSepolia 0xContractAddress

# Check network
npx hardhat run scripts/checkBalance.js --network liskSepolia

# Console
npx hardhat console --network liskSepolia
```
