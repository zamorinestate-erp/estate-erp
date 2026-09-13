'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { ExportHistory } = require('../models/ExportHistory');
const { ZurfService } = require('../services/zurfService');
const auditService = require('../services/auditService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const router = express.Router();
router.use(authenticate);

// ── GET /api/v1/exports/history ─────────────────────────────────────────────
router.get(
  '/history',
  authorize('REPORTS_EXPORT', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const filter = { organisationId: orgId };
    
    if (req.auth.role === 'CAFE_ADMIN' && req.auth.primaryCafeId) {
      filter.cafeId = req.auth.primaryCafeId;
    } else if (req.query.cafeId && req.query.cafeId !== 'ALL') {
      filter.cafeId = req.query.cafeId.trim().toUpperCase();
    }

    if (req.query.format) {
      filter.format = req.query.format.trim().toUpperCase();
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ExportHistory.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExportHistory.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// ── POST /api/v1/exports/record ────────────────────────────────────────────
router.post(
  '/record',
  authorize('REPORTS_EXPORT', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const {
      exportId,
      documentType = 'REPORT',
      reportTitle,
      relatedRecordId = null,
      format,
      filename,
      destinationType = 'BROWSER_DOWNLOAD',
      templateVersion = 'Zamorin Universal Report Template v1.0',
      recordCount = 0,
      filterCriteria = {},
      metadata = {},
      checksum = null,
    } = req.body || {};

    if (!exportId || !reportTitle || !format || !filename) {
      throw new ApiError(400, 'EXPORT_FIELDS_REQUIRED', 'exportId, reportTitle, format, and filename are required.');
    }

    const fmt = format.trim().toUpperCase();
    if (fmt !== 'PDF' && fmt !== 'XLSX') {
      throw new ApiError(400, 'INVALID_EXPORT_FORMAT', 'Only PDF and XLSX formats are supported.');
    }

    const orgId = req.auth.organisationId;
    const cafeId = req.body.cafeId || req.auth.primaryCafeId || null;

    const historyDoc = await ExportHistory.create({
      exportId,
      documentType,
      reportTitle,
      relatedRecordId,
      format: fmt,
      organisationId: orgId,
      cafeId,
      generatedBy: req.auth.name || req.auth.userId || 'Operator',
      actorRole: req.auth.role,
      filename,
      destinationType,
      status: 'GENERATED',
      templateVersion,
      checksum,
      recordCount,
      filterCriteria,
      metadata,
    });

    await auditService.recordAuditEvent({
      organisationId: orgId,
      cafeId: cafeId || 'GLOBAL',
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      module: 'UNIVERSAL_EXPORT',
      action: 'EXPORT_RECORDED',
      entityType: 'EXPORT_HISTORY',
      entityId: exportId,
      reason: `User generated ${fmt} export: ${filename}`,
      result: 'SUCCESS',
      metadata: {
        exportId,
        format: fmt,
        filename,
        recordCount,
        templateVersion,
      },
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Export history recorded successfully.',
      data: historyDoc,
    });
  })
);

module.exports = router;
