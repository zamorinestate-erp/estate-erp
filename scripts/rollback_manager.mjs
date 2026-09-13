#!/usr/bin/env node
/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OPERATIONAL ROLLBACK MANAGER CLI
 * ============================================================================
 * Converts ZAMORIN_VERCEL_ROLLBACK_RUNBOOK.md and
 * ZAMORIN_RENDER_ROLLBACK_RUNBOOK.md into an executable, automated utility.
 *
 * Supported Operations:
 * 1. Database compatibility classification (ROLLBACK_SAFE, ROLLBACK_REQUIRES_MIGRATION, ROLLBACK_UNSAFE)
 * 2. Vercel instant edge rollback generator & verification (RTO <= 30s, RPO 0)
 * 3. Render backend rollback coordinator & health probe watcher (RTO <= 3m, Blue/Green zero downtime)
 * 4. Post-rollback health & correlation-ID validation probes
 *
 * Usage:
 *   node scripts/rollback_manager.mjs --assess-db
 *   node scripts/rollback_manager.mjs --platform vercel --dry-run
 *   node scripts/rollback_manager.mjs --platform render --dry-run
 *   node scripts/rollback_manager.mjs --verify-health --url http://127.0.0.1:4000
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

const PLATFORMS = ['vercel', 'render', 'all'];

export const DB_COMPATIBILITY_STATUSES = {
  ROLLBACK_SAFE: {
    code: 'ROLLBACK_SAFE',
    actionPermitted: true,
    description: 'No breaking schema changes, added fields are optional with defaults. Safe for instant rollback.'
  },
  ROLLBACK_REQUIRES_MIGRATION: {
    code: 'ROLLBACK_REQUIRES_MIGRATION',
    actionPermitted: 'CONDITIONAL',
    description: 'New required fields or structural transforms exist. Requires downward migration before rollback.'
  },
  ROLLBACK_UNSAFE: {
    code: 'ROLLBACK_UNSAFE',
    actionPermitted: false,
    description: 'Destructive alterations or dropped indexes. Fix-forward strategy required.'
  }
};

/**
 * Inspects Mongoose models in backend/src/models to determine database rollback safety.
 */
export function assessDatabaseRollbackSafety(modelsDir = path.resolve('backend/src/models')) {
  if (!fs.existsSync(modelsDir)) {
    return {
      status: DB_COMPATIBILITY_STATUSES.ROLLBACK_SAFE.code,
      reason: 'No local models directory found; standard safe default assumed',
      details: []
    };
  }

  const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
  const details = [];
  let requiresMigration = false;
  let unsafe = false;

  for (const file of modelFiles) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    // Check for destructive indicators
    if (content.includes('// BREAKING_MIGRATION_REQUIRED')) {
      requiresMigration = true;
      details.push({ file, flag: 'REQUIRES_MIGRATION' });
    }
    if (content.includes('// DESTRUCTIVE_SCHEMA_CHANGE')) {
      unsafe = true;
      details.push({ file, flag: 'DESTRUCTIVE_UNSAFE' });
    }
  }

  let resolvedStatus = DB_COMPATIBILITY_STATUSES.ROLLBACK_SAFE;
  if (unsafe) {
    resolvedStatus = DB_COMPATIBILITY_STATUSES.ROLLBACK_UNSAFE;
  } else if (requiresMigration) {
    resolvedStatus = DB_COMPATIBILITY_STATUSES.ROLLBACK_REQUIRES_MIGRATION;
  }

  return {
    status: resolvedStatus.code,
    actionPermitted: resolvedStatus.actionPermitted,
    description: resolvedStatus.description,
    scannedModelsCount: modelFiles.length,
    details
  };
}

/**
 * Builds Vercel rollback plan and CLI commands.
 */
export function buildVercelRollbackPlan({ targetDeploymentId = 'previous-known-good', domain = 'zamorin.cafe' } = {}) {
  return {
    platform: 'vercel',
    targetRTO: '<= 30 seconds',
    targetRPO: 0,
    domain,
    targetDeploymentId,
    steps: [
      {
        step: 1,
        name: 'List Deployments',
        command: 'npx vercel ls',
        purpose: 'Identify healthy target deployment SHA/ID'
      },
      {
        step: 2,
        name: 'Inspect Deployment',
        command: `npx vercel inspect ${targetDeploymentId}`,
        purpose: 'Verify deployment state is READY'
      },
      {
        step: 3,
        name: 'Repoint Production Alias (Instant Edge Rollback)',
        command: `npx vercel alias set ${targetDeploymentId} ${domain}`,
        purpose: 'Instant DNS and Edge routing repointing'
      }
    ],
    abortConditions: [
      'Rolled-back frontend triggers 401 loop due to token schema change',
      'Previous frontend expects deprecated/removed backend endpoints',
      'Browser cache or service-worker conflict causes widespread blank screen'
    ]
  };
}

/**
 * Builds Render rollback plan and API trigger specifications.
 */
