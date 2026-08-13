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

function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function startMultiInstanceCluster(instanceCount = 4, basePort = 4100) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '10000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, { maxPoolSize: 50, minPoolSize: 5 });
  }

  const instances = [];
  const allowedOrigins = Array.from({ length: instanceCount }, (_, i) => `http://127.0.0.1:${basePort + i}`);

  for (let i = 0; i < instanceCount; i++) {
    const port = basePort + i;
    const app = createApp({ production: false, test: true, allowedOrigins });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    instances.push({ port, server, url: `http://127.0.0.1:${port}/api/v1` });
  }

  console.log(`[MULTI-INSTANCE CLUSTER] ${instanceCount} backend instances running on ports ${basePort} to ${basePort + instanceCount - 1}`);
  return { instances, mongoUri };
}

async function prewarmFastSessions(count = 500) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
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
      { algorithm: 'HS256', expiresIn: '15m', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
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

    activeSessions.push({ userIndex: i + 1, userId: user.userId, email: user.email, cookieHeader, cafeId });
  }

  await Session.deleteMany({ organisationId: 'LOADTEST_ORG' });
  await Session.insertMany(sessionDocs);
  return activeSessions;
}

async function runMultiInstanceTest(instanceCount, instances, sessions) {
  console.log(`\n================================================================================`);
  console.log(`TESTING 500-VU MODE B ON LOCAL CLUSTER: ${instanceCount} INSTANCES`);
  console.log(`================================================================================`);

  await Attendance.deleteMany({ organisationId: 'LOADTEST_ORG' });

  const startTime = Date.now();
  const stepPromises = sessions.map((session, idx) => new Promise((resolve) => {
    const delay = Math.floor((idx * 2000) / sessions.length);
    // Round-robin target instance
    const targetInstance = instances[idx % instances.length];

    setTimeout(async () => {
      const userStart = Date.now();

      // 1. GET /attendance/me/today
      const todayRes = await fetch(`${targetInstance.url}/attendance/me/today`, {
        headers: { Cookie: session.cookieHeader },
      });

      // 2. POST /attendance/check-in
      const clockInStart = Date.now();
      const clockInRes = await fetch(`${targetInstance.url}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          Origin: `http://127.0.0.1:${targetInstance.port}`,
        },
        body: JSON.stringify({ cafeId: session.cafeId }),
      });
      const clockInLatency = Date.now() - clockInStart;

      // 3. GET /attendance/me/today
      const verifyRes = await fetch(`${targetInstance.url}/attendance/me/today`, {
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
      });
    }, delay);
  }));

  const results = await Promise.all(stepPromises);
  const totalDurationMs = Date.now() - startTime;

  const successCount = results.filter((r) => r.success).length;
  const successRate = Number(((successCount / sessions.length) * 100).toFixed(2));
  const latencies = results.map((r) => r.clockInLatency);

  const p50 = calculatePercentile(latencies, 50);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const rps = Number(((sessions.length / (totalDurationMs / 1000))).toFixed(2));

  console.log(`[RESULTS ${instanceCount}-INSTANCES] Success: ${successRate}% (${successCount}/500) | rps: ${rps} | p95 ClockIn: ${p95}ms | p99: ${p99}ms`);

  return {
    instanceCount,
    successRate,
    successCount,
    rps,
    p50,
    p90,
    p95,
    p99,
    totalDurationMs,
  };
}

async function main() {
  process.env.NODE_ENV = 'test';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 100 });

  await seedLoadTestData();

  const sessions = await prewarmFastSessions(500);
  const clusterResults = [];

  for (const count of [2, 3, 4]) {
    const { instances } = await startMultiInstanceCluster(count, 4100 + count * 10);
    const result = await runMultiInstanceTest(count, instances, sessions);
    clusterResults.push(result);

    for (const inst of instances) {
      inst.server.close();
    }
  }

  await mongoose.disconnect();

  console.log(`\n================================================================================`);
  console.log(`MULTI-INSTANCE CLUSTER CAPACITY SUMMARY`);
  console.log(`================================================================================`);
  for (const r of clusterResults) {
    console.log(`${r.instanceCount} Instances -> Success: ${r.successRate}% | rps: ${r.rps} | p95: ${r.p95}ms | p99: ${r.p99}ms | Status: ${r.p95 <= 2000 ? 'PASS' : 'EXCEEDS SLA'}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[MULTI-INSTANCE TEST FATAL ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
