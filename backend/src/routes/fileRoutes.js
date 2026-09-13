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
      isDeleted: false,
    }).select('+fileBuffer');

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

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

module.exports = router;
