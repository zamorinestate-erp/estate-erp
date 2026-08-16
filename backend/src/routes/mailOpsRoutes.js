'use strict';

/**
 * MAILOPS COMMAND CENTRE ROUTES
 *
 * Protected API routes for operations email monitoring and queue management.
 * Accessible to MASTER role and authorized operators.
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getMailOpsStatus,
  listOutbox,
  retryOutboxItem,
  listInboundMessages,
  simulateInboundIngest,
} = require('../controllers/mailOpsController');

const router = express.Router();

// Require authentication for all MailOps routes
router.use(authenticate);

// Status & Metrics (MASTER and OWNER can view operations status)
router.get(
  '/status',
  authorize('ADMIN', { allowedRoles: ['MASTER', 'OWNER'] }),
  getMailOpsStatus
);

// Outbound queue listing & manual retry
router.get(
  '/outbox',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  listOutbox
);

router.post(
  '/outbox/:outboxId/retry',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  retryOutboxItem
);

// Inbound message review queue
router.get(
  '/inbound',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  listInboundMessages
);

router.post(
  '/inbound/simulate-ingest',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  simulateInboundIngest
);

module.exports = router;
