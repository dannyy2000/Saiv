# 🚀 Quick Start Guide - Saiv Platform

Get your gasless savings platform running in 10 minutes!

## ⚡ Prerequisites

- Node.js 18+ installed
- MongoDB installed or MongoDB Atlas account
- Git installed
- A terminal/command line

## 📋 Step-by-Step Setup

### Step 1: Clone & Install (2 min)

```bash
# Clone repository
git clone <repository-url>
cd Saiv

# Install contract dependencies
cd contract
npm install

# Install backend dependencies
cd ../backend
npm install
```

### Step 2: Deploy Smart Contracts (3 min)

```bash
cd ../contract

# Copy environment template
cp .env.example .env

# Generate deployer wallet
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Address:', w.address, '\nPrivate Key:', w.privateKey);"

# Copy the private key and add to .env
nano .env  # or use your preferred editor
# PRIVATE_KEY=0xYourGeneratedPrivateKey
```

**Get testnet tokens:**
1. Visit: https://sepolia-faucet.lisk.com
2. Paste your deployer address
3. Request tokens
4. Wait for confirmation (~30 seconds)

**Deploy contract:**
```bash
npx hardhat run scripts/deploy.js --network liskSepolia
```

**Save the output!** You'll need the contract address:
```
✅ AddressManager deployed to: 0x1234567890abcdef...
```

### Step 3: Setup Backend (3 min)

```bash
cd ../backend

# Copy environment template
cp .env.example .env

# Generate backend wallet
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Backend Wallet\nAddress:', w.address, '\nPrivate Key:', w.privateKey);"

# Edit .env file
nano .env  # or use your preferred editor
```

**Configure .env:**
```env
NODE_ENV=development
PORT=3001

# MongoDB (use Atlas or local)
MONGODB_URI=mongodb://localhost:27017/saiv_platform

# JWT Secret (generate random string)
JWT_SECRET=your_super_secret_key_min_32_chars_long_random_string

# Blockchain
RPC_URL=https://rpc.sepolia-api.lisk.com

# Backend wallet (from step above)
ADMIN_PRIVATE_KEY=0xYourBackendWalletPrivateKey

# Contract address (from deployment)
ADDRESS_MANAGER_CONTRACT=0xYourDeployedContractAddress
```

**Fund backend wallet:**
1. Visit: https://sepolia-faucet.lisk.com
2. Paste your backend wallet address
3. Request tokens
4. Wait for confirmation

### Step 4: Start Services (2 min)

**Terminal 1 - MongoDB (if local):**
```bash
mongod
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run dev
```

**Expected output:**
```
MongoDB Connected: localhost
✅ GASLESS SERVICE ENABLED - Users pay NO gas fees
   - Registration: FREE (backend pays gas)
   - Create Group: FREE (backend pays gas)
   - Join Group: FREE (backend pays gas)
Backend wallet balance: 5.0 LSK
Server is running on port 3001
```

### Step 5: Test It! (1 min)

**Terminal 3 - Test API:**

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

**Success!** You should see:
```json
{
  "success": true,
  "message": "User registered successfully with email",
  "data": {
    "user": {
      "email": "test@example.com",
      "address": "0x...",
      "savingsAddress": "0x..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## 🎉 You're Done!

Your gasless platform is now running!

## 🧪 Next: Test All Features

Save the token from registration, then:

```bash
# Set token variable
TOKEN="paste_your_token_here"

# Get user profile
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"

# Check wallet balance
curl http://localhost:3001/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN"

# Create a group (GASLESS!)
curl -X POST http://localhost:3001/api/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Savings Group",
    "description": "Monthly savings for emergencies",
    "paymentWindowDuration": 2592000
  }'

# Get your groups
curl http://localhost:3001/api/groups \
  -H "Authorization: Bearer $TOKEN"

# Check gas estimates
curl http://localhost:3001/api/gas/estimates

# Check backend wallet balance
curl http://localhost:3001/api/gas/backend-wallet \
  -H "Authorization: Bearer $TOKEN"
```

## 🔧 Common Issues & Solutions

### "MongoDB connection error"
```bash
# Start MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Get connection string from atlas.mongodb.com
```

### "Gasless service disabled"
```bash
# Check .env has all required values
cat backend/.env

# Verify backend wallet has funds
# Visit: https://sepolia-blockscout.lisk.com/address/YOUR_BACKEND_WALLET
```

### "Insufficient funds"
```bash
# Get more testnet tokens
# Visit: https://sepolia-faucet.lisk.com
```

### "Cannot connect to network"
```bash
# Check RPC_URL in backend/.env
# Should be: https://rpc.sepolia-api.lisk.com
```

## 📚 Learn More

- **[Full Documentation](README.md)** - Complete project overview
- **[Backend Guide](backend/README.md)** - API documentation
- **[Gasless Guide](backend/GASLESS_TRANSACTIONS.md)** - How gasless works
- **[Deployment Guide](contract/DEPLOYMENT.md)** - Contract deployment details

## 🎯 What's Next?

1. **Build a frontend** - Connect with Web3Auth
2. **Add more features** - Savings goals, analytics, etc.
3. **Deploy to mainnet** - When ready for production
4. **Add monitoring** - Track usage and costs
5. **Implement rate limiting** - Prevent abuse

## 💡 Tips

### Development
- Use Lisk Sepolia testnet for development (free tokens!)
- Monitor backend wallet balance regularly
- Check logs for any errors
- Test all API endpoints

### Security
- Never commit `.env` files
- Use strong JWT secrets
- Keep private keys secure
- Implement rate limiting in production

### Cost Management
- Monitor gas usage via `/api/gas/estimates`
- Set up alerts for low backend wallet balance
- Consider batch operations for efficiency
- Use Lisk mainnet for lowest costs

## 🆘 Need Help?

1. Check the logs: Backend shows detailed error messages
2. Review documentation in `/backend` and `/contract`
3. Test individual components:
   - MongoDB connection
   - Contract deployment
   - Backend startup
   - API endpoints

## 🎊 Success Checklist

- [x] Smart contracts deployed to Lisk Sepolia
- [x] Backend wallet funded with testnet LSK
- [x] MongoDB connected
- [x] Backend API running
- [x] Gasless service enabled
- [x] User registration working
- [x] Group creation working
- [x] All API endpoints responding

**Congratulations! You now have a fully functional gasless Web3 platform!** 🚀

---

**Questions?** Check the main [README.md](README.md) or documentation in each folder.
