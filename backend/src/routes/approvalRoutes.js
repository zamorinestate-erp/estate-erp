'use strict';

/**
 * APPROVAL ROUTES
 * Mounted at: /api/v1/approvals (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listApprovals,
  decideApproval,
} = require('../controllers/approvalController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('APPROVALS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listApprovals
);

router.post(
  '/:approvalId/decide',
  authorize('APPROVALS_DECIDE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  decideApproval
);

module.exports = router;
