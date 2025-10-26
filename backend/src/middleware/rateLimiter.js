const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { RateLimitError } = require('./errorHandler');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many requests from this IP, please try again later.',
      resetTime
    );
    next(error);
  }
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many authentication attempts, please try again later.',
      resetTime
    );
    next(error);
  }
});

// More restrictive limiter for blockchain operations
const blockchainLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 blockchain operations per minute
  message: {
    success: false,
    message: 'Too many blockchain operations, please wait before trying again.',
    code: 'BLOCKCHAIN_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many blockchain operations, please wait before trying again.',
      resetTime
    );
    next(error);
  }
});

// Speed limiter to slow down requests after threshold
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter (v2 format)
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Limiter for password reset/forgot password
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many password reset attempts, please try again later.',
      resetTime
    );
    next(error);
  }
});

// Create account limiter (very strict)
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 account creation attempts per hour (increased from 3)
  message: {
    success: false,
    message: 'Too many accounts created from this IP, please try again later.',
    code: 'ACCOUNT_CREATION_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true, // Don't count successful requests (existing user login, successful registration)
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many accounts created from this IP, please try again later.',
      resetTime
    );
    next(error);
  }
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 uploads per 15 minutes
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  handler: (req, res, next) => {
    const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
    const error = new RateLimitError(
      'Too many file uploads, please try again later.',
      resetTime
    );
    next(error);
  }
});

// Dynamic rate limiter based on user role
const createDynamicLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Rate limit exceeded'
  };

  const config = { ...defaultOptions, ...options };

  return rateLimit({
    ...config,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      if (req.user && req.user.userId) {
        return `user:${req.user.userId}`;
      }
      return req.ip;
    },
    max: (req) => {
      if (req.user) {
        // Authenticated users get higher limits
        switch (req.user.role) {
          case 'admin':
            return config.max * 5; // 5x limit for admins
          case 'premium':
            return config.max * 2; // 2x limit for premium users
          default:
            return config.max;
        }
      }
      return Math.floor(config.max * 0.5); // Anonymous users get 50% of the limit
    },
    handler: (req, res, next) => {
      const resetTime = new Date(Date.now() + req.rateLimit.resetTime);
      const error = new RateLimitError(
        config.message,
        resetTime
      );
      next(error);
    }
  });
};

// Rate limit store (in production, use Redis)
const createCustomStore = () => {
  const hits = new Map();

  return {
    incr: (key, callback) => {
      const currentHits = hits.get(key) || 0;
      const newHits = currentHits + 1;
      hits.set(key, newHits);

      // Clean up old entries (simple TTL simulation)
      setTimeout(() => {
        hits.delete(key);
      }, 15 * 60 * 1000); // 15 minutes

      callback(null, newHits, Date.now() + 15 * 60 * 1000);
    },
    decrement: (key) => {
      const currentHits = hits.get(key) || 0;
      if (currentHits > 0) {
        hits.set(key, currentHits - 1);
      }
    },
    resetKey: (key) => {
      hits.delete(key);
    }
  };
};

module.exports = {
  generalLimiter,
  authLimiter,
  blockchainLimiter,
  speedLimiter,
  passwordResetLimiter,
  createAccountLimiter,
  uploadLimiter,
  createDynamicLimiter,
  createCustomStore
};