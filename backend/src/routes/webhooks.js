const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authMiddleware } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

// Validation middleware for webhook endpoints
const validateStartListening = [
  body('contractAddress')
    .notEmpty()
    .withMessage('Contract address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('eventFilters')
    .optional()
    .isArray()
    .withMessage('Event filters must be an array'),
  handleValidationErrors
];

const validateStopListening = [
  body('contractAddress')
    .notEmpty()
    .withMessage('Contract address is required')
    .isEthereumAddress()
    .withMessage('Invalid Ethereum address'),
  body('eventName')
    .optional()
    .isString()
    .withMessage('Event name must be a string'),
  handleValidationErrors
];

const validateTriggerWebhook = [
  body('eventName')
    .notEmpty()
    .withMessage('Event name is required')
    .isString()
    .withMessage('Event name must be a string'),
  body('mockData')
    .optional()
    .isObject()
    .withMessage('Mock data must be an object'),
  handleValidationErrors
];

// Public health check (no auth required)
router.get('/health', webhookController.healthCheck);

// Protected admin routes (require authentication)
router.get('/status', authMiddleware, webhookController.getStatus);

router.post('/start', authMiddleware, validateStartListening, webhookController.startListening);

router.post('/stop', authMiddleware, validateStopListening, webhookController.stopListening);

router.get('/logs', authMiddleware, webhookController.getEventLogs);

// Testing endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/trigger', authMiddleware, validateTriggerWebhook, webhookController.triggerWebhook);
}

module.exports = router;