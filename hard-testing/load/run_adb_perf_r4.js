'use strict';

/**
 * ADB-PERF-R4 — TRUE 500-STAFF ARRIVAL STORM HARNESS
 *
 * Requirements:
 *  - 500 unique Staff VUs.
 *  - All 500 check-in requests initiated within <= 2.0s arrival span.
 *  - maxSockets: 600 so load generator is never the socket bottleneck.
 *  - Atomic timestamp capture for first/last request start.
 *  - 3 consecutive measured runs (Run 1: Cold start, Run 2: Warm, Run 3: Warm).
 *  - 500 duplicate check-in idempotency check.
 *  - 500 check-out storm.
 *  - Atlas database consistency & isolation audit.
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

module.paths.push(
  path.join(__dirname, '../../backend/node_modules')
);

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { User } = require('../../backend/src/models/User');
const { Cafe } = require('../../backend/src/models/Cafe');
const { Session } = require('../../backend/src/models/Session');
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');
const { AttendanceSubmission } = require('../../backend/src/models/AttendanceSubmission');

// ─── Configuration ────────────────────────────────────────────────────────────
const TARGET_URL = (
  process.env.RENDER_API_URL || 'http://127.0.0.1:4000'
).replace(/\/$/, '');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  '307aba8948b816c1915f7f777ffbdcff641261c02ff4d1dff20d414ac961805f302d4e5a9b2b2f28d96acf587534c055';

process.env.JWT_ACCESS_SECRET = JWT_SECRET;
process.env.MFA_ENCRYPTION_KEY =
  process.env.MFA_ENCRYPTION_KEY ||
  '010ba86a42ea438bdf4653d6266a98af45524e5817f715667c65e87d0ac9b359';

const RESULTS_DIR = path.join(__dirname, '../results');
const TOTAL_STAFF = 500;
const TEST_ORG = 'ZAMORIN';
const CAFE_IDS = [
  'CAFE-001', 'CAFE-002', 'CAFE-003', 'CAFE-004', 'CAFE-005',
];

const ARRIVAL_SPAN_LIMIT_MS = 2000;

// ─── HTTP Agents — maxSockets=600 ─────────────────────────────────────────────
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 600,
  maxFreeSockets: 100,
  timeout: 30000,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 600,
  maxFreeSockets: 100,
  timeout: 30000,
});

// ─── Statistics Helpers ───────────────────────────────────────────────────────
function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function statsBlock(latencies) {
  if (!latencies.length) return { p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    p50: pct(sorted, 50),
    p90: pct(sorted, 90),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    max: sorted[sorted.length - 1],
  };
}

// ─── HTTP Request Helper ──────────────────────────────────────────────────────
function makeRequest(urlPath, options = {}, body = null) {
  return new Promise((resolve) => {
    const url = new URL(`${TARGET_URL}${urlPath}`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const agent = isHttps ? httpsAgent : httpAgent;
    const data = body
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : null;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        agent,
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:4000',
          'X-Forwarded-For': options.ip || '198.51.100.1',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...options.headers,
        },
        timeout: 30000,
      },
      (res) => {
        let responseData = '';
        res.on('data', (c) => (responseData += c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseData,
          })
        );
      }
    );

    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'TIMEOUT' });
    });
    if (data) req.write(data);
    req.end();
  });
}

// ─── Auth Service (direct session creation) ───────────────────────────────────
const authService = require('../../backend/src/services/authService');

async function createStaffTokens(staffList) {
  console.log(
    `[AUTH] Creating/Verifying ${staffList.length} stateful sessions on Atlas (batches of 50)...`
  );
  const results = [];
  const CHUNK = 50;
  for (let i = 0; i < staffList.length; i += CHUNK) {
    const chunk = staffList.slice(i, i + CHUNK);
    const chunkResults = await Promise.all(
      chunk.map((s, idx) => {
        const globalIdx = i + idx;
        return authService
          .createSession({
            user: s,
            device: {
              deviceId: `perf-dev-${s.userId}`,
              deviceName: 'Perf Test Mobile',
              deviceType: 'MOBILE',
            },
            network: {
              ipAddressMasked: `198.51.${Math.floor(globalIdx / 250) + 100}.${(globalIdx % 250) + 1}`,
            },
            mfaVerified: true,
            createdBy: s.userId,
          })
          .then((sessionRes) => ({ ...s, token: sessionRes.accessToken }));
      })
    );
    results.push(...chunkResults);
  }
  console.log(`[AUTH] ${results.length} active sessions ready.`);
  return results;
}

// ─── Seed synthetic fixtures ──────────────────────────────────────────────────
async function seedFixtures() {
  console.log(`[SEED] Verifying ${TOTAL_STAFF} synthetic Staff + ${CAFE_IDS.length} Cafés...`);

  for (const cafeId of CAFE_IDS) {
    await Cafe.updateOne(
      { organisationId: TEST_ORG, cafeId },
      {
        $setOnInsert: {
          organisationId: TEST_ORG,
          cafeId,
          name: `Zamorin Perf Café ${cafeId}`,
          code: cafeId,
          status: 'ACTIVE',
          address: {
            street: 'Perf Test Street',
            city: 'Kozhikode',
            state: 'Kerala',
            country: 'IN',
          },
          createdBy: 'SYSTEM',
        },
      },
      { upsert: true }
    );
  }

  const existingCount = await User.countDocuments({
    organisationId: TEST_ORG,
    role: 'STAFF',
  });

  if (existingCount < TOTAL_STAFF) {
    const batch = [];
    for (let i = existingCount + 1; i <= TOTAL_STAFF; i++) {
      const paddedId = String(i).padStart(4, '0');
      const cafeId = CAFE_IDS[(i - 1) % CAFE_IDS.length];
      batch.push({
        userId: `ST-${paddedId}`,
        organisationId: TEST_ORG,
        name: `Perf Staff ${paddedId}`,
        email: `perfstaff_${paddedId}@zamorin.perftest`,
        role: 'STAFF',
        primaryCafeId: cafeId,
        assignedCafeIds: [cafeId],
        accountStatus: 'ACTIVE',
        passwordHash:
          '$2b$10$dummyHashForSyntheticPerfTesting0000000000000000000',
        mustChangePassword: false,
        sessionVersion: 0,
        permissionsVersion: 0,
        mfaEnabled: false,
        createdBy: 'SYSTEM',
      });
    }
    if (batch.length > 0) {
      await User.insertMany(batch, { ordered: false });
      console.log(`[SEED] Inserted ${batch.length} synthetic Staff accounts.`);
    }
  } else {
    console.log(`[SEED] Found ${existingCount} existing Staff accounts.`);
  }

  const staff = await User.find({
    organisationId: TEST_ORG,
    role: 'STAFF',
  })
    .limit(TOTAL_STAFF)
    .lean();

  return staff;
}

async function prewarmSockets() {
  console.log(`[PREWARM] Pre-warming ${TOTAL_STAFF} keep-alive TCP connections...`);
  const CHUNK = 50;
  for (let i = 0; i < TOTAL_STAFF; i += CHUNK) {
    const chunk = Array.from({ length: Math.min(CHUNK, TOTAL_STAFF - i) });
    await Promise.all(chunk.map(() => makeRequest('/api/v1/health')));
  }
  console.log(`[PREWARM] ${TOTAL_STAFF} persistent sockets established.`);
}



// ─── TRUE STORM: single Promise.all across all 500 ────────────────────────────
async function executeCheckInStorm(staffWithTokens, runNumber, dateStr) {
  console.log(
    `\n[RUN ${runNumber}] ► Firing all ${TOTAL_STAFF} CHECK-IN requests simultaneously...`
  );

  let firstStartMs = Infinity;
  let lastStartMs = -Infinity;

  const latencies = [];
  let successCount = 0;
  let fiveXxCount = 0;
  let failCount = 0;

  const allResults = await Promise.all(
    staffWithTokens.map((staff, idx) => {
      const ip = `10.200.${Math.floor(idx / 250)}.${(idx % 250) + 1}`;
      const startMs = Date.now();

      if (startMs < firstStartMs) firstStartMs = startMs;
      if (startMs > lastStartMs) lastStartMs = startMs;

      return makeRequest(
        '/api/v1/attendance/check-in',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staff.token}` },
          ip,
        },
        { cafeId: staff.primaryCafeId }
      ).then((res) => ({
        ...res,
        latencyMs: Date.now() - startMs,
        userId: staff.userId,
      }));
    })
  );

  const statusCounts = {};
  for (const r of allResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    latencies.push(r.latencyMs);
    if (r.status === 200 || r.status === 201) {
      successCount++;
    } else {
      if (r.status >= 500) fiveXxCount++;
      failCount++;
    }
  }
  console.log(`[RUN ${runNumber}] Check-out status breakdown:`, statusCounts);

  const arrivalSpanMs = lastStartMs - firstStartMs;
  const stats = statsBlock(latencies);
  const throughputRps =
    latencies.length / (Math.max(...latencies) / 1000);

  console.log(
    `[RUN ${runNumber}] CHECK-IN RESULTS:\n` +
    `  Arrival span:  ${arrivalSpanMs}ms (limit: ${ARRIVAL_SPAN_LIMIT_MS}ms) ${arrivalSpanMs <= ARRIVAL_SPAN_LIMIT_MS ? '✓' : '✗ LOAD_GENERATOR_CAPACITY_LIMIT'}\n` +
    `  Success:       ${successCount}/${TOTAL_STAFF} (${((successCount / TOTAL_STAFF) * 100).toFixed(2)}%)\n` +
    `  5xx errors:    ${fiveXxCount} (${((fiveXxCount / TOTAL_STAFF) * 100).toFixed(2)}%)\n` +
    `  p50: ${stats.p50}ms  p90: ${stats.p90}ms  p95: ${stats.p95}ms  p99: ${stats.p99}ms  max: ${stats.max}ms\n` +
    `  Throughput:    ${throughputRps.toFixed(1)} req/s`
  );

  return {
    arrivalSpanMs,
    firstStartMs,
    lastStartMs,
    successCount,
    failCount,
    fiveXxCount,
    latencies,
    ...stats,
    throughputRps,
  };
}

async function executeCheckOutStorm(staffWithTokens, runNumber) {
  console.log(
    `\n[RUN ${runNumber}] ► Firing all ${TOTAL_STAFF} CHECK-OUT requests simultaneously...`
  );

  let firstStartMs = Infinity;
  let lastStartMs = -Infinity;

  const latencies = [];
  let successCount = 0;
  let fiveXxCount = 0;
  let failCount = 0;

  const allResults = await Promise.all(
    staffWithTokens.map((staff, idx) => {
      const ip = `10.201.${Math.floor(idx / 250)}.${(idx % 250) + 1}`;
      const startMs = Date.now();

      if (startMs < firstStartMs) firstStartMs = startMs;
      if (startMs > lastStartMs) lastStartMs = startMs;

      return makeRequest(
        '/api/v1/attendance/check-out',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staff.token}` },
          ip,
        },
        {}
      ).then((res) => ({
        ...res,
        latencyMs: Date.now() - startMs,
        userId: staff.userId,
      }));
    })
  );

  for (const r of allResults) {
    latencies.push(r.latencyMs);
    if (r.status === 200 || r.status === 201) {
      successCount++;
    } else {
      if (r.status >= 500) fiveXxCount++;
      failCount++;
    }
  }

  const arrivalSpanMs = lastStartMs - firstStartMs;
  const stats = statsBlock(latencies);
  const throughputRps =
    latencies.length / (Math.max(...latencies) / 1000);

  console.log(
    `[RUN ${runNumber}] CHECK-OUT RESULTS:\n` +
    `  Arrival span:  ${arrivalSpanMs}ms\n` +
    `  Success:       ${successCount}/${TOTAL_STAFF} (${((successCount / TOTAL_STAFF) * 100).toFixed(2)}%)\n` +
    `  5xx errors:    ${fiveXxCount}\n` +
    `  p50: ${stats.p50}ms  p90: ${stats.p90}ms  p95: ${stats.p95}ms  p99: ${stats.p99}ms  max: ${stats.max}ms\n` +
    `  Throughput:    ${throughputRps.toFixed(1)} req/s`
  );

  return {
    arrivalSpanMs,
    firstStartMs,
    lastStartMs,
    successCount,
    failCount,
    fiveXxCount,
    latencies,
    ...stats,
    throughputRps,
  };
}

// ─── Single Run ───────────────────────────────────────────────────────────────
async function executeSingleRun(runNumber, staffWithTokens) {
  const label = runNumber === 1 ? 'COLD' : 'WARM';
  console.log(
    `\n${'═'.repeat(70)}\n` +
    ` ADB-PERF-R4-00${runNumber} (${label}) — 500-STAFF TRUE STORM RUN #${runNumber}\n` +
    `${'═'.repeat(70)}`
  );

  const runDate = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(runDate);

  // Wipe prior attendance for this business date so each run is clean
  const deleted = await Attendance.deleteMany({
    organisationId: TEST_ORG,
    businessDate: dateStr,
  });
  console.log(
    `[RUN ${runNumber}] Cleared ${deleted.deletedCount} prior attendance records for ${dateStr}.`
  );

  // ── STEP 1: True check-in storm ──────────────────────────────────────────
  const checkIn = await executeCheckInStorm(staffWithTokens, runNumber, dateStr);

  // ── STEP 2: Duplicate guard — 500 repeat check-ins must all be rejected ──
  console.log(`\n[RUN ${runNumber}] ► Duplicate guard: 500 repeat check-in attempts...`);
  let duplicateBlocked = 0;
  let duplicateFalseAllow = 0;

  const dupResults = await Promise.all(
    staffWithTokens.map((staff, idx) => {
      const ip = `10.202.${Math.floor(idx / 250)}.${(idx % 250) + 1}`;
      return makeRequest(
        '/api/v1/attendance/check-in',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${staff.token}` },
          ip,
        },
        { cafeId: staff.primaryCafeId }
      );
    })
  );

  const statusCounts = {};
  for (const r of dupResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.status === 409 || r.status === 400) duplicateBlocked++;
    else duplicateFalseAllow++;
  }
  console.log(`[RUN ${runNumber}] Duplicate guard status breakdown:`, statusCounts);
  console.log(
    `[RUN ${runNumber}] Duplicate guard: ${duplicateBlocked}/${TOTAL_STAFF} blocked | ` +
    `False allows: ${duplicateFalseAllow}`
  );

  // Wait 1.5 seconds to ensure checkInAt < checkOutAt
  await new Promise((r) => setTimeout(r, 1500));

  // ── STEP 3: True check-out storm ─────────────────────────────────────────
  const checkOut = await executeCheckOutStorm(staffWithTokens, runNumber);

  // ── STEP 4: Atlas audit ───────────────────────────────────────────────────
  console.log(`\n[RUN ${runNumber}] ► Atlas DB audit...`);
  const totalRecords = await Attendance.countDocuments({
    organisationId: TEST_ORG,
    businessDate: dateStr,
  });
  const distinctUserIds = await Attendance.distinct('userId', {
    organisationId: TEST_ORG,
    businessDate: dateStr,
  });
  const duplicateAttendanceRecords = totalRecords - distinctUserIds.length;

  const leakageRecords = await Attendance.countDocuments({
    organisationId: TEST_ORG,
    businessDate: dateStr,
    userId: { $not: /^ST-\d{4}$/ },
  });

  let lostWrites = 0;
  if (checkIn.successCount > totalRecords) {
    lostWrites = checkIn.successCount - totalRecords;
  }

  console.log(
    `[RUN ${runNumber}] Attendance DB: ${totalRecords} records | ` +
    `${distinctUserIds.length} unique users | ` +
    `${duplicateAttendanceRecords} duplicates | ` +
    `${leakageRecords} cross-user leaks | ` +
    `${lostWrites} lost writes`
  );

  // ── SLA gate evaluation ───────────────────────────────────────────────────
  const checkInSuccessRate = (checkIn.successCount / TOTAL_STAFF) * 100;
  const checkIn5xxRate = (checkIn.fiveXxCount / TOTAL_STAFF) * 100;
  const checkOutSuccessRate = (checkOut.successCount / TOTAL_STAFF) * 100;

  const sla = {
    arrivalSpanOk: checkIn.arrivalSpanMs <= ARRIVAL_SPAN_LIMIT_MS,
    checkInSuccessOk: checkInSuccessRate >= 99.5,
    checkIn5xxOk: checkIn5xxRate < 0.5,
    checkInP95Ok: checkIn.p95 <= 2000,
    checkInP99Ok: checkIn.p99 <= 5000,
    checkOutSuccessOk: checkOutSuccessRate >= 99.0,
    noDuplicates: duplicateAttendanceRecords === 0,
    noLostWrites: lostWrites === 0,
    noCrossUserLeakage: leakageRecords === 0,
    allDuplicatesBlocked: duplicateBlocked === TOTAL_STAFF,
  };

  const slaPass = Object.values(sla).every(Boolean);
  const loadGenCapacityOk = checkIn.arrivalSpanMs <= ARRIVAL_SPAN_LIMIT_MS;

  console.log(
    `\n[RUN ${runNumber}] SLA GATES:\n` +
    Object.entries(sla)
      .map(([k, v]) => `  ${v ? '✓' : '✗'} ${k}`)
      .join('\n')
  );

  const verdict = !loadGenCapacityOk
    ? 'LOAD_GENERATOR_CAPACITY_LIMIT'
    : slaPass
    ? 'PASS'
    : 'FAIL';

  console.log(`\n[RUN ${runNumber}] VERDICT: ${verdict}`);

  return {
    runNumber,
    runLabel: label,
    dateStr,
    checkIn: {
      arrivalSpanMs: checkIn.arrivalSpanMs,
      firstStartMs: checkIn.firstStartMs,
      lastStartMs: checkIn.lastStartMs,
      successCount: checkIn.successCount,
      failCount: checkIn.failCount,
      fiveXxCount: checkIn.fiveXxCount,
      successRate: checkInSuccessRate.toFixed(2),
      fiveXxRate: checkIn5xxRate.toFixed(2),
      p50: checkIn.p50,
      p90: checkIn.p90,
      p95: checkIn.p95,
      p99: checkIn.p99,
      max: checkIn.max,
      throughputRps: checkIn.throughputRps.toFixed(1),
    },
    duplicateGuard: {
      blocked: duplicateBlocked,
      falseAllowed: duplicateFalseAllow,
    },
    checkOut: {
      arrivalSpanMs: checkOut.arrivalSpanMs,
      successCount: checkOut.successCount,
      failCount: checkOut.failCount,
      fiveXxCount: checkOut.fiveXxCount,
      successRate: checkOutSuccessRate.toFixed(2),
      p50: checkOut.p50,
      p90: checkOut.p90,
      p95: checkOut.p95,
      p99: checkOut.p99,
      max: checkOut.max,
      throughputRps: checkOut.throughputRps.toFixed(1),
    },
    dbAudit: {
      totalRecords,
      uniqueUsers: distinctUserIds.length,
      duplicateAttendanceRecords,
      crossUserLeakage: leakageRecords,
      lostWrites,
    },
    sla,
    slaPass,
    loadGenCapacityOk,
    verdict,
  };
}

// ─── Post-test Cleanup & Hygiene Audit ────────────────────────────────────────
async function cleanAndAuditHygiene() {
  console.log('\n[HYGIENE] Cleaning synthetic test records and auditing production hygiene...');

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // Clean synthetic attendance records created during storm
  const deletedAttendance = await Attendance.deleteMany({
    organisationId: TEST_ORG,
    userId: { $regex: /^ST-\d{4}$/ },
  });

  // Clean synthetic sessions created during storm
  const deletedSessions = await Session.deleteMany({
    organisationId: TEST_ORG,
    'device.deviceId': { $regex: /^perf-dev-/ },
  });

  // Clean synthetic submissions
  const deletedSubmissions = await AttendanceSubmission.deleteMany({
    organisationId: TEST_ORG,
    userId: { $regex: /^ST-\d{4}$/ },
  });

  // Check remaining artifacts
  const remainingAttendance = await Attendance.countDocuments({
    organisationId: TEST_ORG,
    userId: { $regex: /^ST-\d{4}$/ },
  });
  const remainingSessions = await Session.countDocuments({
    organisationId: TEST_ORG,
    'device.deviceId': { $regex: /^perf-dev-/ },
  });

  // Verify Primary Master MU-0001 intact
  const primaryMaster = await User.findOne({
    userId: 'MU-0001',
  }).lean();

  console.log(
    `[HYGIENE] Deleted ${deletedAttendance.deletedCount} test attendance records, ` +
    `${deletedSessions.deletedCount} test sessions, ` +
    `${deletedSubmissions.deletedCount} test submissions.\n` +
    `[HYGIENE] Remaining synthetic attendance: ${remainingAttendance}\n` +
    `[HYGIENE] Remaining synthetic sessions: ${remainingSessions}\n` +
    `[HYGIENE] Primary Master MU-0001 status: ${primaryMaster ? 'INTACT (' + primaryMaster.accountStatus + ')' : 'MISSING'}`
  );

  return {
    remainingAttendance,
    remainingSessions,
    primaryMasterIntact: Boolean(primaryMaster && primaryMaster.accountStatus === 'ACTIVE'),
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const overallStart = Date.now();

  console.log('═'.repeat(70));
  console.log(' ZAMORIN CAFE ERP — ADB-PERF-R4 TRUE 500-STAFF ARRIVAL STORM');
  console.log(`  Target Backend: ${TARGET_URL}`);
  console.log(`  Atlas Cluster:  ${MONGODB_URI.split('@')[1]?.split('?')[0] || 'Atlas'}`);
  console.log(`  Staff VUs:      ${TOTAL_STAFF}`);
  console.log(`  Arrival Limit:  ${ARRIVAL_SPAN_LIMIT_MS}ms`);
  console.log(`  SLA:            success>=99.5%, p95<=2000ms, p99<=5000ms, 5xx<0.5%`);
  console.log('═'.repeat(70));

  console.log('\n[INIT] Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 100,
    minPoolSize: 10,
  });
  console.log('[INIT] Connected to Atlas.');

  const rawStaff = await seedFixtures();
  const staffWithTokens = await createStaffTokens(rawStaff);
  await prewarmSockets();

  const runs = [];

  for (let r = 1; r <= 3; r++) {
    const runResult = await executeSingleRun(r, staffWithTokens);
    runs.push(runResult);

    if (r < 3) {
      console.log(`\n[PAUSE] 10s pause between runs...`);
      await new Promise((res) => setTimeout(res, 10000));
    }
  }

  const hygiene = await cleanAndAuditHygiene();

  await mongoose.disconnect();

  const allSlaPass = runs.every((r) => r.slaPass);
  const allArrivalOk = runs.every((r) => r.loadGenCapacityOk);
  const overallVerdict =
    !allArrivalOk
      ? 'LOAD_GENERATOR_CAPACITY_LIMIT'
      : allSlaPass
      ? 'ATTENDANCE_PERFORMANCE_VERIFIED'
      : 'PERFORMANCE_REMEDIATION_REQUIRED';

  console.log('\n' + '═'.repeat(70));
  console.log(` ADB-PERF-R4 OVERALL VERDICT: ${overallVerdict}`);
  for (const r of runs) {
    console.log(
      `  Run #${r.runNumber} (${r.runLabel}): ${r.verdict} | ` +
      `arrival=${r.checkIn.arrivalSpanMs}ms | ` +
      `p95=${r.checkIn.p95}ms | p99=${r.checkIn.p99}ms | ` +
      `success=${r.checkIn.successRate}%`
    );
  }
  console.log(
    `  Total duration: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`
  );
  console.log('═'.repeat(70));

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const evidence = {
    testId: 'ADB_PERF_R4_TRUE_500_STORM',
    executedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    totalStaff: TOTAL_STAFF,
    arrivalWindowLimitMs: ARRIVAL_SPAN_LIMIT_MS,
    slaDefinition: {
      arrivalSpanMaxMs: 2000,
      successRateMin: 99.5,
      error5xxMax: 0.5,
      checkInP95MaxMs: 2000,
      checkInP99MaxMs: 5000,
      duplicates: 0,
      lostWrites: 0,
      crossUserLeakage: 0,
      crashes: 0,
    },
    overallVerdict,
    runs,
    hygiene,
    durationMs: Date.now() - overallStart,
  };

  const outPath = path.join(RESULTS_DIR, 'ADB_PERF_R4_STORM_RESULTS.json');
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log(`\n[RESULTS] Evidence saved → ${outPath}`);

  process.exit(
    overallVerdict === 'ATTENDANCE_PERFORMANCE_VERIFIED' ? 0 : 1
  );
}

main().catch((err) => {
  console.error('[ADB-PERF-R4 FATAL]', err);
  process.exit(1);
});
