# Saiv Platform Backend

Backend API for the Saiv platform - a Web3 savings and group management platform with **100% gasless transactions**.

## Features

### 🚀 Gasless Transactions
- **Users pay ZERO gas fees**
- Registration, group creation, and all blockchain operations are FREE
- Backend wallet pays all gas fees
- See [GASLESS_TRANSACTIONS.md](./GASLESS_TRANSACTIONS.md) for details

### 👤 User Management
- **Email Registration**: Passwordless authentication via Web3Auth
- **Wallet Registration**: Connect with existing EOA wallets
- Automatic wallet creation (main + savings wallets)
- JWT authentication

### 👥 Group Management
- Create savings groups with pool addresses
- Join/leave groups
- Member management (admin/member roles)
- Configurable group settings (max members, min contribution)

### 💰 Wallet Operations
- Check ETH/token balances
- Send ETH and ERC-20 tokens
- Transaction history
- Gas estimation
- Multi-token support

### 📊 Gas Monitoring
- Real-time backend wallet balance
- Gas cost estimates
- Service status checks

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/saiv_platform

# Security
JWT_SECRET=your_secret_key_here_at_least_32_characters

# Blockchain (Polygon Mumbai Testnet)
RPC_URL=https://rpc-mumbai.maticvigil.com

# Backend Wallet (Pays all gas fees)
ADMIN_PRIVATE_KEY=0xYourPrivateKeyHere

# Deployed Contract
ADDRESS_MANAGER_CONTRACT=0xYourContractAddressHere
```

### 3. Start MongoDB

```bash
mongod
```

### 4. Deploy Smart Contracts

```bash
cd ../contract
npx hardhat run scripts/deploy.js --network polygonMumbai
```

Copy the contract address to `.env`.

### 5. Fund Backend Wallet

Get testnet MATIC from: https://faucet.polygon.technology/

Send to your backend wallet address.

### 6. Start Server

```bash
npm run dev
```

You should see:

```
✅ GASLESS SERVICE ENABLED - Users pay NO gas fees
   - Registration: FREE (backend pays gas)
   - Create Group: FREE (backend pays gas)
   - Join Group: FREE (backend pays gas)
Backend wallet balance: 5.0 MATIC
Server is running on port 3001
```

## API Endpoints

### Authentication

```bash
# Register with Email (GASLESS)
POST /api/auth/register/email
{
  "email": "user@example.com"
}

# Register with Wallet (GASLESS)
POST /api/auth/register/wallet
{
  "eoaAddress": "0x742d35Cc6634C0532925a3b8D0Ed62FDa2c0e7A6"
}

# Get Profile
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

### Groups

```bash
# Create Group (GASLESS)
POST /api/groups
Authorization: Bearer <jwt_token>
{
  "name": "Monthly Savings",
  "description": "Save $100/month",
  "paymentWindowDuration": 2592000
}

# Get User Groups
GET /api/groups
Authorization: Bearer <jwt_token>

# Join Group (GASLESS)
POST /api/groups/:groupId/join
Authorization: Bearer <jwt_token>
```

### Wallet

```bash
# Get Balance
GET /api/wallet/balance
Authorization: Bearer <jwt_token>

# Send ETH
POST /api/wallet/send-eth
Authorization: Bearer <jwt_token>
{
  "to": "0x742d35Cc6634C0532925a3b8D0Ed62FDa2c0e7A6",
  "amount": "0.1"
}

# Get Token Balance
GET /api/wallet/token-balance?tokenAddress=0x...
Authorization: Bearer <jwt_token>
```

### Gas Monitoring

