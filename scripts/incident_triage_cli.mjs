#!/usr/bin/env node
/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — INCIDENT RESPONSE & TRIAGE CLI
 * ============================================================================
 * Converts ZAMORIN_CAFE_OPERATIONS_INCIDENT_RESPONSE_RUNBOOK.md into an
 * executable operational triage utility and automated severity classifier.
 *
 * Supported Operations:
 * 1. Automated severity classification (SEV-1 through SEV-4) with response SLAs.
 * 2. 9-Stage Incident Lifecycle management.
 * 3. Specific operational runbook execution (Stolen Tablet, Cash Discrepancy, Network Outage).
 * 4. Containment action dispatch & evidence export.
 * 5. Blameless post-mortem report generation (5 Whys methodology).
 *
 * Usage:
 *   node scripts/incident_triage_cli.mjs --classify --scope all --impact outage
 *   node scripts/incident_triage_cli.mjs --scenario stolen-device --device-id DEV-TILL-01
 *   node scripts/incident_triage_cli.mjs --scenario cash-discrepancy
 *   node scripts/incident_triage_cli.mjs --scenario network-outage
 *   node scripts/incident_triage_cli.mjs --post-mortem --incident-id INC-2026-001
 */

import fs from 'fs';
import path from 'path';

export const SEVERITY_LEVELS = {
  'SEV-1': {
    name: 'SEV-1 (CRITICAL)',
    responseSlaMinutes: 15,
    resolutionSlaHours: 2,
    description: 'Complete system-wide operational outage; active data corruption; confirmed cross-tenant security breach; inability to process sales across multiple branches.',
    examples: [
      'Total backend or Atlas cluster outage',
      'POS billing offline across all branch cafés',
      'Confirmed multi-tenant data exfiltration',
      'Unrecoverable financial ledger corruption'
    ],
    updateFrequencyMinutes: 30
  },
  'SEV-2': {
    name: 'SEV-2 (HIGH)',
    responseSlaMinutes: 30,
    resolutionSlaHours: 4,
    description: 'Major operational impairment affecting a single branch café; failure of a critical business module (Cash Book / Inventory sync); cross-café boundary anomaly.',
    examples: [
      'Single café POS terminals unable to settle bills',
      'Stock deduction ledger desynchronization',
      'Stolen or compromised physical POS terminal',
      'Suspected unauthorized manager cash reversal'
    ],
    updateFrequencyMinutes: 60
  },
  'SEV-3': {
    name: 'SEV-3 (MODERATE)',
    responseSlaMinutes: 120,
    resolutionSlaHours: 24,
    description: 'Minor operational disruption with viable manual workaround; non-blocking performance degradation; single-user authentication glitch.',
    examples: [
      'Delayed ZURF analytical report generation',
      'Single terminal offline while backup till operates',
      'Supplier PO email dispatch queue failure',
      'Transient rate-limiting warning on reporting'
    ],
    updateFrequencyMinutes: 240
  },
  'SEV-4': {
    name: 'SEV-4 (LOW)',
    responseSlaMinutes: 240,
    resolutionSlaHours: 168, // Next release cycle
    description: 'Cosmetic defect, minor UI/UX inconsistency, non-critical logging anomaly with zero financial or security impact.',
    examples: [
      'UI button alignment defect on small screens',
      'Non-blocking console warning in dev mode',
      'Minor translation or phrasing discrepancy'
    ],
    updateFrequencyMinutes: 1440
  }
};

export const INCIDENT_LIFECYCLE_STAGES = [
  { stage: 1, name: 'DETECTION', action: 'Automated SRE alert (5xx/latency) or store manager diagnostic escalation' },
  { stage: 2, name: 'CLASSIFICATION', action: 'Incident Commander designates SEV-1 through SEV-4 and opens ticket' },
  { stage: 3, name: 'CONTAINMENT', action: 'Account suspension, device token revocation, or read-only emergency lock' },
  { stage: 4, name: 'EVIDENCE PRESERVATION', action: 'Export correlation-id logs, on-demand Atlas snapshot, AuditEvent dump' },
  { stage: 5, name: 'INVESTIGATION', action: 'Trace correlation IDs in logs, correlate with MongoDB oplog records' },
  { stage: 6, name: 'REMEDIATION', action: 'Deploy verified patch or execute compensating double-entry audit records' },
  { stage: 7, name: 'RECOVERY & VERIFICATION', action: 'Run health probes, smoke tests, and master system verification' },
  { stage: 8, name: 'COMMUNICATION & ESCALATION', action: 'Periodic executive updates to Project Owner & store managers' },
  { stage: 9, name: 'POST-MORTEM', action: 'Blameless post-mortem within 48 hours, 5 Whys, regression tests added' }
];

