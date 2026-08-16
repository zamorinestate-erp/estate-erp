'use strict';

/**
 * MAILOPS COMMAND CENTRE CONTROLLER
 *
 * REST API controller for the MailOps Command Centre, Outbound Queue management,
 * Inbound Message review queue, Attachment Security Gateway, Incident dashboard,
 * and Quota Budget analytics.
 */

const { SystemCommunicationSettings } = require('../models/SystemCommunicationSettings');
const { NotificationOutbox } = require('../models/NotificationOutbox');
const { InboundEmailMessage } = require('../models/InboundEmailMessage');
const { AttachmentRegistry } = require('../models/AttachmentRegistry');
const { Incident } = require('../models/Incident');
const { SupportCase } = require('../models/SupportCase');
const { MailOpsService } = require('../services/MailOpsService');
const { notificationService } = require('../services/NotificationService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

/**
 * GET /api/v1/mailops/status
 * Fetches high-level MailOps Command Centre metrics.
 */
const getMailOpsStatus = asyncHandler(async (req, res) => {
  const organisationId = req.user?.organisationId || 'ZAMORIN';

  const settings = await SystemCommunicationSettings.findOne({ organisationId }).lean() || {
    operationsEmail: 'zamorinestatepvtltd.erp@gmail.com',
    primaryMasterEmail: 'pradeeshk331@gmail.com',
    provider: 'GMAIL_API',
    enabled: true,
  };

  const providerHealth = await notificationService.getProvider().checkHealth();

  // Queue counts
  const outboundQueued = await NotificationOutbox.countDocuments({ organisationId, status: 'QUEUED' });
  const outboundProcessing = await NotificationOutbox.countDocuments({ organisationId, status: 'PROCESSING' });
  const outboundRetrying = await NotificationOutbox.countDocuments({ organisationId, status: 'RETRY' });
  const outboundFailed = await NotificationOutbox.countDocuments({ organisationId, status: 'FAILED' });
  const draftsAwaitingReview = await NotificationOutbox.countDocuments({ organisationId, draftStatus: 'AWAITING_REVIEW' });

  // Inbound counts
  const inboundPending = await InboundEmailMessage.countDocuments({ organisationId, status: 'PENDING' });
  const inboundQuarantined = await InboundEmailMessage.countDocuments({ organisationId, isQuarantined: true });
  const becIncidents = await InboundEmailMessage.countDocuments({ organisationId, isBecSuspected: true });

  // Incidents & Cases
  const openIncidents = await Incident.countDocuments({ organisationId, status: { $in: ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING'] } });
  const openSupportCases = await SupportCase.countDocuments({ organisationId, status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } });

  // Quota status
  const quota = await MailOpsService.getQuotaStatus(organisationId);

  res.status(200).json({
    success: true,
    data: {
      operationsEmail: settings.operationsEmail,
      primaryMasterEmail: settings.primaryMasterEmail,
      provider: settings.provider,
      providerHealth,
      outbound: {
        queued: outboundQueued,
        processing: outboundProcessing,
        retrying: outboundRetrying,
        failed: outboundFailed,
        draftsAwaitingReview,
      },
      inbound: {
        pending: inboundPending,
        quarantined: inboundQuarantined,
        becIncidents,
      },
      incidents: {
        openCount: openIncidents,
      },
      support: {
        openCases: openSupportCases,
      },
      quota,
      watchStatus: settings.gmailWatch?.status || 'DISABLED',
      lastSyncedAt: settings.gmailWatch?.lastSuccessfulSyncAt || null,
    },
  });
});

/**
 * GET /api/v1/mailops/outbox
 * Lists outbox records with filtering.
 */
const listOutbox = asyncHandler(async (req, res) => {
  const organisationId = req.user?.organisationId || 'ZAMORIN';
  const { status, limit = 50, page = 1 } = req.query;

  const query = { organisationId };
  if (status) query.status = status;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const items = await NotificationOutbox.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  const total = await NotificationOutbox.countDocuments(query);

  res.status(200).json({
    success: true,
    data: { items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) },
  });
});

/**
 * POST /api/v1/mailops/outbox/:outboxId/retry
 * Safe manual retry for failed or retrying outbox records.
 */
const retryOutboxItem = asyncHandler(async (req, res) => {
  const organisationId = req.user?.organisationId || 'ZAMORIN';
  const { outboxId } = req.params;

  const item = await NotificationOutbox.findOne({ outboxId, organisationId });
  if (!item) {
    throw new ApiError(404, `Outbox record ${outboxId} not found.`);
  }

  item.status = 'QUEUED';
  item.nextRetryAt = null;
  await item.save();

  await notificationService.processOutboxBatch([item]);

  res.status(200).json({
    success: true,
    message: `Outbox record ${outboxId} triggered for delivery.`,
    data: item,
  });
});

/**
 * GET /api/v1/mailops/inbound
 * Lists inbound messages and review queue.
 */
const listInboundMessages = asyncHandler(async (req, res) => {
  const organisationId = req.user?.organisationId || 'ZAMORIN';
  const { classification, isQuarantined, limit = 50, page = 1 } = req.query;

  const query = { organisationId };
  if (classification) query.classification = classification;
  if (isQuarantined !== undefined) query.isQuarantined = isQuarantined === 'true';

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const items = await InboundEmailMessage.find(query)
    .sort({ receivedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  const total = await InboundEmailMessage.countDocuments(query);

  res.status(200).json({
    success: true,
    data: { items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) },
  });
});

/**
 * POST /api/v1/mailops/inbound/simulate-ingest
 * Development / testing endpoint to simulate an inbound email.
 */
const simulateInboundIngest = asyncHandler(async (req, res) => {
  const organisationId = req.user?.organisationId || 'ZAMORIN';
  const {
    gmailMessageId = `SIM-${Date.now()}`,
    gmailThreadId = `THREAD-${Date.now()}`,
    senderEmail,
    senderName,
    subject,
    bodyText,
    attachments = [],
  } = req.body;

  if (!senderEmail || !subject) {
    throw new ApiError(400, 'senderEmail and subject are required.');
  }

  const result = await MailOpsService.ingestInboundMessage({
    gmailMessageId,
    gmailThreadId,
    senderEmail,
    senderName,
    subject,
    bodyText,
    attachments,
    organisationId,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getMailOpsStatus,
  listOutbox,
  retryOutboxItem,
  listInboundMessages,
  simulateInboundIngest,
};
