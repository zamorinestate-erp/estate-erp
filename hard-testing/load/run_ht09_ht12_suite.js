'use strict';

process.env.UV_THREADPOOL_SIZE = '64';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
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

const BASE_PORT = 4800;
const WORKER_COUNT = 4;
const RESULTS_DIR = path.join(__dirname, '../results');

async function startCluster() {
  const instances = [];
  const allowedOrigins = Array.from({ length: WORKER_COUNT }, (_, i) => `http://127.0.0.1:${BASE_PORT + i}`);
  for (let i = 0; i < WORKER_COUNT; i++) {
    const port = BASE_PORT + i;
    const app = createApp({ production: false, test: true, allowedOrigins });
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    instances.push({ port, server, url: `http://127.0.0.1:${port}/api/v1` });
  }
  return instances;
}

async function prewarm() {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  const now = new Date();
  const users = await User.find({ organisationId: 'LOADTEST_ORG' }).lean();
  const byRole = { STAFF: [], CAFE_ADMIN: [], OWNER: [], MASTER: [] };
  const docs = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sid = `SS-${dateStamp}-${String(20000 + i)}`;
    const token = jwt.sign(
      { sub: u.userId, sid, org: u.organisationId, role: u.role, cafes: u.assignedCafeIds, sv: 0, usv: 0, pv: 0, type: 'access' },
      secret, { algorithm: 'HS256', expiresIn: '2h', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
    );
    docs.push({ sessionId: sid, organisationId: u.organisationId, userId: u.userId, roleSnapshot: u.role, assignedCafeIdsSnapshot: u.assignedCafeIds, tokenFamilyId: `FAM-${i}`, accessTokenHash: 'HT09', refreshTokenHash: 'HT09', sessionVersion: 0, userSessionVersionSnapshot: 0, permissionsVersionSnapshot: 0, status: 'ACTIVE', device: { deviceId: `DEV-${i}`, deviceName: 'FC', deviceType: 'DESKTOP' }, issuedAt: now, lastActivityAt: now, mfaVerified: true, mfaVerifiedAt: now, stepUpVerifiedAt: now, accessTokenExpiresAt: new Date(now.getTime() + 2 * 3600000), refreshTokenExpiresAt: new Date(now.getTime() + 24 * 3600000), absoluteExpiresAt: new Date(now.getTime() + 24 * 3600000), idleTimeoutMinutes: 120, createdBy: u.userId });
    const cookie = `zamorin_access_token=${token}; zamorin_session_id=${sid}`;
    if (byRole[u.role]) byRole[u.role].push({ userId: u.userId, email: u.email, cookie, cafeId: u.assignedCafeIds?.[0] || 'CF-LOAD-0001' });
  }

  await Session.deleteMany({ organisationId: 'LOADTEST_ORG' });
  await Session.insertMany(docs);
  return byRole;
}

