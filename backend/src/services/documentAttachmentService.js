'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { BusinessDocument } = require('../models/BusinessDocument');
const { SequenceCounter } = require('../models/SequenceCounter');
const auditService = require('./auditService');
const { SecurityScannerService } = require('./securityScannerService');
const { documentStorageAdapter } = require('./documentStorageAdapter');
const { ApiError } = require('../utils/ApiError');

// Strict extension & MIME validation per OWASP recommendation: PDF, JPG, PNG only
const ALLOWED_MIME_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB hard boundary

class DocumentAttachmentService {
  static getStorageAdapter() {
    return documentStorageAdapter;
  }

  static validateFileMime(mimeType, filename = '') {
    const normMime = String(mimeType || '').trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normMime)) {
      throw new ApiError(400, 'UNSUPPORTED_ATTACHMENT_TYPE', `File type ${normMime} is prohibited. Allowed types: PDF, JPG, PNG.`);
    }
    return true;
  }

  static validateFileSize(sizeBytes) {
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new ApiError(400, 'ATTACHMENT_SIZE_EXCEEDED', `File size exceeds 15MB limit.`);
    }
    return true;
  }

  static validateMagicBytes(buffer, mimeType) {
    if (!buffer || buffer.length < 4) {
      throw new ApiError(400, 'CORRUPTED_FILE', 'File content is empty or corrupted.');
    }
    const norm = String(mimeType || '').toLowerCase();
    if (norm === 'application/pdf') {
      // PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46)
      if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
        throw new ApiError(400, 'INVALID_FILE_SIGNATURE', 'File signature does not match valid PDF specification.');
      }
    } else if (norm === 'image/png') {
      // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
      if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
        throw new ApiError(400, 'INVALID_FILE_SIGNATURE', 'File signature does not match valid PNG specification.');
      }
    } else if (norm === 'image/jpeg' || norm === 'image/jpg') {
      // JPEG magic bytes: 0xFF, 0xD8, 0xFF
      if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
        throw new ApiError(400, 'INVALID_FILE_SIGNATURE', 'File signature does not match valid JPEG specification.');
      }
    }
    return true;
  }

  static async computeStreamChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static computeChecksum(bufferOrBase64) {
    if (!bufferOrBase64) return null;
    return crypto.createHash('sha256').update(bufferOrBase64).digest('hex');
  }

  static assertDocumentAuthorization(doc, auth, action = 'VIEW') {
    if (!auth || !auth.role) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const role = auth.role;
    const isMaster = role === 'MASTER';
    const isOwner = role === 'OWNER';
    const isRegional = role === 'REGIONAL_MANAGER';
    const isCafeAdmin = role === 'CAFE_ADMIN';
    const isStaff = role === 'STAFF';

    // 1. Cross-Organisation Isolation
    if (doc.organisationId && doc.organisationId !== auth.organisationId) {
      throw new ApiError(403, 'CROSS_ORG_ACCESS_DENIED', 'Unauthorized cross-organisation document access.');
    }

    // 2. Cross-Café Isolation (unless Master, Owner, or Regional Manager)
    if (doc.cafeId && doc.cafeId !== 'GLOBAL' && !isMaster && !isOwner && !isRegional) {
      const assigned = (auth.assignedCafeIds && auth.assignedCafeIds.includes(doc.cafeId)) || auth.primaryCafeId === doc.cafeId;
      if (!assigned) {
        throw new ApiError(403, 'CROSS_CAFE_ACCESS_DENIED', 'Unauthorized cross-café document access.');
      }
    }

    // 3. Resource Classification Gate
    const classification = doc.classification || 'PROCUREMENT';

    if (classification === 'MANAGEMENT_CONFIDENTIAL') {
      if (!isMaster && !isOwner) {
        throw new ApiError(403, 'CONFIDENTIAL_RESOURCE_DENIED', 'Management confidential files are restricted to Master and Owner.');
      }
    }

    if (classification === 'SUPPLIER_BANKING') {
      if (isStaff) {
        throw new ApiError(403, 'BANKING_RESOURCE_DENIED', 'Staff are prohibited from viewing supplier banking attachments.');
      }
    }

    if (classification === 'FINANCE') {
      if (isStaff) {
        throw new ApiError(403, 'FINANCE_RESOURCE_DENIED', 'Staff are prohibited from accessing finance attachments.');
      }
    }

    if (classification === 'HR_CONFIDENTIAL') {
      if (isStaff) {
        throw new ApiError(403, 'HR_CONFIDENTIAL_DENIED', 'Staff are prohibited from accessing confidential HR documents.');
      }
    }

    if (classification === 'HR_SELF') {
      if (isStaff) {
        const isOwn = (doc.employeeId && doc.employeeId === auth.userId) ||
                      (doc.relatedRecordId && doc.relatedRecordId === auth.userId) ||
                      (doc.uploadedBy && doc.uploadedBy === auth.userId);
        if (!isOwn) {
          throw new ApiError(403, 'UNRELATED_STAFF_RESOURCE_DENIED', 'Staff cannot access another employee HR records in the same café.');
        }
      }
    }

    // 4. Action-specific Authorization Matrix
    const act = String(action || 'VIEW').toUpperCase();
    if (['REPLACE_VERSION', 'TAG_UPDATE', 'LINK_ENTITY', 'EXPIRY_UPDATE'].includes(act)) {
      if (isStaff) {
        throw new ApiError(403, 'ACTION_DENIED_STAFF', `Action ${act} is not permitted for STAFF.`);
      }
    }

    if (['VERIFY', 'REJECT'].includes(act)) {
      if (isStaff) {
        throw new ApiError(403, 'VERIFICATION_DENIED', 'Staff cannot verify or reject documents.');
      }
    }

    if (act === 'SOFT_DELETE' || act === 'ARCHIVE') {
      if (isStaff) {
        throw new ApiError(403, 'DELETE_DENIED', 'Staff cannot delete documents.');
      }
    }

    if (act === 'RESTORE') {
      if (!isMaster && !isOwner) {
        throw new ApiError(403, 'RESTORE_DENIED', 'Only Master and Owner can restore deleted documents.');
      }
    }

    if (act === 'PERMANENT_DELETE') {
      if (!isMaster) {
        throw new ApiError(403, 'PERMANENT_DELETE_DENIED', 'Permanent delete is strictly restricted to MASTER.');
      }
    }

    // Quarantine guard for content access
    if (['PREVIEW', 'DOWNLOAD', 'VERIFY'].includes(act)) {
      if (doc.securityScanStatus === 'REJECTED' || doc.status === 'REJECTED') {
        throw new ApiError(400, 'CANNOT_ACCESS_QUARANTINED', 'Cannot access quarantined or rejected document.');
      }
    }

    return true;
  }

  static generateDocumentId(moduleCode = 'DOC', cafeCode = 'ZC01') {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `DOC-${moduleCode}-${cafeCode}-${d}-${rand}`;
  }

  /**
   * Validate and attach a business document to any record.
   * Uses temporary disk-backed staging and persists into durable document storage.
   */
  static async attachDocument({
    organisationId,
    cafeId = null,
    relatedModule,
    relatedRecordId,
    documentType,
    documentNumber = '',
    entityName = '',
    invoiceDate = null,
    amountPaisa = null,
    gstin = '',
    originalFilename,
    mimeType,
    sizeBytes,
    tempFilePath = null,
    fileBuffer = null,
    fileBase64 = null,
    notes = '',
    auth = {},
  }) {
    if (!organisationId || !relatedModule || !relatedRecordId || !documentType || !originalFilename) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new ApiError(400, 'MISSING_FIELDS', 'Mandatory document parameters missing.');
    }

    const normMime = String(mimeType || '').trim().toLowerCase();
    try {
      this.validateFileMime(normMime, originalFilename);
    } catch (mimeErr) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw mimeErr;
    }

    let effectiveSize = sizeBytes;
    if (tempFilePath) {
      try {
        const stat = await fs.promises.stat(tempFilePath);
        effectiveSize = stat.size;
      } catch (e) {
        throw new ApiError(400, 'FILE_READ_ERROR', 'Failed to inspect temporary uploaded file.');
      }
    } else if (fileBuffer) {
      effectiveSize = fileBuffer.length;
    }

    if (effectiveSize > MAX_FILE_SIZE_BYTES) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new ApiError(400, 'FILE_TOO_LARGE', `File size exceeds 15MB limit.`);
    }

    try {
      // 1. Magic-byte verification without buffering whole file into memory
      if (tempFilePath) {
        const fd = await fs.promises.open(tempFilePath, 'r');
        const header = Buffer.alloc(8);
        await fd.read(header, 0, 8, 0);
        await fd.close();
        this.validateMagicBytes(header, normMime);
      } else if (fileBuffer) {
        this.validateMagicBytes(fileBuffer, normMime);
      } else if (fileBase64) {
        const decodedBuf = Buffer.from(fileBase64, 'base64');
        this.validateMagicBytes(decodedBuf, normMime);
      }

      // 2. Cryptographic SHA-256 Checksum Calculation
      let checksum = null;
      if (tempFilePath) {
        checksum = await this.computeStreamChecksum(tempFilePath);
      } else if (fileBuffer) {
        checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } else if (fileBase64) {
        checksum = crypto.createHash('sha256').update(fileBase64, 'utf8').digest('hex');
      }

      // 3. Pluggable Upload Security / Malware Scanning Layer
      const scanResult = await SecurityScannerService.scanFile({
        filePath: tempFilePath,
        fileBuffer,
        mimeType: normMime,
        filename: originalFilename,
      });

      if (scanResult.status === 'REJECTED') {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath).catch(() => {});
        }
        throw new ApiError(400, 'MALWARE_DETECTED', `File upload rejected by security scanner: ${scanResult.details}`);
      }

      // 4. Generate safe internal filename & ID: DOC-{MODULE}-{SEQ}
      const documentId = await SequenceCounter.generateId({
        organisationId,
        sequenceKey: 'BUSINESS_DOC',
        prefix: 'DOC',
        minimumDigits: 6,
      });

      const ext = ALLOWED_MIME_TYPES.get(normMime);
      const internalFilename = `${documentId}.${ext}`;

      // 5. Safe Persistence via Durable Document Storage Adapter
      const storageKey = documentStorageAdapter.generateStorageKey({
        organisationId,
        documentId,
        mimeType: normMime,
      });

      let storedResult = null;
      if (tempFilePath) {
        storedResult = await documentStorageAdapter.put({
          filePath: tempFilePath,
          storageKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
        // Clean up temporary staged file after successful persistence
        await fs.promises.unlink(tempFilePath).catch(() => {});
      } else if (fileBuffer) {
        storedResult = await documentStorageAdapter.put({
          buffer: fileBuffer,
          storageKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
      } else if (fileBase64) {
        storedResult = await documentStorageAdapter.put({
          buffer: Buffer.from(fileBase64, 'base64'),
          storageKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
      }

      const doc = await BusinessDocument.create({
        documentId,
        organisationId,
        cafeId,
        relatedModule: relatedModule.trim().toUpperCase(),
        relatedRecordId: relatedRecordId.trim().toUpperCase(),
        documentType: documentType.trim(),
        documentNumber: documentNumber ? documentNumber.trim() : '',
        entityName: entityName ? entityName.trim() : '',
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        amountPaisa: amountPaisa !== null ? Math.round(amountPaisa) : null,
        gstin: gstin ? gstin.trim().toUpperCase() : '',
        originalFilename: originalFilename.trim(),
        internalFilename,
        mimeType: normMime,
        sizeBytes: effectiveSize,
        checksum,
        storageKey: storedResult?.storageKey || storageKey,
        storagePath: storedResult?.storagePath || null,
        storageDriver: storedResult?.storageDriver || 'RENDER_PERSISTENT_DISK',
        fileBuffer: fileBuffer || null,
        fileData: fileBase64 || null,
        securityScanStatus: scanResult.status,
        securityScanDetails: scanResult.details,
        currentVersion: 1,
        versions: [
          {
            version: 1,
            originalFilename: originalFilename.trim(),
            internalFilename,
            mimeType: normMime,
            sizeBytes: effectiveSize,
            checksum,
            storageKey: storedResult?.storageKey || storageKey,
            storagePath: storedResult?.storagePath || null,
            storageDriver: storedResult?.storageDriver || 'RENDER_PERSISTENT_DISK',
            fileBuffer: fileBuffer || null,
            fileData: fileBase64 || null,
            securityScanStatus: scanResult.status,
            securityScanDetails: scanResult.details,
            changeReason: 'Initial upload',
            uploadedBy: auth.name || auth.userId || 'Operator',
            uploadedAt: new Date(),
          },
        ],
        status: 'UPLOADED',
        notes,
        uploadedBy: auth.name || auth.userId || 'Operator',
        uploadedAt: new Date(),
      });

      await auditService.recordAuditEvent({
        organisationId,
        cafeId: cafeId || 'GLOBAL',
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'DOCUMENT_ATTACHMENT',
        action: 'DOCUMENT_ATTACHED',
        entityType: 'BUSINESS_DOCUMENT',
        entityId: documentId,
        reason: `Attached ${documentType} to ${relatedModule}:${relatedRecordId}`,
        result: 'SUCCESS',
        metadata: {
          documentId,
          originalFilename,
          sizeBytes: effectiveSize,
          mimeType: normMime,
          storageKey: storedResult?.storageKey,
          storageDriver: storedResult?.storageDriver,
          securityScanStatus: scanResult.status,
          relatedModule,
          relatedRecordId,
        },
      }).catch(() => {});

      return doc;
    } catch (error) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Uploads a new version of an existing business document without overwriting.
   */
  static async replaceVersion({
    documentId,
    organisationId,
    originalFilename,
    mimeType,
    sizeBytes,
    tempFilePath = null,
    fileBuffer = null,
    fileBase64 = null,
    changeReason,
    auth = {},
  }) {
    const doc = await BusinessDocument.findOne({
      documentId: documentId.trim().toUpperCase(),
      organisationId,
      isDeleted: false,
    });

    if (!doc) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    if (!changeReason) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new ApiError(400, 'REASON_REQUIRED', 'A reason is mandatory when replacing a document version.');
    }

    const normMime = String(mimeType || '').trim().toLowerCase();
    try {
      this.validateFileMime(normMime, originalFilename);
    } catch (mimeErr) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw mimeErr;
    }

    let effectiveSize = sizeBytes;
    if (tempFilePath) {
      try {
        const stat = await fs.promises.stat(tempFilePath);
        effectiveSize = stat.size;
      } catch (e) {
        throw new ApiError(400, 'FILE_READ_ERROR', 'Failed to inspect temporary uploaded file.');
      }
    } else if (fileBuffer) {
      effectiveSize = fileBuffer.length;
    }

    if (effectiveSize > MAX_FILE_SIZE_BYTES) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw new ApiError(400, 'FILE_TOO_LARGE', `File size exceeds 15MB limit.`);
    }

    try {
      // 1. Magic-bytes validation
      if (tempFilePath) {
        const fd = await fs.promises.open(tempFilePath, 'r');
        const header = Buffer.alloc(8);
        await fd.read(header, 0, 8, 0);
        await fd.close();
        this.validateMagicBytes(header, normMime);
      } else if (fileBuffer) {
        this.validateMagicBytes(fileBuffer, normMime);
      } else if (fileBase64) {
        const decodedBuf = Buffer.from(fileBase64, 'base64');
        this.validateMagicBytes(decodedBuf, normMime);
      }

      const nextVersion = doc.currentVersion + 1;
      const ext = ALLOWED_MIME_TYPES.get(normMime);
      const internalFilename = `${doc.documentId}_v${nextVersion}.${ext}`;

      let checksum = null;
      if (tempFilePath) {
        checksum = await this.computeStreamChecksum(tempFilePath);
      } else if (fileBuffer) {
        checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } else if (fileBase64) {
        checksum = crypto.createHash('sha256').update(fileBase64, 'utf8').digest('hex');
      }

      // Security scan
      const scanResult = await SecurityScannerService.scanFile({
        filePath: tempFilePath,
        fileBuffer,
        mimeType: normMime,
        filename: originalFilename,
      });

      if (scanResult.status === 'REJECTED') {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath).catch(() => {});
        }
        throw new ApiError(400, 'MALWARE_DETECTED', `Replacement version rejected by security scanner: ${scanResult.details}`);
      }

      const newVersionKey = documentStorageAdapter.generateStorageKey({
        organisationId,
        documentId: `${doc.documentId}_v${nextVersion}`,
        mimeType: normMime,
      });

      let storedResult = null;
      if (tempFilePath) {
        storedResult = await documentStorageAdapter.put({
          filePath: tempFilePath,
          storageKey: newVersionKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
        await fs.promises.unlink(tempFilePath).catch(() => {});
      } else if (fileBuffer) {
        storedResult = await documentStorageAdapter.put({
          buffer: fileBuffer,
          storageKey: newVersionKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
      } else if (fileBase64) {
        storedResult = await documentStorageAdapter.put({
          buffer: Buffer.from(fileBase64, 'base64'),
          storageKey: newVersionKey,
          mimeType: normMime,
          sizeBytes: effectiveSize,
          organisationId,
        });
      }

      // Retain previous binary as an archived version
      const previousVersionRecord = {
        version: doc.currentVersion,
        originalFilename: doc.originalFilename,
        internalFilename: doc.internalFilename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        checksum: doc.checksum,
        storageKey: doc.storageKey,
        storagePath: doc.storagePath,
        storageDriver: doc.storageDriver,
        fileBuffer: doc.fileBuffer,
        fileData: doc.fileData,
        securityScanStatus: doc.securityScanStatus,
        securityScanDetails: doc.securityScanDetails,
        changeReason: changeReason.trim(),
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt || new Date(),
      };

      doc.versions.push(previousVersionRecord);
      doc.currentVersion = nextVersion;
      doc.originalFilename = originalFilename.trim();
      doc.internalFilename = internalFilename;
      doc.mimeType = normMime;
      doc.sizeBytes = effectiveSize;
      doc.checksum = checksum;
      doc.storageKey = storedResult?.storageKey || newVersionKey;
      doc.storagePath = storedResult?.storagePath || null;
      doc.storageDriver = storedResult?.storageDriver || 'RENDER_PERSISTENT_DISK';
      doc.fileBuffer = fileBuffer || null;
      doc.fileData = fileBase64 || null;
      doc.securityScanStatus = scanResult.status;
      doc.securityScanDetails = scanResult.details;
      doc.status = 'UPLOADED'; // Requires re-verification
      doc.verifiedBy = null;
      doc.verifiedAt = null;

      await doc.save();

      await auditService.recordAuditEvent({
        organisationId,
        cafeId: doc.cafeId || 'GLOBAL',
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'DOCUMENT_ATTACHMENT',
        action: 'DOCUMENT_VERSION_REPLACED',
        entityType: 'BUSINESS_DOCUMENT',
        entityId: doc.documentId,
        reason: changeReason,
        result: 'SUCCESS',
        metadata: {
          documentId: doc.documentId,
          newVersion: nextVersion,
          originalFilename,
        },
      }).catch(() => {});

      return doc;
    } catch (error) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Verify or reject a business document.
   */
  static async verifyDocument({
    documentId,
    organisationId,
    decision, // 'VERIFIED' or 'REJECTED'
    reason = '',
    auth,
  }) {
    if (auth.role !== 'MASTER' && auth.role !== 'OWNER') {
      throw new ApiError(403, 'VERIFICATION_DENIED', 'Only Master and Owner can verify business documents.');
    }

    const doc = await BusinessDocument.findOne({
      documentId: documentId.trim().toUpperCase(),
      organisationId,
      isDeleted: false,
    });

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    if (doc.securityScanStatus === 'REJECTED' || doc.status === 'REJECTED') {
      if (decision === 'VERIFIED') {
        throw new ApiError(400, 'CANNOT_VERIFY_QUARANTINED', 'Cannot verify a quarantined or rejected document.');
      }
    }

    doc.status = decision === 'VERIFIED' ? 'VERIFIED' : 'REJECTED';
    doc.verifiedBy = auth.name || auth.userId || 'Master';
    doc.verifiedAt = new Date();
    doc.verificationReason = reason;

    await doc.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId: doc.cafeId || 'GLOBAL',
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'DOCUMENT_ATTACHMENT',
      action: decision === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED',
      entityType: 'BUSINESS_DOCUMENT',
      entityId: doc.documentId,
      reason,
      result: 'SUCCESS',
    }).catch(() => {});

    return doc;
  }

  /**
   * Soft delete a document with mandatory reason.
   */
  static async deleteDocument({
    documentId,
    organisationId,
    reason,
    auth,
  }) {
    if (auth.role !== 'MASTER' && auth.role !== 'OWNER') {
      throw new ApiError(403, 'DELETE_DENIED', 'Only Master and Owner can remove business documents.');
    }

    if (!reason || reason.trim().length < 5) {
      throw new ApiError(400, 'REASON_REQUIRED', 'A detailed reason (min 5 chars) is mandatory to remove a document.');
    }

    const doc = await BusinessDocument.findOne({
      documentId: documentId.trim().toUpperCase(),
      organisationId,
      isDeleted: false,
    });

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Business document not found.');
    }

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = auth.name || auth.userId || 'Master';
    doc.deletionReason = reason.trim();
    doc.status = 'ARCHIVED';

    await doc.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId: doc.cafeId || 'GLOBAL',
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'DOCUMENT_ATTACHMENT',
      action: 'DOCUMENT_SOFT_DELETED',
      entityType: 'BUSINESS_DOCUMENT',
      entityId: doc.documentId,
      reason,
      result: 'SUCCESS',
    }).catch(() => {});

    return { success: true, message: 'Document soft-deleted and archived.' };
  }
}

module.exports = {
  DocumentAttachmentService,
};