/**
 * Automatically classifies an incident given scope and impact characteristics.
 */
export function classifyIncident({ scope = 'single-user', impact = 'cosmetic' } = {}) {
  const normScope = String(scope).toLowerCase();
  const normImpact = String(impact).toLowerCase();

  if (normScope === 'all' || normImpact === 'data_corruption' || normImpact === 'security_breach' || normImpact === 'total_outage') {
    return { severity: 'SEV-1', ...SEVERITY_LEVELS['SEV-1'] };
  }
  if (normScope === 'branch' || normImpact === 'stolen_device' || normImpact === 'ledger_desync' || normImpact === 'pos_offline') {
    return { severity: 'SEV-2', ...SEVERITY_LEVELS['SEV-2'] };
  }
  if (normImpact === 'slow_report' || normImpact === 'queue_failure' || normImpact === 'transient_glitch') {
    return { severity: 'SEV-3', ...SEVERITY_LEVELS['SEV-3'] };
  }
  return { severity: 'SEV-4', ...SEVERITY_LEVELS['SEV-4'] };
}

/**
 * Generates an operational action runbook for specific scenarios.
 */
export function getScenarioRunbook(scenarioKey, params = {}) {
  switch (scenarioKey) {
    case 'stolen-device':
      return {
        scenario: 'Stolen / Lost POS Tablet',
        severity: 'SEV-2',
        targetDeviceId: params.deviceId || 'DEV-POS-UNKNOWN',
        immediateActions: [
          `1. Master / IT Admin accesses #cafe-ops-devices route`,
          `2. Locate device [${params.deviceId || 'DEV-POS-UNKNOWN'}] and trigger Revoke Device`,
          `3. Backend sets DeviceRegistration.status = 'LOST' and terminates OperatorSession`,
          `4. Stolen hardware will receive 401 DEVICE_REVOKED; local encryption keys purged`,
          `5. Audit log generated: AuditEvent { action: 'DEVICE_REVOKED', reason: 'STOLEN_REPORTED' }`
        ],
        containmentPayload: {
          action: 'REVOKE_DEVICE',
          deviceId: params.deviceId || 'DEV-POS-UNKNOWN',
          status: 'LOST',
          revokeSessions: true
        }
      };

    case 'cash-discrepancy':
      return {
        scenario: 'Cash Drawer Discrepancy / Suspected Theft',
        severity: 'SEV-2',
        targetCafeId: params.cafeId || 'CAFE-TEST',
        immediateActions: [
          `1. Store Manager executes Daily Cash Book Audit (#cash-book)`,
          `2. Discrepancy recorded in StoreDayAudit with physical cash count vs ledger total`,
          `3. Master inspects immutable CashTransaction documents and correlation timestamps`,
          `4. Any correction requires a compensating entry with signed manager rationale`,
          `5. Direct ledger mutation is blocked; double-entry audit invariant enforced`
        ],
        containmentPayload: {
          action: 'RECORD_CASH_DISCREPANCY',
          cafeId: params.cafeId || 'CAFE-TEST',
          requiresCompensatingEntry: true,
          auditEnforced: true
        }
      };

    case 'network-outage':
      return {
        scenario: 'Branch Café Network Outage / Offline Buffering',
        severity: 'SEV-2',
        targetCafeId: params.cafeId || 'CAFE-TEST',
        immediateActions: [
          `1. Terminal diagnostic detects lost connectivity (btn-run-diagnostic -> UNREACHABLE)`,
          `2. Terminal automatically activates offline buffering in encrypted IndexedDB queue`,
          `3. Offline orders signed with client HMAC signature to prevent tampering`,
          `4. When Wi-Fi restores, client replays queued bills sequentially via POST /api/v1/bills/offline-sync`,
          `5. Backend validates HMAC signatures and atomically records bills without duplicates`
        ],
        containmentPayload: {
          action: 'ACTIVATE_OFFLINE_BUFFER',
          storageTarget: 'IndexedDB',
          hmacVerificationRequired: true
        }
      };

    default:
      throw new Error(`Unknown scenario: ${scenarioKey}. Supported: stolen-device, cash-discrepancy, network-outage`);
  }
}

/**
 * Builds a structured post-mortem report template.
 */
