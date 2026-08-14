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

const BASE_PORT = 4400;
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

async function runWholeErpWorkload(totalVUs = 500, arrivalWindowMs = 3000, instances, sessionsByRole) {
  console.log(`\n================================================================================`);
  console.log(`EXECUTING HT-04 WHOLE-ERP STRESS RUN: ${totalVUs} VUs over ${arrivalWindowMs}ms`);
  console.log(`================================================================================`);

  // Target Workload Partitioning (Whole ERP Distribution):
  // 1. STAFF Self-Service (35%)
  // 2. POS Billing (25%)
  // 3. Menu Catalog (10%)
  // 4. Expense Submissions (8%)
  // 5. Inventory / Cash Reads (5%)
  // 6. Attendance Operations (5%)
  // 7. Reports & Analytics (4%)
  // 8. Finance Reads (3%)
  // 9. Procurement / Vendor (2%)
  // 10. Master Governance / Search (1%)
  // 11. Owner Strategic Reads (1%)
  // 12. Negative Security Injections (1%)

  const countStaffSelf = Math.max(1, Math.round(totalVUs * 0.35));
  const countPos = Math.max(1, Math.round(totalVUs * 0.25));
  const countMenu = Math.max(1, Math.round(totalVUs * 0.10));
  const countExpense = Math.max(1, Math.round(totalVUs * 0.08));
  const countInventory = Math.max(1, Math.round(totalVUs * 0.05));
  const countAttendance = Math.max(1, Math.round(totalVUs * 0.05));
  const countReports = Math.max(1, Math.round(totalVUs * 0.04));
  const countFinance = Math.max(1, Math.round(totalVUs * 0.03));
  const countProcurement = Math.max(1, Math.round(totalVUs * 0.02));
  const countMaster = Math.max(1, Math.round(totalVUs * 0.01));
  const countOwner = Math.max(1, Math.round(totalVUs * 0.01));
  const countSecurity = Math.max(1, totalVUs - (countStaffSelf + countPos + countMenu + countExpense + countInventory + countAttendance + countReports + countFinance + countProcurement + countMaster + countOwner));

  const tasks = [];
  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();
  let vuCounter = 0;

  // 1. STAFF Self-Service (35%)
  for (let i = 0; i < countStaffSelf; i++) {
    const user = sessionsByRole.STAFF[i % sessionsByRole.STAFF.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'STAFF_SELF_SERVICE',
      user,
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
      user,
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
      user,
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
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader, Origin: target.url.replace('/api/v1', '') },
          body: JSON.stringify({
            cafeId: user.cafeId,
            category: 'DAIRY_MILK',
            amount: 250 + (i * 5),
            description: `Load Test Expense #${i + 1}`,
          }),
        });
        return { status: res.status, ok: res.status === 201 };
      },
    });
  }

  // 5. Inventory / Cafe Bills Read (5%)
  for (let i = 0; i < countInventory; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'INVENTORY_CASH_READ',
      user,
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
      user,
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
      user,
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
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/cash-transactions?limit=10`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 9. Procurement / Vendor Reads (2%)
  for (let i = 0; i < countProcurement; i++) {
    const user = sessionsByRole.CAFE_ADMIN[i % sessionsByRole.CAFE_ADMIN.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'PROCUREMENT_READS',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/vendors`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 10. Master Governance / Search (1%)
  for (let i = 0; i < countMaster; i++) {
    const user = sessionsByRole.MASTER[i % sessionsByRole.MASTER.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'MASTER_GOVERNANCE',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/search?q=coffee`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 11. Owner Strategic Reads (1%)
  for (let i = 0; i < countOwner; i++) {
    const user = sessionsByRole.OWNER[i % sessionsByRole.OWNER.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'OWNER_STRATEGIC',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/reports/daily-summary`, { headers: { Cookie: user.cookieHeader } });
        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 12. Negative Security Attack Injections (1%)
  for (let i = 0; i < countSecurity; i++) {
    const vuIndex = vuCounter++;
    const probeType = i % 4;
    tasks.push({
      vuIndex,
      type: 'SECURITY_NEGATIVE_PROBE',
      user: null,
      execute: async (target) => {
        if (probeType === 0) {
          // Owner Personal Ledger
          const user = sessionsByRole.OWNER[0];
          const res = await fetch(`${target.url}/personal-ledger/balance`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403, expected403: true };
        } else if (probeType === 1) {
          // Cafe Admin cross-cafe bill
          const user = sessionsByRole.CAFE_ADMIN[0];
          const res = await fetch(`${target.url}/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: user.cookieHeader },
            body: JSON.stringify({ cafeId: 'CF-LOAD-0009', orderType: 'DINE_IN', lineItems: [] }),
          });
          return { status: res.status, ok: res.status === 403, expected403: true };
        } else if (probeType === 2) {
          // Staff operational quality checklist
          const user = sessionsByRole.STAFF[0];
          const res = await fetch(`${target.url}/quality/checklists`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403, expected403: true };
        } else {
          // Staff cross-user read
          const user = sessionsByRole.STAFF[0];
          const res = await fetch(`${target.url}/users/ST-1011`, { headers: { Cookie: user.cookieHeader } });
          return { status: res.status, ok: res.status === 403 || res.status === 404, expected403: true };
        }
      },
    });
  }

  console.log(`[TASKS CREATED] Total Whole-ERP VUs: ${tasks.length}`);

  const startTestTime = Date.now();
  const taskPromises = tasks.map((task) => new Promise((resolve) => {
    const delay = Math.floor((task.vuIndex * arrivalWindowMs) / tasks.length);
    const target = instances[task.vuIndex % instances.length];

    setTimeout(async () => {
      const opStart = Date.now();
      let res = { status: 500, ok: false };
      try {
        res = await task.execute(target);
      } catch (err) {
        res = { status: 500, ok: false, error: err.message };
      }
      const latency = Date.now() - opStart;
      resolve({
        vuIndex: task.vuIndex,
        type: task.type,
        status: res.status,
        ok: res.ok,
        expected403: task.expected403,
        latency,
      });
    }, delay);
  }));

  const results = await Promise.all(taskPromises);
  const totalDurationMs = Date.now() - startTestTime;

  const totalCount = results.length;
  const successCount = results.filter((r) => r.ok).length;
  const status5xxCount = results.filter((r) => r.status >= 500).length;
  const successRate = Number(((successCount / totalCount) * 100).toFixed(2));
  const allLatencies = results.map((r) => r.latency);

  const overallP50 = calculatePercentile(allLatencies, 50);
  const overallP90 = calculatePercentile(allLatencies, 90);
  const overallP95 = calculatePercentile(allLatencies, 95);
  const overallP99 = calculatePercentile(allLatencies, 99);
  const maxLatency = Math.max(...allLatencies);
  const rps = Number(((totalCount / (totalDurationMs / 1000))).toFixed(2));

  // Category breakdown
  const categories = [
    'STAFF_SELF_SERVICE',
    'POS_BILLING',
    'MENU_CATALOG',
    'EXPENSE_SUBMISSION',
    'INVENTORY_CASH_READ',
    'ATTENDANCE_OPS',
    'REPORTS_ANALYTICS',
    'FINANCE_READS',
    'PROCUREMENT_READS',
    'MASTER_GOVERNANCE',
    'OWNER_STRATEGIC',
    'SECURITY_NEGATIVE_PROBE',
  ];

  const breakdown = {};
  for (const cat of categories) {
    const catResults = results.filter((r) => r.type === cat);
    if (!catResults.length) continue;
    const catLatencies = catResults.map((r) => r.latency);
    const catSuccess = catResults.filter((r) => r.ok).length;
    breakdown[cat] = {
      total: catResults.length,
      success: catSuccess,
      successRate: Number(((catSuccess / catResults.length) * 100).toFixed(2)),
      p50: calculatePercentile(catLatencies, 50),
      p90: calculatePercentile(catLatencies, 90),
      p95: calculatePercentile(catLatencies, 95),
      p99: calculatePercentile(catLatencies, 99),
      max: Math.max(...catLatencies),
    };
  }

  // Evaluate Health vs Degraded vs Breakpoint
  let status = 'HEALTHY';
  const posP95 = breakdown.POS_BILLING?.p95 || 0;
  const expP95 = breakdown.EXPENSE_SUBMISSION?.p95 || 0;
  const menuP95 = breakdown.MENU_CATALOG?.p95 || 0;
  const staffP95 = breakdown.STAFF_SELF_SERVICE?.p95 || 0;
  const repP95 = breakdown.REPORTS_ANALYTICS?.p95 || 0;

  if (successRate < 95.0 || status5xxCount > (totalCount * 0.05)) {
    status = 'BREAKPOINT';
  } else if (
    successRate < 99.5 ||
    status5xxCount > 0 ||
    posP95 > 3000 ||
    expP95 > 3000 ||
    menuP95 > 2000 ||
    staffP95 > 2000 ||
    repP95 > 5000
  ) {
    status = 'DEGRADED';
  }

  console.log(`\n================================================================================`);
  console.log(`HT-04 WHOLE-ERP STRESS RUN SUMMARY (${totalVUs} VUs)`);
  console.log(`================================================================================`);
  console.log(`Status Classification: ${status}`);
  console.log(`Total Requests:        ${totalCount}`);
  console.log(`Success Rate:          ${successRate}% (${successCount}/${totalCount})`);
  console.log(`Unexpected 5xx Errors: ${status5xxCount}`);
  console.log(`Throughput (RPS):      ${rps} req/sec`);
  console.log(`Overall Latency:       p50: ${overallP50}ms | p90: ${overallP90}ms | p95: ${overallP95}ms | p99: ${overallP99}ms | max: ${maxLatency}ms`);

  console.log(`\nCategory Breakdown:`);
  for (const [cat, data] of Object.entries(breakdown)) {
    console.log(`- ${cat.padEnd(25)}: ${data.success}/${data.total} (${data.successRate}%) | p50: ${data.p50}ms | p95: ${data.p95}ms | p99: ${data.p99}ms | max: ${data.max}ms`);
  }

  return {
    totalVUs,
    arrivalWindowMs,
    totalDurationMs,
    totalCount,
    successCount,
    status5xxCount,
    successRate,
    rps,
    status,
    p50: overallP50,
    p90: overallP90,
    p95: overallP95,
    p99: overallP99,
    max: maxLatency,
    breakdown,
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

  console.log(`\n================================================================================`);
  console.log(`ZAMORIN CAFE ERP — HT-04 WHOLE-SYSTEM STRESS, BREAKPOINT & CAPACITY ENVELOPE`);
  console.log(`================================================================================`);

  // PART A: COLD-START INVESTIGATION (3 Fresh Cold Runs)
  console.log(`\n>>> PART A: COLD-START INVESTIGATION (3 FRESH COLD 500-VU RUNS) <<<`);
  const coldRuns = [];
  for (let c = 1; c <= 3; c++) {
    console.log(`\n--- Cold Start Run #${c} ---`);
    const cRun = await runWholeErpWorkload(500, 3000, instances, sessionsByRole);
    coldRuns.push(cRun);
  }

  // Non-business readiness ping
  console.log(`\n>>> WARMING CLUSTER WORKERS TO STEADY STATE VIA READINESS PINGS <<<`);
  for (const inst of instances) {
    await fetch(`${inst.url}/health`);
    await fetch(`${inst.url}/readiness`);
  }

  // PART B: SEQUENTIAL LOAD ESCALATION STAGES
  console.log(`\n>>> PART B: SEQUENTIAL LOAD ESCALATION STAGES <<<`);
  const stageVUs = [250, 500, 750, 1000, 1250, 1500, 2000, 2500];
  const stageResults = {};
  const memorySnapshots = {};

  for (const vus of stageVUs) {
    memorySnapshots[`before_${vus}`] = getMemorySnapshot();
    const stageResult = await runWholeErpWorkload(vus, 3000, instances, sessionsByRole);
    memorySnapshots[`after_${vus}`] = getMemorySnapshot();
    stageResults[vus] = stageResult;

    // Check stop-escalation rule
    if (stageResult.status === 'BREAKPOINT') {
      console.log(`\n[STOP-ESCALATION TRIGGERED] Breakpoint reached at ${vus} VUs.`);
      break;
    }
  }

  // PART C: FINANCIAL INTEGRITY RECONCILIATION
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

  // PART D: OVERLOAD RECOVERY CHECK
  const recoveryStart = Date.now();
  const healthRes = await fetch(`${instances[0].url}/health`).then((r) => r.json());
  const readinessRes = await fetch(`${instances[0].url}/readiness`).then((r) => r.json());
  const recoveryDurationSec = ((Date.now() - recoveryStart) / 1000).toFixed(2);
  console.log(`\n[POST-OVERLOAD RECOVERY] Health: ${healthRes.status} | Readiness: ${readinessRes.status} | Time: ${recoveryDurationSec}s`);

  // PART E: 3x REPEAT RUNS AT HIGHEST HEALTHY LOAD
  console.log(`\n>>> PART E: 3x REPEAT RUNS AT HIGHEST HEALTHY LOAD (1,000 VUs) <<<`);
  const healthyRepeatRuns = [];
  for (let r = 1; r <= 3; r++) {
    console.log(`\n--- Highest Healthy Repeat Run #${r} (1,000 VUs) ---`);
    const repRun = await runWholeErpWorkload(1000, 3000, instances, sessionsByRole);
    healthyRepeatRuns.push(repRun);
  }

  // PART F: 3x REPEAT RUNS AT FIRST DEGRADATION LEVEL (1,250 VUs)
  console.log(`\n>>> PART F: 3x REPEAT RUNS AT FIRST DEGRADATION LEVEL (1,250 VUs) <<<`);
  const degradedRepeatRuns = [];
  for (let r = 1; r <= 3; r++) {
    console.log(`\n--- First Degradation Repeat Run #${r} (1,250 VUs) ---`);
    const degRun = await runWholeErpWorkload(1250, 3000, instances, sessionsByRole);
    degradedRepeatRuns.push(degRun);
  }

  for (const inst of instances) {
    inst.server.close();
  }
  await mongoose.disconnect();

  const reportPath = path.join(RESULTS_DIR, 'HT04_WHOLE_SYSTEM_STRESS_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify({ coldRuns, stageResults, memorySnapshots, healthyRepeatRuns, degradedRepeatRuns, totalBills, totalExpenses, totalCashTxs, varianceRupees, health: healthRes, readiness: readinessRes, recoveryDurationSec }, null, 2));

  console.log(`\n[HT-04 SUITE COMPLETE] Results written to ${reportPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[HT-04 FATAL ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
