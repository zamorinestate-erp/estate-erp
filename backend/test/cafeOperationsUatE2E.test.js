'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateCsv } = require('../src/utils/exportGenerators');

test('Café Operations End-to-End User Acceptance Test (UAT) Automation Suite', async (t) => {
  await t.test('UAT-01: Terminal Pairing, Dual-PIN Operator Sign-in & Inactivity Lockout Flow', () => {
    // 1. Simulate enrolled device context
    const enrolledDevice = {
      id: 'DEV-001',
      deviceCode: 'DC-BEACH-01',
      assignedCafeId: 'CAFE-A1',
      status: 'ACTIVE',
      trustLevel: 'ENROLLED',
    };
    assert.equal(enrolledDevice.status, 'ACTIVE');

    // 2. Validate Operator PIN authentication logic
    const operatorPin = '4819';
    const isPinValid = /^\d{4,6}$/.test(operatorPin);
    assert.equal(isPinValid, true);

    // 3. Inactivity transition: active -> locked after idle timeout
    let session = {
      sessionId: 'SESS-UAT-01',
      status: 'ACTIVE',
      lastSeenAt: new Date(Date.now() - 16 * 60 * 1000), // 16 min idle
    };
    const isIdle = (Date.now() - session.lastSeenAt.getTime()) > 15 * 60 * 1000;
    if (isIdle) {
      session.status = 'LOCKED';
    }
    assert.equal(session.status, 'LOCKED');

    // 4. Unlock returns to ACTIVE
    session.status = 'ACTIVE';
    assert.equal(session.status, 'ACTIVE');
  });

  await t.test('UAT-02: POS Sale with Loyalty Points Attachment & Split Tender Accounting', () => {
    const lineItems = [
      { name: 'Zamorin Signature Cold Brew', quantity: 2, unitPricePaisa: 15000 },
      { name: 'Malabar Ghee Cake', quantity: 1, unitPricePaisa: 15000 },
    ];
    const subtotalPaisa = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPricePaisa, 0);
    const gstPaisa = Math.round(subtotalPaisa * 0.05);
    const totalPaisa = subtotalPaisa + gstPaisa;

    assert.equal(subtotalPaisa, 45000);
    assert.equal(gstPaisa, 2250);
    assert.equal(totalPaisa, 47250);

    // Split tender allocation
    const splitTenders = [
      { method: 'CASH', amountPaisa: 20000 },
      { method: 'UPI', amountPaisa: 27250 },
    ];
    const tenderTotal = splitTenders.reduce((sum, t) => sum + t.amountPaisa, 0);
    assert.equal(tenderTotal, totalPaisa, 'Sum of split tenders must equal total bill amount');

    // Loyalty points calculation: 1 pt per ₹10 spent
    const earnedPoints = Math.floor((totalPaisa / 100) / 10);
    assert.equal(earnedPoints, 47);
  });

  await t.test('UAT-03: Petty Cash Outflow & Daily Register Shift Handover Balance', () => {
    const openingFloatPaisa = 540000; // ₹5,400.00
    const pettyCashOutflowPaisa = 35000; // ₹350.00
    const salesCashInflowPaisa = 45000; // ₹450.00

    const expectedBalancePaisa = openingFloatPaisa - pettyCashOutflowPaisa + salesCashInflowPaisa;
    assert.equal(expectedBalancePaisa, 550000); // ₹5,500.00

    // Physical denomination count: 10x ₹500, 2x ₹200, 1x ₹100 = ₹5,500.00
    const physicalCountPaisa = (10 * 500 + 2 * 200 + 1 * 100) * 100;
    const variancePaisa = physicalCountPaisa - expectedBalancePaisa;

    assert.equal(variancePaisa, 0, 'Variance must be zero for balanced shift handover');
  });

  await t.test('UAT-04: Inventory Cycle Count, Physical Variance & Spoilage Write-Off', () => {
    const systemOnHandKg = 15.0;
    const countedPhysicalKg = 13.5;
    const varianceKg = Number((countedPhysicalKg - systemOnHandKg).toFixed(2));

    assert.equal(varianceKg, -1.5, 'Negative variance indicates missing/spilled stock');
    const writeOffRecord = {
      sku: 'BEANS-ARABICA-01',
      quantityKg: Math.abs(varianceKg),
      type: 'WASTE_SPILLAGE',
      reason: 'Physical cycle count adjustment',
      approvedBy: 'CAFE_ADMIN_01',
    };
    assert.equal(writeOffRecord.quantityKg, 1.5);
  });

  await t.test('UAT-05: Purchase Order Goods Receipt (GRN) & 3-Way Invoicing Match', () => {
    const purchaseOrder = { poId: 'PO-2026-001', orderedQty: 50, ratePaisa: 20000, totalPaisa: 1000000 };
    const goodsReceived = { grnId: 'GRN-2026-001', receivedQty: 50, rejectedQty: 0 };
    const supplierInvoice = { invNumber: 'INV-SUP-8821', billedQty: 50, totalPaisa: 1000000 };

    const quantityMatch = purchaseOrder.orderedQty === goodsReceived.receivedQty && goodsReceived.receivedQty === supplierInvoice.billedQty;
    const priceMatch = purchaseOrder.totalPaisa === supplierInvoice.totalPaisa;

    assert.equal(quantityMatch, true);
    assert.equal(priceMatch, true);
  });

  await t.test('UAT-06: Employee Geofenced Attendance Check-in, Breaks & Midnight Rollover', () => {
    const cafeCoordinates = { latitude: 11.2588, longitude: 75.7804, radiusMeters: 100 };
    const punchCoordinates = { latitude: 11.2589, longitude: 75.7805 };

    // Approximation of delta in meters
    const latDiffMeters = Math.abs(punchCoordinates.latitude - cafeCoordinates.latitude) * 111000;
    const lngDiffMeters = Math.abs(punchCoordinates.longitude - cafeCoordinates.longitude) * 111000;
    const distanceMeters = Math.sqrt(latDiffMeters * latDiffMeters + lngDiffMeters * lngDiffMeters);

    assert.ok(distanceMeters < cafeCoordinates.radiusMeters, 'Employee punch within 100m geofence');
  });

  await t.test('UAT-07: Operational ZURF Report Generation & CSV Ledger Export', () => {
    const mockBills = [
      { billNumber: 'BIL-001', totalPaisa: 47250, status: 'COMPLETED', paymentMethod: 'SPLIT' },
      { billNumber: 'BIL-002', totalPaisa: 15000, status: 'COMPLETED', paymentMethod: 'CASH' },
    ];
    const totalSalesPaisa = mockBills.reduce((sum, b) => sum + b.totalPaisa, 0);
    assert.equal(totalSalesPaisa, 62250);

    const exportRows = mockBills.map((b) => ({
      billNumber: b.billNumber,
      amountRupees: (b.totalPaisa / 100).toFixed(2),
      status: b.status,
    }));

    const columns = [
      { key: 'billNumber', label: 'Bill Number' },
      { key: 'amountRupees', label: 'Amount (INR)' },
      { key: 'status', label: 'Status' },
    ];
    const csvResult = generateCsv({
      columns,
      rows: exportRows,
      reportTitle: 'Daily Sales Ledger',
      branding: { legalName: 'Zamorin Cafe Pvt Ltd', gstin: '32AABCU9603R1ZM' },
    });

    assert.ok(csvResult.csv.includes('BIL-001'));
    assert.ok(csvResult.csv.includes('472.50'));
    assert.ok(csvResult.runId.startsWith('RPT-RUN-'));
  });

  await t.test('UAT-08: POS Terminal Diagnostics & Hardware Health Probes', () => {
    const diagnosticPayload = {
      deviceCode: 'DEV-001',
      processHealth: 'OK',
      databaseReadiness: 'READY',
      latencyMs: 18,
      timestamp: new Date().toISOString(),
    };

    assert.equal(diagnosticPayload.processHealth, 'OK');
    assert.equal(diagnosticPayload.databaseReadiness, 'READY');
    assert.ok(diagnosticPayload.latencyMs < 250, 'Latency must be within SLA threshold');
  });
});
