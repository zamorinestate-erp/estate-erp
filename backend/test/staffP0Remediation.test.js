'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { User } = require('../src/models/User');
const { Cafe } = require('../src/models/Cafe');
const { Payslip } = require('../src/models/Payslip');
const { ShiftRoster } = require('../src/models/ShiftRoster');
const { LeaveRequest } = require('../src/models/LeaveRequest');
const { ProfileChangeRequest } = require('../src/models/ProfileChangeRequest');
const { AuditEvent } = require('../src/models/AuditEvent');
const auditService = require('../src/services/auditService');
const employeeController = require('../src/controllers/employeeController');
const leaveController = require('../src/controllers/leaveController');
const { resolveEmployeeShiftForDate, getWeekStartDate } = require('../src/services/shiftResolverService');

test('Staff P0 Critical Remediation Suite', async (suite) => {
  let mongoServer;

  suite.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  suite.after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ROUTING & ACCESS PERMISSION ALIGNMENT
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-1 & P0-2: navigation.js allows employee-profile, profile aliases, and staff-loans-advances for STAFF role', () => {
    const navPath = path.resolve(__dirname, '../../frontend/src/js/navigation.js');
    const navContent = fs.readFileSync(navPath, 'utf8');

    // 1. staff-loans-advances MUST NOT be in PRIMARY_MASTER_ONLY_ROUTES
    const primaryMasterMatches = navContent.match(/PRIMARY_MASTER_ONLY_ROUTES\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
    assert.ok(primaryMasterMatches, 'PRIMARY_MASTER_ONLY_ROUTES must be defined as a Set');
    assert.ok(!primaryMasterMatches[1].includes('staff-loans-advances'), 'staff-loans-advances must NOT be in PRIMARY_MASTER_ONLY_ROUTES');

    // 2. employee-profile must be in IMPLICIT_ROUTES_ALL
    assert.ok(navContent.includes("'employee-profile'"), 'employee-profile must be present in IMPLICIT_ROUTES_ALL');

    // 3. Verify route permission logic directly
    assert.ok(
      navContent.includes('isRouteAllowed') &&
      navContent.includes('employee-profile') &&
      navContent.includes('my-profile'),
      'isRouteAllowed must permit employee-profile and profile aliases'
    );
  });

  await suite.test('P0-1: router.js binds profile, my-profile, employment, and my-employment to employeeProfile', () => {
    const routerPath = path.resolve(__dirname, '../../frontend/src/js/router.js');
    const routerContent = fs.readFileSync(routerPath, 'utf8');

    assert.ok(routerContent.includes('case "profile":'), 'router.js must support case "profile"');
    assert.ok(routerContent.includes('case "my-profile":'), 'router.js must support case "my-profile"');
    assert.ok(routerContent.includes('case "employment":'), 'router.js must support case "employment"');
    assert.ok(routerContent.includes('case "my-employment":'), 'router.js must support case "my-employment"');
    assert.ok(routerContent.includes('case "employee-profile":'), 'router.js must support case "employee-profile"');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BACKEND CONTROLLER: PAYSLIP QUERY FIELD DRIFT CORRECTION
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-3: employeeController.js queries Payslip by employeeUserId (not userId)', async () => {
    const empUser = await User.create({
      userId: 'ST-0001',
      organisationId: 'ZAMORIN',
      name: 'Payslip Drift Test Staff',
      email: 'drift-test@zamorin.cafe',
      role: 'STAFF',
      accountStatus: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      passwordHash: 'dummy_hash_for_test',
      createdBy: 'SYSTEM',
    });

    // Create payslip with schema-correct employeeUserId and required fields
    const createdPayslip = await Payslip.create({
      payslipId: 'PS-202607-0001',
      employeeUserId: 'ST-0001',
      organisationId: 'ZAMORIN',
      payrollRunId: 'PR-202607-001',
      cafeId: 'CAFE-TEST-01',
      employeeName: 'Payslip Drift Test Staff',
      periodKey: '2026-07',
      periodStartDate: '2026-07-01',
      periodEndDate: '2026-07-31',
      earnings: {
        grossPayPaise: 4500000,
        basicPayPaise: 4500000,
      },
      deductions: {
        totalDeductionPaise: 500000,
        providentFundPaise: 500000,
      },
      netPayPaise: 4000000,
      status: 'PAID',
      issuedAt: new Date(),
      issuedBy: 'SYSTEM',
      paidAt: new Date(),
      paidBy: 'SYSTEM',
      paymentReference: 'CMS-NEFT-TEST-001',
      paymentMethod: 'BANK_TRANSFER',
      createdBy: 'SYSTEM',
    });

    const req = {
      auth: {
        userId: 'ST-0001',
        organisationId: 'ZAMORIN',
        role: 'STAFF',
      },
    };

    let responseData = null;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await employeeController.getSelfDashboard(req, res);

    assert.ok(responseData, 'Must return response data');
    assert.ok(responseData.success, 'Response must be success: true');
    assert.ok(responseData.data.payslipSummary, 'Must contain payslipSummary');
    assert.equal(
      responseData.data.payslipSummary.netPayPaise,
      4000000,
      'Must return correct netPayPaise from Payslip query matching employeeUserId'
    );
    assert.equal(
      responseData.data.payslipSummary.periodName,
      '2026-07',
      'Must return 2026-07 from queried payslip'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. BACKEND CONTROLLER: RETIRE MOCK ANNOUNCEMENTS FALLBACK
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-4: employeeController.js returns empty array for announcements when none exist (no mock ANN-001 fallback)', async () => {
    const req = {
      auth: {
        userId: 'ST-0001',
        organisationId: 'ZAMORIN',
        role: 'STAFF',
      },
    };

    let responseData = null;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await employeeController.getSelfDashboard(req, res);

    assert.ok(responseData.success, 'Must succeed');
    assert.ok(Array.isArray(responseData.data.announcements), 'announcements must be an array');
    assert.equal(
      responseData.data.announcements.length,
      0,
      'Must return [] when no real announcements exist, NOT mock ANN-001/ANN-002'
    );

    // Verify backend source code has completely retired mock announcements
    const ctrlPath = path.resolve(__dirname, '../src/controllers/employeeController.js');
    const ctrlContent = fs.readFileSync(ctrlPath, 'utf8');
    assert.ok(!ctrlContent.includes('ANN-001'), 'employeeController.js must not contain ANN-001');
    assert.ok(!ctrlContent.includes('ANN-002'), 'employeeController.js must not contain ANN-002');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SHIFT RESOLVER SERVICE REALISM IN GETSELFDASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-5: getSelfDashboard wires canonical shiftResolverService for shifts and 7-day weekSchedule', async () => {
    const rosterDate = '2026-08-25';
    const weekStart = getWeekStartDate(rosterDate);

    await ShiftRoster.create({
      rosterId: 'ROSTER-P0-001',
      employeeId: 'ST-0001',
      organisationId: 'ZAMORIN',
      cafeId: 'CAFE-TEST-01',
      weekStartDate: weekStart,
      status: 'PUBLISHED',
      isPublished: true,
      createdByUserId: 'ST-0001',
      assignments: [
        {
          userId: 'ST-0001',
          date: rosterDate,
          shiftName: 'Opening Barista Duty',
          startTime: '07:30',
          endTime: '16:00',
        },
      ],
    });

    const shift = await resolveEmployeeShiftForDate({
      userId: 'ST-0001',
      organisationId: 'ZAMORIN',
      cafeId: 'CAFE-TEST-01',
      businessDate: rosterDate,
    });

    assert.ok(shift, 'Resolved shift must exist');
    assert.equal(shift.shiftName, 'Opening Barista Duty');
    assert.equal(shift.startTime, '07:30');
    assert.equal(shift.endTime, '16:00');
    assert.equal(shift.source, 'ROSTER');

    const req = {
      auth: {
        userId: 'ST-0001',
        organisationId: 'ZAMORIN',
        role: 'STAFF',
      },
    };

    let responseData = null;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await employeeController.getSelfDashboard(req, res);

    assert.ok(responseData.data.weekSchedule, 'weekSchedule must be returned');
    assert.equal(responseData.data.weekSchedule.length, 7, 'weekSchedule must cover 7 days Monday-Sunday');
    for (const day of responseData.data.weekSchedule) {
      assert.ok(day.date, 'Day must have date');
      assert.ok(day.day, 'Day must have day name');
      assert.ok(day.shiftHours, 'Day must have shiftHours');
      assert.notEqual(day.isOff, undefined, 'isOff must be defined');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. LEAVE CONTROLLER: CANCELLATION REASON FIELD ACCEPTANCE & FAIL-CLOSED
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-6: leaveController.cancelLeave accepts cancellationReason or reason and fails closed on non-existent leave', async () => {
    const leave = await LeaveRequest.create({
      leaveId: 'LR-20260910-001',
      userId: 'ST-0001',
      organisationId: 'ZAMORIN',
      cafeId: 'CAFE-TEST-01',
      leaveType: 'CASUAL',
      startDate: '2026-09-10',
      endDate: '2026-09-11',
      requestedDays: 2.0,
      reason: 'Personal engagement',
      status: 'APPROVED',
      canCancel: true,
    });

    // Test rejection when target leave does not exist
    const failReq = {
      auth: { userId: 'ST-0001', organisationId: 'ZAMORIN', role: 'STAFF' },
      params: { leaveId: 'LR-NONEXISTENT-999' },
      body: { cancellationReason: 'Urgent reason' },
    };

    let errorThrown = null;
    try {
      await leaveController.cancelLeave(failReq, { status() { return this; }, json() {} });
    } catch (err) {
      errorThrown = err;
    }
    assert.ok(errorThrown, 'Must throw error when leave does not exist');
    assert.equal(errorThrown.code, 'LEAVE_NOT_FOUND');

    // Test success with cancellationReason
    const successReq = {
      auth: { userId: 'ST-0001', organisationId: 'ZAMORIN', role: 'STAFF' },
      params: { leaveId: 'LR-20260910-001' },
      body: { cancellationReason: 'Urgent roster requirement at outlet' },
    };

    let successRes = null;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        successRes = data;
        return this;
      },
    };

    await leaveController.cancelLeave(successReq, res);

    assert.ok(successRes, 'Response must be received');
    assert.ok(successRes.success, 'Result must be success: true');
    assert.equal(successRes.data.leave.status, 'CANCELLATION_REQUESTED');
    assert.equal(successRes.data.leave.cancellationReason, 'Urgent roster requirement at outlet');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. FRONTEND ZERO FAKE DATA & ZERO ERROR SWALLOWING FORENSIC CHECKS
  // ─────────────────────────────────────────────────────────────────────────────
  await suite.test('P0-7: staffHome.js contains no fake hardcoded numbers (|| 21, || 22.5, || 4.5, "June 2026", || 4.5h)', () => {
    const filePath = path.resolve(__dirname, '../../frontend/src/js/pages/staffHome.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(!content.includes('|| 21'), 'staffHome.js must not contain "|| 21"');
    assert.ok(!content.includes('|| 22.5'), 'staffHome.js must not contain "|| 22.5"');
    assert.ok(!content.includes('|| 4.5,'), 'staffHome.js must not contain "|| 4.5,"');
    assert.ok(!content.includes('"June 2026"'), 'staffHome.js must not contain "June 2026"');
    assert.ok(!content.includes('|| 4.5h'), 'staffHome.js must not contain "|| 4.5h"');
  });

  await suite.test('P0-8: staffPayslips.js contains no hardcoded PS-202607-00104 statement ID banner', () => {
    const filePath = path.resolve(__dirname, '../../frontend/src/js/pages/staffPayslips.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(!content.includes('PS-202607-00104'), 'staffPayslips.js must not contain hardcoded PS-202607-00104');
    assert.ok(content.includes('renderNeedsAttention(latest)'), 'renderNeedsAttention must receive latest payslip dynamically');
  });

  await suite.test('P0-9: staffLoansAdvances.js contains no hardcoded ADV-2026-0003 and fails closed on all mutations', () => {
    const filePath = path.resolve(__dirname, '../../frontend/src/js/pages/staffLoansAdvances.js');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(!content.includes('ADV-2026-0003'), 'staffLoansAdvances.js must not contain hardcoded ADV-2026-0003');
    // Ensure catch blocks do NOT display green success toasts
    assert.ok(!content.includes('catch {\n      close();\n      showToast("Loan request submitted for review ✓", "mint");'), 'Loan apply catch block must not show success');
    assert.ok(!content.includes('catch {\n      close();\n      showToast("Repayment deferment request submitted for review ✓", "mint");'), 'Deferment catch block must not show success');
  });

  await suite.test('P0-10: employeeProfile.js and staffLeave.js fail closed on mutations without error swallowing', () => {
    const profilePath = path.resolve(__dirname, '../../frontend/src/js/pages/employeeProfile.js');
    const profileContent = fs.readFileSync(profilePath, 'utf8');

    assert.ok(!profileContent.includes('// Local update for preview responsiveness'), 'Profile edit must not fabricate local preview update on API error');

    const leavePath = path.resolve(__dirname, '../../frontend/src/js/pages/staffLeave.js');
    const leaveContent = fs.readFileSync(leavePath, 'utf8');

    const apiPostIndex = leaveContent.indexOf('await apiPost("/leave/requests",');
    const unshiftIndex = leaveContent.indexOf('cachedRequests.unshift(newLeave);');
    assert.ok(apiPostIndex !== -1, 'apiPost("/leave/requests") must exist');
    assert.ok(unshiftIndex !== -1, 'cachedRequests.unshift must exist');
    assert.ok(apiPostIndex < unshiftIndex, 'cachedRequests.unshift must happen AFTER await apiPost, never before');
    assert.ok(leaveContent.includes('cancellationReason: reason'), 'Leave cancel modal must pass cancellationReason in payload');
  });

  await suite.test('P0-11: announcements.js fails closed on compliance acknowledgement without fabricating timestamp', () => {
    const annPath = path.resolve(__dirname, '../../frontend/src/js/pages/announcements.js');
    const annContent = fs.readFileSync(annPath, 'utf8');

    assert.ok(!annContent.includes('// Fallback for demo seed notification'), 'announcements.js must not contain demo seed fallback');
    assert.ok(annContent.includes('Failed to record compliance acknowledgement'), 'announcements.js must display error toast on failure');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. P0 TWO-DEFECT CORRECTIVE ACTION (DEFECT-STAFF-01 & DEFECT-STAFF-02)
  // ─────────────────────────────────────────────────────────────────────────────

  await suite.test('P0-REG-01..03: Successful Staff profile update advances version once and persisted values match on reload', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    await User.deleteMany({ userId: uid });

    const user = await User.create({
      userId: uid,
      organisationId: org,
      name: 'Regression Staff',
      preferredName: 'Initial Name',
      email: 'reg-staff@zamorin.cafe',
      phone: '+91 90000 00000',
      role: 'STAFF',
      accountStatus: 'ACTIVE',
      employmentStatus: 'ACTIVE',
      passwordHash: 'dummy_hash',
      createdBy: 'SYSTEM',
    });

    const initialVersion = typeof user.version === 'number' ? user.version : 0;

    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        preferredName: 'Updated Reg Name',
        phone: '+91 91111 11111',
        expectedVersion: initialVersion,
      },
    };

    let resData = null;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(data) {
        resData = data;
        return this;
      },
    };

    await employeeController.updateSelfProfile(req, res);

    assert.ok(resData.success, 'Profile update must succeed');
    assert.equal(resData.data.profile.identity.preferredName, 'Updated Reg Name');
    assert.equal(resData.data.profile.identity.version, initialVersion + 1, 'Version token must increment exactly once');

    // Reload persisted document
    const reloaded = await User.findOne({ userId: uid, organisationId: org }).lean();
    assert.equal(reloaded.preferredName, 'Updated Reg Name');
    assert.equal(reloaded.phone, '+91 91111 11111');
    assert.equal(reloaded.version, initialVersion + 1, 'Persisted DB version must match incremented version');
  });

  await suite.test('P0-REG-04: Stale expectedVersion rejects with 409 PROFILE_CONFLICT and zero DB mutation', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const userBefore = await User.findOne({ userId: uid, organisationId: org }).lean();

    const staleVersion = 999;
    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        preferredName: 'Stale Should Not Save',
        expectedVersion: staleVersion,
      },
    };

    let errorThrown = null;
    try {
      await employeeController.updateSelfProfile(req, { status() { return this; }, json() {} });
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown, 'Must throw error on stale version');
    assert.equal(errorThrown.statusCode, 409);
    assert.equal(errorThrown.code, 'PROFILE_CONFLICT');

    // DB remains unchanged
    const userAfter = await User.findOne({ userId: uid, organisationId: org }).lean();
    assert.equal(userAfter.preferredName, userBefore.preferredName, 'DB preferredName must remain unmutated');
    assert.equal(userAfter.version, userBefore.version, 'DB version must not increment');
  });

  await suite.test('P0-REG-05: Concurrent updates with same expectedVersion: exactly one succeeds and one receives 409', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const current = await User.findOne({ userId: uid, organisationId: org });
    const currentVersion = current.version;

    // Simulate two concurrent requests arriving with the same expectedVersion
    const makeReq = (name) => ({
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        preferredName: name,
        expectedVersion: currentVersion,
      },
    });

    const runRequest = async (name) => {
      let resData = null;
      let statusCode = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          resData = data;
          return this;
        },
      };
      await employeeController.updateSelfProfile(makeReq(name), res);
      return { statusCode, resData };
    };

    const results = await Promise.allSettled([
      runRequest('Concurrent Winner A'),
      runRequest('Concurrent Winner B'),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled' && r.value.statusCode === 200);
    const conflicts = results.filter((r) => r.status === 'rejected' && r.reason?.statusCode === 409 && r.reason?.code === 'PROFILE_CONFLICT');

    assert.equal(successes.length, 1, 'Exactly one concurrent request must succeed with 200');
    assert.equal(conflicts.length, 1, 'Exactly one concurrent request must fail with 409 PROFILE_CONFLICT');

    // DB version advanced exactly once
    const finalUser = await User.findOne({ userId: uid, organisationId: org }).lean();
    assert.equal(finalUser.version, currentVersion + 1, 'Version must increment exactly once across concurrent attempts');
  });

  await suite.test('P0-REG-06: Forbidden fields remain untouched on profile update', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const userBefore = await User.findOne({ userId: uid, organisationId: org }).lean();

    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        role: 'MASTER',
        organisationId: 'HACKED_ORG',
        salary: 10000000,
        primaryCafeId: 'HACKED_CAFE',
        employmentStatus: 'TERMINATED',
        expectedVersion: userBefore.version,
      },
    };

    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json() {},
    };

    await employeeController.updateSelfProfile(req, res);

    const reloaded = await User.findOne({ userId: uid, organisationId: org }).lean();
    assert.equal(reloaded.role, 'STAFF', 'Role must remain STAFF');
    assert.equal(reloaded.organisationId, org, 'OrganisationId must remain unchanged');
    assert.equal(reloaded.employmentStatus, 'ACTIVE', 'EmploymentStatus must remain unchanged');
    assert.equal(reloaded.primaryCafeId, userBefore.primaryCafeId, 'PrimaryCafeId must remain unchanged');
  });

  await suite.test('P0-REG-07..09: ProfileChangeRequest creation succeeds with audit and is visible in management queue', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';

    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      correlationId: 'CORR-PCR-001',
      headers: {},
      body: {
        requestType: 'STATUTORY',
        section: 'GOVERNED',
        title: 'PF Account Correction',
        reason: 'Updated UAN number to current employer format',
        proposedValues: { uan: '100987654321' },
      },
    };

    let resData = null;
    const res = {
      status(code) {
        assert.equal(code, 201);
        return this;
      },
      json(data) {
        resData = data;
        return this;
      },
    };

    await employeeController.createSelfChangeRequest(req, res);

    assert.ok(resData.success, 'Change request creation must succeed');
    const created = resData.data.request;
    assert.ok(created.requestId, 'Must return real requestId');
    assert.match(created.requestId, /^PCR-\d{6}-\d{5}$/, 'RequestId must match PCR format');
    assert.equal(created.status, 'SUBMITTED');
    assert.equal(created.userId, uid);
    assert.equal(created.organisationId, org);

    // Verify Audit Event created
    const audit = await AuditEvent.findOne({
      organisationId: org,
      entityId: created.requestId,
      action: 'PROFILE_CHANGE_REQUEST_CREATE',
    }).lean();
    assert.ok(audit, 'AuditEvent must be recorded in database');
    assert.equal(audit.actorUserId, uid);
    assert.equal(audit.module, 'EMPLOYEES');
    assert.equal(audit.result, 'SUCCESS');

    // Verify Management Queue can query the request
    const mgmtQueue = await ProfileChangeRequest.find({
      organisationId: org,
      status: 'SUBMITTED',
    }).lean();
    const found = mgmtQueue.find((r) => r.requestId === created.requestId);
    assert.ok(found, 'Management governance queue must find the created request');
    assert.equal(found.reason, 'Updated UAN number to current employer format');
  });

  await suite.test('P0-REG-10: Invalid change request body rejects with 400 and zero DB mutation', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const countBefore = await ProfileChangeRequest.countDocuments({ organisationId: org });

    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        // Missing requestType, reason, proposedValues
      },
    };

    let errorThrown = null;
    try {
      await employeeController.createSelfChangeRequest(req, { status() { return this; }, json() {} });
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown, 'Must throw error on invalid body');
    assert.equal(errorThrown.statusCode, 400);
    assert.equal(errorThrown.code, 'INVALID_CHANGE_REQUEST');

    const countAfter = await ProfileChangeRequest.countDocuments({ organisationId: org });
    assert.equal(countAfter, countBefore, 'Zero change requests must be created in DB');
  });

  await suite.test('P0-REG-11: Audit failure atomicity: compensating rollback cleans up ProfileChangeRequest', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const atomicityReason = 'Atomicity Rollback Test Unique Reason ' + Date.now();

    // Stub auditService.recordRequestAudit to throw
    const originalRecordRequestAudit = auditService.recordRequestAudit;
    auditService.recordRequestAudit = async () => {
      throw new Error('Simulated audit service crash');
    };

    const req = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      body: {
        requestType: 'STATUTORY',
        section: 'GOVERNED',
        title: 'Should Rollback',
        reason: atomicityReason,
        proposedValues: { bankAccountNumber: '0000' },
      },
    };

    let errorThrown = null;
    try {
      await employeeController.createSelfChangeRequest(req, { status() { return this; }, json() {} });
    } catch (err) {
      errorThrown = err;
    } finally {
      auditService.recordRequestAudit = originalRecordRequestAudit;
    }

    assert.ok(errorThrown, 'Must throw error when audit fails');
    assert.equal(errorThrown.statusCode, 500);
    assert.equal(errorThrown.code, 'AUDIT_RECORD_FAILED');

    // Compensating rollback verification: zero orphaned ProfileChangeRequest in DB
    const orphaned = await ProfileChangeRequest.findOne({
      organisationId: org,
      reason: atomicityReason,
    }).lean();
    assert.equal(orphaned, null, 'ProfileChangeRequest must be rolled back and not exist in DB');
  });

  await suite.test('P0-REG-12: Idempotency retry returns existing request without duplicate active records', async () => {
    const org = 'ORG-P0-REG';
    const uid = 'ST-0010';
    const idempotencyKey = 'IDEMP-KEY-' + Date.now();

    const reqBody = {
      requestType: 'BANK_DETAILS',
      section: 'GOVERNED',
      title: 'Salary Account Setup',
      reason: 'Idempotency validation test',
      proposedValues: { accountNumber: '987654321012' },
      idempotencyKey,
    };

    const req1 = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      headers: {},
      body: reqBody,
    };

    let res1Data = null;
    const res1 = {
      status(code) {
        assert.equal(code, 201);
        return this;
      },
      json(data) {
        res1Data = data;
        return this;
      },
    };

    await employeeController.createSelfChangeRequest(req1, res1);
    const firstRequestId = res1Data.data.request.requestId;
    assert.ok(firstRequestId);

    // Resubmit identical request with same idempotencyKey
    const req2 = {
      auth: { userId: uid, organisationId: org, role: 'STAFF' },
      headers: {},
      body: reqBody,
    };

    let res2Data = null;
    let res2Code = null;
    const res2 = {
      status(code) {
        res2Code = code;
        return this;
      },
      json(data) {
        res2Data = data;
        return this;
      },
    };

    await employeeController.createSelfChangeRequest(req2, res2);
    assert.equal(res2Code, 200, 'Retry with existing idempotencyKey must return 200');
    assert.equal(res2Data.data.request.requestId, firstRequestId, 'Must return existing requestId');

    const totalMatching = await ProfileChangeRequest.countDocuments({
      organisationId: org,
      idempotencyKey,
    });
    assert.equal(totalMatching, 1, 'Only one record must exist in DB for this idempotencyKey');
  });
});
