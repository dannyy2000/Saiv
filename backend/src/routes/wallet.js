const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authMiddleware } = require('../middleware/auth');
const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

const validateWithdrawEth = [
  body('toAddress')
    .notEmpty()
    .withMessage('Recipient address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be greater than 0'),
  body('walletType')
    .optional()
    .isIn(['main', 'savings'])
    .withMessage('Wallet type must be main or savings'),
  handleValidationErrors
];

const validateWithdrawToken = [
  body('tokenAddress')
    .notEmpty()
    .withMessage('Token address is required')
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  body('toAddress')
    .notEmpty()
    .withMessage('Recipient address is required')
    .isEthereumAddress()
    .withMessage('Invalid recipient address'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be greater than 0'),
  body('walletType')
    .optional()
    .isIn(['main', 'savings'])
    .withMessage('Wallet type must be main or savings'),
  handleValidationErrors
];

const validateTokenAddress = [
  body('tokenAddress')
    .notEmpty()
    .withMessage('Token address is required')
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  body('walletType')
    .optional()
    .isIn(['main', 'savings', 'both'])
    .withMessage('Wallet type must be main, savings, or both'),
  handleValidationErrors
];

const validateTransferBetweenWallets = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be greater than 0'),
  body('tokenAddress')
    .optional()
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  body('fromWallet')
    .optional()
    .isIn(['main', 'savings'])
    .withMessage('From wallet must be main or savings'),
  body('toWallet')
    .optional()
    .isIn(['main', 'savings'])
    .withMessage('To wallet must be main or savings'),
  handleValidationErrors
];

const validateTokenQuery = [
  query('tokenAddress')
    .notEmpty()
    .withMessage('Token address is required')
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  query('walletType')
    .optional()
    .isIn(['main', 'savings'])
    .withMessage('Wallet type must be main or savings'),
  handleValidationErrors
];

// Get wallet balances (ETH)
router.get('/balance', authMiddleware, walletController.getWalletBalance);

// Get token balance
router.get('/token-balance', authMiddleware, validateTokenQuery, walletController.getTokenBalance);

// Withdraw ETH from wallet
router.post('/withdraw-eth', authMiddleware, validateWithdrawEth, walletController.withdrawEth);

// Withdraw token from wallet
router.post('/withdraw-token', authMiddleware, validateWithdrawToken, walletController.withdrawToken);

// Send ETH to another address
router.post('/send-eth', authMiddleware, validateWithdrawEth, walletController.sendEth);

// Add supported token to wallet(s)
router.post('/add-token', authMiddleware, validateTokenAddress, walletController.addSupportedToken);

// Get supported tokens
router.get('/supported-tokens', authMiddleware, walletController.getSupportedTokens);

// Transfer between user's own wallets
router.post('/transfer', authMiddleware, validateTransferBetweenWallets, walletController.transferBetweenWallets);

module.exports = router;