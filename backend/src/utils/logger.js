const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = {
  info: (message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      meta
    };

    console.log(`[${logEntry.timestamp}] INFO: ${message}`, meta);

    // Write to file in production
    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(
        path.join(logsDir, 'app.log'),
        JSON.stringify(logEntry) + '\n'
      );
    }
  },

  error: (message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      meta
    };

    console.error(`[${logEntry.timestamp}] ERROR: ${message}`, meta);

    // Always write errors to file
    fs.appendFileSync(
      path.join(logsDir, 'error.log'),
      JSON.stringify(logEntry) + '\n'
    );
  },

  warn: (message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      meta
    };

    console.warn(`[${logEntry.timestamp}] WARN: ${message}`, meta);

    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(
        path.join(logsDir, 'app.log'),
        JSON.stringify(logEntry) + '\n'
      );
    }
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        meta
      };

      console.debug(`[${logEntry.timestamp}] DEBUG: ${message}`, meta);
    }
  }
};

module.exports = logger;