const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authMiddleware } = require('../middleware/auth');
const {
  validateGroupCreation,
  validateGroupUpdate,
  validateGroupId
} = require('../middleware/validation');

router.post('/', authMiddleware, validateGroupCreation, groupController.createGroup);

router.get('/', authMiddleware, groupController.getUserGroups);

router.get('/:groupId', authMiddleware, validateGroupId, groupController.getGroupById);

router.post('/:groupId/join', authMiddleware, validateGroupId, groupController.joinGroup);

router.post('/:groupId/leave', authMiddleware, validateGroupId, groupController.leaveGroup);

router.get('/:groupId/members', authMiddleware, validateGroupId, groupController.getGroupMembers);

router.put('/:groupId', authMiddleware, validateGroupUpdate, groupController.updateGroup);

// Payment window management
router.post('/:groupId/payment-window', authMiddleware, validateGroupId, groupController.createPaymentWindow);
router.put('/:groupId/payment-window/:windowNumber/complete', authMiddleware, validateGroupId, groupController.completePaymentWindow);
router.get('/:groupId/payment-window/:windowNumber', authMiddleware, validateGroupId, groupController.getPaymentWindow);
router.get('/:groupId/payment-windows', authMiddleware, validateGroupId, groupController.getPaymentWindows);

// Contribution management
router.post('/:groupId/contribute', authMiddleware, validateGroupId, groupController.contribute);
router.post('/:groupId/contribute-token', authMiddleware, validateGroupId, groupController.contributeToken);
router.get('/:groupId/contributions/:userId', authMiddleware, validateGroupId, groupController.getUserContributions);

module.exports = router;