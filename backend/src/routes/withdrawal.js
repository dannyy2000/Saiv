const express = require('express');
const router = express.Router();
const withdrawalIntegrationService = require('../services/withdrawalIntegrationService');
const { authMiddleware } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const Group = require('../models/Group');

/**
 * Get withdrawal service status
 * GET /api/withdrawal/status
 */
router.get('/status', authMiddleware, catchAsync(async (req, res) => {
  const status = withdrawalIntegrationService.getStatus();

  res.status(200).json({
    success: true,
    data: status
  });
}));

/**
 * Get monitored groups
 * GET /api/withdrawal/groups
 */
router.get('/groups', authMiddleware, catchAsync(async (req, res) => {
  const monitoredGroups = withdrawalIntegrationService.getMonitoredGroups();

  res.status(200).json({
    success: true,
    data: {
      groups: monitoredGroups,
      count: monitoredGroups.length
    }
  });
}));

/**
 * Add group to withdrawal monitoring
 * POST /api/withdrawal/groups/:groupId/monitor
 */
router.post('/groups/:groupId/monitor', authMiddleware, catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Find the group
  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user has permission (owner or admin)
  if (group.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to manage this group'
    });
  }

  // Add to monitoring
  const added = await withdrawalIntegrationService.addGroupToMonitoring(group);

  if (added) {
    res.status(200).json({
      success: true,
      message: 'Group added to withdrawal monitoring',
      data: {
        groupId: group._id,
        address: group.address
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Failed to add group to withdrawal monitoring'
    });
  }
}));

/**
 * Remove group from withdrawal monitoring
 * DELETE /api/withdrawal/groups/:groupId/monitor
 */
router.delete('/groups/:groupId/monitor', authMiddleware, catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Find the group
  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user has permission (owner or admin)
  if (group.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to manage this group'
    });
  }

  // Remove from monitoring
  const removed = withdrawalIntegrationService.removeGroupFromMonitoring(group.address);

  if (removed) {
    res.status(200).json({
      success: true,
      message: 'Group removed from withdrawal monitoring',
      data: {
        groupId: group._id,
        address: group.address
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Failed to remove group from withdrawal monitoring'
    });
  }
}));

/**
 * Trigger manual withdrawal for a group
 * POST /api/withdrawal/groups/:groupId/trigger
 */
router.post('/groups/:groupId/trigger', authMiddleware, catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Find the group
  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user has permission (owner or admin)
  if (group.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to manage this group'
    });
  }

  // Trigger manual withdrawal
  const result = await withdrawalIntegrationService.triggerManualWithdrawal(group.address);

  res.status(200).json({
    success: result.success,
    message: result.message,
    data: {
      groupId: group._id,
      address: group.address,
      result
    }
  });
}));

/**
 * Get group withdrawal history
 * GET /api/withdrawal/groups/:groupId/history
 */
router.get('/groups/:groupId/history', authMiddleware, catchAsync(async (req, res) => {
  const { groupId } = req.params;

  // Find the group with withdrawal data
  const group = await Group.findById(groupId)
    .populate('automaticWithdrawal.transactions.memberPayouts.userId', 'username walletAddress')
    .select('address name automaticWithdrawal lockPeriod groupStatus');

  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user has permission (owner, member, or admin)
  const isMember = group.members.some(member =>
    member.user.toString() === req.user._id.toString()
  );
  const isOwner = group.owner.toString() === req.user._id.toString();

  if (!isOwner && !isMember) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this group'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      groupId: group._id,
      address: group.address,
      name: group.name,
      lockPeriod: group.lockPeriod,
      groupStatus: group.groupStatus,
      automaticWithdrawal: group.automaticWithdrawal || {
        enabled: true,
        transactions: [],
        errors: []
      }
    }
  });
}));

/**
 * Sync group events from blockchain
 * POST /api/withdrawal/groups/:groupId/sync
 */
router.post('/groups/:groupId/sync', authMiddleware, catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { fromBlock = 0 } = req.body;

  // Find the group
  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Group not found'
    });
  }

  // Check if user has permission (owner or admin)
  if (group.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to manage this group'
    });
  }

  // Sync events
  const synced = await withdrawalIntegrationService.syncGroupEvents(group.address, fromBlock);

  res.status(200).json({
    success: synced,
    message: synced ? 'Group events synced successfully' : 'Failed to sync group events',
    data: {
      groupId: group._id,
      address: group.address,
      fromBlock
    }
  });
}));

/**
 * Health check for withdrawal services
 * GET /api/withdrawal/health
 */
router.get('/health', catchAsync(async (req, res) => {
  const healthCheck = await withdrawalIntegrationService.healthCheck();

  res.status(healthCheck.healthy ? 200 : 503).json({
    success: healthCheck.healthy,
    data: healthCheck
  });
}));

/**
 * Start withdrawal service (admin only)
 * POST /api/withdrawal/start
 */
router.post('/start', authMiddleware, catchAsync(async (req, res) => {
  // TODO: Add admin check here
  // For now, allow any authenticated user

  try {
    await withdrawalIntegrationService.start();

    res.status(200).json({
      success: true,
      message: 'Withdrawal service started successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: `Failed to start withdrawal service: ${error.message}`
    });
  }
}));

/**
 * Stop withdrawal service (admin only)
 * POST /api/withdrawal/stop
 */
router.post('/stop', authMiddleware, catchAsync(async (req, res) => {
  // TODO: Add admin check here
  // For now, allow any authenticated user

  withdrawalIntegrationService.stop();

  res.status(200).json({
    success: true,
    message: 'Withdrawal service stopped successfully'
  });
}));

module.exports = router;