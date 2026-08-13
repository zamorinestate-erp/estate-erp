'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 2000;
const mongoose = require('mongoose');

const { seedLoadTestData } = require('../scripts/seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');
const { Session } = require('../../backend/src/models/Session');
const { User } = require('../../backend/src/models/User');

const PORT = 4006;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;
const RESULTS_DIR = path.join(__dirname, '../results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

process.on('uncaughtException', (err) => {
  console.error('[SERVER UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER UNHANDLED REJECTION]', reason);
});

async function startServer() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '10000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, { maxPoolSize: 100, minPoolSize: 10 });
  }

  await seedLoadTestData();

  const app = createApp({
    production: false,
    test: true,
    allowedOrigins: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`],
  });
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`[HT-02 HARNESS] Backend test server listening on 127.0.0.1:${PORT}`);

  return { server, mongoUri };
}

async function prewarmFastSessions(count = 500) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET;
  const activeSessions = [];

  const users = await User.find({ organisationId: 'LOADTEST_ORG', role: 'STAFF' }).limit(count).lean();

  const sessionDocs = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const sessionId = `SS-${now.toISOString().replaceAll(/[-:TZ.]/g, '').slice(0, 8)}-${String(1000 + i + 1)}`;
    const accessToken = jwt.sign(
      {
        sub: user.userId,
        sid: sessionId,
        org: user.organisationId,
        role: user.role,
        cafes: user.assignedCafeIds,
        sv: 0,
        usv: user.sessionVersion || 0,
        pv: user.permissionsVersion || 0,
        type: 'access',
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: 'zamorin-cafe-erp-api',
        audience: 'zamorin-cafe-erp',
      }
    );

    const cookieHeader = `zamorin_access_token=${accessToken}; zamorin_session_id=${sessionId}`;
    const cafeId = user.assignedCafeIds[0] || 'CF-LOAD-0001';

    sessionDocs.push({
      sessionId,
      organisationId: user.organisationId,
      userId: user.userId,
      roleSnapshot: user.role,
      assignedCafeIdsSnapshot: user.assignedCafeIds,
      tokenFamilyId: `FAM-${i + 1}`,
      accessTokenHash: 'LOADTEST_HASH',
      refreshTokenHash: 'LOADTEST_HASH',
      sessionVersion: 0,
      userSessionVersionSnapshot: user.sessionVersion || 0,
      permissionsVersionSnapshot: user.permissionsVersion || 0,
      status: 'ACTIVE',
      device: { deviceId: `DEV-${i + 1}`, deviceName: 'VU', deviceType: 'DESKTOP' },
      issuedAt: now,
      lastActivityAt: now,
      accessTokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
      idleTimeoutMinutes: 30,
      createdBy: user.userId,
    });

    activeSessions.push({
      userIndex: i + 1,
      userId: user.userId,
      email: user.email,
      cookieHeader,
      cafeId,
    });
  }

  await Session.deleteMany({ organisationId: 'LOADTEST_ORG' });
  await Session.insertMany(sessionDocs);

  return activeSessions;
}

async function executeRun({ runId, sessions, mode = 'B', arrivalWindowMs = 2000 }) {
  console.log(`\n================================================================================`);
  console.log(`Executing Run ${runId}: ${sessions.length} VUs | Mode ${mode} | Window ${arrivalWindowMs}ms`);
  console.log(`================================================================================`);

  // Clear existing attendance records for clean test run
  await Attendance.deleteMany({ organisationId: 'LOADTEST_ORG' });

  const startTime = Date.now();
  const stepPromises = sessions.map((session, idx) => new Promise((resolve) => {
    const delay = Math.floor((idx * arrivalWindowMs) / sessions.length);

    setTimeout(async () => {
      const userStart = Date.now();

      if (mode === 'A') {
        // Pure Clock-In
        const clockInRes = await fetch(`${BASE_URL}/attendance/check-in`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: session.cookieHeader,
            Origin: `http://127.0.0.1:${PORT}`,
          },
          body: JSON.stringify({ cafeId: session.cafeId }),
        });

        const userLatency = Date.now() - userStart;
        if (clockInRes.status !== 201 && idx < 5) {
          const errBody = await clockInRes.json();
          console.log(`[CHECK-IN ERROR] Status: ${clockInRes.status} | Body:`, errBody);
        }

        return resolve({
          userIndex: session.userIndex,
          success: clockInRes.status === 201,
          status: clockInRes.status,
          latency: userLatency,
          cafeId: session.cafeId,
        });
      }

      // Mode B: Full Shift-Start Flow
      // 1. GET /attendance/me/today
      const todayRes = await fetch(`${BASE_URL}/attendance/me/today`, {
        headers: { Cookie: session.cookieHeader },
      });

      // 2. POST /attendance/check-in
      const clockInStart = Date.now();
      const clockInRes = await fetch(`${BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          Origin: `http://127.0.0.1:${PORT}`,
        },
        body: JSON.stringify({ cafeId: session.cafeId }),
      });
      const clockInLatency = Date.now() - clockInStart;

      // 3. GET /attendance/me/today (Re-verify)
      const verifyRes = await fetch(`${BASE_URL}/attendance/me/today`, {
        headers: { Cookie: session.cookieHeader },
      });
      const verifyData = await verifyRes.json();

      const success = todayRes.ok && clockInRes.status === 201 && verifyRes.ok && verifyData.data?.attendance?.status === 'CHECKED_IN';

      resolve({
        userIndex: session.userIndex,
        success,
        clockInStatus: clockInRes.status,
        clockInLatency,
        totalLatency: Date.now() - userStart,
        cafeId: session.cafeId,
        attendanceId: verifyData.data?.attendance?.attendanceId,
      });
    }, delay);
  }));

  const results = await Promise.all(stepPromises);
  const totalTimeMs = Date.now() - startTime;

  const successCount = results.filter((r) => r.success).length;
  const successRate = Number(((successCount / sessions.length) * 100).toFixed(2));
  const latencies = results.map((r) => (mode === 'A' ? r.latency : r.clockInLatency));

  const p50 = calculatePercentile(latencies, 50);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const max = Math.max(...latencies, 0);

  const rps = Number(((sessions.length / (totalTimeMs / 1000))).toFixed(2));

  console.log(`[RESULTS ${runId}] Success: ${successRate}% (${successCount}/${sessions.length}) | rps: ${rps} | p95 ClockIn: ${p95}ms | p99: ${p99}ms`);

  const summary = {
    runId,
    vuCount: sessions.length,
    mode,
    arrivalWindowMs,
    totalDurationMs: totalTimeMs,
    successfulVus: successCount,
    successRate,
    rps,
    p50,
    p90,
    p95,
    p99,
    max,
  };

  fs.writeFileSync(path.join(RESULTS_DIR, `${runId}.json`), JSON.stringify({ summary, results }, null, 2));

  return summary;
}

