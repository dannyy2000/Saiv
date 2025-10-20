const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { authLimiter, createAccountLimiter } = require('../middleware/rateLimiter');

const validateEmailRegistration = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  handleValidationErrors
];

const validateWalletRegistration = [
  body('eoaAddress')
    .notEmpty()
    .withMessage('EOA address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  handleValidationErrors
];

const validateBalanceUpdate = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be numeric'),
  handleValidationErrors
];

router.post('/register/email', createAccountLimiter, validateEmailRegistration, authController.registerWithEmail);

router.post('/register/wallet', createAccountLimiter, validateWalletRegistration, authController.registerWithWallet);

// Development-only endpoints without rate limiting
if (process.env.NODE_ENV === 'development') {
  router.post('/dev/register/email', validateEmailRegistration, authController.registerWithEmail);
  router.post('/dev/register/wallet', validateWalletRegistration, authController.registerWithWallet);
}

router.get('/profile', authMiddleware, authController.getProfile);

router.put('/balance', authMiddleware, validateBalanceUpdate, authController.updateBalance);

module.exports = router;