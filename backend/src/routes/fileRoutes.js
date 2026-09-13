'use strict';

/**
 * FILE & DOCUMENT ROUTES
 * Mounted at: /api/v1/files (registered in routes/index.js)
 * Provides both legacy private file metadata and universal business document hub capabilities.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { getFileMetadata, registerFileRecord } = require('../controllers/fileController');
const { BusinessDocument } = require('../models/BusinessDocument');
const { DocumentAttachmentService } = require('../services/documentAttachmentService');
const { documentStorageAdapter } = require('../services/documentStorageAdapter');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// Protected temporary directory for disk-backed staging (outside web root)
const UPLOAD_STAGING_DIR = path.join(os.tmpdir(), 'zamorin_document_staging');

// Resource-safe disk storage engine: streams incoming multipart payloads directly to temporary disk
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(UPLOAD_STAGING_DIR, { recursive: true });
      cb(null, UPLOAD_STAGING_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Generate safe, unguessable internal temporary filename with .tmp (no executable extension)
    const uniqueSuffix = `stg-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.tmp`;
    cb(null, uniqueSuffix);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB strict limit
    files: 1,
  },
});

const router = express.Router();

router.use(authenticate);

// ── Legacy Private File endpoints ───────────────────────────────────────────
router.get('/:fileId', getFileMetadata);
router.post('/register', registerFileRecord);

// ── Universal Business Document Hub endpoints ───────────────────────────────
router.get(
  '/documents/hub',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const filter = { organisationId: orgId, isDeleted: false };

    // Cross-Café Parameter Manipulation Protection
    if (req.auth.role === 'CAFE_ADMIN') {
      if (req.query.cafeId && req.query.cafeId !== 'ALL' && req.query.cafeId !== req.auth.primaryCafeId) {
        throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Cannot query documents outside assigned café.');
      }
      filter.cafeId = req.auth.primaryCafeId;
    } else if (req.query.cafeId && req.query.cafeId !== 'ALL') {
      filter.cafeId = req.query.cafeId.trim().toUpperCase();
    }

    // Unauthorized Sensitive-Document Filtering Protection
    if (req.auth.role === 'STAFF') {
      filter.classification = { $nin: ['MANAGEMENT_CONFIDENTIAL', 'HR_CONFIDENTIAL', 'SUPPLIER_BANKING', 'FINANCE'] };
    } else if (req.auth.role === 'CAFE_ADMIN') {
      filter.classification = { $ne: 'MANAGEMENT_CONFIDENTIAL' };
    }

    if (req.query.documentId) {
      filter.documentId = req.query.documentId.trim().toUpperCase();
    }

    if (req.query.module) {
      filter.relatedModule = req.query.module.trim().toUpperCase();
    }

    if (req.query.recordId || req.query.relatedRecordId) {
      filter.relatedRecordId = (req.query.recordId || req.query.relatedRecordId).trim().toUpperCase();
    }

    if (req.query.relatedRecordType) {
      filter.relatedRecordType = req.query.relatedRecordType.trim().toUpperCase();
    }

    if (req.query.type || req.query.documentType) {
      filter.documentType = (req.query.type || req.query.documentType).trim();
    }

    if (req.query.employeeId || req.query.employee) {
      filter.employeeId = (req.query.employeeId || req.query.employee).trim().toUpperCase();
    }

    if (req.query.documentNumber || req.query.invoiceNumber) {
      filter.documentNumber = (req.query.documentNumber || req.query.invoiceNumber).trim();
    }

    if (req.query.supplier || req.query.entityName) {
      const sup = (req.query.supplier || req.query.entityName).trim();
      filter.$or = [
        { entityName: { $regex: sup, $options: 'i' } },
        { supplierOrEntity: { $regex: sup, $options: 'i' } },
      ];
    }

    if (req.query.status) {
      filter.status = req.query.status.trim().toUpperCase();
    }

    if (req.query.verificationStatus) {
      filter.status = req.query.verificationStatus.trim().toUpperCase();
    }

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    if (req.query.expiryStatus) {
      const now = new Date();
      if (req.query.expiryStatus === 'OVERDUE') {
        filter.expiryDate = { $lt: now, $ne: null };
      } else if (req.query.expiryStatus === 'EXPIRING_SOON') {
        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        filter.expiryDate = { $gte: now, $lte: in30Days };
      }
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
        .select('-fileData -versions.fileData')
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

router.get(
  '/documents/:documentId',
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

    if (req.auth.role === 'CAFE_ADMIN' && doc.cafeId && doc.cafeId !== req.auth.primaryCafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Unauthorized cross-café document access.');
    }

    return res.status(200).json({
      success: true,
      data: doc,
    });
  })
);

router.post(
  '/documents/attach',
  upload.single('file'),
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const file = req.file;
    const body = req.body || {};
    try {
      const doc = await DocumentAttachmentService.attachDocument({
        ...body,
        originalFilename: file ? file.originalname : body.originalFilename,
        mimeType: file ? file.mimetype : body.mimeType,
        sizeBytes: file ? file.size : body.sizeBytes,
        tempFilePath: file ? file.path : null,
        fileBuffer: null,
        fileBase64: body.fileBase64 || null,
        organisationId: req.auth.organisationId,
        auth: req.auth,
      });

      return res.status(201).json({
        success: true,
        message: 'Document attached successfully.',
        data: doc,
      });
    } catch (err) {
      if (file && file.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      throw err;
    }
  })
);

router.post(
  '/documents/:documentId/replace-version',
  upload.single('file'),
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const file = req.file;
    const body = req.body || {};
    try {
      const doc = await DocumentAttachmentService.replaceVersion({
        documentId: req.params.documentId,
        organisationId: req.auth.organisationId,
        originalFilename: file ? file.originalname : body.originalFilename,
        mimeType: file ? file.mimetype : body.mimeType,
        sizeBytes: file ? file.size : body.sizeBytes,
        tempFilePath: file ? file.path : null,
        fileBuffer: null,
        fileBase64: body.fileBase64 || null,
        changeReason: body.changeReason,
        auth: req.auth,
      });

      return res.status(200).json({
        success: true,
        message: 'Document version replaced successfully.',
        data: doc,
      });
    } catch (err) {
      if (file && file.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      throw err;
    }
  })
);

router.get(
  '/documents/:documentId/download',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const docId = req.params.documentId.trim().toUpperCase();

    const doc = await BusinessDocument.findOne({
      documentId: docId,
      organisationId: orgId,
    }).select('+fileBuffer');

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    DocumentAttachmentService.assertDocumentAuthorization(doc, req.auth, 'DOWNLOAD');

    if (req.auth.role === 'CAFE_ADMIN' && doc.cafeId && doc.cafeId !== req.auth.primaryCafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Unauthorized cross-café document access.');
    }

    // Security Scanning Gates
    if (doc.securityScanStatus === 'REJECTED') {
      throw new ApiError(403, 'MALWARE_DETECTED', 'Document access blocked: file was rejected by security scanner.');
    }
    if (doc.securityScanStatus === 'PENDING_SCAN') {
      throw new ApiError(423, 'SCAN_IN_PROGRESS', 'Document is undergoing security scanning and is not yet available.');
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFilename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 1. If stored via durable documentStorageAdapter: stream directly to client without buffering
    if (doc.storageKey) {
      try {
        const stream = await documentStorageAdapter.getStream({ storageKey: doc.storageKey });
        res.setHeader('Content-Length', doc.sizeBytes);
        return stream.pipe(res);
      } catch (storageErr) {
        // Graceful fallback to doc.storagePath if on local disk
        if (doc.storagePath && fs.existsSync(doc.storagePath)) {
          const stat = await fs.promises.stat(doc.storagePath);
          res.setHeader('Content-Length', stat.size);
          const stream = fs.createReadStream(doc.storagePath);
          return stream.pipe(res);
        }
        throw storageErr;
      }
    } else if (doc.storagePath && fs.existsSync(doc.storagePath)) {
      const stat = await fs.promises.stat(doc.storagePath);
      res.setHeader('Content-Length', stat.size);
      const stream = fs.createReadStream(doc.storagePath);
      return stream.pipe(res);
    }

    // 2. Fallback for database-stored buffers / base64 (legacy records)
    const payload = doc.fileBuffer || (doc.fileData ? Buffer.from(doc.fileData, 'base64') : null);
    if (!payload) {
      throw new ApiError(404, 'FILE_CONTENT_UNAVAILABLE', 'File content is not available.');
    }

    res.setHeader('Content-Length', payload.length);
    return res.send(payload);
  })
);

router.post(
  '/documents/:documentId/verify',
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

router.delete(
  '/documents/:documentId',
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

router.delete(
  '/documents/:documentId/permanent',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER'] }),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const result = await DocumentAttachmentService.permanentDeleteDocument({
      documentId: req.params.documentId,
      organisationId: req.auth.organisationId,
      reason,
      auth: req.auth,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  })
);

router.post(
  '/documents/:documentId/retention-policy',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER'] }),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const doc = await DocumentAttachmentService.updateRetentionPolicy({
      documentId: req.params.documentId,
      organisationId: req.auth.organisationId,
      newRetentionUntil: body.newRetentionUntil,
      legalHold: body.legalHold,
      legalHoldReason: body.legalHoldReason,
      reason: body.reason,
      auth: req.auth,
    });

    return res.status(200).json({
      success: true,
      message: 'Retention policy successfully updated.',
      data: doc,
    });
  })
);

router.get(
  '/documents/:documentId/preview',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const docId = req.params.documentId.trim().toUpperCase();

    const doc = await BusinessDocument.findOne({
      documentId: docId,
      organisationId: orgId,
    }).select('+fileBuffer');

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    DocumentAttachmentService.assertDocumentAuthorization(doc, req.auth, 'PREVIEW');

    if (req.auth.role === 'CAFE_ADMIN' && doc.cafeId && doc.cafeId !== req.auth.primaryCafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Unauthorized cross-café document access.');
    }

    if (doc.securityScanStatus === 'REJECTED') {
      throw new ApiError(403, 'MALWARE_DETECTED', 'Document preview blocked: file was rejected by security scanner.');
    }
    if (doc.securityScanStatus === 'PENDING_SCAN') {
      throw new ApiError(423, 'SCAN_IN_PROGRESS', 'Document is undergoing security scanning and is not yet available.');
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFilename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (doc.storageKey) {
      try {
        const stream = await documentStorageAdapter.getStream({ storageKey: doc.storageKey });
        res.setHeader('Content-Length', doc.sizeBytes);
        return stream.pipe(res);
      } catch (storageErr) {
        if (doc.storagePath && fs.existsSync(doc.storagePath)) {
          const stat = await fs.promises.stat(doc.storagePath);
          res.setHeader('Content-Length', stat.size);
          const stream = fs.createReadStream(doc.storagePath);
          return stream.pipe(res);
        }
        throw storageErr;
      }
    } else if (doc.storagePath && fs.existsSync(doc.storagePath)) {
      const stat = await fs.promises.stat(doc.storagePath);
      res.setHeader('Content-Length', stat.size);
      const stream = fs.createReadStream(doc.storagePath);
      return stream.pipe(res);
    }

    const payload = doc.fileBuffer || (doc.fileData ? Buffer.from(doc.fileData, 'base64') : null);
    if (!payload) {
      throw new ApiError(404, 'FILE_CONTENT_UNAVAILABLE', 'File content is not available.');
    }

    res.setHeader('Content-Length', payload.length);
    return res.send(payload);
  })
);

router.get(
  '/documents/:documentId/versions/:versionNumber/download',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.organisationId;
    const docId = req.params.documentId.trim().toUpperCase();
    const verNum = parseInt(req.params.versionNumber, 10);

    const doc = await BusinessDocument.findOne({
      documentId: docId,
      organisationId: orgId,
    }).lean();

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    if (req.auth.role === 'CAFE_ADMIN' && doc.cafeId && doc.cafeId !== req.auth.primaryCafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Unauthorized cross-café document access.');
    }

    let targetVer;
    if (doc.version === verNum) {
      targetVer = doc;
    } else {
      targetVer = (doc.versions || []).find((v) => v.versionNumber === verNum);
    }

    if (!targetVer) {
      throw new ApiError(404, 'VERSION_NOT_FOUND', `Version ${verNum} of document not found.`);
    }

    res.setHeader('Content-Type', targetVer.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetVer.originalFilename || doc.originalFilename)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (targetVer.storageKey) {
      const stream = await documentStorageAdapter.getStream({ storageKey: targetVer.storageKey });
      if (targetVer.sizeBytes) res.setHeader('Content-Length', targetVer.sizeBytes);
      return stream.pipe(res);
    }

    const payload = targetVer.fileBuffer || (targetVer.fileData ? Buffer.from(targetVer.fileData, 'base64') : null);
    if (!payload) {
      throw new ApiError(404, 'FILE_CONTENT_UNAVAILABLE', 'Version content is not available.');
    }

    res.setHeader('Content-Length', payload.length);
    return res.send(payload);
  })
);

router.post(
  '/documents/:documentId/restore',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory restoration reason must be provided.');
    }

    const doc = await BusinessDocument.findOne({
      documentId: req.params.documentId.trim().toUpperCase(),
      organisationId: req.auth.organisationId,
      isDeleted: true,
    });

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Deleted business document not found.');
    }

    doc.isDeleted = false;
    doc.deletedAt = null;
    doc.deletedBy = null;
    doc.deletionReason = null;
    doc.restoredAt = new Date();
    doc.restoredBy = req.auth.userId;
    doc.restorationReason = reason.trim();
    await doc.save();

    return res.status(200).json({
      success: true,
      message: 'Document successfully restored.',
      data: doc,
    });
  })
);

module.exports = router;

