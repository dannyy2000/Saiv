# Optimism Sepolia Testnet Setup Guide 🚀

## Overview

You've decided to deploy on **Optimism Sepolia Testnet** - great choice! This gives you:
- ✅ **Aave V3** support for yield generation
- ✅ **Real stablecoins**: USDC, USDT, DAI
- ✅ **Very cheap gas fees** (~$0.01 per transaction)
- ✅ **Free testnet tokens** from faucets
- ✅ **Similar to mainnet** for realistic testing

---

## 📋 Network Information

### Optimism Sepolia Details:
- **Chain ID**: `11155420`
- **RPC URL**: `https://sepolia.optimism.io`
- **Block Explorer**: https://sepolia-optimism.etherscan.io/
- **Currency**: ETH (for gas)

### Aave V3 on Optimism Sepolia:
- **Pool Address**: `0xb50201558B00496A145fE76f7424749556E326D8`
- **Pool Data Provider**: `0x9546F673eF71Ff666ae66d01Fd6E7C6Dae5a9995`

---

## 🛠️ Backend Setup

### 1. Update Environment Variables

Edit `/home/danielakinsanya/Saiv/backend/.env`:

```env
# ========================================
# OPTIMISM SEPOLIA TESTNET CONFIGURATION
# ========================================

# Network Configuration
RPC_URL=https://sepolia.optimism.io
NETWORK_NAME=optimism-sepolia
CHAIN_ID=11155420

# Admin Wallet (Backend wallet that pays gas)
# ⚠️ IMPORTANT: Fund this wallet with Sepolia ETH for gas
ADMIN_PRIVATE_KEY=your_private_key_here

# Contract Addresses (Update after deploying)
ADDRESS_MANAGER_CONTRACT=0x_your_deployed_address_manager
# ... other contract addresses

# Aave Configuration
AAVE_POOL_ADDRESS=0xb50201558B00496A145fE76f7424749556E326D8
AAVE_LENDING_POOL_ADDRESS=0xb50201558B00496A145fE76f7424749556E326D8

# Database
MONGODB_URI=mongodb://localhost:27017/saiv_testnet
# Or use MongoDB Atlas for production

# Security
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters

# Email Service (Optional)
EMAIL_SERVICE_PROVIDER=sendgrid
EMAIL_SERVICE_API_KEY=your_sendgrid_api_key
EMAIL_FROM_ADDRESS=noreply@saiv.platform
EMAIL_FROM_NAME=Saiv Platform

# Port
PORT=3001
NODE_ENV=development
```

---

## 🪙 Getting Testnet Tokens

### Step 1: Get Sepolia ETH (for gas)

Your admin wallet needs ETH to pay for gas fees.

**Option 1: Optimism Sepolia Faucet**
1. Go to: https://app.optimism.io/faucet
2. Connect your wallet
3. Select "Optimism Sepolia"
4. Request test ETH

**Option 2: Superchain Faucet**
1. Go to: https://www.superchain-tools.xyz/faucets
2. Connect wallet
3. Request OP Sepolia ETH

**Option 3: Bridge from Ethereum Sepolia**
1. Get Sepolia ETH from: https://sepoliafaucet.com/
2. Bridge to OP Sepolia: https://app.optimism.io/bridge

### Step 2: Get Test Stablecoins

**USDC on Optimism Sepolia:**
- Address: `0x5fd84259d66Cd46123540766Be93DFE6D43130D7`
- Get from: https://faucet.circle.com/ (select Optimism Sepolia)

**Alternative - Use Aave Faucet:**
1. Go to: https://staging.aave.com/faucet/
2. Connect wallet
3. Select Optimism Sepolia
4. Request USDC, USDT, DAI

---

## 🔧 Contract Deployment

### 1. Deploy Contracts to Optimism Sepolia

```bash
cd /home/danielakinsanya/Saiv/contract

# Make sure you have hardhat config for Optimism Sepolia
npx hardhat run scripts/deploy.js --network optimism-sepolia
```

### 2. Update hardhat.config.js

Add Optimism Sepolia network:

```javascript
module.exports = {
  networks: {
    'optimism-sepolia': {
      url: 'https://sepolia.optimism.io',
      accounts: [process.env.PRIVATE_KEY], // Your deployer private key
      chainId: 11155420
    }
  }
};
```

### 3. Save Contract Addresses

After deployment, update `.env` with:
- `ADDRESS_MANAGER_CONTRACT`
- Any other deployed contract addresses

---

## 🚀 Testing the Complete Flow

### Test 1: Backend Services
```bash
cd /home/danielakinsanya/Saiv/backend
npm start
```

Check logs for:
- ✅ Token Service initialized (should show USDC, USDT, DAI)
- ✅ Gasless Service enabled
- ✅ Aave Service enabled

### Test 2: Create Test User

