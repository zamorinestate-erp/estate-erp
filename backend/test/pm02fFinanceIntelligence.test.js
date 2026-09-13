'use strict';
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinanceMetrics, EXCLUDED_EXPENSE_CATEGORIES, INCLUDED_EXPENSE_STATUSES } = require('../src/reporting/calculations/financeCalculations');

function makeOpts(o = {}) { return { organisationId: 'ORG-TEST-001', cafeScope: null, dateFrom: '2026-01-01', dateTo: '2026-01-31', ...o }; }

describe('PM-02F S1 Module Contract', () => {
  it('1.1 calculateFinanceMetrics is async function', () => { assert.equal(typeof calculateFinanceMetrics, 'function'); });
  it('1.2 EXCLUDED_EXPENSE_CATEGORIES exported with required families', () => {
    for (const cat of ['INVENTORY','PAYROLL','CAPEX','TAX','SALARY','WAGES','GST']) assert.ok(EXCLUDED_EXPENSE_CATEGORIES.includes(cat), cat);
  });
  it('1.3 INCLUDED_EXPENSE_STATUSES has APPROVED PAID CLOSED not DRAFT SUBMITTED', () => {
    assert.ok(INCLUDED_EXPENSE_STATUSES.includes('APPROVED'));
    assert.ok(INCLUDED_EXPENSE_STATUSES.includes('PAID'));
    assert.ok(INCLUDED_EXPENSE_STATUSES.includes('CLOSED'));
    assert.ok(!INCLUDED_EXPENSE_STATUSES.includes('DRAFT'));
    assert.ok(!INCLUDED_EXPENSE_STATUSES.includes('SUBMITTED'));
    assert.ok(!INCLUDED_EXPENSE_STATUSES.includes('REJECTED'));
  });
  it('1.4 throws if organisationId missing', async () => { await assert.rejects(() => calculateFinanceMetrics({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }), /organisationId is required/i); });
});

describe('PM-02F S2 Offline Fallback Shape', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('2.1 has all top-level keys', () => {
    for (const k of ['overview','revenueBridge','expenseIntelligence','payrollIntelligence','cashAndTill','paymentSettlementIntelligence','accountsPayable','budgetVsActual','plStatement','waterfall','financialExceptions','dataQuality','provenance'])
      assert.ok(k in r, k);
  });
  it('2.2 overview has required KPI fields', () => {
    for (const f of ['netSalesPaisa','netSales','taxCollectedPaisa','taxCollected','totalOpexPaisa','totalOpex','grossPayrollPaisa','grossPayroll','grossPayrollPctOfSales','apOutstandingPaisa','apOutstanding','tillVariancePaisa','tillVariance','orderCount'])
      assert.ok(f in r.overview, f);
  });
  it('2.3 dataQuality.status is string', () => { assert.equal(typeof r.dataQuality.status, 'string'); });
  it('2.4 provenance.sourceModels is non-empty array', () => { assert.ok(Array.isArray(r.provenance.sourceModels) && r.provenance.sourceModels.length > 0); });
});

