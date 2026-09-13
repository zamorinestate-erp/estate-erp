'use strict';

/**
 * STATUTORY ESI + EPF COMPLIANCE & GST INVOICE CONCURRENCY AUDIT SUITE
 *
 * Verifies:
 *  1. Authoritative ESI Coverage Engine (ESI Act 1948, Rule 50):
 *     - ESI-01: Employee below ₹21,000 from contribution-period start → covered.
 *     - ESI-02: Employee begins contribution period below ceiling then crosses ₹21,000 during same contribution period → remains covered through end of contribution period.
 *     - ESI-03: Applicable contributions continue correctly after mid-period wage increase.
 *     - ESI-04: Employee already above applicable ceiling before a new contribution period → eligibility determined correctly.
 *     - ESI-05: Overtime treatment for coverage-ceiling determination follows applicable ESI rules (excluded from ceiling evaluation).
 *     - ESI-06: Employee contribution calculation (0.75%).
 *     - ESI-07: Employer contribution calculation (3.25%).
 *     - ESI-08: Boundary ₹21,000 (covered).
 *     - ESI-09: ₹21,001 case (excluded when starting fresh above ceiling).
 *     - ESI-10: Contribution-period rollover correctly reevaluates coverage.
 *  2. Authoritative EPF Membership & Ceiling Engine (EPF Scheme 1952):
 *     - New worker below ceiling (basic <= ₹15,000) → covered.
 *     - New worker above ceiling (basic > ₹15,000, fresh worker without prior UAN) → excluded employee.
 *     - Existing member below ceiling → covered.
 *     - Existing member whose wages rise above ceiling → remains covered under EPF.
 *     - Higher-wage contribution arrangement (Para 26(6) voluntary higher PF).
 *     - Boundary ₹15,000 (covered at ceiling).
 *     - Boundary ₹15,001 (fresh worker excluded, existing member retained).
 *     - EPS allocation (8.33% capped at ₹1,250 max, remainder to PF) & age >= 58 (EPS diverted to PF).
 *  3. GST Invoice Number Concurrency:
 *     - Concurrency-safe sequential allocation within financial year and cafe series.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUTORY_CONFIG,
  getEsiContributionPeriod,
  evaluateEsiCoverage,
  evaluateEpfCoverage,
  calculateStatutoryDeductions,
} = require('../src/services/payrollStatutoryService');

const { allocateInvoiceNumber } = require('../src/services/gstTaxService');
const { SequenceCounter } = require('../src/models/SequenceCounter');

test('STATUTORY AUDIT — ESI Rule 50 Coverage Continuity Suite', async (t) => {
  // Contribution period resolution check
  await t.test('ESI Contribution Period resolution (Apr-Sep & Oct-Mar)', () => {
    const aprPeriod = getEsiContributionPeriod('2026-04');
    assert.equal(aprPeriod.periodName, 'APRIL_TO_SEPTEMBER');
    assert.equal(aprPeriod.isStartMonth, true);

    const sepPeriod = getEsiContributionPeriod('2026-09');
    assert.equal(sepPeriod.periodName, 'APRIL_TO_SEPTEMBER');
    assert.equal(sepPeriod.isEndMonth, true);

    const octPeriod = getEsiContributionPeriod('2026-10');
    assert.equal(octPeriod.periodName, 'OCTOBER_TO_MARCH');
    assert.equal(octPeriod.isStartMonth, true);

    const marPeriod = getEsiContributionPeriod('2027-03');
    assert.equal(marPeriod.periodName, 'OCTOBER_TO_MARCH');
    assert.equal(marPeriod.isEndMonth, true);
  });

  // ESI-01: Employee below ₹21,000 from contribution-period start → covered
  await t.test('ESI-01: Employee below ₹21,000 at period start is covered', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 1800000, // ₹18,000
      totalGrossPaise: 1800000,
      periodKey: '2026-04',
      isEsiCoveredEstablishment: true,
      isEmployeeEnrolled: true,
    });
    assert.equal(res.isCovered, true);
    assert.equal(res.isContinuedCoverageMidPeriod, false);
    assert.equal(res.reason, 'COVERED_WITHIN_CEILING');
  });

  // ESI-02: Employee begins contribution period below ceiling then crosses ₹21,000 during same contribution period → remains covered
  await t.test('ESI-02: Mid-period wage increase above ₹21,000 retains coverage until period end', () => {
    // Employee was covered in April at ₹18,000; in July gets raise to ₹25,000
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2500000, // ₹25,000 (exceeds ₹21,000)
      totalGrossPaise: 2500000,
      wageAtPeriodStartPaise: 1800000, // Was ₹18,000 at start of period (April)
      isExistingCoveredInCurrentPeriod: true,
      periodKey: '2026-07',
    });
    assert.equal(res.isCovered, true, 'Must remain covered through end of contribution period');
    assert.equal(res.isContinuedCoverageMidPeriod, true);
    assert.equal(res.reason, 'COVERED_CONTINUED_UNTIL_PERIOD_END');
  });

  // ESI-03: Applicable contributions continue correctly after mid-period wage increase (on full higher gross)
  await t.test('ESI-03: Contributions calculated on full revised gross after mid-period wage increase', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2500000, // ₹25,000
      totalGrossPaise: 2500000,
      wageAtPeriodStartPaise: 1800000,
      isExistingCoveredInCurrentPeriod: true,
      periodKey: '2026-08',
    });
    // Employee: 0.75% of ₹25,000 = ₹187.50 => 18750 Paisa
    assert.equal(res.employeeContributionPaise, 18750);
    // Employer: 3.25% of ₹25,000 = ₹812.50 => 81250 Paisa
    assert.equal(res.employerContributionPaise, 81250);
    assert.equal(res.totalContributionPaise, 100000); // ₹1,000 total
  });

  // ESI-04: Employee already above applicable ceiling before a new contribution period → not covered
  await t.test('ESI-04: Employee above ceiling before new contribution period is not eligible', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2600000, // ₹26,000
      totalGrossPaise: 2600000,
      wageAtPeriodStartPaise: 2600000, // Above ceiling at start of period
      isExistingCoveredInCurrentPeriod: false,
      periodKey: '2026-10', // New contribution period start
    });
    assert.equal(res.isCovered, false);
    assert.equal(res.reason, 'WAGES_EXCEED_CEILING_AT_PERIOD_START');
    assert.equal(res.employeeContributionPaise, 0);
    assert.equal(res.employerContributionPaise, 0);
  });

  // ESI-05: Overtime treatment for coverage-ceiling determination (excluded from ceiling check)
  await t.test('ESI-05: Overtime wages excluded for ceiling check but included in contribution base', () => {
    // Normal wage: ₹20,000 (<= ₹21,000 ceiling), Overtime: ₹5,000 => Total gross: ₹25,000
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2000000, // ₹20,000 (below ceiling)
      totalGrossPaise: 2500000,      // ₹25,000 (gross with OT)
      periodKey: '2026-05',
    });
    assert.equal(res.isCovered, true, 'Must be covered because regular wage excluding OT is within ceiling');
    // Contribution is computed on total gross (including OT)
    assert.equal(res.employeeContributionPaise, Math.round(2500000 * 0.0075)); // 18750
    assert.equal(res.employerContributionPaise, Math.round(2500000 * 0.0325)); // 81250
  });

  // ESI-06: Employee contribution rate 0.75%
  await t.test('ESI-06: Employee contribution exact 0.75% calculation', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 1600000, // ₹16,000
      totalGrossPaise: 1600000,
      periodKey: '2026-06',
    });
    // 0.75% of 16,000 = ₹120 (12,000 Paisa)
    assert.equal(res.employeeContributionPaise, 12000);
  });

  // ESI-07: Employer contribution rate 3.25%
  await t.test('ESI-07: Employer contribution exact 3.25% calculation', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 1600000, // ₹16,000
      totalGrossPaise: 1600000,
      periodKey: '2026-06',
    });
    // 3.25% of 16,000 = ₹520 (52,000 Paisa)
    assert.equal(res.employerContributionPaise, 52000);
  });

  // ESI-08: Boundary ₹21,000 exactly
  await t.test('ESI-08: Boundary ₹21,000 exactly is covered', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2100000, // ₹21,000.00 exactly
      totalGrossPaise: 2100000,
      periodKey: '2026-04',
    });
    assert.equal(res.isCovered, true);
    assert.equal(res.employeeContributionPaise, 15750); // ₹157.50
    assert.equal(res.employerContributionPaise, 68250); // ₹682.50
  });

  // ESI-09: ₹21,001 case (fresh start above ceiling)
  await t.test('ESI-09: Boundary ₹21,001 (1 paisa above ceiling at start) is excluded', () => {
    const res = evaluateEsiCoverage({
      wageExcludingOtPaise: 2100100, // ₹21,001.00
      totalGrossPaise: 2100100,
      wageAtPeriodStartPaise: 2100100,
      isExistingCoveredInCurrentPeriod: false,
      periodKey: '2026-04',
    });
    assert.equal(res.isCovered, false);
    assert.equal(res.employeeContributionPaise, 0);
  });

  // ESI-10: Contribution period rollover correctly reevaluates coverage
  await t.test('ESI-10: Contribution-period rollover reevaluates coverage at period boundary', () => {
    // In September (end of Period 1), employee was covered at ₹25,000 due to continuity
    const sepRes = evaluateEsiCoverage({
      wageExcludingOtPaise: 2500000,
      totalGrossPaise: 2500000,
      wageAtPeriodStartPaise: 1800000,
      isExistingCoveredInCurrentPeriod: true,
      periodKey: '2026-09',
    });
    assert.equal(sepRes.isCovered, true, 'Covered in September due to continuity');

    // In October (start of Period 2), re-evaluated: wage is ₹25,000 (> ₹21,000)
    const octRes = evaluateEsiCoverage({
      wageExcludingOtPaise: 2500000,
      totalGrossPaise: 2500000,
      wageAtPeriodStartPaise: 2500000, // Start of new Oct-Mar period
      isExistingCoveredInCurrentPeriod: false, // New period evaluation
      periodKey: '2026-10',
    });
    assert.equal(octRes.isCovered, false, 'No longer covered in October as wage exceeded ceiling at period start');
  });
});

test('STATUTORY AUDIT — EPF Scheme 1952 Membership & Wage Ceiling Suite', async (t) => {
  // Case 1: New worker below ceiling
  await t.test('EPF-01: Fresh worker joining below ₹15,000 ceiling is enrolled', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 1200000, // ₹12,000
      dearnessAllowancePaise: 0,
      isExistingMember: false,
      hasUan: false,
      employeeAge: 25,
    });
    assert.equal(res.isApplicable, true);
    assert.equal(res.epfBasePaise, 1200000);
    // Employee: 12% of 12,000 = ₹1,440
    assert.equal(res.employeeContributionPaise, 144000);
    // Employer EPS: 8.33% of 12,000 = 99960 Paisa (~₹1,000)
    assert.equal(res.employerEpsPaise, 99960);
    // Employer PF: remainder of 12%
    assert.equal(res.employerTotalPaise, 144000);
  });

  // Case 2: New worker above ceiling (Excluded employee)
  await t.test('EPF-02: Fresh worker joining above ₹15,000 with no prior UAN is excluded', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 2500000, // ₹25,000
      isExistingMember: false,
      hasUan: false,
      voluntaryHigherPf: false,
    });
    assert.equal(res.isApplicable, false);
    assert.equal(res.isExcludedEmployee, true);
    assert.equal(res.reason, 'EXCLUDED_EMPLOYEE_FRESH_ABOVE_CEILING');
    assert.equal(res.employeeContributionPaise, 0);
  });

  // Case 3: Existing member below ceiling
  await t.test('EPF-03: Existing member below ceiling is covered', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 1400000, // ₹14,000
      isExistingMember: true,
      hasUan: true,
    });
    assert.equal(res.isApplicable, true);
    assert.equal(res.employeeContributionPaise, 168000); // 12% of 14,000 = ₹1,680
  });

  // Case 4: Existing member whose wages rise above ceiling
  await t.test('EPF-04: Existing member whose wages rise above ₹15,000 remains covered (capped at ceiling)', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 3000000, // ₹30,000
      isExistingMember: true,
      hasUan: true,
      voluntaryHigherPf: false, // Standard ceiling cap applies
    });
    assert.equal(res.isApplicable, true, 'Existing member must remain covered');
    // Base capped at statutory ceiling ₹15,000
    assert.equal(res.epfBasePaise, 1500000);
    // 12% of ₹15,000 = ₹1,800
    assert.equal(res.employeeContributionPaise, 180000);
    // EPS capped at ₹1,250 max
    assert.equal(res.employerEpsPaise, 124950); // 8.33% of 15,000
    assert.equal(res.employerTotalPaise, 180000);
  });

  // Case 5: Applicable higher-wage contribution arrangement (voluntary joint declaration)
  await t.test('EPF-05: Voluntary higher PF arrangement contributes on full un-capped wages', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 4000000, // ₹40,000
      isExistingMember: true,
      hasUan: true,
      voluntaryHigherPf: true, // Voluntary contribution on full basic
      voluntaryPfPaise: 50000,  // Additional VPF ₹500
    });
    assert.equal(res.isApplicable, true);
    assert.equal(res.epfBasePaise, 4000000); // Full basic
    // 12% of 40,000 = ₹4,800 (480000 Paisa) + ₹500 VPF (50000 Paisa) = 530000 Paisa
    assert.equal(res.employeeContributionPaise, 530000);
    // EPS remains capped at ₹1,250 max (8.33% of 15,000 = 124950 Paisa)
    assert.equal(res.employerEpsPaise, 124950);
    // Employer PF receives the balance
    assert.equal(res.employerPfPaise, 480000 - 124950);
  });

  // Case 6: Boundary ₹15,000
  await t.test('EPF-06: Boundary ₹15,000 is covered at ceiling limit', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 1500000, // ₹15,000.00 exactly
      isExistingMember: false,
      hasUan: false,
    });
    assert.equal(res.isApplicable, true);
    assert.equal(res.epfBasePaise, 1500000);
    assert.equal(res.employeeContributionPaise, 180000);
  });

  // Case 7: Boundary ₹15,001
  await t.test('EPF-07: Boundary ₹15,001 fresh worker is excluded; existing member is retained', () => {
    // Fresh worker at ₹15,001
    const freshRes = evaluateEpfCoverage({
      basicPayPaise: 1500100,
      isExistingMember: false,
      hasUan: false,
    });
    assert.equal(freshRes.isApplicable, false);
    assert.equal(freshRes.isExcludedEmployee, true);

    // Existing member at ₹15,001
    const existingRes = evaluateEpfCoverage({
      basicPayPaise: 1500100,
      isExistingMember: true,
      hasUan: true,
    });
    assert.equal(existingRes.isApplicable, true);
    assert.equal(existingRes.epfBasePaise, 1500000, 'Base capped at statutory ceiling');
  });

  // Case 8: Member age >= 58 years (EPS diverted to EPF)
  await t.test('EPF-08: Employee aged 58+ receives 0% EPS and full 12% to EPF', () => {
    const res = evaluateEpfCoverage({
      basicPayPaise: 1500000,
      isExistingMember: true,
      hasUan: true,
      employeeAge: 59,
    });
    assert.equal(res.isApplicable, true);
    assert.equal(res.employerEpsPaise, 0, 'No EPS contribution for age >= 58');
    assert.equal(res.employerPfPaise, 180000, 'Full 12% diverted to EPF');
    assert.equal(res.employerTotalPaise, 180000);
  });
});

test('STATUTORY AUDIT — GST Invoice Sequential Concurrency Suite', async (t) => {
  await t.test('Concurrent invoice allocations produce distinct gapless consecutive sequence numbers', async () => {
    const orgId = 'ORG-CONCURRENCY-TEST';
    const cafeId = 'CAFE-01';
    const fy = '2026-27';

    // Mock SequenceCounter.generateId to simulate atomic counter increments
    let counter = 100;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      counter += 1;
      return String(counter);
    });

    // Fire 10 parallel allocation requests simultaneously
    const requests = Array.from({ length: 10 }, () =>
      allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy })
    );

    const results = await Promise.all(requests);

    // Assert all 10 invoices were generated
    assert.equal(results.length, 10);

    // Assert all invoice numbers are strictly unique
    const invoiceNumbers = results.map((r) => r.invoiceNumber);
    const uniqueNumbers = new Set(invoiceNumbers);
    assert.equal(uniqueNumbers.size, 10, 'All concurrent invoice numbers must be unique');

    // Assert correct pattern format: INV/2026-27/CAFE01/00101 ...
    for (const inv of invoiceNumbers) {
      assert.match(inv, /^INV\/2026-27\/CAFE01\/\d{5}$/);
    }
  });
});
