'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — RETENTION POLICY & TEMPORARY STAGING CLEANUP SERVICE
 * ============================================================================
 * Enforces statutory record retention periods and safely purges abandoned
 * temporary staging uploads without deleting active files or business audit trails.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATUTORY_RETENTION_CATEGORIES = {
  FINANCIAL_TRANSACTIONS: {
    category: 'FINANCIAL_TRANSACTIONS',
    retentionDays: 2920, // 8 years statutory requirement under Companies Act / IT Act
    description: 'General ledger, bills, day close books, and tax invoices.',
    autoPurgeAllowed: false,
  },
  TAX_RECORDS: {
    category: 'TAX_RECORDS',
    retentionDays: 2920, // 8 years
    description: 'GST filings, TDS registers, and e-invoices.',
    autoPurgeAllowed: false,
  },
  EMPLOYEE_STATUTORY: {
    category: 'EMPLOYEE_STATUTORY',
    retentionDays: 1825, // 5 years
    description: 'Wages registers, PF/ESI submissions, and attendance logs.',
    autoPurgeAllowed: false,
  },
  SECURITY_AND_AUDIT_LOGS: {
    category: 'SECURITY_AND_AUDIT_LOGS',
    retentionDays: 1095, // 3 years
    description: 'Append-only audit trail and critical security events.',
    autoPurgeAllowed: false,
  },
  EXPIRED_EXPORT_ARTIFACTS: {
    category: 'EXPIRED_EXPORT_ARTIFACTS',
    retentionDays: 7, // 7 days ephemeral download window
    description: 'Generated PDF/Excel export binaries in temporary caches.',
    autoPurgeAllowed: true,
  },
  ABANDONED_DOCUMENT_STAGING: {
    category: 'ABANDONED_DOCUMENT_STAGING',
    retentionHours: 2, // 2 hours threshold for abandoned temporary uploads
    description: 'Uncommitted multipart upload files in os.tmpdir()/zamorin_document_staging.',
    autoPurgeAllowed: true,
  },
};

class RetentionPolicyService {
  /**
   * Returns statutory retention policy dictionary.
   */
  getRetentionPolicies() {
    return STATUTORY_RETENTION_CATEGORIES;
  }

  /**
   * Safely purges abandoned staging files older than 2 hours in the OS temporary directory.
   * Invariant: Never deletes actively writing files (< 2 hours old).
   */
  async cleanupAbandonedStaging({ olderThanMinutes = 120 } = {}) {
    const stagingDir = path.join(os.tmpdir(), 'zamorin_document_staging');
    if (!fs.existsSync(stagingDir)) {
      return {
        status: 'CLEAN',
        scanned: 0,
        deleted: 0,
        stagingDir,
      };
    }

    const now = Date.now();
    const cutoff = now - olderThanMinutes * 60 * 1000;
    const entries = await fs.promises.readdir(stagingDir);

    let scanned = 0;
    let deleted = 0;
    const deletedFiles = [];

    for (const name of entries) {
      if (!name.endsWith('.tmp') && !name.startsWith('stg-')) {
        continue;
      }

      scanned += 1;
      const fullPath = path.join(stagingDir, name);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.promises.unlink(fullPath);
          deleted += 1;
          deletedFiles.push(name);
        }
      } catch (_) {}
    }

    return {
      status: 'SUCCESS',
      scanned,
      deleted,
      cutoffAgeMinutes: olderThanMinutes,
      deletedFiles,
      timestamp: new Date().toISOString(),
    };
  }
}

const retentionPolicyService = new RetentionPolicyService();

module.exports = {
  STATUTORY_RETENTION_CATEGORIES,
  RetentionPolicyService,
  retentionPolicyService,
};
