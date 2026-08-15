'use strict';

/**
 * HT-19 — CLOUD STAGING ACCEPTANCE GATE
 *
 * Tests the application running on the actual Render + MongoDB Atlas cloud
 * infrastructure with 500+ virtual users in production-like conditions.
 *
 * Target: RENDER_API_URL environment variable (e.g. https://zamorin-cafe-erp-backend.onrender.com)
 *
 * Usage:
 *   RENDER_API_URL=https://zamorin-cafe-erp-backend.onrender.com node hard-testing/load/run_ht19_staging_gate.js
 */

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RESULTS_DIR = path.join(__dirname, '../results');
const RENDER_API_URL = (process.env.RENDER_API_URL || 'https://zamorin-cafe-erp-backend.onrender.com').replace(/\/$/, '');
const TARGET_VUS = parseInt(process.env.TARGET_VUS || '500', 10);
const RAMP_UP_STEPS = 5; // Number of ramp-up steps before peak load

// Credentials for staging (seeded via INITIAL_MASTER_* env vars on Render)
const MASTER_EMAIL = process.env.STAGING_MASTER_EMAIL || 'master@example.com';
const MASTER_PASSWORD = process.env.STAGING_MASTER_PASSWORD || 'PK@NilaVega_8427!Cedar';
const ORGANISATION_ID = process.env.STAGING_ORG_ID || 'ZAMORIN';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper (supports both http:// and https://)
// ─────────────────────────────────────────────────────────────────────────────
function makeRequest(urlStr, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      port: parsed.port || (isHttps ? 443 : 80),
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': RENDER_API_URL.replace('/api/v1', ''),
        ...options.headers,
      },
      timeout: options.timeout || 30000,
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timeout after ${reqOptions.timeout}ms`)); });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function apiGet(path, token) {
  const start = Date.now();
  try {
    const res = await makeRequest(`${RENDER_API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, latencyMs: Date.now() - start, ok: res.status >= 200 && res.status < 300, body: res.body };
  } catch (err) {
    return { status: 0, latencyMs: Date.now() - start, ok: false, error: err.message };
  }
}

