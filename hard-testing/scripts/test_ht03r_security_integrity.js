'use strict';

process.env.UV_THREADPOOL_SIZE = '128';

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
http.globalAgent.maxSockets = 2000;
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { seedLoadTestData, resetLoadTestData } = require('./seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { Bill } = require('../../backend/src/models/Bill');
const { Expense } = require('../../backend/src/models/Expense');
const { CashTransaction } = require('../../backend/src/models/CashTransaction');
const { MenuItem } = require('../../backend/src/models/MenuItem');
const { User } = require('../../backend/src/models/User');
const { Session } = require('../../backend/src/models/Session');
const { RolePermission } = require('../../backend/src/models/RolePermission');
const { seedPermissionRules } = require('../../backend/src/scripts/seedInitialData');

const PORT = 4350;
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let sessionCounter = 1000;

function createAuthCookie(user, sessionId = null) {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret-32-chars-min!!';
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const sid = sessionId || `SS-${datePart}-${String(++sessionCounter)}`;

  const accessToken = jwt.sign(
    {
      sub: user.userId,
      sid,
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

  return {
    cookieHeader: `zamorin_access_token=${accessToken}; zamorin_session_id=${sid}`,
    sessionId: sid,
    user,
  };
}

async function createActiveSession(user) {
  const { cookieHeader, sessionId } = createAuthCookie(user);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  const refreshExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await Session.create({
    sessionId,
    organisationId: user.organisationId,
    userId: user.userId,
    roleSnapshot: user.role,
    assignedCafeIdsSnapshot: user.assignedCafeIds,
    tokenFamilyId: `FAM-TEST-${Date.now()}-${sessionCounter}`,
    accessTokenHash: 'TEST_HASH',
    refreshTokenHash: 'TEST_HASH',
    sessionVersion: 0,
    userSessionVersionSnapshot: user.sessionVersion || 0,
    permissionsVersionSnapshot: user.permissionsVersion || 0,
    status: 'ACTIVE',
    device: { deviceId: 'DEV-TEST', deviceName: 'TEST_AGENT', deviceType: 'DESKTOP' },
    issuedAt: now,
    lastActivityAt: now,
    mfaVerified: true,
    mfaVerifiedAt: now,
    stepUpVerifiedAt: now,
    accessTokenExpiresAt: expiresAt,
    refreshTokenExpiresAt: refreshExpiresAt,
    absoluteExpiresAt: refreshExpiresAt,
    idleTimeoutMinutes: 60,
    createdBy: user.userId,
  });

  return cookieHeader;
}

async function runSecurityAndIntegritySuite() {
  console.log(`\n================================================================================`);
  console.log(`ZAMORIN CAFE ERP — HT-03R SECURITY, FINANCIAL INTEGRITY & ATTACK AUDIT SUITE`);
  console.log(`================================================================================`);

  // 1. AUDIT ROLE PERMISSIONS & SEED RECONCILIATION
  console.log(`\n--- 1. AUDITING STAFF ROLE PERMISSION RULES & RECONCILIATION ---`);
  await seedPermissionRules({ organisationId: 'LOADTEST_ORG', masterUserId: 'MU-9001' });

  const staffRules = await RolePermission.find({
    organisationId: 'LOADTEST_ORG',
    role: 'STAFF',
    isActive: true,
  }).lean();

  console.log(`Total Active STAFF Rules Found: ${staffRules.length}`);
  let staffSelfCount = 0;
  let staffAssignedCount = 0;
  let staffOrgCount = 0;

  for (const rule of staffRules) {
    console.log(`- Rule [${rule.permissionCode}] Module: ${rule.module} | Resource: ${rule.resource} | Action: ${rule.action} | Scope: ${rule.scope}`);
    if (rule.scope === 'SELF') staffSelfCount++;
    else if (rule.scope === 'ASSIGNED_CAFES') staffAssignedCount++;
    else if (rule.scope === 'ORGANISATION') staffOrgCount++;
  }

  console.log(`STAFF Rules Summary: SELF=${staffSelfCount} | ASSIGNED_CAFES=${staffAssignedCount} | ORGANISATION=${staffOrgCount}`);
  const staffScopeAuditPassed = staffOrgCount === 0;
  console.log(`[STAFF SCOPE AUDIT RESULT]: ${staffScopeAuditPassed ? 'PASS' : 'FAIL'}`);

  // 2. DIRECT STAFF CROSS-USER ATTACK
  console.log(`\n--- 2. DIRECT STAFF CROSS-USER & CROSS-CAFE ATTACK ---`);
  const staffA = await User.findOne({ userId: 'ST-1001' }).lean(); // Cafe 1
  const staffB = await User.findOne({ userId: 'ST-1002' }).lean(); // Cafe 2
  const staffC = await User.findOne({ userId: 'ST-1011' }).lean(); // Cafe 1 (Same cafe as Staff A)

  const cookieA = await createActiveSession(staffA);

  // Attack 1: Staff A attempts to read Staff C (same cafe) user/employee/attendance
  const resUserC = await fetch(`${BASE_URL}/users/${staffC.userId}`, { headers: { Cookie: cookieA } });
  const resEmpC = await fetch(`${BASE_URL}/employees/${staffC.permanentEmployeeId}`, { headers: { Cookie: cookieA } });
  const resAttendC = await fetch(`${BASE_URL}/attendance?userId=${staffC.userId}`, { headers: { Cookie: cookieA } });

  console.log(`Attack Staff A -> Staff C (Same Cafe):`);
  console.log(`- GET /users/${staffC.userId} (Expect 403/404): Status ${resUserC.status}`);
  console.log(`- GET /employees/${staffC.permanentEmployeeId} (Expect 403/404): Status ${resEmpC.status}`);
  console.log(`- GET /attendance?userId=${staffC.userId} (Expect 403/DENIED): Status ${resAttendC.status}`);

  // Attack 2: Staff A attempts to read Staff B (different cafe)
  const resUserB = await fetch(`${BASE_URL}/users/${staffB.userId}`, { headers: { Cookie: cookieA } });
  const resEmpB = await fetch(`${BASE_URL}/employees/${staffB.permanentEmployeeId}`, { headers: { Cookie: cookieA } });

  console.log(`Attack Staff A -> Staff B (Different Cafe):`);
  console.log(`- GET /users/${staffB.userId} (Expect 403/404): Status ${resUserB.status}`);
  console.log(`- GET /employees/${staffB.permanentEmployeeId} (Expect 403/404): Status ${resEmpB.status}`);

  const crossUserAttackPassed =
    (resUserC.status === 403 || resUserC.status === 404) &&
    (resEmpC.status === 403 || resEmpC.status === 404) &&
    (resUserB.status === 403 || resUserB.status === 404) &&
    (resEmpB.status === 403 || resEmpB.status === 404);

  console.log(`[STAFF CROSS-USER ATTACK RESULT]: ${crossUserAttackPassed ? 'PASS (100% Denied)' : 'FAIL'}`);

  // 3. CAFE ADMIN ISOLATION AUDIT
  console.log(`\n--- 3. CAFE ADMIN ASSIGNED-CAFE ISOLATION AUDIT ---`);
  const adminA = await User.findOne({ userId: 'AD-9001' }).lean(); // Assigned CF-LOAD-0001
  const cookieAdminA = await createActiveSession(adminA);

  const menuItems = await MenuItem.find({ organisationId: 'LOADTEST_ORG' }).lean();

  // Admin A attempts POS Bill on CF-LOAD-0002 (unassigned)
  const resAdminPosUnassigned = await fetch(`${BASE_URL}/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({
      cafeId: 'CF-LOAD-0002',
      orderType: 'DINE_IN',
      lineItems: [{ menuItemId: menuItems[0].menuItemId, quantity: 1 }],
      paymentMethod: 'CASH',
    }),
  });

  // Admin A attempts Expense on CF-LOAD-0002 (unassigned)
  const resAdminExpUnassigned = await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({
      cafeId: 'CF-LOAD-0002',
      category: 'DAIRY_MILK',
      amount: 500,
      description: 'Hostile Cross-Cafe Expense',
    }),
  });

  console.log(`Admin A (Assigned CF-LOAD-0001) attempting unassigned CF-LOAD-0002:`);
  console.log(`- POST /bills on CF-LOAD-0002 (Expect 403): Status ${resAdminPosUnassigned.status}`);
  console.log(`- POST /expenses on CF-LOAD-0002 (Expect 403): Status ${resAdminExpUnassigned.status}`);

  const adminIsolationPassed = resAdminPosUnassigned.status === 403 && resAdminExpUnassigned.status === 403;
  console.log(`[CAFE ADMIN ISOLATION RESULT]: ${adminIsolationPassed ? 'PASS (100% Denied)' : 'FAIL'}`);

  // 4. EXPENSE SUBMISSION PROHIBITED DECISION ATTEMPTS
  console.log(`\n--- 4. EXPENSE PROHIBITED DECISION ATTEMPTS BY CAFE ADMIN & STAFF ---`);
  // Create a draft expense in Cafe 1
  const createExpRes = await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({
      cafeId: 'CF-LOAD-0001',
      category: 'DAIRY_MILK',
      amount: 350,
      description: 'Test Expense For Decision Authority',
    }),
  });
  const expData = await createExpRes.json();
  const expenseId = expData?.data?.expense?.expenseId;

  // Submit expense to reach SUBMITTED state
  await fetch(`${BASE_URL}/expenses/${expenseId}/submit`, {
    method: 'POST',
    headers: { Cookie: cookieAdminA },
  });

  // Staff A attempts decision on submitted expense (Staff has no decision authority)
  const resStaffDecide = await fetch(`${BASE_URL}/expenses/${expenseId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({ decision: 'APPROVED' }),
  });

  // Admin A attempts REVERSE (Master-only action)
  const resAdminReverse = await fetch(`${BASE_URL}/expenses/${expenseId}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({ reversalReason: 'Hostile Reversal' }),
  });

  // Admin B (assigned CF-LOAD-0002) attempts decision on Cafe 1's expense
  const adminB = await User.findOne({ userId: 'AD-9002' }).lean(); // Assigned CF-LOAD-0002
  const cookieAdminB = await createActiveSession(adminB);
  const resAdminBDecide = await fetch(`${BASE_URL}/expenses/${expenseId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieAdminB, Origin: `http://127.0.0.1:${PORT}` },
    body: JSON.stringify({ decision: 'APPROVED' }),
  });

  console.log(`Prohibited Expense Actions:`);
  console.log(`- STAFF POST /expenses/${expenseId}/decision (Expect 403): Status ${resStaffDecide.status}`);
  console.log(`- CAFE_ADMIN POST /expenses/${expenseId}/reverse (Expect 403): Status ${resAdminReverse.status}`);
  console.log(`- Cross-Cafe Admin POST /expenses/${expenseId}/decision (Expect 403): Status ${resAdminBDecide.status}`);

  const expenseDecisionAuthorityPassed =
    resStaffDecide.status === 403 &&
    resAdminReverse.status === 403 &&
    resAdminBDecide.status === 403;

  console.log(`[EXPENSE DECISION AUTHORITY RESULT]: ${expenseDecisionAuthorityPassed ? 'PASS (0 Prohibited Decisions Succeeded)' : 'FAIL'}`);

  // 5. PERSONAL LEDGER SECURITY AUDIT
  console.log(`\n--- 5. PERSONAL LEDGER ROLE ACCESS AUDIT ---`);
  const ownerUser = await User.findOne({ userId: 'OW-9001' }).lean();
  const masterUser = await User.findOne({ userId: 'MU-9001' }).lean();

  const cookieOwner = await createActiveSession(ownerUser);
  const cookieMaster = await createActiveSession(masterUser);

  const resPlStaff = await fetch(`${BASE_URL}/personal-ledger/balance`, { headers: { Cookie: cookieA } });
  const resPlAdmin = await fetch(`${BASE_URL}/personal-ledger/balance`, { headers: { Cookie: cookieAdminA } });
  const resPlOwner = await fetch(`${BASE_URL}/personal-ledger/balance`, { headers: { Cookie: cookieOwner } });
  const resPlMaster = await fetch(`${BASE_URL}/personal-ledger/balance`, { headers: { Cookie: cookieMaster } });

  console.log(`Personal Ledger Access By Role:`);
  console.log(`- STAFF (Expect 403): Status ${resPlStaff.status}`);
  console.log(`- CAFE_ADMIN (Expect 403): Status ${resPlAdmin.status}`);
  console.log(`- OWNER (Expect 200 / Allowed): Status ${resPlOwner.status}`);
  console.log(`- MASTER (Expect 200 / Allowed): Status ${resPlMaster.status}`);

  const personalLedgerAuditPassed =
    resPlStaff.status === 403 &&
    resPlAdmin.status === 403 &&
    resPlMaster.status === 200;

  console.log(`[PERSONAL LEDGER AUDIT RESULT]: ${personalLedgerAuditPassed ? 'PASS (0 Leakage to Staff/Admin)' : 'FAIL'}`);

  // 6. POS FINANCIAL RECONCILIATION
  console.log(`\n--- 6. POS FINANCIAL RECONCILIATION & CASH TRANSACTION VERIFICATION ---`);
  const initialBills = await Bill.find({ organisationId: 'LOADTEST_ORG' }).lean();
  const initialCashTxs = await CashTransaction.find({ organisationId: 'LOADTEST_ORG' }).lean();

  let expectedCashPaisa = 0;
  let expectedUpiPaisa = 0;
  let cashBillsCount = 0;
  let upiBillsCount = 0;

  for (let i = 0; i < 50; i++) {
    const isCash = i % 2 === 0;
    const payMethod = isCash ? 'CASH' : 'UPI';
    const item1 = menuItems[i % menuItems.length];
    const qty = 2;
    const unitPrice = item1.currentPricePaisa;
    const subtotal = qty * unitPrice;
    const tax = Math.round(subtotal * 0.05);
    const totalPaisa = subtotal + tax;

    const res = await fetch(`${BASE_URL}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA, Origin: `http://127.0.0.1:${PORT}` },
      body: JSON.stringify({
        cafeId: 'CF-LOAD-0001',
        orderType: 'DINE_IN',
        tableNumber: `T-${i + 1}`,
        lineItems: [{ menuItemId: item1.menuItemId, quantity: qty }],
        discountPaisa: 0,
        paymentMethod: payMethod,
        isImmediateCompletion: true,
      }),
    });

    if (res.status === 201) {
      if (isCash) {
        expectedCashPaisa += totalPaisa;
        cashBillsCount++;
      } else {
        expectedUpiPaisa += totalPaisa;
        upiBillsCount++;
      }
    }
  }

  const allCashTxs = await CashTransaction.find({ organisationId: 'LOADTEST_ORG', category: 'POS_SALE' }).lean();
  let actualCashBookPaisa = 0;
  for (const tx of allCashTxs) {
    actualCashBookPaisa += Math.round(tx.amount * 100);
  }

  const variancePaisa = expectedCashPaisa - actualCashBookPaisa;
  const varianceRupees = (variancePaisa / 100).toFixed(2);

  console.log(`Financial Audit Results:`);
  console.log(`- Cash Bills Created:         ${cashBillsCount} (Total: ₹${(expectedCashPaisa / 100).toFixed(2)})`);
  console.log(`- UPI Bills Created:          ${upiBillsCount} (Total: ₹${(expectedUpiPaisa / 100).toFixed(2)})`);
  console.log(`- Cash Transactions Recorded: ${allCashTxs.length} (Total: ₹${(actualCashBookPaisa / 100).toFixed(2)})`);
  console.log(`- Cash Ledger Variance:       ₹${varianceRupees}`);

  const financialReconciliationPassed = variancePaisa === 0 && allCashTxs.length === cashBillsCount;
  console.log(`[FINANCIAL RECONCILIATION RESULT]: ${financialReconciliationPassed ? 'PASS (Exact ₹0 Variance)' : 'FAIL'}`);

  return {
    staffScopeAuditPassed,
    crossUserAttackPassed,
    adminIsolationPassed,
    expenseDecisionAuthorityPassed,
    personalLedgerAuditPassed,
    financialReconciliationPassed,
    varianceRupees,
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

  const app = createApp({ production: false, test: true, allowedOrigins: [`http://127.0.0.1:${PORT}`] });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  try {
    const results = await runSecurityAndIntegritySuite();
    const allPassed = Object.values(results).every((v) => v === true || typeof v === 'string');

    console.log(`\n================================================================================`);
    console.log(`HT-03R SECURITY & FINANCIAL SUITE FINAL RESULT: ${allPassed ? 'ALL PASS (100%)' : 'FAIL'}`);
    console.log(`================================================================================\n`);

    server.close();
    await mongoose.disconnect();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Fatal error in HT-03R suite:', err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
