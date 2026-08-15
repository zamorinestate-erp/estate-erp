'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 5000;
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
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');

const BASE_PORT = 4500;
const WORKER_COUNT = 4;
const RESULTS_DIR = path.join(__dirname, '../results');

function calculatePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getMemorySnapshot() {
  const mem = process.memoryUsage();
  return {
    rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
    heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
    heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
    externalMb: Number((mem.external / (1024 * 1024)).toFixed(2)),
  };
}

async function startCluster(instanceCount = WORKER_COUNT, basePort = BASE_PORT) {
  const instances = [];
  const allowedOrigins = Array.from({ length: instanceCount }, (_, i) => `http://127.0.0.1:${basePort + i}`);

  for (let i = 0; i < instanceCount; i++) {
    const port = basePort + i;
    const app = createApp({ production: false, test: true, allowedOrigins });
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    instances.push({ port, server, url: `http://127.0.0.1:${port}/api/v1` });
  }
  return instances;
}

async function prewarmMixedSessions() {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const allUsers = await User.find({ organisationId: 'LOADTEST_ORG' }).lean();
  const sessionDocs = [];
  const sessionsByRole = {
    STAFF: [],
    CAFE_ADMIN: [],
    OWNER: [],
    MASTER: [],
  };

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
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
      { algorithm: 'HS256', expiresIn: '60m', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
    );

    const cookieHeader = `zamorin_access_token=${accessToken}; zamorin_session_id=${sessionId}`;
    const cafeId = user.assignedCafeIds?.[0] || 'CF-LOAD-0001';

    sessionDocs.push({
      sessionId,
      organisationId: user.organisationId,
      userId: user.userId,
      roleSnapshot: user.role,
      assignedCafeIdsSnapshot: user.assignedCafeIds,
      tokenFamilyId: `FAM-LOAD-${i + 1}`,
      accessTokenHash: 'LOADTEST_HASH',
      refreshTokenHash: 'LOADTEST_HASH',
      sessionVersion: 0,
      userSessionVersionSnapshot: user.sessionVersion || 0,
      permissionsVersionSnapshot: user.permissionsVersion || 0,
      status: 'ACTIVE',
      device: { deviceId: `DEV-MIX-${i + 1}`, deviceName: 'VU', deviceType: 'DESKTOP' },
      issuedAt: now,
      lastActivityAt: now,
      mfaVerified: true,
      mfaVerifiedAt: now,
      stepUpVerifiedAt: now,
      accessTokenExpiresAt: expiresAt,
      refreshTokenExpiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
      idleTimeoutMinutes: 60,
      createdBy: user.userId,
    });

    const userObj = { userId: user.userId, email: user.email, role: user.role, cookieHeader, cafeId };
    if (sessionsByRole[user.role]) {
      sessionsByRole[user.role].push(userObj);
    }
  }

  await Session.deleteMany({ organisationId: 'LOADTEST_ORG' });
  await Session.insertMany(sessionDocs);
  console.log(`[PRE-WARM] Pre-warmed sessions for ${allUsers.length} mixed-role users.`);
  return sessionsByRole;
}

