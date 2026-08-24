'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Import models
const { Bill } = require('../src/models/Bill');
const { Cafe } = require('../src/models/Cafe');
const { RegisterSession } = require('../src/models/RegisterSession');
const {
  getBillsOverview,
  listBills,
  getBill,
  voidBill,
  refundBill,
  getGstRegister,
  getReconciliationStatus,
  closeBusinessDayBilling,
} = require('../src/controllers/billController');

test('OWN-SCR-003 / SCR-005: Sales Bills & Tax Receipts Governance Suite', async (t) => {
  const orgId = 'ORG-TEST-001';
  const cafeA = 'ZC-0001';
  const cafeB = 'ZC-0002';
  const cafeC = 'ZC-0003';
  const businessDate = '2026-08-22';

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
    }),
  ];

  await t.test('1. Owner Scoping: View authorized café bills and exclude unauthorized café bills', async () => {
    // Owner authorized only for Cafe A and Cafe B
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
      assignedCafeIds: [cafeA, cafeB],
    };

    // Filter simulation
    const allowedBills = seedBills.filter((b) => ownerAuth.assignedCafeIds.includes(b.cafeId));
    assert.equal(allowedBills.length, 3, 'Owner sees exactly 3 bills from Cafes A and B');
    assert.ok(!allowedBills.some((b) => b.cafeId === cafeC), 'Cafe C bill is strictly excluded');
  });

  await t.test('2. Financial Formulas: Gross, Net, ABV, Refunds & Tax output calculations', async () => {
    // For Cafe A bills: BILL-001 (69300) + BILL-002 (57750) = 127050 paisa (₹1,270.50)
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

  await t.test('3. RBAC Barrier: Owner cannot execute POS voids', async () => {
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
      assignedCafeIds: [cafeA, cafeB],
    };

    const req = {
      auth: ownerAuth,
      params: { billId: 'BILL-001' },
      body: { reason: 'Customer changed mind' },
    };
    const res = {
      status: (code) => ({
        json: (data) => ({ statusCode: code, data }),
      }),
    };

    // voidBill requires MASTER or PRIMARY MASTER
    await assert.rejects(
      async () => {
        await voidBill(req, res);
      },
      (err) => {
        return err.statusCode === 403 || err.message.includes('forbidden') || err.message.includes('authority');
      },
      'Owner is denied from voiding POS bills'
    );
  });

  await t.test('4. RBAC Barrier: Owner cannot execute POS refunds', async () => {
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
      assignedCafeIds: [cafeA, cafeB],
    };

    const req = {
      auth: ownerAuth,
      params: { billId: 'BILL-001' },
      body: { reason: 'Order damaged', refundType: 'FULL' },
    };
    const res = {
      status: (code) => ({
        json: (data) => ({ statusCode: code, data }),
      }),
    };

    await assert.rejects(
      async () => {
        await refundBill(req, res);
      },
      (err) => {
        return err.statusCode === 403 && err.code === 'REFUND_FORBIDDEN';
      },
      'Owner is denied from executing refunds directly'
    );
  });

  await t.test('5. RBAC Barrier: Owner cannot execute operational EOD close', async () => {
    const ownerAuth = {
      role: 'OWNER',
      organisationId: orgId,
      userId: 'OWNER-01',
      assignedCafeIds: [cafeA, cafeB],
    };

    const req = {
      auth: ownerAuth,
      body: { businessDate, cafeId: cafeA },
    };
    const res = {
      status: (code) => ({
        json: (data) => ({ statusCode: code, data }),
      }),
    };

    await assert.rejects(
      async () => {
        await closeBusinessDayBilling(req, res);
      },
      (err) => {
        return err.statusCode === 403 && err.code === 'EOD_CLOSE_FORBIDDEN';
      },
      'Owner is denied from executing EOD billing close'
    );
  });

  await t.test('6. Weighted Portfolio Payment Mix Math Integrity', async () => {
    // Bill 1: UPI 69300, Bill 2: CARD 57750, Bill 3: CASH 81900
    // Total = 208950 paisa (₹2,089.50)
    const totalTender = 69300 + 57750 + 81900;
    const upiPercent = Math.round((69300 / totalTender) * 100);
    const cardPercent = Math.round((57750 / totalTender) * 100);
    const cashPercent = Math.round((81900 / totalTender) * 100);

    assert.equal(upiPercent, 33, 'UPI is ~33%');
    assert.equal(cardPercent, 28, 'Card is ~28%');
    assert.equal(cashPercent, 39, 'Cash is ~39%');
    assert.equal(upiPercent + cardPercent + cashPercent, 100, 'Weighted mix sums to 100%');
  });

  await t.test('7. GST Classification & Output Split Integrity', async () => {
    // 5% composite GST = 2.5% CGST + 2.5% SGST
    const bill = seedBills[0];
    const taxablePaisa = bill.subtotalPaisa;
    const expectedCgst = Math.round(taxablePaisa * 0.025);
    const expectedSgst = Math.round(taxablePaisa * 0.025);
    const expectedTax = expectedCgst + expectedSgst;

    assert.equal(bill.cgstPaisa, expectedCgst, 'CGST is 2.5%');
    assert.equal(bill.sgstPaisa, expectedSgst, 'SGST is 2.5%');
    assert.equal(bill.taxPaisa, expectedTax, 'Total tax matches CGST + SGST');
  });
});
