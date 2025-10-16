const express = require('express');
const router = express.Router();
const gasController = require('../controllers/gasController');
const { authMiddleware } = require('../middleware/auth');

// Get backend wallet info (admin only - add admin check if needed)
router.get('/backend-wallet', authMiddleware, gasController.getBackendWalletInfo);

// Get gas estimates for operations
router.get('/estimates', gasController.getGasEstimates);

// Get gasless service status
router.get('/status', gasController.getServiceStatus);

module.exports = router;