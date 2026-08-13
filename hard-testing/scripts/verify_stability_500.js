'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 2000;
const mongoose = require('mongoose');

const { seedLoadTestData } = require('./seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');
const { Session } = require('../../backend/src/models/Session');
const { User } = require('../../backend/src/models/User');

const PORT = 4007;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let uncaughtCount = 0;
let unhandledCount = 0;

process.on('uncaughtException', (err) => {
  uncaughtCount++;
  console.error('[STABILITY TEST UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason) => {
  unhandledCount++;
  console.error('[STABILITY TEST UNHANDLED REJECTION]', reason);
});

async function prewarmSessions(count = 500) {
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

async function run500Storm(runNumber, sessions) {
  console.log(`\n================================================================================`);
  console.log(`STABILITY VERIFICATION — 500 VU RUN #${runNumber}`);
  console.log(`================================================================================`);

  await Attendance.deleteMany({ organisationId: 'LOADTEST_ORG' });

  const startTime = Date.now();
  const promises = sessions.map((session, idx) => new Promise((resolve) => {
    const delay = Math.floor((idx * 2000) / sessions.length);
    setTimeout(async () => {
      const res = await fetch(`${BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          Origin: `http://127.0.0.1:${PORT}`,
        },
        body: JSON.stringify({ cafeId: session.cafeId }),
      });

      resolve({ status: res.status, ok: res.status === 201 });
    }, delay);
  }));

  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;
  const successCount = results.filter((r) => r.ok).length;
  const status5xx = results.filter((r) => r.status >= 500).length;

  const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
  const readiness = await fetch(`${BASE_URL}/readiness`).then((r) => r.json());

  console.log(`[RUN #${runNumber} SUMMARY] Duration: ${duration}ms | Success: ${successCount}/500 (${((successCount / 500) * 100).toFixed(1)}%) | 5xx Errors: ${status5xx}`);
  console.log(`[RUN #${runNumber} HEALTH] Health: ${health.status} | Readiness: ${readiness.status}`);

  return { runNumber, duration, successCount, status5xx, healthOk: health.status === 'ok', readinessOk: readiness.status === 'ready' };
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '10000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 100, minPoolSize: 10 });
  await seedLoadTestData();

  const app = createApp({ production: false, test: true, allowedOrigins: [`http://127.0.0.1:${PORT}`] });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const sessions = await prewarmSessions(500);

  const run1 = await run500Storm(1, sessions);
  const run2 = await run500Storm(2, sessions);
  const run3 = await run500Storm(3, sessions);

  console.log(`\n================================================================================`);
  console.log(`PROCESS STABILITY VERIFICATION REPORT`);
  console.log(`================================================================================`);
  console.log(`Run 1: Success ${run1.successCount}/500 | 5xx: ${run1.status5xx} | Health: ${run1.healthOk} | Readiness: ${run1.readinessOk}`);
  console.log(`Run 2: Success ${run2.successCount}/500 | 5xx: ${run2.status5xx} | Health: ${run2.healthOk} | Readiness: ${run2.readinessOk}`);
  console.log(`Run 3: Success ${run3.successCount}/500 | 5xx: ${run3.status5xx} | Health: ${run3.healthOk} | Readiness: ${run3.readinessOk}`);
  console.log(`Uncaught Exceptions: ${uncaughtCount} | Unhandled Rejections: ${unhandledCount}`);

  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

main();