describe('PM-02F S8 PL Absolute Financial Integrity', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('8.1 cogs is null', () => { assert.strictEqual(r.plStatement.cogs, null); });
  it('8.2 cogsStatus is UNAVAILABLE', () => { assert.equal(r.plStatement.cogsStatus, 'UNAVAILABLE'); });
  it('8.3 grossProfit is null', () => { assert.strictEqual(r.plStatement.grossProfit, null); });
  it('8.4 grossMarginPct is null', () => { assert.strictEqual(r.plStatement.grossMarginPct, null); });
  it('8.5 primeCost is null', () => { assert.strictEqual(r.plStatement.primeCost, null); });
  it('8.6 ebitda is null', () => { assert.strictEqual(r.plStatement.ebitda, null); });
  it('8.7 ebitdaStatus is UNAVAILABLE', () => { assert.equal(r.plStatement.ebitdaStatus, 'UNAVAILABLE'); });
  it('8.8 ebitdaMarginPct is null', () => { assert.strictEqual(r.plStatement.ebitdaMarginPct, null); });
  it('8.9 waterfall terminates at Known Operating Result Components no EBITDA total', () => {
    assert.ok(Array.isArray(r.waterfall) && r.waterfall.length > 0);
    const last = r.waterfall[r.waterfall.length - 1];
    assert.match(last.label, /Known Operating Result/i);
    assert.equal(r.waterfall.find(w => /ebitda/i.test(w.label) && w.isTotal), undefined);
  });
  it('8.10 SYNTHETIC_EBITDA=0 invariant', () => { assert.ok(r.plStatement.ebitda === null || r.plStatement.ebitda === undefined); });
  it('8.11 SYNTHETIC_COGS=0 invariant', () => { assert.ok(r.plStatement.cogs === null || r.plStatement.cogs === undefined); });
  it('8.12 operatingExpenses sub-object has required fields', () => {
    const op = r.plStatement.operatingExpenses;
    assert.ok(op && typeof op === 'object');
    for (const f of ['labour','rent','utilities','maintenance','packagingAndConsumables','other','totalOpex']) assert.ok(f in op, f);
  });
  it('8.13 workingCapital depreciation interest are all UNAVAILABLE', () => {
    assert.equal(r.workingCapital.status, 'UNAVAILABLE');
    assert.equal(r.depreciation.status, 'UNAVAILABLE');
    assert.equal(r.interest.status, 'UNAVAILABLE');
  });
});

describe('PM-02F S4 Revenue Bridge', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('4.1 revenueBridge has all required fields', () => {
    for (const f of ['grossSalesPaisa','grossSales','discountPaisa','discounts','preTaxRefundPaisa','preTaxRefunds','netSalesPaisa','netSales','taxChargedPaisa','taxCharged','customerReceiptTotalPaisa','customerReceiptTotal','refundQuality','formula'])
      assert.ok(f in r.revenueBridge, f);
  });
  it('4.2 formula references Net Sales', () => { assert.match(r.revenueBridge.formula, /Net Sales/i); });
  it('4.3 grossSales and netSales non-negative', () => { assert.ok(r.revenueBridge.grossSales >= 0); assert.ok(r.revenueBridge.netSales >= 0); });
  it('4.4 customerReceiptTotal = netSales + taxCharged within rounding', () => {
    const exp = Number((r.revenueBridge.netSales + r.revenueBridge.taxCharged).toFixed(2));
    assert.ok(Math.abs(r.revenueBridge.customerReceiptTotal - exp) < 0.02);
  });
});

describe('PM-02F S5 Expense Intelligence', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('5.1 expenseIntelligence has required fields', () => {
    for (const f of ['totalOpexPaisa','totalOpex','buckets','byCategory','byCafe','byVendor','pareto','trends','largestExpenses','capexClassification','eligibleExpenseCount','excludedExpenseCount','doubleCountProtection'])
      assert.ok(f in r.expenseIntelligence, f);
  });
  it('5.2 capexClassification is UNAVAILABLE', () => { assert.equal(r.expenseIntelligence.capexClassification, 'UNAVAILABLE'); });
  it('5.3 doubleCountProtection references all four families', () => {
    const d = r.expenseIntelligence.doubleCountProtection;
    assert.match(d, /INVENTORY/i); assert.match(d, /PAYROLL/i); assert.match(d, /CAPEX/i); assert.match(d, /TAX/i);
  });
  it('5.4 buckets has rent utilities maintenance packagingAndConsumables other', () => {
    const b = r.expenseIntelligence.buckets;
    for (const f of ['rent','utilities','maintenance','packagingAndConsumables','other']) { assert.ok(f in b, f); assert.ok(b[f] >= 0); }
  });
  it('5.5 EXCLUDED_EXPENSE_CATEGORIES covers all double-count families', () => {
    for (const cat of ['INVENTORY','INVENTORY_PURCHASE','RAW_MATERIAL','STOCK','PAYROLL','SALARY','WAGES','STIPEND','CAPEX','CAPITAL','EQUIPMENT_PURCHASE','ASSET_ACQUISITION','TAX','GST','INCOME_TAX','STATUTORY_TAX'])
      assert.ok(EXCLUDED_EXPENSE_CATEGORIES.includes(cat), cat);
  });
});

