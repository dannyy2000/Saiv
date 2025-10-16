const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove deprecated options - they are now the default in Mongoose 6+
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/saiv_platform');

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;