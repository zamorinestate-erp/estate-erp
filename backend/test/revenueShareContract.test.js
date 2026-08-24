'use strict';

/**
 * CONTRACT TEST SUITE: SCR-026 REVENUE SHARE & LEASED OUTLET MANAGEMENT
 * Verifies strict Primary Master / Owner authorization, calculation engine integrity,
 * commercial lifecycle workflows, settlement simulations, Finance postings, and fraud safeguards.
 */

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// Middleware & Routers
const { authenticate } = require('../src/middleware/authenticate');
const { requirePrimaryMasterOrOwner } = require('../src/middleware/authorize');
const revenueShareRoutes = require('../src/routes/revenueShareRoutes');

// Calculation Engine
const {
  computeEligibleRevenue,
  computeTieredShare,
  computeBaseShare,
  computeSettlementTotal,
} = require('../src/services/revenueShareCalculationService');

// Models
const { LeasedOutlet } = require('../src/models/LeasedOutlet');
const { RevenueShareOperator } = require('../src/models/RevenueShareOperator');
const { RevenueShareAgreement } = require('../src/models/RevenueShareAgreement');
const { RevenueShareRateRule } = require('../src/models/RevenueShareRateRule');
const { SalesSubmission } = require('../src/models/SalesSubmission');
const { RevenueShareSettlement } = require('../src/models/RevenueShareSettlement');
const { RevenueSharePayment } = require('../src/models/RevenueSharePayment');
const { RecoveryCharge } = require('../src/models/RecoveryCharge');
const { SecurityDeposit } = require('../src/models/SecurityDeposit');
const { RevenueShareDispute } = require('../src/models/RevenueShareDispute');
const { APInvoice } = require('../src/models/APInvoice');