export function generatePostMortemTemplate({ incidentId = 'INC-2026-001', title = 'Incident Post-Mortem', severity = 'SEV-2', owner = 'Operations SRE' } = {}) {
  return {
    incidentId,
    title,
    severity,
    owner,
    generatedAt: new Date().toISOString(),
    slaCompliance: {
      targetResolutionHours: SEVERITY_LEVELS[severity]?.resolutionSlaHours || 4,
      actualResolutionHours: null,
      metSla: true
    },
    timeline: [
      { time: 'T+00:00', event: 'Incident detected via diagnostic alert' },
      { time: 'T+00:10', event: 'Incident classified; containment initiated' },
      { time: 'T+00:30', event: 'Root cause identified in application trace' },
      { time: 'T+01:15', event: 'Compensating fix deployed and verified' },
      { time: 'T+01:30', event: 'Service health verified healthy across all probes' }
    ],
    fiveWhys: [
      { why: 1, answer: 'Why did the service fail? (e.g. Unhandled rate-limit spike)' },
      { why: 2, answer: 'Why was the spike unhandled? (e.g. Burst threshold was too low)' },
      { why: 3, answer: 'Why was the threshold low? (e.g. Default conservative setting)' },
      { why: 4, answer: 'Why wasn\'t it tuned? (e.g. Load test did not test peak concurrency)' },
      { why: 5, answer: 'Why was load test incomplete? (e.g. Test plan lacked rush-hour scenario)' }
    ],
    preventiveActions: [
      'Update automated test suite with regression test case',
      'Adjust alert thresholds in Prometheus / Render metrics',
      'Document revised operational boundary in runbook'
    ]
  };
}

// ─── CLI EXECUTION ───────────────────────────────────────────────────────────

function runCli() {
  const args = process.argv.slice(2);
  console.log('================================================================');
  console.log(' ZAMORIN CAFÉ ERP — INCIDENT RESPONSE & TRIAGE CLI');
  console.log('================================================================');

  const isClassify = args.includes('--classify');
  const scenarioIndex = args.indexOf('--scenario');
  const isPostMortem = args.includes('--post-mortem');

  if (isClassify || args.length === 0) {
    const scopeIndex = args.indexOf('--scope');
    const impactIndex = args.indexOf('--impact');
    const scope = scopeIndex !== -1 ? args[scopeIndex + 1] : 'all';
    const impact = impactIndex !== -1 ? args[impactIndex + 1] : 'outage';

    const classification = classifyIncident({ scope, impact });
    console.log(`\nINCIDENT CLASSIFICATION RESULT:`);
    console.log(`- Severity: ${classification.severity}`);
    console.log(`- Response SLA: <= ${classification.responseSlaMinutes} minutes`);
    console.log(`- Resolution Target: <= ${classification.resolutionSlaHours} hours`);
    console.log(`- Description: ${classification.description}`);
    console.log(`- Executive Update Frequency: Every ${classification.updateFrequencyMinutes} minutes`);
    console.log('\n9-Stage Incident Response Workflow:');
    INCIDENT_LIFECYCLE_STAGES.forEach(s => console.log(`  [Stage ${s.stage}] ${s.name}: ${s.action}`));
  }

  if (scenarioIndex !== -1) {
    const scenarioKey = args[scenarioIndex + 1];
    const deviceIndex = args.indexOf('--device-id');
    const deviceId = deviceIndex !== -1 ? args[deviceIndex + 1] : 'DEV-TILL-01';
    const runbook = getScenarioRunbook(scenarioKey, { deviceId });

    console.log(`\nSCENARIO RUNBOOK: ${runbook.scenario} (${runbook.severity})`);
    console.log('Immediate Containment Actions:');
    runbook.immediateActions.forEach(a => console.log(`  ${a}`));
    console.log('\nContainment Payload:', JSON.stringify(runbook.containmentPayload, null, 2));
  }

  if (isPostMortem) {
    const idIndex = args.indexOf('--incident-id');
    const incidentId = idIndex !== -1 ? args[idIndex + 1] : 'INC-2026-001';
    const pm = generatePostMortemTemplate({ incidentId });
    console.log(`\nPOST-MORTEM TEMPLATE GENERATED FOR ${incidentId}:`);
    console.log(JSON.stringify(pm, null, 2));
  }

  console.log('\n[OK] Incident triage execution complete.');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  try {
    runCli();
  } catch (err) {
    console.error('Incident triage CLI error:', err.message);
    process.exit(1);
  }
}
