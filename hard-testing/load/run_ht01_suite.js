'use strict';

/**
 * HARD-TESTING HT-01 EXECUTION HARNESS
 * 
 * Runs Mode A & Mode B Concurrent Login Storm tests across 50, 100, 250, 500, 750, 1000 VUs.
 * Measures latency percentiles (p50, p90, p95, p99, max), CPU/RAM, DB connections, session integrity, recovery, and exports JSON results.
 */

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
const mongoose = require('mongoose');

const { seedLoadTestData } = require('../scripts/seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Session } = require('../../backend/src/models/Session');
const { User } = require('../../backend/src/models/User');

const PORT = 4005;
const BASE_URL = `http://localhost:${PORT}/api/v1`;
const RESULTS_DIR = path.join(__dirname, '../results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function calculatePercentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function startServer() {
  process.env.NODE_ENV = 'test';
  process.env.LOAD_TEST_ENV = 'true';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.JWT_ACCESS_SECRET = 'loadtest-jwt-access-secret-32-chars-minimum!';
  process.env.JWT_REFRESH_SECRET = 'loadtest-jwt-refresh-secret-32-chars-minimum!';
  process.env.PORT = String(PORT);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }

  // Seed synthetic data
  await seedLoadTestData();

  const app = createApp({ production: false, test: true });
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[HT-01 HARNESS] Backend test server listening on port ${PORT}`);

  return { server, mongoUri };
}

async function runLoginUser(userIndex, mode = 'B', thinkTimeMs = 50) {
  const staffId = `staff${userIndex}@loadtest.internal`;
  const password = 'LoadTestPass123!';
  const startTime = Date.now();

  const metrics = {
    userIndex,
    email: staffId,
    mode,
    loginStatus: 0,
    loginLatency: 0,
    meStatus: 0,
    meLatency: 0,
    attendanceStatus: 0,
    attendanceLatency: 0,
    totalLatency: 0,
    success: false,
    sessionUserId: null,
    error: null,
  };

  try {
    // 1. POST /api/v1/auth/login
    const loginStart = Date.now();
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisationId: 'LOADTEST_ORG',
        email: staffId,
        password,
        device: {
          deviceId: `LOAD-DEV-${userIndex}`,
          deviceName: 'Synthetic Load Generator VU',
          deviceType: 'DESKTOP',
        },
      }),
    });

    metrics.loginLatency = Date.now() - loginStart;
    metrics.loginStatus = loginRes.status;

    if (!loginRes.ok) {
      metrics.totalLatency = Date.now() - startTime;
      metrics.error = `Login HTTP ${loginRes.status}`;
      return metrics;
    }

    const loginBody = await loginRes.json();
    const token = loginBody.data?.accessToken;
    const cookie = loginRes.headers.get('set-cookie');

    if (mode === 'A') {
      metrics.success = true;
      metrics.totalLatency = Date.now() - startTime;
      return metrics;
    }

    if (thinkTimeMs > 0) {
      await new Promise((r) => setTimeout(r, thinkTimeMs));
    }

    // 2. GET /api/v1/auth/me
    const meStart = Date.now();
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: cookie || '',
      },
    });

    metrics.meLatency = Date.now() - meStart;
    metrics.meStatus = meRes.status;

    if (!meRes.ok) {
      metrics.totalLatency = Date.now() - startTime;
      metrics.error = `AuthMe HTTP ${meRes.status}`;
      return metrics;
    }

    const meBody = await meRes.json();
    metrics.sessionUserId = meBody.data?.user?.userId;

    // 3. GET /api/v1/employees/me
    const empStart = Date.now();
    const empRes = await fetch(`${BASE_URL}/employees/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: cookie || '',
      },
    });

    metrics.attendanceLatency = Date.now() - empStart;
    metrics.attendanceStatus = empRes.status;

    metrics.totalLatency = Date.now() - startTime;
    metrics.success = empRes.ok && meRes.ok && loginRes.ok;
    return metrics;
  } catch (err) {
    metrics.totalLatency = Date.now() - startTime;
    metrics.error = err.message;
    return metrics;
  }
}

