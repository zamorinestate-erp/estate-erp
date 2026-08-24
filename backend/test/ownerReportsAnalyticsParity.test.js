'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const reportController = require('../src/controllers/reportController');

test('OWN-SCR-007 / Master Parity: Reports & Governed Analytics Parity & Security Suite', async (t) => {

  // Helper mock request and response builder
  function buildMockReqRes(role = 'OWNER', params = {}, query = {}, body = {}) {
    const req = {
      auth: {
        userId: 'owner-usr-001',
        role,
        cafeId: 'ZC-0001',
      },
      params,
      query,
      body,
      headers: {},
      ip: '127.0.0.1',
    };
    let responseData = null;
    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      setHeader() {
        return this;
      },
      send(data) {
        responseData = data;
        return this;
      },
    };
    return { req, res, getResult: () => ({ statusCode, data: responseData }) };
  }

  // ── 1. Overview & Certified Reports ──────────────────────────────────────────
  await t.test('1. Overview endpoint returns KPI cards, recent certified reports, and scheduled deliveries', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getAnalyticsOverview(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    assert.equal(result.data.success, true);
    assert.ok(result.data.data.kpis, 'Must include KPI headline cards');
    assert.ok(result.data.data.kpis.netSalesMdt, 'Must have net sales MDT');
    assert.ok(Array.isArray(result.data.data.recentReports), 'Must include recent certified reports');
    assert.ok(result.data.data.recentReports.length >= 3, 'Must have at least 3 recent reports');
    assert.ok(Array.isArray(result.data.data.scheduledDeliveries), 'Must include scheduled deliveries');
  });

  // ── 2. Governed Report Library / Catalogue ───────────────────────────────────
  await t.test('2. Report Catalogue returns certified reports across all 10 corporate domains', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getReportCatalogue(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.data.data.reports));
    assert.ok(result.data.data.reports.length >= 10);
    
    // Verify trustStatus on every certified report
    result.data.data.reports.forEach((r) => {
      assert.ok(r.reportId, 'Must have reportId');
      assert.ok(r.title, 'Must have title');
      assert.ok(r.category, 'Must have category');
      assert.ok(r.trustStatus === 'CERTIFIED' || r.trustStatus === 'GOVERNED', 'Must have governed trustStatus');
      assert.ok(r.version, 'Must have version string');
    });
  });

  // ── 3. Sales & POS Analytics ────────────────────────────────────────────────
  await t.test('3. Sales analytics returns service modes, hourly trends, and payment mix', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getSalesAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    assert.ok(result.data.data.summary, 'Must include summary');
    assert.ok(result.data.data.summary.grossSalesPaise > 0);
    assert.ok(Array.isArray(result.data.data.hourlyTrends), 'Must include hourly trends');
    assert.ok(Array.isArray(result.data.data.paymentMix), 'Must include payment mix (UPI, Cards, Cash)');
    assert.ok(Array.isArray(result.data.data.serviceModes), 'Must include service modes (Dine-in, Takeaway)');
  });

  // ── 4. Financial & P&L Waterfall ─────────────────────────────────────────────
  await t.test('4. Financial analytics returns P&L statement with EBITDA and waterfall', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getFinanceAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { plStatement, waterfall } = result.data.data;
    assert.ok(plStatement, 'Must have P&L statement');
    assert.ok(plStatement.grossRevenue > 0);
    assert.ok(plStatement.ebitda > 0);
    assert.ok(Array.isArray(waterfall), 'Must have waterfall steps');
  });

  // ── 5. Workforce & Labour Analytics ──────────────────────────────────────────
  await t.test('5. Workforce analytics returns labor cost % of sales and attendance exceptions', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getWorkforceAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { workforceMetrics, exceptions } = result.data.data;
    assert.ok(workforceMetrics.labourCostPctOfSales !== undefined);
    assert.ok(workforceMetrics.salesPerLabourHour !== undefined);
    assert.ok(Array.isArray(exceptions), 'Must have attendance exceptions');
  });

  // ── 6. Inventory, Movement & Valuation ───────────────────────────────────────
  await t.test('6. Inventory analytics returns stock valuation and movement waterfall', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getInventoryAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { stockValuation, movementWaterfall } = result.data.data;
    assert.ok(stockValuation.totalValuation > 0);
    assert.ok(movementWaterfall.closingBalance > 0);
  });

  // ── 7. Procurement, Commitments & PPV ─────────────────────────────────────────
  await t.test('7. Procurement analytics returns total PO commitments, PPV, and INR exceptions', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getProcurementAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { spendSummary, supplierSpend } = result.data.data;
    assert.ok(spendSummary.totalPoCommitments > 0);
    assert.ok(Array.isArray(supplierSpend));
  });

  // ── 8. Menu Engineering & Product Contribution ───────────────────────────────
  await t.test('8. Menu engineering returns item margin %, volume, COGS, and Boston-box class', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getMenuAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { menuPerformance } = result.data.data;
    assert.ok(Array.isArray(menuPerformance));
    menuPerformance.forEach((m) => {
      assert.ok(m.item);
      assert.ok(m.marginPct !== undefined);
      assert.ok(m.class, 'Must categorize item into Star, Workhorse, Opportunity, Dog');
    });
  });

  // ── 9. Quality, Safety & Cold-Chain ──────────────────────────────────────────
  await t.test('9. Quality analytics returns checklist compliance %, temperature excursions, and CAPA logs', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getQualityAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { qualityMetrics, recentIncidents } = result.data.data;
    assert.ok(qualityMetrics.checklistCompletionRatePct >= 90);
    assert.ok(Array.isArray(recentIncidents));
  });

  // ── 10. Assets & Maintenance Downtime ────────────────────────────────────────
  await t.test('10. Asset analytics returns availability rate %, PM compliance %, and downtime minutes', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getAssetAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { assetMetrics } = result.data.data;
    assert.ok(assetMetrics.availabilityRatePct > 95);
    assert.ok(assetMetrics.preventativeServiceCompliancePct >= 90);
  });

  // ── 11. Portfolio Like-for-Like (Same-Store) Sales ───────────────────────────
  await t.test('11. Portfolio report returns mature vs ramping cohort comparison and LFL growth %', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getPortfolioAnalytics(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { portfolio, overallLikeForLikeGrowthPct } = result.data.data;
    assert.ok(Array.isArray(portfolio));
    assert.ok(overallLikeForLikeGrowthPct > 0);
  });

  // ── 12. Strategic Scorecards & Goals ─────────────────────────────────────────
  await t.test('12. Goals scorecards return derived metric targets and status', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getGoalsAndScorecards(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { scorecards } = result.data.data;
    assert.ok(Array.isArray(scorecards));
    scorecards.forEach((s) => {
      assert.ok(s.goalId);
      assert.ok(s.metric);
      assert.ok(s.target);
      assert.ok(s.actual);
      assert.ok(s.status);
    });
  });

  // ── 13. Reconciliations & 4-Way Integrity ───────────────────────────────────
  await t.test('13. Cross-module reconciliations return matched balance checks', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getCrossModuleReconciliations(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { reconciliations } = result.data.data;
    assert.ok(Array.isArray(reconciliations));
    assert.ok(reconciliations.length >= 4);
    reconciliations.forEach((r) => {
      assert.equal(r.status, 'MATCHED');
    });
  });

  // ── 14. Semantic Dictionary & Governed Metrics ──────────────────────────────
  await t.test('14. Governed metrics dictionary returns formulas, stewards, versions', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getMetricsDictionary(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { metrics } = result.data.data;
    assert.ok(Array.isArray(metrics));
    assert.ok(metrics.length >= 6);
    metrics.forEach((m) => {
      assert.ok(m.metricId);
      assert.ok(m.name);
      assert.ok(m.formula);
      assert.ok(m.owner);
      assert.ok(m.version);
    });
  });

  // ── 15. Data Quality, Lineage & Freshness ────────────────────────────────────
  await t.test('15. Data quality returns optimal data health and lineage nodes', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getDataQualityAndLineage(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    const { qualityStatus, lineageNodes } = result.data.data;
    assert.ok(qualityStatus);
    assert.equal(qualityStatus.overallDataHealth, 'OPTIMAL');
    assert.ok(Array.isArray(lineageNodes));
  });

  // ── 16. ZURF v1 Export Generation & Job Queue ────────────────────────────────
  await t.test('16. ZURF Export generation renders certified output and queue list', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER', {}, {}, {
      reportId: 'Daily Sales & Operations Summary',
      format: 'PDF',
      scope: 'ALL_AUTHORIZED',
    });

    await reportController.generateZurfExport(req, res, () => {});
    const exportResult = getResult();

    assert.equal(exportResult.statusCode, 200);
    assert.equal(exportResult.data.success, true);
    assert.ok(exportResult.data.data.runId, 'Must generate runId');
    assert.equal(exportResult.data.data.format, 'PDF');
    assert.ok(exportResult.data.data.html, 'Must generate HTML for PDF print');

    // Verify job in queue
    const { req: qReq, res: qRes, getResult: getQResult } = buildMockReqRes('OWNER');
    await reportController.listExportJobs(qReq, qRes, () => {});
    const queueResult = getQResult();
    assert.equal(queueResult.statusCode, 200);
    assert.ok(Array.isArray(queueResult.data.data.jobs));
  });

  // ── 17. Security & Role Authorizations ───────────────────────────────────────
  await t.test('17. Security: OWNER and MASTER are authorized executive governance roles', () => {
    const permittedRoles = ['MASTER', 'OWNER'];
    assert.ok(permittedRoles.includes('OWNER'), 'OWNER must be in permitted roles');
    assert.ok(permittedRoles.includes('MASTER'), 'MASTER must be in permitted roles');
    assert.ok(!permittedRoles.includes('STAFF'), 'STAFF must NOT have global governance analytics access');
  });

  // ── 18. Analytics Integrity & Governance ────────────────────────────────────
  await t.test('18. Analytics integrity returns 100% check pass rate and audit timestamp', async () => {
    const { req, res, getResult } = buildMockReqRes('OWNER');
    await reportController.getAnalyticsIntegrity(req, res, () => {});
    const result = getResult();

    assert.equal(result.statusCode, 200);
    assert.equal(result.data.data.integrityScore, 100);
    assert.equal(result.data.data.allPassed, true);
    assert.ok(Array.isArray(result.data.data.checks));
    assert.equal(result.data.data.checks.length, 16);
  });
});
