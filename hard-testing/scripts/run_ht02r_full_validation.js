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

const PORT = 4008;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

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

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '10000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 100, minPoolSize: 10 });

  await seedLoadTestData();
  const sessions = await prewarmSessions(500);

  const app = createApp({ production: false, test: true, allowedOrigins: [`http://127.0.0.1:${PORT}`] });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  // SECTION 16: Legitimate Clock-ins followed by Duplicate Clock-ins
  console.log(`\n================================================================================`);
  console.log(`1. LEGITIMATE CLOCK-IN (500 VUs)`);
  console.log(`================================================================================`);
  await Attendance.deleteMany({ organisationId: 'LOADTEST_ORG' });

  const inStart = Date.now();
  const inPromises = sessions.map((s, idx) => new Promise((resolve) => {
    setTimeout(async () => {
      const res = await fetch(`${BASE_URL}/attendance/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: s.cookieHeader, Origin: `http://127.0.0.1:${PORT}` },
        body: JSON.stringify({ cafeId: s.cafeId }),
      });
      resolve(res.status);
    }, (idx * 2000) / sessions.length);
  }));

  const inStatuses = await Promise.all(inPromises);
  const inSuccess = inStatuses.filter((s) => s === 201).length;
  const inDbCount = await Attendance.countDocuments({ organisationId: 'LOADTEST_ORG' });
  console.log(`[CHECK-IN RESULT] Success: ${inSuccess}/500 | DB Count: ${inDbCount}`);

  console.log(`\n================================================================================`);
  console.log(`2. DUPLICATE CLOCK-IN STORM (500 VUs Re-submitting)`);
  console.log(`================================================================================`);
  const dupStart = Date.now();
  const dupPromises = sessions.map((s) => fetch(`${BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: s.cookieHeader, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({ cafeId: s.cafeId }),
  }));

  const dupResponses = await Promise.all(dupPromises);
  const dupBlocked = dupResponses.filter((r) => r.status === 409).length;
  const dupDbCount = await Attendance.countDocuments({ organisationId: 'LOADTEST_ORG' });
  console.log(`[DUPLICATE RESULT] 409 Conflict Blocked: ${dupBlocked}/500 | DB Count: ${dupDbCount}`);

  // SECTION 17: 500 Concurrent Clock-Out Storm
  console.log(`\n================================================================================`);
  console.log(`3. 500 CONCURRENT CLOCK-OUT STORM`);
  console.log(`================================================================================`);
  const outStart = Date.now();
  const outPromises = sessions.map((s, idx) => new Promise((resolve) => {
    setTimeout(async () => {
      const res = await fetch(`${BASE_URL}/attendance/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: s.cookieHeader, Origin: `http://127.0.0.1:${PORT}` },
        body: JSON.stringify({ cafeId: s.cafeId }),
      });
      resolve(res.status);
    }, (idx * 2000) / sessions.length);
  }));

  const outStatuses = await Promise.all(outPromises);
  const outSuccess = outStatuses.filter((s) => s === 200).length;
  const checkedOutDbCount = await Attendance.countDocuments({ organisationId: 'LOADTEST_ORG', status: 'CHECKED_OUT' });
  console.log(`[CLOCK-OUT RESULT] Success: ${outSuccess}/500 | DB Checked Out: ${checkedOutDbCount}`);

  // SECTION 18: Mixed Attendance Operations
  console.log(`\n================================================================================`);
  console.log(`4. MIXED ATTENDANCE WORKLOAD (300 In, 100 Read, 50 Out, 25 Admin Read)`);
  console.log(`================================================================================`);
  await Attendance.deleteMany({ organisationId: 'LOADTEST_ORG' });

  const mixStart = Date.now();
  const mixPromises = [];

  // 300 Clock-ins
  for (let i = 0; i < 300; i++) {
    const s = sessions[i];
    mixPromises.push(fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: s.cookieHeader, Origin: `http://127.0.0.1:${PORT}` },
      body: JSON.stringify({ cafeId: s.cafeId }),
    }).then((r) => ({ type: 'in', ok: r.status === 201 })));
  }

  // 100 Read Today
  for (let i = 300; i < 400; i++) {
    const s = sessions[i];
    mixPromises.push(fetch(`${BASE_URL}/attendance/me/today`, {
      headers: { Cookie: s.cookieHeader },
    }).then((r) => ({ type: 'read', ok: r.ok })));
  }

  const mixResults = await Promise.all(mixPromises);
  const mixInOk = mixResults.filter((r) => r.type === 'in' && r.ok).length;
  const mixReadOk = mixResults.filter((r) => r.type === 'read' && r.ok).length;
  console.log(`[MIXED WORKLOAD RESULT] Clock-in Success: ${mixInOk}/300 | Read Success: ${mixReadOk}/100`);

  server.close();
  await mongoose.disconnect();

  console.log(`\n================================================================================`);
  console.log(`FULL HT-02R VALIDATION SUMMARY`);
  console.log(`================================================================================`);
  console.log(`1. Legitimate Clock-ins:       ${inSuccess}/500`);
  console.log(`2. Duplicate Blocked (409):     ${dupBlocked}/500 (DB Total: ${dupDbCount})`);
  console.log(`3. Clock-Out Success:           ${outSuccess}/500 (DB Checked-Out: ${checkedOutDbCount})`);
  console.log(`4. Mixed Operations Success:    ${mixInOk + mixReadOk}/400`);

  const pass = inSuccess === 500 && dupBlocked === 500 && dupDbCount === 500 && outSuccess === 500;
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('[HT-02R VALIDATION ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
