# 🚀 Deployment Checklist

Use this checklist to deploy Saiv Platform to production.

## 📋 Pre-Deployment

### Code Review
- [ ] All code reviewed and tested
- [ ] No console.logs in production code
- [ ] Error handling implemented
- [ ] Security vulnerabilities checked
- [ ] Dependencies updated to latest stable versions

### Smart Contracts
- [ ] Contracts compiled without warnings
- [ ] All tests passing (`npx hardhat test`)
- [ ] Contracts audited (if handling significant funds)
- [ ] Gas optimizations implemented
- [ ] Emergency functions tested

### Backend
- [ ] All API endpoints tested
- [ ] Database queries optimized
- [ ] Rate limiting implemented
- [ ] CORS configured for production
- [ ] Logging configured
- [ ] Error tracking setup (Sentry, etc.)

### Security
- [ ] `.env` files in `.gitignore`
- [ ] Private keys never committed
- [ ] JWT secrets are strong (32+ characters)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection enabled

## 🔐 Secrets & Keys

### Generate Production Keys
- [ ] Generate new deployer wallet for mainnet
- [ ] Generate new backend wallet for mainnet
- [ ] Generate strong JWT secret
- [ ] Store all keys in secure location (Vault, AWS Secrets Manager)
- [ ] Never reuse development keys

### Key Storage
- [ ] Deployer private key secured
- [ ] Backend private key secured
- [ ] JWT secret secured
- [ ] MongoDB connection string secured
- [ ] Backup keys stored offline

## 🌐 Infrastructure Setup

### Database
- [ ] MongoDB Atlas account created
- [ ] Production cluster deployed
- [ ] Connection string obtained
- [ ] IP whitelist configured
- [ ] Database backups enabled
- [ ] Monitoring enabled

### Hosting
- [ ] Backend server provisioned (AWS, DigitalOcean, etc.)
- [ ] Node.js installed (v18+)
- [ ] PM2 or similar process manager installed
- [ ] Firewall configured
- [ ] SSL certificate obtained
- [ ] Domain configured

### Blockchain
- [ ] RPC endpoint configured (Lisk mainnet)
- [ ] Backup RPC endpoints configured
- [ ] Block explorer bookmarked
- [ ] Faucet alternatives identified (if needed)

## 💎 Smart Contract Deployment

### 1. Prepare Deployer Wallet
```bash
cd contract

# Generate wallet (or use existing)
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Address:', w.address, '\nPrivate Key:', w.privateKey);"

# Add to .env
PRIVATE_KEY=0xYourMainnetPrivateKey
```

- [ ] Deployer wallet created
- [ ] Private key stored securely
- [ ] Wallet address documented

### 2. Fund Deployer Wallet
- [ ] Purchase LSK tokens (~1-2 LSK for deployment)
- [ ] Transfer to deployer address
- [ ] Verify balance on block explorer
- [ ] Keep extra LSK for future operations

### 3. Deploy Contracts
```bash
# Verify configuration
cat hardhat.config.js

# Check balance
npx hardhat run scripts/checkBalance.js --network lisk

# Deploy
npx hardhat run scripts/deploy.js --network lisk
```

- [ ] Contracts deployed successfully
- [ ] Contract addresses saved
- [ ] Deployment transaction confirmed
- [ ] Verified on block explorer

### 4. Verify Contracts
```bash
npx hardhat verify --network lisk 0xYourContractAddress
```

- [ ] AddressManager verified
- [ ] Verification successful on Blockscout

## 🖥️ Backend Deployment

### 1. Prepare Backend Wallet
```bash
# Generate backend wallet
node -e "const ethers = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Backend Wallet\nAddress:', w.address, '\nPrivate Key:', w.privateKey);"
```

- [ ] Backend wallet created
- [ ] Private key stored securely
- [ ] Wallet address documented

### 2. Fund Backend Wallet
- [ ] Calculate estimated monthly usage
- [ ] Fund wallet with sufficient LSK (100+ LSK recommended)
- [ ] Verify balance on block explorer
- [ ] Set up low balance alerts

