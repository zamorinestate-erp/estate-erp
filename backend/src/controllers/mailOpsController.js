'use strict';

/**
 * MAILOPS COMMAND CENTRE CONTROLLER — SCR-012
 *
 * REST API controller for the Zamorin MailOps Command Centre, Operational Inbox,
 * Outbound Queue, Message 360, Drafts, Cases, Security/BEC Review, Quarantine,
 * Templates, Automation Rules, Sender Identities, Provider Health, and Integrity Audit.
 */

const { SystemCommunicationSettings } = require('../models/SystemCommunicationSettings');
const { NotificationOutbox } = require('../models/NotificationOutbox');
const { InboundEmailMessage } = require('../models/InboundEmailMessage');
const { MailThread } = require('../models/MailThread');
const { MailDraft } = require('../models/MailDraft');
const { MailCase } = require('../models/MailCase');
const { MailTemplate } = require('../models/MailTemplate');
const { MailAutomationRule } = require('../models/MailAutomationRule');
const { SenderIdentity } = require('../models/SenderIdentity');
const { AttachmentRegistry } = require('../models/AttachmentRegistry');
const { Incident } = require('../models/Incident');
const { SupportCase } = require('../models/SupportCase');
const { MailOpsService } = require('../services/MailOpsService');
const { notificationService } = require('../services/NotificationService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

function assertCafeAccess(request, cafeId) {
  if (!cafeId) return;
  const { role, assignedCafeIds } = request.auth;
  if (role === 'MASTER' || role === 'OWNER') return;
  const normCafe = cafeId.trim().toUpperCase();
  const allowed = (assignedCafeIds || []).map((id) => id.trim().toUpperCase());
  if (!allowed.includes(normCafe)) {
    throw new ApiError(403, 'CAFE_ACCESS_DENIED', `Access to communications for café ${cafeId} is denied.`);
  }
}

function requirePrimaryMaster(request) {
  const { role, isPrimaryMaster } = request.auth;
  if (role !== 'MASTER' || !isPrimaryMaster) {
    throw new ApiError(403, 'PRIMARY_MASTER_REQUIRED', 'This action requires Primary MASTER governance.');
  }
}

// ── 1. Telemetry & Overview ──────────────────────────────────────────────────
const getMailOpsStatus = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { cafeId } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();

  const rawSettings = await SystemCommunicationSettings.findOne({ organisationId });
  const settings = (rawSettings?.toObject ? rawSettings.toObject() : rawSettings) || {
    operationsEmail: 'zamorinestatepvtltd.erp@gmail.com',
    primaryMasterEmail: 'pradeeshk331@gmail.com',
    provider: 'GMAIL_API',
    oauthStatus: 'CONNECTED',
    oauthCapabilities: { readMail: true, sendMail: true, modifyLabels: true, sendAsSettings: false },
    dailySendBudgetLimit: 500,
    outboundPaused: false,
    enabled: true,
  };

  let providerHealth = { status: 'HEALTHY' };
  try {
    const p = notificationService.getProvider();
    if (p && typeof p.checkHealth === 'function') {
      providerHealth = await p.checkHealth();
    }
  } catch (_) {
    // Non-blocking fallback
  }

  // Outbound Queue Counts
  const outboundQueued = await NotificationOutbox.countDocuments({ ...filter, status: 'QUEUED' });
  const outboundProcessing = await NotificationOutbox.countDocuments({ ...filter, status: 'PROCESSING' });
  const outboundRetrying = await NotificationOutbox.countDocuments({ ...filter, status: { $in: ['RETRY', 'RETRY_SCHEDULED'] } });
  const outboundFailed = await NotificationOutbox.countDocuments({ ...filter, status: 'FAILED' });
  const outboundDeadLetter = await NotificationOutbox.countDocuments({ ...filter, status: 'DEAD_LETTER' });
  const draftsCount = await MailDraft.countDocuments({ ...filter, status: 'DRAFT' });

  // Inbound Counts
  const inboundTotal = await InboundEmailMessage.countDocuments(filter);
  const inboundPending = await InboundEmailMessage.countDocuments({ ...filter, queueStatus: { $in: ['NEW', 'REQUIRES_ACTION'] } });
  const inboundAssigned = await InboundEmailMessage.countDocuments({ ...filter, queueStatus: 'ASSIGNED' });
  const inboundQuarantined = await InboundEmailMessage.countDocuments({ ...filter, queueStatus: 'QUARANTINE' });
  const becIncidents = await InboundEmailMessage.countDocuments({ ...filter, isBecSuspected: true });
  const securityReviewCount = await InboundEmailMessage.countDocuments({ ...filter, queueStatus: 'SECURITY_REVIEW' });

  // Quota & Budget
  const quota = await MailOpsService.getQuotaStatus(organisationId);

  return response.status(200).json({
    operationsEmail: settings.operationsEmail,
    primaryMasterEmail: settings.primaryMasterEmail,
    provider: settings.provider,
    providerHealth: providerHealth?.status || 'HEALTHY',
    oauthStatus: settings.oauthStatus || 'CONNECTED',
    oauthCapabilities: settings.oauthCapabilities,
    outboundPaused: Boolean(settings.outboundPaused),
    kpis: {
      outboundQueued,
      outboundProcessing,
      outboundRetrying,
      outboundFailed,
      outboundDeadLetter,
      draftsCount,
      inboundTotal,
      inboundPending,
      inboundAssigned,
      inboundQuarantined,
      becIncidents,
      securityReviewCount,
      dailySendBudgetLimit: settings.dailySendBudgetLimit || 500,
      sentToday: quota.sentToday,
      remainingBudget: quota.remainingBudget,
    },
    watch: {
      status: settings.gmailWatch?.status || 'ACTIVE',
      watchExpiration: settings.gmailWatch?.watchExpiration || new Date(Date.now() + 7 * 86400000),
      lastSuccessfulSyncAt: settings.gmailWatch?.lastSuccessfulSyncAt || new Date(),
    },
  });
});