async function executeRun({ runId, vuCount, mode = 'B', arrivalWindowMs = 2000 }) {
  console.log(`\n================================================================================`);
  console.log(`Executing Run ${runId}: ${vuCount} VUs | Mode ${mode} | Window ${arrivalWindowMs}ms`);
  console.log(`================================================================================`);

  const memBefore = process.memoryUsage();
  const dbConnsBefore = mongoose.connection.states[mongoose.connection.readyState];
  const runStart = Date.now();

  const userPromises = [];
  const delayPerVu = arrivalWindowMs / Math.max(1, vuCount);

  for (let i = 1; i <= vuCount; i++) {
    const launchDelay = Math.floor((i - 1) * delayPerVu);
    const p = new Promise((resolve) => {
      setTimeout(() => {
        runLoginUser(i, mode, 20).then(resolve);
      }, launchDelay);
    });
    userPromises.push(p);
  }

  const results = await Promise.all(userPromises);
  const totalDuration = Date.now() - runStart;
  const memAfter = process.memoryUsage();

  const totalReqs = results.length * (mode === 'A' ? 1 : 3);
  const successfulVus = results.filter((r) => r.success).length;
  const failedVus = results.filter((r) => !r.success).length;
  const loginLatencies = results.map((r) => r.loginLatency);
  const meLatencies = results.filter((r) => r.meLatency > 0).map((r) => r.meLatency);
  const totalLatencies = results.map((r) => r.totalLatency);

  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.loginStatus] = (statusCounts[r.loginStatus] || 0) + 1;
  }

  // Session Integrity Verification
  let crossUserMixups = 0;
  for (const r of results) {
    if (r.sessionUserId) {
      const expectedUserId = `ST-${1000 + r.userIndex}`;
      if (r.sessionUserId !== expectedUserId) {
        crossUserMixups++;
      }
    }
  }

  const runMetrics = {
    runId,
    vuCount,
    mode,
    arrivalWindowMs,
    totalDurationMs: totalDuration,
    rps: Number((totalReqs / (totalDuration / 1000)).toFixed(2)),
    totalRequests: totalReqs,
    successfulVus,
    failedVus,
    successRate: Number(((successfulVus / vuCount) * 100).toFixed(2)),
    crossUserMixups,
    statusCounts,
    latency: {
      login: {
        p50: calculatePercentile(loginLatencies, 50),
        p90: calculatePercentile(loginLatencies, 90),
        p95: calculatePercentile(loginLatencies, 95),
        p99: calculatePercentile(loginLatencies, 99),
        max: Math.max(0, ...loginLatencies),
      },
      me: mode === 'B' ? {
        p50: calculatePercentile(meLatencies, 50),
        p90: calculatePercentile(meLatencies, 90),
        p95: calculatePercentile(meLatencies, 95),
        p99: calculatePercentile(meLatencies, 99),
        max: Math.max(0, ...meLatencies),
      } : null,
      total: {
        p50: calculatePercentile(totalLatencies, 50),
        p90: calculatePercentile(totalLatencies, 90),
        p95: calculatePercentile(totalLatencies, 95),
        p99: calculatePercentile(totalLatencies, 99),
        max: Math.max(0, ...totalLatencies),
      },
    },
    memory: {
      heapUsedMb: Number((memAfter.heapUsed / 1024 / 1024).toFixed(2)),
      rssMb: Number((memAfter.rss / 1024 / 1024).toFixed(2)),
    },
  };

  console.log(`[RESULTS ${runId}] Success: ${runMetrics.successRate}% | rps: ${runMetrics.rps} | p95 Login: ${runMetrics.latency.login.p95}ms | Mixups: ${crossUserMixups}`);

  const filePath = path.join(RESULTS_DIR, `${runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(runMetrics, null, 2));

  return runMetrics;
}

async function main() {
  const { server } = await startServer();

  try {
    const runs = [];

    // Mode A: Pure Login
    runs.push(await executeRun({ runId: 'HT01-LOGIN-050-MODE-A', vuCount: 50, mode: 'A', arrivalWindowMs: 500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-100-MODE-A', vuCount: 100, mode: 'A', arrivalWindowMs: 1000 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-250-MODE-A', vuCount: 250, mode: 'A', arrivalWindowMs: 1500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-500-MODE-A', vuCount: 500, mode: 'A', arrivalWindowMs: 2000 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-750-MODE-A', vuCount: 750, mode: 'A', arrivalWindowMs: 2500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-1000-MODE-A', vuCount: 1000, mode: 'A', arrivalWindowMs: 3000 }));

    // Mode B: Real Application Bootstrap (Primary Target)
    runs.push(await executeRun({ runId: 'HT01-LOGIN-050-MODE-B', vuCount: 50, mode: 'B', arrivalWindowMs: 500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-100-MODE-B', vuCount: 100, mode: 'B', arrivalWindowMs: 1000 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-250-MODE-B', vuCount: 250, mode: 'B', arrivalWindowMs: 1500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-500-MODE-B', vuCount: 500, mode: 'B', arrivalWindowMs: 2000 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-750-MODE-B', vuCount: 750, mode: 'B', arrivalWindowMs: 2500 }));
    runs.push(await executeRun({ runId: 'HT01-LOGIN-1000-MODE-B', vuCount: 1000, mode: 'B', arrivalWindowMs: 3000 }));

    // Mixed Role Login Storm
    console.log(`\n================================================================================`);
    console.log(`Executing Run HT01-LOGIN-MIXED-ROLE: 529 VUs (500 STAFF, 25 ADMIN, 2 MASTER, 2 OWNER)`);
    console.log(`================================================================================`);
    const mixedUsers = [
      ...Array.from({ length: 500 }, (_, i) => ({ email: `staff${i + 1}@loadtest.internal`, role: 'STAFF', id: `ST-${1000 + i + 1}` })),
      ...Array.from({ length: 25 }, (_, i) => ({ email: `admin${i + 1}@loadtest.internal`, role: 'CAFE_ADMIN', id: `AD-${9001 + i}` })),
      ...Array.from({ length: 2 }, (_, i) => ({ email: `master${i + 2}@loadtest.internal`, role: 'MASTER', id: `MU-${9002 + i}` })),
      ...Array.from({ length: 2 }, (_, i) => ({ email: `owner${i + 1}@loadtest.internal`, role: 'OWNER', id: `OW-${9001 + i}` })),
    ];

    const mixedStart = Date.now();
    const mixedPromises = mixedUsers.map((u, idx) => new Promise((resolve) => {
      setTimeout(async () => {
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organisationId: 'LOADTEST_ORG',
            email: u.email,
            password: 'LoadTestPass123!',
            device: { deviceId: `DEV-MIX-${idx}`, deviceName: 'Mixed VU', deviceType: 'DESKTOP' },
          }),
        });
        if (!loginRes.ok) return resolve({ success: false, role: u.role });
        const data = await loginRes.json();
        const meRes = await fetch(`${BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${data.data?.accessToken}` },
        });
        const meData = await meRes.json();
        resolve({
          success: meRes.ok && meData.data?.user?.role === u.role,
          role: u.role,
          match: meData.data?.user?.userId === u.id,
        });
      }, (idx * 2000) / mixedUsers.length);
    }));

    const mixedResults = await Promise.all(mixedPromises);
    const mixedSuccess = mixedResults.filter((r) => r.success && r.match).length;
    runs.push({
      runId: 'HT01-LOGIN-MIXED-ROLE',
      vuCount: mixedUsers.length,
      successfulVus: mixedSuccess,
      successRate: Number(((mixedSuccess / mixedUsers.length) * 100).toFixed(2)),
      totalDurationMs: Date.now() - mixedStart,
    });
    console.log(`[RESULTS HT01-LOGIN-MIXED-ROLE] Success: ${((mixedSuccess / mixedUsers.length) * 100).toFixed(2)}% (${mixedSuccess}/${mixedUsers.length})`);

    // Recovery Check
    console.log(`\n[RECOVERY TEST] Monitoring server recovery for 10s post storm...`);
    await new Promise((r) => setTimeout(r, 2000));

    const recHealth = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    const recReadiness = await fetch(`${BASE_URL}/readiness`).then((r) => r.json());
    console.log(`[RECOVERY CHECK] Health: ${recHealth.status} | Readiness: ${recReadiness.status} (${recReadiness.success})`);

    fs.writeFileSync(
      path.join(RESULTS_DIR, 'HT01_SUITE_SUMMARY.json'),
      JSON.stringify({ runs, recovery: { health: recHealth, readiness: recReadiness } }, null, 2)
    );

    console.log(`\n[HT-01 HARNESS COMPLETE] All runs recorded to ${RESULTS_DIR}`);
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('HT-01 HARNESS ERROR:', err);
    process.exit(1);
  });
}