### 3. Configure Environment
Create production `.env`:

```env
NODE_ENV=production
PORT=3001

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/saiv_production

# Security
JWT_SECRET=your_super_secure_production_secret_minimum_32_characters

# Blockchain
RPC_URL=https://rpc.api.lisk.com

# Backend Wallet
ADMIN_PRIVATE_KEY=0xYourBackendMainnetPrivateKey

# Contract
ADDRESS_MANAGER_CONTRACT=0xYourDeployedMainnetAddress
```

- [ ] All environment variables configured
- [ ] MongoDB connection string correct
- [ ] RPC URL is mainnet
- [ ] Contract address correct

### 4. Deploy Backend
```bash
# Clone repository on server
git clone <repository-url>
cd Saiv/backend

# Install dependencies
npm install --production

# Test configuration
npm run start

# If successful, stop and use PM2
npm install -g pm2
pm2 start server.js --name saiv-backend
pm2 startup
pm2 save
```

- [ ] Backend deployed to server
- [ ] Dependencies installed
- [ ] Process manager configured
- [ ] Auto-restart enabled

### 5. Configure Nginx (Reverse Proxy)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] Nginx installed
- [ ] Configuration file created
- [ ] Nginx restarted
- [ ] API accessible via domain

### 6. SSL Certificate
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.yourdomain.com
```

- [ ] SSL certificate obtained
- [ ] HTTPS working
- [ ] Auto-renewal enabled

## 🧪 Post-Deployment Testing

### Health Checks
```bash
# API health
curl https://api.yourdomain.com/api/health

# Gasless status
curl https://api.yourdomain.com/api/gas/status

# Backend wallet balance
curl https://api.yourdomain.com/api/gas/backend-wallet \
  -H "Authorization: Bearer <token>"
```

- [ ] Health endpoint responding
- [ ] Gasless service enabled
- [ ] Backend wallet has balance
- [ ] All endpoints accessible

### Functional Testing
```bash
# Register user
curl -X POST https://api.yourdomain.com/api/auth/register/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@production.com"}'

# Create group
curl -X POST https://api.yourdomain.com/api/groups \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Test Group"}'
```

- [ ] User registration working
- [ ] Smart contract wallets created
- [ ] Group creation working
- [ ] Blockchain transactions confirming

### Monitor First Transactions
- [ ] Check backend logs for errors
- [ ] Verify transactions on block explorer
- [ ] Confirm gas costs are as expected
- [ ] Test with multiple users

## 📊 Monitoring Setup

### Application Monitoring
- [ ] Error tracking (Sentry, Rollbar)
- [ ] Performance monitoring (Datadog, New Relic)
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Log aggregation (Loggly, Papertrail)

### Blockchain Monitoring
- [ ] Backend wallet balance alerts
- [ ] Transaction monitoring
- [ ] Gas price tracking
- [ ] Smart contract event watching

### Database Monitoring
- [ ] MongoDB Atlas monitoring enabled
- [ ] Query performance tracking
- [ ] Storage alerts configured
- [ ] Backup verification automated

### Custom Alerts
```javascript
// Add to backend cron job or monitoring service
const gaslessService = require('./src/services/gaslessService');