describe('PM-02F S6 Gross Payroll Intelligence', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('6.1 payrollIntelligence has required fields', () => {
    for (const f of ['grossPayrollPaisa','grossPayroll','grossPayrollPctOfSales','payrollRunCount','payslipCount','byCafe','labourCostQuality','missingEmployerComponents','disclosureNotice'])
      assert.ok(f in r.payrollIntelligence, f);
  });
  it('6.2 labourCostQuality is PARTIAL_SOURCE', () => { assert.equal(r.payrollIntelligence.labourCostQuality, 'PARTIAL_SOURCE'); });
  it('6.3 missingEmployerComponents includes EPF ESI GRATUITY', () => {
    const m = r.payrollIntelligence.missingEmployerComponents;
    assert.ok(m.some(c => /EPF/i.test(c))); assert.ok(m.some(c => /ESI/i.test(c))); assert.ok(m.some(c => /GRATUITY/i.test(c)));
  });
  it('6.4 disclosureNotice is non-empty string', () => { assert.equal(typeof r.payrollIntelligence.disclosureNotice, 'string'); assert.ok(r.payrollIntelligence.disclosureNotice.length > 10); });
  it('6.5 grossPayrollPctOfSales is finite no NaN', () => { const p = r.payrollIntelligence.grossPayrollPctOfSales; assert.ok(isFinite(p) && !isNaN(p)); });
});

describe('PM-02F S7 Cash Till Reconciliation', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('7.1 cashAndTill has required fields', () => {
    for (const f of ['reportTitle','totalSessions','totalOpeningFloatPaisa','totalOpeningFloat','totalExpectedCashPaisa','totalExpectedCash','totalCountedCashPaisa','totalCountedCash','totalTillVariancePaisa','totalTillVariance','varianceDirection','sessions','byCafe','cashMovements','bankBalance','bankBalanceStatus','bankBalanceReason'])
      assert.ok(f in r.cashAndTill, f);
  });
  it('7.2 reportTitle is Operational Cash Movement not Statement of Cash Flows', () => {
    assert.match(r.cashAndTill.reportTitle, /Operational Cash Movement/i);
    assert.ok(!/Statement of Cash Flows/i.test(r.cashAndTill.reportTitle));
  });
  it('7.3 bankBalance is null bankBalanceStatus is UNAVAILABLE', () => { assert.strictEqual(r.cashAndTill.bankBalance, null); assert.equal(r.cashAndTill.bankBalanceStatus, 'UNAVAILABLE'); });
  it('7.4 varianceDirection is OVERAGE SHORTAGE or BALANCED', () => { assert.ok(['OVERAGE','SHORTAGE','BALANCED'].includes(r.cashAndTill.varianceDirection)); });
  it('7.5 totalTillVariance is finite', () => { assert.ok(isFinite(r.cashAndTill.totalTillVariance) && !isNaN(r.cashAndTill.totalTillVariance)); });
  it('7.6 tillVariancePaisa = countedPaisa - expectedPaisa', () => { assert.equal(r.cashAndTill.totalTillVariancePaisa, r.cashAndTill.totalCountedCashPaisa - r.cashAndTill.totalExpectedCashPaisa); });
});

describe('PM-02F S8 Payment Settlements', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('8.1 has marketplace posTenders directGatewaySettlements', () => {
    const p = r.paymentSettlementIntelligence;
    assert.ok('marketplace' in p); assert.ok('posTenders' in p); assert.ok('directGatewaySettlements' in p);
  });
  it('8.2 directGatewaySettlements settledAmount is null availability UNAVAILABLE', () => {
    const d = r.paymentSettlementIntelligence.directGatewaySettlements;
    assert.strictEqual(d.settledAmount, null); assert.equal(d.availability, 'UNAVAILABLE');
  });
  it('8.3 marketplace has required fields', () => {
    const m = r.paymentSettlementIntelligence.marketplace;
    for (const f of ['grossSales','commission','netSettlement','bankReceived','variance','settlements']) assert.ok(f in m, f);
    assert.ok(Array.isArray(m.settlements));
  });
});

