# Gasless Transactions Guide

## Overview

This platform implements **100% gasless transactions** for all users. Users never need to:
- Pay gas fees
- Sign blockchain transactions
- Have ETH/MATIC in their wallet
- Understand blockchain concepts

The backend handles ALL blockchain interactions and pays ALL gas fees.

## How It Works

### Architecture

```
User Action → Backend API → Gasless Service → Smart Contract
                ↓
         Backend Wallet Pays Gas
```

1. **User Makes Request** (Register, Create Group, etc.)
2. **Backend Receives Request** via REST API
3. **Gasless Service Executes** blockchain transaction using backend wallet
4. **Backend Pays Gas** for the transaction
5. **User Gets Result** instantly - no gas payment needed

### Gasless Operations

#### ✅ Registration (FREE)
```javascript
POST /api/auth/register/email
{
  "email": "user@example.com"
}
```
- Creates 2 smart contract wallets (main + savings)
- User pays: **$0.00**
- Backend pays: ~$0.50-5.00 (depending on network)

#### ✅ Create Group (FREE)
```javascript
POST /api/groups
{
  "name": "My Savings Group",
  "description": "Monthly savings",
  "paymentWindowDuration": 2592000
}
```
- Deploys group pool contract
- User pays: **$0.00**
- Backend pays: ~$1.00-10.00 (depending on network)

#### ✅ Join Group (FREE)
```javascript
POST /api/groups/:groupId/join
```
- Adds user to group pool contract
- User pays: **$0.00**
- Backend pays: ~$0.20-2.00

## Setup

### 1. Create Backend Wallet

Generate a new wallet for the backend:

```javascript
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();

console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

**IMPORTANT**: Keep the private key secure! This wallet will pay for all gas fees.

### 2. Fund Backend Wallet

The backend wallet needs native tokens to pay gas:

- **Local/Testnet**: Get free testnet tokens from faucet
- **Polygon Mumbai**: https://faucet.polygon.technology/
- **Polygon Mainnet**: Transfer MATIC to backend wallet

**Recommended Balance**:
- Development: 1-5 MATIC
- Production: 100+ MATIC (for ~1000-10000 operations)

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update the following:

```env
# Backend wallet private key (pays all gas)
ADMIN_PRIVATE_KEY=0x1234567890abcdef...

# Blockchain RPC endpoint
RPC_URL=https://polygon-rpc.com

# Deployed AddressManager contract address
ADDRESS_MANAGER_CONTRACT=0xYourContractAddress...
```

### 4. Deploy Smart Contracts

Deploy the AddressManager contract:

```bash
cd ../contract
npx hardhat run scripts/deploy.js --network polygonMumbai
```

Copy the deployed contract address to `.env`:

```env
ADDRESS_MANAGER_CONTRACT=0xDeployedAddressHere
```

### 5. Start Backend

```bash
npm run dev
```

You should see:

```
✅ GASLESS SERVICE ENABLED - Users pay NO gas fees
   - Registration: FREE (backend pays gas)
   - Create Group: FREE (backend pays gas)
   - Join Group: FREE (backend pays gas)
