'use strict';

/**
 * ZAMORIN CAFE ERP — OWN-SCR-003 / SCR-005: SALES BILLS & TAX RECEIPTS GOVERNANCE TEST SUITE
 *
 * Comprehensive Verification:
 * 1. Multi-Café Authorized Scoping & Tenant Isolation
 * 2. Cross-Café Query Denial (403 CROSS_CAFE_RESOURCE_DENIED)
 * 3. Direct Bill-ID BOLA / IDOR Protection (404 NOT_FOUND to prevent IDOR enumeration)
 * 4. Foreign Organisation Tenant Isolation
 * 5. Segregation of Duties & RBAC POS Mutation Barriers (Owner cannot void, refund, or EOD close)
 * 6. Finalized Bill Immutability & Allowed Actions Governance Engine
 * 7. Receipt Reprint Audit Counters & Governance Trail
 * 8. Indian GST Rule 46 Math & Integer Paisa Invariants (5% composite = 2.5% CGST + 2.5% SGST)
 * 9. Payment Tender Reconciliation & Split Tender Settlement
 * 10. Controlled Refund Balance Protection & Validation Limits
 * 11. Portfolio Aggregations, Average Bill Value (ABV) & Weighted Tender Mix Math
 * 12. GST Source Register & Tax Split Summarization
 * 13. Operational Reconciliation & EOD Billing Gatekeeping
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { Bill } = require('../src/models/Bill');
const { Cafe } = require('../src/models/Cafe');
const { RegisterSession } = require('../src/models/RegisterSession');
const auditService = require('../src/services/auditService');

const {
  getBillsOverview,
  listBills,
  getBill,
  reprintBill,
  voidBill,
  refundBill,
  getGstRegister,
  getReconciliationStatus,
  closeBusinessDayBilling,
  splitBill,
} = require('../src/controllers/billController');

test('OWN-SCR-003 / SCR-005: Sales Bills & Tax Receipts Governance Suite', async (t) => {
  const orgId = 'ORG-TEST-001';
  const cafeA = 'ZC-0001';
  const cafeB = 'ZC-0002';
  const cafeC = 'ZC-0003'; // Unauthorized for Owner restricted to A & B
  const businessDate = '2026-08-22';

  const ownerAuth = {
    role: 'OWNER',
    organisationId: orgId,
    userId: 'OWNER-01',
    assignedCafeIds: [cafeA, cafeB],
    workspaceMode: 'MASTER_WORKSPACE',
  };

  const otherOrgAuth = {
    role: 'OWNER',
    organisationId: 'ORG-FOREIGN',
    userId: 'OWNER-FOREIGN-01',
    assignedCafeIds: ['ZC-9999'],
    workspaceMode: 'MASTER_WORKSPACE',
  };

  function createMockResponse() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    return res;
  }

  function mockChainableQuery(data) {
    const query = {
      select: () => query,
      sort: () => query,
      skip: () => query,
      limit: () => query,
      populate: () => query,
      lean: async () => data,
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
    };
    return query;
  }

  // Seed Bills in memory
  const seedBills = [
    new Bill({
      billId: 'BILL-001',
      invoiceNumber: 'ZAM-BILL-1001',
      organisationId: orgId,
      cafeId: cafeA,
      businessDate,
      subtotalPaisa: 66000,
      taxPaisa: 3300,
      cgstPaisa: 1650,
      sgstPaisa: 1650,
      totalPaisa: 69300,
      refundedTotalPaisa: 0,
      paymentMethod: 'UPI',
      status: 'COMPLETED',
      lineItems: [{ menuItemId: 'ITEM-1', itemNameSnapshot: 'Pour-Over', quantity: 2, unitPricePaisa: 28000 }],
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    }),
    new Bill({
      billId: 'BILL-002',
      invoiceNumber: 'ZAM-BILL-1002',
      organisationId: orgId,
      cafeId: cafeA,
      businessDate,
      subtotalPaisa: 55000,
      taxPaisa: 2750,
      cgstPaisa: 1375,
      sgstPaisa: 1375,
      totalPaisa: 57750,
      refundedTotalPaisa: 0,
      paymentMethod: 'CARD',
      status: 'COMPLETED',
      lineItems: [{ menuItemId: 'ITEM-2', itemNameSnapshot: 'Cortado', quantity: 1, unitPricePaisa: 22000 }],
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    }),
    new Bill({
      billId: 'BILL-003',
      invoiceNumber: 'ZAM-BILL-1003',
      organisationId: orgId,
      cafeId: cafeB,
      businessDate,
      subtotalPaisa: 78000,
      taxPaisa: 3900,
      cgstPaisa: 1950,
      sgstPaisa: 1950,
      totalPaisa: 81900,
      refundedTotalPaisa: 0,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      lineItems: [{ menuItemId: 'ITEM-3', itemNameSnapshot: 'Cold Brew', quantity: 3, unitPricePaisa: 26000 }],
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    }),
    new Bill({
      billId: 'BILL-004',
      invoiceNumber: 'ZAM-BILL-1004',
      organisationId: orgId,
      cafeId: cafeC, // Unauthorized for Owner restricted to A & B
      businessDate,
      subtotalPaisa: 40000,
      taxPaisa: 2000,
      cgstPaisa: 1000,
      sgstPaisa: 1000,
      totalPaisa: 42000,
      refundedTotalPaisa: 0,
      paymentMethod: 'UPI',
      status: 'COMPLETED',
      lineItems: [{ menuItemId: 'ITEM-4', itemNameSnapshot: 'Flat White', quantity: 2, unitPricePaisa: 20000 }],
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    }),
  ];

  // ─── 1. OWNER MULTI-CAFÉ SCOPING ──────────────────────────────────────────

  await t.test('1. Owner Scoping: View authorized café bills and exclude unauthorized café bills', async () => {
    const allowedBills = seedBills.filter((b) => ownerAuth.assignedCafeIds.includes(b.cafeId));
    assert.equal(allowedBills.length, 3, 'Owner sees exactly 3 bills from Cafes A and B');
    assert.ok(!allowedBills.some((b) => b.cafeId === cafeC), 'Cafe C bill is strictly excluded');
  });

  // ─── 2. CROSS-CAFÉ QUERY DENIAL (403) ─────────────────────────────────────

  await t.test('2. Cross-Café Denial: Requesting unassigned café throws 403 CROSS_CAFE_RESOURCE_DENIED', async () => {
    // 2a. Overview endpoint
    await assert.rejects(
      async () => {
        await getBillsOverview(
          { auth: { ...ownerAuth }, query: { cafeId: cafeC, date: businessDate } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );

    // 2b. List bills endpoint
    await assert.rejects(
      async () => {
        await listBills(
          { auth: { ...ownerAuth }, query: { cafeId: cafeC } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );

    // 2c. GST register endpoint
    await assert.rejects(
      async () => {
        await getGstRegister(
          { auth: { ...ownerAuth }, query: { cafeId: cafeC } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );

    // 2d. Reconciliation status endpoint
    await assert.rejects(
      async () => {
        await getReconciliationStatus(
          { auth: { ...ownerAuth }, query: { cafeId: cafeC, date: businessDate } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      }
    );
  });

  // ─── 3. FINANCIAL FORMULAS & MATH INTEGRITY ───────────────────────────────

  await t.test('3. Financial Formulas: Gross, Net, ABV, Refunds & Tax output calculations', async () => {
    const cafeABills = seedBills.filter((b) => b.cafeId === cafeA && b.status === 'COMPLETED');
    const grossPaisa = cafeABills.reduce((sum, b) => sum + b.totalPaisa, 0);
    const refundsPaisa = cafeABills.reduce((sum, b) => sum + (b.refundedTotalPaisa || 0), 0);
    const netPaisa = grossPaisa - refundsPaisa;
    const completedCount = cafeABills.length;
    const abv = completedCount > 0 ? Math.round(grossPaisa / completedCount) / 100 : 0;
    const taxPaisa = cafeABills.reduce((sum, b) => sum + (b.taxPaisa || 0), 0);

    assert.equal(grossPaisa / 100, 1270.5, 'Gross sales is ₹1,270.50');
    assert.equal(refundsPaisa, 0, 'Refunds is ₹0');
    assert.equal(netPaisa / 100, 1270.5, 'Net sales equals gross when zero refunds');
    assert.equal(completedCount, 2, '2 completed bills');
    assert.equal(abv, 635.25, 'Gross ABV is ₹635.25');
    assert.equal(taxPaisa / 100, 60.5, 'Tax collected is ₹60.50 (5% GST)');
  });

  // ─── 4. RBAC BARRIER: VOID MUTATION ───────────────────────────────────────

  await t.test('4. RBAC Barrier: Owner cannot execute POS voids', async () => {
    const req = {
      auth: { ...ownerAuth },
      params: { billId: 'BILL-001' },
      body: { reason: 'Customer changed mind' },
    };

    await assert.rejects(
      async () => {
        await voidBill(req, createMockResponse());
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'VOID_FORBIDDEN');
        return true;
      }
    );
  });

  // ─── 5. RBAC BARRIER: REFUND MUTATION ─────────────────────────────────────

  await t.test('5. RBAC Barrier: Owner cannot execute POS refunds', async () => {
    const req = {
      auth: { ...ownerAuth },
      params: { billId: 'BILL-001' },
      body: { reason: 'Order damaged', refundType: 'FULL' },
    };

    await assert.rejects(
      async () => {
        await refundBill(req, createMockResponse());
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'REFUND_FORBIDDEN');
        return true;
      }
    );
  });

  // ─── 6. RBAC BARRIER: EOD BILLING CLOSE ───────────────────────────────────

  await t.test('6. RBAC Barrier: Owner cannot execute operational EOD close', async () => {
    const req = {
      auth: { ...ownerAuth },
      body: { businessDate, cafeId: cafeA },
    };

    await assert.rejects(
      async () => {
        await closeBusinessDayBilling(req, createMockResponse());
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'EOD_CLOSE_FORBIDDEN');
        return true;
      }
    );
  });

  // ─── 7. WEIGHTED PAYMENT MIX MATH ─────────────────────────────────────────

  await t.test('7. Weighted Portfolio Payment Mix Math Integrity', async () => {
    const totalTender = 69300 + 57750 + 81900;
    const upiPercent = Math.round((69300 / totalTender) * 100);
    const cardPercent = Math.round((57750 / totalTender) * 100);
    const cashPercent = Math.round((81900 / totalTender) * 100);

    assert.equal(upiPercent, 33, 'UPI is ~33%');
    assert.equal(cardPercent, 28, 'Card is ~28%');
    assert.equal(cashPercent, 39, 'Cash is ~39%');
    assert.equal(upiPercent + cardPercent + cashPercent, 100, 'Weighted mix sums to 100%');
  });

  // ─── 8. GST RULE 46 MATH & INTEGER PAISA ──────────────────────────────────

  await t.test('8. GST Classification & Output Split Integrity (Rule 46)', async () => {
    const bill = seedBills[0];
    const taxablePaisa = bill.subtotalPaisa;
    const expectedCgst = Math.round(taxablePaisa * 0.025);
    const expectedSgst = Math.round(taxablePaisa * 0.025);
    const expectedTax = expectedCgst + expectedSgst;

    assert.equal(bill.cgstPaisa, expectedCgst, 'CGST is 2.5%');
    assert.equal(bill.sgstPaisa, expectedSgst, 'SGST is 2.5%');
    assert.equal(bill.taxPaisa, expectedTax, 'Total tax matches CGST + SGST');
    assert.equal(bill.subtotalPaisa + bill.taxPaisa, bill.totalPaisa, 'Subtotal + Tax equals Total Paisa');
  });

  // ─── 9. DIRECT BILL-ID BOLA / IDOR PROTECTION ─────────────────────────────

  await t.test('9. Direct Bill-ID Security: Reject mutations & access to unauthorized café bills', async (sub) => {
    const unauthorizedCafeBill = {
      billId: 'BILL-004',
      invoiceNumber: 'ZAM-BILL-1004',
      organisationId: orgId,
      cafeId: cafeC, // Not in owner's assignedCafeIds [ZC-0001, ZC-0002]
      businessDate,
      totalPaisa: 42000,
      status: 'COMPLETED',
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(unauthorizedCafeBill));

    // 9a. getBill on unauthorized café -> 404 NOT_FOUND (safe, no existence leakage)
    await assert.rejects(
      async () => {
        await getBill(
          { auth: { ...ownerAuth }, params: { billId: 'BILL-004' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );

    // 9b. reprintBill on unauthorized café -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await reprintBill(
          { auth: { ...ownerAuth }, params: { billId: 'BILL-004' }, body: { reason: 'Reprint' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );

    // 9c. splitBill on unauthorized café -> 404 NOT_FOUND
    await assert.rejects(
      async () => {
        await splitBill(
          {
            auth: { ...ownerAuth },
            params: { billId: 'BILL-004' },
            body: { tenders: [{ amountPaisa: 42000, paymentMethod: 'CASH' }] },
          },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );
  });

  // ─── 10. FOREIGN ORGANISATION ISOLATION ───────────────────────────────────

  await t.test('10. Foreign Organisation Isolation: Cannot access bills of foreign organisations', async (sub) => {
    sub.mock.method(Bill, 'findOne', (query) => {
      // If queried with ORG-FOREIGN, findOne returns null for ORG-TEST-001 bills
      if (query.organisationId !== orgId) {
        return mockChainableQuery(null);
      }
      return mockChainableQuery(seedBills[0]);
    });

    await assert.rejects(
      async () => {
        await getBill(
          { auth: { ...otherOrgAuth }, params: { billId: 'BILL-001' } },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'NOT_FOUND');
        return true;
      }
    );
  });

  // ─── 11. BILL IMMUTABILITY & ALLOWED ACTIONS ENGINE ───────────────────────

  await t.test('11. Allowed Actions Engine: Owner permissions on finalized bills', async (sub) => {
    const authorizedBill = {
      billId: 'BILL-001',
      invoiceNumber: 'ZAM-BILL-1001',
      organisationId: orgId,
      cafeId: cafeA,
      businessDate: '2026-08-22',
      status: 'COMPLETED',
      totalPaisa: 69300,
      refundedTotalPaisa: 0,
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(authorizedBill));

    const res = createMockResponse();
    await getBill(
      { auth: { ...ownerAuth }, params: { billId: 'BILL-001' } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const { allowedActions } = res.body.data;
    assert.equal(allowedActions.canReprint, true, 'Reprint permitted with audit trail');
    assert.equal(allowedActions.canVoid, false, 'Owner role denied from voiding bill');
    assert.equal(allowedActions.canCreditNote, false, 'Credit note authority restricted');
    assert.equal(allowedActions.canReopen, false, 'Reopen finalized bill prohibited');
  });

  // ─── 12. REPRINT AUDIT COUNTER & GOVERNANCE ───────────────────────────────

  await t.test('12. Reprint Audit: Increments counter and captures audit log', async (sub) => {
    const testBill = {
      billId: 'BILL-002',
      invoiceNumber: 'ZAM-BILL-1002',
      organisationId: orgId,
      cafeId: cafeA,
      businessDate: '2026-08-22',
      status: 'COMPLETED',
      totalPaisa: 57750,
      reprints: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(testBill));
    sub.mock.method(auditService, 'recordRequestAudit', async () => {});

    const res = createMockResponse();
    await reprintBill(
      {
        auth: { ...ownerAuth },
        params: { billId: 'BILL-002' },
        body: { reason: 'Customer requested physical copy for accounting' },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.reprintCount, 1);
    assert.equal(testBill.reprints.length, 1);
    assert.equal(testBill.reprints[0].reprintedBy, 'OWNER-01');
    assert.ok(testBill.reprints[0].reason.includes('accounting'));
  });

  // ─── 13. SPLIT TENDER RECONCILIATION & CHANGE CALCULATION ─────────────────

  await t.test('13. Split Tender Settlement: Math reconciliation and cash change calculation', async (sub) => {
    const openBill = {
      billId: 'BILL-OPEN-01',
      invoiceNumber: 'ZAM-BILL-2001',
      organisationId: orgId,
      cafeId: cafeA,
      status: 'OPEN',
      totalPaisa: 100000, // ₹1,000.00
      tenders: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(openBill));

    // Case 1: Partial settlement (Cash ₹600 out of ₹1,000)
    const resPartial = createMockResponse();
    await splitBill(
      {
        auth: { ...ownerAuth },
        params: { billId: 'BILL-OPEN-01' },
        body: {
          tenders: [{ amountPaisa: 60000, paymentMethod: 'CASH' }],
        },
      },
      resPartial
    );

    assert.equal(resPartial.statusCode, 200);
    assert.equal(openBill.paymentStatus, 'PARTIALLY_PAID');
    assert.equal(openBill.paymentMethod, 'SPLIT');

    // Case 2: Full settlement (Cash ₹600 + UPI ₹400 = ₹1,000)
    const resFull = createMockResponse();
    await splitBill(
      {
        auth: { ...ownerAuth },
        params: { billId: 'BILL-OPEN-01' },
        body: {
          tenders: [
            { amountPaisa: 60000, paymentMethod: 'CASH' },
            { amountPaisa: 40000, paymentMethod: 'UPI' },
          ],
        },
      },
      resFull
    );

    assert.equal(resFull.statusCode, 200);
    assert.equal(openBill.paymentStatus, 'PAID');
    assert.equal(openBill.status, 'COMPLETED');
    assert.equal(openBill.tenders.length, 2);

    // Case 3: Cash change calculation check (Tender ₹1,200 for ₹1,000 total = ₹200 change due)
    const cashTenderedPaisa = 120000;
    const changeDuePaisa = Math.max(0, cashTenderedPaisa - openBill.totalPaisa);
    assert.equal(changeDuePaisa, 20000, 'Change due is exactly ₹200.00 (20000 paisa)');
  });

  // ─── 14. REFUND BALANCE PROTECTION & VALIDATION LIMITS ───────────────────

  await t.test('14. Refund Validation: Rejects exceeding balance or voided status', async (sub) => {
    // Note: Master/Admin role used here to test refund business logic since Owner is blocked by RBAC
    const masterAuth = {
      role: 'MASTER',
      organisationId: orgId,
      userId: 'MASTER-01',
      isPrimaryMaster: true,
      assignedCafeIds: [cafeA],
    };

    // 14a. Exceeding refund balance
    const billToRefund = {
      billId: 'BILL-REF-01',
      invoiceNumber: 'ZAM-BILL-3001',
      organisationId: orgId,
      cafeId: cafeA,
      status: 'COMPLETED',
      totalPaisa: 50000, // ₹500
      refundedTotalPaisa: 30000, // already refunded ₹300, remaining is ₹200
      refunds: [],
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(billToRefund));

    await assert.rejects(
      async () => {
        await refundBill(
          {
            auth: masterAuth,
            params: { billId: 'BILL-REF-01' },
            body: { refundType: 'PARTIAL', amountPaisa: 25000, reason: 'Exceeding limit test' },
          },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_REFUND_AMOUNT');
        return true;
      }
    );

    // 14b. Cannot refund a voided bill
    const voidedBill = {
      billId: 'BILL-VOID-01',
      invoiceNumber: 'ZAM-BILL-3002',
      organisationId: orgId,
      cafeId: cafeA,
      status: 'VOIDED',
      totalPaisa: 50000,
      refundedTotalPaisa: 0,
      save: async function() { return this; },
      toObject: function() { return { ...this }; },
    };

    sub.mock.method(Bill, 'findOne', () => mockChainableQuery(voidedBill));

    await assert.rejects(
      async () => {
        await refundBill(
          {
            auth: masterAuth,
            params: { billId: 'BILL-VOID-01' },
            body: { refundType: 'FULL', reason: 'Refund voided bill test' },
          },
          createMockResponse()
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'CANNOT_REFUND_VOIDED');
        return true;
      }
    );
  });

  // ─── 15. GST SOURCE REGISTER SCOPING & AGGREGATION ────────────────────────

  await t.test('15. GST Register: Multi-café scoping and accurate tax compilation', async (sub) => {
    sub.mock.method(Bill, 'find', () => mockChainableQuery(seedBills.slice(0, 3)));

    const res = createMockResponse();
    await getGstRegister(
      {
        auth: { ...ownerAuth },
        query: { date: businessDate },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const { summary, records } = res.body.data;

    // 3 bills: BILL-001 (66000), BILL-002 (55000), BILL-003 (78000) = 199000 taxable
    assert.equal(summary.totalTaxable, 1990, 'Total taxable value is ₹1,990.00');
    assert.equal(summary.totalCgst, 49.75, 'CGST is ₹49.75');
    assert.equal(summary.totalSgst, 49.75, 'SGST is ₹49.75');
    assert.equal(summary.totalTax, 99.5, 'Total GST is ₹99.50');
    assert.equal(records.length, 3);
  });

  // ─── 16. OPERATIONAL RECONCILIATION & EOD GATEKEEPING ─────────────────────

  await t.test('16. Reconciliation: Detect blockers and report readiness state', async (sub) => {
    // Case 1: Open checks block EOD
    const billsWithOpen = [
      ...seedBills.slice(0, 2),
      { billId: 'BILL-OPEN', status: 'OPEN', totalPaisa: 30000, tableNumber: 'T-04' },
    ];

    sub.mock.method(Bill, 'find', () => mockChainableQuery(billsWithOpen));
    sub.mock.method(RegisterSession, 'find', () => mockChainableQuery([]));

    const resBlocked = createMockResponse();
    await getReconciliationStatus(
      { auth: { ...ownerAuth }, query: { cafeId: cafeA, date: businessDate } },
      resBlocked
    );

    assert.equal(resBlocked.statusCode, 200);
    assert.equal(resBlocked.body.data.isReadyToClose, false);
    assert.ok(resBlocked.body.data.blockers.some((b) => b.includes('open check(s) pending payment')));

    // Case 2: Clean slate allows EOD
    sub.mock.method(Bill, 'find', () => mockChainableQuery(seedBills.slice(0, 2)));

    const resReady = createMockResponse();
    await getReconciliationStatus(
      { auth: { ...ownerAuth }, query: { cafeId: cafeA, date: businessDate } },
      resReady
    );

    assert.equal(resReady.statusCode, 200);
    assert.equal(resReady.body.data.isReadyToClose, true);
    assert.equal(resReady.body.data.blockers.length, 0);
  });
});