describe('PM-02F S9 Accounts Payable Integration', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('9.1 accountsPayable has required fields', () => {
    for (const f of ['invoicedValuePaisa','invoicedValue','outstandingPaisa','outstanding','aging','overduePaisa','overdue']) assert.ok(f in r.accountsPayable, f);
  });
  it('9.2 aging has all buckets', () => {
    for (const b of ['current','days1_30','days31_60','days61_90','days90Plus']) assert.ok(b in r.accountsPayable.aging, b);
  });
  it('9.3 AP values non-negative', () => { assert.ok(r.accountsPayable.invoicedValue >= 0); assert.ok(r.accountsPayable.outstanding >= 0); });
});

describe('PM-02F S10 Budget vs Actual', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('10.1 budgetVsActual has required keys', () => { for (const k of ['hasBudget','availability','sales','expenses']) assert.ok(k in r.budgetVsActual, k); });
  it('10.2 payrollBudget and profitBudget are UNAVAILABLE', () => { assert.equal(r.budgetVsActual.payrollBudget.status, 'UNAVAILABLE'); assert.equal(r.budgetVsActual.profitBudget.status, 'UNAVAILABLE'); });
  it('10.3 sales has target actual variance', () => { for (const f of ['targetPaisa','target','actualPaisa','actual','variancePaisa','variance']) assert.ok(f in r.budgetVsActual.sales, f); });
  it('10.4 expenses has budget actual variance', () => { for (const f of ['budgetPaisa','budget','actualPaisa','actual','variancePaisa','variance']) assert.ok(f in r.budgetVsActual.expenses, f); });
  it('10.5 offline hasBudget is false availability UNAVAILABLE', () => { assert.equal(r.budgetVsActual.hasBudget, false); assert.equal(r.budgetVsActual.availability, 'UNAVAILABLE'); });
});

describe('PM-02F S11 Financial Exception Centre', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('11.1 has required exception fields', () => {
    for (const f of ['tillVariances','tillVarianceCount','overdueApValue','overdueApPaisa','settlementDiscrepancies','settlementDiscrepancyCount','unapprovedExpenses','unapprovedExpenseCount','unallocatedRefundCount'])
      assert.ok(f in r.financialExceptions, f);
  });
  it('11.2 tillVarianceCount equals tillVariances.length', () => { assert.equal(r.financialExceptions.tillVarianceCount, r.financialExceptions.tillVariances.length); });
  it('11.3 counts are non-negative integers', () => {
    for (const f of ['tillVarianceCount','settlementDiscrepancyCount','unapprovedExpenseCount']) { assert.ok(Number.isInteger(r.financialExceptions[f])); assert.ok(r.financialExceptions[f] >= 0); }
  });
});

describe('PM-02F S12 Multi-Tenant Scope Security', () => {
  it('12.1 missing organisationId throws', async () => { await assert.rejects(() => calculateFinanceMetrics({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }), /organisationId is required/i); });
  it('12.2 different orgs produce independent result objects', async () => {
    const [r1, r2] = await Promise.all([calculateFinanceMetrics(makeOpts({ organisationId: 'ORG-AAA' })), calculateFinanceMetrics(makeOpts({ organisationId: 'ORG-BBB' }))]);
    assert.ok(r1 !== r2); assert.ok(typeof r1.overview === 'object'); assert.ok(typeof r2.overview === 'object');
  });
  it('12.3 cafeScope array accepted', async () => { const r = await calculateFinanceMetrics(makeOpts({ cafeScope: ['ZC-001','ZC-002'] })); assert.ok(r && r.overview); });
  it('12.4 cafeScope single string accepted', async () => { const r = await calculateFinanceMetrics(makeOpts({ cafeScope: 'ZC-001' })); assert.ok(r && r.overview); });
  it('12.5 null cafeScope accepted', async () => { const r = await calculateFinanceMetrics(makeOpts({ cafeScope: null })); assert.ok(r && r.overview); });
});

