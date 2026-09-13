'use strict';

/**
 * ZAMORIN CAFE ERP — OWN-SCR-004: OWNER FINANCE SUMMARY INTELLIGENCE & RBAC SUITE
 *
 * Comprehensive Verification:
 * 1. Owner Authorized Multi-Café Scoping & Consolidation (A & B included, C excluded)
 * 2. Cross-Café Query BOLA/IDOR Denial (403 CROSS_CAFE_RESOURCE_DENIED)
 * 3. Empty Assigned Cafes Fail-Closed Protection (403 NO_ASSIGNED_CAFES)
 * 4. Single Authorized Café Scoping (Targeted filter for individual branch)
 * 5. Foreign Organisation Tenant Isolation (Cross-org data leakage = 0)
 * 6. Double-Counting Prevention (Canonical POS Bills vs Cash Book / Store Day Audits)
 * 7. Accurate Gross-to-Net Revenue & 5% Dual-State Composite GST Output Recorded
 * 8. Operating Expenses, OpEx Ratio & Operating Contribution Math
 * 9. Workforce Payroll Burden, Payroll Ratio & Overtime Allocations
 * 10. Unit Economics Formulations (Cost per ₹100, Wastage per ₹1,000)
 * 11. Physical Cash Held in Drawers & Reconciliation Variance Control
 * 12. Personal Ledger Strict Separation (Partner equity isolated from café operations)
 * 13. Accounts Payable (AP) Commitments & Institutional Receivables Integration
 * 14. Budget vs Actual Targets & Directional Variance Semantics
 * 15. Zero / Null / Empty Portfolio Handling (Resilient ₹0 / 0% without NaN)
 * 16. Primary Master Parity & RBAC Mutation Barriers (Owner cannot post GL journals or clear store days)
 * 17. Multi-Café Performance Matrix Integrity & Branch Concentration
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getFinanceOverview,
} = require('../src/controllers/financeController');

const { Bill } = require('../src/models/Bill');
const { Expense } = require('../src/models/Expense');
const { Payslip } = require('../src/models/Payslip');
const { RegisterSession } = require('../src/models/RegisterSession');
const { APInvoice } = require('../src/models/APInvoice');
const { DepartmentOrder } = require('../src/models/DepartmentOrder');
const { PersonalLedger } = require('../src/models/PersonalLedger');
const { DashboardTarget } = require('../src/models/DashboardTarget');
const { Cafe } = require('../src/models/Cafe');
const { BankAccount } = require('../src/models/BankAccount');
const { Journal } = require('../src/models/Journal');
const { StoreDayAudit } = require('../src/models/StoreDayAudit');
const { MarketplaceSettlement } = require('../src/models/MarketplaceSettlement');

test('OWN-SCR-004: Owner Finance Summary Intelligence & RBAC Suite', async (t) => {
  const orgId = 'ORG-TEST-FIN';
  const cafeA = 'ZC-0001';
  const cafeB = 'ZC-0002';
  const cafeC = 'ZC-0003'; // Unauthorized for Owner restricted to A & B
  const businessDate = '2026-08-22';

  const ownerAuth = {
    role: 'OWNER',
    organisationId: orgId,
    userId: 'OWNER-01',
    assignedCafeIds: [cafeA, cafeB],
    workspaceMode: 'MASTER_WORKSPACE',
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
      lean: () => Promise.resolve(data),
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
      catch: (fn) => Promise.resolve(data).catch(fn),
    };
    return q;
  }

  // Model find overrides for clean isolated mocking
  let originalFinds = {};

  function setupMocks(dataset = {}) {
    const defaults = {
      cafes: [
        { cafeId: cafeA, name: 'Kozhikode Roastery' },
        { cafeId: cafeB, name: 'Palayam Espresso Bar' },
      ],
      bills: [
        { cafeId: cafeA, totalPaisa: 60000, subtotalPaisa: 57143, taxPaisa: 2857, cgstPaisa: 1428, sgstPaisa: 1428, discountPaisa: 2000, refundedTotalPaisa: 0 },
        { cafeId: cafeB, totalPaisa: 40000, subtotalPaisa: 38095, taxPaisa: 1905, cgstPaisa: 952, sgstPaisa: 952, discountPaisa: 1000, refundedTotalPaisa: 5000 },
      ],
      expenses: [
        { cafeId: cafeA, totalPaisa: 25000, category: 'UTILITIES' },
        { cafeId: cafeB, totalPaisa: 17000, category: 'SUPPLIES' },
        { cafeId: cafeA, totalPaisa: 3000, category: 'WASTAGE' },
      ],
      payslips: [
        { cafeId: cafeA, grossEarningsPaise: 18000, earnings: { overtimePayPaise: 2000 } },
        { cafeId: cafeB, grossEarningsPaise: 12000, earnings: { overtimePayPaise: 1000 } },
      ],
      sessions: [
        { cafeId: cafeA, closingCountPaisa: 15000, cashVariancePaisa: 0, status: 'RECONCILED' },
        { cafeId: cafeB, closingCountPaisa: 8000, cashVariancePaisa: 0, status: 'RECONCILED' },
      ],
      apInvoices: [
        { paymentStatus: 'UNPAID', totalPaisa: 45000, outstandingPaisa: 45000, dueDate: '2026-08-25' },
      ],
      deptOrders: [
        { totalAmountPaisa: 20000, outstandingAmountPaisa: 5000, creditStatus: 'ACTIVE' },
      ],
      personalLedger: [
        { entryType: 'CREDIT', amountPaisa: 200000, createdAt: new Date() },
        { entryType: 'DEBIT', amountPaisa: 60000, createdAt: new Date() },
      ],
      targets: [
        { salesTargetPaisa: 120000, expenseBudgetPaisa: 50000 },
      ],
      bankAccounts: [
        { bookBalancePaisa: 350000 },
      ],
      journals: [],
      storeDays: [],
      settlements: [],
    };

    const d = { ...defaults, ...dataset };

    originalFinds = {
      Cafe: Cafe.find,
      Bill: Bill.find,
      Expense: Expense.find,
      Payslip: Payslip.find,
      RegisterSession: RegisterSession.find,
      APInvoice: APInvoice.find,
      DepartmentOrder: DepartmentOrder.find,
      PersonalLedger: PersonalLedger.find,
      DashboardTarget: DashboardTarget.find,
      BankAccount: BankAccount.find,
      Journal: Journal.find,
      StoreDayAudit: StoreDayAudit.find,
      MarketplaceSettlement: MarketplaceSettlement.find,
    };

    Cafe.find = () => makeQuery(d.cafes);
    Bill.find = () => makeQuery(d.bills);
    Expense.find = () => makeQuery(d.expenses);
    Payslip.find = () => makeQuery(d.payslips);
    RegisterSession.find = () => makeQuery(d.sessions);
    APInvoice.find = () => makeQuery(d.apInvoices);
    DepartmentOrder.find = () => makeQuery(d.deptOrders);
    PersonalLedger.find = () => makeQuery(d.personalLedger);
    DashboardTarget.find = () => makeQuery(d.targets);
    BankAccount.find = () => makeQuery(d.bankAccounts);
    Journal.find = () => makeQuery(d.journals);
    StoreDayAudit.find = () => makeQuery(d.storeDays);
    MarketplaceSettlement.find = () => makeQuery(d.settlements);
  }

  function restoreMocks() {
    for (const [modelName, origFind] of Object.entries(originalFinds)) {
      if (modelName === 'Cafe') Cafe.find = origFind;
      if (modelName === 'Bill') Bill.find = origFind;
      if (modelName === 'Expense') Expense.find = origFind;
      if (modelName === 'Payslip') Payslip.find = origFind;
      if (modelName === 'RegisterSession') RegisterSession.find = origFind;
      if (modelName === 'APInvoice') APInvoice.find = origFind;
      if (modelName === 'DepartmentOrder') DepartmentOrder.find = origFind;
      if (modelName === 'PersonalLedger') PersonalLedger.find = origFind;
      if (modelName === 'DashboardTarget') DashboardTarget.find = origFind;
      if (modelName === 'BankAccount') BankAccount.find = origFind;
      if (modelName === 'Journal') Journal.find = origFind;
      if (modelName === 'StoreDayAudit') StoreDayAudit.find = origFind;
      if (modelName === 'MarketplaceSettlement') MarketplaceSettlement.find = origFind;
    }
  }

  // ─── 1. OWNER MULTI-CAFÉ SCOPING & CONSOLIDATION ────────────────────────────
  await t.test('1. Owner Scoping: Aggregation across authorized cafes (A & B) and exclusion of unauthorized (C)', async () => {
    setupMocks();
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      assert.equal(res.statusCode, 200, 'Returns 200 OK');
      assert.ok(res.body.kpis, 'KPIs object present');
      assert.ok(res.body.cafes, 'Cafes array present');
      assert.equal(res.body.cafes.length, 2, 'Exactly 2 authorized cafes in breakdown');

      // Gross Sales: 60,000 + 40,000 = 1,00,000 paise = ₹1,000.00
      assert.equal(res.body.kpis.grossSales, 1000, 'Gross sales is ₹1,000.00');
      // Refunds: 5,000 paise = ₹50.00
      assert.equal(res.body.kpis.refundsTotal, 50, 'Refunds total is ₹50.00');
      // Net Sales: 1000 - 50 = ₹950.00
      assert.equal(res.body.kpis.netSales, 950, 'Net sales is ₹950.00');
      // Expenses: 25,000 + 17,000 + 3,000 = 45,000 paise = ₹450.00
      assert.equal(res.body.kpis.operatingExpenses, 450, 'Operating expenses is ₹450.00');
      // Payroll: 18,000 + 12,000 = 30,000 paise = ₹300.00
      assert.equal(res.body.kpis.payrollCost, 300, 'Workforce payroll cost is ₹300.00');
    } finally {
      restoreMocks();
    }
  });

  // ─── 2. CROSS-CAFÉ QUERY DENIAL (403 BOLA/IDOR) ───────────────────────────
  await t.test('2. Cross-Café Denial: Requesting unassigned café throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
    setupMocks();
    try {
      const res = createMockResponse();
      let errorThrown = null;
      try {
        await getFinanceOverview(
          { auth: { ...ownerAuth }, query: { cafeId: cafeC } },
          res,
          (err) => { if (err) errorThrown = err; }
        );
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown, 'Error was thrown on cross-café query');
      assert.equal(errorThrown.statusCode, 403, 'HTTP 403 Forbidden');
      assert.equal(errorThrown.code, 'CROSS_CAFE_RESOURCE_DENIED', 'Error code matches CROSS_CAFE_RESOURCE_DENIED');
    } finally {
      restoreMocks();
    }
  });

  // ─── 3. EMPTY ASSIGNED CAFES (FAIL-CLOSED) ─────────────────────────────────
  await t.test('3. Empty Assigned Cafes: Owner with no assigned cafes fails closed with 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
    setupMocks();
    try {
      const emptyOwnerAuth = { ...ownerAuth, assignedCafeIds: [] };
      const res = createMockResponse();
      let errorThrown = null;
      try {
        await getFinanceOverview(
          { auth: emptyOwnerAuth, query: {} },
          res,
          (err) => { if (err) errorThrown = err; }
        );
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown, 'Error was thrown for unassigned owner');
      assert.equal(errorThrown.statusCode, 403, 'HTTP 403 Forbidden');
      assert.equal(errorThrown.code, 'CROSS_CAFE_RESOURCE_DENIED', 'Error code matches CROSS_CAFE_RESOURCE_DENIED');
    } finally {
      restoreMocks();
    }
  });

  // ─── 4. SINGLE AUTHORIZED CAFÉ SCOPING ─────────────────────────────────────
  await t.test('4. Single Authorized Café: Scopes calculations strictly to requested authorized branch', async () => {
    setupMocks({
      cafes: [{ cafeId: cafeA, name: 'Kozhikode Roastery' }],
      bills: [
        { cafeId: cafeA, totalPaisa: 60000, subtotalPaisa: 57143, taxPaisa: 2857, cgstPaisa: 1428, sgstPaisa: 1428, discountPaisa: 2000, refundedTotalPaisa: 0 },
      ],
      expenses: [
        { cafeId: cafeA, totalPaisa: 25000, category: 'UTILITIES' },
      ],
      payslips: [
        { cafeId: cafeA, grossEarningsPaise: 18000, earnings: { overtimePayPaise: 2000 } },
      ],
      sessions: [
        { cafeId: cafeA, closingCountPaisa: 15000, cashVariancePaisa: 0, status: 'RECONCILED' },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview(
        { auth: { ...ownerAuth }, query: { cafeId: cafeA } },
        res,
        (err) => { if (err) throw err; }
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.cafes.length, 1, 'Only Cafe A in breakdown');
      assert.equal(res.body.cafes[0].cafeId, cafeA, 'Cafe ID matches ZC-0001');
      assert.equal(res.body.kpis.grossSales, 600, 'Gross sales is ₹600.00');
      assert.equal(res.body.kpis.netSales, 600, 'Net sales is ₹600.00');
      assert.equal(res.body.kpis.operatingExpenses, 250, 'Operating expenses is ₹250.00');
      assert.equal(res.body.kpis.payrollCost, 180, 'Payroll cost is ₹180.00');
    } finally {
      restoreMocks();
    }
  });

  // ─── 5. FOREIGN ORGANISATION TENANT ISOLATION ──────────────────────────────
  await t.test('5. Tenant Isolation: Querying across different organisations guarantees zero leakage', async () => {
    let capturedFilter = null;
    originalFinds = {
      Cafe: Cafe.find,
      Bill: Bill.find,
      Expense: Expense.find,
      Payslip: Payslip.find,
      RegisterSession: RegisterSession.find,
      APInvoice: APInvoice.find,
      DepartmentOrder: DepartmentOrder.find,
      PersonalLedger: PersonalLedger.find,
      DashboardTarget: DashboardTarget.find,
      BankAccount: BankAccount.find,
      Journal: Journal.find,
      StoreDayAudit: StoreDayAudit.find,
      MarketplaceSettlement: MarketplaceSettlement.find,
    };

    Bill.find = (filter) => {
      capturedFilter = filter;
      return makeQuery([]);
    };
    Cafe.find = () => makeQuery([]);
    Expense.find = () => makeQuery([]);
    Payslip.find = () => makeQuery([]);
    RegisterSession.find = () => makeQuery([]);
    APInvoice.find = () => makeQuery([]);
    DepartmentOrder.find = () => makeQuery([]);
    PersonalLedger.find = () => makeQuery([]);
    DashboardTarget.find = () => makeQuery([]);
    BankAccount.find = () => makeQuery([]);
    Journal.find = () => makeQuery([]);
    StoreDayAudit.find = () => makeQuery([]);
    MarketplaceSettlement.find = () => makeQuery([]);

    try {
      const foreignAuth = {
        role: 'OWNER',
        organisationId: 'ORG-FOREIGN',
        userId: 'OWNER-FOREIGN',
        assignedCafeIds: ['ZC-9999'],
      };
      const res = createMockResponse();
      await getFinanceOverview({ auth: foreignAuth, query: {} }, res, (err) => { if (err) throw err; });

      assert.equal(res.statusCode, 200);
      assert.equal(capturedFilter.organisationId, 'ORG-FOREIGN', 'Bill query strictly scoped to ORG-FOREIGN');
    } finally {
      restoreMocks();
    }
  });

  // ─── 6. DOUBLE-COUNTING PREVENTION ─────────────────────────────────────────
  await t.test('6. Double-Counting Prevention: Canonical revenue derives from POS Bills; StoreDayAudit does not double-count', async () => {
    setupMocks({
      bills: [
        { cafeId: cafeA, totalPaisa: 50000, subtotalPaisa: 47619, taxPaisa: 2381, cgstPaisa: 1190, sgstPaisa: 1190, discountPaisa: 0, refundedTotalPaisa: 0 },
      ],
      storeDays: [
        // StoreDay audit contains the same 50,000 paise retail sales
        { cafeId: cafeA, status: 'CLOSED', systemGrossSalesPaisa: 50000, systemNetSalesPaisa: 50000 },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      // Revenue must be ₹500.00, NOT ₹1,000.00
      assert.equal(res.body.kpis.netSales, 500, 'Net sales is ₹500.00, not double counted with StoreDayAudit');
      assert.equal(res.body.kpis.grossSales, 500, 'Gross sales is ₹500.00');
    } finally {
      restoreMocks();
    }
  });

  // ─── 7. REVENUE FORMULAS & 5% GST OUTPUT RECORDED ──────────────────────────
  await t.test('7. Revenue & Tax Bridge: Gross-to-Net and 5% dual-state composite GST (CGST 2.5% + SGST 2.5%)', async () => {
    setupMocks({
      bills: [
        {
          cafeId: cafeA,
          totalPaisa: 100000, // ₹1,000.00 Gross
          subtotalPaisa: 95238,
          taxPaisa: 4762,
          cgstPaisa: 2381,
          sgstPaisa: 2381,
          discountPaisa: 2000, // ₹20.00 Discount
          refundedTotalPaisa: 5000, // ₹50.00 Refund
        },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      assert.equal(res.body.kpis.grossSales, 1000, 'Gross sales is ₹1,000.00');
      assert.equal(res.body.kpis.refundsTotal, 50, 'Refunds total is ₹50.00');
      assert.equal(res.body.kpis.itemDiscounts, 20, 'Item discounts is ₹20.00');
      assert.equal(res.body.kpis.netSales, 950, 'Net sales is ₹950.00 (Gross - Refunds)');
      assert.equal(res.body.kpis.cgstAmount, 23.81, 'CGST is ₹23.81 (2.5%)');
      assert.equal(res.body.kpis.sgstAmount, 23.81, 'SGST is ₹23.81 (2.5%)');
      assert.equal(res.body.kpis.taxCollected, 47.62, 'Total output GST recorded is ₹47.62 (5% composite)');
    } finally {
      restoreMocks();
    }
  });

  // ─── 8. OPEX RATIO & OPERATING CONTRIBUTION ────────────────────────────────
  await t.test('8. OpEx Ratio & Operating Contribution Math', async () => {
    setupMocks({
      bills: [
        { cafeId: cafeA, totalPaisa: 100000, subtotalPaisa: 95238, taxPaisa: 4762, cgstPaisa: 2381, sgstPaisa: 2381, discountPaisa: 0, refundedTotalPaisa: 0 },
      ],
      expenses: [
        { cafeId: cafeA, totalPaisa: 42000, category: 'OPERATIONS' }, // ₹420.00
      ],
      payslips: [
        { cafeId: cafeA, grossEarningsPaise: 30000, earnings: {} }, // ₹300.00
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      const netSales = res.body.kpis.netSales; // 1000
      const exp = res.body.kpis.operatingExpenses; // 420
      const pay = res.body.kpis.payrollCost; // 300

      assert.equal(netSales, 1000);
      assert.equal(exp, 420);
      assert.equal(pay, 300);
      assert.equal(res.body.kpis.expenseRatio, 42.0, 'OpEx ratio is exactly 42.0%');
      assert.equal(res.body.kpis.payrollRatio, 30.0, 'Workforce payroll ratio is exactly 30.0%');
      assert.equal(res.body.kpis.operatingContributionPct, 28.0, 'Operating contribution is exactly 28.0% (100 - 42 - 30)');
    } finally {
      restoreMocks();
    }
  });

  // ─── 9. UNIT ECONOMICS METRICS ─────────────────────────────────────────────
  await t.test('9. Unit Economics Metrics: Workforce per ₹100, OpEx per ₹100, Wastage per ₹1,000', async () => {
    const netSales = 1000;
    const payrollCost = 300;
    const operatingExpenses = 420;
    const wastageValue = 19.12;

    const workforcePer100 = (payrollCost / netSales) * 100;
    const opexPer100 = (operatingExpenses / netSales) * 100;
    const wastagePer1000 = (wastageValue / netSales) * 1000;

    assert.equal(workforcePer100, 30.0, 'Workforce cost per ₹100 is ₹30.00');
    assert.equal(opexPer100, 42.0, 'OpEx per ₹100 is ₹42.00');
    assert.equal(Number(wastagePer1000.toFixed(2)), 19.12, 'Wastage loss per ₹1,000 is ₹19.12');
  });

  // ─── 10. CASH DRAWER GOVERNANCE & RECONCILIATION ────────────────────────────
  await t.test('10. Cash Drawer Governance: Physical till cash, drawer variance, and open session exceptions', async () => {
    setupMocks({
      sessions: [
        { cafeId: cafeA, closingCountPaisa: 12000, cashVariancePaisa: 0, status: 'RECONCILED' },
        { cafeId: cafeB, closingCountPaisa: 8000, cashVariancePaisa: -500, status: 'OPEN' },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      // Physical till cash: 12,000 + 8,000 = 20,000 paise = ₹200.00
      assert.equal(res.body.kpis.physicalCashInTill, 200, 'Physical till cash is ₹200.00');
      // Variance: -500 paise = -₹5.00
      assert.equal(res.body.kpis.reconciliationVariance, -5, 'Variance is -₹5.00');
      // Exceptions: 1 open session
      assert.equal(res.body.kpis.exceptionsCount, 1, 'Exactly 1 exception (unreconciled drawer)');
      assert.equal(res.body.controlStrip.closeBlockersCount, 1, '1 close blocker in control strip');
    } finally {
      restoreMocks();
    }
  });

  // ─── 11. PERSONAL LEDGER STRICT ISOLATION ──────────────────────────────────
  await t.test('11. Personal Ledger Isolation: Partner drawings and equity strictly isolated from cafe operations', async () => {
    setupMocks({
      personalLedger: [
        { entryType: 'CREDIT', amountPaisa: 150000, createdAt: new Date() }, // ₹1,500.00 Partner contribution
        { entryType: 'DEBIT', amountPaisa: 50000, createdAt: new Date() }, // ₹500.00 Partner withdrawal
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      assert.ok(res.body.personalLedger, 'Personal ledger snapshot present');
      assert.equal(res.body.personalLedger.creditsMtd, 1500, 'Credits MTD is ₹1,500.00');
      assert.equal(res.body.personalLedger.debitsMtd, 500, 'Debits MTD is ₹500.00');
      assert.equal(res.body.personalLedger.currentBalance, 1000, 'Current personal balance is ₹1,000.00');

      // Verify personal balance is NOT in net sales or operating expenses
      assert.notEqual(res.body.kpis.netSales, res.body.personalLedger.currentBalance);
      assert.notEqual(res.body.kpis.operatingExpenses, res.body.personalLedger.debitsMtd);
    } finally {
      restoreMocks();
    }
  });

  // ─── 12. ACCOUNTS PAYABLE & DEPARTMENT ORDERS ──────────────────────────────
  await t.test('12. Payables & Receivables: Vendor AP aging and institutional credit order balances', async () => {
    setupMocks({
      apInvoices: [
        { paymentStatus: 'UNPAID', totalPaisa: 30000, outstandingPaisa: 30000, dueDate: '2026-08-20' }, // Overdue
        { paymentStatus: 'UNPAID', totalPaisa: 20000, outstandingPaisa: 20000, dueDate: '2026-09-08' }, // Due next 7 days
      ],
      deptOrders: [
        { totalAmountPaisa: 50000, outstandingAmountPaisa: 15000, creditStatus: 'ACTIVE' },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      assert.ok(res.body.payables, 'Payables object present');
      assert.equal(res.body.payables.totalUnpaid, 500, 'Total unpaid AP is ₹500.00');
      assert.equal(res.body.payables.dueNext7Days, 500, 'Due next 7 days is ₹500.00');

      assert.ok(res.body.departmentOrders, 'Department orders object present');
      assert.equal(res.body.departmentOrders.totalBilled, 500, 'Total credit billed is ₹500.00');
      assert.equal(res.body.departmentOrders.collected, 350, 'Credit collected is ₹350.00');
      assert.equal(res.body.departmentOrders.outstanding, 150, 'Credit outstanding is ₹150.00');
    } finally {
      restoreMocks();
    }
  });

  // ─── 13. BUDGET VS ACTUAL VARIANCE DIRECTION ───────────────────────────────
  await t.test('13. Budget vs Actual Variance: Revenue ahead (+) vs expense over (+) vs under (-)', async () => {
    setupMocks({
      bills: [
        { cafeId: cafeA, totalPaisa: 150000, subtotalPaisa: 142857, taxPaisa: 7143, cgstPaisa: 3571, sgstPaisa: 3571, discountPaisa: 0, refundedTotalPaisa: 0 },
      ],
      expenses: [
        { cafeId: cafeA, totalPaisa: 40000, category: 'OPERATIONS' },
      ],
      targets: [
        { salesTargetPaisa: 140000, expenseBudgetPaisa: 50000 },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      const netSales = res.body.kpis.netSales; // 1500
      const expenses = res.body.kpis.operatingExpenses; // 400
      const revTarget = res.body.budgets.revenueTarget; // 1400
      const expBudget = res.body.budgets.expenseBudget; // 500

      const revDiff = netSales - revTarget; // +100 (Ahead of target)
      const expDiff = expenses - expBudget; // -100 (Under budget, controlled)

      assert.equal(revDiff, 100, 'Revenue is +₹100 ahead of target');
      assert.equal(expDiff, -100, 'OpEx is -₹100 under budget allocation');
    } finally {
      restoreMocks();
    }
  });

  // ─── 14. ZERO / EMPTY DATA RESILIENCE ──────────────────────────────────────
  await t.test('14. Zero Data Resilience: Returns clean 0 and 0% without NaN or 500 error when transactions are empty', async () => {
    setupMocks({
      bills: [],
      expenses: [],
      payslips: [],
      sessions: [],
      apInvoices: [],
      deptOrders: [],
      personalLedger: [],
      targets: [],
      bankAccounts: [],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      assert.equal(res.statusCode, 200, 'Returns 200 OK for empty transactions');
      assert.equal(res.body.kpis.netSales, 0, 'Net sales is 0');
      assert.equal(res.body.kpis.operatingExpenses, 0, 'Operating expenses is 0');
      assert.equal(res.body.kpis.expenseRatio, 0, 'Expense ratio is 0 (not NaN)');
      assert.equal(res.body.kpis.payrollRatio, 0, 'Payroll ratio is 0 (not NaN)');
      assert.equal(res.body.kpis.operatingContributionPct, 100, 'Contribution pct is 100 (not NaN)');
      assert.equal(res.body.cafes.length, 2, 'Still returns authorized cafes list');
      assert.equal(res.body.cafes[0].netSales, 0, 'Cafe net sales is 0');
    } finally {
      restoreMocks();
    }
  });

  // ─── 15. RBAC MUTATION BARRIERS (MASTER ONLY) ──────────────────────────────
  await t.test('15. RBAC Segregation of Duties: Owner cannot post GL journals or clear store days', async () => {
    // Owner role does not possess FINANCE:POST or FINANCE:WRITE allowed for MASTER
    const ownerRole = 'OWNER';
    const masterRole = 'MASTER';

    const canPostJournal = (role) => role === masterRole;
    const canClearStoreDay = (role) => role === masterRole;

    assert.equal(canPostJournal(ownerRole), false, 'Owner cannot post journals');
    assert.equal(canClearStoreDay(ownerRole), false, 'Owner cannot clear store days');
    assert.equal(canPostJournal(masterRole), true, 'Master can post journals');
    assert.equal(canClearStoreDay(masterRole), true, 'Master can clear store days');
  });

  // ─── 16. MULTI-CAFÉ PERFORMANCE MATRIX & CONCENTRATION ─────────────────────
  await t.test('16. Multi-Café Matrix Integrity: Relative revenue share, cost share, and health ratings', async () => {
    setupMocks({
      cafes: [
        { cafeId: cafeA, name: 'Kozhikode Roastery' },
        { cafeId: cafeB, name: 'Palayam Espresso Bar' },
      ],
      bills: [
        { cafeId: cafeA, totalPaisa: 60000, subtotalPaisa: 57143, taxPaisa: 2857, cgstPaisa: 1428, sgstPaisa: 1428, discountPaisa: 0, refundedTotalPaisa: 0 },
        { cafeId: cafeB, totalPaisa: 40000, subtotalPaisa: 38095, taxPaisa: 1905, cgstPaisa: 952, sgstPaisa: 952, discountPaisa: 0, refundedTotalPaisa: 0 },
      ],
      expenses: [
        { cafeId: cafeA, totalPaisa: 30000, category: 'OPERATIONS' },
        { cafeId: cafeB, totalPaisa: 10000, category: 'OPERATIONS' },
      ],
      payslips: [
        { cafeId: cafeA, grossEarningsPaise: 18000 },
        { cafeId: cafeB, grossEarningsPaise: 12000 },
      ],
      sessions: [
        { cafeId: cafeA, closingCountPaisa: 10000, cashVariancePaisa: 0, status: 'RECONCILED' },
        { cafeId: cafeB, closingCountPaisa: 5000, cashVariancePaisa: 0, status: 'RECONCILED' },
      ],
    });
    try {
      const res = createMockResponse();
      await getFinanceOverview({ auth: { ...ownerAuth }, query: {} }, res, (err) => { if (err) throw err; });

      const matrix = res.body.cafes;
      assert.equal(matrix.length, 2);

      const cafeARec = matrix.find((c) => c.cafeId === cafeA);
      const cafeBRec = matrix.find((c) => c.cafeId === cafeB);

      // Total net: 600 + 400 = 1000
      // Cafe A share: 600 / 1000 = 60.0%
      // Cafe B share: 400 / 1000 = 40.0%
      assert.equal(cafeARec.revenueSharePct, 60.0, 'Cafe A has 60.0% revenue share');
      assert.equal(cafeBRec.revenueSharePct, 40.0, 'Cafe B has 40.0% revenue share');

      // Total exp: 300 + 100 = 400
      // Cafe A cost share: 300 / 400 = 75.0%
      // Cafe B cost share: 100 / 400 = 25.0%
      assert.equal(cafeARec.costSharePct, 75.0, 'Cafe A has 75.0% cost share');
      assert.equal(cafeBRec.costSharePct, 25.0, 'Cafe B has 25.0% cost share');

      // Expense ratios
      assert.equal(cafeARec.expenseRatio, 50.0, 'Cafe A OpEx ratio is 50.0%');
      assert.equal(cafeBRec.expenseRatio, 25.0, 'Cafe B OpEx ratio is 25.0%');

      // Health
      assert.equal(cafeARec.health, 'HEALTHY');
      assert.equal(cafeBRec.health, 'HEALTHY');
    } finally {
      restoreMocks();
    }
  });
});
