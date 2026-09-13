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

const zlib = require('node:zlib');
const { generateXlsx } = require('../src/utils/exportGenerators');
const { allocateInvoiceNumber, cancelTaxInvoice } = require('../src/services/gstTaxService');
const { TaxInvoice } = require('../src/models/TaxInvoice');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const auditService = require('../src/services/auditService');

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

test('STATUTORY AUDIT — Universal XLSX OOXML Package & Canonical MIME Validation', async (t) => {
  const sampleColumns = [
    { key: 'invoiceNo', label: 'Invoice No.' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'totalAmountPaisa', label: 'Total Amount (₹)' },
  ];
  const sampleRows = [
    { invoiceNo: 'INV-001', customerName: 'Alice Smith', totalAmountPaisa: 157500 },
    { invoiceNo: 'INV-002', customerName: 'Bob Jones', totalAmountPaisa: 245000 },
  ];

  const xlsxResult = generateXlsx({
    sheetName: 'Tax Invoices',
    reportTitle: 'Statutory GST Invoices Report',
    columns: sampleColumns,
    rows: sampleRows,
    branding: {
      legalName: 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.',
      gstin: '32AAACZ1234K1Z5',
      period: 'FY 2026-27',
    },
  });

  // 1. Exact canonical MIME validation
  await t.test('XLSX-MIME-01: Canonical MIME is strictly application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', () => {
    assert.strictEqual(
      xlsxResult.mimeType,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'XLSX export must return canonical OpenXML spreadsheet MIME'
    );
    assert.notStrictEqual(
      xlsxResult.mimeType,
      'application/vnd.ms-excel',
      'Legacy application/vnd.ms-excel MUST NOT be used for .xlsx'
    );
    assert.ok(xlsxResult.filename.endsWith('.xlsx'), 'Filename must have .xlsx extension');
  });

  // 2. Real ZIP-based OOXML binary package validation
  await t.test('XLSX-OOXML-02: Generated buffer is authentic ZIP-based OOXML package with valid signatures & parts', () => {
    const buf = xlsxResult.buffer;
    assert.ok(Buffer.isBuffer(buf), 'Export result must be a binary Buffer');
    assert.ok(buf.length > 500, 'Buffer must be non-empty valid ZIP file');

    // Check ZIP magic signature PK\x03\x04 (0x04034b50 LE)
    assert.strictEqual(buf[0], 0x50, 'Byte 0 must be P');
    assert.strictEqual(buf[1], 0x4B, 'Byte 1 must be K');
    assert.strictEqual(buf[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(buf[3], 0x04, 'Byte 3 must be 0x04');

    // Parse ZIP entries
    const entries = new Map();
    let offset = 0;
    while (offset < buf.length - 30) {
      const sig = buf.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;

      const compression = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataOffset = offset + 30 + nameLen + extraLen;
      const compData = buf.subarray(dataOffset, dataOffset + compSize);

      let data;
      if (compression === 8) {
        data = zlib.inflateRawSync(compData);
      } else {
        data = compData;
      }
      entries.set(name, data.toString('utf8'));
      offset = dataOffset + compSize;
    }

    // Must contain required OpenXML parts
    assert.ok(entries.has('[Content_Types].xml'), 'Must contain [Content_Types].xml');
    assert.ok(entries.has('_rels/.rels'), 'Must contain _rels/.rels');
    assert.ok(entries.has('xl/workbook.xml'), 'Must contain xl/workbook.xml');
    assert.ok(entries.has('xl/styles.xml'), 'Must contain xl/styles.xml');
    assert.ok(entries.has('xl/worksheets/sheet1.xml'), 'Must contain xl/worksheets/sheet1.xml (Metadata)');
    assert.ok(entries.has('xl/worksheets/sheet2.xml'), 'Must contain xl/worksheets/sheet2.xml (Data)');
    assert.ok(entries.has('xl/sharedStrings.xml'), 'Must contain xl/sharedStrings.xml');

    // Verify Content Types definition
    const contentTypes = entries.get('[Content_Types].xml');
    assert.ok(
      contentTypes.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'),
      'Content_Types must define main sheet part'
    );
    assert.ok(
      contentTypes.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'),
      'Content_Types must define worksheet parts'
    );

    // Verify Sheet 1 (Report Information metadata sheet)
    const sheet1 = entries.get('xl/worksheets/sheet1.xml');
    const sharedStrings = entries.get('xl/sharedStrings.xml');
    assert.ok(sheet1.length > 0, 'Sheet 1 must be present');
    assert.ok(sharedStrings.includes('Report Information') || entries.get('xl/workbook.xml').includes('Report Information'));

    // Verify Sheet 2 (Data sheet requirements from Stage 01)
    const sheet2 = entries.get('xl/worksheets/sheet2.xml');
    assert.ok(sheet2.includes('state="frozen"'), 'Must have freeze panes');
    assert.ok(sheet2.includes('<autoFilter'), 'Must have AutoFilter');
    assert.ok(sheet2.includes('<cols>'), 'Must have custom column widths');
    assert.ok(sheet2.includes('paperSize="9"'), 'Must specify A4 paperSize (9)');
    assert.ok(sheet2.includes('orientation="portrait"'), 'Must specify portrait orientation');
    assert.ok(sheet2.includes('<headerFooter>'), 'Must have headerFooter definition');
    assert.ok(sheet2.includes('&amp;P of &amp;N'), 'Must have page numbering');

    // Verify Styles (currency format ₹#,##0.00 and Times New Roman corporate font)
    const styles = entries.get('xl/styles.xml');
    assert.ok(styles.includes('₹#,##0.00'), 'Must include Indian Rupee currency format ₹#,##0.00');
    assert.ok(styles.includes('Times New Roman'), 'xl/styles.xml must specify Times New Roman corporate font');
    assert.ok(sheet2.includes('Times New Roman'), 'Worksheet headerFooter must specify Times New Roman font');
  });

  // 3. Official Document ID export filename validation
  await t.test('XLSX-DOCID-03: Export filename adheres strictly to officialDocumentId convention when present', () => {
    const withDocId = generateXlsx({
      officialDocumentId: 'DOC-GST-2026-00042',
      sheetName: 'Tax Invoices',
      reportTitle: 'Statutory GST Invoices Report',
      columns: sampleColumns,
      rows: sampleRows,
    });
    assert.strictEqual(withDocId.filename, 'DOC-GST-2026-00042.xlsx', 'Must use exact official document ID with .xlsx extension');

    const withoutDocId = generateXlsx({
      sheetName: 'Tax Invoices',
      reportTitle: 'Statutory GST Invoices Report',
      columns: sampleColumns,
      rows: sampleRows,
    });
    assert.match(withoutDocId.filename, /^statutory_gst_invoices_report_.*\.xlsx$/, 'Fallback format when officialDocumentId is omitted');
  });
});

test('STATUTORY AUDIT — GST-SERIAL-01 to GST-SERIAL-09 Invoice Number Rule 46(b) Immutability & Multi-Series Suite', async (t) => {
  const orgId = 'ORG-STATUTORY-TEST';
  const cafeId = 'CAFE-01';
  const fy = '2026-27';

  // In-memory store for TaxInvoice simulation
  const invoicesDb = new Map();

  t.mock.method(TaxInvoice, 'findOne', (query) => {
    return {
      sort: () => ({
        select: () => ({
          lean: async () => null,
        }),
      }),
      then: (resolve) => {
        const inv = invoicesDb.get(query.invoiceNumber);
        if (!inv) return resolve(null);
        return resolve({
          ...inv,
          save: async function () {
            invoicesDb.set(this.invoiceNumber, this);
            return this;
          },
        });
      },
    };
  });

  t.mock.method(auditService, 'recordAuditEvent', async () => {});

  // GST-SERIAL-01: Every generated serial number length strictly <= 16 characters
  await t.test('GST-SERIAL-01: Every generated serial number length strictly <= 16 characters', async () => {
    let atomicCounter = 0;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      atomicCounter += 1;
      return String(atomicCounter);
    });

    const singleRes = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });
    const multiRes1 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy, seriesPrefix: 'P' });
    const multiRes2 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy, seriesPrefix: 'POS' });

    assert.ok(singleRes.invoiceNumber.length <= 16, `Single series length ${singleRes.invoiceNumber.length} > 16`);
    assert.ok(multiRes1.invoiceNumber.length <= 16, `Multi series 'P' length ${multiRes1.invoiceNumber.length} > 16`);
    assert.ok(multiRes2.invoiceNumber.length <= 16, `Multi series 'POS' length ${multiRes2.invoiceNumber.length} > 16`);
  });

  // GST-SERIAL-02: Single-series unique within FY
  await t.test('GST-SERIAL-02: Single-series invoice numbers are unique within the financial year', async () => {
    let currentSeq = 0;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      currentSeq += 1;
      return String(currentSeq);
    });

    const inv1 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });
    const inv2 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });

    assert.strictEqual(inv1.invoiceNumber, 'C01/2627/00001');
    assert.strictEqual(inv2.invoiceNumber, 'C01/2627/00002');
    assert.strictEqual(inv1.invoiceNumber.length, 14);
    assert.strictEqual(inv2.invoiceNumber.length, 14);
    assert.notStrictEqual(inv1.invoiceNumber, inv2.invoiceNumber);
  });

  // GST-SERIAL-03: Multiple invoice series operate independently and remain unique for financial year
  await t.test('GST-SERIAL-03: Multiple invoice series operate independently and remain unique for financial year', async () => {
    const seriesCounters = {
      'GST_INV:2026-27:CAFE-01:P': 10,
      'GST_INV:2026-27:CAFE-01:POS': 5,
    };

    t.mock.method(SequenceCounter, 'generateId', async (opts) => {
      const k = opts.sequenceKey;
      seriesCounters[k] = (seriesCounters[k] || 0) + 1;
      return String(seriesCounters[k]);
    });

    const pos1 = await allocateInvoiceNumber({
      organisationId: orgId,
      cafeId,
      financialYear: fy,
      seriesPrefix: 'P',
    });
    const pos2 = await allocateInvoiceNumber({
      organisationId: orgId,
      cafeId,
      financialYear: fy,
      seriesPrefix: 'POS',
    });

    assert.strictEqual(pos1.invoiceNumber, 'P/C01/2627/00011');
    assert.strictEqual(pos2.invoiceNumber, 'POS/C01/2627/006');
    assert.strictEqual(pos1.invoiceNumber.length, 16);
    assert.strictEqual(pos2.invoiceNumber.length, 16);
    assert.strictEqual(pos1.seriesPrefix, 'P');
    assert.strictEqual(pos2.seriesPrefix, 'POS');
  });

  // GST-SERIAL-04: Financial-year rollover starts configured new sequence safely
  await t.test('GST-SERIAL-04: Financial-year rollover starts new sequence safely and isolates FY counters', async () => {
    const counters = {
      'GST_INV:2026-27:CAFE-01': 999,
      'GST_INV:2027-28:CAFE-01': 0,
    };

    t.mock.method(SequenceCounter, 'generateId', async (opts) => {
      const k = opts.sequenceKey;
      counters[k] = (counters[k] || 0) + 1;
      return String(counters[k]);
    });

    const invFY1 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: '2026-27' });
    const invFY2 = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: '2027-28' });

    assert.strictEqual(invFY1.invoiceNumber, 'C01/2627/01000');
    assert.strictEqual(invFY2.invoiceNumber, 'C01/2728/00001', 'New financial year starts at 00001');
    assert.strictEqual(invFY1.invoiceNumber.length, 14);
    assert.strictEqual(invFY2.invoiceNumber.length, 14);
  });

  // GST-SERIAL-05: Cancelled invoice retains its allocated serial number and history
  await t.test('GST-SERIAL-05: Cancelled invoice retains its allocated serial number and history', async () => {
    let currentSeq = 50;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      currentSeq += 1;
      return String(currentSeq);
    });

    const allocated = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });
    assert.strictEqual(allocated.invoiceNumber, 'C01/2627/00051');

    // Store in mock DB
    invoicesDb.set(allocated.invoiceNumber, {
      invoiceNumber: allocated.invoiceNumber,
      sequenceNumber: allocated.sequenceNumber,
      organisationId: orgId,
      cafeId,
      financialYear: fy,
      status: 'ISSUED',
      taxSummary: { grandTotalPaisa: 125000 },
    });

    // Cancel invoice
    const cancelResult = await cancelTaxInvoice({
      invoiceNumber: allocated.invoiceNumber,
      organisationId: orgId,
      cafeId,
      cancellationReason: 'Guest walked out before delivery',
      actorUserId: 'USR-CASHIER-01',
    });

    assert.strictEqual(cancelResult.status, 'CANCELLED');
    assert.strictEqual(cancelResult.invoiceNumber, 'C01/2627/00051', 'Must retain original allocated number');
    const persisted = invoicesDb.get('C01/2627/00051');
    assert.strictEqual(persisted.status, 'CANCELLED');
    assert.strictEqual(persisted.cancellationReason, 'Guest walked out before delivery');
    assert.ok(persisted.cancelledAt instanceof Date);
  });

  // GST-SERIAL-06: Cancelled serial number is never reassigned or recycled
  await t.test('GST-SERIAL-06: Cancelled serial number is never reassigned or recycled to make sequence appear gapless', async () => {
    let currentSeq = 51;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      currentSeq += 1;
      return String(currentSeq);
    });

    const nextAllocated = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });
    assert.strictEqual(nextAllocated.sequenceNumber, 52);
    assert.strictEqual(nextAllocated.invoiceNumber, 'C01/2627/00052');
    assert.notStrictEqual(nextAllocated.invoiceNumber, 'C01/2627/00051', 'Cancelled serial must NEVER be reassigned');
  });

  // GST-SERIAL-07: Concurrency safety: simultaneous allocation produces zero duplicate serial numbers
  await t.test('GST-SERIAL-07: Concurrency safety: simultaneous allocation produces zero duplicate serial numbers', async () => {
    const allocatedNumbers = new Set();
    let seq = 200;
    t.mock.method(SequenceCounter, 'generateId', async () => {
      const val = ++seq;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
      return String(val);
    });

    const batch = Array.from({ length: 12 }, () =>
      allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy })
    );
    const results = await Promise.all(batch);

    for (const r of results) {
      assert.strictEqual(allocatedNumbers.has(r.invoiceNumber), false, `Collision detected on ${r.invoiceNumber}`);
      allocatedNumbers.add(r.invoiceNumber);
    }
    assert.strictEqual(allocatedNumbers.size, 12);
  });

  // GST-SERIAL-08: Serial contains only permitted statutory characters [A-Za-z0-9-/]
  await t.test('GST-SERIAL-08: Serial contains only permitted statutory characters [A-Za-z0-9-/]', async () => {
    let counter = 800;
    t.mock.method(SequenceCounter, 'generateId', async () => String(++counter));

    const single = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy });
    const multi = await allocateInvoiceNumber({ organisationId: orgId, cafeId, financialYear: fy, seriesPrefix: 'P' });

    assert.match(single.invoiceNumber, /^[A-Za-z0-9\-\/]+$/, 'Must contain only letters, numbers, hyphens, and slashes');
    assert.match(multi.invoiceNumber, /^[A-Za-z0-9\-\/]+$/, 'Must contain only letters, numbers, hyphens, and slashes');
    assert.ok(single.invoiceNumber.length <= 16);
    assert.ok(multi.invoiceNumber.length <= 16);
  });

  // GST-SERIAL-09: Rejection of configurations exceeding 16 statutory characters (no silent truncation)
  await t.test('GST-SERIAL-09: Rejection of configurations exceeding 16 statutory characters without silent truncation', async () => {
    // Attempting a series prefix that exceeds 16 chars with prefix overhead
    await assert.rejects(
      async () => {
        await allocateInvoiceNumber({
          organisationId: orgId,
          cafeId,
          financialYear: fy,
          seriesPrefix: 'TOOLONGPREFIX', // 13 chars + / + C01(3) + / + 2627(4) + / = 24 chars > 16
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'INVOICE_CONFIG_EXCEEDS_MAX_LENGTH');
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );

    // Attempting invalid characters in series prefix
    await assert.rejects(
      async () => {
        await allocateInvoiceNumber({
          organisationId: orgId,
          cafeId,
          financialYear: fy,
          seriesPrefix: 'SERIES@#',
        });
      },
      (err) => {
        assert.strictEqual(err.code, 'INVALID_SERIES_PREFIX');
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });
});
