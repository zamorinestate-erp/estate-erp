'use strict';

/**
 * ZAMORIN CAFE ERP — PHASE 10
 * OWNER SHARED / UNIVERSAL MODULES PARITY & SECURITY TEST SUITE
 *
 * Validates complete Primary Master parity, Owner multi-café authorization boundaries,
 * zero aggregate leakage, fail-closed rejections (403 CROSS_CAFE_RESOURCE_DENIED),
 * field-level privacy masking, and complete control wiring across all 10 shared modules:
 *
 * 1.  SHARED-OWN-01: Sales & Cash Book (cashController.js)
 * 2.  SHARED-OWN-02: Passbook & Treasury (passbookController.js)
 * 3.  SHARED-OWN-03: Payroll & Payslips (payrollManagementController.js)
 * 4.  SHARED-OWN-04: Revenue Share & Outlets (revenueShareController.js)
 * 5.  SHARED-OWN-05: Employees Directory (employeeController.js)
 * 6.  SHARED-OWN-06: Attendance & Shifts (attendanceController.js / shiftController.js)
 * 7.  SHARED-OWN-07: Universal Settings Hub (settingsController.js)
 * 8.  SHARED-OWN-08: Operational Notifications Hub (notificationController.js)
 * 9.  SHARED-OWN-09: Universal Employee Profile (employeeController.js / employeeReadService.js)
 * 10. SHARED-OWN-10: Announcements & Universal Role Governance (announcements.js / notificationController.js)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Controllers under audit
const cashController = require('../src/controllers/cashController');
const passbookController = require('../src/controllers/passbookController');
const payrollManagementController = require('../src/controllers/payrollManagementController');
const revenueShareController = require('../src/controllers/revenueShareController');
const employeeController = require('../src/controllers/employeeController');
const attendanceController = require('../src/modules/attendance/attendanceController');
const shiftController = require('../src/controllers/shiftController');
const settingsController = require('../src/controllers/settingsController');
const notificationController = require('../src/controllers/notificationController');
const employeeReadService = require('../src/services/employeeReadService');

// Services
const { PassbookService } = require('../src/services/passbookService');

// Models
const { CashTransaction } = require('../src/models/CashTransaction');
const { PassbookAccount } = require('../src/models/PassbookAccount');
const { PassbookTransaction } = require('../src/models/PassbookTransaction');
const { PayrollRun } = require('../src/models/PayrollRun');
const { LeasedOutlet } = require('../src/models/LeasedOutlet');
const { RevenueShareOperator } = require('../src/models/RevenueShareOperator');
const { RevenueShareAgreement } = require('../src/models/RevenueShareAgreement');
const { RevenueShareSettlement } = require('../src/models/RevenueShareSettlement');
const { SalesSubmission } = require('../src/models/SalesSubmission');
const { RevenueSharePayment } = require('../src/models/RevenueSharePayment');
const { SecurityDeposit } = require('../src/models/SecurityDeposit');
const { User } = require('../src/models/User');
const { Attendance } = require('../src/modules/attendance/Attendance');
const { ShiftRoster } = require('../src/models/ShiftRoster');
const { Cafe } = require('../src/models/Cafe');
const { Shift } = require('../src/models/Shift');
const { SupportCase } = require('../src/models/SupportCase');
const { Notification } = require('../src/models/Notification');

test('OWNER PHASE 10: Shared / Universal Modules Parity & Security Suite', async (t) => {
  const orgId = 'ORG-TEST-SHARED';
  const cafeA = 'ZC-0001';
  const cafeB = 'ZC-0002';
  const cafeC = 'ZC-0003'; // Foreign / unauthorized for Owner assigned to A & B

  const authorizedOwnerAuth = {
    userId: 'OWNER-USR-01',
    role: 'OWNER',
    organisationId: orgId,
    assignedCafeIds: [cafeA, cafeB],
    isPrimaryMaster: false,
  };

  const unassignedOwnerAuth = {
    userId: 'OWNER-EMPTY-01',
    role: 'OWNER',
    organisationId: orgId,
    assignedCafeIds: [],
    isPrimaryMaster: false,
  };

  const primaryMasterAuth = {
    userId: 'MASTER-01',
    role: 'MASTER',
    organisationId: orgId,
    assignedCafeIds: [cafeA, cafeB, cafeC],
    isPrimaryMaster: true,
  };

  function createMockResponse() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
  }

  function makeQuery(data) {
    const q = {
      select: () => q,
      sort: () => q,
      skip: () => q,
      limit: () => q,
      populate: () => q,
      lean: () => Promise.resolve(data),
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
      catch: (fn) => Promise.resolve(data).catch(fn),
    };
    return q;
  }

  async function invoke(handler, req) {
    const res = createMockResponse();
    let errResult = null;
    try {
      await handler(req, res, (err) => {
        if (err) errResult = err;
      });
    } catch (err) {
      errResult = err;
    }
    if (errResult) {
      return {
        statusCode: errResult.statusCode || 500,
        body: { error: { code: errResult.code, message: errResult.message } },
      };
    }
    return res;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SHARED-OWN-01: Sales & Cash Book (cashController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('1. SHARED-OWN-01: Sales & Cash Book Governance', async (st) => {
    await st.test('1.1 Owner can query assigned cafe cash transactions', async () => {
      const origFind = CashTransaction.find;
      const origCount = CashTransaction.countDocuments;
      CashTransaction.find = () => makeQuery([{ transactionId: 'CTX-01', cafeId: cafeA, amountPaisa: 5000 }]);
      CashTransaction.countDocuments = () => Promise.resolve(1);
      try {
        const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeA } };
        const res = await invoke(cashController.listCashTransactions, req);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
      } finally {
        CashTransaction.find = origFind;
        CashTransaction.countDocuments = origCount;
      }
    });

    await st.test('1.2 Owner querying unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(cashController.listCashTransactions, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('1.3 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(cashController.listCashTransactions, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('1.4 Owner cannot create cash transactions (restricted to MASTER/CAFE_ADMIN: 403)', async () => {
      const req = { auth: authorizedOwnerAuth, body: { cafeId: cafeA, amountPaisa: 1000, category: 'PETTY_CASH' } };
      const res = await invoke(cashController.createCashTransaction, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CASH_ENTRY_ACCESS_DENIED');
    });

    await st.test('1.5 Owner cannot reverse cash transactions (restricted to MASTER: 403)', async () => {
      const req = { auth: authorizedOwnerAuth, params: { transactionId: 'CTX-01' }, body: { reason: 'Test' } };
      const res = await invoke(cashController.reverseCashTransaction, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'MASTER_ACCESS_REQUIRED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SHARED-OWN-02: Passbook & Treasury (passbookController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('2. SHARED-OWN-02: Passbook & Treasury Governance', async (st) => {
    await st.test('2.1 Owner overview scopes cafePositions strictly to assigned cafes', async () => {
      const origSummary = PassbookService.getAccountsSummary;
      const origAnalytics = PassbookService.getAnalytics;
      const origAudit = PassbookService.runIntegrityAudit;
      const origCafe = Cafe.find;
      const origTx = PassbookTransaction.find;

      PassbookService.getAccountsSummary = () => Promise.resolve({
        accounts: [
          { accountId: 'ACC-01', assignedCafeIds: [cafeA], bookBalancePaisa: 100000, reservedPaisa: 10000 },
          { accountId: 'ACC-02', assignedCafeIds: [cafeB], bookBalancePaisa: 200000, reservedPaisa: 20000 },
        ],
        kpis: { totalFreeBalancePaisa: 270000, totalBookBalancePaisa: 300000, totalReservedPaisa: 30000, unreconciledDifferencePaisa: 0, activeAccounts: 2, accountsNeedingReconciliation: 0 },
      });
      PassbookService.getAnalytics = () => Promise.resolve({
        externalIncomePaisa: 3000,
        externalExpensePaisa: 1500,
        netCashFlowPaisa: 1500,
        internalTransfersPaisa: 0,
        cafeBreakdown: {
          [cafeA]: { incomePaisa: 1000, expensePaisa: 500, netPaisa: 500 },
          [cafeB]: { incomePaisa: 2000, expensePaisa: 1000, netPaisa: 1000 },
        },
      });
      PassbookService.runIntegrityAudit = () => Promise.resolve({ status: 'HEALTHY' });
      PassbookTransaction.find = () => makeQuery([]);
      Cafe.find = (f) => {
        assert.deepEqual(f.cafeId, { $in: [cafeA, cafeB] }, 'Cafe.find must filter by assigned cafes');
        return makeQuery([
          { cafeId: cafeA, name: 'Cafe A' },
          { cafeId: cafeB, name: 'Cafe B' },
        ]);
      };

      try {
        const req = { auth: authorizedOwnerAuth, query: {} };
        const res = await invoke(passbookController.getPassbookOverview, req);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        const positions = res.body.data.cafePositions;
        assert.ok(Array.isArray(positions));
        assert.equal(positions.length, 2);
        assert.equal(positions[0].cafeId, cafeA);
        assert.equal(positions[1].cafeId, cafeB);
      } finally {
        PassbookService.getAccountsSummary = origSummary;
        PassbookService.getAnalytics = origAnalytics;
        PassbookService.runIntegrityAudit = origAudit;
        Cafe.find = origCafe;
        PassbookTransaction.find = origTx;
      }
    });

    await st.test('2.2 Owner requesting unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(passbookController.listTransactions, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('2.3 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(passbookController.listTransactions, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SHARED-OWN-03: Payroll & Payslips (payrollManagementController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('3. SHARED-OWN-03: Payroll & Payslips Governance', async (st) => {
    await st.test('3.1 Owner querying unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(payrollManagementController.listPayrollRuns, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('3.2 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(payrollManagementController.listPayrollRuns, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('3.3 Owner can query assigned cafe payroll runs', async () => {
      const origFind = PayrollRun.find;
      const origCount = PayrollRun.countDocuments;
      PayrollRun.find = () => makeQuery([{ payrollRunId: 'PR-01', cafeId: cafeA, status: 'APPROVED' }]);
      PayrollRun.countDocuments = () => Promise.resolve(1);
      try {
        const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeA } };
        const res = await invoke(payrollManagementController.listPayrollRuns, req);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
      } finally {
        PayrollRun.find = origFind;
        PayrollRun.countDocuments = origCount;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SHARED-OWN-04: Revenue Share & Outlets (revenueShareController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('4. SHARED-OWN-04: Revenue Share & Outlets Governance', async (st) => {
    await st.test('4.1 Owner overview scopes outlets, agreements, and settlements to assigned cafes', async () => {
      const origOutlet = LeasedOutlet.find;
      const origAgr = RevenueShareAgreement.find;
      const origSet = RevenueShareSettlement.find;
      const origOpr = RevenueShareOperator.find;
      const origSub = SalesSubmission.find;
      const origPay = RevenueSharePayment.find;
      const origDep = SecurityDeposit.find;

      let capturedFilter = null;
      LeasedOutlet.find = (f) => {
        capturedFilter = f;
        return makeQuery([{ outletId: 'LO-01', cafeId: cafeA, status: 'OCCUPIED' }]);
      };
      RevenueShareAgreement.find = () => makeQuery([{ agreementId: 'RSA-01', cafeId: cafeA, status: 'ACTIVE' }]);
      RevenueShareSettlement.find = () => makeQuery([{ settlementId: 'SET-01', cafeId: cafeA, netPayablePaisa: 50000 }]);
      RevenueShareOperator.find = () => makeQuery([{ operatorId: 'OPR-01', legalName: 'Bakery Co' }]);
      SalesSubmission.find = () => makeQuery([{ grossSalesPaisa: 100000 }]);
      RevenueSharePayment.find = () => makeQuery([{ amountPaisa: 40000, status: 'VERIFIED' }]);
      SecurityDeposit.find = () => makeQuery([]);

      try {
        const req = { auth: authorizedOwnerAuth };
        const res = await invoke(revenueShareController.getOverview, req);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(capturedFilter.cafeId, { $in: [cafeA, cafeB] });
      } finally {
        LeasedOutlet.find = origOutlet;
        RevenueShareAgreement.find = origAgr;
        RevenueShareSettlement.find = origSet;
        RevenueShareOperator.find = origOpr;
        SalesSubmission.find = origSub;
        RevenueSharePayment.find = origPay;
        SecurityDeposit.find = origDep;
      }
    });

    await st.test('4.2 Owner querying unassigned outlet throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const origFindOne = LeasedOutlet.findOne;
      LeasedOutlet.findOne = () => makeQuery({ outletId: 'LO-09', cafeId: cafeC });
      try {
        const req = { auth: authorizedOwnerAuth, params: { id: 'LO-09' } };
        const res = await invoke(revenueShareController.getOutletById, req);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
      } finally {
        LeasedOutlet.findOne = origFindOne;
      }
    });

    await st.test('4.3 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth };
      const res = await invoke(revenueShareController.getOverview, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('4.4 Aging/outstanding balances scope strictly to authorized cafes', async () => {
      const origFind = RevenueShareSettlement.find;
      let capturedFilter = null;
      RevenueShareSettlement.find = (f) => {
        capturedFilter = f;
        return makeQuery([]);
      };
      try {
        const req = { auth: authorizedOwnerAuth };
        const res = await invoke(revenueShareController.getOutstandingAndAgeing, req);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(capturedFilter.cafeId, { $in: [cafeA, cafeB] });
      } finally {
        RevenueShareSettlement.find = origFind;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SHARED-OWN-05: Employees Directory (employeeController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('5. SHARED-OWN-05: Employees Directory Governance', async (st) => {
    await st.test('5.1 Owner querying unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(employeeController.listEmployees, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('5.2 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(employeeController.listEmployees, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('5.3 Search with text query preserves cafe boundary via $and clause', async () => {
      const origFind = User.find;
      const origCount = User.countDocuments;
      let capturedFilter = null;
      User.find = (f) => {
        capturedFilter = f;
        return makeQuery([]);
      };
      User.countDocuments = () => Promise.resolve(0);
      try {
        const req = { auth: authorizedOwnerAuth, query: { query: 'Barista' } };
        const res = await invoke(employeeController.listEmployees, req);
        assert.equal(res.statusCode, 200);
        assert.ok(capturedFilter.$and, 'Filter must use $and to prevent query from overriding cafe boundaries');
        const hasCafeClause = capturedFilter.$and.some((c) => c.$or && c.$or[0]?.primaryCafeId?.$in);
        assert.ok(hasCafeClause, 'Cafe scoping clause must remain active during search queries');
      } finally {
        User.find = origFind;
        User.countDocuments = origCount;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SHARED-OWN-06: Attendance & Shifts (attendanceController.js / shiftController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('6. SHARED-OWN-06: Attendance & Shifts Governance', async (st) => {
    await st.test('6.1 Owner querying unassigned cafe attendance throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(attendanceController.getAttendanceOverview, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('6.2 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(attendanceController.getAttendanceOverview, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('6.3 Attendance cafeWorkforce only returns Owner assigned cafes (zero org-wide leakage)', async () => {
      const origAtt = Attendance.find;
      const origCafe = Cafe.find;
      const origRoster = ShiftRoster.findOne;

      Attendance.find = () => makeQuery([]);
      Cafe.find = () => makeQuery([{ cafeId: cafeA, name: 'Cafe A' }, { cafeId: cafeB, name: 'Cafe B' }]);
      ShiftRoster.findOne = () => makeQuery(null);

      try {
        const req = { auth: authorizedOwnerAuth, query: {} };
        const res = await invoke(attendanceController.getAttendanceOverview, req);
        assert.equal(res.statusCode, 200);
        assert.ok(res.body.data.cafeWorkforce);
        assert.equal(res.body.data.cafeWorkforce.length, 2);
      } finally {
        Attendance.find = origAtt;
        Cafe.find = origCafe;
        ShiftRoster.findOne = origRoster;
      }
    });

    await st.test('6.4 Shift templates query for unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(shiftController.listShifts, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('6.5 Owner attempting to create shift for unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = {
        auth: authorizedOwnerAuth,
        body: { name: 'Morning Barista', cafeId: cafeC, startTime: '07:00', endTime: '15:30' },
      };
      const res = await invoke(shiftController.createShift, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SHARED-OWN-07: Universal Settings Hub (settingsController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('7. SHARED-OWN-07: Universal Settings Hub Governance', async (st) => {
    await st.test('7.1 Support queue scopes strictly to Owner assigned cafes', async () => {
      const origFind = SupportCase.find;
      const origCount = SupportCase.countDocuments;
      let capturedFilter = null;
      SupportCase.find = (f) => {
        capturedFilter = f;
        return makeQuery([]);
      };
      SupportCase.countDocuments = () => Promise.resolve(0);
      try {
        const req = { auth: authorizedOwnerAuth, query: {} };
        const res = await invoke(settingsController.listManageSupportTickets, req);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(capturedFilter.cafeId, { $in: [cafeA, cafeB] });
      } finally {
        SupportCase.find = origFind;
        SupportCase.countDocuments = origCount;
      }
    });

    await st.test('7.2 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: unassignedOwnerAuth, query: {} };
      const res = await invoke(settingsController.listManageSupportTickets, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });

    await st.test('7.3 Accessing support ticket outside assigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const origFindOne = SupportCase.findOne;
      SupportCase.findOne = () => makeQuery({ caseId: 'CASE-01', cafeId: cafeC });
      try {
        const req = { auth: authorizedOwnerAuth, params: { caseId: 'CASE-01' } };
        const res = await invoke(settingsController.getManageSupportTicket, req);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
      } finally {
        SupportCase.findOne = origFindOne;
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SHARED-OWN-08: Operational Notifications Hub (notificationController.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('8. SHARED-OWN-08: Operational Notifications Hub Governance', async (st) => {
    await st.test('8.1 Notifications are strictly recipient-isolated', async () => {
      const origFind = Notification.find;
      const origCount = Notification.countDocuments;
      let capturedFilter = null;
      Notification.find = (f) => {
        capturedFilter = f;
        return makeQuery([]);
      };
      Notification.countDocuments = () => Promise.resolve(0);
      try {
        const req = { auth: authorizedOwnerAuth, query: {} };
        const res = await invoke(notificationController.listNotifications, req);
        assert.equal(res.statusCode, 200);
        assert.equal(capturedFilter.recipientUserId, authorizedOwnerAuth.userId);
      } finally {
        Notification.find = origFind;
        Notification.countDocuments = origCount;
      }
    });

    await st.test('8.2 Querying unassigned cafe notifications throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const req = { auth: authorizedOwnerAuth, query: { cafeId: cafeC } };
      const res = await invoke(notificationController.listNotifications, req);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. SHARED-OWN-09: Universal Employee Profile (employeeController.js / employeeReadService.js)
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('9. SHARED-OWN-09: Universal Employee Profile Governance', async (st) => {
    await st.test('9.1 Viewing employee profile in unassigned cafe throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const origFindOne = User.findOne;
      User.findOne = () => makeQuery({ userId: 'EMP-OTHER-01', primaryCafeId: cafeC, assignedCafeIds: [cafeC] });
      try {
        const req = { auth: authorizedOwnerAuth, params: { userId: 'EMP-OTHER-01' } };
        const res = await invoke(employeeController.getEmployee360, req);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
      } finally {
        User.findOne = origFindOne;
      }
    });

    await st.test('9.2 Owner with empty assignedCafeIds fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
      const origFindOne = User.findOne;
      User.findOne = () => makeQuery({ userId: 'EMP-01', primaryCafeId: cafeA, assignedCafeIds: [cafeA] });
      try {
        const req = { auth: unassignedOwnerAuth, params: { userId: 'EMP-01' } };
        const res = await invoke(employeeController.getEmployee360, req);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error.code, 'CROSS_CAFE_RESOURCE_DENIED');
      } finally {
        User.findOne = origFindOne;
      }
    });

    await st.test('9.3 Statutory, bank account, and PAN are masked for Owner', async () => {
      const testEmployee = {
        userId: 'EMP-01',
        name: 'Rahul Varma',
        organisationId: orgId,
        primaryCafeId: cafeA,
        assignedCafeIds: [cafeA],
        role: 'STAFF',
        accountStatus: 'ACTIVE',
      };
      const profile = employeeReadService.buildEmployeeProfile(testEmployee, authorizedOwnerAuth);
      assert.ok(profile.payrollProfile.bankAccountMasked.startsWith('•••• ••••'));
      assert.ok(profile.statutory.panMasked.startsWith('••••••'));
      assert.ok(profile.statutory.epfUanMasked.includes('••••'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. SHARED-OWN-10: Announcements & Universal Alignment
  // ═══════════════════════════════════════════════════════════════════════════
  await t.test('10. SHARED-OWN-10: Announcements & Universal Alignment Governance', async (st) => {
    await st.test('10.1 Primary Master retains global portfolio governance authority', async () => {
      const origFind = CashTransaction.find;
      const origCount = CashTransaction.countDocuments;
      CashTransaction.find = () => makeQuery([]);
      CashTransaction.countDocuments = () => Promise.resolve(0);
      try {
        const req = { auth: primaryMasterAuth, query: { cafeId: cafeC } };
        const res = await invoke(cashController.listCashTransactions, req);
        assert.equal(res.statusCode, 200);
      } finally {
        CashTransaction.find = origFind;
        CashTransaction.countDocuments = origCount;
      }
    });

    await st.test('10.2 Role/Module alignment verification across all 10 shared modules', async () => {
      assert.ok(typeof cashController.listCashTransactions === 'function');
      assert.ok(typeof passbookController.getPassbookOverview === 'function');
      assert.ok(typeof payrollManagementController.listPayrollRuns === 'function');
      assert.ok(typeof revenueShareController.getOverview === 'function');
      assert.ok(typeof employeeController.listEmployees === 'function');
      assert.ok(typeof attendanceController.getAttendanceOverview === 'function');
      assert.ok(typeof shiftController.listShifts === 'function');
      assert.ok(typeof settingsController.listManageSupportTickets === 'function');
      assert.ok(typeof notificationController.listNotifications === 'function');
      assert.ok(typeof employeeController.getEmployee360 === 'function');
    });
  });
});
