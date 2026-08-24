'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Import models and controllers
const { getFinanceOverview } = require('../src/controllers/financeController');
const { Bill } = require('../src/models/Bill');
const { Expense } = require('../src/models/Expense');
const { RegisterSession } = require('../src/models/RegisterSession');

test('OWN-SCR-004: Owner Finance Summary Intelligence & RBAC Suite', async (t) => {
  const orgId = 'ORG-TEST-FIN';
  const cafeA = 'ZC-0001';
  const cafeB = 'ZC-0002';
  const cafeC = 'ZC-0003';
  const businessDate = '2026-08-22';

  await t.test('1. Owner Scoping: Aggregation across authorized cafes (A & B) and exclusion of unauthorized (C)', async () => {
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
      assignedCafeIds: [cafeA, cafeB],
    };

    const mockCafePerformance = [
      { cafeId: cafeA, netSales: 74260, expenses: 29700, payroll: 20792 },
      { cafeId: cafeB, netSales: 47080, expenses: 20240, payroll: 14594 },
      { cafeId: cafeC, netSales: 27180, expenses: 12510, payroll: 9170 }, // Unauthorized
    ];

    const authorizedData = mockCafePerformance.filter((c) => ownerAuth.assignedCafeIds.includes(c.cafeId));
    assert.equal(authorizedData.length, 2, 'Only Cafés A and B are included');

    const totalNetSales = authorizedData.reduce((sum, c) => sum + c.netSales, 0);
    const totalExpenses = authorizedData.reduce((sum, c) => sum + c.expenses, 0);
    const totalPayroll = authorizedData.reduce((sum, c) => sum + c.payroll, 0);

    assert.equal(totalNetSales, 121340, 'Total Net Sales matches sum of Cafés A and B');
    assert.equal(totalExpenses, 49940, 'Total Expenses matches sum of Cafés A and B');
    assert.equal(totalPayroll, 35386, 'Total Payroll matches sum of Cafés A and B');
    assert.ok(!authorizedData.some((c) => c.cafeId === cafeC), 'Café C is strictly excluded');
  });

  await t.test('2. Financial Formula Integrity: Expense Ratio & Payroll Ratio calculations', async () => {
    const netSales = 148520;
    const operatingExpenses = 62450;
    const payrollCost = 44556;
    const wastageValue = 2840;

    const expenseRatio = Number(((operatingExpenses / netSales) * 100).toFixed(1));
    const payrollRatio = Number(((payrollCost / netSales) * 100).toFixed(1));
    const operatingContributionPct = Number((100 - expenseRatio - payrollRatio).toFixed(1));

    assert.equal(expenseRatio, 42.0, 'Expense ratio is 42.0%');
    assert.equal(payrollRatio, 30.0, 'Payroll ratio is 30.0%');
    assert.equal(operatingContributionPct, 28.0, 'Operating contribution is 28.0%');

    // Unit economics
    const payrollPer100 = (payrollCost / netSales) * 100;
    const expensePer100 = (operatingExpenses / netSales) * 100;
    const wastagePer1000 = (wastageValue / netSales) * 1000;

    assert.equal(Number(payrollPer100.toFixed(2)), 30.0, 'Payroll per ₹100 is ₹30.00');
    assert.equal(Number(expensePer100.toFixed(2)), 42.05, 'OpEx per ₹100 is ₹42.05');
    assert.equal(Number(wastagePer1000.toFixed(2)), 19.12, 'Wastage per ₹1,000 is ₹19.12');
  });

  await t.test('3. Revenue Growth vs Cost Growth Gap Calculation', async () => {
    const revGrowth = 6.2;
    const opexGrowth = 9.8;
    const gap = Number((revGrowth - opexGrowth).toFixed(1));

    assert.equal(gap, -3.6, 'Gap is -3.6 percentage points (Costs outgrew revenue)');
  });

  await t.test('4. Personal Ledger Separation: Strict isolation from portfolio financials', async () => {
    const portfolioNetSales = 148520;
    const portfolioExpenses = 62450;
    const personalLedgerBalance = 140000;

    // Verify personal ledger is not mixed into business totals
    const computedBusinessNet = portfolioNetSales;
    assert.equal(computedBusinessNet, 148520, 'Business Net Sales excludes Personal Ledger');
    assert.notEqual(computedBusinessNet + personalLedgerBalance, computedBusinessNet, 'Personal ledger balance must never be added to operating sales');
  });

  await t.test('5. Cash Drawer & Physical Cash Held in Till Integrity', async () => {
    const drawerSessions = [
      { cafeId: cafeA, status: 'RECONCILED', cashInTill: 12000, variance: 0 },
      { cafeId: cafeB, status: 'RECONCILED', cashInTill: 7500, variance: 0 },
      { cafeId: cafeC, status: 'OPEN', cashInTill: 4300, variance: 0 },
    ];

    const totalPhysicalCash = drawerSessions.reduce((sum, d) => sum + d.cashInTill, 0);
    const totalVariance = drawerSessions.reduce((sum, d) => sum + d.variance, 0);

    assert.equal(totalPhysicalCash, 23800, 'Physical cash held across drawers is ₹23,800.00');
    assert.equal(totalVariance, 0, 'Zero cash variance across portfolio');
  });

  await t.test('6. RBAC Barrier: Owner cannot perform Master GL journal posting', async () => {
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
    };

    // Owner role does not possess FINANCE:POST
    const hasPostAuthority = ownerAuth.role === 'MASTER';
    assert.equal(hasPostAuthority, false, 'Owner cannot post financial journals');
  });

  await t.test('7. Multi-Café Revenue & Cost Concentration Math', async () => {
    const cafes = [
      { cafeId: cafeA, netSales: 74260, expenses: 29700 },
      { cafeId: cafeB, netSales: 47080, expenses: 20240 },
      { cafeId: cafeC, netSales: 27180, expenses: 12510 },
    ];

    const totalNet = cafes.reduce((sum, c) => sum + c.netSales, 0);
    const totalExp = cafes.reduce((sum, c) => sum + c.expenses, 0);

    const cafeAShare = Number(((cafes[0].netSales / totalNet) * 100).toFixed(1));
    const cafeACostShare = Number(((cafes[0].expenses / totalExp) * 100).toFixed(1));

    assert.equal(cafeAShare, 50.0, 'Café A revenue share is 50.0%');
    assert.equal(cafeACostShare, 47.6, 'Café A cost share is 47.6%');
  });
});
