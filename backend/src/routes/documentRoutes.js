'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { BusinessDocument } = require('../models/BusinessDocument');
const { DocumentAttachmentService } = require('../services/documentAttachmentService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const router = express.Router();
router.use(authenticate);

// ── GET /api/v1/documents (Document Hub - Search & Filter) ───────────────────
router.get(
  '/',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const filter = { organisationId: orgId, isDeleted: false };

    if (req.auth.role === 'CAFE_ADMIN' && req.auth.primaryCafeId) {
      filter.cafeId = req.auth.primaryCafeId;
    } else if (req.query.cafeId && req.query.cafeId !== 'ALL') {
      filter.cafeId = req.query.cafeId.trim().toUpperCase();
    }

    if (req.query.module) {
      filter.relatedModule = req.query.module.trim().toUpperCase();
    }

    if (req.query.recordId) {
      filter.relatedRecordId = req.query.recordId.trim().toUpperCase();
    }

    if (req.query.type) {
      filter.documentType = req.query.type.trim();
    }

    if (req.query.status) {
      filter.status = req.query.status.trim().toUpperCase();
    }

    if (req.query.search) {
      const q = req.query.search.trim();
      filter.$or = [
        { documentId: { $regex: q, $options: 'i' } },
        { originalFilename: { $regex: q, $options: 'i' } },
        { documentNumber: { $regex: q, $options: 'i' } },
        { entityName: { $regex: q, $options: 'i' } },
        { relatedRecordId: { $regex: q, $options: 'i' } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      BusinessDocument.find(filter)
        .select('-fileData -versions.fileData') // Exclude raw base64 from list queries for high performance
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BusinessDocument.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        documents,
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

// ── GET /api/v1/documents/:documentId (Detail & Secure Preview) ──────────────
router.get(
  '/:documentId',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const docId = req.params.documentId.trim().toUpperCase();

    const doc = await BusinessDocument.findOne({
      documentId: docId,
      organisationId: orgId,
      isDeleted: false,
    }).lean();

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    // Tenant / Café isolation check
    if (req.auth.role === 'CAFE_ADMIN' && doc.cafeId && doc.cafeId !== req.auth.primaryCafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'You are not authorized to view documents outside your assigned café.');
    }

    return res.status(200).json({
      success: true,
      data: doc,
    });
  })
);

// ── POST /api/v1/documents/attach ───────────────────────────────────────────
router.post(
  '/attach',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const doc = await DocumentAttachmentService.attachDocument({
      ...req.body,
      organisationId: req.auth.organisationId,
      auth: req.auth,
    });

    return res.status(201).json({
      success: true,
      message: 'Document attached successfully.',
      data: doc,
    });
  })
);

// ── POST /api/v1/documents/:documentId/replace-version ──────────────────────
router.post(
  '/:documentId/replace-version',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const doc = await DocumentAttachmentService.replaceVersion({
      documentId: req.params.documentId,
      organisationId: req.auth.organisationId,
      ...req.body,
      auth: req.auth,
    });

    return res.status(200).json({
      success: true,
      message: 'Document version replaced successfully.',
      data: doc,
    });
  })
);

// ── POST /api/v1/documents/:documentId/verify ───────────────────────────────
router.post(
  '/:documentId/verify',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { decision, reason } = req.body || {};
    const doc = await DocumentAttachmentService.verifyDocument({
      documentId: req.params.documentId,
      organisationId: req.auth.organisationId,
      decision,
      reason,
      auth: req.auth,
    });

    return res.status(200).json({
      success: true,
      message: `Document status updated to ${doc.status}.`,
      data: doc,
    });
  })
);

// ── DELETE /api/v1/documents/:documentId ────────────────────────────────────
router.delete(
  '/:documentId',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const result = await DocumentAttachmentService.deleteDocument({
      documentId: req.params.documentId,
      organisationId: req.auth.organisationId,
      reason,
      auth: req.auth,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  })
);

module.exports = router;
