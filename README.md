# Saiv Platform - Web3 Savings & Group Management

A decentralized savings and group management platform with **100% gasless transactions**. Users can register, create groups, and manage funds without ever paying gas fees or signing blockchain transactions.

## 🌟 Key Features

### 💸 100% Gasless for Users
- **No gas fees ever** - Backend pays all blockchain costs
- **No transaction signing** - Seamless Web2-like experience
- **No crypto needed** - Just an email address to get started
- **Backend-subsidized** - All smart contract interactions are free for users

### 👤 User Management
- **Email Registration** - Passwordless authentication via Web3Auth
- **Wallet Registration** - Connect with existing EOA wallets
- **Automatic Wallets** - Get 2 smart contract wallets (main + savings)
- **Balance Tracking** - Real-time balance updates

### 👥 Group Savings
- **Create Groups** - Start savings groups with pool addresses
- **Join Groups** - One-click join with role-based access
- **Pool Management** - Smart contract-managed group funds
- **Member Management** - Admin/member roles with permissions

### 🔐 Security
- **Smart Contract Wallets** - Non-custodial user wallets
- **Private Key Encryption** - Secure storage of credentials
- **JWT Authentication** - Industry-standard auth
- **Rate Limiting** - Protection against abuse

## 🏗️ Project Structure

```
Saiv/
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # MongoDB schemas
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   │   └── gaslessService.js  # 🌟 Gasless transaction handler
│   │   └── middleware/   # Auth & validation
│   ├── README.md         # Backend documentation
│   └── GASLESS_TRANSACTIONS.md  # Gasless guide
│
├── contract/             # Smart Contracts (Solidity)
│   ├── contracts/
│   │   ├── AddressManager.sol  # Main contract
│   │   ├── UserWallet.sol      # User wallet contract
│   │   └── GroupPool.sol       # Group pool contract
│   ├── scripts/
│   │   └── deploy.js    # Deployment script
│   ├── hardhat.config.js  # Network configuration
│   └── DEPLOYMENT.md     # Deployment guide
│
└── frontend/             # Frontend (TBD)
```

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ and npm
- MongoDB (local or Atlas)
- Git

### 1. Clone Repository

```bash
git clone <repository-url>
cd Saiv
```

### 2. Setup Smart Contracts

```bash
cd contract
npm install

# Create .env file
cp .env.example .env

# Generate a deployer wallet
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Address:', w.address, '\nPrivate Key:', w.privateKey);"

# Add private key to .env
# PRIVATE_KEY=0x...

# Get testnet funds from faucet
# Visit: https://sepolia-faucet.lisk.com

# Deploy to Lisk Sepolia testnet
npx hardhat run scripts/deploy.js --network liskSepolia
```

Copy the deployed contract address!

### 3. Setup Backend

```bash
cd ../backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values:
# - MongoDB connection string
# - JWT secret (random 32+ character string)
# - RPC_URL (use Lisk Sepolia: https://rpc.sepolia-api.lisk.com)
# - ADMIN_PRIVATE_KEY (generate a NEW wallet for backend)
# - ADDRESS_MANAGER_CONTRACT (from step 2)
```

**Generate Backend Wallet:**
```bash
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Backend Wallet\nAddress:', w.address, '\nPrivate Key:', w.privateKey);"
```

**Fund Backend Wallet:**
- Visit: https://sepolia-faucet.lisk.com
- Send testnet LSK to your backend wallet address

### 4. Start Backend

```bash
# Start MongoDB (if local)
mongod

# In another terminal, start backend
npm run dev
```

You should see:
```
✅ GASLESS SERVICE ENABLED - Users pay NO gas fees
   - Registration: FREE (backend pays gas)
   - Create Group: FREE (backend pays gas)
   - Join Group: FREE (backend pays gas)
Backend wallet balance: 5.0 LSK
Server is running on port 3001
```

### 5. Test the API

```bash
# Check health
curl http://localhost:3001/api/health

# Check gasless status
curl http://localhost:3001/api/gas/status

# Register a user (GASLESS!)
curl -X POST http://localhost:3001/api/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## 📡 API Endpoints

### Authentication

```bash
# Register with Email (FREE - Backend pays gas)
POST /api/auth/register/email
Body: { "email": "user@example.com" }

# Register with Wallet (FREE - Backend pays gas)
POST /api/auth/register/wallet
Body: { "eoaAddress": "0x..." }

# Get Profile
GET /api/auth/profile
Headers: { "Authorization": "Bearer <token>" }
```

### Groups

```bash
# Create Group (FREE - Backend pays gas)
POST /api/groups
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "name": "Monthly Savings",
  "description": "Save $100/month",
  "paymentWindowDuration": 2592000
}

