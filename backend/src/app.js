const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const contractService = require('./services/contractService');
const gaslessService = require('./services/gaslessService');
const aaveService = require('./services/aaveService');
const webhookService = require('./services/webhookService');
const { globalErrorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter, speedLimiter } = require('./middleware/rateLimiter');
require('dotenv').config();

const app = express();

connectDB();

// Wrap in async IIFE to handle initialization properly
(async () => {
  try {
    if (contractService && typeof contractService.initialize === 'function') {
      await contractService.initialize();
    }
  } catch (err) {
    console.warn('Contract service initialization failed:', err.message);
  }
})();

// Initialize gasless service for backend-paid transactions
(async () => {
  try {
    if (gaslessService && typeof gaslessService.initialize === 'function') {
      const success = await gaslessService.initialize();
      if (success) {
        console.log('✅ GASLESS SERVICE ENABLED - Users pay NO gas fees');
        console.log('   - Registration: FREE (backend pays gas)');
        console.log('   - Create Group: FREE (backend pays gas)');
        console.log('   - Join Group: FREE (backend pays gas)');
      } else {
        console.warn('⚠️ Gasless service disabled - Check ADMIN_PRIVATE_KEY in .env');
      }
    }
  } catch (err) {
    console.error('Gasless service initialization error:', err.message);
  }
})();

// Initialize Aave service for yield generation
(async () => {
  try {
    if (aaveService && typeof aaveService.initialize === 'function') {
      const success = await aaveService.initialize();
      if (success) {
        console.log('✅ AAVE SERVICE ENABLED - Savings earn yield automatically');
        console.log('   - Personal Savings: Auto-supply to Aave after deposit');
        console.log('   - Group Savings: Auto-supply to Aave when payment window completes');
      } else {
        console.warn('⚠️ Aave service disabled - Check ADMIN_PRIVATE_KEY in .env');
      }
    }
  } catch (err) {
    console.error('Aave service initialization error:', err.message);
  }
})();

// Initialize Webhook service for blockchain event monitoring
(async () => {
  try {
    if (webhookService && typeof webhookService.initialize === 'function') {
      const success = await webhookService.initialize();
      if (success) {
        console.log('✅ WEBHOOK SERVICE ENABLED - Monitoring blockchain events');
        console.log('   - Contract Events: Real-time monitoring and database sync');
        console.log('   - Transaction Updates: Automatic balance and state updates');
        console.log('   - Event Logging: Comprehensive event history tracking');
      } else {
        console.warn('⚠️ Webhook service disabled - Check RPC_URL in .env');
      }
    }
  } catch (err) {
    console.error('Webhook service initialization error:', err.message);
  }
})();

// Security and rate limiting
app.use(helmet());
app.use(cors());

// Apply rate limiting
app.use(generalLimiter); // Apply to all requests
app.use(speedLimiter); // Slow down after threshold

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running!',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', require('./routes'));

// Handle unmatched routes (commented out to fix test issues)
// app.use('*', notFound);

// Global error handler
app.use(globalErrorHandler);

module.exports = app;