setInterval(async () => {
  const balance = await gaslessService.getBackendWalletBalance();
  const balanceNum = parseFloat(balance.balance);

  if (balanceNum < 10) {
    // Send alert to admin
    console.error('⚠️ LOW BALANCE ALERT: Backend wallet needs refill!');
    // Send email/SMS/Slack notification
  }
}, 3600000); // Check every hour
```

- [ ] Low balance alerts configured
- [ ] Error alerts configured
- [ ] Performance alerts configured
- [ ] Daily summary reports setup

## 🔒 Security Hardening

### Server Security
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] SSH key authentication enabled
- [ ] Password authentication disabled
- [ ] Fail2ban installed and configured
- [ ] Regular security updates enabled
- [ ] Non-root user for application

### Application Security
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Helmet.js configured
- [ ] Input sanitization active
- [ ] SQL injection prevention
- [ ] XSS protection enabled

### API Security
```javascript
// Add to backend/src/app.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/api/', limiter);
```

- [ ] Rate limiting implemented
- [ ] API key authentication (if needed)
- [ ] Request size limits
- [ ] Timeout configurations

## 📈 Performance Optimization

### Backend
- [ ] Database indexes created
- [ ] Query optimization done
- [ ] Caching implemented (Redis)
- [ ] Response compression enabled
- [ ] Static file CDN (if applicable)

### Smart Contracts
- [ ] Gas optimizations implemented
- [ ] Minimal proxy pattern used
- [ ] Batch operations where possible
- [ ] Events indexed properly

## 🔄 Backup Strategy

### Database Backups
- [ ] Automatic daily backups enabled
- [ ] Backup retention policy (30 days)
- [ ] Backup restoration tested
- [ ] Off-site backup storage

### Configuration Backups
- [ ] `.env` files backed up securely
- [ ] Private keys backed up offline
- [ ] Server configuration documented
- [ ] Recovery procedures documented

### Code Backups
- [ ] Git repository backed up
- [ ] Multiple remote repositories
- [ ] Tagged releases for production
- [ ] Deployment history maintained

## 📱 Go-Live Communication

### Internal Team
- [ ] All team members notified
- [ ] On-call rotation established
- [ ] Incident response plan ready
- [ ] Contact list updated

### Users (if applicable)
- [ ] Launch announcement prepared
- [ ] Support channels ready
- [ ] Documentation published
- [ ] FAQ prepared

## ✅ Final Checks

### Pre-Launch (T-1 hour)
- [ ] All tests passing
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Team on standby
- [ ] Rollback plan ready

### Launch (T=0)
- [ ] Switch DNS to production
- [ ] Monitor error rates
- [ ] Watch transaction confirmations
- [ ] Check backend wallet balance
- [ ] Test user flows

### Post-Launch (T+1 hour)
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Users able to register
- [ ] Transactions confirming
- [ ] Monitoring working

### Post-Launch (T+24 hours)
- [ ] Review error logs
- [ ] Check gas usage
- [ ] Verify backup jobs ran
- [ ] Monitor user feedback
- [ ] Plan optimizations

## 🎉 Success Criteria

- ✅ Smart contracts deployed and verified
- ✅ Backend API responding
- ✅ Gasless transactions working
- ✅ Users can register
- ✅ Groups can be created
- ✅ No critical errors
- ✅ Monitoring active
- ✅ Backups working
- ✅ Team informed
- ✅ Documentation complete

## 📞 Emergency Contacts

- **Smart Contract Issues**: Block explorer, Lisk support
- **Backend Issues**: Hosting provider, on-call engineer
- **Database Issues**: MongoDB Atlas support
- **Network Issues**: DNS provider, RPC provider

## 🔧 Rollback Plan

If critical issues occur:

1. **Identify Issue**
   - Check logs
   - Review monitoring
   - Identify root cause

2. **Assess Impact**
   - Users affected?
   - Funds at risk?
   - Data integrity?

3. **Execute Rollback**
   ```bash
   # Revert to previous version
   pm2 stop saiv-backend
   git checkout <previous-tag>
   npm install --production
   pm2 start server.js
   ```

4. **Verify Rollback**
   - Test critical paths
   - Verify no data loss
   - Monitor errors

5. **Post-Mortem**
   - Document issue
   - Plan fixes
   - Update procedures

## 📚 Documentation

- [ ] API documentation published
- [ ] User guides created
- [ ] Developer documentation updated
- [ ] Deployment procedures documented
- [ ] Troubleshooting guide ready

---

## 🎊 You're Ready to Launch!

Once all items are checked, you're ready for production deployment!

**Good luck! 🚀**
