#!/usr/bin/env node
/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — DATABASE MIGRATION SAFETY & PRE-FLIGHT VALIDATOR
 * ============================================================================
 * Audits and classifies database schema and data transformations to prevent
 * destructive alterations from executing silently or breaking zero-downtime rollbacks.
 */

import fs from 'fs';
import path from 'path';

export const MIGRATION_CLASSIFICATIONS = {
  BACKWARD_COMPATIBLE: {
    type: 'BACKWARD_COMPATIBLE',
    allowedInProduction: true,
    requiresDowntime: false,
    description: 'Non-breaking additive schema change; default values provided; safe for expand/contract.',
  },
  DATA_TRANSFORMING: {
    type: 'DATA_TRANSFORMING',
    allowedInProduction: true,
    requiresDowntime: false,
    description: 'Safe data population or index creation performed online without blocking reads.',
  },
  LONG_RUNNING: {
    type: 'LONG_RUNNING',
    allowedInProduction: 'WITH_APPROVAL',
    requiresDowntime: false,
    description: 'Batch update exceeding 10,000 documents; requires chunking to avoid thread starvation.',
  },
  DESTRUCTIVE: {
    type: 'DESTRUCTIVE',
    allowedInProduction: false,
    requiresDowntime: true,
    description: 'Field removal, type alteration, or collection drop. Strictly blocked during automated deployment.',
  },
};

export function auditMigrationSafety(migrationPlan = {}) {
  const issues = [];
  const checks = [];

  const isDestructive = Boolean(migrationPlan.dropsCollection || migrationPlan.dropsField || migrationPlan.altersFieldType);
  const isBackwardCompatible = !isDestructive;

  checks.push({
    name: 'Destructive Modification Prohibition',
    passed: !isDestructive,
    classification: isDestructive ? MIGRATION_CLASSIFICATIONS.DESTRUCTIVE.type : MIGRATION_CLASSIFICATIONS.BACKWARD_COMPATIBLE.type,
    details: isDestructive ? 'Migration attempts destructive schema alteration' : 'Zero destructive alterations detected',
  });

  if (isDestructive) {
    issues.push('DESTRUCTIVE_MIGRATION_PROHIBITED: Expand/Contract pattern must be used instead.');
  }

  // Check backup verification precondition
  const backupVerified = Boolean(migrationPlan.backupVerified);
  checks.push({
    name: 'Pre-Migration Backup Precondition',
    passed: backupVerified,
    details: backupVerified ? 'Pre-migration snapshot confirmed' : 'Pre-migration backup has not been certified',
  });
  if (!backupVerified) {
    issues.push('BACKUP_PRECONDITION_MISSING: Cannot proceed with migration without confirmed backup.');
  }

  return {
    timestamp: new Date().toISOString(),
    isSafe: issues.length === 0,
    classification: isDestructive ? 'DESTRUCTIVE' : 'BACKWARD_COMPATIBLE',
    checks,
    issues,
    safeguard: 'Silent destructive migrations at server startup are disallowed.',
  };
}

if (process.argv[1].endsWith('migration_safety_checker.mjs')) {
  console.log('[MIGRATION_AUDIT] Auditing Database Migration Safety Constraints:');
  const result = auditMigrationSafety({ backupVerified: true });
  console.log(JSON.stringify(result, null, 2));
}