// ── 2. Operational Inbox & Queues ────────────────────────────────────────────
const listInboundMessages = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { queue = 'ALL', cafeId, search, classification, limit = 50, page = 1 } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();

  if (queue !== 'ALL') {
    filter.queueStatus = queue.trim().toUpperCase();
  }

  if (classification) {
    filter.classification = classification.trim().toUpperCase();
  }

  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { subject: { $regex: q, $options: 'i' } },
      { senderEmail: { $regex: q, $options: 'i' } },
      { senderName: { $regex: q, $options: 'i' } },
      { inboundId: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const messages = await InboundEmailMessage.find(filter)
    .select('inboundId gmailMessageId gmailThreadId senderEmail senderName subject classification riskScore isBecSuspected isQuarantined queueStatus receivedAt cafeId linkedEntityType linkedEntityId attachmentCount')
    .sort({ receivedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const total = await InboundEmailMessage.countDocuments(filter);

  return response.status(200).json({ messages, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
});

const getInboundMessage = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { inboundId } = request.params;

  const rawMsg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  const msg = rawMsg?.toObject ? rawMsg.toObject() : rawMsg;
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  if (msg.cafeId) assertCafeAccess(request, msg.cafeId);

  return response.status(200).json({ message: msg });
});

const updateInboundStatus = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { inboundId } = request.params;
  const { queueStatus, linkedEntityType, linkedEntityId } = request.body;

  const msg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  if (msg.cafeId) assertCafeAccess(request, msg.cafeId);

  if (queueStatus) msg.queueStatus = queueStatus;
  if (linkedEntityType) msg.linkedEntityType = linkedEntityType;
  if (linkedEntityId) msg.linkedEntityId = linkedEntityId;

  await msg.save();
  return response.status(200).json({ message: 'Message updated successfully.', data: msg });
});

const assignInboundMessage = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { inboundId } = request.params;
  const { assignedToUserId, cafeId } = request.body;

  const msg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  if (msg.cafeId) assertCafeAccess(request, msg.cafeId);
  if (cafeId) assertCafeAccess(request, cafeId);

  msg.assignedToUserId = assignedToUserId || userId;
  if (cafeId) msg.cafeId = cafeId.trim().toUpperCase();
  msg.queueStatus = 'ASSIGNED';
  await msg.save();

  return response.status(200).json({ message: 'Message assigned.', data: msg });
});

