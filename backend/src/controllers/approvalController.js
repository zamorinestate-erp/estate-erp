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

  if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
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

/**
 * Entity types whose approval decisions are absolutely restricted to MASTER.
 * These workflows have their own canonical controllers (expenseController,
 * attendanceController, etc.) that enforce MASTER-only decisions.
 * Allowing OWNER or CAFE_ADMIN to decide a generic Approval record tagged
 * with these types would create an audit-trail pollution risk.
 */
const PROTECTED_ENTITY_TYPES = new Set([
  'EXPENSE',
  'OVERTIME',
  'OVERTIME_DECISION',
  'PAYROLL',
  'PAYROLL_RUN',
  'PERSONAL_LEDGER',
  'USER_ADMINISTRATION',
]);

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

  if (request.auth.role === 'CAFE_ADMIN' && (!approval.cafeId || !request.auth.assignedCafeIds.includes(approval.cafeId))) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to decide this approval.'
    );
  }

  // Security: block non-MASTER roles from deciding approvals that belong to
  // MASTER-only protected workflows. These must be decided through their
  // canonical controller endpoints, not the generic approval route.
  if (
    PROTECTED_ENTITY_TYPES.has(approval.entityType) &&
    request.auth.role !== 'MASTER'
  ) {
    throw new ApiError(
      403,
      'PROTECTED_ENTITY_TYPE',
      `Approvals of type ${approval.entityType} must be decided through the ` +
      `canonical workflow endpoint by MASTER only. Use the appropriate module route.`
    );
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
