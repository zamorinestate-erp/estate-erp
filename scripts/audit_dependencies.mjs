#!/usr/bin/env node
/**
 * Zamorin Café ERP — Executable Dependency Security & Vulnerability Auditor
 *
 * Runs non-destructive npm audit, parses JSON findings, enforces security thresholds,
 * and outputs machine-readable vulnerability reports.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

export function runDependencyAudit({ failOn = 'high' } = {}) {
  let auditOutput = '';
  try {
    auditOutput = execSync('npm audit --json', {
      cwd: backendDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    auditOutput = err.stdout ? String(err.stdout) : '';
  }

  let auditJson = null;
  try {
    auditJson = JSON.parse(auditOutput);
  } catch (err) {
    return {
      success: false,
      error: 'Failed to parse npm audit output as JSON',
      raw: auditOutput.slice(0, 500),
    };
  }

  const metadata = auditJson.metadata || {};
  const vulnerabilities = metadata.vulnerabilities || {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };

  const report = {
    timestamp: new Date().toISOString(),
    tool: 'zamorin-dependency-auditor',
    target: 'backend',
    vulnerabilities,
    dependencies: metadata.dependencies || {},
    advisories: Object.keys(auditJson.advisories || auditJson.vulnerabilities || {}).map((id) => {
      const adv = (auditJson.advisories || auditJson.vulnerabilities)[id];
      return {
        id,
        name: adv.name || adv.module_name,
        severity: adv.severity,
        title: adv.title || adv.overview,
        range: adv.range || adv.vulnerable_versions,
      };
    }),
    threshold: failOn,
    passed: false,
  };

  const hasCritical = vulnerabilities.critical > 0;
  const hasHigh = vulnerabilities.high > 0;

  if (failOn === 'critical') {
    report.passed = !hasCritical;
  } else if (failOn === 'high') {
    report.passed = !hasCritical && !hasHigh;
  } else {
    report.passed = !hasCritical && !hasHigh;
  }

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runDependencyAudit();
  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) {
    console.error(`\n[SECURITY GATE FAILED] Vulnerabilities exceed allowed threshold.`);
    process.exit(1);
  } else {
    console.log(`\n[SECURITY GATE PASSED] 0 Critical, 0 High vulnerabilities detected.`);
  }
}
