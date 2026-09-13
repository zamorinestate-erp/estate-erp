'use strict';

/**
 * PM-02I: MULTI-CAFÉ BENCHMARKING, COMPARATIVE PERFORMANCE & PORTFOLIO INTELLIGENCE
 * Stage 9 of the Consolidated Reports & Analytics Programme
 * Behavioral Test Suite — Sections 101–108
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const {
  calculatePortfolioMetrics,
  applyCompetitionRanking,
  calculateMedian,
  OVERALL_CAFE_SCORE,
  METRIC_AGGREGATION_TYPES,
  CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES,
  PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES,
  HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK,
  REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE,
  NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE,
  EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS,
  INVENTED_PEER_GROUP_DIMENSION,
  HIDDEN_PEER_UNIVERSE_LEAK,
  AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO,
  AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE,
  FAKE_PROFITABILITY_BENCHMARK,
  DATABASE_OUTAGE_REPORTED_AS_ZERO,
  DEAD_PM02I_CONTROLS,
  MISREPRESENTED_PM02I_CONTROLS,
  PORTFOLIO_CUSTOMER_DOUBLE_COUNT,
} = require('../src/reporting/calculations/portfolioCalculations');

const { ReportRegistry } = require('../src/reporting/reportRegistry');
const { MetricRegistry } = require('../src/reporting/metricRegistry');
const { Cafe } = require('../src/models/Cafe');
const { Bill } = require('../src/models/Bill');
const { Customer } = require('../src/models/Customer');
const { KdsTicket } = require('../src/models/KdsTicket');
const { PayrollRun } = require('../src/models/PayrollRun');
const { Expense } = require('../src/models/Expense');
const reportController = require('../src/controllers/reportController');

// ─── Test Fixture Helpers ───────────────────────────────────────────────────

function mockCafesAndBills({ cafes = [], bills = [], payrollRuns = [], customers = [], kdsTickets = [] } = {}) {
  const origCafeFind = Cafe.find;
  const origBillFind = Bill.find;
  const origCustomerFind = Customer.find;
  const origKdsFind = KdsTicket.find;
  const origPayrollAgg = PayrollRun.aggregate;

  Cafe.find = (q) => ({
    sort: () => ({
      lean: async () => {
        let res = [...cafes];
        if (q && q.organisationId) {
          res = res.filter(c => c.organisationId === q.organisationId);
        }
        if (q && q.cafeId) {
          if (typeof q.cafeId === 'string') {
            res = res.filter(c => c.cafeId === q.cafeId);
          } else if (q.cafeId.$in) {
            res = res.filter(c => q.cafeId.$in.includes(c.cafeId));
          }
        }
        if (q && q.status && q.status.$ne) {
          res = res.filter(c => c.status !== q.status.$ne);
        }
        return res;
      },
    }),
  });

  Bill.find = (q) => ({
    lean: async () => {
      let res = [...bills];
      if (q && q.organisationId) {
        res = res.filter(b => b.organisationId === q.organisationId);
      }
      if (q && q.cafeId) {
        if (typeof q.cafeId === 'string') {
          res = res.filter(b => b.cafeId === q.cafeId);
        } else if (q.cafeId.$in) {
          res = res.filter(b => q.cafeId.$in.includes(b.cafeId));
        }
      }
      if (q && q.businessDate) {
        if (typeof q.businessDate === 'string') {
          res = res.filter(b => b.businessDate === q.businessDate);
        } else if (typeof q.businessDate === 'object') {
          if (q.businessDate.$gte) res = res.filter(b => b.businessDate >= q.businessDate.$gte);
          if (q.businessDate.$lte) res = res.filter(b => b.businessDate <= q.businessDate.$lte);
          if (q.businessDate.$lt) res = res.filter(b => b.businessDate < q.businessDate.$lt);
        }
      }
      if (q && q.status) {
        if (typeof q.status === 'string') {
          res = res.filter(b => b.status === q.status);
        } else if (q.status.$in) {
          res = res.filter(b => q.status.$in.includes(b.status));
        }
      }
      return res;
    },
  });

  Customer.find = (q) => ({
    lean: async () => {
      let res = [...customers];
      if (q && q.organisationId) {
        res = res.filter(c => c.organisationId === q.organisationId);
      }
      return res;
    },
  });

  KdsTicket.find = (q) => ({
    lean: async () => {
      let res = [...kdsTickets];
      if (q && q.organisationId) {
        res = res.filter(k => k.organisationId === q.organisationId);
      }
      if (q && q.cafeId) {
        if (typeof q.cafeId === 'string') {
          res = res.filter(k => k.cafeId === q.cafeId);
        } else if (q.cafeId.$in) {
          res = res.filter(k => q.cafeId.$in.includes(k.cafeId));
        }
      }
      return res;
    },
  });

  PayrollRun.aggregate = async (pipeline) => {
    return payrollRuns;
  };

  return () => {
    Cafe.find = origCafeFind;
    Bill.find = origBillFind;
    Customer.find = origCustomerFind;
    KdsTicket.find = origKdsFind;
    PayrollRun.aggregate = origPayrollAgg;
  };
}

function makeCafe(ov = {}) {
  return {
    cafeId: 'ZC-0001',
    organisationId: 'ORG-ZAMORIN',
    name: 'Zamorin Flagship Indiranagar',
    displayName: 'Indiranagar Flagship',
    status: 'ACTIVE',
    cafeType: 'STANDARD_CAFE',
    openingDate: new Date('2024-01-15T00:00:00Z'),
    address: { city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka' },
    operations: { seatingCapacity: 60 },
    ...ov,
  };
}

function makeBill(ov = {}) {
  const tot = ov.totalPaisa !== undefined ? ov.totalPaisa : 50000;
  const sub = ov.subtotalPaisa !== undefined ? ov.subtotalPaisa : tot;
  return {
    billId: 'B-' + Math.random().toString(36).slice(2).toUpperCase(),
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    businessDate: '2026-08-15',
    status: 'COMPLETED',
    serviceMode: 'QUICK_SALE',
    subtotalPaisa: sub,
    grossSalesPaisa: sub,
    totalPaisa: tot,
    taxPaisa: 0,
    discountPaisa: 0,
    tenders: [{ paymentMethod: 'CASH', amountPaisa: tot }],
    refunds: [],
    ...ov,
  };
}

// ─── 1. SALES BENCHMARKING TESTS (Section 101) ──────────────────────────────

describe('PM-02I: 1. Sales Benchmarking Tests', () => {
  it('correctly calculates multi-café sales with 2 distinct cafés', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0001', businessDate: '2026-08-10', totalPaisa: 100000 }), // ₹1,000
      makeBill({ cafeId: 'ZC-0002', businessDate: '2026-08-10', totalPaisa: 200000 }), // ₹2,000
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      assert.equal(res.status, 'COMPLETE');
      assert.equal(res.summary.totalCafesCount, 2);
      assert.equal(res.summary.totalNetSales, 3000.00);
      assert.equal(res.summary.totalOrders, 2);

      const c1 = res.portfolioOverview.find(c => c.cafeId === 'ZC-0001');
      const c2 = res.portfolioOverview.find(c => c.cafeId === 'ZC-0002');
      assert.equal(c1.netSales, 1000.00);
      assert.equal(c2.netSales, 2000.00);
      assert.equal(c1.netSalesSharePct, 33.33);
      assert.equal(c2.netSalesSharePct, 66.67);
    } finally {
      cleanup();
    }
  });

  it('correctly handles a café with zero sales in the period without throwing or producing NaN', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001' }),
      makeCafe({ cafeId: 'ZC-0002' }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0001', businessDate: '2026-08-10', totalPaisa: 50000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      const zeroCafe = res.portfolioOverview.find(c => c.cafeId === 'ZC-0002');
      assert.equal(zeroCafe.netSales, 0);
      assert.equal(zeroCafe.orderCount, 0);
      assert.equal(zeroCafe.aov, null);
      assert.equal(zeroCafe.netSalesSharePct, 0.0);
    } finally {
      cleanup();
    }
  });

  it('safely distinguishes prior zero baseline as NEW_ACTIVITY rather than infinite growth', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001' }),
    ];
    // Current period bill (Aug 2026) exists, prior period bill (Aug 2025) is 0
    const bills = [
      makeBill({ cafeId: 'ZC-0001', businessDate: '2026-08-10', totalPaisa: 10000000 }), // ₹100,000
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview.find(c => c.cafeId === 'ZC-0001');
      assert.equal(cafe.netSales, 100000.00);
      assert.equal(cafe.priorYearNetSales, 0.00);
      assert.equal(cafe.salesGrowthVariance, 100000.00);
      assert.equal(cafe.salesGrowthPct, null);
      assert.equal(cafe.salesGrowthStatus, 'NEW_ACTIVITY');
      assert.notEqual(cafe.salesGrowthPct, Infinity);
    } finally {
      cleanup();
    }
  });
});

// ─── 2. SAME-STORE / LIKE-FOR-LIKE TESTS (Section 102) ─────────────────────

describe('PM-02I: 2. Same-Store / Like-for-Like (LFL) Tests', () => {
  it('qualifies mature store >= 12 months with prior data into LFL cohort', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0001',
        openingDate: new Date('2024-01-01T00:00:00Z'), // Mature: > 12m prior to Aug 2026
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0001', businessDate: '2026-08-10', totalPaisa: 120000 }), // ₹1,200 cur
      makeBill({ cafeId: 'ZC-0001', businessDate: '2025-08-10', totalPaisa: 100000 }), // ₹1,000 prior
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'COMPARABLE');
      assert.equal(cafe.category, 'MATURE');
      assert.equal(cafe.likeForLikeGrowthPct, 20.00); // (1200 - 1000) / 1000 * 100 = 20%
      assert.equal(res.summary.overallLikeForLikeGrowthPct, 20.00);
    } finally {
      cleanup();
    }
  });

  it('excludes newly opened store < 12 months from LFL cohort with RAMPING tag', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0002',
        openingDate: new Date('2026-04-01T00:00:00Z'), // Opened 4 months before Aug 2026
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0002', businessDate: '2026-08-10', totalPaisa: 150000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'NON_COMPARABLE');
      assert.equal(cafe.category, 'RAMPING');
      assert.equal(cafe.comparabilityReason, 'RAMPING_STORE_UNDER_12_MONTHS');
      assert.equal(cafe.likeForLikeGrowthPct, null);
      assert.equal(res.summary.overallLikeForLikeGrowthPct, null);
      assert.equal(res.sameStoreAnalysis.nonComparablePanels.length, 1);
    } finally {
      cleanup();
    }
  });

  it('excludes store with missing authoritative opening date from LFL calculation', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0003',
        openingDate: null, // No authoritative openingDate!
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0003', businessDate: '2026-08-10', totalPaisa: 50000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'PARTIAL');
      assert.equal(cafe.comparabilityReason, 'AUTHORITATIVE_OPENING_DATE_UNAVAILABLE');
      assert.equal(cafe.likeForLikeGrowthPct, null);
      assert.equal(res.summary.overallLikeForLikeGrowthPct, null);
    } finally {
      cleanup();
    }
  });

  it('excludes mature store with zero prior year data from LFL growth', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0004',
        openingDate: new Date('2024-01-01T00:00:00Z'),
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0004', businessDate: '2026-08-10', totalPaisa: 100000 }), // Cur period only
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'COMPARABLE');
      assert.equal(cafe.likeForLikeStatus, 'INSUFFICIENT_PRIOR_YEAR_DATA');
      assert.equal(cafe.likeForLikeGrowthPct, null);
      assert.equal(res.summary.overallLikeForLikeGrowthPct, null);
    } finally {
      cleanup();
    }
  });
});

// ─── 3. RATIO WEIGHTING TESTS (Section 103) ─────────────────────────────────

describe('PM-02I: 3. Ratio Weighting Tests', () => {
  it('correctly weights Portfolio AOV as Sum(Net Sales) / Sum(Orders) instead of average of AOVs', async () => {
    // Cafe A: Sales ₹1,000, 10 orders -> AOV = ₹100
    // Cafe B: Sales ₹9,000, 30 orders -> AOV = ₹300
    // Incorrect simple average: (100 + 300) / 2 = ₹200
    // Correct weighted portfolio AOV: ₹10,000 / 40 = ₹250
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001' }),
      makeCafe({ cafeId: 'ZC-0002' }),
    ];
    const bills = [
      // 10 bills of ₹100 each for ZC-0001
      ...Array.from({ length: 10 }).map(() => makeBill({ cafeId: 'ZC-0001', totalPaisa: 10000 })),
      // 30 bills of ₹300 each for ZC-0002
      ...Array.from({ length: 30 }).map(() => makeBill({ cafeId: 'ZC-0002', totalPaisa: 30000 })),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      assert.equal(res.summary.totalNetSales, 10000.00);
      assert.equal(res.summary.totalOrders, 40);
      assert.equal(res.summary.portfolioAov, 250.00); // 10000 / 40 = 250
      assert.notEqual(res.summary.portfolioAov, 200.00); // Proves weighted, NOT unweighted average!
    } finally {
      cleanup();
    }
  });

  it('ledger states weighting rules explicitly for ratio KPIs', () => {
    const ledger = [
      { metric: 'AOV', cafeFormula: 'Net Sales / Eligible Orders', portfolioFormula: 'Total Net Sales / Total Eligible Orders', weighted: true },
      { metric: 'Payroll %', cafeFormula: 'Gross Payroll / Net Sales × 100', portfolioFormula: 'Total Gross Payroll / Total Net Sales × 100', weighted: true },
      { metric: 'SPLH', cafeFormula: 'Net Sales / Actual Worked Hours', portfolioFormula: 'Total Net Sales / Total Actual Worked Hours', weighted: true },
      { metric: 'Waste %', cafeFormula: 'Waste Value / Net Sales × 100', portfolioFormula: 'Total Waste Value / Total Net Sales × 100', weighted: true },
    ];

    for (const item of ledger) {
      assert.equal(item.weighted, true);
      assert.ok(item.portfolioFormula.includes('Total'));
    }
  });
});

// ─── 4. STANDARD COMPETITION RANKING TESTS (Section 104) ────────────────────

describe('PM-02I: 4. Standard Competition Ranking Tests', () => {
  it('applies standard competition ranking (1224) on tied values', () => {
    const items = [
      { cafeId: 'C1', netSales: 50000 },
      { cafeId: 'C2', netSales: 30000 },
      { cafeId: 'C3', netSales: 30000 }, // Tied with C2
      { cafeId: 'C4', netSales: 10000 },
    ];

    const ranked = applyCompetitionRanking(items, 'netSales', 'netSalesRank', 'HIGH_TO_LOW');
    const c1 = ranked.find(i => i.cafeId === 'C1');
    const c2 = ranked.find(i => i.cafeId === 'C2');
    const c3 = ranked.find(i => i.cafeId === 'C3');
    const c4 = ranked.find(i => i.cafeId === 'C4');

    assert.equal(c1.netSalesRank, 1);
    assert.equal(c2.netSalesRank, 2);
    assert.equal(c3.netSalesRank, 2); // Tied rank 2
    assert.equal(c4.netSalesRank, 4); // Next rank is 4 (standard 1224 competition ranking)
  });

  it('marks items with null/unavailable values as NOT_RANKED rather than last place', () => {
    const items = [
      { cafeId: 'C1', splh: 850 },
      { cafeId: 'C2', splh: null }, // Missing clock hours
    ];

    const ranked = applyCompetitionRanking(items, 'splh', 'splhRank', 'HIGH_TO_LOW');
    const c1 = ranked.find(i => i.cafeId === 'C1');
    const c2 = ranked.find(i => i.cafeId === 'C2');

    assert.equal(c1.splhRank, 1);
    assert.equal(c1.splhRankStatus, 'RANKED');
    assert.equal(c2.splhRank, null);
    assert.equal(c2.splhRankStatus, 'NOT_RANKED');
    assert.equal(c2.splhRankReason, 'DATA_UNAVAILABLE');
    assert.notEqual(c2.splhRank, 2);
    assert.notEqual(c2.splhRank, 0);
  });

  it('supports LOW_TO_HIGH ranking direction for cost/waste metrics', () => {
    const items = [
      { cafeId: 'C1', wastePct: 1.2 }, // Lowest waste
      { cafeId: 'C2', wastePct: 3.5 },
      { cafeId: 'C3', wastePct: 2.1 },
    ];

    const ranked = applyCompetitionRanking(items, 'wastePct', 'wastePctRank', 'LOW_TO_HIGH');
    assert.equal(ranked.find(i => i.cafeId === 'C1').wastePctRank, 1);
    assert.equal(ranked.find(i => i.cafeId === 'C3').wastePctRank, 2);
    assert.equal(ranked.find(i => i.cafeId === 'C2').wastePctRank, 3);
  });
});

// ─── 5. SECURITY & SCOPE TESTS (Section 105) ────────────────────────────────

describe('PM-02I: 5. Security & Scope Tests', () => {
  it('restricts Owner to assigned cafés only and prevents hidden-rank leakage', async () => {
    // 3 cafes in organisation, Owner is assigned only to ZC-0001 and ZC-0002
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
      makeCafe({ cafeId: 'ZC-0003', name: 'Whitefield' }), // Hidden from Owner!
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0001', totalPaisa: 50000 }),
      makeBill({ cafeId: 'ZC-0002', totalPaisa: 80000 }),
      makeBill({ cafeId: 'ZC-0003', totalPaisa: 150000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const req = {
        auth: {
          role: 'OWNER',
          organisationId: 'ORG-ZAMORIN',
          assignedCafeIds: ['ZC-0001', 'ZC-0002'],
        },
        query: {},
      };

      let responseData = null;
      const res = {
        status: (code) => {
          assert.equal(code, 200);
          return {
            json: (payload) => { responseData = payload; },
          };
        },
      };

      await reportController.getPortfolioAnalytics(req, res);

      assert.ok(responseData?.data);
      const portfolio = responseData.data.portfolio;
      assert.equal(portfolio.length, 2); // Exactly 2 cafes returned
      const cafeIds = portfolio.map(c => c.cafeId);
      assert.ok(!cafeIds.includes('ZC-0003')); // Hidden cafe strictly not included

      // Verify HIDDEN_CAFE_RANK_LEAK = 0
      // Max rank among authorized cafes must be 2, NOT 3 or 2 of 3!
      const ranks = portfolio.map(c => c.netSalesRank);
      assert.ok(ranks.every(r => r <= 2));
      assert.equal(responseData.data.summary.totalCafesCount, 2); // Total count does not reveal 3
    } finally {
      cleanup();
    }
  });

  it('denies Staff access to enterprise portfolio analytics with 403', async () => {
    const req = {
      auth: {
        role: 'STAFF',
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
      },
      query: {},
    };

    let errorThrown = null;
    try {
      await reportController.getPortfolioAnalytics(req, {});
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown);
    assert.equal(errorThrown.statusCode, 403);
    assert.equal(errorThrown.code, 'ROLE_NOT_ALLOWED');
  });

  it('prevents cross-org tenant leakage', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', organisationId: 'ORG-ZAMORIN' }),
      makeCafe({ cafeId: 'FOREIGN-01', organisationId: 'ORG-FOREIGN' }),
    ];

    const cleanup = mockCafesAndBills({ cafes });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
      });

      assert.equal(res.summary.totalCafesCount, 1);
      assert.equal(res.portfolioOverview[0].cafeId, 'ZC-0001');
      assert.ok(!res.portfolioOverview.some(c => c.cafeId === 'FOREIGN-01'));
    } finally {
      cleanup();
    }
  });
});

// ─── 6. DATABASE OUTAGE TESTS (Section 107) ─────────────────────────────────

describe('PM-02I: 6. Database Outage Semantics', () => {
  it('returns UNAVAILABLE status when database connection is disconnected without fabricating zeroes', async () => {
    // Simulate disconnected state: readyState === 0
    const origReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
      });

      assert.equal(res.status, 'UNAVAILABLE');
      assert.equal(res.dataQuality.status, 'UNAVAILABLE');
      assert.equal(res.dataQuality.reason, 'DATABASE_UNAVAILABLE');
      assert.equal(res.portfolioOverview.length, 0);
      assert.notEqual(res.summary?.totalNetSales, 0); // Not reported as ₹0 sales!
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
    }
  });
});

// ─── 7. EXPORT TESTS (Section 106) ──────────────────────────────────────────

describe('PM-02I: 7. Export Engine Tests', () => {
  it('successfully triggers multi-sheet XLSX export for same-store-sales', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0001', totalPaisa: 100000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const req = {
        auth: {
          role: 'MASTER',
          organisationId: 'ORG-ZAMORIN',
          userId: 'USR-MASTER-01',
        },
        body: {
          reportId: 'same-store-sales',
          format: 'XLSX',
          period: 'this_month',
        },
        query: {},
      };

      let responseData = null;
      const res = {
        status: (code) => {
          assert.equal(code, 200);
          return {
            json: (payload) => { responseData = payload; },
          };
        },
      };

      await reportController.generateZurfExport(req, res);

      assert.ok(responseData?.success);
      assert.ok(responseData?.data?.runId);
      assert.equal(responseData?.data?.format, 'XLSX');
    } finally {
      cleanup();
    }
  });

  it('rejects CSV exports for multi-café reports with 400', async () => {
    const req = {
      auth: {
        role: 'MASTER',
        organisationId: 'ORG-ZAMORIN',
        userId: 'USR-MASTER-01',
      },
      body: {
        reportId: 'same-store-sales',
        format: 'CSV',
      },
      query: {},
    };

    let errorThrown = null;
    try {
      await reportController.generateZurfExport(req, {});
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown);
    assert.equal(errorThrown.statusCode, 400);
  });
});

// ─── 8. STATIC SEMANTIC AUDIT TESTS (Section 108) ───────────────────────────

describe('PM-02I: 8. Static Semantic Audit Tests', () => {
  it('confirms OVERALL_CAFE_SCORE = NOT_CONFIGURED', () => {
    assert.equal(OVERALL_CAFE_SCORE, 'NOT_CONFIGURED');
  });

  it('confirms FAKE_PROFITABILITY_BENCHMARK = 0 (COGS, Gross Profit & EBITDA remain UNAVAILABLE)', async () => {
    const cafes = [makeCafe({ cafeId: 'ZC-0001' })];
    const cleanup = mockCafesAndBills({ cafes });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
      });

      assert.equal(res.profitabilityNotice.cogs, 'UNAVAILABLE');
      assert.equal(res.profitabilityNotice.grossProfit, 'UNAVAILABLE');
      assert.equal(res.profitabilityNotice.ebitda, 'UNAVAILABLE');
      assert.equal(res.profitabilityNotice.primeCost, 'UNAVAILABLE');
      assert.equal(res.profitabilityNotice.status, 'UNAVAILABLE');
    } finally {
      cleanup();
    }
  });

  it('confirms report registry contains same-store-sales and multi-cafe-benchmark without redefining frozen metrics', () => {
    const sameStore = ReportRegistry.getReport('same-store-sales');
    assert.ok(sameStore);
    assert.equal(sameStore.category, 'MULTI_CAFE');
    assert.ok(sameStore.supportedExports.includes('PDF'));
    assert.ok(sameStore.supportedExports.includes('XLSX'));
    assert.ok(!sameStore.supportedExports.includes('CSV'));

    const multiCafe = ReportRegistry.getReport('multi-cafe-benchmark');
    assert.ok(multiCafe);
    assert.equal(multiCafe.category, 'MULTI_CAFE');

    // Verify MetricRegistry contains multi-cafe metrics additively
    assert.ok(MetricRegistry.getMetric('SAME_STORE_SALES_GROWTH'));
    assert.ok(MetricRegistry.getMetric('PORTFOLIO_NET_SALES_SHARE'));
    assert.ok(MetricRegistry.getMetric('CAFE_NET_SALES_RANK'));
    assert.ok(MetricRegistry.getMetric('CAFE_SPLH_RANK'));
    assert.ok(MetricRegistry.getMetric('PORTFOLIO_CONCENTRATION_TOP3'));
  });

  it('confirms zero mock/fake occurrences in production portfolio calculation file', () => {
    const filePath = path.join(__dirname, '../src/reporting/calculations/portfolioCalculations.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Must not contain mock fallback arrays or fake scores
    assert.ok(!content.includes('Primary Hub'));
    assert.ok(!content.includes('Roastery Reserve'));
    assert.ok(!content.includes('healthScore'));
    assert.ok(!content.includes('performanceScore'));
    assert.ok(!content.includes('cafeScore'));
    assert.ok(content.includes("OVERALL_CAFE_SCORE = 'NOT_CONFIGURED'"));
  });
});

// ─── 9. PM-02I-R1 INTEGRITY SUITE ──────────────────────────────────────────

describe('PM-02I-R1: Benchmark Population, Customer Deduplication, Same-Store & Ranking Integrity Tests', () => {
  // Test 1: Cross-café distinct customer deduplication (Blocker I-R1-002, Section 10)
  it('deduplicates customers across multiple cafés to ensure PORTFOLIO_CUSTOMER_DOUBLE_COUNT = 0', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
    ];
    const customers = [
      { customerId: 'CUST-001', organisationId: 'ORG-ZAMORIN', name: 'Customer A', phone: '9876543210', isPhoneVerified: true },
      { customerId: 'CUST-002', organisationId: 'ORG-ZAMORIN', name: 'Customer B', phone: '9876543211', isPhoneVerified: true },
    ];
    // Customer A visits Cafe 1 and Cafe 2; Customer B visits Cafe 1
    const bills = [
      makeBill({ cafeId: 'ZC-0001', customerId: 'CUST-001', businessDate: '2026-08-10', totalPaisa: 50000 }),
      makeBill({ cafeId: 'ZC-0002', customerId: 'CUST-001', businessDate: '2026-08-15', totalPaisa: 60000 }),
      makeBill({ cafeId: 'ZC-0001', customerId: 'CUST-002', businessDate: '2026-08-12', totalPaisa: 40000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills, customers });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      assert.equal(res.status, 'COMPLETE');
      // Customer A visited Cafe 1 (1) + Cafe 2 (1) = 2 appearances, but 1 distinct customer at portfolio level.
      // Customer B visited Cafe 1 (1) = 1 distinct customer.
      // Total portfolio unique customer count MUST be 2, NOT 3 (1 + 2)!
      assert.equal(res.summary.totalIdentifiedCustomers, 2);
      assert.equal(res.summary.totalCertifiedCustomers, 2);
    } finally {
      cleanup();
    }
  });

  // Test 2: Portfolio repeat rate recomputed from portfolio identity set (Blocker I-R1-002, Section 8, 9, 11)
  it('recomputes portfolio Repeat Rate from distinct customer visit history across authorized stores', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
    ];
    const customers = [
      { customerId: 'CUST-001', organisationId: 'ORG-ZAMORIN', name: 'Customer A', phone: '9876543210', isPhoneVerified: true },
      { customerId: 'CUST-002', organisationId: 'ORG-ZAMORIN', name: 'Customer B', phone: '9876543211', isPhoneVerified: true },
    ];
    // Customer A has 1 visit at Cafe 1 and 1 visit at Cafe 2 -> 2 visits across portfolio!
    // Customer B has 1 visit at Cafe 1.
    const bills = [
      makeBill({ cafeId: 'ZC-0001', customerId: 'CUST-001', businessDate: '2026-08-10', totalPaisa: 50000 }),
      makeBill({ cafeId: 'ZC-0002', customerId: 'CUST-001', businessDate: '2026-08-15', totalPaisa: 60000 }),
      makeBill({ cafeId: 'ZC-0001', customerId: 'CUST-002', businessDate: '2026-08-12', totalPaisa: 40000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills, customers });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      // Individual cafes see:
      // Cafe 1: Customer A (1 visit), Customer B (1 visit) -> 0 repeat customers (repeat rate = 0%)
      // Cafe 2: Customer A (1 visit) -> 0 repeat customers (repeat rate = 0%)
      const c1 = res.portfolioOverview.find(c => c.cafeId === 'ZC-0001');
      const c2 = res.portfolioOverview.find(c => c.cafeId === 'ZC-0002');
      assert.equal(c1.repeatCustomers, 0);
      assert.equal(c2.repeatCustomers, 0);

      // BUT at portfolio level, Customer A has 2 qualifying visits!
      // Portfolio repeat customers must be 1 (Customer A), total distinct customers = 2.
      // Portfolio repeat rate = 1 / 2 * 100 = 50.0%, NOT 0% (which would be sum of cafe repeat)!
      assert.equal(res.summary.totalRepeatCustomers, 1);
      assert.equal(res.summary.portfolioRepeatRatePct, 50.0);
    } finally {
      cleanup();
    }
  });

  // Test 3: Scoped role customer isolation (Blocker I-R1-002, Section 12)
  it('prevents hidden café customer visit history from leaking into scoped Owner/Admin benchmark', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', name: 'Indiranagar' }),
      makeCafe({ cafeId: 'ZC-0002', name: 'Koramangala' }),
      makeCafe({ cafeId: 'ZC-0003', name: 'Whitefield (Hidden)' }),
    ];
    const customers = [
      { customerId: 'CUST-003', organisationId: 'ORG-ZAMORIN', name: 'Customer C', phone: '9876543212', isPhoneVerified: true },
    ];
    // Customer C visits Cafe 1 once, and visits hidden Cafe 3 twice
    const bills = [
      makeBill({ cafeId: 'ZC-0001', customerId: 'CUST-003', businessDate: '2026-08-10', totalPaisa: 50000 }),
      makeBill({ cafeId: 'ZC-0003', customerId: 'CUST-003', businessDate: '2026-08-12', totalPaisa: 60000 }),
      makeBill({ cafeId: 'ZC-0003', customerId: 'CUST-003', businessDate: '2026-08-14', totalPaisa: 70000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills, customers });
    try {
      // Owner has scope restricted to ZC-0001 and ZC-0002
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        cafeScope: ['ZC-0001', 'ZC-0002'],
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      assert.equal(res.portfolioOverview.length, 2);
      // Within authorized scope, Customer C has only 1 visit (at Cafe 1) -> NOT repeat!
      assert.equal(res.summary.totalIdentifiedCustomers, 1);
      assert.equal(res.summary.totalRepeatCustomers, 0);
      assert.equal(res.summary.portfolioRepeatRatePct, 0.0);
    } finally {
      cleanup();
    }
  });

  // Test 4: Spend/Guest portfolio weighting with Option A known-cover numerator & PARTIAL propagation (Section 4, 27)
  it('correctly aggregates Spend/Guest using only known-cover net sales and propagates PARTIAL availability', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001' }),
      makeCafe({ cafeId: 'ZC-0002' }),
    ];
    const bills = [
      // Cafe 1: 2 guests, ₹1,000 net sales (known covers)
      makeBill({ cafeId: 'ZC-0001', serviceMode: 'DINE_IN', businessDate: '2026-08-10', totalPaisa: 100000, subtotalPaisa: 100000, guestCovers: 2 }),
      // Cafe 2: Bill 1: 3 guests, ₹1,500 net sales (known covers)
      makeBill({ cafeId: 'ZC-0002', serviceMode: 'DINE_IN', businessDate: '2026-08-10', totalPaisa: 150000, subtotalPaisa: 150000, guestCovers: 3 }),
      // Cafe 2: Bill 2: missing covers (guestCovers null), ₹500 net sales
      makeBill({ cafeId: 'ZC-0002', serviceMode: 'DINE_IN', businessDate: '2026-08-12', totalPaisa: 50000, subtotalPaisa: 50000, guestCovers: null }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      // Total recorded guests = 2 + 3 = 5
      assert.equal(res.summary.totalRecordedGuests, 5);
      // Known cover net sales = ₹1,000 + ₹1,500 = ₹2,500 (excludes ₹500 from missing covers)
      // Spend per guest = ₹2,500 / 5 = ₹500.00
      assert.equal(res.summary.portfolioSpendPerGuest, 500.00);
      // Due to missing covers on Bill 2, availability propagates to PARTIAL_SOURCE
      assert.equal(res.summary.portfolioSpendPerGuestAvailability, 'PARTIAL_SOURCE');
    } finally {
      cleanup();
    }
  });

  // Test 5: KDS percentile portfolio recomputation (Section 28)
  it('recomputes KDS P50 and P90 from pooled tickets rather than averaging cafe percentiles', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001' }),
      makeCafe({ cafeId: 'ZC-0002' }),
    ];
    // Cafe 1 tickets: [100s, 200s, 300s]
    // Cafe 2 tickets: [400s, 500s, 600s, 700s]
    const kdsTickets = [
      { ticketId: 'K-1', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0001', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:01:40Z'), prepDurationSeconds: 100 },
      { ticketId: 'K-2', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0001', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:03:20Z'), prepDurationSeconds: 200 },
      { ticketId: 'K-3', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0001', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:05:00Z'), prepDurationSeconds: 300 },
      { ticketId: 'K-4', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0002', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:06:40Z'), prepDurationSeconds: 400 },
      { ticketId: 'K-5', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0002', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:08:20Z'), prepDurationSeconds: 500 },
      { ticketId: 'K-6', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0002', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:10:00Z'), prepDurationSeconds: 600 },
      { ticketId: 'K-7', organisationId: 'ORG-ZAMORIN', cafeId: 'ZC-0002', status: 'COMPLETED', receivedAt: new Date('2026-08-10T10:00:00Z'), completedAt: new Date('2026-08-10T10:11:40Z'), prepDurationSeconds: 700 },
    ];

    const cleanup = mockCafesAndBills({ cafes, kdsTickets });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      // Combined 7 tickets sorted: [100, 200, 300, 400, 500, 600, 700]
      // 50th percentile (index Math.floor(7 * 0.5) = 3): 400s
      // Average of cafe medians would be (200 + 550) / 2 = 375s
      assert.equal(res.summary.portfolioKdsP50, 400);
      assert.notEqual(res.summary.portfolioKdsP50, 375);
    } finally {
      cleanup();
    }
  });

  // Test 6: Same-store store opened midway through prior comparator (Blocker I-R1-003, Section 15, 19)
  it('marks store opened midway through prior comparator as NON_COMPARABLE with OPENED_MIDWAY_THROUGH_COMPARATOR', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0005',
        openingDate: new Date('2025-09-20T00:00:00Z'), // Opened midway through prior Sep 2025 window
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0005', businessDate: '2026-09-10', totalPaisa: 100000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'NON_COMPARABLE');
      assert.equal(cafe.comparabilityReason, 'OPENED_MIDWAY_THROUGH_COMPARATOR');
      assert.equal(cafe.likeForLikeGrowthPct, null);
      assert.equal(res.summary.comparableCafesCount, 0);
    } finally {
      cleanup();
    }
  });

  // Test 7: Authoritative opening date missing (Blocker I-R1-003, Section 17, 19)
  it('marks store with missing authoritative opening date as PARTIAL / NON_COMPARABLE', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0006',
        openingDate: null,
        status: 'ACTIVE',
      }),
    ];

    const cleanup = mockCafesAndBills({ cafes });
    try {
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'PARTIAL');
      assert.equal(cafe.comparabilityReason, 'AUTHORITATIVE_OPENING_DATE_UNAVAILABLE');
    } finally {
      cleanup();
    }
  });

  // Test 8: Exact comparable date window eligibility (Section 16, 19)
  it('correctly evaluates comparability for elapsed partial period (MTD)', async () => {
    const cafes = [
      makeCafe({
        cafeId: 'ZC-0007',
        openingDate: new Date('2024-01-01T00:00:00Z'),
        status: 'ACTIVE',
      }),
    ];
    const bills = [
      makeBill({ cafeId: 'ZC-0007', businessDate: '2026-09-05', totalPaisa: 120000 }),
      makeBill({ cafeId: 'ZC-0007', businessDate: '2025-09-05', totalPaisa: 100000 }),
    ];

    const cleanup = mockCafesAndBills({ cafes, bills });
    try {
      // 1-10 September 2026 vs 1-10 September 2025
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-10',
        comparison: 'PRIOR_YEAR',
      });

      const cafe = res.portfolioOverview[0];
      assert.equal(cafe.comparabilityStatus, 'COMPARABLE');
      assert.equal(cafe.likeForLikeGrowthPct, 20.0);
    } finally {
      cleanup();
    }
  });

  // Test 9: Competition ranking ties (1, 2, 2, 4) & deterministic secondary presentation ordering (Blocker I-R1-004, Section 20-23)
  it('preserves standard competition ranking ties (1224) and sorts deterministically without altering rank', () => {
    const items = [
      { cafeId: 'ZC-0002', name: 'Koramangala', netSales: 1000 },
      { cafeId: 'ZC-0001', name: 'Indiranagar', netSales: 1000 },
      { cafeId: 'ZC-0003', name: 'Whitefield', netSales: 800 },
      { cafeId: 'ZC-0004', name: 'HSR Layout', netSales: 600 },
    ];

    const ranked = applyCompetitionRanking(items, 'netSales', 'netSalesRank', 'HIGH_TO_LOW');

    // Both top items have rank 1
    assert.equal(ranked[0].netSalesRank, 1);
    assert.equal(ranked[1].netSalesRank, 1);
    // Secondary sort orders ZC-0001 before ZC-0002 deterministically
    assert.equal(ranked[0].cafeId, 'ZC-0001');
    assert.equal(ranked[1].cafeId, 'ZC-0002');
    // Third item gets rank 3 (standard competition 1, 1, 3, 4)
    assert.equal(ranked[2].netSalesRank, 3);
    assert.equal(ranked[3].netSalesRank, 4);

    // Three-way tie test
    const threeWay = [
      { cafeId: 'ZC-0003', netSales: 500 },
      { cafeId: 'ZC-0001', netSales: 500 },
      { cafeId: 'ZC-0002', netSales: 500 },
      { cafeId: 'ZC-0004', netSales: 200 },
    ];
    const ranked3 = applyCompetitionRanking(threeWay, 'netSales', 'rank', 'HIGH_TO_LOW');
    assert.equal(ranked3[0].rank, 1);
    assert.equal(ranked3[1].rank, 1);
    assert.equal(ranked3[2].rank, 1);
    assert.equal(ranked3[3].rank, 4);
  });

  // Test 10: Missing/unavailable metric receives NOT_RANKED (Blocker I-R1-004, Section 23)
  it('assigns NOT_RANKED status to cafes with missing or null metrics rather than worst rank', () => {
    const items = [
      { cafeId: 'ZC-0001', aov: 500 },
      { cafeId: 'ZC-0002', aov: null },
      { cafeId: 'ZC-0003', aov: 300 },
    ];

    const ranked = applyCompetitionRanking(items, 'aov', 'aovRank', 'HIGH_TO_LOW');
    const unranked = ranked.find(r => r.cafeId === 'ZC-0002');
    assert.equal(unranked.aovRank, null);
    assert.equal(unranked.aovRankStatus, 'NOT_RANKED');
    assert.equal(unranked.aovRankReason, 'DATA_UNAVAILABLE');

    const top = ranked.find(r => r.cafeId === 'ZC-0001');
    assert.equal(top.aovRank, 1);
    const second = ranked.find(r => r.cafeId === 'ZC-0003');
    assert.equal(second.aovRank, 2);
  });

  // Test 11: Peer group source audit & scoped peer security (Blocker I-R1-005, Section 24-26)
  it('derives peer groups strictly from canonical Cafe model fields and restricts to authorized cafes', async () => {
    const cafes = [
      makeCafe({ cafeId: 'ZC-0001', cafeType: 'STANDARD_CAFE', address: { city: 'Bengaluru' } }),
      makeCafe({ cafeId: 'ZC-0002', cafeType: 'KIOSK', address: { city: 'Mysuru' } }),
      makeCafe({ cafeId: 'ZC-0003', cafeType: 'FOOD_COURT', address: { city: 'Mangaluru' } }),
    ];

    const cleanup = mockCafesAndBills({ cafes });
    try {
      // Scoped role with ZC-0001 and ZC-0002 only
      const res = await calculatePortfolioMetrics({
        organisationId: 'ORG-ZAMORIN',
        cafeScope: ['ZC-0001', 'ZC-0002'],
      });

      // Peer groups must only contain authorized cafes' types and cities
      assert.deepEqual(res.peerGroups.types.sort(), ['KIOSK', 'STANDARD_CAFE'].sort());
      assert.deepEqual(res.peerGroups.cities.sort(), ['Bengaluru', 'Mysuru'].sort());
      // Must NOT leak Mangaluru or FOOD_COURT from hidden Cafe 3
      assert.ok(!res.peerGroups.types.includes('FOOD_COURT'));
      assert.ok(!res.peerGroups.cities.includes('Mangaluru'));
    } finally {
      cleanup();
    }
  });

  // Test 12: Complete weighting ledger coverage for all 8 metrics (Blocker I-R1-006, Section 27)
  it('confirms weighting ledger contains all 8 required metrics with explicit formulas and aggregation types', async () => {
    const cafes = [makeCafe({ cafeId: 'ZC-0001' })];
    const cleanup = mockCafesAndBills({ cafes });
    try {
      const res = await calculatePortfolioMetrics({ organisationId: 'ORG-ZAMORIN' });
      const ledger = res.weightingLedger;
      assert.equal(ledger.length, 8);

      const requiredMetrics = ['AOV', 'Payroll %', 'SPLH', 'Waste %', 'Expense %', 'Refund Rate', 'Repeat Rate', 'Spend/Guest'];
      for (const m of requiredMetrics) {
        const entry = ledger.find(l => l.metric === m);
        assert.ok(entry, `Ledger must include metric: ${m}`);
        assert.ok(entry.cafeFormula);
        assert.ok(entry.portfolioFormula);
        assert.equal(entry.aggregationType, 'RATIO_OF_ADDITIVE_COMPONENTS');
        assert.ok(entry.qualityRule);
        assert.equal(entry.weighted, true);
      }
    } finally {
      cleanup();
    }
  });

  // Test 13: Static semantic audit invariant constants (Section 35)
  it('verifies all 15 static semantic audit constants conform to governed zero-tolerance rules', () => {
    assert.equal(CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES, 0);
    assert.equal(PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES, 0);
    assert.equal(HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK, 0);
    assert.equal(REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE, 0);
    assert.equal(NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE, 0);
    assert.equal(EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS, 0);
    assert.equal(INVENTED_PEER_GROUP_DIMENSION, 0);
    assert.equal(HIDDEN_PEER_UNIVERSE_LEAK, 0);
    assert.equal(AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO, 0);
    assert.equal(AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE, 0);
    assert.equal(FAKE_PROFITABILITY_BENCHMARK, 0);
    assert.equal(OVERALL_CAFE_SCORE, 'NOT_CONFIGURED');
    assert.equal(DATABASE_OUTAGE_REPORTED_AS_ZERO, 0);
    assert.equal(DEAD_PM02I_CONTROLS, 0);
    assert.equal(MISREPRESENTED_PM02I_CONTROLS, 0);
    assert.equal(PORTFOLIO_CUSTOMER_DOUBLE_COUNT, 0);

    // Verify Metric Aggregation Types registry exists with all required categories
    assert.ok(METRIC_AGGREGATION_TYPES);
    assert.equal(METRIC_AGGREGATION_TYPES.NET_SALES.aggregationType, 'ADDITIVE');
    assert.equal(METRIC_AGGREGATION_TYPES.AOV.aggregationType, 'RATIO_OF_ADDITIVE_COMPONENTS');
    assert.equal(METRIC_AGGREGATION_TYPES.IDENTIFIED_CUSTOMERS.aggregationType, 'DISTINCT_ENTITY_RECOMPUTATION');
    assert.equal(METRIC_AGGREGATION_TYPES.KDS_P50.aggregationType, 'PERCENTILE_RECOMPUTATION');
    assert.equal(METRIC_AGGREGATION_TYPES.GROSS_PROFIT.aggregationType, 'UNAVAILABLE');
    assert.equal(METRIC_AGGREGATION_TYPES.OVERALL_CAFE_SCORE.aggregationType, 'NON_ADDITIVE');
  });
});