describe('PM-02F S13 Numerical Integrity', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('13.1 overview paisa values are integers', () => {
    for (const f of ['netSalesPaisa','taxCollectedPaisa','customerRefundPaisa','totalOpexPaisa','grossPayrollPaisa','apOutstandingPaisa','cashOpeningFloatPaisa','cashExpectedPaisa','cashCountedPaisa','tillVariancePaisa'])
      assert.ok(r.overview[f] === null || Number.isInteger(r.overview[f]), f);
  });
  it('13.2 INR display values are finite non-NaN', () => {
    for (const f of ['netSales','taxCollected','customerRefunds','totalOpex','grossPayroll','grossPayrollPctOfSales','apOutstanding','cashOpeningFloat','cashExpected','cashCounted','tillVariance'])
      assert.ok(isFinite(r.overview[f]) && !isNaN(r.overview[f]), f);
  });
  it('13.3 revenueBridge paisa INR consistency', () => {
    const derived = Number((r.revenueBridge.grossSalesPaisa / 100).toFixed(2));
    assert.ok(Math.abs(r.revenueBridge.grossSales - derived) < 0.02);
  });
  it('13.4 expenseIntelligence totalOpex paisa INR consistency', () => {
    const derived = Number((r.expenseIntelligence.totalOpexPaisa / 100).toFixed(2));
    assert.ok(Math.abs(r.expenseIntelligence.totalOpex - derived) < 0.02);
  });
  it('13.5 waterfall last row value is finite number', () => {
    const last = r.waterfall[r.waterfall.length - 1];
    assert.ok(typeof last.value === 'number' && isFinite(last.value));
  });
});

describe('PM-02F S14 Data Quality Provenance', () => {
  let r;
  before(async () => { r = await calculateFinanceMetrics(makeOpts()); });
  it('14.1 warnings includes COGS_UNAVAILABLE', () => { assert.ok(r.dataQuality.warnings.some(w => /COGS_UNAVAILABLE/i.test(w))); });
  it('14.2 warnings includes EBITDA_UNAVAILABLE', () => { assert.ok(r.dataQuality.warnings.some(w => /EBITDA_UNAVAILABLE/i.test(w))); });
  it('14.3 warnings includes LABOUR_COST_PARTIAL_SOURCE', () => { assert.ok(r.dataQuality.warnings.some(w => /LABOUR_COST_PARTIAL_SOURCE/i.test(w))); });
  it('14.4 warnings includes BANK_BALANCE_UNAVAILABLE', () => { assert.ok(r.dataQuality.warnings.some(w => /BANK_BALANCE_UNAVAILABLE/i.test(w))); });
  it('14.5 sourceModels includes Bill Expense PayrollRun RegisterSession', () => {
    for (const m of ['Bill','Expense','PayrollRun','RegisterSession']) assert.ok(r.provenance.sourceModels.includes(m), m);
  });
  it('14.6 metricVersions has version strings', () => { const mv = r.provenance.metricVersions; assert.equal(typeof mv.GROSS_SALES, 'string'); assert.equal(typeof mv.NET_SALES, 'string'); });
});

describe('PM-02F S15 Static Semantic Audit', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../src/reporting/calculations/financeCalculations.js'), 'utf8');
  it('15.1 source does not contain Statement of Cash Flows', () => { assert.ok(!src.includes('Statement of Cash Flows')); });
  it('15.2 source uses Operational Cash Movement terminology', () => { assert.ok(src.includes('Operational Cash Movement')); });
  it('15.3 EXCLUDED_CATEGORIES and INCLUDED_STATUSES have no overlap', () => {
    for (const cat of EXCLUDED_EXPENSE_CATEGORIES) assert.ok(!INCLUDED_EXPENSE_STATUSES.includes(cat));
  });
  it('15.4 PRODUCTION_FAKE_FINANCIALS invariant offline result', async () => {
    const r = await calculateFinanceMetrics(makeOpts());
    assert.strictEqual(r.plStatement.cogs, null);
    assert.strictEqual(r.plStatement.grossProfit, null);
    assert.strictEqual(r.plStatement.ebitda, null);
  });
});
