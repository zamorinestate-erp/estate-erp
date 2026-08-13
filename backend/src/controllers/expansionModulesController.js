'use strict';

/**
 * EXPANSION MODULES CONTROLLER (Capabilities 06, 17, 24, 32)
 *
 * REST Endpoints for Supplier Portal, Recruitment, Workflows, and Sustainability.
 */

const { Candidate } = require('../models/Candidate');
const { WorkflowDefinition } = require('../models/WorkflowDefinition');
const { SustainabilityLog } = require('../models/SustainabilityLog');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { SequenceCounter } = require('../models/SequenceCounter');

const { ApiError } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');
const { recordRequestAudit } = require('../services/auditService');

// ── Capability 06 — Supplier Portal Orders ───────────────────────────────────

const listSupplierPortalOrders = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;
  const { vendorId } = request.query;

  const filter = { organisationId };
  if (vendorId) filter.vendorId = vendorId.trim().toUpperCase();

  const orders = await PurchaseOrder.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return response.status(200).json({
    success: true,
    data: { orders },
    correlationId: request.correlationId,
  });
});

// ── Capability 17 — Recruitment (Candidates) ─────────────────────────────────

const listCandidates = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;

  const candidates = await Candidate.find({ organisationId })
    .sort({ createdAt: -1 })
    .lean();

  return response.status(200).json({
    success: true,
    data: { candidates },
    correlationId: request.correlationId,
  });
});

const createCandidate = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const { fullName, email, phone, appliedRole, targetCafeId, notes } = request.body;

  if (!fullName || !email) {
    throw new ApiError(400, 'REQUIRED_FIELDS_MISSING', 'fullName and email are required.');
  }

  const candidateId = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: 'CANDIDATE',
    prefix: 'CAN',
    minimumDigits: 4,
  });

  const candidate = new Candidate({
    candidateId,
    organisationId,
    fullName: String(fullName).trim(),
    email: String(email).trim().toLowerCase(),
    phone: phone ? String(phone).trim() : '',
    appliedRole: appliedRole ? appliedRole.toUpperCase() : 'STAFF',
    targetCafeId: targetCafeId ? targetCafeId.toUpperCase() : null,
    notes: notes ? String(notes).trim() : '',
    stage: 'APPLIED',
    createdByUserId: userId,
  });

  await candidate.save();

  await recordRequestAudit({
    request,
    module: 'HRMS',
    action: 'CREATE_CANDIDATE',
    entityType: 'CANDIDATE',
    entityId: candidateId,
    after: { candidateId, fullName: candidate.fullName, appliedRole: candidate.appliedRole },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { candidate },
    correlationId: request.correlationId,
  });
});

// ── Capability 24 — Workflow Definitions ──────────────────────────────────────

const listWorkflows = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;

  const workflows = await WorkflowDefinition.find({ organisationId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  return response.status(200).json({
    success: true,
    data: { workflows },
    correlationId: request.correlationId,
  });
});

const createWorkflow = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const { name, triggerEvent, steps } = request.body;

  if (!name || !triggerEvent) {
    throw new ApiError(400, 'REQUIRED_FIELDS_MISSING', 'name and triggerEvent are required.');
  }

  const workflowId = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: 'WORKFLOW',
    prefix: 'WF',
    minimumDigits: 4,
  });

  const workflow = new WorkflowDefinition({
    workflowId,
    organisationId,
    name: String(name).trim(),
    triggerEvent: triggerEvent.toUpperCase(),
    steps: Array.isArray(steps) ? steps : [{ stepNumber: 1, approverRole: 'MASTER', timeoutHours: 48 }],
    isActive: true,
    createdByUserId: userId,
  });

  await workflow.save();

  await recordRequestAudit({
    request,
    module: 'ADMINISTRATION',
    action: 'CREATE_WORKFLOW',
    entityType: 'WORKFLOW_DEFINITION',
    entityId: workflowId,
    after: { workflowId, name: workflow.name, triggerEvent: workflow.triggerEvent },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { workflow },
    correlationId: request.correlationId,
  });
});

// ── Capability 32 — Sustainability Logs ───────────────────────────────────────

const listSustainabilityLogs = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;

  const logs = await SustainabilityLog.find({ organisationId })
    .sort({ metricDate: -1 })
    .limit(100)
    .lean();

  return response.status(200).json({
    success: true,
    data: { logs },
    correlationId: request.correlationId,
  });
});

const recordSustainabilityLog = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const { cafeId, category, metricDate, quantity, unit } = request.body;

  if (!cafeId || !category || !metricDate || quantity === undefined || !unit) {
    throw new ApiError(400, 'REQUIRED_FIELDS_MISSING', 'cafeId, category, metricDate, quantity, and unit are required.');
  }

  const logId = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: 'SUSTAINABILITY',
    prefix: 'SUS',
    minimumDigits: 4,
  });

  const susLog = new SustainabilityLog({
    logId,
    organisationId,
    cafeId: cafeId.toUpperCase(),
    category: category.toUpperCase(),
    metricDate,
    quantity: Number(quantity),
    unit: String(unit).trim(),
    recordedByUserId: userId,
  });

  await susLog.save();

  await recordRequestAudit({
    request,
    module: 'PERFORMANCE',
    action: 'RECORD_SUSTAINABILITY',
    entityType: 'SUSTAINABILITY_LOG',
    entityId: logId,
    after: { logId, category: susLog.category, quantity: susLog.quantity },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { log: susLog },
    correlationId: request.correlationId,
  });
});

module.exports = {
  listSupplierPortalOrders,
  listCandidates,
  createCandidate,
  listWorkflows,
  createWorkflow,
  listSustainabilityLogs,
  recordSustainabilityLog,
};
