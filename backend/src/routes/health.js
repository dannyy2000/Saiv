const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authMiddleware } = require('../middleware/auth');

// Public health endpoints (no authentication required)
router.get('/', healthController.getHealth);
router.get('/live', healthController.getLiveness);
router.get('/ready', healthController.getReadiness);

// Detailed health endpoints (require authentication for sensitive info)
router.get('/detailed', authMiddleware, healthController.getDetailedHealth);
router.get('/history', authMiddleware, healthController.getHealthHistory);
router.get('/dependencies', authMiddleware, healthController.getDependencies);
router.get('/config', authMiddleware, healthController.getHealthConfig);

// Specific health checks
router.get('/check/:checkName', authMiddleware, healthController.getSpecificHealth);

// Health check configuration (admin only)
router.put('/check/:checkName', authMiddleware, healthController.configureHealthCheck);

// Metrics endpoint (for monitoring systems like Prometheus)
router.get('/metrics', healthController.getMetrics);

module.exports = router;