async function main() {
  const { server } = await startServer();

  try {
    console.log(`\n[PRE-WARM] Pre-authenticating 500 Staff Virtual Users directly into MongoDB...`);
    const prewarmStart = Date.now();
    const activeSessions = await prewarmFastSessions(500);
    console.log(`[PRE-WARM COMPLETE] Authenticated ${activeSessions.length}/500 sessions in ${Date.now() - prewarmStart}ms`);

    const runs = [];

    // Mode A Clock-in Storm Runs
    runs.push(await executeRun({ runId: 'HT02-ATTEND-050-MODE-A', sessions: activeSessions.slice(0, 50), mode: 'A', arrivalWindowMs: 500 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-100-MODE-A', sessions: activeSessions.slice(0, 100), mode: 'A', arrivalWindowMs: 1000 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-250-MODE-A', sessions: activeSessions.slice(0, 250), mode: 'A', arrivalWindowMs: 1500 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-500-MODE-A', sessions: activeSessions.slice(0, 500), mode: 'A', arrivalWindowMs: 2000 }));

    // Mode B Full Application Shift-Start Flow Runs
    runs.push(await executeRun({ runId: 'HT02-ATTEND-050-MODE-B', sessions: activeSessions.slice(0, 50), mode: 'B', arrivalWindowMs: 500 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-100-MODE-B', sessions: activeSessions.slice(0, 100), mode: 'B', arrivalWindowMs: 1000 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-250-MODE-B', sessions: activeSessions.slice(0, 250), mode: 'B', arrivalWindowMs: 1500 }));
    runs.push(await executeRun({ runId: 'HT02-ATTEND-500-MODE-B', sessions: activeSessions.slice(0, 500), mode: 'B', arrivalWindowMs: 2000 }));

    // Duplicate Clock-In Prevention Storm
    console.log(`\n================================================================================`);
    console.log(`Executing Duplicate Clock-In Prevention Storm: 500 VUs re-submitting check-in...`);
    console.log(`================================================================================`);
    const dupStart = Date.now();
    const dupPromises = activeSessions.map((session) => fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: session.cookieHeader,
        Origin: `http://127.0.0.1:${PORT}`,
      },
      body: JSON.stringify({ cafeId: session.cafeId }),
    }));
    const dupResponses = await Promise.all(dupPromises);
    const dupBlocked = dupResponses.filter((r) => r.status === 409).length;
    const dbCount = await Attendance.countDocuments({ organisationId: 'LOADTEST_ORG' });

    console.log(`[DUPLICATE TEST] 409 Conflict Blocked: ${dupBlocked}/500 (${((dupBlocked / 500) * 100).toFixed(2)}%) | DB Total Records: ${dbCount}`);

    // Recovery Check
    console.log(`\n[RECOVERY TEST] Checking server health and readiness post-storm...`);
    const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
    const readiness = await fetch(`${BASE_URL}/readiness`).then((r) => r.json());
    console.log(`[RECOVERY CHECK] Health: ${health.status} | Readiness: ${readiness.status} (${readiness.success})`);

    fs.writeFileSync(
      path.join(RESULTS_DIR, 'HT02_SUITE_SUMMARY.json'),
      JSON.stringify({
        runs,
        duplicatePrevention: { attempted: 500, blocked409: dupBlocked, dbCount },
        recovery: { health, readiness },
      }, null, 2)
    );

    console.log(`\n[HT-02 HARNESS COMPLETE] All runs recorded to ${RESULTS_DIR}`);

    server.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[HT-02 FATAL ERROR]', err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