async function apiPost(path, body, token) {
  const start = Date.now();
  try {
    const res = await makeRequest(`${RENDER_API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, body);
    return { status: res.status, latencyMs: Date.now() - start, ok: res.status >= 200 && res.status < 400, body: res.body };
  } catch (err) {
    return { status: 0, latencyMs: Date.now() - start, ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Health Gate (pre-flight)
// ─────────────────────────────────────────────────────────────────────────────
async function phaseHealthGate() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('HT-19 PHASE 1 — HEALTH GATE (Pre-Flight Checks)');
  console.log(`  Target: ${RENDER_API_URL}`);
  console.log('═══════════════════════════════════════════════════════════════');

  const checks = [];

  // Health check
  const healthStart = Date.now();
  const health = await apiGet('/api/v1/health');
  checks.push({
    name: 'HealthEndpoint',
    passed: health.ok,
    latencyMs: health.latencyMs,
    details: `GET /api/v1/health => HTTP ${health.status} in ${health.latencyMs}ms`,
  });

  // Readiness check
  const readiness = await apiGet('/api/v1/readiness');
  checks.push({
    name: 'ReadinessEndpoint',
    passed: readiness.ok,
    latencyMs: readiness.latencyMs,
    details: `GET /api/v1/readiness => HTTP ${readiness.status} in ${readiness.latencyMs}ms`,
  });

  // Auth endpoint reachable
  const authCheck = await apiPost('/api/v1/auth/login', {
    organisationId: ORGANISATION_ID,
    email: MASTER_EMAIL,
    password: MASTER_PASSWORD,
  });
  const authOk = authCheck.status === 200 || authCheck.status === 201;
  checks.push({
    name: 'MasterLoginReachable',
    passed: authOk,
    latencyMs: authCheck.latencyMs,
    details: `POST /api/v1/auth/login => HTTP ${authCheck.status} in ${authCheck.latencyMs}ms`,
  });

  for (const c of checks) {
    console.log(`[PHASE-1] ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details}`);
  }

  const passed = checks.filter(c => c.passed).length;
  const status = passed === checks.length ? 'PASS' : 'FAIL';
  console.log(`\n[PHASE-1 SUMMARY] ${status}: ${passed}/${checks.length}`);

  return { phase: 'Health Gate', status, checks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Concurrent Login Storm (500 VUs)
// ─────────────────────────────────────────────────────────────────────────────
async function phaseConcurrentLoginStorm(token) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`HT-19 PHASE 2 — CONCURRENT LOGIN STORM (${TARGET_VUS} VUs)`);
  console.log('═══════════════════════════════════════════════════════════════');

  const BATCH_SIZE = Math.min(50, TARGET_VUS);
  const BATCHES = Math.ceil(TARGET_VUS / BATCH_SIZE);
  const allLatencies = [];
  let successCount = 0;
  let failCount = 0;

  const credentials = { organisationId: ORGANISATION_ID, email: MASTER_EMAIL, password: MASTER_PASSWORD };

  for (let batch = 0; batch < BATCHES; batch++) {
    const batchVUs = Math.min(BATCH_SIZE, TARGET_VUS - (batch * BATCH_SIZE));
    const promises = Array.from({ length: batchVUs }, () =>
      apiPost('/api/v1/auth/login', credentials)
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      allLatencies.push(r.latencyMs);
      if (r.ok || r.status === 200 || r.status === 201) successCount++;
      else failCount++;
    }

    if (batch < BATCHES - 1) {
      process.stdout.write(`  Batch ${batch + 1}/${BATCHES} done (${successCount} ok, ${failCount} fail)\r`);
    }
  }

  allLatencies.sort((a, b) => a - b);
  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] || 0;
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
  const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] || 0;
  const successRate = (successCount / TARGET_VUS) * 100;

  const passed = successRate >= 99.5 && p95 <= 3000;
  console.log(`\n[PHASE-2] Login Storm: ${successCount}/${TARGET_VUS} success (${successRate.toFixed(1)}%)`);
  console.log(`[PHASE-2] Latency: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);
  console.log(`[PHASE-2] Threshold: success>=99.5% (${successRate >= 99.5 ? '✓' : '✗'}), p95<=3000ms (${p95 <= 3000 ? '✓' : '✗'})`);
  console.log(`[PHASE-2 SUMMARY] ${passed ? 'PASS' : 'FAIL'}`);

  return {
    phase: 'Concurrent Login Storm',
    status: passed ? 'PASS' : 'FAIL',
    successRate: successRate.toFixed(2),
    p50, p95, p99,
    successCount, failCount, totalVUs: TARGET_VUS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Mixed Workload (authenticated: health, auth/me — 500 VUs)
// ─────────────────────────────────────────────────────────────────────────────
async function phaseMixedWorkload(token) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`HT-19 PHASE 3 — MIXED AUTHENTICATED WORKLOAD (${TARGET_VUS} VUs)`);
  console.log('═══════════════════════════════════════════════════════════════');

  const BATCH_SIZE = Math.min(50, TARGET_VUS);
  const BATCHES = Math.ceil(TARGET_VUS / BATCH_SIZE);
  const allLatencies = [];
  let successCount = 0;
  let failCount = 0;

  const endpoints = [
    '/api/v1/health',
    '/api/v1/auth/me',
    '/api/v1/health',
  ];

  for (let batch = 0; batch < BATCHES; batch++) {
    const batchVUs = Math.min(BATCH_SIZE, TARGET_VUS - (batch * BATCH_SIZE));
    const promises = Array.from({ length: batchVUs }, (_, i) => {
      const endpoint = endpoints[i % endpoints.length];
      return apiGet(endpoint, token);
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      allLatencies.push(r.latencyMs);
      if (r.ok) successCount++;
      else failCount++;
    }

    if (batch < BATCHES - 1) {
      process.stdout.write(`  Batch ${batch + 1}/${BATCHES} done (${successCount} ok, ${failCount} fail)\r`);
    }
  }

  allLatencies.sort((a, b) => a - b);
  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] || 0;
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
  const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] || 0;
  const successRate = (successCount / TARGET_VUS) * 100;

  const passed = successRate >= 99.0 && p95 <= 3000;
  console.log(`\n[PHASE-3] Mixed Workload: ${successCount}/${TARGET_VUS} success (${successRate.toFixed(1)}%)`);
  console.log(`[PHASE-3] Latency: p50=${p50}ms, p95=${p95}ms, p99=${p99}ms`);
  console.log(`[PHASE-3] Threshold: success>=99.0% (${successRate >= 99.0 ? '✓' : '✗'}), p95<=3000ms (${p95 <= 3000 ? '✓' : '✗'})`);
  console.log(`[PHASE-3 SUMMARY] ${passed ? 'PASS' : 'FAIL'}`);

  return {
    phase: 'Mixed Authenticated Workload',
    status: passed ? 'PASS' : 'FAIL',
    successRate: successRate.toFixed(2),
    p50, p95, p99,
    successCount, failCount, totalVUs: TARGET_VUS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Security / Authorization Gate
// ─────────────────────────────────────────────────────────────────────────────
async function phaseSecurityGate() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('HT-19 PHASE 4 — SECURITY / AUTHORIZATION GATE');
  console.log('═══════════════════════════════════════════════════════════════');

  const attacks = [
    { name: 'NoTokenPayrollAccess', req: () => apiGet('/api/v1/payroll'), expectedStatus: 401 },
    { name: 'FakeTokenLogin', req: () => apiGet('/api/v1/auth/me', 'fake.jwt.token'), expectedStatus: 401 },
    { name: 'NoAuthExpenseCreate', req: () => apiPost('/api/v1/expenses', { amount: 100 }), expectedStatus: 401 },
    { name: 'NoAuthInventoryAccess', req: () => apiGet('/api/v1/inventory'), expectedStatus: 401 },
    { name: 'NoAuthStaffAccess', req: () => apiGet('/api/v1/users'), expectedStatus: 401 },
  ];

  const results = [];
  for (const attack of attacks) {
    const r = await attack.req();
    const passed = r.status === attack.expectedStatus;
    results.push({ name: attack.name, passed, status: r.status, expected: attack.expectedStatus, latencyMs: r.latencyMs });
    console.log(`[PHASE-4] ${passed ? '✓' : '✗'} ${attack.name}: HTTP ${r.status} (expected ${attack.expectedStatus}) in ${r.latencyMs}ms`);
  }

  const passedCount = results.filter(r => r.passed).length;
  const status = passedCount === results.length ? 'PASS' : 'FAIL';
  console.log(`\n[PHASE-4 SUMMARY] ${status}: ${passedCount}/${results.length} attacks denied`);

  return { phase: 'Security / Authorization Gate', status, checks: results };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();

  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' ZAMORIN CAFE ERP — HT-19 CLOUD STAGING ACCEPTANCE GATE');
  console.log(`  Target URL:    ${RENDER_API_URL}`);
  console.log(`  Target VUs:    ${TARGET_VUS}`);
  console.log(`  Started at:    ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════════════════════════════');

  // Phase 1: Health Gate (pre-flight)
  const healthResult = await phaseHealthGate();
  if (healthResult.status === 'FAIL') {
    console.error('\n[HT-19 ABORT] Health gate FAILED — staging server is not reachable or not seeded.');
    console.error('  Ensure Render backend is deployed and INITIAL_MASTER_* env vars are set.');
    process.exit(1);
  }

  // Get a staging auth token for authenticated test phases
  console.log('\n[HT-19] Obtaining staging auth token...');
  const loginRes = await apiPost('/api/v1/auth/login', {
    organisationId: ORGANISATION_ID,
    email: MASTER_EMAIL,
    password: MASTER_PASSWORD,
  });

  let stagingToken = null;
  if (loginRes.ok) {
    try {
      const parsed = JSON.parse(loginRes.body);
      stagingToken = parsed.data?.accessToken || parsed.accessToken || null;
      console.log(`[HT-19] Auth token obtained: ${stagingToken ? stagingToken.substring(0, 20) + '...' : 'NOT FOUND in response'}`);
    } catch {
      console.log('[HT-19] Could not parse login response body.');
    }
  } else {
    console.log(`[HT-19] WARNING: Login failed (HTTP ${loginRes.status}). Proceeding without auth token.`);
  }

  // Phase 2: Concurrent Login Storm
  const loginStormResult = await phaseConcurrentLoginStorm(stagingToken);

  // Phase 3: Mixed Workload
  const mixedWorkloadResult = await phaseMixedWorkload(stagingToken);

  // Phase 4: Security Gate
  const securityResult = await phaseSecurityGate();

  // ─── Final Verdict ───────────────────────────────────────────────────────
  const allPhases = [healthResult, loginStormResult, mixedWorkloadResult, securityResult];
  const passedPhases = allPhases.filter(p => p.status === 'PASS').length;
  const overallStatus = passedPhases === allPhases.length ? 'PASS' : 'FAIL';
  const durationMs = Date.now() - startTime;

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` HT-19 CLOUD STAGING ACCEPTANCE GATE — FINAL RESULT: ${overallStatus}`);
  console.log(`  Phases Passed: ${passedPhases}/${allPhases.length}`);
  console.log(`  Duration:      ${(durationMs / 1000).toFixed(1)}s`);
  console.log('══════════════════════════════════════════════════════════════════');

  // Save results
  const summary = {
    testId: 'HT19_CLOUD_STAGING_ACCEPTANCE_GATE',
    targetUrl: RENDER_API_URL,
    targetVUs: TARGET_VUS,
    overallStatus,
    phasesPassedCount: passedPhases,
    phasesTotalCount: allPhases.length,
    durationMs,
    executedAt: new Date().toISOString(),
    phases: allPhases,
  };

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'HT19_STAGING_ACCEPTANCE_RESULTS.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(`\n[HT-19] Results saved to hard-testing/results/HT19_STAGING_ACCEPTANCE_RESULTS.json`);

  process.exit(overallStatus === 'PASS' ? 0 : 1);
}

main().catch(err => {
  console.error('[HT-19 FATAL]', err);
  process.exit(1);
});
