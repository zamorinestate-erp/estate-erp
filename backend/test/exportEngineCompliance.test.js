'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — EXPORT ENGINE & COMPANY IDENTITY COMPLIANCE TESTS
 * ============================================================================
 * Replaces EXPORT_ENGINE_COMPANY_IDENTITY_MASTER_STANDARD.md with automated
 * code-first verification of:
 * 1. Company / Organisation Identity Master resolution (Sections 364–370).
 * 2. Two-tier resolution (Head Office vs Outlet scoped identity, Section 368).
 * 3. CSV formula injection neutralization (RFC 4180 / CWE-1236, Sections 65-66).
 * 4. Authoritative binary PDF 1.4 generation compliance (Sections 40-42).
 * 5. Excel OpenXML (.xlsx) package integrity (Section 51).
 * 6. Audit trail & Run ID determinism.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { CompanyIdentityService } = require('../src/services/companyIdentityService');
const {
  sanitizeCsvValue,
  generateCsv,
  generatePdf,
  generateXlsx
} = require('../src/utils/exportGenerators');

describe('Universal Export Engine & Company Identity Master Compliance', () => {

  test('SEC-366: Resolves mandatory company identity fields from master', async () => {
    const branding = await CompanyIdentityService.resolveExportBranding({
      cafeId: null,
      sensitivityLevel: 'INTERNAL'
    });

    assert.ok(branding, 'Export branding object must resolve');
    assert.ok(branding.legalName, 'Legal name must be present');
    assert.strictEqual(branding.legalName, 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.');
    assert.ok(branding.brandName, 'Brand name must be present');
    assert.strictEqual(branding.brandName, 'Zamorin Café');

    assert.ok(branding.gstin, 'GSTIN must be resolved');
    assert.ok(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(branding.gstin), 'GSTIN must conform to statutory format');

    assert.ok(branding.fssai, 'FSSAI number must be resolved');
    assert.ok(/^\d{14}$/.test(branding.fssai), 'FSSAI must be a 14-digit statutory license number');

    assert.ok(branding.address, 'Registered address must be resolved');
    assert.ok(branding.contact, 'Contact details must be resolved');
    assert.ok(branding.contact.email, 'Contact email must be present');
    assert.ok(branding.contact.phone, 'Contact phone must be present');
    assert.ok(branding.logoSvg, 'Vector logos must be resolved');
    assert.ok(branding.logoSvg.includes('<svg'), 'Primary logo SVG must be valid SVG');
  });

  test('SEC-368: Two-tier resolution differentiates outlet vs organisation scope', async () => {
    const globalBranding = await CompanyIdentityService.resolveExportBranding({
      cafeId: null
    });
    assert.strictEqual(globalBranding.isOutletScoped, false);

    const outletBranding = await CompanyIdentityService.resolveExportBranding({
      cafeId: 'CAFE-NORTH'
    });
    assert.strictEqual(outletBranding.isOutletScoped, true);
  });

  test('SEC-197 / CWE-1236: CSV Formula Injection Neutralization', () => {
    // Dangerous spreadsheet prefixes with quotes
    assert.strictEqual(sanitizeCsvValue('=CMD|"/C calc"!A0'), `"'=CMD|""/C calc""!A0"`);
    // Dangerous numeric / mathematical formula prefix
    assert.strictEqual(sanitizeCsvValue('+12345'), '\'+12345');
    assert.strictEqual(sanitizeCsvValue('-1000'), '\'-1000');
    assert.strictEqual(sanitizeCsvValue('@SUM(A1:A10)'), '\'@SUM(A1:A10)');
    assert.strictEqual(sanitizeCsvValue('\tTAB_PREFIX'), '\'\tTAB_PREFIX');

    // Full-width Unicode formula prefixes
    assert.strictEqual(sanitizeCsvValue('\uFF1D1+1'), '\'＝1+1');
    assert.strictEqual(sanitizeCsvValue('\uFF0B50'), '\'＋50');

    // Safe regular strings
    assert.strictEqual(sanitizeCsvValue('Cappuccino Grande'), 'Cappuccino Grande');
    assert.strictEqual(sanitizeCsvValue('Normal text, with comma'), '"Normal text, with comma"');
    assert.strictEqual(sanitizeCsvValue(null), '');
    assert.strictEqual(sanitizeCsvValue(undefined), '');
  });

  test('SEC-65: CSV generation includes compliant header, sanitized data, and Run ID', () => {
    const columns = [
      { key: 'item', label: 'Item Name' },
      { key: 'price', label: 'Price' },
      { key: 'formulaField', label: 'Formula' }
    ];
    const rows = [
      { item: 'Cold Brew', price: '220.00', formulaField: '=HYPERLINK("http://evil.com")' },
      { item: 'Espresso', price: '150.00', formulaField: 'Safe Value' }
    ];

    const result = generateCsv({
      columns,
      rows,
      reportTitle: 'Daily Sales Test'
    });

    assert.ok(result.csv, 'CSV output must be non-empty');
    assert.ok(result.csv.includes('Item Name,Price,Formula'), 'Header row must be rendered');
    assert.ok(result.csv.includes('\'=HYPERLINK'), 'Formula injection must be neutralized');
    assert.ok(result.csv.includes('Espresso,150.00,Safe Value'), 'Safe row must be intact');
    assert.ok(/^RPT-RUN-\d{8}-\d{4}$/.test(result.runId), 'Run ID must match RPT-RUN-YYYYMMDD-XXXX format');
  });

  test('SEC-40-42: Authoritative binary PDF 1.4 generation compliance', () => {
    const pdfResult = generatePdf({
      reportTitle: 'Executive Financial Summary',
      subtitle: 'Audit Test Run',
      columns: [
        { key: 'metric', label: 'Metric', width: 200 },
        { key: 'val', label: 'Value', width: 100 }
      ],
      rows: [
        { metric: 'Total Gross Sales', val: 'INR 1,25,000' },
        { metric: 'Tax Collected', val: 'INR 6,250' }
      ],
      summaryMetrics: [
        { label: 'Settled Bills', value: '142' }
      ]
    });

    assert.ok(pdfResult && Buffer.isBuffer(pdfResult.buffer), 'PDF output must contain buffer');
    const pdfString = pdfResult.buffer.toString('binary');
    assert.ok(pdfString.startsWith('%PDF-1.4'), 'PDF must start with %PDF-1.4 magic header');
    assert.ok(pdfString.includes('%%EOF'), 'PDF must terminate with %%EOF trailer');
    assert.ok(pdfResult.filename.endsWith('.pdf'), 'PDF filename must end with .pdf');
  });

  test('SEC-51: Excel OpenXML (.xlsx) binary package integrity', () => {
    const xlsxResult = generateXlsx({
      reportTitle: 'Inventory Stock Level',
      sheets: [
        {
          name: 'Current Stock',
          columns: [{ key: 'sku', label: 'SKU' }, { key: 'qty', label: 'Quantity' }],
          rows: [{ sku: 'BEAN-ARABICA-01', qty: 50 }]
        }
      ]
    });

    assert.ok(xlsxResult && Buffer.isBuffer(xlsxResult.buffer), 'XLSX output must contain buffer');
    const xlsxBuffer = xlsxResult.buffer;
    // OpenXML (.xlsx) files are standard ZIP archives starting with PK\x03\x04
    assert.strictEqual(xlsxBuffer[0], 0x50, 'Byte 0 must be P (0x50)');
    assert.strictEqual(xlsxBuffer[1], 0x4b, 'Byte 1 must be K (0x4B)');
    assert.strictEqual(xlsxBuffer[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(xlsxBuffer[3], 0x04, 'Byte 3 must be 0x04');
    assert.ok(xlsxResult.filename.endsWith('.xlsx'), 'XLSX filename must end with .xlsx');
  });
});
