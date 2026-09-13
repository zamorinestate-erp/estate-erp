'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — DOCUMENT STORAGE RECONCILIATION & CAPACITY SERVICE
 * ============================================================================
 * Monitors persistent disk utilization (/var/data/zamorin_documents) and conducts
 * non-destructive integrity reconciliation between MongoDB BusinessDocument
 * metadata and physical stored binary files.
 *
 * Invariant:
 * Orphaned binary objects are NEVER automatically purged; an audit review
 * report is generated for operator decision.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BusinessDocument } = require('../models/BusinessDocument');
const { documentStorageAdapter } = require('./documentStorageAdapter');

const CAPACITY_ALERT_THRESHOLDS = {
  WARNING_PERCENT: 70,
  HIGH_PERCENT: 85,
  CRITICAL_PERCENT: 95,
};

class DocumentReconciliationService {
  /**
   * Assesses disk capacity and usage metrics for the document storage mount.
   */
  async assessStorageCapacity() {
    const root = documentStorageAdapter.getResolvedStorageRoot();
    if (!root || !fs.existsSync(root)) {
      return {
        status: 'UNAVAILABLE',
        rootPath: root,
        totalBytes: 0,
        usedBytes: 0,
        freeBytes: 0,
        utilizationPercent: 0,
        alertLevel: 'CRITICAL',
        message: 'Persistent storage root is not available or unmounted.',
      };
    }

    let totalSizeBytes = 0;
    let fileCount = 0;

    // Calculate directory size by walking directory tree
    const walk = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          const stat = await fs.promises.stat(full);
          totalSizeBytes += stat.size;
          fileCount += 1;
        }
      }
    };

    try {
      await walk(root);
    } catch (_) {}

    // Simulated 10GB disk volume per render.yaml manifest (10 * 1024 * 1024 * 1024)
    const provisionedDiskCapacityBytes = 10 * 1024 * 1024 * 1024;
    const utilizationPercent = Number(((totalSizeBytes / provisionedDiskCapacityBytes) * 100).toFixed(2));

    let alertLevel = 'NORMAL';
    let recommendedAction = 'No action required.';

    if (utilizationPercent >= CAPACITY_ALERT_THRESHOLDS.CRITICAL_PERCENT) {
      alertLevel = 'CRITICAL';
      recommendedAction =
        'IMMEDIATE: Trip KILL_SWITCH_DOCUMENT_UPLOADS to suspend new uploads. ' +
        'POS, billing, payroll, orders, and attendance remain fully operational. ' +
        'Contact operations team to expand Render persistent disk (render.yaml sizeGB). ' +
        'Reset KILL_SWITCH_DOCUMENT_UPLOADS after capacity is restored.';
    } else if (utilizationPercent >= CAPACITY_ALERT_THRESHOLDS.HIGH_PERCENT) {
      alertLevel = 'HIGH';
      recommendedAction =
        'URGENT: Prepare Render persistent disk expansion request. ' +
        'Trip KILL_SWITCH_EXPORT_QUEUE to halt PDF/CSV export accumulation if needed. ' +
        'POS, billing, payroll, and document uploads remain operational at this threshold. ' +
        'Escalate to operations team (SEV-2 alert).';
    } else if (utilizationPercent >= CAPACITY_ALERT_THRESHOLDS.WARNING_PERCENT) {
      alertLevel = 'WARNING';
      recommendedAction =
        'Monitor: Investigate high-volume PDF/export generators or large document uploads. ' +
        'No kill switch action required at this threshold. ' +
        'Raise SEV-3 operational alert for awareness.';
    }

    return {
      status: alertLevel === 'NORMAL' ? 'HEALTHY' : alertLevel,
      rootPath: root,
      provisionedCapacityBytes: provisionedDiskCapacityBytes,
      usedBytes: totalSizeBytes,
      freeBytes: Math.max(0, provisionedDiskCapacityBytes - totalSizeBytes),
      utilizationPercent,
      fileCount,
      alertLevel,
      thresholds: CAPACITY_ALERT_THRESHOLDS,
      recommendedAction,
      scopeNote: 'KILL_SWITCH_DOCUMENT_UPLOADS affects uploads only. POS/billing/payroll/attendance are never suspended by storage kill switches.',
      timestamp: new Date().toISOString(),
    };
  }


  /**
   * Reconciles MongoDB metadata with physical files on disk.
   * Detects:
   * 1. Orphan metadata: Document active in MongoDB but binary missing from disk.
   * 2. Orphan binaries: Files on disk with no matching active BusinessDocument.
   * 3. Checksum mismatches: Binary on disk does not match stored SHA-256.
   */
  async reconcileDocuments({ organisationId = 'ZAMORIN', verifyChecksums = true, sampleLimit = 100 } = {}) {
    const root = documentStorageAdapter.getResolvedStorageRoot();
    if (!root || !fs.existsSync(root)) {
      return {
        status: 'FAILED',
        error: 'DOCUMENT_STORAGE_ROOT_UNAVAILABLE',
        orphanMetadata: [],
        orphanBinaries: [],
        checksumMismatches: [],
      };
    }

    const orphanMetadata = [];
    const checksumMismatches = [];
    const verifiedKeys = new Set();

    // 1. Audit MongoDB records
    const docs = await BusinessDocument.find({ organisationId, isDeleted: false })
      .limit(sampleLimit)
      .lean();

    for (const doc of docs) {
      const storageKey = doc.storageKey;
      if (!storageKey) continue;

      verifiedKeys.add(storageKey);
      const fullPath = path.join(root, storageKey);

      if (!fs.existsSync(fullPath)) {
        orphanMetadata.push({
          documentId: doc.documentId,
          storageKey,
          title: doc.originalName,
          reason: 'Binary file missing on persistent disk mount',
        });
      } else if (verifyChecksums && doc.sha256) {
        // Calculate SHA-256 of physical file
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(fullPath);
        await new Promise((resolve) => {
          stream.on('data', (chunk) => hash.update(chunk));
          stream.on('end', resolve);
        });
        const actualHash = hash.digest('hex');

        if (actualHash !== doc.sha256) {
          checksumMismatches.push({
            documentId: doc.documentId,
            storageKey,
            expectedSha256: doc.sha256,
            actualSha256: actualHash,
            reason: 'Disk binary SHA-256 does not match database record',
          });
        }
      }
    }

    // 2. Discover physical files on disk to find orphan binaries
    const diskFiles = [];
    const walkFiles = async (dir, relativePrefix = '') => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relative = path.join(relativePrefix, entry.name).replace(/\\/g, '/');
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkFiles(full, relative);
        } else if (entry.isFile()) {
          diskFiles.push({ storageKey: relative, fullPath: full });
        }
      }
    };

    try {
      await walkFiles(root);
    } catch (_) {}

    const orphanBinaries = [];
    for (const file of diskFiles) {
      if (!verifiedKeys.has(file.storageKey)) {
        // Check if doc exists in Mongo
        const existsInDb = await BusinessDocument.findOne({ storageKey: file.storageKey }).lean();
        if (!existsInDb) {
          orphanBinaries.push({
            storageKey: file.storageKey,
            fullPath: file.fullPath,
            reason: 'Physical file exists on disk without matching BusinessDocument record',
          });
        }
      }
    }

    return {
      status: 'RECONCILIATION_COMPLETE',
      timestamp: new Date().toISOString(),
      documentsAudited: docs.length,
      diskFilesScanned: diskFiles.length,
      orphanMetadataCount: orphanMetadata.length,
      orphanBinariesCount: orphanBinaries.length,
      checksumMismatchesCount: checksumMismatches.length,
      orphanMetadata,
      orphanBinaries,
      checksumMismatches,
      isConsistent: orphanMetadata.length === 0 && checksumMismatches.length === 0,
      remediationNotice: 'Orphaned binaries are preserved for operator review per non-destructive policy.',
    };
  }
}

const documentReconciliationService = new DocumentReconciliationService();

module.exports = {
  CAPACITY_ALERT_THRESHOLDS,
  DocumentReconciliationService,
  documentReconciliationService,
};
