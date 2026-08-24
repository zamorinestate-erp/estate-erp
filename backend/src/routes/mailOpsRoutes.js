'use strict';

/**
 * MAILOPS COMMAND CENTRE ROUTES — SCR-012
 *
 * REST API routes for operations email monitoring, queues, message 360,
 * threads, drafts, cases, security review, templates, automation rules,
 * sender identities, and integrity audits.
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const {
  getMailOpsStatus,
  listInboundMessages,
  getInboundMessage,
  updateInboundStatus,
  assignInboundMessage,
  addInternalNote,
  getMessage360,
  listThreads,
  replyToThread,
  listOutbox,
  retryOutboxItem,
  cancelOutboxItem,
  pauseOutboundQueue,
  resumeOutboundQueue,
  composeEmail,
  listDrafts,
  saveDraft,
  deleteDraft,
  listCases,
  createCase,
  listSecurityReview,
  quarantineMessage,
  releaseQuarantine,
  listTemplates,
  createTemplate,
  listAutomationRules,
  createAutomationRule,
  testAutomationRuleDryRun,
  listSenderIdentities,
  createSenderIdentity,
  getMailOpsIntegrity,
  getMailOpsReports,
} = require('../controllers/mailOpsController');

const router = express.Router();

router.use(authenticate);

// 1. Status & Overview
router.get(
  '/status',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMailOpsStatus
);

// 2. Operational Inbox & Messages
router.get(
  '/inbound',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listInboundMessages
);

router.get(
  '/inbound/:inboundId',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInboundMessage
);

router.patch(
  '/inbound/:inboundId/status',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  updateInboundStatus
);

router.post(
  '/inbound/:inboundId/assign',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  assignInboundMessage
);

router.post(
  '/inbound/:inboundId/notes',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  addInternalNote
);

// 3. Message 360 & Threads
router.get(
  '/inbound/:inboundId/360',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMessage360
);

router.get(
  '/threads',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listThreads
);

router.post(
  '/threads/:threadId/reply',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  replyToThread
);

// 4. Outbox & Queue Control
router.get(
  '/outbox',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listOutbox
);

router.post(
  '/outbox/:outboxId/retry',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  retryOutboxItem
);

router.post(
  '/outbox/:outboxId/cancel',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  cancelOutboxItem
);

router.post(
  '/outbox/pause',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'], requirePrimaryMaster: true }),
  pauseOutboundQueue
);

router.post(
  '/outbox/resume',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'], requirePrimaryMaster: true }),
  resumeOutboundQueue
);

// 5. Compose & Drafts
router.post(
  '/compose',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  composeEmail
);

router.get(
  '/drafts',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listDrafts
);

router.post(
  '/drafts',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  saveDraft
);

router.delete(
  '/drafts/:draftId',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  deleteDraft
);

// 6. Cases
router.get(
  '/cases',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCases
);

router.post(
  '/cases',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createCase
);

// 7. Security Review & Quarantine
router.get(
  '/security-review',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  listSecurityReview
);

router.post(
  '/inbound/:inboundId/quarantine',
  authorize('MAILOPS_WRITE', { allowedRoles: ['MASTER'] }),
  quarantineMessage
);

router.post(
  '/inbound/:inboundId/release-quarantine',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'], requirePrimaryMaster: true }),
  releaseQuarantine
);

// 8. Templates
router.get(
  '/templates',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listTemplates
);

router.post(
  '/templates',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'] }),
  createTemplate
);

// 9. Automation Rules
router.get(
  '/automation-rules',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  listAutomationRules
);

router.post(
  '/automation-rules',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'], requirePrimaryMaster: true }),
  createAutomationRule
);

router.post(
  '/automation-rules/:ruleId/dry-run',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'] }),
  testAutomationRuleDryRun
);

// 10. Sender Identities
router.get(
  '/sender-identities',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listSenderIdentities
);

router.post(
  '/sender-identities',
  authorize('MAILOPS_ADMIN', { allowedRoles: ['MASTER'], requirePrimaryMaster: true }),
  createSenderIdentity
);

// 11. MailOps Integrity Engine
router.get(
  '/integrity',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getMailOpsIntegrity
);

// 12. Reports
router.get(
  '/reports',
  authorize('MAILOPS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getMailOpsReports
);

module.exports = router;
