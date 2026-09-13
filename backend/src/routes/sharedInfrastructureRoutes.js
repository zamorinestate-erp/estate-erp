'use strict';

/**
 * SHARED INFRASTRUCTURE ROUTES
 * Mounted at: /api/v1/shared-infra
 * Exposes endpoints for:
 *   - Universal Duplicate Detection check (/duplicate-detection/check)
 *   - Universal Expiry & Renewal scan & items (/expiry/scan, /expiry/items, /expiry/:itemId/renew)
 *   - Approval Inbox aggregation (/approvals/inbox)
 *   - Mandatory Reason validation & assertion (/mandatory-reason/assert)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { DuplicateDetectionService } = require('../services/duplicateDetectionService');
const { ExpiryRenewalService } = require('../services/expiryRenewalService');
const { MandatoryReasonService } = require('../services/mandatoryReasonService');
const { Approval } = require('../models/Approval');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { LeaveRequest } = require('../models/LeaveRequest');
const { Expense } = require('../models/Expense');
const { ApprovalPolicyService } = require('../services/approvalPolicyService');

const router = express.Router();

router.use(authenticate);

// ── 1. DUPLICATE DETECTION ───────────────────────────────────────────────────
router.post(
  '/duplicate-detection/check',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const { entityType, candidateData, excludeId } = req.body || {};
    if (!entityType) {
      throw new ApiError(400, 'ENTITY_TYPE_REQUIRED', 'entityType is required for duplicate check.');
    }

    const result = await DuplicateDetectionService.checkDuplicates({
      entityType,
      candidateData: candidateData || {},
      organisationId: req.auth.organisationId,
      excludeId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

// ── 2. EXPIRY & RENEWAL ENGINE ───────────────────────────────────────────────
router.get(
  '/expiry/scan',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const cafeId = req.auth.role === 'CAFE_ADMIN' ? req.auth.primaryCafeId : req.query.cafeId;
    const report = await ExpiryRenewalService.scanAllExpiries({
      organisationId: req.auth.organisationId,
      cafeId,
    });

    return res.status(200).json({
      success: true,
      data: report,
    });
  })
);

router.get(
  '/expiry/items',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const { domain, bucket } = req.query;
    const cafeId = req.auth.role === 'CAFE_ADMIN' ? req.auth.primaryCafeId : req.query.cafeId;
    const items = await ExpiryRenewalService.listExpiringItems({
      organisationId: req.auth.organisationId,
      domain,
      bucket,
      cafeId,
    });

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  })
);

router.post(
  '/expiry/:itemId/renew',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { domain, newExpiryDate, renewalDocNumber, reason } = req.body || {};
    if (!reason || !reason.trim()) {
      throw new ApiError(400, 'REASON_REQUIRED', 'A mandatory reason is required to record renewal.');
    }

    const updated = await ExpiryRenewalService.recordRenewal({
      itemId: req.params.itemId,
      domain,
      newExpiryDate,
      renewalDocNumber,
      auth: req.auth,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: 'Item renewal recorded successfully.',
      data: updated,
    });
  })
);

// ── 3. APPROVAL INBOX AGGREGATION ────────────────────────────────────────────
router.get(
  '/approvals/inbox',
  authorize('APPROVALS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const role = req.auth.role;
    const filter = { organisationId: orgId, status: 'PENDING' };

    if (role === 'CAFE_ADMIN') {
      filter.cafeId = req.auth.primaryCafeId || { $in: req.auth.assignedCafeIds || [] };
    } else if (role === 'OWNER') {
      if (req.auth.assignedCafeIds?.length > 0) {
        filter.cafeId = { $in: req.auth.assignedCafeIds };
      }
    }

    const [approvals, poPending, leavePending] = await Promise.all([
      Approval.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
      PurchaseOrder.find({ organisationId: orgId, status: 'PENDING_APPROVAL' }).sort({ createdAt: -1 }).limit(20).lean(),
      LeaveRequest.find({ organisationId: orgId, status: 'PENDING' }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const aggregated = [
      ...approvals.map((a) => ({
        id: a.approvalId,
        entityType: a.entityType,
        entityId: a.entityId,
        title: a.title || `${a.entityType} Approval Request`,
        subtitle: `${a.cafeId || 'All Cafés'} · Req by ${a.requestedByUserId || 'User'}`,
        deepLink: a.deepLink || `#approvals?id=${a.approvalId}`,
        createdAt: a.createdAt,
        type: 'GENERIC_APPROVAL',
      })),
      ...poPending.map((p) => ({
        id: p.poId,
        entityType: 'PURCHASE_ORDER',
        entityId: p.poId,
        title: `PO: ${p.poNumber || p.poId} · ₹${p.totalAmount || 0}`,
        subtitle: `${p.vendorName || 'Vendor'} · ${p.cafeId || 'Central'}`,
        deepLink: `#purchases?poId=${p.poId}`,
        createdAt: p.createdAt,
        type: 'PURCHASE_ORDER',
      })),
      ...leavePending.map((l) => ({
        id: l.leaveId,
        entityType: 'LEAVE',
        entityId: l.leaveId,
        title: `Leave: ${l.userId} (${l.leaveType})`,
        subtitle: `${l.startDate} to ${l.endDate} (${l.daysRequested} days)`,
        deepLink: `#staff-leave?requestId=${l.leaveId}`,
        createdAt: l.createdAt,
        type: 'LEAVE_REQUEST',
      })),
    ];

    aggregated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      totalPending: aggregated.length,
      data: aggregated,
    });
  })
);

// ── 4. MANDATORY REASON ENGINE CHECK ──────────────────────────────────────────
router.post(
  '/mandatory-reason/assert',
  asyncHandler(async (req, res) => {
    const { reason, actionType } = req.body || {};
    MandatoryReasonService.assertMandatoryReason(reason, actionType);

    return res.status(200).json({
      success: true,
      message: 'Reason validated successfully.',
    });
  })
);

// ── 5. APPROVAL DECISION ENGINE ──────────────────────────────────────────────
router.post(
  '/approvals/:approvalId/decide',
  authorize('APPROVALS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const { action, reason = '', notes = '' } = req.body || {};
    const approvalId = String(req.params.approvalId || '').trim().toUpperCase();
    const cleanAction = String(action || '').trim().toUpperCase();

    if (!['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(cleanAction)) {
      throw new ApiError(400, 'INVALID_DECISION', 'Action must be APPROVE, REJECT, or REQUEST_CHANGES.');
    }

    if (cleanAction !== 'APPROVE' && (!reason || reason.trim().length < 5)) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory reason (min 5 chars) is required when rejecting or requesting changes.');
    }

    const approval = await Approval.findOne({
      approvalId,
      organisationId: req.auth.organisationId,
    });

    if (!approval) {
      throw new ApiError(404, 'APPROVAL_NOT_FOUND', `Approval request ${approvalId} not found.`);
    }

    // Café Scope & Authority Verification
    if (req.auth.role === 'CAFE_ADMIN') {
      if (approval.cafeId && approval.cafeId !== req.auth.primaryCafeId) {
        throw new ApiError(403, 'CROSS_CAFE_APPROVAL_DENIED', 'Cannot decide approvals outside your assigned café.');
      }
    }

    // Configurable Authority Policy Limit
    if (approval.amountPaisa) {
      await ApprovalPolicyService.assertAuthorizedAmount({
        organisationId: approval.organisationId || req.auth.organisationId,
        cafeId: approval.cafeId,
        workflowType: approval.entityType || 'GENERAL',
        role: req.auth.role,
        amountPaisa: approval.amountPaisa,
      });
    }

    const beforeStatus = approval.status;
    approval.status = cleanAction === 'APPROVE' ? 'APPROVED' : (cleanAction === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED');
    approval.decidedByUserId = req.auth.userId;
    approval.decidedAt = new Date();
    approval.decisionReason = reason || notes;
    await approval.save();

    return res.status(200).json({
      success: true,
      message: `Approval request ${approvalId} transitioned from ${beforeStatus} to ${approval.status}.`,
      data: approval,
    });
  })
);

// ── 6. ACTIVITY TIMELINE ─────────────────────────────────────────────────────
router.get(
  '/timeline/:recordType/:recordId',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const { ActivityTimelineService } = require('../services/activityTimelineService');
    const cafeId = req.auth.role === 'CAFE_ADMIN' ? req.auth.primaryCafeId : null;
    const result = await ActivityTimelineService.getRecordTimeline({
      organisationId: req.auth.organisationId,
      entityType: req.params.recordType,
      entityId: req.params.recordId,
      cafeId,
    });

    return res.status(200).json(result);
  })
);

// ── 7. PROCUREMENT DOCUMENT CHAIN ────────────────────────────────────────────
router.get(
  '/procurement/po/:poId/chain',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const { ProcurementDocumentChainService } = require('../services/procurementDocumentChainService');
    const cafeId = req.auth.role === 'CAFE_ADMIN' ? req.auth.primaryCafeId : null;
    const result = await ProcurementDocumentChainService.getDocumentChain({
      purchaseOrderId: req.params.poId,
      organisationId: req.auth.organisationId,
      cafeId,
    });

    return res.status(200).json(result);
  })
);

module.exports = router;