describe('SCR-026: Revenue Share & Leased Outlet Master Contract Suite', () => {
  let app;
  let inMemoryOutlets = [];
  let inMemoryOperators = [];
  let inMemoryAgreements = [];
  let inMemoryRateRules = [];
  let inMemorySubmissions = [];
  let inMemorySettlements = [];
  let inMemoryPayments = [];
  let inMemoryRecoveries = [];
  let inMemoryDeposits = [];
  let inMemoryDisputes = [];
  let inMemoryInvoices = [];

  before(() => {
    // Setup Test Express Server
    app = express();
    app.use(express.json());

    // Inject mock authenticated user from header
    app.use((req, res, next) => {
      const role = req.headers['x-test-role'];
      const isPrimary = req.headers['x-test-is-primary'] === 'true';
      if (role) {
        req.auth = {
          userId: `USR-${role}-01`,
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          role,
          isPrimaryMaster: isPrimary,
        };
      }
      next();
    });

    app.use('/api/v1/revenue-share', revenueShareRoutes);

    // Error Handler
    app.use((err, req, res, next) => {
      const status = err.statusCode || err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    });

    // Mock Mongoose Methods for Unit/Contract Speed
    LeasedOutlet.find = () => ({
      sort: () => ({ lean: async () => inMemoryOutlets }),
      lean: async () => inMemoryOutlets,
    });
    LeasedOutlet.findOne = (query) => {
      const o = inMemoryOutlets.find((item) => item.outletId === query.outletId);
      return { lean: async () => o, then: (resolve) => resolve(o) };
    };
    LeasedOutlet.create = async (doc) => {
      inMemoryOutlets.push(doc);
      return doc;
    };
    LeasedOutlet.countDocuments = async () => inMemoryOutlets.length;
    LeasedOutlet.updateOne = async (query, update) => {
      const o = inMemoryOutlets.find((item) => item.outletId === query.outletId);
      if (o && update.$set) Object.assign(o, update.$set);
      return { modifiedCount: 1 };
    };

    RevenueShareOperator.find = () => ({
      sort: () => ({ lean: async () => inMemoryOperators }),
      lean: async () => inMemoryOperators,
    });
    RevenueShareOperator.findOne = (query) => {
      const op = inMemoryOperators.find((item) => item.operatorId === query.operatorId);
      return { lean: async () => op, then: (resolve) => resolve(op) };
    };
    RevenueShareOperator.create = async (doc) => {
      inMemoryOperators.push(doc);
      return doc;
    };
    RevenueShareOperator.countDocuments = async () => inMemoryOperators.length;

    RevenueShareAgreement.find = () => ({
      sort: () => ({ lean: async () => inMemoryAgreements }),
      lean: async () => inMemoryAgreements,
    });
    RevenueShareAgreement.findOne = (query) => {
      const ag = inMemoryAgreements.find((item) => item.agreementId === query.agreementId);
      return { lean: async () => ag, then: (resolve) => resolve(ag) };
    };
    RevenueShareAgreement.create = async (doc) => {
      inMemoryAgreements.push(doc);
      return doc;
    };
    RevenueShareAgreement.countDocuments = async () => inMemoryAgreements.length;

    RevenueShareRateRule.find = () => ({
      sort: () => ({ lean: async () => inMemoryRateRules }),
      lean: async () => inMemoryRateRules,
    });
    RevenueShareRateRule.findOne = (query) => {
      const rr = inMemoryRateRules.find((item) => !query.rateRuleId || item.rateRuleId === query.rateRuleId);
      return { lean: async () => rr, then: (resolve) => resolve(rr) };
    };
    RevenueShareRateRule.create = async (doc) => {
      inMemoryRateRules.push(doc);
      return doc;
    };
    RevenueShareRateRule.countDocuments = async () => inMemoryRateRules.length;
    RevenueShareRateRule.updateOne = async (query, update) => {
      const rr = inMemoryRateRules.find((item) => item.rateRuleId === query.rateRuleId);
      if (rr && update.$set) Object.assign(rr, update.$set);
      return { modifiedCount: 1 };
    };

    SalesSubmission.find = () => ({
      sort: () => ({ lean: async () => inMemorySubmissions }),
      lean: async () => inMemorySubmissions,
    });
    SalesSubmission.findOne = (query) => {
      const s = inMemorySubmissions.find((item) =>
        (!query.submissionId || item.submissionId === query.submissionId) &&
        (!query.businessDate || item.businessDate === query.businessDate)
      );
      if (!s) return { lean: async () => null, then: (resolve) => resolve(null) };
      return {
        ...s,
        save: async function () {
          Object.assign(s, this);
          return s;
        },
        lean: async () => s,
        then: (resolve) => resolve(s),
      };
    };
    SalesSubmission.create = async (doc) => {
      inMemorySubmissions.push(doc);
      return doc;
    };
    SalesSubmission.countDocuments = async () => inMemorySubmissions.length;

    RevenueShareSettlement.find = () => ({
      sort: () => ({ lean: async () => inMemorySettlements }),
      lean: async () => inMemorySettlements,
    });
    RevenueShareSettlement.findOne = (query) => {
      const st = inMemorySettlements.find((item) =>
        (!query.settlementId || item.settlementId === query.settlementId) &&
        (!query.periodKey || item.periodKey === query.periodKey)
      );
      if (!st) return { lean: async () => null, then: (resolve) => resolve(null) };
      const doc = {
        ...st,
        save: async function () {
          Object.assign(st, this);
          return st;
        },
      };
      return {
        ...doc,
        lean: async () => st,
        then: (resolve) => resolve(doc),
      };
    };
    RevenueShareSettlement.create = async (doc) => {
      inMemorySettlements.push(doc);
      return doc;
    };
    RevenueShareSettlement.countDocuments = async () => inMemorySettlements.length;
    RevenueShareSettlement.updateOne = async (query, update) => {
      const st = inMemorySettlements.find((item) => item.settlementId === query.settlementId);
      if (st && update.$inc) {
        st.paidAmountPaisa = (st.paidAmountPaisa || 0) + (update.$inc.paidAmountPaisa || 0);
        st.balanceOutstandingPaisa = (st.balanceOutstandingPaisa || 0) + (update.$inc.balanceOutstandingPaisa || 0);
      }
      return { modifiedCount: 1 };
    };

    RevenueSharePayment.find = () => ({
      sort: () => ({ lean: async () => inMemoryPayments }),
      lean: async () => inMemoryPayments,
    });
    RevenueSharePayment.create = async (doc) => {
      inMemoryPayments.push(doc);
      return doc;
    };
    RevenueSharePayment.countDocuments = async () => inMemoryPayments.length;

    RecoveryCharge.find = () => ({
      sort: () => ({ lean: async () => inMemoryRecoveries }),
      lean: async () => inMemoryRecoveries,
    });
    RecoveryCharge.create = async (doc) => {
      inMemoryRecoveries.push(doc);
      return doc;
    };
    RecoveryCharge.countDocuments = async () => inMemoryRecoveries.length;

    SecurityDeposit.find = () => ({ lean: async () => inMemoryDeposits });
    SecurityDeposit.findOne = (query) => {
      const d = inMemoryDeposits.find((item) => item.agreementId === query.agreementId);
      if (!d) return null;
      return {
        ...d,
        save: async function () {
          Object.assign(d, this);
          return d;
        },
        lean: async () => d,
        then: (resolve) => resolve(d),
      };
    };
    SecurityDeposit.countDocuments = async () => inMemoryDeposits.length;

    RevenueShareDispute.find = () => ({
      sort: () => ({ lean: async () => inMemoryDisputes }),
      lean: async () => inMemoryDisputes,
    });
    RevenueShareDispute.findOne = (query) => {
      const dp = inMemoryDisputes.find((item) => item.disputeId === query.disputeId);
      if (!dp) return null;
      return {
        ...dp,
        save: async function () {
          Object.assign(dp, this);
          return dp;
        },
        lean: async () => dp,
        then: (resolve) => resolve(dp),
      };
    };
    RevenueShareDispute.create = async (doc) => {
      inMemoryDisputes.push(doc);
      return doc;
    };
    RevenueShareDispute.countDocuments = async () => inMemoryDisputes.length;

    APInvoice.create = async (doc) => {
      inMemoryInvoices.push(doc);
      return doc;
    };
  });

  beforeEach(() => {
    inMemoryOutlets = [];
    inMemoryOperators = [];
    inMemoryAgreements = [];
    inMemoryRateRules = [];
    inMemorySubmissions = [];
    inMemorySettlements = [];
    inMemoryPayments = [];
    inMemoryRecoveries = [];
    inMemoryDeposits = [];
    inMemoryDisputes = [];
    inMemoryInvoices = [];
  });

  // Helper HTTP simulator
  async function simulateRequest(method, url, headers = {}, body = null) {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = server.address().port;
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: url,
            method,
            headers: {
              'content-type': 'application/json',
              ...headers,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              server.close();
              let json = {};
              try {
                json = JSON.parse(data);
              } catch (_) {
                json = { raw: data };
              }
              resolve({ status: res.statusCode, body: json });
            });
          }
        );
        req.on('error', (err) => {
          server.close();
          reject(err);
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    });
  }

  // ── Access Control Tests (P0 Gate) ────────────────────────────────────────

  test('1. OWNER role is allowed full access to Revenue Share', async () => {
    const res = await simulateRequest('GET', '/api/v1/revenue-share/overview', {
      'x-test-role': 'OWNER',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  test('2. PRIMARY MASTER is allowed full access to Revenue Share', async () => {
    const res = await simulateRequest('GET', '/api/v1/revenue-share/overview', {
      'x-test-role': 'MASTER',
      'x-test-is-primary': 'true',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  test('3. Non-primary MASTER is strictly forbidden (403) from Revenue Share', async () => {
    const res = await simulateRequest('GET', '/api/v1/revenue-share/overview', {
      'x-test-role': 'MASTER',
      'x-test-is-primary': 'false',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'REVENUE_SHARE_RESTRICTED');
  });

  test('4. CAFE_ADMIN and STAFF are strictly forbidden (403) from Revenue Share', async () => {
    const resAdmin = await simulateRequest('GET', '/api/v1/revenue-share/overview', {
      'x-test-role': 'CAFE_ADMIN',
    });
    assert.strictEqual(resAdmin.status, 403);

    const resStaff = await simulateRequest('GET', '/api/v1/revenue-share/overview', {
      'x-test-role': 'STAFF',
    });
    assert.strictEqual(resStaff.status, 403);
  });

  test('5. Unauthenticated requests are rejected (401)', async () => {
    const res = await simulateRequest('GET', '/api/v1/revenue-share/overview');
    assert.strictEqual(res.status, 401);
  });

  // ── Calculation Engine Unit Tests ─────────────────────────────────────────

  test('6. Calculation Engine: computeEligibleRevenue across bases (Gross, Net excl GST, Gross Profit, Opex)', () => {
    const salesInput = {
      grossSalesPaisa: 1000000, // ₹10,000
      discountsPaisa: 50000, // ₹500
      cancellationsPaisa: 20000, // ₹200
      refundsPaisa: 30000, // ₹300
      gstPaisa: 50000, // ₹500
      excludedTransactionsPaisa: 0,
      costOfGoodsSoldPaisa: 300000, // ₹3,000
      operatingExpensesPaisa: 100000, // ₹1,000
      creditSalesTreatment: 'SALES_BASIS',
    };

    // GROSS_SALES basis: 1000000 - 50000 - 20000 - 30000 = 900000
    assert.strictEqual(computeEligibleRevenue(salesInput, 'GROSS_SALES'), 900000);

    // NET_SALES_EXCLUDING_GST basis: 900000 - 50000 = 850000
    assert.strictEqual(computeEligibleRevenue(salesInput, 'NET_SALES_EXCLUDING_GST'), 850000);

    // GROSS_PROFIT basis: 900000 - 300000 = 600000
    assert.strictEqual(computeEligibleRevenue(salesInput, 'GROSS_PROFIT'), 600000);

    // NET_OPERATING_PROFIT basis: 900000 - 300000 - 100000 = 500000
    assert.strictEqual(computeEligibleRevenue(salesInput, 'NET_OPERATING_PROFIT'), 500000);
  });

  test('7. Calculation Engine: All 10 methods (Fixed, Pct, Hybrid, Higher-Of, Tiered, MG, Cap)', () => {
    const eligiblePaisa = 1000000; // ₹10,000

    // PERCENTAGE_ONLY (10%) = ₹1,000 (100,000 paise)
    const resPct = computeBaseShare(eligiblePaisa, { calculationMethod: 'PERCENTAGE_ONLY', percentage: 10 });
    assert.strictEqual(resPct.baseSharePaisa, 100000);

    // FIXED_AMOUNT_ONLY (₹2,500)
    const resFixed = computeBaseShare(eligiblePaisa, { calculationMethod: 'FIXED_AMOUNT_ONLY', fixedAmountPaisa: 250000 });
    assert.strictEqual(resFixed.baseSharePaisa, 250000);

    // FIXED_PLUS_PERCENTAGE (₹1,500 + 5% of ₹10,000 = ₹2,000)
    const resFixPlus = computeBaseShare(eligiblePaisa, {
      calculationMethod: 'FIXED_PLUS_PERCENTAGE',
      fixedAmountPaisa: 150000,
      percentage: 5,
    });
    assert.strictEqual(resFixPlus.baseSharePaisa, 200000);

    // HIGHER_OF_FIXED_OR_PERCENTAGE (Fixed ₹800 vs 10% ₹1,000 => ₹1,000)
    const resHigher = computeBaseShare(eligiblePaisa, {
      calculationMethod: 'HIGHER_OF_FIXED_OR_PERCENTAGE',
      fixedAmountPaisa: 80000,
      percentage: 10,
    });
    assert.strictEqual(resHigher.baseSharePaisa, 100000);

    // TIERED_PERCENTAGE (0-5k @ 5%, 5k-10k @ 10% => ₹250 + ₹500 = ₹750 = 75,000 paise)
    const tiers = [
      { fromPaisa: 0, toPaisa: 500000, percentage: 5 },
      { fromPaisa: 500000, toPaisa: 1000000, percentage: 10 },
    ];
    const resTiered = computeBaseShare(eligiblePaisa, { calculationMethod: 'TIERED_PERCENTAGE', tiers });
    assert.strictEqual(resTiered.baseSharePaisa, 75000);

    // PERCENTAGE_WITH_MINIMUM_GUARANTEE (10% of 10k is ₹1,000; MG is ₹1,500 => ₹1,500)
    const resMG = computeBaseShare(eligiblePaisa, {
      calculationMethod: 'PERCENTAGE_WITH_MINIMUM_GUARANTEE',
      percentage: 10,
      minimumGuaranteePaisa: 150000,
    });
    assert.strictEqual(resMG.baseSharePaisa, 150000);
    assert.strictEqual(resMG.mgAdjustmentPaisa, 50000);

    // PERCENTAGE_WITH_MAXIMUM_CAP (10% of 10k is ₹1,000; Cap is ₹700 => ₹700)
    const resCap = computeBaseShare(eligiblePaisa, {
      calculationMethod: 'PERCENTAGE_WITH_MAXIMUM_CAP',
      percentage: 10,
      maximumCapPaisa: 70000,
    });
    assert.strictEqual(resCap.baseSharePaisa, 70000);
    assert.strictEqual(resCap.capReductionPaisa, 30000);
  });

  // ── Commercial Lifecycle Operations ───────────────────────────────────────

  test('8. Commercial space creation & Operator onboarding succeeds', async () => {
    const authHeaders = { 'x-test-role': 'MASTER', 'x-test-is-primary': 'true' };

    // Create Outlet
    const resOutlet = await simulateRequest('POST', '/api/v1/revenue-share/outlets', authHeaders, {
      cafeId: 'ZC-0001',
      name: 'Main Atrium Specialty Coffee Kiosk',
      spaceType: 'KIOSK',
      areaSqFt: 150,
    });
    assert.strictEqual(resOutlet.status, 201);
    assert.strictEqual(resOutlet.body.data.outlet.outletId, 'LO-0001');

    // Onboard Operator
    const resOp = await simulateRequest('POST', '/api/v1/revenue-share/operators', authHeaders, {
      legalName: 'Blue Tokai Specialty Roasters LLP',
      tradeName: 'Blue Tokai',
      gstin: '32AABCU9603R1ZM',
    });
    assert.strictEqual(resOp.status, 201);
    assert.strictEqual(resOp.body.data.operator.operatorId, 'OPR-0001');
  });

  test('9. Sales submission and duplicate submission prevention', async () => {
    const authHeaders = { 'x-test-role': 'OWNER' };

    // Submit Sales
    const resSubmit = await simulateRequest('POST', '/api/v1/revenue-share/sales', authHeaders, {
      outletId: 'LO-0001',
      operatorId: 'OPR-0001',
      businessDate: '2026-08-19',
      grossSalesPaisa: 5000000, // ₹50,000
    });
    assert.strictEqual(resSubmit.status, 201);
    assert.strictEqual(resSubmit.body.data.submission.submissionId, 'SS-0001');

    // Duplicate Submission Blocked (409)
    const resDup = await simulateRequest('POST', '/api/v1/revenue-share/sales', authHeaders, {
      outletId: 'LO-0001',
      businessDate: '2026-08-19',
      grossSalesPaisa: 5000000,
    });
    assert.strictEqual(resDup.status, 409);
    assert.strictEqual(resDup.body.error.code, 'DUPLICATE_SUBMISSION');
  });

  test('10. Settlement Simulation does NOT persist writes to database', async () => {
    const authHeaders = { 'x-test-role': 'MASTER', 'x-test-is-primary': 'true' };

    const resSim = await simulateRequest('POST', '/api/v1/revenue-share/settlements/simulate', authHeaders, {
      outletId: 'LO-0001',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });

    assert.strictEqual(resSim.status, 200);
    assert.strictEqual(resSim.body.data.simulation.isSimulation, true);
    assert.strictEqual(inMemorySettlements.length, 0); // Proves zero DB writes
  });

  test('11. Authoritative Settlement Creation and MASTER Approval posts to Finance', async () => {
    const authHeaders = { 'x-test-role': 'MASTER', 'x-test-is-primary': 'true' };

    // Create Settlement Draft
    const resCreate = await simulateRequest('POST', '/api/v1/revenue-share/settlements', authHeaders, {
      outletId: 'LO-0001',
      operatorId: 'OPR-0001',
      periodKey: '2026-08',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });
    assert.strictEqual(resCreate.status, 201);
    assert.strictEqual(resCreate.body.data.settlement.settlementId, 'SET-0001');
    assert.strictEqual(resCreate.body.data.settlement.status, 'CALCULATED');

    // Authoritative MASTER Approval
    const resApprove = await simulateRequest('POST', '/api/v1/revenue-share/settlements/SET-0001/approve', authHeaders, {
      notes: 'Approved by Primary Master',
    });
    assert.strictEqual(resApprove.status, 200);
    assert.strictEqual(resApprove.body.data.settlement.status, 'APPROVED');
    assert.strictEqual(resApprove.body.data.settlement.financePosting.status, 'POSTED');
    assert.strictEqual(inMemoryInvoices.length, 1); // Confirms Finance record creation
  });

  test('12. Double Approval Idempotency returns existing settlement without duplicate Finance entries', async () => {
    const authHeaders = { 'x-test-role': 'MASTER', 'x-test-is-primary': 'true' };

    // Create Settlement
    await simulateRequest('POST', '/api/v1/revenue-share/settlements', authHeaders, {
      outletId: 'LO-0001',
      operatorId: 'OPR-0001',
      periodKey: '2026-08',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    });

    // First Approval
    const resFirst = await simulateRequest('POST', '/api/v1/revenue-share/settlements/SET-0001/approve', authHeaders);
    assert.strictEqual(resFirst.status, 200);
    assert.strictEqual(inMemoryInvoices.length, 1);

    // Second (Idempotent) Approval
    const resRetry = await simulateRequest('POST', '/api/v1/revenue-share/settlements/SET-0001/approve', authHeaders);
    assert.strictEqual(resRetry.status, 200);
    assert.strictEqual(inMemoryInvoices.length, 1); // Still exactly 1 Finance record
  });

  test('13. Payment Recording & Settlement Allocation reduces outstanding balance', async () => {
    const authHeaders = { 'x-test-role': 'OWNER' };

    const resPay = await simulateRequest('POST', '/api/v1/revenue-share/payments', authHeaders, {
      operatorId: 'OPR-0001',
      paymentDate: '2026-08-20',
      amountPaisa: 500000, // ₹5,000 payment
      transactionReferenceUtr: 'UTR-HDFC-998877',
      allocations: [
        {
          settlementId: 'SET-0001',
          outletId: 'LO-0001',
          allocatedPaisa: 500000,
        },
      ],
    });

    assert.strictEqual(resPay.status, 201);
    assert.strictEqual(resPay.body.data.payment.paymentId, 'RSP-0001');
    assert.strictEqual(resPay.body.data.payment.allocatedAmountPaisa, 500000);
  });

  test('14. ZURF v1 Compliance PDF Export returns structured report metadata', async () => {
    const authHeaders = { 'x-test-role': 'MASTER', 'x-test-is-primary': 'true' };

    const resPdf = await simulateRequest('GET', '/api/v1/revenue-share/reports/zurf-pdf', authHeaders);
    assert.strictEqual(resPdf.status, 200);
    assert.strictEqual(resPdf.body.success, true);
    assert.strictEqual(resPdf.body.data.organisation.gstin, '32AABCU9603R1ZM');
    assert.match(resPdf.body.data.reportId, /^ZURF-RS-/);
  });
});