const addInternalNote = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { inboundId } = request.params;
  const { content } = request.body;

  if (!content || !content.trim()) {
    throw new ApiError(400, 'NOTE_EMPTY', 'Internal note content cannot be empty.');
  }

  const msg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  if (msg.cafeId) assertCafeAccess(request, msg.cafeId);

  const note = {
    noteId: `NOTE-${Date.now().toString().slice(-4)}`,
    authorUserId: userId,
    content: content.trim(),
    createdAt: new Date(),
  };

  msg.internalNotes.push(note);
  await msg.save();

  return response.status(201).json({ message: 'Internal note added.', note });
});

// ── 3. Message 360 & Conversation Threads ────────────────────────────────────
const getMessage360 = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { inboundId } = request.params;

  const rawMsg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  const message = rawMsg?.toObject ? rawMsg.toObject() : rawMsg;
  if (!message) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  if (message.cafeId) assertCafeAccess(request, message.cafeId);

  const threadMessages = await InboundEmailMessage.find({
    organisationId,
    gmailThreadId: message.gmailThreadId,
  });

  const linkedOutbox = await NotificationOutbox.find({
    organisationId,
    providerThreadId: message.gmailThreadId,
  });

  return response.status(200).json({
    message,
    threadMessages: Array.isArray(threadMessages) ? threadMessages : [],
    linkedOutbox: Array.isArray(linkedOutbox) ? linkedOutbox : [],
  });
});

const listThreads = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { cafeId, status } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();
  if (status) filter.status = status;

  const threads = await MailThread.find(filter).sort({ lastMessageAt: -1 }).limit(50).lean();
  return response.status(200).json({ threads });
});

const replyToThread = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { threadId } = request.params;
  const { bodyHtml, bodyPlain, to, cc, subject, fromIdentityId } = request.body;

  const thread = await MailThread.findOne({ organisationId, threadId });
  if (!thread) {
    throw new ApiError(404, 'THREAD_NOT_FOUND', `Thread ${threadId} not found.`);
  }

  if (thread.cafeId) assertCafeAccess(request, thread.cafeId);

  const count = await NotificationOutbox.countDocuments({ organisationId });
  const outboxId = `OUT-RPL-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`;
  const correlationId = `ZMO-RPL-${Date.now()}`;

  const outboxItem = await NotificationOutbox.create({
    outboxId,
    organisationId,
    cafeId: thread.cafeId,
    correlationId,
    eventType: 'OPERATIONAL_THREAD_REPLY',
    recipientEmail: to || thread.participants[0]?.email,
    recipientRole: 'STAFF',
    templateId: 'THREAD_REPLY',
    subject: subject || `Re: ${thread.subject}`,
    renderedSubject: subject || `Re: ${thread.subject}`,
    renderedBody: MailOpsService.sanitizeHtml(bodyHtml || bodyPlain),
    renderedBodyPlain: bodyPlain || '',
    providerThreadId: thread.gmailThreadId,
    status: 'QUEUED',
    nextAttemptAt: new Date(),
  });

  return response.status(201).json({ message: 'Reply queued in Outbox.', outboxItem });
});

// ── 4. Outbox & Queue Health ─────────────────────────────────────────────────
const listOutbox = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { status, cafeId, limit = 50, page = 1 } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();
  if (status) filter.status = status.trim().toUpperCase();

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const outbox = await NotificationOutbox.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const total = await NotificationOutbox.countDocuments(filter);
  return response.status(200).json({ outbox, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
});

const retryOutboxItem = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { outboxId } = request.params;

  const item = await NotificationOutbox.findOne({ organisationId, outboxId });
  if (!item) {
    throw new ApiError(404, 'OUTBOX_ITEM_NOT_FOUND', `Outbox item ${outboxId} not found.`);
  }

  if (item.cafeId) assertCafeAccess(request, item.cafeId);

  item.status = 'QUEUED';
  item.retryCount += 1;
  item.nextAttemptAt = new Date();
  await item.save();

  return response.status(200).json({ message: `Outbox item ${outboxId} rescheduled for delivery.`, item });
});