export function buildRenderRollbackPlan({
  serviceId = process.env.RENDER_SERVICE_ID || 'srv-zamorin-erp-backend',
  targetDeployId = process.env.RENDER_PREVIOUS_DEPLOY_ID || 'dep-known-good'
} = {}) {
  return {
    platform: 'render',
    targetRTO: '<= 3 minutes',
    targetRPO: 0,
    strategy: 'Blue/Green zero-downtime container swap',
    serviceId,
    targetDeployId,
    apiEndpoint: `https://api.render.com/v1/services/${serviceId}/deploys/${targetDeployId}/rollback`,
    curlCommand: `curl -X POST "https://api.render.com/v1/services/${serviceId}/deploys/${targetDeployId}/rollback" -H "Authorization: Bearer \${RENDER_API_KEY}" -H "Accept: application/json"`,
    healthEndpoints: [
      '/health',
      '/api/v1/readiness'
    ],
    postChecks: [
      'Liveness probe: GET /health returns 200 OK',
      'Readiness probe: GET /api/v1/readiness returns 200 OK with database: connected',
      'Header probe: x-correlation-id header is returned in response',
      'Audit probe: Smoke test login appends AuditEvent record'
    ]
  };
}

/**
 * Probes an HTTP endpoint for status and correlation ID header.
 */
export async function probeEndpoint(targetUrl) {
  return new Promise((resolve) => {
    try {
      const url = new URL(targetUrl);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.get(url, { timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            url: targetUrl,
            statusCode: res.statusCode,
            headers: res.headers,
            hasCorrelationId: Boolean(res.headers['x-correlation-id']),
            correlationId: res.headers['x-correlation-id'] || null,
            body: body.slice(0, 200),
            healthy: res.statusCode === 200
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          url: targetUrl,
          statusCode: null,
          error: err.message,
          healthy: false
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url: targetUrl,
          statusCode: 408,
          error: 'Connection timed out after 5000ms',
          healthy: false
        });
      });
    } catch (err) {
      resolve({
        url: targetUrl,
        statusCode: null,
        error: err.message,
        healthy: false
      });
    }
  });
}

// ─── CLI EXECUTION ───────────────────────────────────────────────────────────

async function runCli() {
  const args = process.argv.slice(2);
  console.log('================================================================');
  console.log(' ZAMORIN CAFÉ ERP — OPERATIONAL ROLLBACK MANAGER');
  console.log('================================================================');

  const assessDb = args.includes('--assess-db');
  const verifyHealth = args.includes('--verify-health');
  const platformIndex = args.indexOf('--platform');
  const platform = platformIndex !== -1 ? args[platformIndex + 1] : 'all';

  if (assessDb || args.length === 0) {
    console.log('\n[1/3] ASSESSING DATABASE COMPATIBILITY FOR ROLLBACK...');
    const dbAssessment = assessDatabaseRollbackSafety();
    console.log(`- Status: ${dbAssessment.status}`);
    console.log(`- Action Permitted: ${dbAssessment.actionPermitted}`);
    console.log(`- Description: ${dbAssessment.description}`);
    console.log(`- Models Scanned: ${dbAssessment.scannedModelsCount}`);
    if (dbAssessment.status === 'ROLLBACK_UNSAFE') {
      console.error('CRITICAL: Database status is ROLLBACK_UNSAFE. Immediate rollback prohibited!');
      if (!args.includes('--force')) process.exit(1);
    }
  }

  if (platform === 'vercel' || platform === 'all') {
    console.log('\n[2/3] VERCEL FRONTEND ROLLBOOK (RTO <= 30s):');
    const vercelPlan = buildVercelRollbackPlan();
    console.log(`Target RTO: ${vercelPlan.targetRTO} | Target RPO: ${vercelPlan.targetRPO}`);
    console.log('Rollback CLI steps:');
    vercelPlan.steps.forEach(s => console.log(`  [Step ${s.step}] ${s.name}: ${s.command}`));
  }

  if (platform === 'render' || platform === 'all') {
    console.log('\n[3/3] RENDER BACKEND ROLLBOOK (RTO <= 3m):');
    const renderPlan = buildRenderRollbackPlan();
    console.log(`Target RTO: ${renderPlan.targetRTO} | Strategy: ${renderPlan.strategy}`);
    console.log(`Rollback API: POST ${renderPlan.apiEndpoint}`);
    console.log('Health checks after container swap:');
    renderPlan.healthEndpoints.forEach(ep => console.log(`  - ${ep}`));
  }

  if (verifyHealth) {
    const urlIndex = args.indexOf('--url');
    const baseUrl = urlIndex !== -1 ? args[urlIndex + 1] : 'http://127.0.0.1:4000';
    console.log(`\nPROBING HEALTH ON ${baseUrl}...`);
    const liveness = await probeEndpoint(`${baseUrl}/health`);
    console.log(`- Liveness: ${liveness.statusCode} (Healthy: ${liveness.healthy}, CorrelationID: ${liveness.correlationId || 'N/A'})`);
    const readiness = await probeEndpoint(`${baseUrl}/api/v1/readiness`);
    console.log(`- Readiness: ${readiness.statusCode} (Healthy: ${readiness.healthy})`);
  }

  console.log('\n[OK] Rollback manager inspection complete.');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runCli().catch(err => {
    console.error('Rollback manager error:', err);
    process.exit(1);
  });
}
