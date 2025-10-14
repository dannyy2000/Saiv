const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/groups', require('./groups'));
router.use('/wallet', require('./wallet'));
router.use('/savings', require('./savings'));

router.get('/', (req, res) => {
  res.json({
    message: 'Saiv Platform API',
    version: '1.0.0',
    endpoints: {
      auth: [
        'POST /api/auth/register/email',
        'POST /api/auth/register/wallet',
        'GET /api/auth/profile',
        'PUT /api/auth/balance'
      ],
      wallet: [
        'GET /api/wallet/balance',
        'GET /api/wallet/token-balance',
        'POST /api/wallet/withdraw-eth',
        'POST /api/wallet/withdraw-token',
        'POST /api/wallet/send-eth',
        'POST /api/wallet/add-token',
        'GET /api/wallet/supported-tokens',
        'POST /api/wallet/transfer'
      ],
      groups: [
        'POST /api/groups',
        'GET /api/groups',
        'GET /api/groups/:groupId',
        'POST /api/groups/:groupId/join',
        'POST /api/groups/:groupId/leave',
        'GET /api/groups/:groupId/members',
        'PUT /api/groups/:groupId',
        'POST /api/groups/:groupId/payment-window',
        'PUT /api/groups/:groupId/payment-window/:windowNumber/complete',
        'GET /api/groups/:groupId/payment-window/:windowNumber',
        'GET /api/groups/:groupId/payment-windows',
        'POST /api/groups/:groupId/contribute',
        'POST /api/groups/:groupId/contribute-token',
        'GET /api/groups/:groupId/contributions/:userId'
      ],
      savings: [
        'POST /api/savings/personal',
        'POST /api/savings/group',
        'GET /api/savings',
        'GET /api/savings/:savingsId',
        'PUT /api/savings/:savingsId',
        'POST /api/savings/:savingsId/deposit',
        'POST /api/savings/:savingsId/withdraw',
        'GET /api/savings/:savingsId/transactions'
      ],
      health: [
        'GET /api/health'
      ]
    }
  });
});

module.exports = router;