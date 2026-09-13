'use strict';

/**
 * PM-02: Reports & Analytics Live Financial Aggregation Verification Suite
 * Tests 36 scenarios across Overview, Sales, Finance, Scope, and Security.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const reportController = require('../src/controllers/reportController');
const { Bill } = require('../src/models/Bill');
const { Expense } = require('../src/models/Expense');
const { PayrollRun } = require('../src/models/PayrollRun');
const { Payslip } = require('../src/models/Payslip');
const { RegisterSession } = require('../src/models/RegisterSession');

function invokeHandler(handler, req) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let body = null;
    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        body = data;
        resolve({ statusCode, body });
        return res;
      },
      send(data) {
        body = data;
        resolve({ statusCode, body });
        return res;
      },
    };
    try {
      const result = handler(req, res, (err) => {
        if (err) reject(err);
      });
      if (result && typeof result.catch === 'function') {
        result.catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

test('PM-02 / Reports & Analytics Live Financial Aggregation Suite', async (suite) => {
  const origBillAgg = Bill.aggregate;
  const origExpAgg = Expense.aggregate;
  const origPayrollAgg = PayrollRun.aggregate;
  const origPayslipAgg = Payslip.aggregate;
  const origSessionFind = RegisterSession.find;

  suite.beforeEach(() => {
    Bill.aggregate = async () => [];
    Expense.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Payslip.aggregate = async () => [];
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });
  });

  suite.afterEach(() => {
    Bill.aggregate = origBillAgg;
    Expense.aggregate = origExpAgg;
    PayrollRun.aggregate = origPayrollAgg;
    Payslip.aggregate = origPayslipAgg;
    RegisterSession.find = origSessionFind;
  });

  // ─── SECTION 30: OVERVIEW ENDPOINT ──────────────────────────────────────────

  await suite.test('30.1 Overview: Empty database returns valid zero/empty state', async () => {
    Bill.aggregate = async () => [];
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    const res = await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.kpis.netSalesMdt, '₹0.00');
    assert.equal(res.body.data.kpis.totalOrders, 0);
    assert.equal(res.body.data.kpis.operatingSnapshot, 'No Activity');
    assert.equal(res.body.data.kpis.attentionItems, 0);
    assert.deepEqual(res.body.data.actionCentreItems, []);
  });

  await suite.test('30.2 Overview: One valid completed bill reflects exact totals', async () => {
    Bill.aggregate = async () => [
      {
        totalOrders: 1,
        grossSalesPaisa: 35000,
        netSalesPaisa: 35000,
      },
    ];
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    const res = await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.kpis.netSalesMdt, '₹350.00');
    assert.equal(res.body.data.kpis.totalOrders, 1);
    assert.equal(res.body.data.kpis.operatingSnapshot, '1 Orders Reconciled');
  });

  await suite.test('30.3 Overview: Multiple cafés aggregated correctly', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ totalOrders: 5, grossSalesPaisa: 150000, netSalesPaisa: 150000 }];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    const res = await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(res.statusCode, 200);
    assert.equal(capturedMatch.cafeId, undefined, 'Master overview has no single cafe restriction');
    assert.equal(res.body.data.kpis.totalOrders, 5);
  });

  await suite.test('30.4 Overview: Date range excludes out-of-range bills', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ totalOrders: 2, grossSalesPaisa: 70000, netSalesPaisa: 70000 }];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: { dateFrom: '2026-08-01', dateTo: '2026-08-15' },
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.deepEqual(capturedMatch.businessDate, { $gte: '2026-08-01', $lte: '2026-08-15' });
  });

  await suite.test('30.5 Overview: Cancelled/void bills excluded by status filter', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.deepEqual(capturedMatch.status, { $in: ['COMPLETED', 'PARTIALLY_REFUNDED'] });
  });

  await suite.test('30.6 Overview: Primary Master organisation-wide totals', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ totalOrders: 10, grossSalesPaisa: 250000, netSalesPaisa: 250000 }];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(capturedMatch.organisationId, 'ORG-ZAMORIN');
    assert.equal(capturedMatch.cafeId, undefined);
  });

  await suite.test('30.7 Overview: Primary Master single-café filter', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ totalOrders: 4, grossSalesPaisa: 100000, netSalesPaisa: 100000 }];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: { cafeId: 'ZC-0002' },
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(capturedMatch.cafeId, 'ZC-0002');
  });

  await suite.test('30.8 Overview: Owner assigned-café aggregate', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ totalOrders: 3, grossSalesPaisa: 90000, netSalesPaisa: 90000 }];
    };
    RegisterSession.find = () => ({ limit: () => ({ lean: async () => [] }) });

    const req = {
      query: {},
      auth: {
        userId: 'OW-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.deepEqual(capturedMatch.cafeId, { $in: ['ZC-0001', 'ZC-0002'] });
  });

  await suite.test('30.9 Overview: Owner unauthorized café denied with 403', async () => {
    const req = {
      query: { cafeId: 'ZC-9999' },
      auth: {
        userId: 'OW-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await assert.rejects(
      async () => {
        await invokeHandler(reportController.getAnalyticsOverview, req);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );
  });

  // ─── SECTION 31: SALES ANALYTICS ────────────────────────────────────────────

  await suite.test('31.10 Sales: Gross sales calculation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [
          {
            orderCount: 2,
            grossSalesPaise: 50000,
            discountPaise: 2000,
            refundPaise: 0,
            taxesPaise: 2500,
            netSalesPaise: 50500,
          },
        ],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.summary.grossSalesPaise, 50000);
  });

  await suite.test('31.11 Sales: Net sales calculation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [
          {
            orderCount: 1,
            grossSalesPaise: 40000,
            discountPaise: 0,
            refundPaise: 5000,
            taxesPaise: 2000,
            netSalesPaise: 35000,
          },
        ],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.body.data.summary.netSalesPaise, 35000);
  });

  await suite.test('31.12 Sales: Discount calculation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 1, discountPaise: 3000, netSalesPaise: 27000 }],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.body.data.summary.discountPaise, 3000);
  });

  await suite.test('31.13 Sales: Tax calculation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 1, taxesPaise: 1500, netSalesPaise: 31500 }],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.body.data.summary.taxesPaise, 1500);
    assert.equal(res.body.data.summary.gstCollectedPaise, 1500);
  });

  await suite.test('31.14 Sales: Order count', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 12, netSalesPaise: 360000 }],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.body.data.summary.orderCount, 12);
    assert.equal(res.body.data.summary.transactionCount, 12);
  });

  await suite.test('31.15 Sales: Average order value (AOV) in integer paisa', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 4, netSalesPaise: 100000 }],
        hourly: [],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.body.data.summary.aovPaise, 25000); // ₹250.00
  });

  await suite.test('31.16 Sales: Payment mix calculation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 3, netSalesPaise: 100000 }],
        hourly: [],
        serviceModes: [],
        tenders: [
          { _id: 'UPI', amountPaisa: 60000, count: 2 },
          { _id: 'CARD', amountPaisa: 40000, count: 1 },
        ],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    const mix = res.body.data.paymentMix;
    assert.equal(mix.length, 2);
    assert.equal(mix[0].method, 'UPI');
    assert.equal(mix[0].amount, 600);
    assert.equal(mix[0].pct, 60.0);
    assert.equal(mix[1].method, 'CARD');
    assert.equal(mix[1].amount, 400);
    assert.equal(mix[1].pct, 40.0);
  });

  await suite.test('31.17 Sales: Split tender allocation', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 1, netSalesPaise: 50000 }],
        hourly: [],
        serviceModes: [],
        tenders: [
          { _id: 'CASH', amountPaisa: 25000, count: 1 },
          { _id: 'UPI', amountPaisa: 25000, count: 1 },
        ],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    const mix = res.body.data.paymentMix;
    assert.equal(mix.length, 2);
    assert.equal(mix[0].pct, 50.0);
    assert.equal(mix[1].pct, 50.0);
  });

  await suite.test('31.18 Sales: Hourly trend buckets', async () => {
    Bill.aggregate = async () => [
      {
        summary: [{ orderCount: 2, netSalesPaise: 50000 }],
        hourly: [
          { _id: '09:00', orders: 1, netSalesPaisa: 20000 },
          { _id: '10:00', orders: 1, netSalesPaisa: 30000 },
        ],
        serviceModes: [],
        tenders: [],
      },
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    const hourly = res.body.data.hourlyTrends;
    assert.equal(hourly.length, 2);
    assert.equal(hourly[0].hour, '09:00');
    assert.equal(hourly[0].orders, 1);
    assert.equal(hourly[0].netSales, 200.0);
  });

  await suite.test('31.19 Sales: Empty period returns truthful zero state', async () => {
    Bill.aggregate = async () => [];

    const req = {
      query: { period: 'yesterday' },
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.summary.grossSalesPaise, 0);
    assert.equal(res.body.data.summary.netSalesPaise, 0);
    assert.equal(res.body.data.summary.orderCount, 0);
    assert.deepEqual(res.body.data.hourlyTrends, []);
    assert.deepEqual(res.body.data.paymentMix, []);
    assert.deepEqual(res.body.data.serviceModes, []);
  });

  await suite.test('31.20 Sales: Multi-café aggregation respects organisation scope', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(capturedMatch.organisationId, 'ORG-ZAMORIN');
    assert.equal(capturedMatch.cafeId, undefined);
  });

  // ─── SECTION 32: FINANCE ANALYTICS ──────────────────────────────────────────

  await suite.test('32.21 Finance: Revenue source derived from Bill', async () => {
    Bill.aggregate = async () => [
      { grossSalesPaisa: 100000, discountPaisa: 5000, refundPaisa: 0, netSalesPaisa: 95000 },
    ];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.plStatement.grossRevenue, 1000);
    assert.equal(res.body.data.plStatement.discounts, 50);
    assert.equal(res.body.data.plStatement.netRevenue, 950);
  });

  await suite.test('32.22 Finance: Expense inclusion status (APPROVED / PAID)', async () => {
    let capturedMatch = null;
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [{ _id: 'RENT', totalAmountPaisa: 4000000 }];
    };

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.deepEqual(capturedMatch.status, { $in: ['APPROVED', 'PAID'] });
    assert.equal(res.body.data.plStatement.operatingExpenses.rent, 40000);
  });

  await suite.test('32.23 Finance: Expense exclusion (DRAFT/SUBMITTED excluded)', async () => {
    let capturedMatch = null;
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.ok(!capturedMatch.status.$in.includes('DRAFT'));
    assert.ok(!capturedMatch.status.$in.includes('SUBMITTED'));
  });

  await suite.test('32.24 Finance: Labour calculation source from PayrollRun', async () => {
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [{ totalGrossPaise: 7500000 }];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.equal(res.body.data.plStatement.operatingExpenses.labour, 75000);
  });

  await suite.test('32.25 Finance: COGS is UNAVAILABLE per Section 15 & 41', async () => {
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.equal(res.body.data.plStatement.cogs, null);
    assert.equal(res.body.data.plStatement.cogsStatus, 'UNAVAILABLE');
    assert.equal(res.body.data.plStatement.grossProfit, null);
    assert.equal(res.body.data.plStatement.grossMarginPct, null);
  });

  await suite.test('32.26 Finance: EBITDA formula (Net Revenue - Total Opex)', async () => {
    Bill.aggregate = async () => [{ netSalesPaisa: 10000000 }]; // ₹100,000 net revenue
    PayrollRun.aggregate = async () => [{ totalGrossPaise: 3000000 }]; // ₹30,000 labour
    Expense.aggregate = async () => [
      { _id: 'RENT', totalAmountPaisa: 2000000 }, // ₹20,000 rent
      { _id: 'UTILITIES', totalAmountPaisa: 1000000 }, // ₹10,000 utilities
    ];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    // Net Rev = 100,000. Total Opex = 30k + 20k + 10k = 60k. EBITDA = 40,000
    assert.equal(res.body.data.plStatement.netRevenue, 100000);
    assert.equal(res.body.data.plStatement.operatingExpenses.totalOpex, 60000);
    assert.equal(res.body.data.plStatement.ebitda, 40000);
    assert.equal(res.body.data.plStatement.ebitdaMarginPct, 40.0);
  });

  await suite.test('32.27 Finance: Zero revenue period returns clean zeros', async () => {
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.equal(res.body.data.plStatement.grossRevenue, 0);
    assert.equal(res.body.data.plStatement.netRevenue, 0);
    assert.equal(res.body.data.plStatement.ebitda, 0);
    assert.equal(res.body.data.plStatement.ebitdaMarginPct, 0);
  });

  await suite.test('32.28 Finance: Missing COGS source transparent in waterfall', async () => {
    Bill.aggregate = async () => [];
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: { userId: 'PM-01', role: 'MASTER', isPrimaryMaster: true, organisationId: 'ORG-ZAMORIN' },
    };

    const res = await invokeHandler(reportController.getFinanceAnalytics, req);
    const cogsStep = res.body.data.waterfall.find((w) => w.label.includes('COGS'));
    assert.ok(cogsStep);
    assert.equal(cogsStep.value, 0);
    assert.ok(cogsStep.note.includes('UNAVAILABLE'));
  });

  await suite.test('32.29 Finance: Owner café scope enforcement', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async () => [];

    const req = {
      query: {},
      auth: {
        userId: 'OW-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getFinanceAnalytics, req);
    const cafeScope = capturedMatch.cafeId;
    assert.ok(cafeScope === 'ZC-0001' || (cafeScope?.$in && cafeScope.$in.includes('ZC-0001')));
  });

  await suite.test('32.30 Finance: Primary Master organisation aggregation', async () => {
    let capturedBill = null;
    let capturedExp = null;
    Bill.aggregate = async (pipeline) => {
      capturedBill = pipeline[0].$match;
      return [];
    };
    PayrollRun.aggregate = async () => [];
    Expense.aggregate = async (pipeline) => {
      capturedExp = pipeline[0].$match;
      return [];
    };

    const req = {
      query: {},
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getFinanceAnalytics, req);
    assert.equal(capturedBill.organisationId, 'ORG-ZAMORIN');
    assert.equal(capturedBill.cafeId, undefined);
    assert.equal(capturedExp.organisationId, 'ORG-ZAMORIN');
    assert.equal(capturedExp.cafeId, undefined);
  });

  // ─── SECTION 33: SECURITY & AUTHORIZATION ───────────────────────────────────

  await suite.test('33.31 Security: Cross-organisation report request isolated by auth', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };

    const req = {
      query: { organisationId: 'ORG-ATTACKER' }, // Tampered query param
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-LEGITIMATE',
      },
    };

    await invokeHandler(reportController.getSalesAnalytics, req);
    assert.equal(capturedMatch.organisationId, 'ORG-LEGITIMATE', 'Must ignore query and use auth orgId');
  });

  await suite.test('33.32 Security: Owner attempts unassigned café is denied with 403', async () => {
    const req = {
      query: { cafeId: 'ZC-UNASSIGNED' },
      auth: {
        userId: 'OW-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await assert.rejects(
      async () => {
        await invokeHandler(reportController.getSalesAnalytics, req);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );
  });

  await suite.test('33.33 Security: Staff attempts restricted report endpoint returns 403', async () => {
    const req = {
      query: {},
      auth: {
        userId: 'ST-01',
        role: 'STAFF',
        assignedCafeIds: ['ZC-0001'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await assert.rejects(
      async () => {
        await invokeHandler(reportController.getFinanceAnalytics, req);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'ROLE_NOT_ALLOWED');
        return true;
      }
    );
  });

  await suite.test('33.34 Security: CAFE_ADMIN is scoped to assigned cafe', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };

    const req = {
      query: {},
      auth: {
        userId: 'CA-01',
        role: 'CAFE_ADMIN',
        assignedCafeIds: ['ZC-0001'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await invokeHandler(reportController.getSalesAnalytics, req);
    const cafeScope = capturedMatch.cafeId;
    assert.ok(cafeScope === 'ZC-0001' || (cafeScope?.$in && cafeScope.$in.includes('ZC-0001')));
  });

  await suite.test('33.35 Security: Query tampering with organisation ID has no effect', async () => {
    let capturedMatch = null;
    Bill.aggregate = async (pipeline) => {
      capturedMatch = pipeline[0].$match;
      return [];
    };

    const req = {
      query: { organisationId: 'ORG-HACKED' },
      auth: {
        userId: 'PM-01',
        role: 'MASTER',
        isPrimaryMaster: true,
        organisationId: 'ORG-REAL',
      },
    };

    await invokeHandler(reportController.getAnalyticsOverview, req);
    assert.equal(capturedMatch.organisationId, 'ORG-REAL');
  });

  await suite.test('33.36 Security: Query tampering with café ID by Owner is blocked', async () => {
    const req = {
      query: { cafeId: 'ZC-MALICIOUS' },
      auth: {
        userId: 'OW-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
        organisationId: 'ORG-ZAMORIN',
      },
    };

    await assert.rejects(
      async () => {
        await invokeHandler(reportController.getFinanceAnalytics, req);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );
  });
});