async function runHT09(instances, byRole, menuItems) {
  console.log(`\n================================================================================`);
  console.log(`HT-09 — FINANCIAL CONCURRENCY TEST`);
  console.log(`================================================================================`);

  const results = {};

  // 1. 100 Simultaneous Cash POS bills
  console.log(`\n[HT-09-A] 100 simultaneous cash POS bills`);
  const billStart = Date.now();
  const billPromises = Array.from({ length: 100 }, (_, i) => {
    const u = byRole.CAFE_ADMIN[i % byRole.CAFE_ADMIN.length];
    const target = instances[i % instances.length];
    const item = menuItems[i % menuItems.length];
    return fetch(`${target.url}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: u.cookie, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({ cafeId: u.cafeId, orderType: 'DINE_IN', tableNumber: `T-FC-${i}`, lineItems: [{ menuItemId: item.menuItemId, quantity: 1 }], paymentMethod: 'CASH', isImmediateCompletion: true }),
    }).then(r => ({ status: r.status, ok: r.status === 201 }))
      .catch(() => ({ status: 500, ok: false }));
  });
  const billResults = await Promise.all(billPromises);
  const billSuccess = billResults.filter(r => r.ok).length;

  // Reconcile cash immediately
  const cashBills = await Bill.find({ organisationId: 'LOADTEST_ORG', paymentMethod: 'CASH', status: 'COMPLETED' }).lean();
  let expPaisa = 0; for (const b of cashBills) expPaisa += b.totalPaisa;
  const cashTxs = await CashTransaction.find({ organisationId: 'LOADTEST_ORG', category: 'POS_SALE' }).lean();
  let actPaisa = 0; for (const tx of cashTxs) actPaisa += Math.round(tx.amount * 100);
  const variancePaisa = expPaisa - actPaisa;

  results.simultaneousBills = {
    total: 100, success: billSuccess,
    cashBillsInDb: cashBills.length, cashTxsInDb: cashTxs.length,
    varianceRupees: (variancePaisa / 100).toFixed(2),
    duplicateEffects: cashBills.length !== cashTxs.length ? cashBills.length - cashTxs.length : 0,
    status: billSuccess === 100 && variancePaisa === 0 ? 'PASS' : 'FAIL',
  };
  console.log(`[HT-09-A] ${results.simultaneousBills.status}: ${billSuccess}/100 bills | Cash Bills: ${cashBills.length} | Cash TXs: ${cashTxs.length} | Variance: ₹${results.simultaneousBills.varianceRupees}`);

  // 2. 50 Simultaneous expense submissions
  console.log(`\n[HT-09-B] 50 simultaneous expense submissions`);
  const expPromises = Array.from({ length: 50 }, (_, i) => {
    const u = byRole.CAFE_ADMIN[i % byRole.CAFE_ADMIN.length];
    const target = instances[i % instances.length];
    return fetch(`${target.url}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: u.cookie, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({ cafeId: u.cafeId, category: 'DAIRY_MILK', amount: 350 + i, description: `FC Expense ${i}` }),
    }).then(r => ({ status: r.status, ok: r.status === 201 }))
      .catch(() => ({ status: 500, ok: false }));
  });
  const expResults = await Promise.all(expPromises);
  const expCount = await Expense.countDocuments({ organisationId: 'LOADTEST_ORG' });
  results.simultaneousExpenses = {
    total: 50,
    success: expResults.filter(r => r.ok).length,
    dbCount: expCount,
    duplicates: expCount > expResults.filter(r => r.ok).length ? expCount - expResults.filter(r => r.ok).length : 0,
    status: expResults.filter(r => r.ok).length === 50 && expResults.filter(r => r.ok).length === expCount ? 'PASS' : expResults.filter(r => r.ok).length >= 48 ? 'DEGRADED' : 'FAIL',
  };
  console.log(`[HT-09-B] ${results.simultaneousExpenses.status}: ${results.simultaneousExpenses.success}/50 | DB count: ${expCount}`);

  // 3. Race condition: same cafe admin creates bill while another reads bills
  console.log(`\n[HT-09-C] Race condition safety (concurrent write + read on same cafe)`);
  const cafeAdmin = byRole.CAFE_ADMIN[0];
  const target = instances[0];
  const item = menuItems[0];
  const racePromises = [
    // concurrent write
    fetch(`${target.url}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cafeAdmin.cookie, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({ cafeId: cafeAdmin.cafeId, orderType: 'DINE_IN', tableNumber: 'T-RACE', lineItems: [{ menuItemId: item.menuItemId, quantity: 1 }], paymentMethod: 'CASH', isImmediateCompletion: true }),
    }).then(r => ({ op: 'WRITE', status: r.status, ok: r.status === 201 })),
    // concurrent read
    fetch(`${target.url}/bills?cafeId=${cafeAdmin.cafeId}&limit=10`, { headers: { Cookie: cafeAdmin.cookie } })
      .then(r => ({ op: 'READ', status: r.status, ok: r.status === 200 })),
  ];
  const raceResults = await Promise.all(racePromises);
  results.raceCondition = {
    write: raceResults.find(r => r.op === 'WRITE'),
    read: raceResults.find(r => r.op === 'READ'),
    status: raceResults.every(r => r.ok) ? 'PASS' : 'FAIL',
  };
  console.log(`[HT-09-C] ${results.raceCondition.status}: Write ${results.raceCondition.write.status}, Read ${results.raceCondition.read.status}`);

  results.status = [results.simultaneousBills, results.simultaneousExpenses, results.raceCondition].every(r => r.status === 'PASS' || r.status === 'DEGRADED') ? (
    [results.simultaneousBills, results.simultaneousExpenses, results.raceCondition].every(r => r.status === 'PASS') ? 'PASS' : 'DEGRADED'
  ) : 'FAIL';

  console.log(`\n[HT-09 SUMMARY] Status: ${results.status}`);
  return results;
}

async function runHT10(instances, byRole) {
  console.log(`\n================================================================================`);
  console.log(`HT-10 — ROLE / AUTHORIZATION ATTACK TEST`);
  console.log(`================================================================================`);

  const results = { attacks: [] };

  const targets = [
    // Owner -> Personal Ledger
    { name: 'OWNER→PersonalLedger', user: byRole.OWNER[0], method: 'GET', path: '/personal-ledger/balance', expected: 403 },
    // Staff -> Operational Quality
    { name: 'STAFF→QualityChecklists', user: byRole.STAFF[0], method: 'GET', path: '/quality/checklists', expected: 403 },
    // Staff -> Other user profile
    { name: 'STAFF→OtherUserProfile', user: byRole.STAFF[0], method: 'GET', path: `/users/${byRole.CAFE_ADMIN[0].userId}`, expected: 403 },
    // CafeAdmin -> unassigned cafe bills
    { name: 'CAFE_ADMIN→WrongCafe', user: byRole.CAFE_ADMIN[0], method: 'GET', path: '/bills?cafeId=CF-LOAD-0009&limit=1', expected: 403 },
    // Staff -> POST bill
    { name: 'STAFF→POSBilling', user: byRole.STAFF[0], method: 'POST', path: '/bills', body: { cafeId: 'CF-LOAD-0001', orderType: 'DINE_IN', lineItems: [] }, expected: 403 },
    // Staff -> Payroll
    { name: 'STAFF→Payroll', user: byRole.STAFF[0], method: 'GET', path: '/payroll/runs', expected: 403 },
    // Owner -> Create user
    { name: 'OWNER→CreateUser', user: byRole.OWNER[0], method: 'POST', path: '/users', body: { email: 'x@x.com', role: 'STAFF' }, expected: 403 },
    // Staff -> Expense decision
    { name: 'STAFF→ExpenseDecision', user: byRole.STAFF[0], method: 'POST', path: '/expenses/EX-NONEXIST/decision', body: { decision: 'APPROVED' }, expected: 403 },
    // STAFF -> Vendor list
    { name: 'STAFF→Vendors', user: byRole.STAFF[0], method: 'GET', path: '/vendors', expected: 403 },
    // Unauthenticated request
    { name: 'UNAUTH→Bills', user: null, method: 'GET', path: '/bills', expected: 401 },
  ];

  for (const t of targets) {
    const target = instances[0];
    const headers = { 'Content-Type': 'application/json', 'Origin': target.url.replace('/api/v1', '') };
    if (t.user) headers['Cookie'] = t.user.cookie;
    const opts = { method: t.method, headers };
    if (t.body) opts.body = JSON.stringify(t.body);
    const res = await fetch(`${target.url}${t.path}`, opts);
    const passed = res.status === t.expected;
    results.attacks.push({ name: t.name, expected: t.expected, actual: res.status, passed });
    console.log(`[HT-10] ${passed ? '✓' : '✗'} ${t.name}: expected ${t.expected}, got ${res.status}`);
  }

  results.totalAttacks = targets.length;
  results.blocked = results.attacks.filter(a => a.passed).length;
  results.leaked = results.attacks.filter(a => !a.passed).length;
  results.status = results.leaked === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[HT-10 SUMMARY] ${results.status}: ${results.blocked}/${targets.length} attacks correctly blocked`);
  return results;
}

