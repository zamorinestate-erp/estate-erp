'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 2000;
const mongoose = require('mongoose');

const { seedLoadTestData, resetLoadTestData } = require('../scripts/seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Bill } = require('../../backend/src/models/Bill');
const { Expense } = require('../../backend/src/models/Expense');
const { MenuItem } = require('../../backend/src/models/MenuItem');
const { User } = require('../../backend/src/models/User');
const { Session } = require('../../backend/src/models/Session');
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');

const BASE_PORT = 4300;
const WORKER_COUNT = 4;
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
  const jwt = require('jsonwebtoken');
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
      tokenFamilyId: `FAM-MIX-${i + 1}`,
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

async function runMixedWorkloadTest(totalVUs = 500, arrivalWindowMs = 3000, instances, sessionsByRole) {
  console.log(`\n================================================================================`);
  console.log(`EXECUTING HT-03 MIXED WORKLOAD STRESS RUN: ${totalVUs} VUs over ${arrivalWindowMs}ms`);
  console.log(`================================================================================`);

  // Target Workload Partitioning:
  // 1. POS Billing: 175 VUs (CAFE_ADMIN)
  // 2. Expenses: 75 VUs (CAFE_ADMIN / STAFF)
  // 3. Menu Queries: 125 VUs (STAFF)
  // 4. Attendance: 100 VUs (STAFF)
  // 5. Reports: 25 VUs (OWNER / MASTER)

  const tasks = [];
  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();

  let vuCounter = 0;

  let loggedPos = false;
  let loggedMenu = false;

  // 1. POS Billing Tasks (175 VUs)
  const posUsers = sessionsByRole.CAFE_ADMIN.slice(0, 35);
  for (let i = 0; i < 175; i++) {
    const user = posUsers[i % posUsers.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'POS_BILLING',
      user,
      execute: async (target) => {
        const item1 = menuItems[i % menuItems.length];
        const item2 = menuItems[(i + 1) % menuItems.length];

        const res = await fetch(`${target.url}/bills`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: user.cookieHeader,
            Origin: `http://127.0.0.1:${target.port}`,
          },
          body: JSON.stringify({
            cafeId: user.cafeId,
            orderType: 'DINE_IN',
            tableNumber: `T-${(i % 15) + 1}`,
            customerName: `Customer #${vuIndex + 1}`,
            customerPhone: `98765${String(10000 + i)}`,
            lineItems: [
              { menuItemId: item1.menuItemId, quantity: 2 },
              { menuItemId: item2.menuItemId, quantity: 1 },
            ],
            discountPaisa: 0,
            paymentMethod: i % 2 === 0 ? 'UPI' : 'CASH',
            isImmediateCompletion: true,
          }),
        });

        if (!res.ok && !loggedPos) {
          loggedPos = true;
          const txt = await res.text();
          console.error(`[SAMPLE POS ERROR: status=${res.status}]`, txt);
        }

        return { status: res.status, ok: res.status === 201 };
      },
    });
  }

  // 2. Expense Submissions (75 VUs)
  const expenseUsers = sessionsByRole.CAFE_ADMIN.slice(0, 25);
  for (let i = 0; i < 75; i++) {
    const user = expenseUsers[i % expenseUsers.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'EXPENSE_SUBMISSION',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/expenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: user.cookieHeader,
            Origin: `http://127.0.0.1:${target.port}`,
          },
          body: JSON.stringify({
            cafeId: user.cafeId,
            category: 'DAIRY_MILK',
            amount: 450,
            paymentMethod: 'CASH',
            description: `Daily Milk Supply #${i + 1}`,
            vendorName: 'Milma Dairy',
          }),
        });

        return { status: res.status, ok: res.status === 201 };
      },
    });
  }

  // 3. Menu & Catalog Queries (125 VUs)
  const menuAdmins = sessionsByRole.CAFE_ADMIN.slice(0, 50);
  for (let i = 0; i < 125; i++) {
    const user = menuAdmins[i % menuAdmins.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'MENU_QUERY',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/menu/items`, {
          headers: { Cookie: user.cookieHeader },
        });

        if (!res.ok && !loggedMenu) {
          loggedMenu = true;
          const txt = await res.text();
          console.error(`[SAMPLE MENU ERROR: status=${res.status}]`, txt);
        }

        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 4. Staff Attendance Queries (100 VUs)
  const attendStaff = sessionsByRole.STAFF.slice(125, 225);
  for (let i = 0; i < 100; i++) {
    const user = attendStaff[i % attendStaff.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'ATTENDANCE_QUERY',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/attendance/me/today`, {
          headers: { Cookie: user.cookieHeader },
        });

        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  // 5. Management Reports (25 VUs)
  const reportUsers = [...sessionsByRole.OWNER, ...sessionsByRole.MASTER];
  for (let i = 0; i < 25; i++) {
    const user = reportUsers[i % reportUsers.length];
    const vuIndex = vuCounter++;
    tasks.push({
      vuIndex,
      type: 'REPORT_QUERY',
      user,
      execute: async (target) => {
        const res = await fetch(`${target.url}/reports/daily-summary`, {
          headers: { Cookie: user.cookieHeader },
        });

        return { status: res.status, ok: res.status === 200 };
      },
    });
  }

  console.log(`[TASKS CREATED] Total Mixed VUs: ${tasks.length}`);

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
  const rps = Number(((totalCount / (totalDurationMs / 1000))).toFixed(2));

  // Category breakdown
  const categories = ['POS_BILLING', 'EXPENSE_SUBMISSION', 'MENU_QUERY', 'ATTENDANCE_QUERY', 'REPORT_QUERY'];
  const breakdown = {};
  for (const cat of categories) {
    const catResults = results.filter((r) => r.type === cat);
    const catLatencies = catResults.map((r) => r.latency);
    const catSuccess = catResults.filter((r) => r.ok).length;
    breakdown[cat] = {
      total: catResults.length,
      success: catSuccess,
      successRate: Number(((catSuccess / catResults.length) * 100).toFixed(2)),
      p50: calculatePercentile(catLatencies, 50),
      p95: calculatePercentile(catLatencies, 95),
      p99: calculatePercentile(catLatencies, 99),
    };
  }

  console.log(`\n================================================================================`);
  console.log(`HT-03 MIXED WORKLOAD TEST RESULTS SUMMARY`);
  console.log(`================================================================================`);
  console.log(`Total VUs / Requests:  ${totalCount}`);
  console.log(`Success Rate:          ${successRate}% (${successCount}/${totalCount})`);
  console.log(`Unexpected 5xx Errors: ${status5xxCount}`);
  console.log(`Throughput (RPS):      ${rps} req/sec`);
  console.log(`Overall Latency:       p50: ${overallP50}ms | p90: ${overallP90}ms | p95: ${overallP95}ms | p99: ${overallP99}ms`);
  console.log(`\nCategory Breakdown:`);
  for (const [cat, data] of Object.entries(breakdown)) {
    console.log(`- ${cat.padEnd(20)}: ${data.success}/${data.total} (${data.successRate}%) | p50: ${data.p50}ms | p95: ${data.p95}ms | p99: ${data.p99}ms`);
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
    p50: overallP50,
    p90: overallP90,
    p95: overallP95,
    p99: overallP99,
    breakdown,
  };
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32-chars-min!';
  process.env.RATE_LIMIT_MAX = '10000';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 100, minPoolSize: 10 });

  await resetLoadTestData();
  await seedLoadTestData();

  const instances = await startCluster(4, 4300);
  const sessionsByRole = await prewarmMixedSessions();

  // Run 1: 500 VUs
  const run1 = await runMixedWorkloadTest(500, 3000, instances, sessionsByRole);

  // Financial integrity check
  const totalBills = await Bill.countDocuments({ organisationId: 'LOADTEST_ORG' });
  const totalExpenses = await Expense.countDocuments({ organisationId: 'LOADTEST_ORG' });
  console.log(`\n[FINANCIAL INTEGRITY CHECK] Total DB Bills: ${totalBills} | Total DB Expenses: ${totalExpenses}`);

  // Post-Load Recovery check
  const healthRes = await fetch(`${instances[0].url}/health`).then((r) => r.json());
  const readinessRes = await fetch(`${instances[0].url}/readiness`).then((r) => r.json());
  console.log(`[RECOVERY CHECK] Health: ${healthRes.status} | Readiness: ${readinessRes.status}`);

  for (const inst of instances) {
    inst.server.close();
  }
  await mongoose.disconnect();

  const reportPath = path.join(RESULTS_DIR, 'HT03_MIXED_WORKLOAD_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify({ run1, totalBills, totalExpenses, health: healthRes, readiness: readinessRes }, null, 2));

  const pass = run1.successRate >= 99.0 && run1.status5xxCount === 0 && run1.p95 <= 3000;
  console.log(`\n[HT-03 TEST SUITE RESULT] ${pass ? 'PASS' : 'FAIL / CAPACITY LIMIT DOCUMENTED'}`);

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('[HT-03 FATAL ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
