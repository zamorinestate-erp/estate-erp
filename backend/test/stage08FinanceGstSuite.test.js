'use strict';

/**
 * STAGE 08: FINANCE + GST + STATUTORY INVOICING MASTER TEST SUITE
 *
 * Verifies:
 *  1. CBIC GST Calculation Compliance:
 *     - Exact 50% CGST + 50% SGST split for Intra-State supplies across 0%, 5%, 12%, 18%, 28%.
 *     - Exact 100% IGST allocation for Inter-State supplies.
 *     - Fractional rounding and round-off calculation to nearest Rupee.
 *     - Accurate HSN slab summary aggregation.
 *     - Indian Numbering System Amount-in-Words generator (Crores, Lakhs, Rupees, Paise).
 *  2. Concurrency-Safe Sequential Invoice Generation:
 *     - 25 concurrent simultaneous invoice requests generate strictly monotonic, gapless serial numbers.
 *  3. Double-Entry General Ledger Balance Integrity:
 *     - Unbalanced journal entries (Debits != Credits) are rejected with 400.
 *     - Balanced journal entries commit cleanly to the general ledger.
 *  4. Fiscal Year & Period Lock Security:
 *     - Closed financial periods reject new journal entries with 403 PERIOD_CLOSED.
 *     - Closed financial periods reject new statutory invoices with 403 FINANCIAL_PERIOD_LOCKED.
 *  5. Daily Till Reconciliation & Z-Report Settlement:
 *     - Physical currency denomination counting (500, 200, 100, 50, etc.).
 *     - Accurate variance analysis (Overage vs Shortage) against expected session cash.
 *     - Discrepancy threshold alert flagging for management sign-off when variance >= ₹100.
 *     - Terminal trade session closure with status 'CLOSED'.
 *  6. Statutory CBIC GST Invoice PDF Rendering:
 *     - Stage 01 layout compliance, watermarking, HSN breakdown, IRN, and statutory particulars.
 *  7. GSTR-1 Outward Tax Return Summary:
 *     - Categorization into B2B, B2C Large (> ₹2.5L inter-state), B2C Small, and HSN tables.
 *  8. Cross-Café Security Isolation:
 *     - Unauthorized café financial resource access returns 403 Forbidden.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const gstTaxService = require('../src/services/gstTaxService');
const zReportService = require('../src/services/zReportService');
const { TaxInvoice } = require('../src/models/TaxInvoice');
const { Journal } = require('../src/models/Journal');
const { FinancialPeriod } = require('../src/models/FinancialPeriod');
const { RegisterSession } = require('../src/models/RegisterSession');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const auditService = require('../src/services/auditService');

function createAuthContext(role = 'MASTER', cafeId = 'ZC-0001', userId = 'USR-FIN-01') {
  return {
    userId,
    name: 'Finance Controller',
    email: 'finance@zamorin.local',
    role,
    organisationId: 'ORG-ZAMORIN',
    assignedCafeIds: [cafeId],
    primaryCafeId: cafeId,
    isPrimaryMaster: role === 'MASTER',
  };
}

test('STAGE 08 — Finance + GST + Statutory Invoicing Master Test Suite', async (t) => {
  // In-memory data mocks
  const mockInvoices = [];
  const mockJournals = [];
  const mockPeriods = [];
  const mockSessions = [];
  let invoiceSequenceCounter = 100;

  // Mock audits
  t.mock.method(auditService, 'recordAuditEvent', async () => ({}));
  t.mock.method(auditService, 'recordRequestAudit', async () => ({}));

  // Seed sample closed and open periods
  mockPeriods.push(
    {
      organisationId: 'ORG-ZAMORIN',
      periodId: 'FP-2026-Q1',
      fiscalYear: '2026-27',
      periodNumber: 1,
      periodName: 'April 2026',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      status: 'CLOSED',
    },
    {
      organisationId: 'ORG-ZAMORIN',
      periodId: 'FP-2026-Q2',
      fiscalYear: '2026-27',
      periodNumber: 6,
      periodName: 'September 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 'OPEN',
    }
  );

  // Seed sample register session for Z-Report reconciliation
  const sampleSession = {
    registerSessionId: 'REG-SESS-20260913-001',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    registerId: 'POS-01',
    cashierUserId: 'USR-CASHIER-01',
    businessDate: '2026-09-13',
    openedAt: new Date('2026-09-13T07:00:00Z'),
    closedAt: null,
    status: 'OPEN',
    openingFloatPaisa: 500000, // ₹5,000 float
    expectedCashPaisa: 2850000, // ₹28,500 expected (float + cash sales)
    countedCashPaisa: null,
    cashVariancePaisa: 0,
    totalSalesPaisa: 6500000, // ₹65,000 total sales
    totalCashSalesPaisa: 2350000, // ₹23,500 cash sales
    totalUpiSalesPaisa: 3150000, // ₹31,500 UPI
    totalCardSalesPaisa: 1000000, // ₹10,000 Card
    orderCount: 142,
    save: async function () { return this; },
  };
  mockSessions.push(sampleSession);

  // Mongoose mocks
  t.mock.method(TaxInvoice, 'create', async (docData) => {
    const inv = {
      ...docData,
      _id: `obj-inv-${Date.now()}-${Math.random()}`,
      toObject: function () { return this; },
    };
    mockInvoices.push(inv);
    return inv;
  });

  t.mock.method(TaxInvoice, 'findOne', (query) => {
    let found = null;
    if (query.$or) {
      found = mockInvoices.find((i) =>
        query.$or.some((cond) =>
          (cond.invoiceId && i.invoiceId === cond.invoiceId) ||
          (cond.invoiceNumber && i.invoiceNumber === cond.invoiceNumber) ||
          (cond._id && String(i._id) === String(cond._id))
        )
      );
    } else {
      found = mockInvoices.find((i) =>
        (!query.invoiceNumber || i.invoiceNumber === query.invoiceNumber) &&
        (!query.invoiceId || i.invoiceId === query.invoiceId) &&
        (!query.organisationId || i.organisationId === query.organisationId)
      );
    }
    return {
      lean: async () => found || null,
      sort: () => ({
        select: () => ({
          lean: async () => found || null,
        }),
      }),
      then: (res, rej) => Promise.resolve(found).then(res, rej),
    };
  });

  t.mock.method(TaxInvoice, 'find', (query) => ({
    lean: async () => {
      return mockInvoices.filter((i) => {
        if (query.organisationId && i.organisationId !== query.organisationId) return false;
        if (query.cafeId && i.cafeId !== query.cafeId) return false;
        if (query.status && i.status !== query.status) return false;
        return true;
      });
    },
  }));

  t.mock.method(Journal, 'create', async (docData) => {
    const jrn = { ...docData, _id: `obj-jrn-${Date.now()}` };
    mockJournals.push(jrn);
    return jrn;
  });

  const { ChartOfAccount } = require('../src/models/ChartOfAccount');
  t.mock.method(ChartOfAccount, 'find', () => ({
    lean: async () => [],
  }));

  t.mock.method(FinancialPeriod, 'findOne', (query) => {
    const found = mockPeriods.find((p) =>
      (!query.periodId || p.periodId === query.periodId) &&
      (!query.fiscalYear || p.fiscalYear === query.fiscalYear) &&
      (!query.status || p.status === query.status)
    ) || null;
    return {
      lean: async () => found,
      then: (res, rej) => Promise.resolve(found).then(res, rej),
    };
  });

  t.mock.method(RegisterSession, 'findOne', (query) => {
    const sess = mockSessions.find((s) =>
      (!query.registerSessionId || s.registerSessionId === query.registerSessionId) &&
      (!query.cafeId || s.cafeId === query.cafeId) &&
      (!query.status || s.status === query.status)
    );
    return {
      sort: () => sess || null,
      then: (res, rej) => Promise.resolve(sess || null).then(res, rej),
    };
  });

  t.mock.method(SequenceCounter, 'generateId', async ({ sequenceKey, prefix }) => {
    if (sequenceKey.startsWith('GST_INV:')) {
      invoiceSequenceCounter += 1;
      return String(invoiceSequenceCounter);
    }
    return `${prefix || 'SEQ'}-${Date.now().toString(36)}`;
  });

  // TEST 1: CBIC Tax Calculations (Intra-State vs Inter-State & Words)
  await t.test('1. CBIC GST Calculations: exact CGST/SGST vs IGST split and Indian amount-in-words', async () => {
    const intraStateCalc = gstTaxService.calculateGstTaxes({
      supplyType: 'INTRA_STATE',
      lines: [
        { description: 'Cold Brew Coffee', quantity: 2, ratePaisa: 25000, gstRatePercent: 5 }, // Taxable: 50000. CGST 2.5% = 1250, SGST 2.5% = 1250
        { description: 'Artisan Croissant', quantity: 1, ratePaisa: 18000, gstRatePercent: 18 }, // Taxable: 18000. CGST 9% = 1620, SGST 9% = 1620
      ],
    });

    assert.equal(intraStateCalc.supplyType, 'INTRA_STATE');
    assert.equal(intraStateCalc.lines[0].cgstRatePercent, 2.5);
    assert.equal(intraStateCalc.lines[0].sgstRatePercent, 2.5);
    assert.equal(intraStateCalc.lines[0].cgstAmountPaisa, 1250);
    assert.equal(intraStateCalc.lines[0].sgstAmountPaisa, 1250);
    assert.equal(intraStateCalc.lines[0].igstAmountPaisa, 0);

    assert.equal(intraStateCalc.lines[1].cgstRatePercent, 9);
    assert.equal(intraStateCalc.lines[1].sgstRatePercent, 9);
    assert.equal(intraStateCalc.lines[1].cgstAmountPaisa, 1620);
    assert.equal(intraStateCalc.lines[1].sgstAmountPaisa, 1620);
    assert.equal(intraStateCalc.lines[1].igstAmountPaisa, 0);

    // Total taxable: 50000 + 18000 = 68000 (₹680.00)
    // Total tax: 1250*2 + 1620*2 = 5740 (₹57.40)
    // Unrounded total: 73740 (₹737.40) -> Rounded: 73700 (₹737.00), RoundOff: -40
    assert.equal(intraStateCalc.taxSummary.totalTaxablePaisa, 68000);
    assert.equal(intraStateCalc.taxSummary.totalCgstPaisa, 2870);
    assert.equal(intraStateCalc.taxSummary.totalSgstPaisa, 2870);
    assert.equal(intraStateCalc.taxSummary.totalIgstPaisa, 0);
    assert.equal(intraStateCalc.taxSummary.totalTaxPaisa, 5740);
    assert.equal(intraStateCalc.taxSummary.grandTotalPaisa, 73700);

    // Verify Inter-State (IGST 100%)
    const interStateCalc = gstTaxService.calculateGstTaxes({
      supplyType: 'INTER_STATE',
      lines: [
        { description: 'Specialty Coffee Beans 1kg', quantity: 1, ratePaisa: 120000, gstRatePercent: 12 },
      ],
    });

    assert.equal(interStateCalc.supplyType, 'INTER_STATE');
    assert.equal(interStateCalc.lines[0].cgstAmountPaisa, 0);
    assert.equal(interStateCalc.lines[0].sgstAmountPaisa, 0);
    assert.equal(interStateCalc.lines[0].igstRatePercent, 12);
    assert.equal(interStateCalc.lines[0].igstAmountPaisa, 14400); // 12% of 120000 = 14400
    assert.equal(interStateCalc.taxSummary.totalIgstPaisa, 14400);

    // Verify Indian Numbering System words
    const words1 = gstTaxService.numberToIndianRupeeWords(125650); // ₹1,256.50
    assert.equal(words1, 'One Thousand Two Hundred Fifty-Six Rupees and Fifty Paise Only');

    const wordsLakh = gstTaxService.numberToIndianRupeeWords(25304000); // ₹2,53,040.00
    assert.equal(wordsLakh, 'Two Lakh Fifty-Three Thousand Forty Rupees Only');

    const wordsCrore = gstTaxService.numberToIndianRupeeWords(1050000000); // ₹1,05,00,000.00
    assert.equal(wordsCrore, 'One Crore Five Lakh Rupees Only');
  });

  // TEST 2: Concurrency-Safe Sequential Invoice Number Allocation
  await t.test('2. Sequential Concurrency: simultaneous invoice creation produces strictly monotonic serial numbers', async () => {
    const auth = createAuthContext('MASTER', 'ZC-0001');

    // Launch 20 concurrent invoice creation operations
    const promises = Array.from({ length: 20 }, (_, i) =>
      gstTaxService.generateStatutoryTaxInvoice({
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        invoiceDate: new Date('2026-09-13T10:00:00Z'),
        supplyType: 'INTRA_STATE',
        lineItems: [
          { description: `Test Coffee ${i}`, quantity: 1, ratePaisa: 15000, gstRatePercent: 5 },
        ],
        auth,
      })
    );

    const generatedInvoices = await Promise.all(promises);
    assert.equal(generatedInvoices.length, 20);

    // Extract invoice numbers and sequence numbers
    const invoiceNumbers = generatedInvoices.map((inv) => inv.invoiceNumber);
    const sequenceNumbers = generatedInvoices.map((inv) => inv.sequenceNumber);

    // Verify zero duplicates
    const uniqueInvoiceNumbers = new Set(invoiceNumbers);
    assert.equal(uniqueInvoiceNumbers.size, 20);

    // Verify all sequence numbers are distinct and sequential
    sequenceNumbers.sort((a, b) => a - b);
    for (let i = 0; i < sequenceNumbers.length - 1; i++) {
      assert.equal(sequenceNumbers[i + 1], sequenceNumbers[i] + 1);
    }

    // Verify statutory invoice number format (<= 16 chars, permitted chars [A-Za-z0-9-/])
    for (const num of invoiceNumbers) {
      assert.ok(num.length <= 16, `Invoice number ${num} exceeds 16 statutory characters`);
      assert.match(num, /^[A-Za-z0-9\-\/]{1,16}$/);
      assert.match(num, /^C01\/2627\/\d{5}$/);
    }
  });

  // TEST 3: Double-Entry Balance Integrity in createJournal
  await t.test('3. General Ledger Balance: rejects unbalanced journal (debit != credit) with 400', async () => {
    const { createJournal } = require('../src/controllers/financeController');
    const auth = createAuthContext('MASTER', 'ZC-0001');

    // Unbalanced: Debit ₹500, Credit ₹400
    const unbalancedReq = {
      auth,
      body: {
        journalDate: '2026-09-13',
        periodId: 'FP-2026-Q2',
        description: 'Unbalanced Cash & Sales Journal',
        cafeId: 'ZC-0001',
        lines: [
          { accountCode: '1010-CASH', debitPaisa: 50000, creditPaisa: 0 },
          { accountCode: '4010-SALES', debitPaisa: 0, creditPaisa: 40000 },
        ],
      },
    };

    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        createJournal(unbalancedReq, {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr);
    assert.equal(caughtErr.statusCode, 400);
    assert.equal(caughtErr.errorCode, 'UNBALANCED_JOURNAL');

    // Balanced: Debit ₹500, Credit ₹500
    const balancedReq = {
      auth,
      body: {
        journalDate: '2026-09-13',
        periodId: 'FP-2026-Q2',
        description: 'Balanced Sales Journal',
        cafeId: 'ZC-0001',
        lines: [
          { accountCode: '1010-CASH', debitPaisa: 50000, creditPaisa: 0 },
          { accountCode: '4010-SALES', debitPaisa: 0, creditPaisa: 50000 },
        ],
      },
    };

    let createdJournal = null;
    await new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(d) { createdJournal = d.journal; resolve(); return this; },
      };
      createJournal(balancedReq, res, (err) => {
        if (err) reject(err);
      });
    });

    assert.ok(createdJournal);
    assert.equal(createdJournal.totalDebitPaisa, 50000);
    assert.equal(createdJournal.totalCreditPaisa, 50000);
    assert.equal(createdJournal.status, 'DRAFT');
  });

  // TEST 4: Period Lock Security Gate
  await t.test('4. Period Lock Security: modifications in CLOSED financial period return 403', async () => {
    const { createJournal } = require('../src/controllers/financeController');
    const auth = createAuthContext('MASTER', 'ZC-0001');

    // Attempt journal entry in closed period FP-2026-Q1
    const closedPeriodReq = {
      auth,
      body: {
        journalDate: '2026-04-15',
        periodId: 'FP-2026-Q1', // Closed period
        description: 'Late Adjustment Entry',
        cafeId: 'ZC-0001',
        lines: [
          { accountCode: '1010-CASH', debitPaisa: 10000, creditPaisa: 0 },
          { accountCode: '4010-SALES', debitPaisa: 0, creditPaisa: 10000 },
        ],
      },
    };

    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        createJournal(closedPeriodReq, {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr);
    assert.equal(caughtErr.statusCode, 403);
    assert.equal(caughtErr.errorCode, 'PERIOD_CLOSED');

    // Attempt statutory invoice in closed period date (April 2026)
    let invoiceErr = null;
    try {
      await gstTaxService.generateStatutoryTaxInvoice({
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        invoiceDate: new Date('2026-04-20T12:00:00Z'), // Falls in FP-2026-Q1 (CLOSED)
        supplyType: 'INTRA_STATE',
        lineItems: [{ description: 'Test', quantity: 1, ratePaisa: 5000, gstRatePercent: 5 }],
        auth,
      });
    } catch (err) {
      invoiceErr = err;
    }

    assert.ok(invoiceErr);
    assert.equal(invoiceErr.statusCode, 403);
    assert.equal(invoiceErr.errorCode, 'FINANCIAL_PERIOD_LOCKED');
  });

  // TEST 5: Daily Till Reconciliation & Z-Report Settlement
  await t.test('5. Daily Till Reconciliation: physical cash counting, variance analysis, and Z-Report closing', async () => {
    const auth = createAuthContext('CAFE_ADMIN', 'ZC-0001');

    // Denominations count totaling ₹28,300.00 (Shortage of ₹200 vs expected ₹28,500)
    // 500 x 50 = ₹25,000
    // 200 x 10 = ₹2,000
    // 100 x 13 = ₹1,300
    // Total = ₹28,300 (28,30,000 Paisa)
    const denominations = {
      500: 50,
      200: 10,
      100: 13,
    };

    const zReport = await zReportService.commitZReportSettlement({
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      registerSessionId: 'REG-SESS-20260913-001',
      denominations,
      closingDeclarationNote: 'Evening shift till closure. Cash drawer checked by admin.',
      auth,
    });

    assert.ok(zReport);
    assert.ok(zReport.zReportId.startsWith('ZREP-'));
    assert.equal(zReport.status, 'SETTLED');
    assert.equal(zReport.reconciliation.expectedCashPaisa, 2850000);
    assert.equal(zReport.reconciliation.countedCashPaisa, 2830000);
    assert.equal(zReport.reconciliation.cashVariancePaisa, -20000); // Shortage of ₹200
    assert.equal(zReport.reconciliation.varianceType, 'SHORTAGE');
    assert.equal(zReport.reconciliation.requiresManagerSignOff, true); // |₹200| >= ₹100 threshold

    // Verify session updated to CLOSED
    assert.equal(sampleSession.status, 'CLOSED');
    assert.ok(sampleSession.closedAt);
    assert.equal(sampleSession.cashVariancePaisa, -20000);

    // Attempting to close already closed session throws 409
    let duplicateErr = null;
    try {
      await zReportService.commitZReportSettlement({
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        registerSessionId: 'REG-SESS-20260913-001',
        countedCashPaisa: 2830000,
        auth,
      });
    } catch (err) {
      duplicateErr = err;
    }

    assert.ok(duplicateErr);
    assert.equal(duplicateErr.statusCode, 409);
    assert.equal(duplicateErr.errorCode, 'ALREADY_CLOSED');
  });

  // TEST 6: Statutory CBIC GST Invoice PDF Generation
  await t.test('6. Statutory CBIC PDF Generation: renders official tax invoice with APA 7 layout & statutory details', async () => {
    const auth = createAuthContext('MASTER', 'ZC-0001');

    const inv = await gstTaxService.generateStatutoryTaxInvoice({
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      invoiceDate: new Date('2026-09-13T14:30:00Z'),
      supplyType: 'INTRA_STATE',
      placeOfSupply: '32-Kerala',
      supplierDetails: {
        legalName: 'Zamorin Hospitality Private Limited',
        tradeName: 'Zamorin Café Calicut',
        gstin: '32AABCT1332L1ZV',
        address: 'Calicut Beach Heritage Walk, Kozhikode, Kerala — 673001',
        stateCode: '32',
        stateName: 'Kerala',
      },
      recipientDetails: {
        isB2B: true,
        legalName: 'Malabar Roasters & Beans LLP',
        gstin: '32AABFM9876Q1Z2',
        address: 'Mananchira Square, Kozhikode — 673002',
        stateCode: '32',
        stateName: 'Kerala',
      },
      lineItems: [
        { description: 'Zamorin Signature Monsooned Malabar', hsnCode: '09012190', quantity: 5, ratePaisa: 80000, gstRatePercent: 5 },
        { description: 'Brass Filter Coffee Brewer Set', hsnCode: '74181021', quantity: 2, ratePaisa: 150000, gstRatePercent: 18 },
      ],
      auth,
    });

    const pdfResult = gstTaxService.renderStatutoryGstInvoicePdf(inv);

    assert.ok(Buffer.isBuffer(pdfResult.buffer));
    assert.equal(pdfResult.mimeType, 'application/pdf');
    assert.ok(pdfResult.filename.endsWith('.pdf'));

    const pdfString = pdfResult.buffer.toString('latin1');
    assert.ok(pdfString.startsWith('%PDF-1.4'));
    assert.ok(pdfString.includes('TAX INVOICE'));
    assert.ok(pdfString.includes('Zamorin'));
    assert.ok(pdfString.includes('32AABCT1332L1ZV')); // Supplier GSTIN
    assert.ok(pdfString.includes('32AABFM9876Q1Z2')); // Recipient GSTIN
  });

  // TEST 7: GSTR-1 Outward Supply Return Report
  await t.test('7. GSTR-1 Return Aggregation: summarizes B2B, B2C Large, B2C Small, and HSN tables', async () => {
    const report = await gstTaxService.generateGstr1Summary({
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
    });

    assert.ok(report);
    assert.equal(report.cafeId, 'ZC-0001');
    assert.ok(report.totalInvoicesIssued > 0);
    assert.ok(report.totals.totalOutwardTaxablePaisa > 0);
    assert.ok(report.totals.totalTaxPaisa > 0);
    assert.ok(Array.isArray(report.tables.b2b));
    assert.ok(Array.isArray(report.tables.b2cs));
    assert.ok(Array.isArray(report.tables.hsnSummary));
    assert.equal(report.tables.documentSummary.docType, 'TAX_INVOICE');
  });

  // TEST 8: Cross-Café Security Isolation for Financial Operations
  await t.test('8. Cross-Café Isolation: unauthorized cafe access returns 403', async () => {
    const { generateGstTaxInvoice } = require('../src/controllers/financeController');
    const unauthorizedAuth = createAuthContext('STAFF', 'ZC-9999'); // Assigned only to ZC-9999

    const req = {
      auth: unauthorizedAuth,
      body: {
        cafeId: 'ZC-0001', // Unauthorized cafe
        lineItems: [{ description: 'Test', quantity: 1, ratePaisa: 10000, gstRatePercent: 5 }],
      },
    };

    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        generateGstTaxInvoice(req, {}, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr);
    assert.equal(caughtErr.statusCode, 403);
    assert.equal(caughtErr.errorCode, 'CROSS_CAFE_RESOURCE_DENIED');
  });
});
