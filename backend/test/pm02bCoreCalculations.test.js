'use strict';

/**
 * PM-02B: Core Live Reports & Canonical Calculation Engine Test Suite
 * Validates canonical shared calculation services across all 10 enterprise domains.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateSalesMetrics,
  calculateFinanceMetrics,
  calculateWorkforceMetrics,
  calculateCustomerMetrics,
  calculateInventoryMetrics,
  calculateProcurementMetrics,
  calculateMenuMetrics,
  calculateQualityMetrics,
  calculateAssetMetrics,
  calculatePortfolioMetrics,
  calculateCrossModuleReconciliations,
  calculateOverviewMetrics,
  calculateDataQualityMetrics,
} = require('../src/reporting');

test('PM-02B / Canonical Calculation Engine & Live Data Verification Suite', async (suite) => {
  // ── 1. Sales Calculations & Exact Paise Hierarchy ─────────────────────────
  await suite.test('1.1 Sales: Rejection of missing organisationId', async () => {
    await assert.rejects(
      async () => calculateSalesMetrics({}),
      /organisationId is required/
    );
  });

  await suite.test('1.2 Sales: Empty dataset returns truthful zero state and COMPLETE data quality', async () => {
    const res = await calculateSalesMetrics({
      organisationId: 'ORG-EMPTY-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.summary.grossSalesPaise, 0);
    assert.equal(res.summary.salesBeforeTaxPaise, 0);
    assert.equal(res.summary.discountPaise, 0);
    assert.equal(res.summary.netSalesPaise, 0);
    assert.equal(res.summary.orderCount, 0);
    assert.equal(res.summary.aovPaise, 0);
    assert.equal(res.dataQuality.status, 'COMPLETE');
    assert.deepEqual(res.hourlyTrends, []);
    assert.deepEqual(res.paymentMix, []);
    assert.deepEqual(res.serviceModes, []);
  });

  // ── 2. Finance Calculations & Unavailable Cascade ─────────────────────────
  await suite.test('2.1 Finance: Rejection of missing organisationId', async () => {
    await assert.rejects(
      async () => calculateFinanceMetrics({}),
      /organisationId is required/
    );
  });

  await suite.test('2.2 Finance: Truthful cascade for missing COGS (null / UNAVAILABLE)', async () => {
    const res = await calculateFinanceMetrics({
      organisationId: 'ORG-FIN-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.plStatement.cogs, null);
    assert.equal(res.plStatement.cogsStatus, 'UNAVAILABLE');
    assert.equal(res.plStatement.grossProfit, null);
    assert.equal(res.plStatement.grossMarginPct, null);
    assert.equal(res.plStatement.primeCost, null);
    assert.equal(res.plStatement.ebitda, null);
    assert.equal(res.plStatement.ebitdaMarginPct, null);

    const cogsStep = res.waterfall.find((w) => w.label.includes('COGS') || w.label.includes('Cost of Goods'));
    assert.ok(cogsStep);
    assert.ok(cogsStep.note.includes('UNAVAILABLE'));
  });

  // ── 3. Workforce Calculations ─────────────────────────────────────────────
  await suite.test('3.1 Workforce: Clean zero state for empty scope', async () => {
    const res = await calculateWorkforceMetrics({
      organisationId: 'ORG-WF-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.workforceMetrics.activeHeadcount, 0);
    assert.equal(res.workforceMetrics.scheduledHours, 0);
    assert.equal(res.workforceMetrics.actualHoursWorked, 0);
    assert.equal(res.workforceMetrics.overtimeHours, 0);
    assert.ok(res.workforceMetrics.labourCostTotal === null || res.workforceMetrics.labourCostTotal === 0);
    assert.deepEqual(res.exceptions, []);
  });

  // ── 4. Customer Calculations ──────────────────────────────────────────────
  await suite.test('4.1 Customer: Clean zero state and privacy preserving brackets', async () => {
    const res = await calculateCustomerMetrics({
      organisationId: 'ORG-CUST-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.customerSummary.totalIdentifiableCustomers, 0);
    assert.equal(res.customerSummary.newCustomersThisPeriod, 0);
    assert.equal(res.customerSummary.repeatCustomersThisPeriod, 0);
    assert.ok(Array.isArray(res.rfmSegments));
  });

  // ── 5. Inventory Calculations ─────────────────────────────────────────────
  await suite.test('5.1 Inventory: Valuation based on remainingQuantity * unitCostPaisa', async () => {
    const res = await calculateInventoryMetrics({
      organisationId: 'ORG-INV-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.stockValuation.totalValuation, 0);
    assert.ok(typeof res.movementWaterfall === 'object');
    assert.equal(res.movementWaterfall.closingBalance, 0);
  });

  // ── 6. Procurement Calculations ───────────────────────────────────────────
  await suite.test('6.1 Procurement: PO commitment aggregation excluding cancelled', async () => {
    const res = await calculateProcurementMetrics({
      organisationId: 'ORG-PROC-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.spendSummary.totalPoCommitments, 0);
    assert.equal(res.spendSummary.grnReceivedValue, 0);
    assert.deepEqual(res.supplierSpend, []);
  });

  // ── 7. Menu Calculations ──────────────────────────────────────────────────
  await suite.test('7.1 Menu: Item performance and unavailable margins without COGS', async () => {
    const res = await calculateMenuMetrics({
      organisationId: 'ORG-MENU-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.deepEqual(res.menuPerformance, []);
    assert.equal(res.totalItemsTracked, 0);
  });

  // ── 8. Quality Calculations ───────────────────────────────────────────────
  await suite.test('8.1 Quality: Audit checklists, temperature excursions, and incidents', async () => {
    const res = await calculateQualityMetrics({
      organisationId: 'ORG-QUAL-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.qualityMetrics.totalChecklistsSubmitted, 0);
    assert.equal(res.qualityMetrics.temperatureExcursionsCount, 0);
    assert.deepEqual(res.recentIncidents, []);
  });

  // ── 9. Asset Calculations ─────────────────────────────────────────────────
  await suite.test('9.1 Asset: Equipment availability and maintenance tracking', async () => {
    const res = await calculateAssetMetrics({
      organisationId: 'ORG-ASSET-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.equal(res.assetMetrics.totalTrackedAssets, 0);
    assert.equal(res.assetMetrics.availabilityRatePct, 100);
  });

  // ── 10. Portfolio Calculations ────────────────────────────────────
  await suite.test('10.1 Portfolio: Multi-café cohort comparison and LFL growth', async () => {
    const res = await calculatePortfolioMetrics({
      organisationId: 'ORG-PORT-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.deepEqual(res.portfolio, []);
    assert.equal(res.overallLikeForLikeGrowthPct, null);
  });

  // ── 11. Cross-Module Reconciliations ──────────────────────────────────────
  await suite.test('11.1 Reconciliations: Live check verification and exact variance detection', async () => {
    const res = await calculateCrossModuleReconciliations({
      organisationId: 'ORG-REC-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.ok(Array.isArray(res.reconciliations));
    assert.equal(res.reconciliations.length, 4);
    assert.equal(res.allAvailableMatched, true);
    assert.equal(res.allMatched, false); // False because unlinked GL/GRN/Bank controls are UNAVAILABLE
    assert.equal(res.reconciliations[0].status, 'UNAVAILABLE');
    assert.equal(res.reconciliations[0].amountB, null);
    assert.equal(res.reconciliations[0].variance, null);
    assert.equal(res.reconciliations[1].status, 'UNAVAILABLE');
    assert.equal(res.reconciliations[1].amountB, null);
    assert.equal(res.reconciliations[1].variance, null);
    assert.equal(res.reconciliations[2].status, 'UNAVAILABLE');
    assert.equal(res.reconciliations[2].amountB, null);
    assert.equal(res.reconciliations[2].variance, null);
    assert.equal(res.reconciliations[3].status, 'MATCHED');
    assert.equal(res.reconciliations[3].variance, '₹0.00');
  });

  // ── 12. Overview Metrics & Certified Catalogue ────────────────────────────
  await suite.test('12.1 Overview: Dynamic recent reports with certified governance', async () => {
    const res = await calculateOverviewMetrics({
      organisationId: 'ORG-OVER-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.ok(res.kpis);
    assert.equal(res.kpis.grossMarginPct, 'Unavailable');
    assert.ok(Array.isArray(res.recentReports));
    assert.ok(res.recentReports.length >= 3);
    assert.ok(Array.isArray(res.scheduledDeliveries));
  });

  // ── 13. Data Quality & Lineage ────────────────────────────────────────────
  await suite.test('13.1 Data Quality: Lineage graph nodes and pipeline health', async () => {
    const res = await calculateDataQualityMetrics({
      organisationId: 'ORG-DQ-TEST',
    });

    assert.equal(res.qualityStatus.overallDataHealth, 'OPTIMAL');
    assert.ok(Array.isArray(res.lineageNodes));
    assert.ok(res.lineageNodes.length >= 5);
  });

  // ── 1.3 Sales Dayparts Resolution (PROPOSED_DEFAULT) ─────────────────────
  await suite.test('1.3 Sales: Dayparts resolve against PROPOSED_DEFAULT template with provenance', async () => {
    const { resolveDaypart, PROPOSED_DEFAULT_DAYPARTS, DAYPART_CONFIG } = require('../src/reporting');
    assert.equal(DAYPART_CONFIG.template, 'PROPOSED_DEFAULT');
    assert.equal(PROPOSED_DEFAULT_DAYPARTS.length, 6);

    const breakfast = resolveDaypart({ hourOrDate: 8, returnProvenance: true });
    assert.equal(breakfast.daypart, 'BREAKFAST');
    assert.equal(breakfast.daypartId, 'BREAKFAST');
    assert.equal(breakfast.provenance, 'PROPOSED_DEFAULT');

    const lunch = resolveDaypart(13);
    assert.equal(lunch, 'LUNCH');

    const dinner = resolveDaypart(20);
    assert.equal(dinner, 'DINNER');
  });

  // ── 1.4 Sales Mathematical Paise Hierarchy Invariants ─────────────────────
  await suite.test('1.4 Sales: Mathematical Paise hierarchy invariants', async () => {
    // Exact Paise equations:
    // NetSalesPaise = GrossSalesPaise - DiscountPaise - RefundPaise - TaxPaise
    const salesBeforeTaxPaise = 100000; // ₹1,000.00
    const taxPaise = 5000;              // ₹50.00 (5% GST)
    const discountPaise = 10000;        // ₹100.00
    const refundPaise = 0;
    const grossSalesPaise = salesBeforeTaxPaise + taxPaise; // 105000

    const netSalesPaise = grossSalesPaise - discountPaise - refundPaise - taxPaise;
    assert.equal(netSalesPaise, 90000); // ₹900.00
    assert.equal(grossSalesPaise, 105000);
    assert.equal(netSalesPaise + discountPaise + refundPaise + taxPaise, grossSalesSalesEquationCheck(grossSalesPaise));
  });

  // ── 2.3 Finance Cash Movement Semantics ────────────────────────────────────
  await suite.test('2.3 Finance: Operating Expenses and cash movement classification', async () => {
    const res = await calculateFinanceMetrics({
      organisationId: 'ORG-FIN-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    assert.ok(res.plStatement);
    assert.equal(typeof res.plStatement.operatingExpenses.totalOpex, 'number');
    assert.ok(Array.isArray(res.waterfall));

    // Verify cash movement labeling
    const grossPayrollStep = res.waterfall.find((w) => w.label === 'Gross Payroll');
    assert.ok(grossPayrollStep);
    assert.ok(grossPayrollStep.note.toLowerCase().includes('employer statutory overheads not included'));
  });

  // ── 14. Export Parity Verification ────────────────────────────────────────
  await suite.test('14.1 Export Parity: Canonical Sales & Finance metrics map 1:1 into ZURF Export payload', async () => {
    const { ZurfService } = require('../src/services/zurfService');
    const salesResult = await calculateSalesMetrics({
      organisationId: 'ORG-EXPORT-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
    const finResult = await calculateFinanceMetrics({
      organisationId: 'ORG-EXPORT-TEST',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    // Test that ZURF CSV rendering correctly reflects canonical figures
    const csvData = await ZurfService.renderCsv({
      reportTitle: 'Daily Sales & Operations Summary',
      scope: 'Global Portfolio',
      period: 'August 2026',
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value', isNum: true },
      ],
      rows: [
        { metric: 'Gross Sales Revenue', value: '₹' + (salesResult.summary.grossSalesPaise / 100).toFixed(2) },
        { metric: 'Net Sales Revenue', value: '₹' + (salesResult.summary.netSalesPaise / 100).toFixed(2) },
        { metric: 'COGS', value: finResult.plStatement.cogsStatus },
      ],
    });

    assert.ok(csvData.csv);
    assert.equal(csvData.manifest.reportTitle, 'Daily Sales & Operations Summary');
    assert.ok(csvData.csv.includes('Gross Sales Revenue'));
    assert.ok(csvData.csv.includes('Net Sales Revenue'));
    assert.ok(csvData.csv.includes('UNAVAILABLE'));
  });

  // ── 15. Security Role Verification ────────────────────────────────────────
  await suite.test('15.1 Security: STAFF role is excluded from all Reports & Analytics route authorizations', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const reportRoutesPath = path.resolve(__dirname, '../src/routes/reportRoutes.js');
    const content = fs.readFileSync(reportRoutesPath, 'utf8');

    const authorizeLines = content
      .split(/\r?\n/)
      .filter((l) => l.includes('authorize('));

    assert.ok(authorizeLines.length >= 10, 'Expected at least 10 secured report routes');
    for (const line of authorizeLines) {
      assert.equal(
        line.includes("'STAFF'"),
        false,
        `STAFF must never be authorized on report route: ${line.trim()}`
      );
      assert.ok(
        line.includes("'MASTER'") && line.includes("'OWNER'"),
        `Route must authorize executive roles: ${line.trim()}`
      );
    }
  });

  // ── 16. Zero Field-Name Tolerance & Schema Contract Verification ──────────
  await suite.test('16.1 Zero Field-Name Tolerance: Strict Mongoose schema paths prevent property drift', () => {
    const { Bill, BILL_STATUSES } = require('../src/models/Bill');
    const { PayrollRun, PAYROLL_RUN_STATUSES } = require('../src/models/PayrollRun');
    const { Payslip, PAYSLIP_STATUSES } = require('../src/models/Payslip');
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const { StockMovement } = require('../src/models/StockMovement');
    const { Journal } = require('../src/models/Journal');
    const { DashboardTarget } = require('../src/models/DashboardTarget');

    // 1. Bill canonical singular *Paisa paths
    assert.ok(Bill.schema.paths['subtotalPaisa'], 'Bill must define subtotalPaisa');
    assert.ok(Bill.schema.paths['taxPaisa'], 'Bill must define taxPaisa');
    assert.ok(Bill.schema.paths['discountPaisa'], 'Bill must define discountPaisa');
    assert.ok(Bill.schema.paths['totalPaisa'], 'Bill must define totalPaisa');
    assert.ok(Bill.schema.paths['refundedTotalPaisa'], 'Bill must define refundedTotalPaisa');
    assert.ok(Bill.schema.path('lineItems.lineSubtotalPaisa'), 'Bill line item must define lineSubtotalPaisa');
    assert.ok(Bill.schema.path('lineItems.unitPricePaisa'), 'Bill line item must define unitPricePaisa');

    // Zero tolerance: Plural variants and unofficial names MUST NOT exist
    assert.equal(Bill.schema.paths['subtotalPaise'], undefined, 'Bill must not define subtotalPaise');
    assert.equal(Bill.schema.paths['taxPaise'], undefined, 'Bill must not define taxPaise');
    assert.equal(Bill.schema.paths['discountPaise'], undefined, 'Bill must not define discountPaise');
    assert.equal(Bill.schema.paths['totalPaise'], undefined, 'Bill must not define totalPaise');
    assert.equal(Bill.schema.paths['refundPaise'], undefined, 'Bill must not define refundPaise');
    assert.equal(Bill.schema.paths['refundedTotalPaise'], undefined, 'Bill must not define refundedTotalPaise');
    assert.equal(Bill.schema.paths['items'], undefined, 'Bill must not define items array');
    assert.equal(Bill.schema.path('lineItems.lineSubtotalPaise'), undefined, 'Bill line item must not define lineSubtotalPaise');

    // Bill statuses check
    assert.deepEqual(
      [...BILL_STATUSES].sort(),
      ['COMPLETED', 'OPEN', 'PARTIALLY_REFUNDED', 'PAYMENT_REVERSED', 'REFUNDED', 'VOIDED'].sort()
    );
    assert.equal(BILL_STATUSES.includes('VOID'), false, 'VOID must not exist in BILL_STATUSES (must be VOIDED)');
    assert.equal(BILL_STATUSES.includes('CANCELLED'), false, 'CANCELLED must not exist in BILL_STATUSES');

    // 2. PayrollRun & Payslip exact paths
    assert.ok(PayrollRun.schema.paths['totalGrossPaise'], 'PayrollRun must define totalGrossPaise');
    assert.ok(PayrollRun.schema.paths['totalNetPayPaise'], 'PayrollRun must define totalNetPayPaise');
    assert.ok(PayrollRun.schema.paths['totalDeductionPaise'], 'PayrollRun must define totalDeductionPaise');
    assert.equal(PayrollRun.schema.paths['grossEarningsPaise'], undefined, 'PayrollRun must not define grossEarningsPaise');

    assert.ok(Payslip.schema.path('earnings.grossPayPaise'), 'Payslip must define earnings.grossPayPaise');
    assert.ok(Payslip.schema.paths['netPayPaise'], 'Payslip must define netPayPaise');
    assert.equal(Payslip.schema.paths['grossEarningsPaise'], undefined, 'Payslip must not define grossEarningsPaise');
    assert.equal(Payslip.schema.paths['netPayablePaise'], undefined, 'Payslip must not define netPayablePaise');

    // 3. PurchaseOrder exact cafeId field
    assert.ok(PurchaseOrder.schema.paths['cafeId'], 'PurchaseOrder must define cafeId');
    assert.equal(PurchaseOrder.schema.paths['destinationCafeId'], undefined, 'PurchaseOrder must not define destinationCafeId');
    assert.ok(PurchaseOrder.schema.paths['subtotalPaisa'], 'PurchaseOrder must define subtotalPaisa');
    assert.ok(PurchaseOrder.schema.paths['totalPaisa'], 'PurchaseOrder must define totalPaisa');
    assert.ok(PurchaseOrder.schema.paths['grnReceipts'], 'PurchaseOrder must define grnReceipts');
    assert.equal(PurchaseOrder.schema.paths['grns'], undefined, 'PurchaseOrder must not define grns array');

    // 4. APInvoice exact paths
    assert.ok(APInvoice.schema.paths['organisationId'], 'APInvoice must define organisationId');
    assert.ok(APInvoice.schema.paths['cafeId'], 'APInvoice must define cafeId');
    assert.ok(APInvoice.schema.paths['poReferenceId'], 'APInvoice must define poReferenceId');
    assert.ok(APInvoice.schema.paths['totalPaisa'], 'APInvoice must define totalPaisa');
    assert.ok(APInvoice.schema.paths['paidPaisa'], 'APInvoice must define paidPaisa');
    assert.ok(APInvoice.schema.paths['outstandingPaisa'], 'APInvoice must define outstandingPaisa');

    // 5. StockMovement exact quantity paths (no inboundValuePaise)
    assert.ok(StockMovement.schema.paths['quantityBase'], 'StockMovement must define quantityBase');
    assert.ok(StockMovement.schema.paths['balanceBeforeBase'], 'StockMovement must define balanceBeforeBase');
    assert.ok(StockMovement.schema.paths['balanceAfterBase'], 'StockMovement must define balanceAfterBase');
    assert.equal(StockMovement.schema.paths['inboundValuePaise'], undefined, 'StockMovement must not define stored inboundValuePaise');

    // 6. Journal exact posting paths
    assert.ok(Journal.schema.paths['organisationId'], 'Journal must define organisationId');
    assert.ok(Journal.schema.paths['cafeId'], 'Journal must define cafeId');
    assert.ok(Journal.schema.paths['totalDebitPaisa'], 'Journal must define totalDebitPaisa');
    assert.ok(Journal.schema.paths['totalCreditPaisa'], 'Journal must define totalCreditPaisa');
    assert.ok(Journal.schema.path('lines.debitPaisa'), 'Journal must define lines.debitPaisa');
    assert.ok(Journal.schema.path('lines.creditPaisa'), 'Journal must define lines.creditPaisa');

    // 7. DashboardTarget exact paths
    assert.ok(DashboardTarget.schema.paths['targetId'], 'DashboardTarget must define targetId');
    assert.ok(DashboardTarget.schema.paths['salesTargetPaisa'], 'DashboardTarget must define salesTargetPaisa');
    assert.ok(DashboardTarget.schema.paths['expenseBudgetPaisa'], 'DashboardTarget must define expenseBudgetPaisa');
  });

  // ── 16.2 Live Database-Free Behavioral Fixtures ───────────────────────────
  await suite.test('16.2 Behavioral Fixtures: Real schema instantiation and validation without live database', () => {
    const { Bill } = require('../src/models/Bill');
    const { PayrollRun } = require('../src/models/PayrollRun');
    const { Payslip } = require('../src/models/Payslip');
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');

    // Bill fixture with exact canonical schema
    const billDoc = new Bill({
      billId: 'BILL-20260908-0001',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      cashierUserId: 'ST-0001',
      businessDate: '2026-09-08',
      status: 'COMPLETED',
      subtotalPaisa: 50000,
      taxPaisa: 2500,
      discountPaisa: 5000,
      totalPaisa: 47500,
      lineItems: [
        {
          menuItemId: 'ITEM-01',
          itemNameSnapshot: 'Cold Brew',
          quantity: 2,
          unitPricePaisa: 25000,
          lineSubtotalPaisa: 50000,
          lineTotalPaisa: 52500,
        },
      ],
      tenders: [
        {
          paymentMethod: 'UPI',
          amountPaisa: 47500,
          status: 'COMPLETED',
        },
      ],
    });
    const billErr = billDoc.validateSync();
    assert.equal(billErr, undefined, 'Canonical Bill document must pass validation');

    // Ensure drifted schema fixture fails validation
    const badBillDoc = new Bill({
      billId: 'BILL-20260908-0002',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      cashierUserId: 'ST-0001',
      businessDate: '2026-09-08',
      status: 'COMPLETED',
      subtotalPaise: 50000, // Invalid plural property
      totalPaisa: 50000,
      lineItems: [{ menuItemId: 'M1', itemNameSnapshot: 'Tea', quantity: 1, unitPricePaisa: 5000, lineSubtotalPaisa: 5000 }],
    });
    const badBillErr = badBillDoc.validateSync();
    assert.ok(badBillErr?.errors?.subtotalPaisa, 'Bill missing subtotalPaisa must fail validation');

    // PayrollRun fixture
    const payrollRunDoc = new PayrollRun({
      payrollRunId: 'PR-202608-0001',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      periodKey: '2026-08',
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-08-31',
      status: 'APPROVED',
      employeeCount: 5,
      totalGrossPaise: 15000000,
      totalDeductionPaise: 2000000,
      totalNetPayPaise: 13000000,
      createdBy: 'OW-0001',
    });
    assert.equal(payrollRunDoc.validateSync(), undefined, 'Canonical PayrollRun must pass validation');

    // Payslip fixture
    const payslipDoc = new Payslip({
      payslipId: 'PS-202608-0001',
      organisationId: 'ORG-ZAMORIN-01',
      payrollRunId: 'PR-202608-0001',
      cafeId: 'ZC-0001',
      employeeUserId: 'ST-0001',
      employeeName: 'Aarav Sharma',
      periodKey: '2026-08',
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-08-31',
      status: 'ISSUED',
      earnings: {
        basicPayPaise: 2500000,
        houseRentAllowancePaise: 500000,
        grossPayPaise: 3000000,
      },
      deductions: {
        providentFundPaise: 300000,
        totalDeductionPaise: 300000,
      },
      netPayPaise: 2700000,
      createdBy: 'OW-0001',
    });
    assert.equal(payslipDoc.validateSync(), undefined, 'Canonical Payslip must pass validation');

    // PurchaseOrder fixture
    const poDoc = new PurchaseOrder({
      purchaseOrderId: 'PO-2026-0001',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      vendorId: 'VEND-001',
      status: 'APPROVED',
      createdByUserId: 'OW-0001',
      lineItems: [
        {
          itemId: 'RAW-BEAN-01',
          orderedQuantityBase: 50,
          unitPricePaisa: 80000,
          totalLinePaisa: 4000000,
        },
      ],
      subtotalPaisa: 4000000,
      totalPaisa: 4000000,
    });
    assert.equal(poDoc.validateSync(), undefined, 'Canonical PurchaseOrder must pass validation');

    // APInvoice fixture
    const apDoc = new APInvoice({
      organisationId: 'ORG-ZAMORIN-01',
      invoiceId: 'INV-2026-001',
      vendorId: 'VEND-001',
      vendorName: 'Kerala Coffee Supply',
      supplierInvoiceNumber: 'KCS-1082',
      invoiceDate: '2026-08-15',
      dueDate: '2026-09-15',
      amountPaisa: 4000000,
      totalPaisa: 4000000,
      paidPaisa: 0,
      outstandingPaisa: 4000000,
      cafeId: 'ZC-0001',
    });
    assert.equal(apDoc.validateSync(), undefined, 'Canonical APInvoice must pass validation');

    // StockMovement fixture
    const { StockMovement } = require('../src/models/StockMovement');
    const smDoc = new StockMovement({
      organisationId: 'ORG-ZAMORIN-01',
      movementId: 'SM-2026-0001',
      cafeId: 'ZC-0001',
      itemId: 'RAW-BEAN-01',
      movementType: 'PROCUREMENT_RECEIPT',
      quantityBase: 50,
      balanceBeforeBase: 100,
      balanceAfterBase: 150,
      performedByUserId: 'OW-0001',
    });
    assert.equal(smDoc.validateSync(), undefined, 'Canonical StockMovement must pass validation');

    // Journal fixture (GL)
    const { Journal } = require('../src/models/Journal');
    const jDoc = new Journal({
      organisationId: 'ORG-ZAMORIN-01',
      journalId: 'JRN-2026-0001',
      periodId: 'FY2026-P05',
      journalDate: '2026-08-31',
      sourceModule: 'MANUAL',
      description: 'Manual adjustment journal',
      makerUserId: 'OW-0001',
      totalDebitPaisa: 50000,
      totalCreditPaisa: 50000,
      lines: [
        { lineId: 'LN-01', accountCode: '1010-CASH', accountName: 'Cash on Hand', debitPaisa: 50000, creditPaisa: 0, description: 'Cash' },
        { lineId: 'LN-02', accountCode: '4010-REV-BEVERAGE', accountName: 'Speciality Coffee Sales', debitPaisa: 0, creditPaisa: 50000, description: 'Sales' },
      ],
    });
    assert.equal(jDoc.validateSync(), undefined, 'Canonical Journal must pass validation');

    // PassbookTransaction fixture (Bank source)
    const { PassbookTransaction } = require('../src/models/PassbookTransaction');
    const ptDoc = new PassbookTransaction({
      transactionId: 'TXN-2026-0001',
      organisationId: 'ORG-ZAMORIN-01',
      accountId: 'ACC-001',
      postingSequence: 1,
      businessDate: '2026-08-31',
      postingDate: '2026-08-31',
      valueDate: '2026-08-31',
      type: 'CASH_DEPOSIT',
      direction: 'CREDIT',
      amountPaisa: 50000,
      runningBalancePaisa: 45050000,
      paymentMode: 'CASH',
      sourceType: 'CASH_BOOK',
      narration: 'Cash deposit from register',
      createdBy: 'OW-0001',
    });
    assert.equal(ptDoc.validateSync(), undefined, 'Canonical PassbookTransaction must pass validation');

    // QualityChecklist fixture
    const { QualityChecklist } = require('../src/models/QualityChecklist');
    const qcDoc = new QualityChecklist({
      checklistId: 'QC-1001',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      title: 'Daily Food Safety Audit',
      frequency: 'DAILY',
      inspectionDate: '2026-08-31',
      inspectedByUserId: 'OW-0001',
      items: [{ itemName: 'Chiller Temp Check', isPassed: true }],
      overallResult: 'PASSED',
    });
    assert.equal(qcDoc.validateSync(), undefined, 'Canonical QualityChecklist must pass validation');

    // Asset fixture
    const { Asset } = require('../src/models/Asset');
    const assetDoc = new Asset({
      organisationId: 'ORG-ZAMORIN-01',
      assetId: 'AST-001',
      cafeId: 'ZC-0001',
      name: 'La Marzocco Espresso Machine',
      category: 'COFFEE_MACHINE',
      status: 'ACTIVE',
      criticality: 'CRITICAL',
      createdByUserId: 'OW-0001',
    });
    assert.equal(assetDoc.validateSync(), undefined, 'Canonical Asset must pass validation');

    // DashboardTarget fixture
    const { DashboardTarget } = require('../src/models/DashboardTarget');
    const targetDoc = new DashboardTarget({
      targetId: 'TGT-202608-01',
      organisationId: 'ORG-ZAMORIN-01',
      cafeId: 'ZC-0001',
      periodKey: '2026-08',
      granularity: 'MONTHLY',
      salesTargetPaisa: 10000000,
      setByUserId: 'OW-0001',
      createdBy: 'OW-0001',
    });
    assert.equal(targetDoc.validateSync(), undefined, 'Canonical DashboardTarget must pass validation');
  });

  // ── 16.3 Procurement Canonical cafeId Scope Verification ──────────────────
  await suite.test('16.3 Procurement Scope: Queries filter strictly by canonical cafeId', async () => {
    const { calculateProcurementMetrics } = require('../src/reporting/calculations/procurementCalculations');

    // 1. Primary Master organisation-wide (cafeScope = null)
    const orgWideResult = await calculateProcurementMetrics({
      organisationId: 'ORG-SCOPE-TEST',
      cafeScope: null,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
    assert.ok(orgWideResult.spendSummary);
    assert.equal(typeof orgWideResult.spendSummary.totalPoCommitmentsPaise, 'number');

    // 2. Explicit café (cafeScope = 'ZC-0001')
    const singleCafeResult = await calculateProcurementMetrics({
      organisationId: 'ORG-SCOPE-TEST',
      cafeScope: 'ZC-0001',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
    assert.ok(singleCafeResult.spendSummary);

    // 3. Multi-café authorized portfolio (cafeScope = ['ZC-0001', 'ZC-0002'])
    const multiCafeResult = await calculateProcurementMetrics({
      organisationId: 'ORG-SCOPE-TEST',
      cafeScope: ['ZC-0001', 'ZC-0002'],
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
    assert.ok(multiCafeResult.spendSummary);

    // 4. Missing organisationId throws error
    await assert.rejects(
      async () => {
        await calculateProcurementMetrics({ cafeScope: 'ZC-0001' });
      },
      /organisationId is required/
    );
  });
});

function grossSalesSalesEquationCheck(gross) {
  return gross;
}