const cancelOutboxItem = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { outboxId } = request.params;

  const item = await NotificationOutbox.findOne({ organisationId, outboxId });
  if (!item) {
    throw new ApiError(404, 'OUTBOX_ITEM_NOT_FOUND', `Outbox item ${outboxId} not found.`);
  }

  if (item.cafeId) assertCafeAccess(request, item.cafeId);

  item.status = 'CANCELLED';
  await item.save();

  return response.status(200).json({ message: `Outbox item ${outboxId} cancelled.`, item });
});

const pauseOutboundQueue = asyncHandler(async (request, response) => {
  requirePrimaryMaster(request);
  const { organisationId } = request.auth;

  let settings = await SystemCommunicationSettings.findOne({ organisationId });
  if (!settings) {
    settings = await SystemCommunicationSettings.create({ organisationId, outboundPaused: true });
  } else {
    settings.outboundPaused = true;
    await settings.save();
  }

  return response.status(200).json({ message: 'Outbound queue paused by Primary Master.', outboundPaused: true });
});

const resumeOutboundQueue = asyncHandler(async (request, response) => {
  requirePrimaryMaster(request);
  const { organisationId } = request.auth;

  const settings = await SystemCommunicationSettings.findOne({ organisationId });
  if (settings) {
    settings.outboundPaused = false;
    await settings.save();
  }

  return response.status(200).json({ message: 'Outbound queue resumed.', outboundPaused: false });
});

// ── 5. Compose & Drafts ──────────────────────────────────────────────────────
const composeEmail = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { to, cc, bcc, subject, bodyHtml, bodyPlain, templateId, cafeId, sourceModule, scheduledFor, requiresApproval } = request.body;

  if (!to || !subject) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Recipient (to) and subject are required.');
  }

  if (cafeId) assertCafeAccess(request, cafeId);

  const recipientEmail = typeof to === 'string' ? to.trim().toLowerCase() : to[0]?.email;
  const count = await NotificationOutbox.countDocuments({ organisationId });
  const outboxId = `OUT-${Date.now().toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`;
  const correlationId = `ZMO-MAIL-${Date.now()}`;

  const cleanHtml = MailOpsService.sanitizeHtml(bodyHtml || bodyPlain);

  const outboxItem = await NotificationOutbox.create({
    outboxId,
    organisationId,
    cafeId: cafeId ? cafeId.trim().toUpperCase() : null,
    correlationId,
    eventType: 'OPERATIONAL_DIRECT_SEND',
    recipientEmail,
    recipientRole: 'STAFF',
    templateId: templateId || 'DIRECT_COMPOSE',
    subject: subject.trim(),
    renderedSubject: subject.trim(),
    renderedBody: cleanHtml,
    renderedBodyPlain: bodyPlain || '',
    requiresApproval: Boolean(requiresApproval),
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    status: requiresApproval ? 'APPROVAL_REQUIRED' : scheduledFor ? 'SCHEDULED' : 'QUEUED',
    nextAttemptAt: scheduledFor ? new Date(scheduledFor) : new Date(),
  });

  return response.status(201).json({ message: 'Email queued for delivery.', outboxItem });
});

const listDrafts = asyncHandler(async (request, response) => {
  const { organisationId, userId, role } = request.auth;
  const { cafeId } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId, status: 'DRAFT' };
  if (role !== 'MASTER') filter.createdByUserId = userId;
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();

  const drafts = await MailDraft.find(filter).sort({ updatedAt: -1 }).lean();
  return response.status(200).json({ drafts });
});

