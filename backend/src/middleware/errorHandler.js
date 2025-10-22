const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class BlockchainError extends AppError {
  constructor(message, originalError = null, transactionHash = null) {
    super(message, 500, 'BLOCKCHAIN_ERROR', {
      originalError: originalError?.message || originalError,
      transactionHash
    });
    this.name = 'BlockchainError';
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', resetTime = null) {
    super(message, 429, 'RATE_LIMIT_ERROR', { resetTime });
    this.name = 'RateLimitError';
  }
}

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ValidationError(message, err.path);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new ValidationError(message);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new ValidationError(message);
};

const handleJWTError = () => new AuthenticationError('Invalid token. Please log in again!');

const handleJWTExpiredError = () => new AuthenticationError('Your token has expired! Please log in again.');

const handleEthersError = (err) => {
  let message = 'Blockchain transaction failed';
  let code = 'BLOCKCHAIN_ERROR';

  if (err.code === 'INSUFFICIENT_FUNDS') {
    message = 'Insufficient funds for transaction';
    code = 'INSUFFICIENT_FUNDS';
  } else if (err.code === 'NETWORK_ERROR') {
    message = 'Network connection error';
    code = 'NETWORK_ERROR';
  } else if (err.code === 'TIMEOUT') {
    message = 'Transaction timeout';
    code = 'TRANSACTION_TIMEOUT';
  } else if (err.reason) {
    message = `Transaction failed: ${err.reason}`;
  }

  return new BlockchainError(message, err, err.transactionHash);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    code: err.code,
    details: err.details,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR 💥', err);

    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors
  logger.error('Request Error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Handle ethers.js errors
    if (error.code && typeof error.code === 'string' &&
        ['INSUFFICIENT_FUNDS', 'NETWORK_ERROR', 'TIMEOUT', 'UNPREDICTABLE_GAS_LIMIT'].includes(error.code)) {
      error = handleEthersError(error);
    }

    sendErrorProd(error, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// 404 handler
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

module.exports = {
  AppError,
  BlockchainError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  globalErrorHandler,
  catchAsync,
  notFound
};