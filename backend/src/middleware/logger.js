const morgan = require('morgan');

const logger = morgan('combined', {
  skip: (req, res) => {
    return process.env.NODE_ENV === 'test';
  }
});

module.exports = logger;