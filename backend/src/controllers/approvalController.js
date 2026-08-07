'use strict';

/**
 * APPROVAL CONTROLLER
 */

const {
  Approval,
  APPROVAL_STATUSES,
} = require('../models/Approval');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

const listApprovals = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { status } = request.query;

  if (status && APPROVAL_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  const [approvals, total] = await Promise.all([
    Approval.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Approval.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      approvals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const decideApproval = asyncHandler(async (request, response) => {
  const approvalId = normalizeId(request.params.approvalId);
  const { decision, reason } = request.body; // APPROVED or REJECTED

  const targetDecision = normalizeId(decision);
  if (!['APPROVED', 'REJECTED'].includes(targetDecision)) {
    throw new ApiError(400, 'INVALID_DECISION', 'Decision must be APPROVED or REJECTED.');
  }

  const approval = await Approval.findOne({
    approvalId,
    organisationId: request.auth.organisationId,
  });

  if (!approval) {
    throw new ApiError(404, 'NOT_FOUND', 'Approval request not found.');
  }

  if (approval.status !== 'PENDING') {
    throw new ApiError(409, 'ALREADY_DECIDED', `Approval request is already ${approval.status}.`);
  }

  approval.status = targetDecision;
  approval.decidedByUserId = request.auth.userId;
  approval.decisionReason = typeof reason === 'string' ? reason.trim() : '';
  approval.decidedAt = new Date();

  await approval.save();

  await recordRequestAudit({
    request,
    module: 'APPROVALS',
    action: 'DECIDE_APPROVAL',
    entityType: 'APPROVAL',
    entityId: approvalId,
    after: { status: targetDecision, reason: approval.decisionReason },
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { approval: approval.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listApprovals,
  decideApproval,
};
