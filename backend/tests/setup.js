const mongoose = require('mongoose');
require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

const mongoURI =
  process.env.MONGODB_TEST_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/saiv-test';

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 20000,
      });
      console.log('✅ Mongo connected for Jest tests');
    } catch (err) {
      console.error('❌ Mongo connection failed:', err.message);
      throw err;
    }
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const { collections } = mongoose.connection;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
});
