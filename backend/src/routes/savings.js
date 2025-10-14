const express = require('express');
const router = express.Router();
const savingsController = require('../controllers/savingsController');
const { authMiddleware } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

// Validation middlewares
const validatePersonalSavingsCreation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1-100 characters'),
  body('targetAmount')
    .isNumeric()
    .withMessage('Target amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Target amount must be greater than 0'),
  body('currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string'),
  body('tokenAddress')
    .optional()
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  body('interest')
    .optional()
    .isNumeric()
    .withMessage('Interest must be a number')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Interest must be between 0-100'),
  body('settings.minContribution')
    .optional()
    .isNumeric()
    .withMessage('Minimum contribution must be a number'),
  body('settings.lockUntilDate')
    .optional()
    .isISO8601()
    .withMessage('Lock until date must be a valid date'),
  handleValidationErrors
];

const validateGroupSavingsCreation = [
  body('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and must be between 1-100 characters'),
  body('targetAmount')
    .isNumeric()
    .withMessage('Target amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Target amount must be greater than 0'),
  body('currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string'),
  body('tokenAddress')
    .optional()
    .isEthereumAddress()
    .withMessage('Invalid token address'),
  body('interest')
    .optional()
    .isNumeric()
    .withMessage('Interest must be a number')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Interest must be between 0-100'),
  handleValidationErrors
];

const validateSavingsId = [
  param('savingsId')
    .isMongoId()
    .withMessage('Invalid savings ID'),
  handleValidationErrors
];

const validateTransactionAmount = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Amount must be greater than 0'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be maximum 200 characters'),
  handleValidationErrors
];

const validateSavingsUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1-100 characters'),
  body('targetAmount')
    .optional()
    .isNumeric()
    .withMessage('Target amount must be a number')
    .isFloat({ min: 0.000001 })
    .withMessage('Target amount must be greater than 0'),
  body('status')
    .optional()
    .isIn(['active', 'paused', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

const validateQueryParams = [
  query('type')
    .optional()
    .isIn(['personal', 'group', 'all'])
    .withMessage('Type must be personal, group, or all'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100'),
  handleValidationErrors
];

// Personal Savings Routes
router.post('/personal', authMiddleware, validatePersonalSavingsCreation, savingsController.createPersonalSavings);

// Group Savings Routes
router.post('/group', authMiddleware, validateGroupSavingsCreation, savingsController.createGroupSavings);

// Get user's savings (personal and/or group)
router.get('/', authMiddleware, validateQueryParams, savingsController.getUserSavings);

// Get specific savings by ID
router.get('/:savingsId', authMiddleware, validateSavingsId, savingsController.getSavingsById);

// Update savings settings
router.put('/:savingsId', authMiddleware, validateSavingsId, validateSavingsUpdate, savingsController.updateSavings);

// Deposit to savings
router.post('/:savingsId/deposit', authMiddleware, validateSavingsId, validateTransactionAmount, savingsController.deposit);

// Withdraw from savings
router.post('/:savingsId/withdraw', authMiddleware, validateSavingsId, validateTransactionAmount, savingsController.withdraw);

// Get savings transactions
router.get('/:savingsId/transactions', authMiddleware, validateSavingsId, validateQueryParams, savingsController.getTransactions);

module.exports = router;