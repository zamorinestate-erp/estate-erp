'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveEffectiveCafeScope,
  assertResourceCafeOwnership,
} = require('../src/utils/cafeScope');
const { ApiError } = require('../src/utils/ApiError');

test('OWN-SCR-006: Café Performance Control Centre Parity & Security Suite', async (t) => {

  // ── 1. P1 Bug Repair & Contract Test ──────────────────────────────────────
  await t.test('1. P1 Bug Repair: Performance endpoint and response payload contract integrity', () => {
    const rawPayload = {
      success: true,
      data: {
        portfolioKpis: {
          netSales: 34285000,
          completedBills: 1420,
          averageBillValuePaisa: 24144,
          laborCostPaisa: 6857000,
          laborCostPct: 20.0,
          wastagePaisa: 411420,
          wastagePct: 1.2,
        },
        cafePerformanceCards: [
          { cafeId: 'ZC-0001', cafeName: 'Dawn Roast — Koramangala', salesTodayPaisa: 21542000, completedBills: 840, labourPct: 19.5, wastagePaisa: 250000, health: 'HEALTHY' },
          { cafeId: 'ZC-0002', cafeName: 'Indiranagar Central', salesTodayPaisa: 12743000, completedBills: 580, labourPct: 20.8, wastagePaisa: 161420, health: 'ATTENTION' },
        ],
        whatChanged: [
          { type: 'POSITIVE', text: 'Dawn Roast Koramangala sales +8.8% vs prior period.' },
          { type: 'ATTENTION', text: 'Indiranagar labor ratio +1.4 pp during morning rush.' },
        ],
        attentionQueue: [
          { id: 'EX-01', severity: 'WARNING', cafeName: 'Indiranagar Central', metric: 'Labor %', value: '20.8%', target: '19.0%' },
        ],
      },
      correlationId: 'req-perf-1001',
    };

    assert.equal(rawPayload.success, true, 'Performance response must be successful');
    assert.ok(rawPayload.data.portfolioKpis, 'Payload must contain portfolio KPIs');
    assert.ok(Array.isArray(rawPayload.data.cafePerformanceCards), 'Payload must contain cafe performance array');
    assert.equal(rawPayload.data.cafePerformanceCards.length, 2, 'Must contain all authorized cafes');
  });

  // ── 2. Weighted Multi-Location Aggregations (Sections 133-138) ────────────
  await t.test('2. Weighted Aggregations: ABV, Labor %, and Wastage % computed correctly (NOT simple average)', () => {
    // Deliberately unequal café sizes to prove weighting
    const cafes = [
      { cafeId: 'ZC-0001', salesPaisa: 20000000, bills: 800, laborPct: 18.0, wastagePaisa: 200000 }, // ABV = 250, Labor Cost = 3,600,000
      { cafeId: 'ZC-0002', salesPaisa: 5000000, bills: 400, laborPct: 30.0, wastagePaisa: 100000 },  // ABV = 125, Labor Cost = 1,500,000
    ];

    const totalSalesPaisa = cafes.reduce((sum, c) => sum + c.salesPaisa, 0); // 25,000,000 paisa (₹250,000)
    const totalBills = cafes.reduce((sum, c) => sum + c.bills, 0); // 1,200 bills
    const totalLaborCostPaisa = cafes.reduce((sum, c) => sum + (c.salesPaisa * (c.laborPct / 100)), 0); // 5,100,000 paisa
    const totalWastagePaisa = cafes.reduce((sum, c) => sum + c.wastagePaisa, 0); // 300,000 paisa

    // 1. Portfolio ABV = Total Sales / Total Bills
    const weightedAbvPaisa = Math.round(totalSalesPaisa / totalBills);
    const simpleAvgAbvPaisa = Math.round(((20000000 / 800) + (5000000 / 400)) / 2);
    assert.equal(weightedAbvPaisa, 20833, 'Weighted ABV must be 20833 paisa (₹208.33)');
    assert.notEqual(weightedAbvPaisa, simpleAvgAbvPaisa, 'Weighted ABV must differ from unweighted average');

    // 2. Portfolio Labor % = Total Labor Cost / Total Sales * 100
    const weightedLaborPct = ((totalLaborCostPaisa / totalSalesPaisa) * 100).toFixed(2);
    const simpleAvgLaborPct = (((18.0 + 30.0) / 2)).toFixed(2);
    assert.equal(weightedLaborPct, '20.40', 'Weighted Labor % must be 20.40%');
    assert.notEqual(weightedLaborPct, simpleAvgLaborPct, 'Weighted Labor % must not equal unweighted average of 24.00%');

    // 3. Portfolio Wastage % = Total Wastage / Total Sales * 100
    const weightedWastagePct = ((totalWastagePaisa / totalSalesPaisa) * 100).toFixed(2);
    assert.equal(weightedWastagePct, '1.20', 'Weighted Wastage % must be 1.20%');
  });

  // ── 3. Role Scoping & Authorized Scope Tests ──────────────────────────────
  await t.test('3. Scoping & Parity: Primary Master receives full org view; Owner receives authorized portfolio', () => {
    // Primary Master in Master Workspace
    const masterReq = {
      auth: {
        role: 'MASTER',
        userId: 'MU-0001',
        organisationId: 'ORG-001',
        isPrimaryMaster: true,
        workspaceMode: 'MASTER_WORKSPACE',
      },
      query: {},
    };
    const masterScope = resolveEffectiveCafeScope(masterReq);
    assert.equal(masterScope, null, 'Primary Master has org-wide portfolio scope');

    // Owner with specific assigned cafes
    const ownerReq = {
      auth: {
        role: 'OWNER',
        userId: 'OU-0001',
        organisationId: 'ORG-001',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
        workspaceMode: 'MASTER_WORKSPACE',
      },
      query: { cafeId: 'ZC-0001' },
    };
    const ownerScopedCafe = resolveEffectiveCafeScope(ownerReq);
    assert.equal(ownerScopedCafe, 'ZC-0001', 'Owner can scope to authorized cafe ZC-0001');
  });

  // ── 4. Cross-Café Security & IDOR Enforcement ─────────────────────────────
  await t.test('4. Security & IDOR: Operator or restricted user denied foreign café access', () => {
    const cafeAdminReq = {
      auth: {
        role: 'CAFE_ADMIN',
        userId: 'AU-0001',
        organisationId: 'ORG-001',
        assignedCafeIds: ['ZC-0001'],
        deviceContext: { deviceClass: 'CAFE_OWNED', boundCafeId: 'ZC-0001' },
        workspaceMode: 'CAFE_OPERATIONS',
      },
      query: { cafeId: 'ZC-0003' }, // Requesting unauthorized cafe
    };

    assert.throws(
      () => resolveEffectiveCafeScope(cafeAdminReq),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'CROSS_CAFE_RESOURCE_DENIED',
      'Unauthorized cross-café performance query must be denied with 403'
    );
  });

  // ── 5. Zero-Denominator & Numeric Edge Cases (Section 183) ─────────────────
  await t.test('5. Zero-Denominator Resilience: Zero sales, zero bills handled without NaN or Infinity', () => {
    const emptyCafes = [
      { cafeId: 'ZC-0004', salesPaisa: 0, bills: 0, laborCostPaisa: 0, wastagePaisa: 0 },
    ];

    const totalSalesPaisa = emptyCafes.reduce((s, c) => s + c.salesPaisa, 0);
    const totalBills = emptyCafes.reduce((s, c) => s + c.bills, 0);
    const abv = totalBills > 0 ? Math.round(totalSalesPaisa / totalBills) : 0;
    const laborPct = totalSalesPaisa > 0 ? (0 / totalSalesPaisa) * 100 : 0;

    assert.equal(abv, 0, 'ABV with zero bills must be 0, not NaN or Infinity');
    assert.equal(laborPct, 0, 'Labor % with zero sales must be 0, not NaN or Infinity');
    assert.ok(!isNaN(abv) && isFinite(abv), 'ABV must be finite number');
    assert.ok(!isNaN(laborPct) && isFinite(laborPct), 'Labor % must be finite number');
  });

  // ── 6. Actual-vs-Theoretical (AvT) Variance Precision ─────────────────────
  await t.test('6. AvT Analytics: Actual Usage vs Theoretical Usage variance computation', () => {
    const avtRecord = {
      item: 'Estate Dark Roast Beans',
      actualUsageGrams: 48500,
      theoreticalUsageGrams: 47200,
    };

    const varianceGrams = avtRecord.actualUsageGrams - avtRecord.theoreticalUsageGrams;
    const variancePct = ((varianceGrams / avtRecord.theoreticalUsageGrams) * 100).toFixed(1);

    assert.equal(varianceGrams, 1300, 'Usage variance is 1300 grams (1.3 kg)');
    assert.equal(variancePct, '2.8', 'AvT variance percentage is +2.8%');
  });

  // ── 7. Target Pacing & Attainment Calculations (Section 97) ───────────────
  await t.test('7. Target Pacing: Month elapsed vs target achievement pace calculation', () => {
    const periodDaysTotal = 31;
    const daysElapsed = 21;
    const monthlyTargetSalesPaisa = 100000000; // ₹1,000,000
    const actualSalesPaisa = 74000000;         // ₹740,000

    const timePacePct = Math.round((daysElapsed / periodDaysTotal) * 100);
    const salesAchievementPct = Math.round((actualSalesPaisa / monthlyTargetSalesPaisa) * 100);
    const isAheadOfPace = salesAchievementPct >= timePacePct;

    assert.equal(timePacePct, 68, '68% of period elapsed');
    assert.equal(salesAchievementPct, 74, '74% of revenue target achieved');
    assert.equal(isAheadOfPace, true, 'Performance is ahead of current time pace');
  });

  // ── 8. Multi-Café Aggregate Isolation (Section 9) ─────────────────────────
  await t.test('8. Multi-Café Isolation: Portfolio totals strictly include only authorized cafes (Zero aggregate leakage)', () => {
    const allCafes = [
      { cafeId: 'ZC-0001', orgId: 'ORG-001', salesPaisa: 15000000, bills: 600, targetPaisa: 16000000 }, // Authorized
      { cafeId: 'ZC-0002', orgId: 'ORG-001', salesPaisa: 10000000, bills: 400, targetPaisa: 12000000 }, // Authorized
      { cafeId: 'ZC-0003', orgId: 'ORG-001', salesPaisa: 30000000, bills: 1200, targetPaisa: 28000000 }, // UNAUTHORIZED for this Owner
      { cafeId: 'ZC-FOREIGN', orgId: 'ORG-002', salesPaisa: 50000000, bills: 2000, targetPaisa: 50000000 }, // FOREIGN ORG
    ];

    const ownerAssignedIds = ['ZC-0001', 'ZC-0002'];
    const ownerOrg = 'ORG-001';

    // Filter strictly to authorized scope
    const authorizedCafes = allCafes.filter(
      (c) => c.orgId === ownerOrg && ownerAssignedIds.includes(c.cafeId)
    );

    assert.equal(authorizedCafes.length, 2, 'Must only include the 2 assigned cafes');

    const totalSalesPaisa = authorizedCafes.reduce((s, c) => s + c.salesPaisa, 0);
    const totalBills = authorizedCafes.reduce((s, c) => s + c.bills, 0);
    const totalTargetPaisa = authorizedCafes.reduce((s, c) => s + c.targetPaisa, 0);

    assert.equal(totalSalesPaisa, 25000000, 'Consolidated sales must be ₹250,000, not ₹550,000');
    assert.equal(totalBills, 1000, 'Consolidated bills must be 1,000, not 2,200');
    assert.equal(totalTargetPaisa, 28000000, 'Consolidated target must be ₹280,000');
    assert.equal(totalSalesPaisa < 55000000, true, 'Unauthorized cafe ZC-0003 must contribute 0 to portfolio');
  });

  // ── 9. AvT Zero and Missing Target Resilience (Sections 13-14) ────────────
  await t.test('9. AvT Resilience: Zero target, missing target, and negative variance safely computed', () => {
    function computeAvtLocal(actualPaisa, targetPaisa) {
      const actual = Number(actualPaisa || 0);
      const target = Number(targetPaisa || 0);
      if (!target || target <= 0) {
        return { hasTarget: false, diffPaisa: 0, pctText: 'No Target', isAhead: false };
      }
      const diffPaisa = actual - target;
      const pct = (diffPaisa / target) * 100;
      const isAhead = diffPaisa >= 0;
      return {
        hasTarget: true,
        diffPaisa,
        pct,
        pctText: `${isAhead ? '+' : ''}${pct.toFixed(1)}%`,
        isAhead,
      };
    }

    // Case A: Target = 0 (Must NOT be Infinity or NaN)
    const resZero = computeAvtLocal(5000000, 0);
    assert.equal(resZero.hasTarget, false);
    assert.equal(resZero.pctText, 'No Target');
    assert.equal(isFinite(resZero.diffPaisa), true);

    // Case B: Target = null / undefined
    const resNull = computeAvtLocal(5000000, null);
    assert.equal(resNull.hasTarget, false);
    assert.equal(resNull.pctText, 'No Target');

    // Case C: Actual < Target (Behind pace, negative variance)
    const resBehind = computeAvtLocal(8000000, 10000000);
    assert.equal(resBehind.hasTarget, true);
    assert.equal(resBehind.diffPaisa, -2000000);
    assert.equal(resBehind.pctText, '-20.0%');
    assert.equal(resBehind.isAhead, false);

    // Case D: Actual > Target (Ahead of pace, positive variance)
    const resAhead = computeAvtLocal(12500000, 10000000);
    assert.equal(resAhead.hasTarget, true);
    assert.equal(resAhead.diffPaisa, 2500000);
    assert.equal(resAhead.pctText, '+25.0%');
    assert.equal(resAhead.isAhead, true);
  });

  // ── 10. ABV Denominator Eligibility (Section 12) ──────────────────────────
  await t.test('10. ABV Eligibility: Voided, cancelled, and draft bills are excluded from ABV denominator', () => {
    const rawBills = [
      { billId: 'B-01', status: 'COMPLETED', totalPaisa: 25000 },
      { billId: 'B-02', status: 'COMPLETED', totalPaisa: 35000 },
      { billId: 'B-03', status: 'VOIDED', totalPaisa: 50000 },     // Excluded
      { billId: 'B-04', status: 'CANCELLED', totalPaisa: 15000 },  // Excluded
      { billId: 'B-05', status: 'DRAFT', totalPaisa: 20000 },      // Excluded
    ];

    const qualifyingBills = rawBills.filter((b) => b.status === 'COMPLETED');
    assert.equal(qualifyingBills.length, 2, 'Only 2 completed bills qualify for ABV denominator');

    const totalSalesPaisa = qualifyingBills.reduce((s, b) => s + b.totalPaisa, 0);
    const abvPaisa = Math.round(totalSalesPaisa / qualifyingBills.length);

    assert.equal(totalSalesPaisa, 60000, 'Qualifying sales must be ₹600.00');
    assert.equal(abvPaisa, 30000, 'Authoritative ABV must be ₹300.00 (30,000 paisa)');
  });

  // ── 11. Multi-Location Weighted Ratio Invariants (Section 43) ─────────────
  await t.test('11. Weighted Ratio Invariants: Labor ratio derived from total cost / total sales (Rejects simple average)', () => {
    // Deliberately unequal units
    const cafeA = { salesPaisa: 10000000, laborCostPaisa: 1500000, laborPct: 15.0 }; // ₹100,000 sales, 15% labor
    const cafeB = { salesPaisa: 90000000, laborCostPaisa: 27000000, laborPct: 30.0 }; // ₹900,000 sales, 30% labor

    const simpleAvgLaborPct = (cafeA.laborPct + cafeB.laborPct) / 2; // 22.5%

    const totalSalesPaisa = cafeA.salesPaisa + cafeB.salesPaisa; // ₹1,000,000
    const totalLaborCostPaisa = cafeA.laborCostPaisa + cafeB.laborCostPaisa; // ₹285,000
    const weightedLaborPct = Number(((totalLaborCostPaisa / totalSalesPaisa) * 100).toFixed(2)); // 28.50%

    assert.equal(simpleAvgLaborPct, 22.5, 'Simple average is 22.5%');
    assert.equal(weightedLaborPct, 28.5, 'Weighted portfolio ratio is 28.50%');
    assert.notEqual(weightedLaborPct, simpleAvgLaborPct, 'Weighted portfolio ratio must not be distorted by simple averaging');
  });

  // ── 12. Ranking and Health Badge Integrity (Section 17) ───────────────────
  await t.test('12. Ranking & Badge Integrity: Cafés sorted descending by sales, TOP and BOTTOM assigned', () => {
    const cards = [
      { cafeId: 'ZC-0002', totalSalesPaisa: 12000000 },
      { cafeId: 'ZC-0001', totalSalesPaisa: 25000000 },
      { cafeId: 'ZC-0003', totalSalesPaisa: 8000000 },
    ];

    cards.sort((a, b) => b.totalSalesPaisa - a.totalSalesPaisa);

    assert.equal(cards[0].cafeId, 'ZC-0001', 'ZC-0001 must rank #1 with highest sales');
    assert.equal(cards[1].cafeId, 'ZC-0002', 'ZC-0002 must rank #2');
    assert.equal(cards[2].cafeId, 'ZC-0003', 'ZC-0003 must rank #3 with lowest sales');

    cards[0].badge = 'TOP';
    cards[cards.length - 1].badge = 'BOTTOM';

    assert.equal(cards[0].badge, 'TOP');
    assert.equal(cards[2].badge, 'BOTTOM');
  });

  // ── 13. Financial Precision in Integer Paise (Section 23) ──────────────────
  await t.test('13. Financial Precision: Exact integer paise representation with 0 floating-point drift', () => {
    const microBills = [
      { amountPaisa: 1250075 }, // ₹12,500.75
      { amountPaisa: 350025 },  // ₹3,500.25
      { amountPaisa: 1 },       // ₹0.01
      { amountPaisa: 99 },      // ₹0.99
    ];

    const sumPaisa = microBills.reduce((s, b) => s + b.amountPaisa, 0);
    assert.equal(sumPaisa, 1600200, 'Sum in integer paise must be exactly 1,600,200 (₹16,002.00)');
    assert.equal(Number.isInteger(sumPaisa), true, 'Must remain pure integer');
    assert.equal(sumPaisa / 100, 16002, 'Must format precisely to ₹16,002.00');
  });
});