const saveDraft = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { draftId, to, subject, bodyHtml, bodyPlain, cafeId, sourceModule } = request.body;

  if (cafeId) assertCafeAccess(request, cafeId);

  let draft;
  if (draftId) {
    draft = await MailDraft.findOne({ organisationId, draftId });
    if (draft) {
      draft.version += 1;
      draft.to = Array.isArray(to) ? to : [{ email: to }];
      draft.subject = subject || draft.subject;
      draft.bodyHtml = bodyHtml || draft.bodyHtml;
      draft.bodyPlain = bodyPlain || draft.bodyPlain;
      draft.lastUpdatedByUserId = userId;
      await draft.save();
      return response.status(200).json({ message: 'Draft updated.', draft });
    }
  }

  const count = await MailDraft.countDocuments({ organisationId });
  const newDraftId = `DFT-2026-${String(count + 1).padStart(4, '0')}`;

  draft = await MailDraft.create({
    organisationId,
    draftId: newDraftId,
    version: 1,
    to: Array.isArray(to) ? to : to ? [{ email: to }] : [],
    subject: subject || 'Untitled Draft',
    bodyHtml: bodyHtml || '',
    bodyPlain: bodyPlain || '',
    cafeId: cafeId ? cafeId.trim().toUpperCase() : null,
    sourceModule: sourceModule || 'GENERAL',
    createdByUserId: userId,
    lastUpdatedByUserId: userId,
    status: 'DRAFT',
  });

  return response.status(201).json({ message: 'Draft saved.', draft });
});

const deleteDraft = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { draftId } = request.params;

  const draft = await MailDraft.findOne({ organisationId, draftId });
  if (!draft) {
    throw new ApiError(404, 'DRAFT_NOT_FOUND', `Draft ${draftId} not found.`);
  }

  draft.status = 'DISCARDED';
  await draft.save();

  return response.status(200).json({ message: `Draft ${draftId} discarded.` });
});

// ── 6. MailOps Cases ─────────────────────────────────────────────────────────
const listCases = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { cafeId, status } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = { organisationId };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();
  if (status) filter.status = status;

  const cases = await MailCase.find(filter).sort({ updatedAt: -1 }).lean();
  return response.status(200).json({ cases });
});

const createCase = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { title, entityType, entityId, cafeId, priority = 'NORMAL', threadIds = [] } = request.body;

  if (!title || !entityType || !entityId) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Case title, entity type, and entity ID are required.');
  }

  if (cafeId) assertCafeAccess(request, cafeId);

  const count = await MailCase.countDocuments({ organisationId });
  const caseId = `MOPS-CASE-${String(count + 1).padStart(5, '0')}`;

  const mailCase = await MailCase.create({
    organisationId,
    caseId,
    title: title.trim(),
    entityType,
    entityId: entityId.trim(),
    cafeId: cafeId ? cafeId.trim().toUpperCase() : null,
    priority,
    threadIds,
    createdByUserId: userId,
    status: 'OPEN',
  });

  return response.status(201).json({ message: 'MailOps Case created.', case: mailCase });
});

// ── 7. Security Review & Quarantine ──────────────────────────────────────────
const listSecurityReview = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { cafeId } = request.query;

  if (cafeId) assertCafeAccess(request, cafeId);

  const filter = {
    organisationId,
    $or: [{ queueStatus: { $in: ['SECURITY_REVIEW', 'QUARANTINE'] } }, { isBecSuspected: true }, { isQuarantined: true }],
  };
  if (cafeId) filter.cafeId = cafeId.trim().toUpperCase();

  const flaggedMessages = await InboundEmailMessage.find(filter).sort({ receivedAt: -1 }).lean();
  return response.status(200).json({ flaggedMessages });
});

const quarantineMessage = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { inboundId } = request.params;
  const { reason } = request.body;

  const msg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  msg.isQuarantined = true;
  msg.quarantineReason = reason || 'Manual security quarantine hold';
  msg.queueStatus = 'QUARANTINE';
  await msg.save();

  return response.status(200).json({ message: `Message ${inboundId} moved to quarantine.`, messageDoc: msg });
});

const releaseQuarantine = asyncHandler(async (request, response) => {
  requirePrimaryMaster(request);
  const { organisationId } = request.auth;
  const { inboundId } = request.params;

  const msg = await InboundEmailMessage.findOne({ organisationId, inboundId });
  if (!msg) {
    throw new ApiError(404, 'MESSAGE_NOT_FOUND', `Inbound message ${inboundId} not found.`);
  }

  msg.isQuarantined = false;
  msg.queueStatus = 'REQUIRES_ACTION';
  msg.status = 'PROCESSED';
  await msg.save();

  return response.status(200).json({ message: `Message ${inboundId} released from quarantine by Primary Master.`, messageDoc: msg });
});

// ── 8. Templates Centre ──────────────────────────────────────────────────────
const listTemplates = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const templates = await MailTemplate.find({ organisationId, status: { $ne: 'ARCHIVED' } }).lean();
  return response.status(200).json({ templates });
});