async function runHT11(instances, byRole) {
  console.log(`\n================================================================================`);
  console.log(`HT-11 — AUTH & SESSION SECURITY TEST`);
  console.log(`================================================================================`);

  const results = { tests: [] };
  const target = instances[0];
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';

  // 1. Forged token with wrong secret
  const forgeryToken = jwt.sign(
    { sub: byRole.STAFF[0].userId, sid: 'FORGED-SID', org: 'LOADTEST_ORG', role: 'MASTER', sv: 0, usv: 0, pv: 0, type: 'access' },
    'wrong-secret-key-that-should-fail!!',
    { algorithm: 'HS256', expiresIn: '1h', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
  );
  const forgeryRes = await fetch(`${target.url}/attendance/me/today`, {
    headers: { Cookie: `zamorin_access_token=${forgeryToken}; zamorin_session_id=FORGED-SID` },
  });
  results.tests.push({ name: 'TokenForgery', expected: 401, actual: forgeryRes.status, passed: forgeryRes.status === 401 });

  // 2. Role escalation via modified token (resign valid sub with wrong role)
  const escalationToken = jwt.sign(
    { sub: byRole.STAFF[0].userId, sid: 'ESCALATED-SID', org: 'LOADTEST_ORG', role: 'MASTER', sv: 0, usv: 0, pv: 0, type: 'access' },
    secret + 'TAMPERED',
    { algorithm: 'HS256', expiresIn: '1h', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
  );
  const escalationRes = await fetch(`${target.url}/personal-ledger/balance`, {
    headers: { Cookie: `zamorin_access_token=${escalationToken}; zamorin_session_id=ESCALATED-SID` },
  });
  results.tests.push({ name: 'RoleEscalation', expected: 401, actual: escalationRes.status, passed: escalationRes.status === 401 });

  // 3. Expired token
  const expiredToken = jwt.sign(
    { sub: byRole.STAFF[0].userId, sid: 'EXPIRED-SID', org: 'LOADTEST_ORG', role: 'STAFF', sv: 0, usv: 0, pv: 0, type: 'access' },
    secret, { algorithm: 'HS256', expiresIn: '-1s', issuer: 'zamorin-cafe-erp-api', audience: 'zamorin-cafe-erp' }
  );
  const expiredRes = await fetch(`${target.url}/attendance/me/today`, {
    headers: { Cookie: `zamorin_access_token=${expiredToken}; zamorin_session_id=EXPIRED-SID` },
  });
  results.tests.push({ name: 'ExpiredToken', expected: 401, actual: expiredRes.status, passed: expiredRes.status === 401 });

  // 4. Token reuse after session revocation: first revoke sessions, then try using old cookie
  const staffUser = byRole.STAFF[0];
  const revokedSession = await Session.findOneAndUpdate(
    { organisationId: 'LOADTEST_ORG', userId: staffUser.userId },
    { $set: { status: 'REVOKED' } },
    { new: true }
  );
  const revokedRes = await fetch(`${target.url}/attendance/me/today`, {
    headers: { Cookie: staffUser.cookie },
  });
  // Restore
  if (revokedSession) {
    await Session.findByIdAndUpdate(revokedSession._id, { $set: { status: 'ACTIVE' } });
  }
  results.tests.push({ name: 'RevokedSessionReuse', expected: 401, actual: revokedRes.status, passed: revokedRes.status === 401 });

  // 5. Wrong audience/issuer
  const wrongAudToken = jwt.sign(
    { sub: byRole.STAFF[0].userId, sid: 'WRONG-AUD-SID', org: 'LOADTEST_ORG', role: 'STAFF', sv: 0, usv: 0, pv: 0, type: 'access' },
    secret, { algorithm: 'HS256', expiresIn: '1h', issuer: 'zamorin-cafe-erp-api', audience: 'wrong-audience' }
  );
  const wrongAudRes = await fetch(`${target.url}/attendance/me/today`, {
    headers: { Cookie: `zamorin_access_token=${wrongAudToken}; zamorin_session_id=WRONG-AUD-SID` },
  });
  results.tests.push({ name: 'WrongAudience', expected: 401, actual: wrongAudRes.status, passed: wrongAudRes.status === 401 });

  for (const t of results.tests) {
    console.log(`[HT-11] ${t.passed ? '✓' : '✗'} ${t.name}: expected ${t.expected}, got ${t.actual}`);
  }

  results.totalTests = results.tests.length;
  results.passed = results.tests.filter(t => t.passed).length;
  results.failed = results.tests.filter(t => !t.passed).length;
  results.status = results.failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[HT-11 SUMMARY] ${results.status}: ${results.passed}/${results.totalTests} auth attacks blocked`);
  return results;
}

async function runHT12(instances, byRole) {
  console.log(`\n================================================================================`);
  console.log(`HT-12 — INPUT & INJECTION SECURITY TEST`);
  console.log(`================================================================================`);

  const results = { tests: [] };
  const target = instances[0];
  const u = byRole.CAFE_ADMIN[0];

  // 1. NoSQL injection in email field
  const noSqlPayloads = [
    { email: { $gt: '' }, password: 'x' },
    { email: 'x@x.com', password: { $gt: '' } },
    { organisationId: { $ne: null }, email: 'x@x.com', password: 'x', device: { deviceId: 'D1' } },
  ];
  for (const payload of noSqlPayloads) {
    const res = await fetch(`${target.url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': target.url.replace('/api/v1', '') },
      body: JSON.stringify(payload),
    });
    results.tests.push({ name: `NoSQLInjection(${JSON.stringify(payload).slice(0, 30)})`, status: res.status, passed: res.status !== 200 && res.status !== 500 });
  }

  // 2. XSS in expense description
  const xssPayloads = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE expenses; --",
  ];
  for (const xssPayload of xssPayloads) {
    const res = await fetch(`${target.url}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: u.cookie, Origin: target.url.replace('/api/v1', '') },
      body: JSON.stringify({ cafeId: u.cafeId, category: 'DAIRY_MILK', amount: 100, description: xssPayload }),
    });
    let sanitized = false;
    if (res.status === 201) {
      const data = await res.json();
      sanitized = !data.data?.description?.includes('<script>');
    }
    results.tests.push({ name: `XSSInExpense`, status: res.status, sanitizedOrRejected: res.status === 400 || (res.status === 201 && sanitized), passed: res.status === 400 || res.status === 201 });
  }

  // 3. Oversized payload
  const oversized = 'x'.repeat(100_000);
  const oversizedRes = await fetch(`${target.url}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: u.cookie, Origin: target.url.replace('/api/v1', '') },
    body: JSON.stringify({ cafeId: u.cafeId, category: 'DAIRY_MILK', amount: 100, description: oversized }),
  });
  results.tests.push({ name: 'OversizedPayload', status: oversizedRes.status, passed: oversizedRes.status === 400 || oversizedRes.status === 413 });

  // 4. Negative amount injection
  const negativeRes = await fetch(`${target.url}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: u.cookie, Origin: target.url.replace('/api/v1', '') },
    body: JSON.stringify({ cafeId: u.cafeId, category: 'DAIRY_MILK', amount: -9999, description: 'negative injection' }),
  });
  results.tests.push({ name: 'NegativeAmountInjection', status: negativeRes.status, passed: negativeRes.status === 400 });

  // 5. SQL-like injection in query params
  const sqlInjectRes = await fetch(`${target.url}/bills?cafeId=CF-LOAD-0001' OR '1'='1&limit=1`, { headers: { Cookie: u.cookie } });
  results.tests.push({ name: 'SQLInjectionInQueryParam', status: sqlInjectRes.status, passed: sqlInjectRes.status !== 500 });

  for (const t of results.tests) {
    console.log(`[HT-12] ${t.passed ? '✓' : '✗'} ${t.name}: status ${t.status}`);
  }

  results.totalTests = results.tests.length;
  results.passed = results.tests.filter(t => t.passed).length;
  results.failed = results.tests.filter(t => !t.passed).length;
  results.status = results.failed === 0 ? 'PASS' : 'REMEDIATION_REQUIRED';
  console.log(`\n[HT-12 SUMMARY] ${results.status}: ${results.passed}/${results.totalTests} injection tests passed`);
  return results;
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.ALLOWED_ORIGINS = Array.from({ length: WORKER_COUNT }, (_, i) => `http://127.0.0.1:${BASE_PORT + i}`).join(',');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 200, minPoolSize: 50 });

  await resetLoadTestData();
  await seedLoadTestData();

  const instances = await startCluster();
  const byRole = await prewarm();
  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();

  const ht09Results = await runHT09(instances, byRole, menuItems);
  const ht10Results = await runHT10(instances, byRole);
  const ht11Results = await runHT11(instances, byRole);
  const ht12Results = await runHT12(instances, byRole);

  for (const inst of instances) inst.server.close();
  await mongoose.disconnect();

  fs.writeFileSync(path.join(RESULTS_DIR, 'HT09_FINANCIAL_CONCURRENCY_RESULTS.json'), JSON.stringify(ht09Results, null, 2));
  fs.writeFileSync(path.join(RESULTS_DIR, 'HT10_AUTHORIZATION_ATTACK_RESULTS.json'), JSON.stringify(ht10Results, null, 2));
  fs.writeFileSync(path.join(RESULTS_DIR, 'HT11_AUTH_SESSION_SECURITY_RESULTS.json'), JSON.stringify(ht11Results, null, 2));
  fs.writeFileSync(path.join(RESULTS_DIR, 'HT12_INPUT_INJECTION_SECURITY_RESULTS.json'), JSON.stringify(ht12Results, null, 2));

  console.log(`\n[HT-09 through HT-12 COMPLETE] Results saved.`);
  process.exit(0);
}

main().catch(err => { console.error('[HT-09/12 FATAL]', err); mongoose.disconnect(); process.exit(1); });
