'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 2000;
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { seedLoadTestData, resetLoadTestData } = require('../scripts/seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Bill } = require('../../backend/src/models/Bill');
const { Expense } = require('../../backend/src/models/Expense');
const { CashTransaction } = require('../../backend/src/models/CashTransaction');
const { MenuItem } = require('../../backend/src/models/MenuItem');
const { User } = require('../../backend/src/models/User');
const { Session } = require('../../backend/src/models/Session');

const BASE_PORT = 4600;
const WORKER_COUNT = 4;
const RESULTS_DIR = path.join(__dirname, '../results');

// HT-06 parameters
const SOAK_VUS = 100;
const SOAK_DURATION_MS = 10 * 60 * 1000; // 10 minutes (sufficient for local leak detection)
const SAMPLE_INTERVAL_MS = 30 * 1000;    // sample every 30 seconds

function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getMemorySnapshot(label) {
  const mem = process.memoryUsage();
  return {
    label,
    timestamp: new Date().toISOString(),
    rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
    heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
    heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
    externalMb: Number((mem.external / (1024 * 1024)).toFixed(2)),
  };
}

async function getDbConnections() {
  try {
    const admin = mongoose.connection.db.admin();
    const status = await admin.serverStatus();
    return status.connections?.current ?? 0;
  } catch {
    return mongoose.connection.pool?.totalConnectionCount ?? 0;
  }
}

async function startCluster() {
  const instances = [];
  // Build allowed origins list for all worker ports — both CORS and CSRF middleware read environment.allowedOrigins
  const allowedOrigins = Array.from({ length: WORKER_COUNT }, (_, i) => `http://127.0.0.1:${BASE_PORT + i}`);
  for (let i = 0; i < WORKER_COUNT; i++) {
    const port = BASE_PORT + i;
    const app = createApp({ production: false, test: true, allowedOrigins });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    instances.push({ port, server, url: `http://127.0.0.1:${port}/api/v1` });
  }
  return instances;
}

async function prewarmSessions() {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const allUsers = await User.find({ organisationId: 'LOADTEST_ORG' }).lean();
  const sessionDocs = [];
  const sessionsByRole = { STAFF: [], CAFE_ADMIN: [], OWNER: [], MASTER: [] };

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sessionId = `SS-${dateStamp}-${String(10000 + i)}`;
    const accessToken = jwt.sign(
      { sub: user.userId, sid: sessionId, org: user.organisationId, role: user.role, cafes: user.assignedCafeIds, sv: 0, usv: user.sessionVersion || 0, pv: user.permissionsVersion || 0, type: 'access' },
      secret, { algorithm: 'HS256', expiresIn: '3h', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
    );
    sessionDocs.push({
      sessionId, organisationId: user.organisationId, userId: user.userId,
      roleSnapshot: user.role, assignedCafeIdsSnapshot: user.assignedCafeIds,
      tokenFamilyId: `FAM-HT06-${i}`, accessTokenHash: 'HT06_HASH', refreshTokenHash: 'HT06_HASH',
      sessionVersion: 0, userSessionVersionSnapshot: 0, permissionsVersionSnapshot: 0, status: 'ACTIVE',
      device: { deviceId: `DEV-HT06-${i}`, deviceName: 'Soak', deviceType: 'DESKTOP' },
      issuedAt: now, lastActivityAt: now, mfaVerified: true, mfaVerifiedAt: now, stepUpVerifiedAt: now,
      accessTokenExpiresAt: expiresAt, refreshTokenExpiresAt: absoluteExpiresAt, absoluteExpiresAt,
      idleTimeoutMinutes: 180, createdBy: user.userId,
    });
    const cookieHeader = `zamorin_access_token=${accessToken}; zamorin_session_id=${sessionId}`;
    const cafeId = user.assignedCafeIds?.[0] || 'CF-LOAD-0001';
    if (sessionsByRole[user.role]) {
      sessionsByRole[user.role].push({ userId: user.userId, email: user.email, role: user.role, cookieHeader, cafeId });
    }
  }

  await Session.deleteMany({ organisationId: 'LOADTEST_ORG' });
  await Session.insertMany(sessionDocs);
  return sessionsByRole;
}

// Execute one wave of mixed workload at SOAK_VUS
async function executeSoakWave(instances, sessionsByRole, menuItems, waveNum) {
  const tasks = [];
  const startTime = Date.now();

  for (let i = 0; i < SOAK_VUS; i++) {
    const target = instances[i % instances.length];
    const mix = i % 10;
    let taskPromise;

    if (mix < 4) {
      // 40% Staff self-service
      const u = sessionsByRole.STAFF[i % sessionsByRole.STAFF.length];
      taskPromise = fetch(`${target.url}/attendance/me/today`, { headers: { Cookie: u.cookieHeader } })
        .then(r => ({ status: r.status, ok: r.status === 200, latency: Date.now() - startTime, type: 'STAFF_SELF' }))
        .catch(e => ({ status: 500, ok: false, latency: Date.now() - startTime, type: 'STAFF_SELF', error: e.message }));
    } else if (mix < 7) {
      // 30% POS billing
      const u = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
      const item = menuItems[i % menuItems.length];
      taskPromise = fetch(`${target.url}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: u.cookieHeader, Origin: target.url.replace('/api/v1', '') },
        body: JSON.stringify({ cafeId: u.cafeId, orderType: 'DINE_IN', tableNumber: `T-${i}`, lineItems: [{ menuItemId: item.menuItemId, quantity: 1 }], paymentMethod: i % 2 === 0 ? 'CASH' : 'UPI', isImmediateCompletion: true }),
      }).then(r => ({ status: r.status, ok: r.status === 201, latency: Date.now() - startTime, type: 'POS_BILL' }))
        .catch(e => ({ status: 500, ok: false, latency: Date.now() - startTime, type: 'POS_BILL', error: e.message }));
    } else if (mix < 9) {
      // 20% menu reads
      const u = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
      taskPromise = fetch(`${target.url}/menu/items`, { headers: { Cookie: u.cookieHeader } })
        .then(r => ({ status: r.status, ok: r.status === 200, latency: Date.now() - startTime, type: 'MENU_READ' }))
        .catch(e => ({ status: 500, ok: false, latency: Date.now() - startTime, type: 'MENU_READ', error: e.message }));
    } else {
      // 10% expense submissions
      const u = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
      taskPromise = fetch(`${target.url}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: u.cookieHeader, Origin: target.url.replace('/api/v1', '') },
        body: JSON.stringify({ cafeId: u.cafeId, category: 'DAIRY_MILK', amount: 200 + waveNum, description: `Soak expense W${waveNum}` }),
      }).then(r => ({ status: r.status, ok: r.status === 201, latency: Date.now() - startTime, type: 'EXPENSE' }))
        .catch(e => ({ status: 500, ok: false, latency: Date.now() - startTime, type: 'EXPENSE', error: e.message }));
    }
    tasks.push(taskPromise);
  }

  return Promise.all(tasks);
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '100000';
  // Allow all test server ports for CORS/CSRF checks on mutating requests
  process.env.ALLOWED_ORIGINS = Array.from({ length: WORKER_COUNT }, (_, i) => `http://127.0.0.1:${BASE_PORT + i}`).join(',');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 200, minPoolSize: 50 });

  await resetLoadTestData();
  await seedLoadTestData();

  const instances = await startCluster();
  const sessionsByRole = await prewarmSessions();
  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();

  console.log(`\n================================================================================`);
  console.log(`ZAMORIN CAFE ERP — HT-06 SOAK / ENDURANCE TEST (${SOAK_VUS} VUs, ${SOAK_DURATION_MS / 60000} min)`);
  console.log(`================================================================================`);

  const memSnapshots = [];
  const dbSnapshots = [];
  const waveResults = [];

  const startMem = getMemorySnapshot('START');
  const startDbConn = await getDbConnections();
  memSnapshots.push(startMem);
  dbSnapshots.push({ label: 'START', connections: startDbConn, timestamp: new Date().toISOString() });

  console.log(`[HT-06 START] RSS: ${startMem.rssMb}MB | Heap: ${startMem.heapUsedMb}MB | DB Conn: ${startDbConn}`);

  const soakStartTime = Date.now();
  let waveNum = 0;
  let totalRequests = 0;
  let totalSuccess = 0;
  let total5xx = 0;
  let lastSampleTime = soakStartTime;

  while (Date.now() - soakStartTime < SOAK_DURATION_MS) {
    waveNum++;
    const results = await executeSoakWave(instances, sessionsByRole, menuItems, waveNum);
    totalRequests += results.length;
    totalSuccess += results.filter(r => r.ok).length;
    total5xx += results.filter(r => r.status >= 500).length;
    waveResults.push({
      wave: waveNum,
      total: results.length,
      success: results.filter(r => r.ok).length,
      errors: results.filter(r => !r.ok).length,
      p95: calculatePercentile(results.map(r => r.latency), 95),
    });

    // Periodic snapshots
    if (Date.now() - lastSampleTime >= SAMPLE_INTERVAL_MS) {
      const snap = getMemorySnapshot(`WAVE_${waveNum}`);
      const dbConn = await getDbConnections();
      memSnapshots.push(snap);
      dbSnapshots.push({ label: `WAVE_${waveNum}`, connections: dbConn, timestamp: new Date().toISOString() });
      const elapsed = Math.round((Date.now() - soakStartTime) / 1000);
      console.log(`[${elapsed}s] Wave ${waveNum} | Success: ${results.filter(r => r.ok).length}/${results.length} | RSS: ${snap.rssMb}MB | Heap: ${snap.heapUsedMb}MB | DB Conn: ${dbConn}`);
      lastSampleTime = Date.now();
    }

    // Small gap between waves to simulate realistic think time
    await new Promise(r => setTimeout(r, 200));
  }

  // Final snapshot
  await new Promise(r => setTimeout(r, 5000)); // wait for GC
  const endMem = getMemorySnapshot('END');
  const endDbConn = await getDbConnections();
  memSnapshots.push(endMem);
  dbSnapshots.push({ label: 'END', connections: endDbConn, timestamp: new Date().toISOString() });

  // Assess leak: check if RSS grew more than 100MB from start to end
  const rssGrowthMb = endMem.rssMb - startMem.rssMb;
  const heapGrowthMb = endMem.heapUsedMb - startMem.heapUsedMb;
  const dbConnGrowth = endDbConn - startDbConn;
  const memoryLeakIndication = rssGrowthMb > 100 || heapGrowthMb > 80;
  const connectionLeakIndication = dbConnGrowth > 10;

  // Financial reconciliation
  const cashBills = await Bill.find({ organisationId: 'LOADTEST_ORG', paymentMethod: 'CASH', status: 'COMPLETED' }).lean();
  let expectedCashPaisa = 0;
  for (const b of cashBills) expectedCashPaisa += b.totalPaisa;
  const allCashTxs = await CashTransaction.find({ organisationId: 'LOADTEST_ORG', category: 'POS_SALE' }).lean();
  let actualCashBookPaisa = 0;
  for (const tx of allCashTxs) actualCashBookPaisa += Math.round(tx.amount * 100);
  const varianceRupees = ((expectedCashPaisa - actualCashBookPaisa) / 100).toFixed(2);

  const successRate = Number(((totalSuccess / totalRequests) * 100).toFixed(2));
  const status = successRate >= 99.0 && !memoryLeakIndication && !connectionLeakIndication ? 'PASS' : 'FAIL';

  console.log(`\n================================================================================`);
  console.log(`HT-06 SOAK TEST COMPLETE`);
  console.log(`================================================================================`);
  console.log(`Total Waves:          ${waveNum}`);
  console.log(`Total Requests:       ${totalRequests}`);
  console.log(`Success Rate:         ${successRate}% (${totalSuccess}/${totalRequests})`);
  console.log(`5xx Errors:           ${total5xx}`);
  console.log(`Memory RSS Start:     ${startMem.rssMb}MB  → End: ${endMem.rssMb}MB (Growth: ${rssGrowthMb.toFixed(2)}MB)`);
  console.log(`Heap Used Start:      ${startMem.heapUsedMb}MB → End: ${endMem.heapUsedMb}MB (Growth: ${heapGrowthMb.toFixed(2)}MB)`);
  console.log(`DB Connections Start: ${startDbConn} → End: ${endDbConn} (Growth: ${dbConnGrowth})`);
  console.log(`Memory Leak:          ${memoryLeakIndication ? 'INDICATION' : 'NONE'}`);
  console.log(`Connection Leak:      ${connectionLeakIndication ? 'INDICATION' : 'NONE'}`);
  console.log(`Financial Variance:   ₹${varianceRupees}`);
  console.log(`STATUS:               ${status}`);

  for (const inst of instances) inst.server.close();
  await mongoose.disconnect();

  const report = {
    durationMinutes: SOAK_DURATION_MS / 60000, soakVUs: SOAK_VUS, totalWaves: waveNum,
    totalRequests, totalSuccess, total5xx, successRate, status,
    memoryLeakIndication, connectionLeakIndication,
    rssGrowthMb: Number(rssGrowthMb.toFixed(2)),
    heapGrowthMb: Number(heapGrowthMb.toFixed(2)),
    dbConnGrowth, varianceRupees,
    memSnapshots, dbSnapshots, waveResults,
  };

  fs.writeFileSync(path.join(RESULTS_DIR, 'HT06_SOAK_TEST_RESULTS.json'), JSON.stringify(report, null, 2));
  console.log(`\n[HT-06 COMPLETE] Results saved.`);
  process.exit(0);
}

main().catch(err => { console.error('[HT-06 FATAL]', err); mongoose.disconnect(); process.exit(1); });