# Get User's Groups
GET /api/groups
Headers: { "Authorization": "Bearer <token>" }

# Get Group Details
GET /api/groups/:groupId
Headers: { "Authorization": "Bearer <token>" }

# Join Group (FREE - Backend pays gas)
POST /api/groups/:groupId/join
Headers: { "Authorization": "Bearer <token>" }
```

### Wallet Operations

```bash
# Get Balance
GET /api/wallet/balance
Headers: { "Authorization": "Bearer <token>" }

# Send ETH
POST /api/wallet/send-eth
Headers: { "Authorization": "Bearer <token>" }
Body: { "to": "0x...", "amount": "0.1" }

# Get Token Balance
GET /api/wallet/token-balance?tokenAddress=0x...
Headers: { "Authorization": "Bearer <token>" }
```

### Gas Monitoring

```bash
# Check Gasless Status (Public)
GET /api/gas/status

# Get Backend Wallet Balance (Auth Required)
GET /api/gas/backend-wallet
Headers: { "Authorization": "Bearer <token>" }

# Get Gas Estimates (Public)
GET /api/gas/estimates
```

## 🏛️ Architecture

### How Gasless Transactions Work

```
┌─────────────┐
│    User     │
│ (Email Only)│
└──────┬──────┘
       │ 1. Register/Create Group
       ▼
┌─────────────────┐
│   Backend API   │
│  (Express.js)   │
└──────┬──────────┘
       │ 2. Validate Request
       ▼
┌─────────────────┐
│ Gasless Service │  ← Backend Wallet
│  (Backend Pays) │     (Pays Gas)
└──────┬──────────┘
       │ 3. Execute Transaction
       ▼
┌─────────────────┐
│ Smart Contract  │
│ (AddressManager)│
└──────┬──────────┘
       │ 4. Create Wallet/Pool
       ▼