```bash
# Check Gasless Status
GET /api/gas/status

# Get Backend Wallet Balance
GET /api/gas/backend-wallet
Authorization: Bearer <jwt_token>

# Get Gas Estimates
GET /api/gas/estimates
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── web3auth.js          # Web3Auth config
│   ├── controllers/
│   │   ├── authController.js    # User registration/login
│   │   ├── groupController.js   # Group management
│   │   ├── walletController.js  # Wallet operations
│   │   └── gasController.js     # Gas monitoring
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   └── validation.js       # Input validation
│   ├── models/
│   │   ├── User.js             # User schema
│   │   └── Group.js            # Group schema
│   ├── routes/
│   │   ├── auth.js             # Auth routes
│   │   ├── groups.js           # Group routes
│   │   ├── wallet.js           # Wallet routes
│   │   ├── gas.js              # Gas routes
│   │   └── index.js            # Route aggregator
│   ├── services/
│   │   ├── gaslessService.js   # 🌟 Gasless transaction handler
│   │   ├── contractService.js  # Smart contract interactions
│   │   └── walletService.js    # Wallet operations
│   ├── app.js                  # Express app setup
│   └── server.js               # Server entry point
├── tests/                      # Test files
├── .env.example               # Environment template
├── GASLESS_TRANSACTIONS.md    # Gasless guide
├── README.md                  # This file
└── package.json               # Dependencies
```

## Technology Stack

- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT + Web3Auth
- **Blockchain**: Ethers.js v6
- **Security**: Helmet, CORS
- **Validation**: Express-validator

## Smart Contract Integration

The backend interacts with deployed smart contracts:

- **AddressManager**: Creates user wallets and group pools
- **UserWallet**: Individual wallet contracts (main + savings)
- **GroupPool**: Group savings pool contracts

All contract interactions are **gasless** - the backend wallet pays all gas fees.

## Development

```bash
# Run in development mode
npm run dev

# Run in production mode
npm start

# Run tests
npm test
```

## Cost Analysis

### Polygon Mainnet (Recommended)

**Per Operation**:
- Registration: ~$0.01
- Create Group: ~$0.02
- Join Group: ~$0.002

**Monthly Estimates**:
- 1,000 users: ~$10
- 500 groups: ~$10
- 5,000 joins: ~$10
- **Total: ~$30/month**

### How to Reduce Costs

1. **Use Layer 2**: Polygon, Arbitrum, Optimism
2. **Batch Operations**: Combine multiple operations when possible
3. **Off-peak Times**: Execute transactions when gas is low
4. **Monitor Usage**: Set up alerts for unusual activity

## Security

### Best Practices

1. **Private Key Security**
   - Never commit `.env` to version control
   - Use secrets management in production
   - Rotate keys regularly

2. **Rate Limiting**
   - Limit registration attempts per IP
   - Prevent spam group creation
   - Monitor unusual patterns

3. **Input Validation**
   - Validate all user inputs
   - Sanitize email addresses
   - Check wallet address formats

4. **Monitoring**
   - Track backend wallet balance
   - Alert on low balance
   - Log all gasless transactions

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET`
- [ ] Configure production MongoDB
- [ ] Deploy contracts to mainnet
- [ ] Fund backend wallet with sufficient MATIC
- [ ] Set up wallet balance monitoring
- [ ] Configure rate limiting
- [ ] Enable HTTPS
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure backup strategy

### Recommended Infrastructure

- **Backend**: AWS EC2, DigitalOcean, or Heroku
- **Database**: MongoDB Atlas
- **Secrets**: AWS Secrets Manager or Vault
- **Monitoring**: CloudWatch, DataDog
- **Blockchain**: Alchemy or Infura RPC

## Troubleshooting

### "Gasless service disabled"

**Cause**: Backend wallet not configured

**Fix**:
1. Add `ADMIN_PRIVATE_KEY` to `.env`
2. Fund the wallet with MATIC
3. Restart server

### "Insufficient funds"

**Cause**: Backend wallet balance too low

**Fix**:
1. Check balance: `GET /api/gas/backend-wallet`
2. Send MATIC to backend wallet
3. Verify transaction on block explorer

### "Contract not deployed"

**Cause**: Missing or invalid contract address

**Fix**:
1. Deploy contracts: `cd ../contract && npx hardhat run scripts/deploy.js`
2. Add contract address to `.env`
3. Restart server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

ISC

## Support

For questions or issues:
- Check [GASLESS_TRANSACTIONS.md](./GASLESS_TRANSACTIONS.md)
- Review API documentation above
- Check server logs for errors
- Monitor gas usage via `/api/gas/*` endpoints

---

Built with ❤️ for the Web3 community
