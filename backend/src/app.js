const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const contractService = require('./services/contractService');
const gaslessService = require('./services/gaslessService');
require('dotenv').config();

const app = express();

connectDB();

contractService.initialize().catch(err => {
  console.warn('Contract service initialization failed:', err.message);
});

// Initialize gasless service for backend-paid transactions
gaslessService.initialize().then(success => {
  if (success) {
    console.log('✅ GASLESS SERVICE ENABLED - Users pay NO gas fees');
    console.log('   - Registration: FREE (backend pays gas)');
    console.log('   - Create Group: FREE (backend pays gas)');
    console.log('   - Join Group: FREE (backend pays gas)');
  } else {
    console.warn('⚠️ Gasless service disabled - Check ADMIN_PRIVATE_KEY in .env');
  }
}).catch(err => {
  console.error('Gasless service initialization error:', err.message);
});

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

module.exports = app;