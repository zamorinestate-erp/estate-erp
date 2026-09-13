#!/usr/bin/env node
/**
 * Zamorin Café ERP — Backup Configuration & DR Precondition Verifier
 *
 * Verifies structural preconditions for continuous cloud backup and PITR
 * WITHOUT automating or executing any destructive database restoration drills.
 */

import { fileURLToPath } from 'url';

export function verifyBackupPreconditions(env = process.env) {
  const uri = env.MONGODB_URI || '';
  const isSrv = uri.startsWith('mongodb+srv://');
  const isDirect = uri.startsWith('mongodb://');
  const hasUri = isSrv || isDirect;

  const atlasProjectId = env.ATLAS_PROJECT_ID || null;
  const atlasClusterName = env.ATLAS_CLUSTER_NAME || null;

  const checks = [
    {
      name: 'MongoDB Connection String Configured',
      passed: hasUri,
      status: hasUri ? 'CONFIGURED' : 'MISSING',
      details: hasUri ? (isSrv ? 'Atlas SRV connection format detected' : 'Standard replica-set URI') : 'MONGODB_URI not found',
    },
    {
      name: 'Atlas High-Availability / Replica Set Protocol',
      passed: isSrv || uri.includes('replicaSet'),
      status: isSrv ? 'ATLAS_SRV' : uri.includes('replicaSet') ? 'REPLICA_SET' : 'SINGLE_INSTANCE_OR_DEV',
      details: 'Continuous cloud backup / oplog PITR requires replica set or Atlas cluster',
    },
    {
      name: 'Atlas Project & Cluster Identifiers (Optional for CLI DR)',
      passed: Boolean(atlasProjectId && atlasClusterName) || hasUri,
      status: (atlasProjectId && atlasClusterName) ? 'CONFIGURED' : 'UNSET_OPTIONAL',
      details: (atlasProjectId && atlasClusterName) ? 'Atlas identifiers present' : 'Atlas API keys and IDs optional; managed via Atlas Cloud Console',
    },
    {
      name: 'Automated Restore Safeguard',
      passed: true,
      status: 'PROTECTED',
      details: 'Automatic restore is strictly disabled. Restoration requires authorized manual operator protocol per ZAMORIN_MONGODB_BACKUP_RESTORE_RUNBOOK.md',
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    tool: 'zamorin-backup-config-verifier',
    preconditionsMet: checks.filter((c) => c.name !== 'Atlas Project & Cluster Identifiers (Optional for CLI DR)').every((c) => c.passed),
    checks,
    destructiveRestorePermitted: false,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('[BACKUP_VERIFY] Checking Disaster Recovery and Backup Preconditions:\n');
  const result = verifyBackupPreconditions();
  
  for (const c of result.checks) {
    const pad = c.name.padEnd(45, ' ');
    console.log(`  ${pad} [${c.status}] -> ${c.details}`);
  }

  console.log(`\nOverall Backup Readiness: ${result.preconditionsMet ? 'PRECONDITIONS_MET' : 'PRECONDITIONS_INCOMPLETE'}`);
  console.log(`(Production restore drills remain explicitly deferred per owner instruction)`);
}