Backend wallet initialized: 0x742d35Cc...
Backend wallet balance: 150.5 MATIC
```

## Monitoring Gas Usage

### Check Backend Wallet Balance

```bash
GET /api/gas/backend-wallet
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "address": "0x742d35Cc6634C0532925a3b8D0Ed62FDa2c0e7A6",
    "balance": "150.5",
    "status": "ready"
  }
}
```

### Get Gas Estimates

```bash
GET /api/gas/estimates
```

Response:
```json
{
  "success": true,
  "data": {
    "userCreation": {
      "gasLimit": "450000",
      "gasPrice": "30000000000",
      "estimatedCost": "0.0135",
      "operation": "User Wallet Creation"
    },
    "groupCreation": {
      "gasLimit": "750000",
      "gasPrice": "30000000000",
      "estimatedCost": "0.0225",
      "operation": "Group Pool Creation"
    }
  }
}
```

### Check Gasless Status

```bash
GET /api/gas/status
```

Response:
```json
{
  "success": true,
  "data": {
    "gaslessEnabled": true,
    "contractAddress": "0x1234...",
    "backendWallet": {
      "address": "0x742d...",
      "balance": "150.5"
    },
    "features": {
      "gaslessRegistration": true,
      "gaslessGroupCreation": true,
      "userPaysNothing": true
    }
  }
}
```

## Cost Estimation

### Polygon Mainnet (Recommended)

| Operation | Gas Used | Cost @ 30 gwei | Cost @ $0.80/MATIC |
|-----------|----------|----------------|---------------------|
| Registration | ~450,000 | 0.0135 MATIC | $0.01 |
| Create Group | ~750,000 | 0.0225 MATIC | $0.02 |
| Join Group | ~100,000 | 0.003 MATIC | $0.002 |

**Monthly Cost Examples**:
- 1,000 registrations: ~$10
- 500 groups created: ~$10
- Total: ~$20/month for 1,000 users

### Ethereum Mainnet (Expensive)

| Operation | Gas Used | Cost @ 30 gwei | Cost @ $3,000/ETH |
|-----------|----------|----------------|-------------------|
| Registration | ~450,000 | 0.0135 ETH | $40.50 |
| Create Group | ~750,000 | 0.0225 ETH | $67.50 |

**Not recommended for production due to high costs!**

## Security Best Practices

### 1. Secure Private Key Storage

**Development**:
```env
ADMIN_PRIVATE_KEY=0x1234...
```

**Production** (Use secrets management):
- AWS Secrets Manager
- HashiCorp Vault
- Environment variables via CI/CD

### 2. Rate Limiting

Implement rate limits to prevent gas drainage:

```javascript
// In your auth routes
const rateLimit = require('express-rate-limit');

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registrations per IP
  message: 'Too many registration attempts'
});

router.post('/register/email', registrationLimiter, authController.registerWithEmail);
```

### 3. Monitor Backend Wallet

Set up alerts when balance is low:

```javascript
// Add to cron job or monitoring service
const balance = await gaslessService.getBackendWalletBalance();
if (parseFloat(balance.balance) < 10) {
  // Send alert to admin
  console.error('⚠️ LOW BALANCE: Backend wallet needs refill!');
}
```

### 4. Transaction Validation

Always validate requests before executing gasless transactions:

```javascript
// Prevent duplicate registrations
const existingUser = await User.findOne({ email });
if (existingUser) {
  return res.status(400).json({ message: 'User already exists' });
}

// Validate group before creation
if (!name || name.length < 3) {
  return res.status(400).json({ message: 'Invalid group name' });
}
```

## Troubleshooting

### Gasless Service Not Initializing

**Symptom**:
```
⚠️ Gasless service disabled - Check ADMIN_PRIVATE_KEY in .env
```

**Solution**:
1. Check `.env` file has `ADMIN_PRIVATE_KEY`
2. Verify private key format (starts with `0x`)
3. Ensure backend wallet has sufficient balance

### Transactions Failing

**Symptom**:
```
Error creating user wallets gasless: insufficient funds
```

**Solution**:
1. Check backend wallet balance: `GET /api/gas/backend-wallet`
2. Fund the wallet with native tokens
3. Verify RPC_URL is correct

### High Gas Costs

**Solution**:
1. Switch to Layer 2 (Polygon, Arbitrum)
2. Use gas price optimization
3. Batch transactions when possible

## FAQ

### Q: Do users need crypto to use the platform?
**A**: No! Everything is gasless. Users only need an email address.

### Q: Can users still send/receive crypto?
**A**: Yes! The wallets created can hold and transact crypto normally.

### Q: What happens if backend wallet runs out of funds?
**A**: Gasless operations will fail. Set up monitoring and alerts.

### Q: Is this secure?
**A**: Yes! Users have full control of their wallets. Backend only pays gas fees.

### Q: Can I switch from gasless to user-paid later?
**A**: Yes, but requires smart contract and frontend changes.

## Support

For issues or questions:
- Check logs: Backend shows detailed gasless operation logs
- Monitor gas usage: Use `/api/gas/*` endpoints
- Review transactions: Check blockchain explorer with backend wallet address