// Generate mixed task objects
function createMixedTasks(count, instances, sessionsByRole, menuItems) {
  const tasks = [];
  const countStaffSelf = Math.max(1, Math.round(count * 0.35));
  const countPos = Math.max(1, Math.round(count * 0.25));
  const countMenu = Math.max(1, Math.round(count * 0.10));
  const countExpense = Math.max(1, Math.round(count * 0.08));
  const countInventory = Math.max(1, Math.round(count * 0.05));
  const countAttendance = Math.max(1, Math.round(count * 0.05));
  const countReports = Math.max(1, Math.round(count * 0.04));
  const countFinance = Math.max(1, Math.round(count * 0.03));
  const countProcurement = Math.max(1, Math.round(count * 0.02));
  const countMaster = Math.max(1, Math.round(count * 0.01));
  const countOwner = Math.max(1, Math.round(count * 0.01));
  const countSecurity = Math.max(1, count - (countStaffSelf + countPos + countMenu + countExpense + countInventory + countAttendance + countReports + countFinance + countProcurement + countMaster + countOwner));

  let vuCounter = 0;

  // 1. STAFF Self-Service (35%)
  for (let i = 0; i < countStaffSelf; i++) {
    const user = sessionsByRole.STAFF[i % sessionsByRole.STAFF.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'STAFF_SELF_SERVICE',
      execute: async (target) => {
        const path = i % 2 === 0 ? '/attendance/me/today' : '/notifications';
        const res = await fetch(`${target.url}${path}`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 2. POS Billing (25%)
  for (let i = 0; i < countPos; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'POS_BILLING',
      execute: async (target) => {
        const item1 = menuItems[i % menuItems.length];
        const isCash = i % 2 === 0;
        const res = await fetch(`${target.url}/bills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader, Origin: target.url.replace('/api/v1', '') },
          body: JSON.stringify({
            cafeId: user.cafeId,
            orderType: 'DINE_IN',
            tableNumber: `T-${(i % 50) + 1}`,
            lineItems: [{ menuItemId: item1.menuItemId, quantity: 2 }],
            discountPaisa: 0,
            paymentMethod: isCash ? 'CASH' : 'UPI',
            isImmediateCompletion: true,
          }),
        });
        return { status: res.status, ok: res.status === 201 };
      },
    });
  }

  // 3. Menu Catalog (10%)
  for (let i = 0; i < countMenu; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'MENU_CATALOG',
      execute: async (target) => {
        const res = await fetch(`${target.url}/menu/items`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 4. Expense Submissions (8%)
  for (let i = 0; i < countExpense; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'EXPENSE_SUBMISSION',
      execute: async (target) => {
        const res = await fetch(`${target.url}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader, Origin: target.url.replace('/api/v1', '') },
          body: JSON.stringify({
            cafeId: user.cafeId,
            category: 'DAIRY_MILK',
            amount: 300 + (i * 2),
            description: `Spike Expense #${i + 1}`,
          }),
        });
        return { status: res.status, ok: res.status === 201 };
      },
    });
  }

  // 5. Inventory / Cafe Bills (5%)
  for (let i = 0; i < countInventory; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'INVENTORY_CASH_READ',
      execute: async (target) => {
        const res = await fetch(`${target.url}/bills?cafeId=${user.cafeId}&limit=10`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 6. Attendance Operations (5%)
  for (let i = 0; i < countAttendance; i++) {
    const user = sessionsByRole.STAFF[i % sessionsByRole.STAFF.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'ATTENDANCE_OPS',
      execute: async (target) => {
        const res = await fetch(`${target.url}/attendance/me/today`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 7. Reports & Analytics (4%)
  const reportUsers = [...sessionsByRole.OWNER, ...sessionsByRole.MASTER];
  for (let i = 0; i < countReports; i++) {
    const user = reportUsers[i % reportUsers.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'REPORTS_ANALYTICS',
      execute: async (target) => {
        const res = await fetch(`${target.url}/reports/daily-summary`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 8. Finance Reads (3%)
  for (let i = 0; i < countFinance; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'FINANCE_READS',
      execute: async (target) => {
        const res = await fetch(`${target.url}/cash-transactions?limit=10`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 9. Procurement / Vendor (2%)
  for (let i = 0; i < countProcurement; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'PROCUREMENT_READS',
      execute: async (target) => {
        const res = await fetch(`${target.url}/vendors`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 10. Master Governance (1%)
  for (let i = 0; i < countMaster; i++) {
    const user = sessionsByRole.MASTER[i % sessionsByRole.MASTER.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'MASTER_GOVERNANCE',
      execute: async (target) => {
        const res = await fetch(`${target.url}/search?q=tea`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 11. Owner Strategic (1%)
  for (let i = 0; i < countOwner; i++) {
    const user = sessionsByRole.OWNER[i % sessionsByRole.OWNER.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'OWNER_STRATEGIC',
      execute: async (target) => {
        const res = await fetch(`${target.url}/reports/daily-summary`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 12. Negative Security Attack Injections (1%)
  for (let i = 0; i < countSecurity; i++) {
    const vuIndex = vuCounter++;
    const probeType = i % 5;
    tasks.push({
      vuIndex,
      type: 'SECURITY_NEGATIVE_PROBE',
      execute: async (target) => {
        if (probeType === 0) {
          const user = sessionsByRole.OWNER[0];
          const res = await fetch(`${target.url}/personal-ledger/balance`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403 };
        } else if (probeType === 1) {
          const user = sessionsByRole.CAFE_ADMIN[0];
          const res = await fetch(`${target.url}/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader },
            body: JSON.stringify({ cafeId: 'CF-LOAD-0009', orderType: 'DINE_IN', lineItems: [] }),
          });
          return { status: res.status, ok: res.status === 403 };
        } else if (probeType === 2) {
          const user = sessionsByRole.STAFF[0];
          const res = await fetch(`${target.url}/quality/checklists`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403 };
        } else if (probeType === 3) {
          const user = sessionsByRole.STAFF[0];
          const res = await fetch(`${target.url}/users/ST-1011`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403 || res.status === 404 };
        } else {
          const user = sessionsByRole.CAFE_ADMIN[0];
          const res = await fetch(`${target.url}/expenses/EX-SAMPLE-0001/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader },
            body: JSON.stringify({ decision: 'APPROVED' }),
          });
          return { status: res.status, ok: res.status === 403 || res.status === 404 };
        }
      },
    });
  }

  return tasks;
}

// Run sudden spike workload (baseline -> spike in <= 2s -> recovery)
async function executeSpikeScenario(name, baselineVUs, spikeVUs, arrivalWindowMs = 2000, instances, sessionsByRole, menuItems) {
  console.log(`\n================================================================================`);
  console.log(`SPIKE SCENARIO: ${name} (${baselineVUs} -> ${spikeVUs} VUs over ${arrivalWindowMs}ms)`);
  console.log(`================================================================================`);

  // Window 1: Before Spike (Baseline)
  const baselineTasks = createMixedTasks(baselineVUs, instances, sessionsByRole, menuItems);
  const beforeStart = Date.now();
  const beforeResults = await Promise.all(
    baselineTasks.map((t, idx) => {
      const target = instances[idx % instances.length];
      return t.execute(target).then((r) => ({ ...r, latency: Date.now() - beforeStart }));
    })
  );

  // Window 2: Sudden Traffic Jump (Spike)
  const spikeTasks = createMixedTasks(spikeVUs, instances, sessionsByRole, menuItems);
  const spikeStart = Date.now();
  const spikePromises = spikeTasks.map((task, idx) => new Promise((resolve) => {
    const delay = Math.floor((idx * arrivalWindowMs) / spikeTasks.length);
    const target = instances[idx % instances.length];

    setTimeout(async () => {
      const opStart = Date.now();
      let res = { status: 500, ok: false };
      try {
        res = await task.execute(target);
      } catch (err) {
        res = { status: 500, ok: false, error: err.message };
      }
      resolve({ ...res, latency: Date.now() - opStart, type: task.type });
    }, delay);
  }));

  const spikeResults = await Promise.all(spikePromises);
  const spikeDurationMs = Date.now() - spikeStart;

  // Window 3: After Spike (Recovery check)
  const recoveryStart = Date.now();
  const healthRes = await fetch(`${instances[0].url}/health`).then((r) => r.json());
  const readinessRes = await fetch(`${instances[0].url}/readiness`).then((r) => r.json());
  const recoveryDurationSec = ((Date.now() - recoveryStart) / 1000).toFixed(2);

  const totalCount = spikeResults.length;
  const successCount = spikeResults.filter((r) => r.ok).length;
  const status5xxCount = spikeResults.filter((r) => r.status >= 500).length;
  const successRate = Number(((successCount / totalCount) * 100).toFixed(2));
  const latencies = spikeResults.map((r) => r.latency);

  const p50 = calculatePercentile(latencies, 50);
  const p90 = calculatePercentile(latencies, 90);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const max = Math.max(...latencies);
  const rps = Number(((totalCount / (spikeDurationMs / 1000))).toFixed(2));

  let status = 'PASS';
  if (successRate < 99.5 || status5xxCount > 0 || p95 > 3000) {
    status = 'DEGRADED';
  }
  if (successRate < 95.0) {
    status = 'FAIL';
  }

  console.log(`[${name} RESULT]: Status: ${status} | Success: ${successRate}% (${successCount}/${totalCount}) | 5xx: ${status5xxCount} | Throughput: ${rps} req/s | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | Recovery: ${recoveryDurationSec}s`);

  return {
    name,
    baselineVUs,
    spikeVUs,
    totalCount,
    successCount,
    status5xxCount,
    successRate,
    rps,
    p50,
    p90,
    p95,
    p99,
    max,
    recoveryDurationSec,
    status,
  };
}

async function runSubSpikeTests(instances, sessionsByRole, menuItems) {
  console.log(`\n================================================================================`);
  console.log(`EXECUTING TARGETED SUB-SPIKE SUITE`);
  console.log(`================================================================================`);

  // 1. 250 Login Sub-Spike
  console.log(`\n--- 1. 250 LOGIN SUB-SPIKE ---`);
  const loginStart = Date.now();
  const staffUsers = sessionsByRole.STAFF.slice(0, 250);
  const loginPromises = staffUsers.map((u, idx) => {
    const target = instances[idx % instances.length];
    return fetch(`${target.url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({
        organisationId: 'LOADTEST_ORG',
        email: u.email,
        password: 'LoadTestPass123!',
        device: { deviceId: `DEV-SPIKE-${idx + 1}`, deviceName: 'Browser', deviceType: 'DESKTOP' },
      }),
    }).then((r) => ({ status: r.status, ok: r.status === 200 }));
  });
  const loginResults = await Promise.all(loginPromises);
  const loginSuccess = loginResults.filter((r) => r.ok).length;
  const loginPassed = loginSuccess >= 248;
  console.log(`[LOGIN SUB-SPIKE]: ${loginPassed ? 'PASS' : 'FAIL'} (${loginSuccess}/250 in ${Date.now() - loginStart}ms)`);

  // 2. 250 Attendance Sub-Spike
  console.log(`\n--- 2. 250 ATTENDANCE SUB-SPIKE ---`);
  const attendStart = Date.now();
  const attendPromises = staffUsers.map((u, idx) => {
    const target = instances[idx % instances.length];
    return fetch(`${target.url}/attendance/me/today`, { headers: { Cookie: u.cookieHeader } })
      .then((r) => ({ status: r.status, ok: r.status === 200 }));
  });
  const attendResults = await Promise.all(attendPromises);
  const attendSuccess = attendResults.filter((r) => r.ok).length;
  const attendPassed = attendSuccess === 250;
  console.log(`[ATTENDANCE SUB-SPIKE]: ${attendPassed ? 'PASS' : 'FAIL'} (${attendSuccess}/250 in ${Date.now() - attendStart}ms)`);

  // 3. 100 POS Sub-Spike
  console.log(`\n--- 3. 100 POS BILLS SUB-SPIKE ---`);
  const posAdmins = sessionsByRole.CAFE_ADMIN.slice(0, 100);
  const posStart = Date.now();
  const posPromises = posAdmins.map((u, idx) => {
    const target = instances[idx % instances.length];
    const item = menuItems[idx % menuItems.length];
    return fetch(`${target.url}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: u.cookieHeader, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({
        cafeId: u.cafeId,
        orderType: 'DINE_IN',
        tableNumber: `T-SPIKE-${idx + 1}`,
        lineItems: [{ menuItemId: item.menuItemId, quantity: 2 }],
        paymentMethod: 'CASH',
        isImmediateCompletion: true,
      }),
    }).then((r) => ({ status: r.status, ok: r.status === 201 }));
  });
  const posResults = await Promise.all(posPromises);
  const posSuccess = posResults.filter((r) => r.ok).length;
  const posPassed = posSuccess === 100;
  console.log(`[POS SUB-SPIKE]: ${posPassed ? 'PASS' : 'FAIL'} (${posSuccess}/100 in ${Date.now() - posStart}ms)`);

  // 4. 50 Report Sub-Spike
  console.log(`\n--- 4. 50 REPORTS SUB-SPIKE ---`);
  const reportUsers = [...sessionsByRole.OWNER, ...sessionsByRole.MASTER];
  const reportStart = Date.now();
  const reportPromises = Array.from({ length: 50 }, (_, idx) => {
    const user = reportUsers[idx % reportUsers.length];
    const target = instances[idx % instances.length];
    return fetch(`${target.url}/reports/daily-summary`, { headers: { Cookie: user.cookieHeader } })
      .then((r) => ({ status: r.status, ok: r.status === 200 }));
  });
  const reportResults = await Promise.all(reportPromises);
  const reportSuccess = reportResults.filter((r) => r.ok).length;
  const reportPassed = reportSuccess === 50;
  console.log(`[REPORT SUB-SPIKE]: ${reportPassed ? 'PASS' : 'FAIL'} (${reportSuccess}/50 in ${Date.now() - reportStart}ms)`);

  // 5. 100 Expense Sub-Spike + Prohibited Decisions
  console.log(`\n--- 5. 100 EXPENSE SUB-SPIKE & DECISION AUTHORITY PROBES ---`);
  const expStart = Date.now();
  const expPromises = posAdmins.map((u, idx) => {
    const target = instances[idx % instances.length];
    return fetch(`${target.url}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: u.cookieHeader, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({
        cafeId: u.cafeId,
        category: 'DAIRY_MILK',
        amount: 450 + idx,
        description: `Sub-Spike Expense #${idx + 1}`,
      }),
    }).then((r) => ({ status: r.status, ok: r.status === 201 }));
  });
  const expResults = await Promise.all(expPromises);
  const expSuccess = expResults.filter((r) => r.ok).length;

  // Prohibited decision check
  const hostileDecisions = await Promise.all([
    fetch(`${instances[0].url}/expenses/EX-TEST-0001/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionsByRole.CAFE_ADMIN[0].cookieHeader },
      body: JSON.stringify({ decision: 'APPROVED' }),
    }),
    fetch(`${instances[1].url}/expenses/EX-TEST-0001/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionsByRole.CAFE_ADMIN[0].cookieHeader },
      body: JSON.stringify({ reversalReason: 'Hostile' }),
    }),
  ]);
  const prohibitedDecisionBlocked = hostileDecisions.every((r) => r.status === 403 || r.status === 404);
  const expPassed = expSuccess === 100 && prohibitedDecisionBlocked;
  console.log(`[EXPENSE SUB-SPIKE]: ${expPassed ? 'PASS' : 'FAIL'} (${expSuccess}/100 created, Prohibited Decisions Blocked: ${prohibitedDecisionBlocked})`);

  return {
    loginPassed,
    attendPassed,
    posPassed,
    reportPassed,
    expPassed,
  };
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '100000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 200, minPoolSize: 50 });

  await resetLoadTestData();
  await seedLoadTestData();

  const instances = await startCluster(WORKER_COUNT, BASE_PORT);
  const sessionsByRole = await prewarmMixedSessions();
  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();

  console.log(`\n================================================================================`);
  console.log(`ZAMORIN CAFE ERP — HT-05 EXTREME SPIKE & RAPID RECOVERY TEST SUITE`);
  console.log(`================================================================================`);

  // PART 0: COLD-START 500 SPIKE (Fresh cluster startup -> immediate 500 spike)
  console.log(`\n>>> PART 0: COLD-START 500 SPIKE (FRESH STARTUP SPIKE) <<<`);
  const coldSpike = await executeSpikeScenario('COLD_START_500_SPIKE', 20, 500, 2000, instances, sessionsByRole, menuItems);

  // Non-business readiness warm-up
  for (const inst of instances) {
    await fetch(`${inst.url}/health`);
    await fetch(`${inst.url}/readiness`);
  }

  // PART 1: SPIKE SCENARIOS A through E
  console.log(`\n>>> PART 1: PROGRESSIVE SPIKE SCENARIOS (A through E) <<<`);
  const spikeA = await executeSpikeScenario('SPIKE_20_TO_500', 20, 500, 2000, instances, sessionsByRole, menuItems);
  const spikeB = await executeSpikeScenario('SPIKE_50_TO_750', 50, 750, 2000, instances, sessionsByRole, menuItems);
  const spikeC = await executeSpikeScenario('SPIKE_100_TO_1000', 100, 1000, 2000, instances, sessionsByRole, menuItems);
  const spikeD = await executeSpikeScenario('SPIKE_100_TO_1500', 100, 1500, 3000, instances, sessionsByRole, menuItems);
  const spikeE = await executeSpikeScenario('SPIKE_100_TO_2000', 100, 2000, 3000, instances, sessionsByRole, menuItems);

  // PART 2: SUB-SPIKES
  const subSpikes = await runSubSpikeTests(instances, sessionsByRole, menuItems);

  // PART 3: THREE CONSECUTIVE REQUIRED 500 SPIKE RUNS
  console.log(`\n>>> PART 3: THREE CONSECUTIVE REQUIRED 500 SPIKE QUALIFYING RUNS <<<`);
  const requiredSpike1 = await executeSpikeScenario('HT05-SPIKE-500-001', 20, 500, 2000, instances, sessionsByRole, menuItems);
  const requiredSpike2 = await executeSpikeScenario('HT05-SPIKE-500-002', 20, 500, 2000, instances, sessionsByRole, menuItems);
  const requiredSpike3 = await executeSpikeScenario('HT05-SPIKE-500-003', 20, 500, 2000, instances, sessionsByRole, menuItems);

  // PART 4: RAPID REPEATED SPIKE CYCLES (3 Cycles: 50 -> 500 -> 50)
  console.log(`\n>>> PART 4: RAPID REPEATED SPIKE CYCLES (3 CYCLES) <<<`);
  const cycleMemories = [];
  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n--- Cycle #${cycle} (50 -> 500 -> 50) ---`);
    await executeSpikeScenario(`CYCLE_${cycle}`, 50, 500, 2000, instances, sessionsByRole, menuItems);
    cycleMemories.push(getMemorySnapshot());
  }

  // PART 5: FINANCIAL INTEGRITY RECONCILIATION
  const totalBills = await Bill.countDocuments({ organisationId: 'LOADTEST_ORG' });
  const totalExpenses = await Expense.countDocuments({ organisationId: 'LOADTEST_ORG' });
  const totalCashTxs = await CashTransaction.countDocuments({ organisationId: 'LOADTEST_ORG', category: 'POS_SALE' });

  const cashBills = await Bill.find({ organisationId: 'LOADTEST_ORG', paymentMethod: 'CASH', status: 'COMPLETED' }).lean();
  let expectedCashPaisa = 0;
  for (const b of cashBills) expectedCashPaisa += b.totalPaisa;

  const allCashTxs = await CashTransaction.find({ organisationId: 'LOADTEST_ORG', category: 'POS_SALE' }).lean();
  let actualCashBookPaisa = 0;
  for (const tx of allCashTxs) actualCashBookPaisa += Math.round(tx.amount * 100);

  const variancePaisa = expectedCashPaisa - actualCashBookPaisa;
  const varianceRupees = (variancePaisa / 100).toFixed(2);

  console.log(`\n================================================================================`);
  console.log(`FINANCIAL INTEGRITY RECONCILIATION`);
  console.log(`================================================================================`);
  console.log(`Total Bills Created:         ${totalBills}`);
  console.log(`Total Cash Bills:            ${cashBills.length} (Total: ₹${(expectedCashPaisa / 100).toFixed(2)})`);
  console.log(`Total Cash Transactions:     ${allCashTxs.length} (Total: ₹${(actualCashBookPaisa / 100).toFixed(2)})`);
  console.log(`Cash Reconciliation Variance: ₹${varianceRupees}`);

  for (const inst of instances) {
    inst.server.close();
  }
  await mongoose.disconnect();

  const reportPath = path.join(RESULTS_DIR, 'HT05_SPIKE_TEST_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    spikeA,
    spikeB,
    spikeC,
    spikeD,
    spikeE,
    subSpikes,
    requiredSpike1,
    requiredSpike2,
    requiredSpike3,
    cycleMemories,
    totalBills,
    totalExpenses,
    totalCashTxs,
    varianceRupees,
  }, null, 2));

  console.log(`\n[HT-05 SUITE COMPLETE] Results written to ${reportPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[HT-05 FATAL ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
