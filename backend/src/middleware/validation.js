const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateRegistration = [
  body('web3AuthToken')
    .notEmpty()
    .withMessage('Web3Auth token is required'),
  handleValidationErrors
];

const validateLogin = [
  body('web3AuthToken')
    .notEmpty()
    .withMessage('Web3Auth token is required'),
  handleValidationErrors
];

const validateGroupCreation = [
  body('name')
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Group name must be between 3 and 50 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('poolSettings.minContribution')
    .optional()
    .isNumeric()
    .withMessage('Minimum contribution must be a number'),
  body('poolSettings.maxMembers')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Maximum members must be between 1 and 1000'),
  body('poolSettings.isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  handleValidationErrors
];

const validateGroupUpdate = [
  param('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('name')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Group name must be between 3 and 50 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('poolSettings.minContribution')
    .optional()
    .isNumeric()
    .withMessage('Minimum contribution must be a number'),
  body('poolSettings.maxMembers')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Maximum members must be between 1 and 1000'),
  body('poolSettings.isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  handleValidationErrors
];

const validateGroupId = [
  param('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  handleValidationErrors
];

const validateJoinGroup = [
  param('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('inviteCode')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Invite code must be between 5 and 100 characters'),
  handleValidationErrors
];

const validateInviteGeneration = [
  param('groupId')
    .isMongoId()
    .withMessage('Invalid group ID'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Expires in must be between 1 and 30 days'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateGroupCreation,
  validateGroupUpdate,
  validateGroupId,
  validateJoinGroup,
  validateInviteGeneration,
  handleValidationErrors
};