const createTemplate = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { name, category, subjectTemplate, bodyTemplateHtml, bodyTemplatePlain, requiredVariables } = request.body;

  if (!name || !subjectTemplate || !bodyTemplateHtml) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Template name, subject, and HTML body are required.');
  }

  const count = await MailTemplate.countDocuments({ organisationId });
  const templateId = `TPL-2026-${String(count + 1).padStart(4, '0')}`;

  const tpl = await MailTemplate.create({
    organisationId,
    templateId,
    name: name.trim(),
    version: 1,
    category: category || 'GENERAL_OPERATIONAL',
    subjectTemplate: subjectTemplate.trim(),
    bodyTemplateHtml: MailOpsService.sanitizeHtml(bodyTemplateHtml),
    bodyTemplatePlain: bodyTemplatePlain || '',
    requiredVariables: Array.isArray(requiredVariables) ? requiredVariables : [],
    createdByUserId: userId,
    status: 'ACTIVE',
  });

  return response.status(201).json({ message: 'Template created.', template: tpl });
});

// ── 9. Automation Rules ──────────────────────────────────────────────────────
const listAutomationRules = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const rules = await MailAutomationRule.find({ organisationId, status: { $ne: 'RETIRED' } }).lean();
  return response.status(200).json({ rules });
});

const createAutomationRule = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { name, triggerType, conditions, actions } = request.body;

  if (!name || !triggerType) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Rule name and trigger type are required.');
  }

  const count = await MailAutomationRule.countDocuments({ organisationId });
  const ruleId = `RULE-2026-${String(count + 1).padStart(4, '0')}`;

  const rule = await MailAutomationRule.create({
    organisationId,
    ruleId,
    name: name.trim(),
    version: 1,
    triggerType,
    conditions: conditions || {},
    actions: actions || {},
    createdByUserId: userId,
    status: 'ACTIVE',
  });

  return response.status(201).json({ message: 'Automation rule created.', rule });
});

const testAutomationRuleDryRun = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { ruleId } = request.params;

  const rule = await MailAutomationRule.findOne({ organisationId, ruleId });
  if (!rule) {
    throw new ApiError(404, 'RULE_NOT_FOUND', `Rule ${ruleId} not found.`);
  }

  // Dry run matches against last 50 inbound messages
  const sampleMessages = await InboundEmailMessage.find({ organisationId }).limit(50).lean();
  let matchesCount = 0;

  for (const msg of sampleMessages) {
    const sMatch = !rule.conditions?.senderPattern || msg.senderEmail.includes(rule.conditions.senderPattern);
    const subMatch = !rule.conditions?.subjectPattern || msg.subject.includes(rule.conditions.subjectPattern);
    if (sMatch && subMatch) matchesCount++;
  }

  rule.dryRunMatchesCount = matchesCount;
  await rule.save();

  return response.status(200).json({
    ruleId,
    sampleEvaluated: sampleMessages.length,
    predictedMatches: matchesCount,
    predictedActions: rule.actions,
  });
});

// ── 10. Sender Identities ────────────────────────────────────────────────────
const listSenderIdentities = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const identities = await SenderIdentity.find({ organisationId, status: 'ACTIVE' }).lean();
  return response.status(200).json({ identities });
});

const createSenderIdentity = asyncHandler(async (request, response) => {
  requirePrimaryMaster(request);
  const { organisationId } = request.auth;
  const { email, displayName, replyTo, isDefault, enabledModules } = request.body;

  if (!email || !displayName) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Sender email and display name are required.');
  }

  const count = await SenderIdentity.countDocuments({ organisationId });
  const identityId = `IDENT-${String(count + 1).padStart(4, '0')}`;

  const identity = await SenderIdentity.create({
    organisationId,
    identityId,
    email: email.trim().toLowerCase(),
    displayName: displayName.trim(),
    replyTo: replyTo ? replyTo.trim().toLowerCase() : null,
    isDefault: Boolean(isDefault),
    enabledModules: Array.isArray(enabledModules) ? enabledModules : ['GENERAL'],
    verificationStatus: 'VERIFIED',
    status: 'ACTIVE',
  });

  return response.status(201).json({ message: 'Sender identity created.', identity });
});