```bash
# Register a test user
curl -X POST http://localhost:3001/api/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

This should:
1. Create Main Wallet + Savings Wallet
2. Automatically add USDC, USDT, DAI to both wallets
3. All gasless!

### Test 3: Deposit Tokens

1. Get Main Wallet address from registration response
2. Send test USDC to Main Wallet address
3. Check balance: `http://localhost:3001/api/wallet/balance`

### Test 4: Transfer to Savings

Use the frontend or API:
```bash
curl -X POST http://localhost:3001/api/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": "10",
    "tokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    "fromWallet": "main",
    "toWallet": "savings"
  }'
```

### Test 5: Verify Aave Integration

Check Savings Wallet balance on Aave:
- Go to: https://staging.aave.com/
- Connect with Savings Wallet address
- Should see deposited tokens earning yield

---

## 📊 Supported Tokens on Optimism Sepolia

| Token | Address | Decimals | Aave Support |
|-------|---------|----------|--------------|
| USDC  | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` | 6 | ✅ |
| USDT  | `0x8B8B06ff1c8Ac51E6ED5b6e7Df4B8D3c0E6F3c4B` | 6 | ❌ |
| DAI   | `0x68f180fcCe6836688e9084f035309E29Bf0A2095` | 18 | ✅ |

*Note: USDT may not have Aave support on testnet*

---

## 🌐 Frontend Configuration

Update `/home/danielakinsanya/Saiv/frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_NETWORK=optimism-sepolia
NEXT_PUBLIC_CHAIN_ID=11155420
```

---

## 🔍 Monitoring & Debugging

### Check Transaction Status
- Explorer: https://sepolia-optimism.etherscan.io/
- Paste transaction hash to see details

### Check Contract State
```bash
# Get wallet balances
curl http://localhost:3001/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get supported tokens
curl http://localhost:3001/api/wallet/supported-tokens \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Common Issues

**Issue**: "ECONNREFUSED 127.0.0.1:8545"
- **Fix**: Update `RPC_URL` to `https://sepolia.optimism.io`

**Issue**: "Insufficient funds for gas"
- **Fix**: Fund admin wallet with Sepolia ETH from faucet

**Issue**: Token balances show 0
- **Fix**: Make sure tokens are deposited to Main Wallet address

**Issue**: Transfer fails
- **Fix**: Ensure tokens were added to wallet (check wallet initialization logs)

---

## 📱 MetaMask Setup for Users

Users need to add Optimism Sepolia to MetaMask:

1. Open MetaMask
2. Click network dropdown
3. Click "Add Network"
4. Enter:
   - **Network Name**: Optimism Sepolia
   - **RPC URL**: https://sepolia.optimism.io
   - **Chain ID**: 11155420
   - **Currency**: ETH
   - **Block Explorer**: https://sepolia-optimism.etherscan.io/

---

## 🎯 What Works Now

✅ **Registration**: Creates both wallets automatically
✅ **Deposits**: Users can deposit USDC/USDT/DAI from MetaMask
✅ **Balance Display**: Shows individual token balances
✅ **Transfers**: Main → Savings with token selector
✅ **Aave Integration**: Automatic yield on savings
✅ **Gasless**: Backend pays all gas fees
✅ **Multi-token**: USDC, USDT, DAI support

---

## 🔒 Security Checklist

Before going to testnet:
- [ ] Admin private key is secure
- [ ] MongoDB is password protected
- [ ] JWT_SECRET is strong and random
- [ ] Rate limiting is enabled
- [ ] CORS is configured correctly
- [ ] Environment variables are set
- [ ] Contracts are verified on explorer
- [ ] Test with small amounts first

---

## 📈 Next Steps

### Immediate:
1. ✅ Fund admin wallet with Sepolia ETH
2. ✅ Deploy contracts to Optimism Sepolia
3. ✅ Update `.env` with contract addresses
4. ✅ Start backend and test

### Short Term:
1. Deploy frontend to Vercel/Netlify
2. Test complete user flow
3. Add transaction history
4. Monitor gas usage

### Before Mainnet:
1. Security audit
2. Stress testing
3. Gas optimization
4. User documentation
5. Support system

---

## 🆘 Need Help?

- **Optimism Docs**: https://docs.optimism.io/
- **Aave V3 Docs**: https://docs.aave.com/
- **OP Sepolia Faucet**: https://app.optimism.io/faucet
- **Block Explorer**: https://sepolia-optimism.etherscan.io/

---

## 🎉 Summary

You're now configured for:
- ✅ Optimism Sepolia testnet
- ✅ Multiple stablecoins (USDC, USDT, DAI)
- ✅ Aave yield integration
- ✅ Gasless transactions
- ✅ Beautiful UI with token selection

**Time to test!** 🚀

Fund your admin wallet → Deploy contracts → Start backend → Test the flow!