┌─────────────────┐
│   Blockchain    │
│  (Lisk Network) │
└─────────────────┘
```

### User Flow

1. **User registers** with email → Backend creates 2 smart contract wallets
2. **Backend pays gas** for wallet deployment
3. **User creates group** → Backend deploys pool contract
4. **Backend pays gas** again
5. **User never pays** or signs anything!

## 💰 Cost Analysis

### Lisk Sepolia (Testnet)
- **Free testnet tokens** from faucet
- Perfect for development and testing
- Same functionality as mainnet

### Lisk Mainnet (Production)
| Operation | Gas Cost | USD Cost* |
|-----------|----------|-----------|
| User Registration | ~0.0005 LSK | ~$0.0006 |
| Create Group | ~0.001 LSK | ~$0.0012 |
| Join Group | ~0.0002 LSK | ~$0.0002 |

*Based on LSK = $1.20

**Monthly Cost Examples:**
- 1,000 users register: **~$0.60**
- 500 groups created: **~$0.60**
- 5,000 joins: **~$1.00**
- **Total: ~$2.20/month** for 1,000+ active users

### Comparison with Other Networks

| Network | User Registration | Group Creation | Monthly Cost (1K users) |
|---------|------------------|----------------|-------------------------|
| **Lisk** | $0.0006 | $0.0012 | **$2.20** ✅ |
| Polygon | $0.01 | $0.02 | $30 |
| Ethereum | $40 | $67 | $40,000 ❌ |

**Winner: Lisk! 🏆**

## 🔧 Technology Stack

### Backend
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT + Web3Auth
- **Blockchain**: Ethers.js v6
- **Security**: Helmet, CORS, Express-validator

### Smart Contracts
- **Language**: Solidity 0.8.19
- **Framework**: Hardhat
- **Network**: Lisk (Sepolia & Mainnet)
- **Pattern**: Minimal Proxy (Clones) for gas optimization

### Frontend (Coming Soon)
- React.js / Next.js
- Web3Auth integration
- TailwindCSS

## 🔐 Security Features

### Smart Contracts
- ✅ Minimal proxy pattern for gas efficiency
- ✅ Owner-based access control
- ✅ Event logging for transparency
- ✅ Tested and audited code

### Backend
- ✅ JWT authentication
- ✅ Private key encryption
- ✅ Input validation
- ✅ Rate limiting ready
- ✅ Environment variable security

### User Wallets
- ✅ Non-custodial (users own their wallets)
- ✅ Smart contract wallets with recovery
- ✅ Main + Savings wallet separation
- ✅ Multi-token support

## 📚 Documentation

- **[Backend README](backend/README.md)** - Backend API documentation
- **[Gasless Transactions Guide](backend/GASLESS_TRANSACTIONS.md)** - How gasless works
- **[Deployment Guide](contract/DEPLOYMENT.md)** - Smart contract deployment
- **[Hardhat Config](contract/hardhat.config.js)** - Network configurations

## 🎯 Group Identifier Format

Groups use a unique identifier format:
```
{userMainWalletAddress}_{timestamp}
```

Example:
```
0x742d35Cc6634C0532925a3b8D0Ed62FDa2c0e7A6_1697123456789
```

**Benefits:**
- ✅ Globally unique
- ✅ Traceable to creator
- ✅ Time-ordered
- ✅ Query-friendly

## 🌐 Supported Networks

### Primary (Recommended)
- ✅ **Lisk Sepolia** (Testnet) - Chain ID: 4202
- ✅ **Lisk Mainnet** - Chain ID: 1135

### Alternative
- ⚡ Polygon Mumbai (Testnet) - Chain ID: 80001
- ⚡ Polygon Mainnet - Chain ID: 137

### Not Recommended
- ❌ Ethereum Mainnet (too expensive)

## 🚦 Development Workflow

### 1. Local Development
```bash
# Terminal 1: MongoDB
mongod

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Test API
curl http://localhost:3001/api/health
```

### 2. Deploy Contracts
```bash
cd contract
npx hardhat run scripts/deploy.js --network liskSepolia
```

### 3. Update Backend Config
```bash
# Update backend/.env with contract address
ADDRESS_MANAGER_CONTRACT=0xYourDeployedAddress
```

### 4. Test Gasless Operations
```bash
# Register user (FREE)
curl -X POST http://localhost:3001/api/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Create group (FREE)
curl -X POST http://localhost:3001/api/groups \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Group"}'
```

## 🐛 Troubleshooting

### "Gasless service disabled"
- Check `ADMIN_PRIVATE_KEY` in backend `.env`
- Ensure backend wallet has LSK balance
- Verify `ADDRESS_MANAGER_CONTRACT` is correct

### "Insufficient funds"
- Backend wallet needs LSK tokens
- Get from: https://sepolia-faucet.lisk.com (testnet)
- Check balance: `GET /api/gas/backend-wallet`

### "Cannot connect to network"
- Verify `RPC_URL` in backend `.env`
- Check internet connection
- Try alternative RPC endpoint

### Deployment fails
- Check deployer wallet balance
- Verify network in hardhat.config.js
- Compile contracts: `npx hardhat compile`

## 📊 Monitoring

### Backend Wallet Balance
```bash
curl http://localhost:3001/api/gas/backend-wallet \
  -H "Authorization: Bearer <token>"
```

### Gas Usage Statistics
```bash
curl http://localhost:3001/api/gas/estimates
```

### Service Status
```bash
curl http://localhost:3001/api/gas/status
```

## 🎓 Learn More

### Lisk Resources
- **Docs**: https://docs.lisk.com
- **Faucet**: https://sepolia-faucet.lisk.com
- **Explorer**: https://sepolia-blockscout.lisk.com
- **RPC**: https://rpc.sepolia-api.lisk.com

### Project Resources
- **Hardhat**: https://hardhat.org
- **Ethers.js**: https://docs.ethers.org
- **Express**: https://expressjs.com
- **MongoDB**: https://mongodb.com

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

ISC

## 🎉 Acknowledgments

Built with:
- ❤️ Love for Web3
- ⚡ Powered by Lisk
- 🚀 Express.js
- 📦 Hardhat
- 🔐 Ethers.js

## 💡 Use Cases

### Personal Savings
- Create savings goals
- Track progress
- Automated deposits

### Group Savings (Ajo/Esusu)
- Community savings circles
- Rotating savings
- Social accountability

### Family Funds
- Joint savings accounts
- Emergency funds
- Goal-based savings

### Investment Clubs
- Pool resources
- Collective investing
- Transparent management

## 🗺️ Roadmap

- [x] Backend API with gasless transactions
- [x] Smart contract deployment to Lisk
- [x] User registration (email & wallet)
- [x] Group creation and management
- [ ] Frontend application
- [ ] Mobile app (React Native)
- [ ] Advanced savings features
- [ ] Analytics dashboard
- [ ] Multi-currency support
- [ ] Automated contributions

## 📞 Support

- **Issues**: GitHub Issues
- **Docs**: See `/backend` and `/contract` folders
- **Community**: Coming soon

---

**Built for the people, powered by Lisk** 🌍

Made with 💚 by the Saiv Team