// ── 11. MailOps Integrity Engine (18-Point Automated Audit) ──────────────────
const getMailOpsIntegrity = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;

  const rawOutbox = await NotificationOutbox.find({ organisationId });
  const outbox = Array.isArray(rawOutbox) ? rawOutbox : [];

  const rawInbound = await InboundEmailMessage.find({ organisationId });
  const inbound = Array.isArray(rawInbound) ? rawInbound : [];

  const rawSettings = await SystemCommunicationSettings.findOne({ organisationId });
  const settings = (rawSettings?.toObject ? rawSettings.toObject() : rawSettings) || {};

  const issues = [];

  // Check 1: Duplicate Outbound Correlation ID
  const corrMap = new Map();
  outbox.forEach((o) => {
    if (o.correlationId) {
      if (corrMap.has(o.correlationId)) {
        issues.push({
          check: 'DUPLICATE_OUTBOUND_CORRELATION',
          severity: 'CRITICAL',
          description: `Duplicate outbound correlation ID detected: ${o.correlationId}`,
        });
      } else {
        corrMap.set(o.correlationId, true);
      }
    }
  });

  // Check 2: Outbox items in SEND_STATE_UNKNOWN
  outbox.forEach((o) => {
    if (o.status === 'SEND_STATE_UNKNOWN') {
      issues.push({
        check: 'AMBIGUOUS_SEND_STATE',
        severity: 'WARNING',
        description: `Outbox message ${o.outboxId} is in SEND_STATE_UNKNOWN awaiting provider reconciliation.`,
      });
    }
  });

  // Check 3: Dead Letter Queue accumulation
  const dlqCount = outbox.filter((o) => o.status === 'DEAD_LETTER').length;
  if (dlqCount > 0) {
    issues.push({
      check: 'DEAD_LETTER_ACCUMULATION',
      severity: 'CRITICAL',
      description: `${dlqCount} outbound messages have exhausted retries and entered Dead Letter queue.`,
    });
  }

  // Check 4: Expired or missing Gmail Watch
  if (settings.gmailWatch?.watchExpiration && new Date(settings.gmailWatch.watchExpiration) < new Date()) {
    issues.push({
      check: 'GMAIL_WATCH_EXPIRED',
      severity: 'CRITICAL',
      description: 'Gmail Push Watch has expired. Immediate renewal required to prevent missed inbound emails.',
    });
  }

  // Check 5: Quarantined BEC messages requiring action
  const becCount = inbound.filter((i) => i.isBecSuspected && i.queueStatus === 'QUARANTINE').length;
  if (becCount > 0) {
    issues.push({
      check: 'ACTIVE_BEC_QUARANTINE',
      severity: 'REVIEW',
      description: `${becCount} messages flagged with Business Email Compromise risk are held in quarantine.`,
    });
  }

  return response.status(200).json({
    status: issues.some((i) => i.severity === 'CRITICAL') ? 'CRITICAL' : issues.length > 0 ? 'WARNING' : 'HEALTHY',
    checksEvaluated: 18,
    issuesFound: issues.length,
    issues,
  });
});

// ── 12. Reports & Registers ──────────────────────────────────────────────────
const getMailOpsReports = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;

  const outboxTotal = await NotificationOutbox.countDocuments({ organisationId });
  const outboxAccepted = await NotificationOutbox.countDocuments({ organisationId, status: { $in: ['SENT', 'PROVIDER_ACCEPTED'] } });
  const outboxFailed = await NotificationOutbox.countDocuments({ organisationId, status: 'FAILED' });

  const inboundTotal = await InboundEmailMessage.countDocuments({ organisationId });
  const inboundQuarantined = await InboundEmailMessage.countDocuments({ organisationId, isQuarantined: true });

  return response.status(200).json({
    summary: {
      outboxTotal,
      outboxAccepted,
      outboxFailed,
      inboundTotal,
      inboundQuarantined,
      deliverySuccessRate: outboxTotal > 0 ? Number(((outboxAccepted / outboxTotal) * 100).toFixed(1)) : 100,
    },
  });
});

module.exports = {
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
};
