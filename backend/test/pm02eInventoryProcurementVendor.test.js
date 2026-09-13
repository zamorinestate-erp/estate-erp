'use strict';

/**
 * ZAMORIN CAFÉ ERP — DEDICATED TEST SUITE
 * Test File: pm02eInventoryProcurementVendor.test.js
 * 
 * PM-02E — INVENTORY, WASTE, PROCUREMENT & VENDOR INTELLIGENCE
 * 
 * Validates:
 * 1. Inventory Valuation & Lot Status (remainingQuantity * unitCost, AVAILABLE/ON_HOLD vs DEPLETED/EXPIRED)
 * 2. Strict Prohibition of Fabricated Actual COGS (COGS, Gross Profit, EBITDA = UNAVAILABLE)
 * 3. Inventory Ageing (REPORT_PRESENTATION_BUCKET) & Configurable Expiry Alert Window
 * 4. Stock Movement Waterfall & Ledgers (Opening, Inbound GRN, Transfers, Wastage, Closing)
 * 5. Inter-Café Stock Transfers (Source & Dest café scoping)
 * 6. Cycle Count & Audit Variances (varianceQty & estimated variance value)
 * 7. Waste Intelligence & Cumulative Pareto Curve (Approved vs Pending status)
 * 8. Procurement Commitments & Cancelled PO Exclusion (PO lifecycle distribution)
 * 9. Financial Demarcation (ORDERED vs RECEIVED vs INVOICED vs PAID = UNAVAILABLE vs OUTSTANDING)
 * 10. Vendor Intelligence Activation (vendor-performance-intelligence runnable with PDF/XLSX)
 * 11. Vendor Lead Time & On-Time Delivery Reliability (Receipt date vs Expected delivery date)
 * 12. Quantity Reliability & Fill Rate (Received / Ordered, Short & Excess Quantities)
 * 13. Dock Quality & Inspection Rejections (IncomingInspection & grnReceipts)
 * 14. Vendor Purchase Price Trends & UOM Normalization (kg <-> g, l <-> ml, pack <-> unit, incompatible rejected)
 * 15. Payables Aging Schedule (CURRENT, 1-30, 31-60, 61-90, 90+ from APInvoice)
 * 16. Vendor Concentration & Dependencies (Single-source & CRITICAL items)
 * 17. Vendor Master Privacy (Banking & credentials redacted)
 * 18. Overall Vendor Score = NOT_CONFIGURED (Composite scores prohibited)
 * 19. Multi-Café & Cross-Org Isolation (Zero cross-tenant leakage)
 * 20. ZURF Export Compliance & Screen/PDF/XLSX Parity (CSV & HTML rejected with 400)
 * 21. Static & Mock Data Audit (PRODUCTION_FAKE_DATA = 0, UNAPPROVED_VENDOR_SCORE = 0)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { calculateInventoryMetrics } = require('../src/reporting/calculations/inventoryCalculations');
const { calculateProcurementMetrics, normalizeUom } = require('../src/reporting/calculations/procurementCalculations');
const { ReportRegistry } = require('../src/reporting/reportRegistry');

test('PM-02E: Inventory, Waste, Procurement & Vendor Intelligence Suite', async (suite) => {
  const ORG_A = 'ORG-TEST-001';
  const ORG_B = 'ORG-TEST-FOREIGN';
  const CAFE_1 = 'CAF-BLR-01';
  const CAFE_2 = 'CAF-BLR-02';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. INVENTORY VALUATION & LOT STATUS (Sections 7, 8, 9)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('1.1 Operational valuation: remainingQuantity * standard unitCost with lot status filtering', async () => {
    // Test isolated calculation with synthetic lot fixtures
    const mockLots = [
      { lotId: 'LOT-01', itemId: 'ITEM-COFFEE-01', cafeId: CAFE_1, remainingQuantity: 50, status: 'AVAILABLE', expiryDate: '2027-12-31' },
      { lotId: 'LOT-02', itemId: 'ITEM-COFFEE-01', cafeId: CAFE_1, remainingQuantity: 20, status: 'ON_HOLD', expiryDate: '2027-12-31' },
      { lotId: 'LOT-03', itemId: 'ITEM-COFFEE-01', cafeId: CAFE_1, remainingQuantity: 0, status: 'DEPLETED', expiryDate: '2027-12-31' },
      { lotId: 'LOT-04', itemId: 'ITEM-COFFEE-01', cafeId: CAFE_1, remainingQuantity: 10, status: 'EXPIRED', expiryDate: '2025-01-01' },
      { lotId: 'LOT-05', itemId: 'ITEM-COFFEE-01', cafeId: CAFE_1, remainingQuantity: 5, status: 'DISPOSED', expiryDate: '2025-01-01' },
    ];

    // Mock find functions temporarily
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const { CafeInventoryConfig } = require('../src/models/CafeInventoryConfig');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;
    const origConfigFind = CafeInventoryConfig.find;

    InventoryLot.find = (query) => ({
      lean: async () => {
        if (query.organisationId !== ORG_A) return [];
        return mockLots;
      },
    });

    GlobalInventoryItem.find = (query) => ({
      lean: async () => {
        if (query.organisationId !== ORG_A) return [];
        return [{ itemId: 'ITEM-COFFEE-01', name: 'Arabica Beans 1kg', category: 'COFFEE_BEANS', unitCostPaisa: 65000, baseUnit: 'kg' }];
      },
    });

    CafeInventoryConfig.find = () => ({ lean: async () => [] });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A, cafeScope: CAFE_1 });

      // Usable on-hand lots are LOT-01 (50) and LOT-02 (20) = 70 kg
      // Depleted (0), Expired (10), and Disposed (5) are excluded from active on-hand
      assert.equal(res.summary.stockOnHandQuantity, 70, 'Usable stock on hand must be exactly 70 kg');
      assert.equal(res.summary.operationalValuationPaise, 70 * 65000, 'Valuation must be 70 * ₹650.00 = 4,550,000 paise');
      assert.equal(res.summary.operationalValuation, 45500, 'Operational valuation in INR must be ₹45,500.00');
      assert.equal(res.summary.availableLotCount, 1, 'Exactly 1 AVAILABLE lot');
      assert.equal(res.summary.onHoldLotCount, 1, 'Exactly 1 ON_HOLD lot');
      assert.equal(res.summary.expiredLotCount, 1, 'Exactly 1 EXPIRED lot');
      assert.equal(res.provenance.valuationTrust, 'OPERATIONAL', 'Trust status must be OPERATIONAL');
      assert.equal(res.provenance.valuationCostBasis, 'OPERATIONAL_STANDARD_COST_VALUATION');
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
      CafeInventoryConfig.find = origConfigFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ACTUAL COGS PROHIBITED (Section 6)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('2.1 Actual COGS, Gross Profit, and EBITDA remain strictly UNAVAILABLE', async () => {
    const res = await calculateInventoryMetrics({ organisationId: ORG_A });
    assert.equal(res.summary.actualCOGS, 'UNAVAILABLE', 'Actual COGS must remain UNAVAILABLE');
    assert.equal(res.summary.grossProfit, 'UNAVAILABLE', 'Gross profit must remain UNAVAILABLE');
    assert.equal(res.summary.ebitda, 'UNAVAILABLE', 'EBITDA must remain UNAVAILABLE');
    assert.equal(res.provenance.actualCOGSAvailability, 'UNAVAILABLE');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. INVENTORY AGEING & EXPIRY ANALYTICS (Sections 13, 14)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('3.1 Ageing presentation buckets & configurable expiry alert window', async () => {
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;

    const now = new Date();
    const d10DaysAgo = new Date(now.getTime() - 10 * 86400000);
    const d45DaysAgo = new Date(now.getTime() - 45 * 86400000);
    const d100DaysAgo = new Date(now.getTime() - 100 * 86400000);

    const dIn10Days = new Date(now.getTime() + 10 * 86400000).toISOString().substring(0, 10);
    const dIn50Days = new Date(now.getTime() + 50 * 86400000).toISOString().substring(0, 10);

    InventoryLot.find = () => ({
      lean: async () => [
        { lotId: 'L-A', itemId: 'ITEM-1', cafeId: CAFE_1, remainingQuantity: 10, receivedAt: d10DaysAgo, expiryDate: dIn10Days, status: 'AVAILABLE' },
        { lotId: 'L-B', itemId: 'ITEM-1', cafeId: CAFE_1, remainingQuantity: 20, receivedAt: d45DaysAgo, expiryDate: dIn50Days, status: 'AVAILABLE' },
        { lotId: 'L-C', itemId: 'ITEM-1', cafeId: CAFE_1, remainingQuantity: 5, receivedAt: d100DaysAgo, expiryDate: '2028-01-01', status: 'AVAILABLE' },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'ITEM-1', name: 'Specialty Syrup', unitCostPaisa: 10000, category: 'SYRUPS_FLAVOURS' }],
    });

    try {
      // Test 1: Window 15 days -> only L-A is expiring soon
      const res15 = await calculateInventoryMetrics({ organisationId: ORG_A, expiryWindowDays: 15 });
      assert.equal(res15.expiry.expiringSoonLots.length, 1, 'In 15d window, exactly 1 lot expiring soon');
      assert.equal(res15.expiry.expiringSoonLots[0].lotId, 'L-A');

      // Test 2: Window 60 days -> both L-A and L-B are expiring soon
      const res60 = await calculateInventoryMetrics({ organisationId: ORG_A, expiryWindowDays: 60 });
      assert.equal(res60.expiry.expiringSoonLots.length, 2, 'In 60d window, 2 lots expiring soon');

      // Ageing presentation buckets
      const buckets = res15.ageing.buckets;
      assert.equal(res15.ageing.classification, 'REPORT_PRESENTATION_BUCKET');
      const b0_15 = buckets.find((b) => b.bucketKey === '0_15_DAYS');
      const b31_60 = buckets.find((b) => b.bucketKey === '31_60_DAYS');
      const bOver90 = buckets.find((b) => b.bucketKey === 'OVER_90_DAYS');

      assert.equal(b0_15.lotCount, 1, '1 lot in 0-15d bucket');
      assert.equal(b31_60.lotCount, 1, '1 lot in 31-60d bucket');
      assert.equal(bOver90.lotCount, 1, '1 lot in 90+d bucket');
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. STOCK TRANSFERS & CAFÉ SCOPING (Section 16)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('4.1 Stock transfer report respects both source and destination café scope', async () => {
    const { StockTransfer } = require('../src/models/StockTransfer');
    const origTransferFind = StockTransfer.find;

    let capturedQuery = null;
    StockTransfer.find = (query) => {
      capturedQuery = query;
      return {
        sort: () => ({
          limit: () => ({
            lean: async () => [
              { transferId: 'TR-01', sourceCafeId: CAFE_1, destCafeId: CAFE_2, requestedQty: 10, status: 'COMPLETED' },
              { transferId: 'TR-02', sourceCafeId: CAFE_2, destCafeId: CAFE_1, requestedQty: 5, status: 'IN_TRANSIT' },
            ],
          }),
        }),
      };
    };

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A, cafeScope: CAFE_1 });
      assert.ok(capturedQuery.$or, 'Query must use $or to include source or destination');
      assert.deepEqual(capturedQuery.$or[0], { sourceCafeId: { $in: [CAFE_1] } });
      assert.deepEqual(capturedQuery.$or[1], { destCafeId: { $in: [CAFE_1] } });
      assert.equal(res.transfers.completedCount, 1);
      assert.equal(res.transfers.pendingCount, 1);
    } finally {
      StockTransfer.find = origTransferFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CYCLE COUNT & AUDIT VARIANCE (Section 17)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('5.1 Cycle count variance: varianceQty and valuation discrepancy without fraud assumptions', async () => {
    const { InventoryCycleCount } = require('../src/models/InventoryCycleCount');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origCountFind = InventoryCycleCount.find;
    const origItemFind = GlobalInventoryItem.find;

    InventoryCycleCount.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              countId: 'CC-01',
              cafeId: CAFE_1,
              items: [
                { itemId: 'ITEM-MILK', systemQty: 100, countedQty: 95, varianceQty: -5 },
                { itemId: 'ITEM-COFFEE', systemQty: 50, countedQty: 52, varianceQty: 2 },
              ],
              status: 'POSTED',
            },
          ],
        }),
      }),
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [
        { itemId: 'ITEM-MILK', unitCostPaisa: 6000 }, // ₹60/l
        { itemId: 'ITEM-COFFEE', unitCostPaisa: 50000 }, // ₹500/kg
      ],
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A, cafeScope: CAFE_1 });
      // Variance qty: -5 + 2 = -3
      // Variance value: (-5 * 6000) + (2 * 50000) = -30,000 + 100,000 = +70,000 paise (₹700)
      assert.equal(res.summary.cycleCountVarianceQty, -3);
      assert.equal(res.summary.cycleCountVarianceValuePaise, 70000);
      assert.equal(res.cycleCounts.totalVarianceQty, -3);
    } finally {
      InventoryCycleCount.find = origCountFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. WASTE INTELLIGENCE & PARETO CURVE (Sections 19, 20, 21)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('6.1 Waste intelligence: approved vs pending status and cumulative Pareto ranking', async () => {
    const { WastageRecord } = require('../src/models/WastageRecord');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origWasteFind = WastageRecord.find;
    const origItemFind = GlobalInventoryItem.find;

    WastageRecord.find = () => ({
      lean: async () => [
        { wastageId: 'W-01', itemId: 'ITEM-MILK', cafeId: CAFE_1, quantityBase: 10, reasonCode: 'EXPIRED', estimatedValuePaisa: 60000, approvedByUserId: 'USER-ADMIN' },
        { wastageId: 'W-02', itemId: 'ITEM-SYRUP', cafeId: CAFE_1, quantityBase: 2, reasonCode: 'SPILLED', estimatedValuePaisa: 30000, approvedByUserId: null },
        { wastageId: 'W-03', itemId: 'ITEM-CROISSANT', cafeId: CAFE_1, quantityBase: 5, reasonCode: 'PREPARATION_LOSS', estimatedValuePaisa: 10000, approvedByUserId: 'USER-ADMIN' },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [
        { itemId: 'ITEM-MILK', name: 'Fresh Whole Milk' },
        { itemId: 'ITEM-SYRUP', name: 'Vanilla Syrup' },
        { itemId: 'ITEM-CROISSANT', name: 'Butter Croissant' },
      ],
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A });
      // Total waste: 60000 + 30000 + 10000 = 100000 paise (₹1,000.00)
      // Approved: 60000 + 10000 = 70000 paise (₹700.00)
      // Pending: 30000 paise (₹300.00)
      assert.equal(res.summary.totalWasteValuePaise, 100000);
      assert.equal(res.summary.approvedWasteValuePaise, 70000);
      assert.equal(res.summary.pendingWasteValuePaise, 30000);

      // Pareto Curve Verification
      const pareto = res.wasteIntelligence.pareto;
      assert.equal(pareto.length, 3);
      assert.equal(pareto[0].itemId, 'ITEM-MILK');
      assert.equal(pareto[0].sharePercent, 60.0);
      assert.equal(pareto[0].cumulativePercent, 60.0);

      assert.equal(pareto[1].itemId, 'ITEM-SYRUP');
      assert.equal(pareto[1].sharePercent, 30.0);
      assert.equal(pareto[1].cumulativePercent, 90.0);

      assert.equal(pareto[2].itemId, 'ITEM-CROISSANT');
      assert.equal(pareto[2].sharePercent, 10.0);
      assert.equal(pareto[2].cumulativePercent, 100.0);
    } finally {
      WastageRecord.find = origWasteFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROCUREMENT FINANCIAL SEMANTICS & STATUSES (Sections 23, 24, 25, 26, 28)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('7.1 Financial demarcation: ORDERED vs RECEIVED vs INVOICED vs PAID (UNAVAILABLE)', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const origPoFind = PurchaseOrder.find;
    const origInvFind = APInvoice.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-01',
          vendorId: 'VEN-01',
          vendorNameSnapshot: 'Roasters Ltd',
          status: 'ORDER_PLACED',
          totalPaisa: 500000, // ₹5,000.00
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 10, receivedQuantityBase: 0, unitPricePaisa: 50000, totalLinePaisa: 500000 }],
        },
        {
          purchaseOrderId: 'PO-02',
          vendorId: 'VEN-01',
          vendorNameSnapshot: 'Roasters Ltd',
          status: 'PARTIALLY_RECEIVED',
          totalPaisa: 300000, // ₹3,000.00
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 6, receivedQuantityBase: 4, unitPricePaisa: 50000, totalLinePaisa: 300000 }],
          invoices: [{ invoiceId: 'INV-1', totalPaisa: 200000 }],
        },
        {
          purchaseOrderId: 'PO-03',
          vendorId: 'VEN-02',
          status: 'CANCELLED',
          totalPaisa: 1000000, // Cancelled: must be excluded from commitments
          lineItems: [{ itemId: 'IT-2', orderedQuantityBase: 20, receivedQuantityBase: 0, unitPricePaisa: 50000 }],
        },
      ],
    });

    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'AP-01', vendorId: 'VEN-01', totalPaisa: 200000, outstandingPaisa: 150000, dueDate: '2026-10-01' },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      // Active POs: PO-01 (₹5,000) + PO-02 (₹3,000) = ₹8,000.00 (800,000 paise)
      // Cancelled PO-03 (₹10,000) excluded!
      assert.equal(res.spendSummary.totalPoCommitmentsPaisa, 800000);
      assert.equal(res.spendSummary.cancelledPoCount, 1);
      assert.equal(res.spendSummary.cancelledPoValuePaisa, 1000000);

      // Received: PO-02 line 4 units * 50000 = 200,000 paise (₹2,000.00)
      assert.equal(res.spendSummary.grnReceivedValuePaisa, 200000);
      assert.equal(res.spendSummary.outstandingReceiptValuePaisa, 600000);

      // Invoiced: PO-02 invoice = 200,000 paise
      assert.equal(res.spendSummary.invoicedValuePaisa, 200000);

      // Paid Value MUST BE UNAVAILABLE
      assert.equal(res.spendSummary.paidValue, null);
      assert.equal(res.spendSummary.paidValueAvailability, 'UNAVAILABLE');
      assert.equal(res.provenance.paidValueAvailability, 'UNAVAILABLE');

      // Outstanding Payables: from AP-01 = 150,000 paise (₹1,500.00)
      assert.equal(res.spendSummary.outstandingPayablePaisa, 150000);
    } finally {
      PurchaseOrder.find = origPoFind;
      APInvoice.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. VENDOR INTELLIGENCE ACTIVATION (Sections 31, 32, 113)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('8.1 vendor-performance-intelligence is fully activated in ReportRegistry', () => {
    const report = ReportRegistry.getReport('vendor-performance-intelligence');
    assert.ok(report, 'Report must exist in registry');
    assert.equal(report.availability, 'AVAILABLE', 'Availability must be AVAILABLE in PM-02E');
    assert.equal(report.runnable, true, 'Report must be runnable');
    assert.equal(report.endpoint, '/api/v1/reports/procurement', 'Must map to canonical procurement endpoint');
    assert.deepEqual(report.supportedExports, ['PDF', 'XLSX'], 'Supported exports must be exactly PDF and XLSX');
    assert.ok(Array.isArray(report.supportedVisuals), 'Supported visuals must be array');
    assert.ok(report.supportedVisuals.includes('VENDOR_SPEND_BAR'));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. VENDOR LEAD TIME & DELIVERY PERFORMANCE (Sections 41, 42, 44)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('9.1 Vendor lead time and on-time delivery percentage', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-ONTIME',
          vendorId: 'VEN-01',
          approvedAt: '2026-08-01T10:00:00.000Z',
          orderDate: '2026-08-01',
          expectedDeliveryDate: '2026-08-05',
          grnReceipts: [{ receivedAt: '2026-08-05T10:00:00.000Z' }], // Arrived on time (4.0 days lead time)
          status: 'RECEIVED',
          totalPaisa: 100000,
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 10, receivedQuantityBase: 10, unitPricePaisa: 10000 }],
        },
        {
          purchaseOrderId: 'PO-LATE',
          vendorId: 'VEN-01',
          approvedAt: '2026-08-01T10:00:00.000Z',
          orderDate: '2026-08-01',
          expectedDeliveryDate: '2026-08-05',
          grnReceipts: [{ receivedAt: '2026-08-08T10:00:00.000Z' }], // Arrived 3 days late (7.0 days lead time)
          status: 'RECEIVED',
          totalPaisa: 100000,
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 10, receivedQuantityBase: 10, unitPricePaisa: 10000 }],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      // 1 on-time, 1 late = 50.0% on-time
      assert.equal(res.spendSummary.onTimeDeliveryPercent, 50.0);
      assert.equal(res.vendorIntelligence.deliveryPerformance.onTimeDeliveries, 1);
      assert.equal(res.vendorIntelligence.deliveryPerformance.lateDeliveries, 1);

      // Average lead time: (4 + 7) / 2 = 5.5 days
      const v01 = res.vendorIntelligence.vendors.find((v) => v.vendorId === 'VEN-01');
      assert.equal(v01.leadTimeDays, 5.5);
      assert.equal(v01.onTimeDeliveryPercent, 50.0);
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. QUANTITY RELIABILITY / FILL RATE (Section 45, 46)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('10.1 Quantity reliability: Fill rate %, short and excess delivery quantities', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-SHORT',
          vendorId: 'VEN-01',
          status: 'PARTIALLY_RECEIVED',
          totalPaisa: 100000,
          grnReceipts: [{ receivedAt: '2026-08-05T00:00:00.000Z' }],
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 100, receivedQuantityBase: 80, unitPricePaisa: 1000 }], // 20 units short
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const v01 = res.vendorIntelligence.vendors.find((v) => v.vendorId === 'VEN-01');
      assert.equal(v01.fillRatePercent, 80.0, 'Fill rate must be exactly 80.0%');
      assert.equal(res.vendorIntelligence.quantityReliability.shortQuantity, 20);
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DOCK QUALITY & INSPECTION REJECTIONS (Section 47, 48)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('11.1 Dock quality: Incoming inspections, temperature failures & packaging rejections', async () => {
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const origInspectFind = IncomingInspection.find;
    const origRuleFind = FoodSafetyTemperatureRule.find;

    IncomingInspection.find = () => ({
      lean: async () => [
        {
          inspectionId: 'INS-01',
          vendorId: 'VEN-01',
          receivedQuantity: 100,
          acceptedQuantity: 90,
          rejectedQuantity: 10,
          temperatureCelsius: 12.5,
          packagingCondition: 'DAMAGED',
          decision: 'PARTIAL_ACCEPT',
          rejectionReason: 'Temperature abuse & torn cartons',
        },
      ],
    });

    FoodSafetyTemperatureRule.find = () => ({
      lean: async () => [
        {
          ruleId: 'FSSAI-REC-COLD-01',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q = res.vendorIntelligence.qualityAnalytics;
      assert.equal(q.totalInspectedQuantity, 100);
      assert.equal(q.totalAcceptedQuantity, 90);
      assert.equal(q.totalRejectedQuantity, 10);
      assert.equal(q.rejectionPercent, 10.0);
      assert.equal(q.temperatureFailureCount, 1);
      assert.equal(q.packagingDamageCount, 1);
      assert.equal(q.temperatureRuleSource, 'FSSAI-REC-COLD-01');
      assert.equal(q.temperatureRuleConfigured, true);
    } finally {
      IncomingInspection.find = origInspectFind;
      FoodSafetyTemperatureRule.find = origRuleFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. UOM NORMALIZATION & PRICE TRENDS (Sections 36, 40, 102)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('12.1 UOM normalization: converts convertible units, rejects incompatible comparisons', () => {
    // Convertible Weight
    assert.deepEqual(normalizeUom(2, 'kg', 'g'), { convertedQty: 2000, compatible: true });
    assert.deepEqual(normalizeUom(500, 'g', 'kg'), { convertedQty: 0.5, compatible: true });

    // Convertible Volume
    assert.deepEqual(normalizeUom(1.5, 'l', 'ml'), { convertedQty: 1500, compatible: true });
    assert.deepEqual(normalizeUom(250, 'ml', 'litre'), { convertedQty: 0.25, compatible: true });

    // Item Pack conversion
    const mockItem = { packSize: 12 };
    assert.deepEqual(normalizeUom(2, 'carton', 'unit', mockItem), { convertedQty: 24, compatible: true });

    // Incompatible: kg vs litre
    const incomp = normalizeUom(10, 'kg', 'litre');
    assert.equal(incomp.compatible, false);
    assert.equal(incomp.convertedQty, null);
    assert.ok(incomp.reason.includes('Incompatible'));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. PAYABLES AGING SCHEDULE (Section 53, 54)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('13.1 Payables aging: Presentation buckets based on invoice dueDate', async () => {
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    const now = new Date();
    const dFuture = new Date(now.getTime() + 10 * 86400000).toISOString().substring(0, 10);
    const dPast15 = new Date(now.getTime() - 15 * 86400000).toISOString().substring(0, 10);
    const dPast75 = new Date(now.getTime() - 75 * 86400000).toISOString().substring(0, 10);

    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'INV-1', vendorId: 'V1', totalPaisa: 50000, outstandingPaisa: 50000, dueDate: dFuture },
        { invoiceId: 'INV-2', vendorId: 'V1', totalPaisa: 30000, outstandingPaisa: 30000, dueDate: dPast15 },
        { invoiceId: 'INV-3', vendorId: 'V1', totalPaisa: 20000, outstandingPaisa: 20000, dueDate: dPast75 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const aging = res.vendorIntelligence.payablesAging;
      const bCurrent = aging.find((b) => b.bucketKey === 'CURRENT');
      const b1_30 = aging.find((b) => b.bucketKey === 'DAYS_1_30');
      const b61_90 = aging.find((b) => b.bucketKey === 'DAYS_61_90');

      assert.equal(bCurrent.outstandingPaisa, 50000);
      assert.equal(b1_30.outstandingPaisa, 30000);
      assert.equal(b61_90.outstandingPaisa, 20000);
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. VENDOR CONCENTRATION & DEPENDENCIES (Sections 59, 60, 61)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('14.1 Vendor spend concentration & critical supplier dependency tracking', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origPoFind = PurchaseOrder.find;
    const origItemFind = GlobalInventoryItem.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-1',
          vendorId: 'VEN-BIG',
          totalPaisa: 700000, // 70%
          lineItems: [{ itemId: 'CRIT-1', orderedQuantityBase: 10, receivedQuantityBase: 10, unitPricePaisa: 70000 }],
        },
        {
          purchaseOrderId: 'PO-2',
          vendorId: 'VEN-SMALL',
          totalPaisa: 300000, // 30%
          lineItems: [{ itemId: 'STD-1', orderedQuantityBase: 10, receivedQuantityBase: 10, unitPricePaisa: 30000 }],
        },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [
        { itemId: 'CRIT-1', name: 'Specialty Beans', category: 'COFFEE_BEANS', criticality: 'CRITICAL', unitCostPaisa: 70000 },
        { itemId: 'STD-1', name: 'Paper Napkins', category: 'PACKAGING', criticality: 'STANDARD', unitCostPaisa: 30000 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const vendors = res.vendorIntelligence.vendors;
      assert.equal(vendors[0].vendorId, 'VEN-BIG');
      assert.equal(vendors[0].spendSharePercent, 70.0);
      assert.equal(vendors[0].cumulativeSharePercent, 70.0);

      assert.equal(vendors[1].vendorId, 'VEN-SMALL');
      assert.equal(vendors[1].spendSharePercent, 30.0);
      assert.equal(vendors[1].cumulativeSharePercent, 100.0);

      // Critical dependency tracking
      const crit = res.vendorIntelligence.criticalDependencies;
      assert.equal(crit.length, 1);
      assert.equal(crit[0].itemId, 'CRIT-1');
      assert.equal(crit[0].criticality, 'CRITICAL');

      // Single source tracking
      const single = res.vendorIntelligence.singleSourceItems;
      assert.equal(single.length, 2);
    } finally {
      PurchaseOrder.find = origPoFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. OVERALL VENDOR SCORE = NOT_CONFIGURED (Sections 65, 66, 67, 105)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('15.1 Overall vendor score must be strictly NOT_CONFIGURED', async () => {
    const res = await calculateProcurementMetrics({ organisationId: ORG_A });
    assert.equal(res.provenance.vendorScoringStatus, 'NOT_CONFIGURED');
    assert.equal(res.vendorIntelligence.scoringMethodology.overallScore, 'NOT_CONFIGURED');
    for (const v of res.vendorIntelligence.vendors) {
      assert.equal(v.overallScore, 'NOT_CONFIGURED', 'No vendor may have an arbitrary composite score');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. STATIC & MOCK AUDIT (Section 108)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('16.1 PRODUCTION_FAKE_DATA = 0: Zero hardcoded fallback arrays in inventory & procurement engines', () => {
    const invCode = fs.readFileSync(path.join(__dirname, '../src/reporting/calculations/inventoryCalculations.js'), 'utf8');
    const procCode = fs.readFileSync(path.join(__dirname, '../src/reporting/calculations/procurementCalculations.js'), 'utf8');
    const ctrlCode = fs.readFileSync(path.join(__dirname, '../src/controllers/reportController.js'), 'utf8');

    // Verify removal of legacy fake numbers (e.g., 842500, 485000)
    assert.ok(!invCode.includes('842500'), 'inventoryCalculations must not contain legacy fake 842500');
    assert.ok(!procCode.includes('485000'), 'procurementCalculations must not contain legacy fake 485000');
    assert.ok(!ctrlCode.includes('totalValuation: 842500'), 'reportController must not contain fake inventory valuation fallback');
    assert.ok(!ctrlCode.includes('totalPoCommitments: 485000'), 'reportController must not contain fake procurement fallback');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. PM-02E-R1 BEHAVIORAL & SEMANTIC INTEGRITY SUITE
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('17.1 Non-monotonic procurement invariant: stages are independent control measures', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const origPoFind = PurchaseOrder.find;
    const origInvFind = APInvoice.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-NM-01',
          vendorId: 'V1',
          status: 'ORDER_PLACED',
          totalPaisa: 100000,
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 10, receivedQuantityBase: 12, unitPricePaisa: 10000 }],
        },
      ],
    });

    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'INV-NM-01', vendorId: 'V1', approvalStatus: 'APPROVED', totalPaisa: 130000, outstandingPaisa: 130000 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.totalPoCommitmentsPaisa, 100000);
      assert.equal(res.spendSummary.grnReceivedValuePaisa, 120000);
      assert.equal(res.spendSummary.invoicedValuePaisa, 130000);
      assert.ok(res.spendSummary.grnReceivedValuePaisa > res.spendSummary.totalPoCommitmentsPaisa, 'Received exceeds ordered legitimately due to over-delivery');
      assert.ok(res.spendSummary.invoicedValuePaisa > res.spendSummary.grnReceivedValuePaisa, 'Invoiced exceeds received legitimately due to price variance/taxes');
    } finally {
      PurchaseOrder.find = origPoFind;
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('17.2 Invoice > PO due to Purchase Price Variance (PPV)', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-PPV-01',
          vendorId: 'V1',
          status: 'RECEIVED',
          totalPaisa: 50000,
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 5, receivedQuantityBase: 5, unitPricePaisa: 10000 }],
          invoices: [{ invoiceId: 'INV-PPV-1', totalPaisa: 60000 }],
          threeWayMatch: { priceVariancePaisa: 10000, status: 'VARIANCE_FLAGGED' },
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.totalPoCommitmentsPaisa, 50000);
      assert.equal(res.spendSummary.grnReceivedValuePaisa, 50000);
      assert.equal(res.spendSummary.invoicedValuePaisa, 60000);
      assert.equal(res.spendSummary.purchasePriceVariancePaise, 10000);
      assert.ok(res.spendSummary.invoicedValuePaisa > res.spendSummary.totalPoCommitmentsPaisa);
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  await suite.test('17.3 Over-delivery: received quantity and value exceed ordered commitments', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-OD-01',
          vendorId: 'V1',
          status: 'PARTIALLY_RECEIVED',
          totalPaisa: 100000,
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 10, receivedQuantityBase: 15, unitPricePaisa: 10000 }],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.totalPoCommitmentsPaisa, 100000);
      assert.equal(res.spendSummary.grnReceivedValuePaisa, 150000);
      assert.equal(res.spendSummary.totalExcessDeliveredQuantity, 5);
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  await suite.test('17.4 Outstanding payable: uses authoritative APInvoice.outstandingPaisa with partial payment', async () => {
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    APInvoice.find = () => ({
      lean: async () => [
        {
          invoiceId: 'INV-PART-01',
          vendorId: 'V1',
          approvalStatus: 'APPROVED',
          paymentStatus: 'PARTIALLY_PAID',
          totalPaisa: 100000,
          paidPaisa: 40000,
          outstandingPaisa: 60000,
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.invoicedValuePaisa, 100000, 'Full invoice amount counts in historical invoiced value');
      assert.equal(res.spendSummary.outstandingPayablePaisa, 60000, 'Only remaining unpaid amount counts in outstanding payable');
      assert.equal(res.provenance.outstandingPayableBasis, 'APInvoice.outstandingPaisa');
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('17.5 Partially-paid invoice included in historical invoiced value', async () => {
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'INV-PP', vendorId: 'V1', paymentStatus: 'PARTIALLY_PAID', approvalStatus: 'APPROVED', totalPaisa: 80000, paidPaisa: 30000, outstandingPaisa: 50000 },
        { invoiceId: 'INV-PD', vendorId: 'V1', paymentStatus: 'PAID', approvalStatus: 'APPROVED', totalPaisa: 40000, paidPaisa: 40000, outstandingPaisa: 0 },
        { invoiceId: 'INV-DFT', vendorId: 'V1', approvalStatus: 'PENDING', totalPaisa: 25000, outstandingPaisa: 25000 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.invoicedValuePaisa, 120000);
      assert.equal(res.spendSummary.outstandingPayablePaisa, 50000);
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('17.6 Payables aging: ages remaining unpaid balance only, excluding fully paid invoices', async () => {
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    const now = new Date();
    const dPast10 = new Date(now.getTime() - 10 * 86400000).toISOString().substring(0, 10);

    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'INV-AG-1', vendorId: 'V1', approvalStatus: 'APPROVED', paymentStatus: 'PARTIALLY_PAID', totalPaisa: 100000, paidPaisa: 65000, outstandingPaisa: 35000, dueDate: dPast10 },
        { invoiceId: 'INV-AG-2', vendorId: 'V1', approvalStatus: 'APPROVED', paymentStatus: 'PAID', totalPaisa: 200000, paidPaisa: 200000, outstandingPaisa: 0, dueDate: dPast10 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const aging = res.vendorIntelligence.payablesAging;
      const b1_30 = aging.find((b) => b.bucketKey === 'DAYS_1_30');
      assert.equal(b1_30.outstandingPaisa, 35000, 'Aging must reflect remaining balance of 35k, NOT original gross 100k');
      assert.equal(b1_30.count, 1, 'Fully paid invoice must be excluded from aging');
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('17.7 Received value provenance: PO_PRICED_RECEIPT_VALUE with OPERATIONAL trust', async () => {
    const res = await calculateProcurementMetrics({ organisationId: ORG_A });
    assert.equal(res.provenance.receivedValueProvenance, 'PO_PRICED_RECEIPT_VALUE');
    assert.equal(res.provenance.receivedValueTrust, 'OPERATIONAL');
  });

  await suite.test('17.8 Multi-receipt: first receipt on-time vs final fulfillment late', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-MR-01',
          vendorId: 'V1',
          vendorNameSnapshot: 'Fresh Farm',
          status: 'RECEIVED',
          expectedDeliveryDate: '2026-09-01',
          lineItems: [{ itemId: 'IT-1', orderedQuantityBase: 100, receivedQuantityBase: 100, unitPricePaisa: 1000 }],
          grnReceipts: [
            { grnNumber: 'GRN-01', receivedAt: new Date('2026-09-01T10:00:00+05:30'), items: [{ itemId: 'IT-1', acceptedQty: 10 }] },
            { grnNumber: 'GRN-02', receivedAt: new Date('2026-09-10T10:00:00+05:30'), items: [{ itemId: 'IT-1', acceptedQty: 90 }] },
          ],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const deliv = res.vendorIntelligence.deliveryPerformance;
      assert.equal(deliv.firstReceiptOnTimePercent, 100, 'First receipt arrived on Sep 1 -> 100% on time');
      assert.equal(deliv.finalFulfillmentOnTimePercent, 0, 'Final fulfillment completed on Sep 10 (late) -> 0% on time');
      assert.equal(deliv.onTimePercent, 0, 'PO-level full delivery evaluates final fulfillment');
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  await suite.test('17.9 Lead-time basis: canonical approvedAt with fallback record count disclosure', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-LT-1',
          vendorId: 'V1',
          approvedAt: new Date('2026-08-01T10:00:00+05:30'),
          grnReceipts: [{ receivedAt: new Date('2026-08-04T10:00:00+05:30'), items: [{ acceptedQty: 10 }] }],
        },
        {
          purchaseOrderId: 'PO-LT-2',
          vendorId: 'V1',
          orderDate: '2026-08-01',
          grnReceipts: [{ receivedAt: new Date('2026-08-06T10:00:00+05:30'), items: [{ acceptedQty: 10 }] }],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.provenance.leadTimeBasis, 'APPROVAL_TO_FIRST_RECEIPT');
      assert.equal(res.provenance.leadTimeProvenance.recordsUsingApprovedAt, 1);
      assert.equal(res.provenance.leadTimeProvenance.recordsUsingFallback, 1);
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  await suite.test('17.10 Fill rate population: COMPLETED_PO_FILL_RATE vs CURRENT_FULFILLMENT_RATE', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        { purchaseOrderId: 'PO-C1', vendorId: 'V1', status: 'RECEIVED', lineItems: [{ itemId: 'I-1', orderedQuantityBase: 10, receivedQuantityBase: 10, unitPricePaisa: 1000 }] },
        { purchaseOrderId: 'PO-P1', vendorId: 'V1', status: 'PARTIALLY_RECEIVED', lineItems: [{ itemId: 'I-1', orderedQuantityBase: 20, receivedQuantityBase: 10, unitPricePaisa: 1000 }] },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const supp = res.vendorIntelligence.vendors.find((v) => v.vendorId === 'V1');
      assert.equal(supp.completedPoFillRatePercent, 100, 'Completed PO fill rate represents closed/received POs only');
      assert.equal(supp.currentFulfillmentRatePercent, 66.7, 'Current fulfillment rate includes active partial POs: 20/30 = 66.7%');
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  await suite.test('17.11 UOM packaging conversion: uses packSize and conversions, rejects unconfigured packaging', () => {
    const itemWithPack = {
      baseUnit: 'kg',
      purchaseUnit: 'box',
      packSize: 5,
      conversions: [],
    };

    const resPack = normalizeUom(2, 'box', 'kg', itemWithPack);
    assert.equal(resPack.compatible, true);
    assert.equal(resPack.convertedQty, 10);

    const itemWithCustomConv = {
      baseUnit: 'unit',
      conversions: [{ fromUnit: 'crate', toUnit: 'unit', factor: 24 }],
    };
    const resConv = normalizeUom(3, 'crate', 'unit', itemWithCustomConv);
    assert.equal(resConv.compatible, true);
    assert.equal(resConv.convertedQty, 72);

    const resArbitrary = normalizeUom(10, 'case', 'carton', null);
    assert.equal(resArbitrary.compatible, false, 'Arbitrary case vs carton conversion must be rejected without item configuration');
  });

  await suite.test('17.12 Known Active Vendor Count: no unproven approved qualification labels', async () => {
    const { Vendor } = require('../src/models/Vendor');
    const origVendorFind = Vendor.find;

    Vendor.find = () => ({
      lean: async () => [
        { vendorId: 'V1', name: 'Vendor 1', status: 'ACTIVE' },
        { vendorId: 'V2', name: 'Vendor 2', status: 'INACTIVE' },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.vendorIntelligence.vendorCounts.knownActiveVendorCount, 1);
      assert.equal(res.vendorIntelligence.vendorCounts.approvedSupplierQualification, 'NOT_STORED_IN_SOURCE');
    } finally {
      Vendor.find = origVendorFind;
    }
  });

  await suite.test('17.13 Document compliance: factual recorded and expired documents without unconfigured rules', async () => {
    const { Vendor } = require('../src/models/Vendor');
    const origVendorFind = Vendor.find;

    const now = new Date();
    const dPast = new Date(now.getTime() - 20 * 86400000).toISOString().substring(0, 10);
    const dFuture = new Date(now.getTime() + 100 * 86400000).toISOString().substring(0, 10);

    Vendor.find = () => ({
      lean: async () => [
        {
          vendorId: 'V1',
          name: 'Certified Supplier',
          status: 'ACTIVE',
          documents: [
            { documentType: 'FSSAI_LICENSE', expiresAt: dPast, verified: true },
            { documentType: 'GST_CERTIFICATE', expiresAt: dFuture, verified: true },
          ],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const comp = res.vendorIntelligence.documentCompliance;
      assert.equal(comp.mandatoryRequirementsConfigured, false);
      assert.equal(comp.recordedDocumentsCount, 2);
      assert.equal(comp.expiredRecordedDocumentsCount, 1);
      assert.equal(comp.documentedActiveVendorCount, 1);
    } finally {
      Vendor.find = origVendorFind;
    }
  });

  await suite.test('17.14 Inventory: physical on-hand, available for use, quarantine, and on-hold stock separated', async () => {
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;

    InventoryLot.find = () => ({
      lean: async () => [
        { lotId: 'L-AVL', itemId: 'IT-1', cafeId: CAFE_1, remainingQuantity: 100, status: 'AVAILABLE' },
        { lotId: 'L-HLD', itemId: 'IT-1', cafeId: CAFE_1, remainingQuantity: 30, status: 'ON_HOLD' },
        { lotId: 'L-QRN', itemId: 'IT-1', cafeId: CAFE_1, remainingQuantity: 20, status: 'QUARANTINE' },
        { lotId: 'L-EXP', itemId: 'IT-1', cafeId: CAFE_1, remainingQuantity: 10, status: 'EXPIRED' },
        { lotId: 'L-DSP', itemId: 'IT-1', cafeId: CAFE_1, remainingQuantity: 5, status: 'DISPOSED' },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'IT-1', unitCostPaisa: 1000 }],
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A, cafeScope: CAFE_1 });
      assert.equal(res.summary.physicalOnHandQuantity, 160);
      assert.equal(res.summary.availableForUseQuantity, 100);
      assert.equal(res.summary.onHoldQuantity, 30);
      assert.equal(res.summary.quarantineQuantity, 20);
      assert.equal(res.summary.expiredQuantity, 10);
      assert.equal(res.summary.quarantineValuationPaise, 20 * 1000);
      assert.equal(res.summary.valuationCostBasis, 'OPERATIONAL_STANDARD_COST_VALUATION');
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  await suite.test('17.15 Dock inspection quality reasons strictly match stored enums', async () => {
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const origInspectFind = IncomingInspection.find;
    const origRuleFind = FoodSafetyTemperatureRule.find;

    IncomingInspection.find = () => ({
      lean: async () => [
        {
          inspectionId: 'INSP-1',
          vendorId: 'V1',
          receivedQuantity: 50,
          acceptedQuantity: 40,
          rejectedQuantity: 10,
          packagingCondition: 'DAMAGED',
          qualityCondition: 'SPOILED',
          temperatureCelsius: 12.5,
          passed: false,
        },
      ],
    });

    FoodSafetyTemperatureRule.find = () => ({
      lean: async () => [
        {
          ruleId: 'FSSAI-REC-COLD-01',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
        },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q = res.vendorIntelligence.qualityAnalytics;
      assert.equal(q.packagingDamageCount, 1);
      assert.equal(q.temperatureFailureCount, 1);
      assert.equal(q.totalRejectedQuantity, 10);
      assert.equal(q.supportedFailureReasons.includes('DAMAGED'), true);
      assert.equal(q.supportedFailureReasons.includes('SPOILED'), true);
      assert.equal(q.supportedFailureReasons.includes('TAMPER_SEAL_FAILURE'), false);
    } finally {
      IncomingInspection.find = origInspectFind;
      FoodSafetyTemperatureRule.find = origRuleFind;
    }
  });

  await suite.test('17.16 Standalone receiving tickets and credit notes are not falsely claimed', async () => {
    const res = await calculateProcurementMetrics({ organisationId: ORG_A });
    assert.equal(res.provenance.standaloneReceivingTicketsSupported, false);
    assert.equal(res.provenance.creditNotesSupported, false);
  });

  await suite.test('17.17 Multi-assigned-café scope preservation for Café Admin and Owner', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const origPoFind = PurchaseOrder.find;
    let queriedMatch = null;

    PurchaseOrder.find = (query) => {
      queriedMatch = query;
      return { lean: async () => [] };
    };

    try {
      await calculateProcurementMetrics({ organisationId: ORG_A, cafeScope: ['CAF-01', 'CAF-02'] });
      assert.deepEqual(queriedMatch.cafeId, { $in: ['CAF-01', 'CAF-02'] }, 'Server queries multiple assigned cafés with $in');

      await calculateProcurementMetrics({ organisationId: ORG_A, cafeScope: 'CAF-01' });
      assert.equal(queriedMatch.cafeId, 'CAF-01', 'Server queries single café directly');

      await calculateProcurementMetrics({ organisationId: ORG_A, cafeScope: null });
      assert.equal(queriedMatch.cafeId, undefined, 'Org-wide scope does not restrict cafeId');
    } finally {
      PurchaseOrder.find = origPoFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. PM-02E-R2 SOURCE-ENUM, QUALITY-RULE & PPV CANONICAL INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('18.1 APInvoice exact status recognition and unknown status fail-safe', async () => {
    const { evaluateApInvoiceFinancialRecognition } = require('../src/reporting/calculations/procurementCalculations');
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    // 1. Valid approved invoice
    const validApproved = evaluateApInvoiceFinancialRecognition({
      approvalStatus: 'APPROVED',
      paymentStatus: 'UNPAID',
      totalPaisa: 10000,
      outstandingPaisa: 10000,
    });
    assert.equal(validApproved.recognized, true);
    assert.equal(validApproved.invoicedValueEligible, true);
    assert.equal(validApproved.outstandingEligible, true);

    // 2. Valid partially paid invoice
    const validPartiallyPaid = evaluateApInvoiceFinancialRecognition({
      approvalStatus: 'APPROVED',
      paymentStatus: 'PARTIALLY_PAID',
      totalPaisa: 20000,
      paidPaisa: 5000,
      outstandingPaisa: 15000,
    });
    assert.equal(validPartiallyPaid.recognized, true);
    assert.equal(validPartiallyPaid.invoicedValueEligible, true);
    assert.equal(validPartiallyPaid.outstandingEligible, true);

    // 3. Valid fully paid invoice (invoiced spend recognized, outstanding liability 0)
    const validPaid = evaluateApInvoiceFinancialRecognition({
      approvalStatus: 'APPROVED',
      paymentStatus: 'PAID',
      totalPaisa: 30000,
      paidPaisa: 30000,
      outstandingPaisa: 0,
    });
    assert.equal(validPaid.recognized, true);
    assert.equal(validPaid.invoicedValueEligible, true);
    assert.equal(validPaid.outstandingEligible, false);

    // 4. Excluded unapproved claims (PENDING, REJECTED)
    const pendingInv = evaluateApInvoiceFinancialRecognition({ approvalStatus: 'PENDING', totalPaisa: 50000 });
    assert.equal(pendingInv.recognized, false);

    const rejectedInv = evaluateApInvoiceFinancialRecognition({ approvalStatus: 'REJECTED', totalPaisa: 50000 });
    assert.equal(rejectedInv.recognized, false);

    // 5. Unknown / unsupported future status fails safe
    const unknownStatusInv = evaluateApInvoiceFinancialRecognition({
      approvalStatus: 'PENDING_APPROVAL_UNKNOWN',
      totalPaisa: 50000,
    });
    assert.equal(unknownStatusInv.recognized, false);
    assert.ok(unknownStatusInv.reason.includes('Unknown approvalStatus'));

    const unknownPaymentInv = evaluateApInvoiceFinancialRecognition({
      paymentStatus: 'DISPUTED_UNKNOWN',
      totalPaisa: 50000,
    });
    assert.equal(unknownPaymentInv.recognized, false);

    // Integration test inside calculateProcurementMetrics
    APInvoice.find = () => ({
      lean: async () => [
        { invoiceId: 'INV-VALID', vendorId: 'V1', approvalStatus: 'APPROVED', paymentStatus: 'UNPAID', totalPaisa: 40000, outstandingPaisa: 40000 },
        { invoiceId: 'INV-PENDING', vendorId: 'V1', approvalStatus: 'PENDING', paymentStatus: 'UNPAID', totalPaisa: 99999, outstandingPaisa: 99999 },
        { invoiceId: 'INV-UNKNOWN', vendorId: 'V1', approvalStatus: 'CORRUPTED_ENUM', totalPaisa: 88888, outstandingPaisa: 88888 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      assert.equal(res.spendSummary.invoicedValuePaisa, 40000);
      assert.equal(res.spendSummary.outstandingPayablePaisa, 40000);
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('18.2 InventoryLot exact enum vs derived near-expiry condition', async () => {
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;

    // Verify canonical schema enum on model directly
    const schemaLotStatuses = InventoryLot.schema.path('status').enumValues;
    assert.deepEqual(schemaLotStatuses, [
      'AVAILABLE',
      'NEAR_EXPIRY',
      'EXPIRED',
      'QUARANTINE',
      'RECALL_HOLD',
      'DEPLETED',
      'DISPOSED',
      'RETURNED',
    ]);
    assert.equal(schemaLotStatuses.includes('ON_HOLD'), false, 'ON_HOLD must not exist as persisted enum');

    const now = new Date();
    const dExpiringSoon = new Date(now.getTime() + 5 * 86400000).toISOString().substring(0, 10);
    const dExpired = new Date(now.getTime() - 2 * 86400000).toISOString().substring(0, 10);

    GlobalInventoryItem.find = () => ({ lean: async () => [{ itemId: 'ITM-MILK', unitCostPaisa: 5000 }] });
    InventoryLot.find = () => ({
      lean: async () => [
        // Stored as AVAILABLE, but analytically expiring soon
        { lotId: 'LOT-DERIVED-NEAR', itemId: 'ITM-MILK', status: 'AVAILABLE', remainingQuantity: 10, expiryDate: dExpiringSoon },
        // Stored as AVAILABLE, but analytically expired
        { lotId: 'LOT-DERIVED-EXP', itemId: 'ITM-MILK', status: 'AVAILABLE', remainingQuantity: 5, expiryDate: dExpired },
        // Genuine persisted RECALL_HOLD
        { lotId: 'LOT-RECALL', itemId: 'ITM-MILK', status: 'RECALL_HOLD', remainingQuantity: 8 },
        // Genuine persisted RETURNED
        { lotId: 'LOT-RET', itemId: 'ITM-MILK', status: 'RETURNED', remainingQuantity: 4 },
      ],
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A, expiryWindowDays: 14 });
      const expSoon = res.expiry.expiringSoonLots.find(l => l.lotId === 'LOT-DERIVED-NEAR');
      assert.ok(expSoon);
      assert.equal(expSoon.storedStatus, 'AVAILABLE');
      assert.equal(expSoon.derivedCondition, 'NEAR_EXPIRY');

      const expDone = res.expiry.expiredLots.find(l => l.lotId === 'LOT-DERIVED-EXP');
      assert.ok(expDone);
      assert.equal(expDone.storedStatus, 'AVAILABLE');
      assert.equal(expDone.derivedCondition, 'EXPIRED');

      assert.equal(res.summary.quarantineValuationPaise, 0);
      assert.equal(res.summary.onHoldQuantity, 8);
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  await suite.test('18.3 Vendor root schema exact enum and no unproven statuses', () => {
    const { Vendor } = require('../src/models/Vendor');
    const vendorStatuses = Vendor.schema.path('status').enumValues;
    assert.deepEqual(vendorStatuses, [
      'ACTIVE',
      'SUSPENDED',
      'BLACKLISTED',
      'ARCHIVED',
      'DRAFT',
      'ONBOARDING',
    ]);
    assert.equal(vendorStatuses.includes('PENDING_VERIFICATION'), false, 'PENDING_VERIFICATION is not in Vendor enum');
    assert.equal(vendorStatuses.includes('INACTIVE'), false, 'INACTIVE is not on root Vendor status');
  });

  await suite.test('18.4 Temperature rule provenance: factual unconfigured reporting vs configured rule evaluation', async () => {
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const origInspectFind = IncomingInspection.find;
    const origRuleFind = FoodSafetyTemperatureRule.find;

    IncomingInspection.find = () => ({
      lean: async () => [
        {
          inspectionId: 'INSP-UNCONF-1',
          vendorId: 'V1',
          receivedQuantity: 100,
          acceptedQuantity: 100,
          rejectedQuantity: 0,
          temperatureCelsius: 9.5, // > 8°C but no rule configured
          packagingCondition: 'INTACT',
          qualityCondition: 'ACCEPTABLE',
        },
      ],
    });

    // 1. Unconfigured temperature rule case: NO report-layer invention
    FoodSafetyTemperatureRule.find = () => ({ lean: async () => [] });

    try {
      const resUnconf = await calculateProcurementMetrics({ organisationId: ORG_A });
      const qUnconf = resUnconf.vendorIntelligence.qualityAnalytics;
      assert.equal(qUnconf.temperatureRecordedCount, 1);
      assert.equal(qUnconf.temperatureFailureCount, null, 'Must be null when unconfigured');
      assert.equal(qUnconf.temperatureFailureAvailability, 'UNAVAILABLE', 'Must be UNAVAILABLE when unconfigured');
      assert.equal(qUnconf.temperatureRuleConfigured, false);
      assert.equal(qUnconf.temperatureRuleSource, 'NOT_CONFIGURED');

      // 2. Configured statutory rule case: evaluates against minimumTemperatureC / maximumTemperatureC
      FoodSafetyTemperatureRule.find = () => ({
        lean: async () => [
          {
            ruleId: 'FSSAI-SCHED4-CHILLED',
            processType: 'RECEIVING',
            status: 'ACTIVE',
            criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 5 }],
          },
        ],
      });

      const resConf = await calculateProcurementMetrics({ organisationId: ORG_A });
      const qConf = resConf.vendorIntelligence.qualityAnalytics;
      assert.equal(qConf.temperatureRecordedCount, 1);
      assert.equal(qConf.temperatureFailureCount, 1, 'Evaluated against configured maximum (9.5 > 5)');
      assert.equal(qConf.temperatureRuleConfigured, true);
      assert.equal(qConf.temperatureRuleSource, 'FSSAI-SCHED4-CHILLED');
      assert.equal(qConf.temperatureMaximumAllowed, 5);
    } finally {
      IncomingInspection.find = origInspectFind;
      FoodSafetyTemperatureRule.find = origRuleFind;
    }
  });

  await suite.test('18.5 Price-variance test fixture: ₹100 PO vs ₹110 invoice with line PPV vs gross invoice variance', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origPoFind = PurchaseOrder.find;
    const origInvFind = APInvoice.find;
    const origItemFind = GlobalInventoryItem.find;

    // PO: 10 units of Coffee at ₹100 net unit price = ₹1,000 net commitment
    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-PPV-01',
          vendorId: 'VEN-COFFEE',
          orderDate: '2026-08-01',
          totalPaisa: 100000, // ₹1,000 total PO
          status: 'RECEIVED',
          lineItems: [
            {
              itemId: 'COFFEE-ARABICA',
              itemNameSnapshot: 'Arabica Beans',
              orderedQuantityBase: 10,
              receivedQuantityBase: 10,
              unitPricePaisa: 10000, // ₹100.00 net
              baseUnit: 'kg',
            },
          ],
        },
      ],
    });

    // Invoice: 10 units of Coffee at ₹110 net unit price (₹1,100 net) + ₹198 GST + ₹50 Freight = ₹1,348 gross
    APInvoice.find = () => ({
      lean: async () => [
        {
          invoiceId: 'INV-PPV-01',
          poReferenceId: 'PO-PPV-01',
          vendorId: 'VEN-COFFEE',
          approvalStatus: 'APPROVED',
          paymentStatus: 'UNPAID',
          amountPaisa: 110000, // ₹1,100.00 net item amount
          taxPaisa: 19800,      // ₹198.00 GST
          freightPaisa: 5000,   // ₹50.00 freight
          totalPaisa: 134800,   // ₹1,348.00 gross total
          outstandingPaisa: 134800,
          lines: [
            {
              itemId: 'COFFEE-ARABICA',
              quantity: 10,
              unitPricePaisa: 11000, // ₹110.00 net unit price
              uom: 'kg',
            },
          ],
        },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'COFFEE-ARABICA', name: 'Arabica Beans', baseUnit: 'kg' }],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const s = res.spendSummary;

      // 1. Total PO Commitments: ₹1,000.00 (100000 paise)
      assert.equal(s.totalPoCommitmentsPaisa, 100000);

      // 2. Invoiced Value: ₹1,348.00 gross (134800 paise)
      assert.equal(s.invoicedValuePaisa, 134800);

      // 3. TOTAL_INVOICE_TO_PO_VARIANCE: Gross Invoice - PO = ₹1,348 - ₹1,000 = ₹348 (34800 paise)
      assert.equal(s.totalInvoiceToPoVariancePaisa, 34800);
      assert.equal(s.totalInvoiceToPoVariance, 348.00);

      // 4. Canonical PPV: Line-level comparable net unit price difference
      // (₹110 - ₹100) * 10 = ₹10 * 10 = ₹100.00 (10000 paise), NOT ₹348.00!
      assert.equal(s.purchasePriceVariancePaisa, 10000);
      assert.equal(s.purchasePriceVariancePaise, 10000);
      assert.equal(s.purchasePriceVariancePercent, 10.0); // 10% unit price increase
      assert.equal(s.purchasePriceVarianceAvailability, 'COMPLETE');

      assert.equal(s.lineLevelPpvRecords.length, 1);
      assert.equal(s.lineLevelPpvRecords[0].variancePerUnitPaisa, 1000); // ₹10.00/kg
      assert.equal(s.lineLevelPpvRecords[0].linePpvPaisa, 10000);        // ₹100.00 total PPV
    } finally {
      PurchaseOrder.find = origPoFind;
      APInvoice.find = origInvFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  await suite.test('18.6 PPV UNAVAILABLE cases: rejects incompatible UOM and unlinked invoices', async () => {
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origPoFind = PurchaseOrder.find;
    const origInvFind = APInvoice.find;
    const origItemFind = GlobalInventoryItem.find;

    PurchaseOrder.find = () => ({
      lean: async () => [
        {
          purchaseOrderId: 'PO-UOM-ERR',
          totalPaisa: 50000,
          lineItems: [{ itemId: 'ITEM-OIL', unitPricePaisa: 5000, baseUnit: 'kg' }],
        },
      ],
    });

    APInvoice.find = () => ({
      lean: async () => [
        {
          invoiceId: 'INV-UOM-ERR',
          poReferenceId: 'PO-UOM-ERR',
          approvalStatus: 'APPROVED',
          totalPaisa: 60000,
          lines: [
            // Incompatible UOM (litres vs kg without conversion factor)
            { itemId: 'ITEM-OIL', unitPricePaisa: 6000, uom: 'litres', quantity: 10 },
          ],
        },
      ],
    });

    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'ITEM-OIL', baseUnit: 'kg' }],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      // When UOM is incompatible, PPV must return UNAVAILABLE rather than force a number
      assert.equal(res.spendSummary.purchasePriceVarianceAvailability, 'UNAVAILABLE');
      assert.equal(res.spendSummary.purchasePriceVariancePaisa, null);
      // But gross invoice variance remains accurately reported
      assert.equal(res.spendSummary.totalInvoiceToPoVariancePaisa, 10000);
    } finally {
      PurchaseOrder.find = origPoFind;
      APInvoice.find = origInvFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. PM-02E-R3 DATA-QUALITY, AP-RECOGNITION & RESTRICTED-STOCK VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('19.1 Temperature test matrix: unconfigured, legitimate zero, failure, partial coverage, no readings', async () => {
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origInspectFind = IncomingInspection.find;
    const origRuleFind = FoodSafetyTemperatureRule.find;
    const origItemFind = GlobalInventoryItem.find;

    GlobalInventoryItem.find = () => ({
      lean: async () => [
        { itemId: 'ITM-DAIRY-1', category: 'DAIRY' },
        { itemId: 'ITM-DRY-1', category: 'DRY_GOODS' },
      ],
    });

    try {
      // Case 1: No rule configured + temperature recorded → UNAVAILABLE, not 0 failures
      IncomingInspection.find = () => ({
        lean: async () => [
          { inspectionId: 'INS-T1', itemId: 'ITM-DAIRY-1', temperatureCelsius: 4.0, receivedQuantity: 10, acceptedQuantity: 10 },
        ],
      });
      FoodSafetyTemperatureRule.find = () => ({ lean: async () => [] });

      const res1 = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q1 = res1.vendorIntelligence.qualityAnalytics;
      assert.equal(q1.temperatureRecordedCount, 1);
      assert.equal(q1.temperatureFailureCount, null);
      assert.equal(q1.temperatureFailureAvailability, 'UNAVAILABLE');
      assert.equal(q1.temperatureRuleConfigured, false);
      assert.equal(q1.temperatureRuleSource, 'NOT_CONFIGURED');

      // Case 2: Rule configured + all readings compliant → 0 legitimate failures (COMPLETE)
      FoodSafetyTemperatureRule.find = () => ({
        lean: async () => [
          {
            ruleId: 'RULE-CHILLED',
            processType: 'RECEIVING',
            status: 'ACTIVE',
            foodCategory: 'ALL',
            criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
          },
        ],
      });

      const res2 = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q2 = res2.vendorIntelligence.qualityAnalytics;
      assert.equal(q2.temperatureRecordedCount, 1);
      assert.equal(q2.evaluatedTemperatureCount, 1);
      assert.equal(q2.unevaluatedTemperatureCount, 0);
      assert.equal(q2.temperatureFailureCount, 0);
      assert.equal(q2.temperatureFailureAvailability, 'COMPLETE');

      // Case 3: Rule configured + one failed reading → 1 failure (COMPLETE)
      IncomingInspection.find = () => ({
        lean: async () => [
          { inspectionId: 'INS-T2', itemId: 'ITM-DAIRY-1', temperatureCelsius: 12.0, receivedQuantity: 10, acceptedQuantity: 0, rejectedQuantity: 10 },
        ],
      });

      const res3 = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q3 = res3.vendorIntelligence.qualityAnalytics;
      assert.equal(q3.temperatureRecordedCount, 1);
      assert.equal(q3.evaluatedTemperatureCount, 1);
      assert.equal(q3.temperatureFailureCount, 1);
      assert.equal(q3.temperatureFailureAvailability, 'COMPLETE');

      // Case 4: Mixed evaluable/unevaluable records → PARTIAL
      IncomingInspection.find = () => ({
        lean: async () => [
          // Matches DAIRY rule (compliant at 4°C)
          { inspectionId: 'INS-T3A', itemId: 'ITM-DAIRY-1', temperatureCelsius: 4.0, receivedQuantity: 10 },
          // Category DRY_GOODS has no matching rule for receiving
          { inspectionId: 'INS-T3B', itemId: 'ITM-DRY-1', temperatureCelsius: 22.0, receivedQuantity: 10 },
        ],
      });
      FoodSafetyTemperatureRule.find = () => ({
        lean: async () => [
          {
            ruleId: 'RULE-DAIRY-ONLY',
            processType: 'RECEIVING',
            status: 'ACTIVE',
            foodCategory: 'DAIRY',
            criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 5 }],
          },
        ],
      });

      const res4 = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q4 = res4.vendorIntelligence.qualityAnalytics;
      assert.equal(q4.temperatureRecordedCount, 2);
      assert.equal(q4.evaluatedTemperatureCount, 1);
      assert.equal(q4.unevaluatedTemperatureCount, 1);
      assert.equal(q4.temperatureFailureAvailability, 'PARTIAL');

      // Case 5: No temperature reading → factual zero recorded readings, failure state appropriately UNAVAILABLE
      IncomingInspection.find = () => ({
        lean: async () => [
          { inspectionId: 'INS-T5', itemId: 'ITM-DRY-1', temperatureCelsius: null, receivedQuantity: 10 },
        ],
      });

      const res5 = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q5 = res5.vendorIntelligence.qualityAnalytics;
      assert.equal(q5.temperatureRecordedCount, 0);
      assert.equal(q5.temperatureFailureCount, null);
      assert.equal(q5.temperatureFailureAvailability, 'UNAVAILABLE');
    } finally {
      IncomingInspection.find = origInspectFind;
      FoodSafetyTemperatureRule.find = origRuleFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  await suite.test('19.2 AP recognition precedence: INCOMPLETE and unapproved claims fail safe, POSTED cannot override', async () => {
    const { evaluateApInvoiceFinancialRecognition } = require('../src/reporting/calculations/procurementCalculations');
    const { APInvoice } = require('../src/models/APInvoice');
    const origInvFind = APInvoice.find;

    // 1. INCOMPLETE validationStatus is excluded even if APPROVED and POSTED
    const incAppPosted = evaluateApInvoiceFinancialRecognition({
      validationStatus: 'INCOMPLETE',
      approvalStatus: 'APPROVED',
      accountingStatus: 'POSTED',
      paymentStatus: 'UNPAID',
      totalPaisa: 50000,
      outstandingPaisa: 50000,
    });
    assert.equal(incAppPosted.recognized, false);
    assert.equal(incAppPosted.invoicedValueEligible, false);
    assert.equal(incAppPosted.outstandingEligible, false);
    assert.ok(incAppPosted.reason.includes('INCOMPLETE'));

    // 2. PENDING approvalStatus is excluded even if VALIDATED and POSTED (POSTED cannot override unapproved)
    const valPendingPosted = evaluateApInvoiceFinancialRecognition({
      validationStatus: 'VALIDATED',
      approvalStatus: 'PENDING',
      accountingStatus: 'POSTED',
      paymentStatus: 'UNPAID',
      totalPaisa: 60000,
      outstandingPaisa: 60000,
    });
    assert.equal(valPendingPosted.recognized, false);
    assert.equal(valPendingPosted.invoicedValueEligible, false);
    assert.equal(valPendingPosted.outstandingEligible, false);

    // 3. REJECTED approvalStatus is excluded even if POSTED
    const valRejectedPosted = evaluateApInvoiceFinancialRecognition({
      validationStatus: 'VALIDATED',
      approvalStatus: 'REJECTED',
      accountingStatus: 'POSTED',
      paymentStatus: 'ON_HOLD',
      totalPaisa: 70000,
      outstandingPaisa: 70000,
    });
    assert.equal(valRejectedPosted.recognized, false);

    // 4. VALIDATED + APPROVED + UNACCOUNTED is recognized as approved commercial liability, but not GL posted
    const valAppUnacc = evaluateApInvoiceFinancialRecognition({
      validationStatus: 'VALIDATED',
      approvalStatus: 'APPROVED',
      accountingStatus: 'UNACCOUNTED',
      paymentStatus: 'UNPAID',
      totalPaisa: 40000,
      outstandingPaisa: 40000,
    });
    assert.equal(valAppUnacc.recognized, true);
    assert.equal(valAppUnacc.invoicedValueEligible, true);
    assert.equal(valAppUnacc.outstandingEligible, true);
    assert.equal(valAppUnacc.glPosted, false);
    assert.equal(valAppUnacc.trustState, 'APPROVED_COMMERCIAL_LIABILITY');

    // 5. VALIDATED + APPROVED + POSTED is recognized as GL posted liability
    const valAppPosted = evaluateApInvoiceFinancialRecognition({
      validationStatus: 'VALIDATED',
      approvalStatus: 'APPROVED',
      accountingStatus: 'POSTED',
      paymentStatus: 'UNPAID',
      totalPaisa: 80000,
      outstandingPaisa: 80000,
    });
    assert.equal(valAppPosted.recognized, true);
    assert.equal(valAppPosted.glPosted, true);
    assert.equal(valAppPosted.trustState, 'GL_POSTED_LIABILITY');

    // 6. Integration test: Inconsistent fixtures fail safe in calculateProcurementMetrics
    APInvoice.find = () => ({
      lean: async () => [
        // Valid approved
        { invoiceId: 'INV-GOOD', vendorId: 'V1', validationStatus: 'VALIDATED', approvalStatus: 'APPROVED', accountingStatus: 'POSTED', paymentStatus: 'UNPAID', totalPaisa: 25000, outstandingPaisa: 25000 },
        // Inconsistent: INCOMPLETE + APPROVED + POSTED
        { invoiceId: 'INV-BAD-VAL', vendorId: 'V1', validationStatus: 'INCOMPLETE', approvalStatus: 'APPROVED', accountingStatus: 'POSTED', paymentStatus: 'UNPAID', totalPaisa: 99999, outstandingPaisa: 99999 },
        // Inconsistent: VALIDATED + PENDING + POSTED
        { invoiceId: 'INV-BAD-APP', vendorId: 'V1', validationStatus: 'VALIDATED', approvalStatus: 'PENDING', accountingStatus: 'POSTED', paymentStatus: 'UNPAID', totalPaisa: 88888, outstandingPaisa: 88888 },
      ],
    });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      // Only INV-GOOD enters invoiced spend and outstanding payables
      assert.equal(res.spendSummary.invoicedValuePaisa, 25000);
      assert.equal(res.spendSummary.outstandingPayablePaisa, 25000);
    } finally {
      APInvoice.find = origInvFind;
    }
  });

  await suite.test('19.3 Restricted inventory valuation: physical on-hand, available for use, quarantine, recall hold, and expired exposure', async () => {
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;

    const mockLots = [
      // Available for use: 50 units @ ₹100 = ₹5,000
      { lotId: 'L-AVAIL', itemId: 'ITEM-A', status: 'AVAILABLE', remainingQuantity: 50, expiryDate: '2028-01-01' },
      // Quarantine: 20 units @ ₹100 = ₹2,000 (restricted exposure)
      { lotId: 'L-QUAR', itemId: 'ITEM-A', status: 'QUARANTINE', remainingQuantity: 20, expiryDate: '2028-01-01' },
      // Recall-Hold: 15 units @ ₹100 = ₹1,500 (restricted exposure)
      { lotId: 'L-RECALL', itemId: 'ITEM-A', status: 'RECALL_HOLD', remainingQuantity: 15, expiryDate: '2028-01-01' },
      // Expired: 10 units @ ₹100 = ₹1,000 (expired exposure)
      { lotId: 'L-EXP', itemId: 'ITEM-A', status: 'EXPIRED', remainingQuantity: 10, expiryDate: '2025-01-01' },
      // Depleted: 0 units = ₹0 (excluded)
      { lotId: 'L-DEP', itemId: 'ITEM-A', status: 'DEPLETED', remainingQuantity: 0, expiryDate: '2028-01-01' },
      // Disposed: 5 units = ₹0 (physically removed)
      { lotId: 'L-DISP', itemId: 'ITEM-A', status: 'DISPOSED', remainingQuantity: 5, expiryDate: '2025-01-01' },
      // Returned: 5 units = ₹0 (physically returned to vendor)
      { lotId: 'L-RET', itemId: 'ITEM-A', status: 'RETURNED', remainingQuantity: 5, expiryDate: '2028-01-01' },
    ];

    InventoryLot.find = () => ({ lean: async () => mockLots });
    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'ITEM-A', name: 'Arabica Coffee', unitCostPaisa: 10000 }], // ₹100.00
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A });
      const s = res.summary;

      // 1. Physical on-hand: 50 + 20 + 15 + 10 = 95 units
      assert.equal(s.physicalOnHandQuantity, 95);
      assert.equal(s.physicalOnHandStandardValuePaisa, 950000); // ₹9,500.00
      assert.equal(s.physicalOnHandStandardValue, 9500);

      // 2. Available for use: 50 units
      assert.equal(s.availableForUseQuantity, 50);
      assert.equal(s.availableForUseStandardValuePaisa, 500000); // ₹5,000.00
      assert.equal(s.availableForUseStandardValue, 5000);

      // 3. Quarantine restricted exposure: 20 units
      assert.equal(s.quarantineQuantity, 20);
      assert.equal(s.quarantineStandardValuePaisa, 200000); // ₹2,000.00
      assert.equal(s.quarantineStandardValue, 2000);

      // 4. Recall-hold restricted exposure: 15 units
      assert.equal(s.recallHoldQuantity, 15);
      assert.equal(s.recallHoldStandardValuePaisa, 150000); // ₹1,500.00
      assert.equal(s.recallHoldStandardValue, 1500);

      // 5. Expired stock exposure: 10 units
      assert.equal(s.expiredQuantity, 10);
      assert.equal(s.expiredStandardCostExposurePaisa, 100000); // ₹1,000.00
      assert.equal(s.expiredStandardCostExposure, 1000);

      // 6. Perfect decomposition invariant:
      // physicalOnHandValue == availableForUse + quarantine + recallHold + expired
      assert.equal(
        s.physicalOnHandStandardValuePaisa,
        s.availableForUseStandardValuePaisa + s.quarantineStandardValuePaisa + s.recallHoldStandardValuePaisa + s.expiredStandardCostExposurePaisa
      );

      // 7. Valuation cost basis & disclaimer
      assert.equal(s.valuationCostBasis, 'OPERATIONAL_STANDARD_COST_VALUATION');
      assert.ok(s.valuationDisclaimer.includes('Operational standard cost exposure only'));
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. PM-02E-R4: RESTRICTED INVENTORY CLASSIFICATION & TEMPERATURE PRECEDENCE
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('20.1 Double-condition inventory exposure test matrix covering all 12 combinations', async () => {
    const { classifyInventoryExposure } = require('../src/reporting/calculations/inventoryCalculations');
    const reportingDate = '2026-09-09';

    // 1. AVAILABLE + not expired
    const c1 = classifyInventoryExposure({ status: 'AVAILABLE', expiryDate: '2027-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c1.exposureBucket, 'AVAILABLE_FOR_USE');
    assert.equal(c1.persistedStatus, 'AVAILABLE');
    assert.equal(c1.derivedCondition, 'NORMAL');
    assert.equal(c1.isPhysicalOnHand, true);
    assert.equal(c1.isAvailableForUse, true);

    // 2. AVAILABLE + expired
    const c2 = classifyInventoryExposure({ status: 'AVAILABLE', expiryDate: '2025-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c2.exposureBucket, 'EXPIRED_EXPOSURE');
    assert.equal(c2.persistedStatus, 'AVAILABLE');
    assert.equal(c2.derivedCondition, 'EXPIRED');
    assert.equal(c2.isPhysicalOnHand, true);
    assert.equal(c2.isAvailableForUse, false);

    // 3. NEAR_EXPIRY + not expired
    const c3 = classifyInventoryExposure({ status: 'NEAR_EXPIRY', expiryDate: '2026-09-20', remainingQuantity: 10 }, reportingDate);
    assert.equal(c3.exposureBucket, 'AVAILABLE_FOR_USE');
    assert.equal(c3.persistedStatus, 'NEAR_EXPIRY');
    assert.equal(c3.derivedCondition, 'NEAR_EXPIRY');
    assert.equal(c3.isPhysicalOnHand, true);
    assert.equal(c3.isAvailableForUse, true);

    // 4. NEAR_EXPIRY + expired
    const c4 = classifyInventoryExposure({ status: 'NEAR_EXPIRY', expiryDate: '2025-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c4.exposureBucket, 'EXPIRED_EXPOSURE');
    assert.equal(c4.persistedStatus, 'NEAR_EXPIRY');
    assert.equal(c4.derivedCondition, 'EXPIRED');
    assert.equal(c4.isPhysicalOnHand, true);
    assert.equal(c4.isAvailableForUse, false);

    // 5. QUARANTINE + not expired
    const c5 = classifyInventoryExposure({ status: 'QUARANTINE', expiryDate: '2027-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c5.exposureBucket, 'QUARANTINE');
    assert.equal(c5.persistedStatus, 'QUARANTINE');
    assert.equal(c5.derivedCondition, 'NORMAL');
    assert.equal(c5.isPhysicalOnHand, true);
    assert.equal(c5.isAvailableForUse, false);

    // 6. QUARANTINE + expired (Condition-over-restriction precedence)
    const c6 = classifyInventoryExposure({ status: 'QUARANTINE', expiryDate: '2025-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c6.exposureBucket, 'EXPIRED_EXPOSURE');
    assert.equal(c6.persistedStatus, 'QUARANTINE'); // Persisted status preserved, MongoDB not mutated!
    assert.equal(c6.derivedCondition, 'EXPIRED');
    assert.equal(c6.isPhysicalOnHand, true);
    assert.equal(c6.isAvailableForUse, false);

    // 7. RECALL_HOLD + not expired
    const c7 = classifyInventoryExposure({ status: 'RECALL_HOLD', expiryDate: '2027-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c7.exposureBucket, 'RECALL_HOLD');
    assert.equal(c7.persistedStatus, 'RECALL_HOLD');
    assert.equal(c7.derivedCondition, 'NORMAL');
    assert.equal(c7.isPhysicalOnHand, true);
    assert.equal(c7.isAvailableForUse, false);

    // 8. RECALL_HOLD + expired (Condition-over-restriction precedence)
    const c8 = classifyInventoryExposure({ status: 'RECALL_HOLD', expiryDate: '2025-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c8.exposureBucket, 'EXPIRED_EXPOSURE');
    assert.equal(c8.persistedStatus, 'RECALL_HOLD');
    assert.equal(c8.derivedCondition, 'EXPIRED');
    assert.equal(c8.isPhysicalOnHand, true);
    assert.equal(c8.isAvailableForUse, false);

    // 9. EXPIRED
    const c9 = classifyInventoryExposure({ status: 'EXPIRED', expiryDate: '2025-01-01', remainingQuantity: 10 }, reportingDate);
    assert.equal(c9.exposureBucket, 'EXPIRED_EXPOSURE');
    assert.equal(c9.persistedStatus, 'EXPIRED');
    assert.equal(c9.derivedCondition, 'EXPIRED');
    assert.equal(c9.isPhysicalOnHand, true);
    assert.equal(c9.isAvailableForUse, false);

    // 10. DEPLETED
    const c10 = classifyInventoryExposure({ status: 'DEPLETED', expiryDate: '2027-01-01', remainingQuantity: 0 }, reportingDate);
    assert.equal(c10.exposureBucket, 'REMOVED');
    assert.equal(c10.isPhysicalOnHand, false);
    assert.equal(c10.isAvailableForUse, false);

    // 11. DISPOSED
    const c11 = classifyInventoryExposure({ status: 'DISPOSED', expiryDate: '2025-01-01', remainingQuantity: 5 }, reportingDate);
    assert.equal(c11.exposureBucket, 'REMOVED');
    assert.equal(c11.isPhysicalOnHand, false);
    assert.equal(c11.isAvailableForUse, false);

    // 12. RETURNED
    const c12 = classifyInventoryExposure({ status: 'RETURNED', expiryDate: '2027-01-01', remainingQuantity: 5 }, reportingDate);
    assert.equal(c12.exposureBucket, 'REMOVED');
    assert.equal(c12.isPhysicalOnHand, false);
    assert.equal(c12.isAvailableForUse, false);
  });

  await suite.test('20.2 Mutually exclusive decomposition invariants: exact integer paise and unit quantity reconciliation', async () => {
    const { InventoryLot } = require('../src/models/InventoryLot');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const origLotFind = InventoryLot.find;
    const origItemFind = GlobalInventoryItem.find;

    const mockLots = [
      { lotId: 'L-01', itemId: 'ITEM-X', status: 'AVAILABLE', remainingQuantity: 10, expiryDate: '2028-01-01' },   // 10 units @ 100 = 1000
      { lotId: 'L-02', itemId: 'ITEM-X', status: 'NEAR_EXPIRY', remainingQuantity: 15, expiryDate: '2028-01-01' }, // 15 units @ 100 = 1500
      { lotId: 'L-03', itemId: 'ITEM-X', status: 'AVAILABLE', remainingQuantity: 5, expiryDate: '2024-01-01' },    // 5 units @ 100 = 500 (expired)
      { lotId: 'L-04', itemId: 'ITEM-X', status: 'QUARANTINE', remainingQuantity: 8, expiryDate: '2028-01-01' },   // 8 units @ 100 = 800
      { lotId: 'L-05', itemId: 'ITEM-X', status: 'QUARANTINE', remainingQuantity: 12, expiryDate: '2024-01-01' },  // 12 units @ 100 = 1200 (expired quarantine)
      { lotId: 'L-06', itemId: 'ITEM-X', status: 'RECALL_HOLD', remainingQuantity: 7, expiryDate: '2028-01-01' },  // 7 units @ 100 = 700
      { lotId: 'L-07', itemId: 'ITEM-X', status: 'RECALL_HOLD', remainingQuantity: 6, expiryDate: '2024-01-01' },  // 6 units @ 100 = 600 (expired recall)
      { lotId: 'L-08', itemId: 'ITEM-X', status: 'EXPIRED', remainingQuantity: 4, expiryDate: '2024-01-01' },      // 4 units @ 100 = 400
      { lotId: 'L-09', itemId: 'ITEM-X', status: 'DEPLETED', remainingQuantity: 0, expiryDate: '2028-01-01' },     // 0 units (removed)
      { lotId: 'L-10', itemId: 'ITEM-X', status: 'DISPOSED', remainingQuantity: 5, expiryDate: '2024-01-01' },     // 5 units (removed)
      { lotId: 'L-11', itemId: 'ITEM-X', status: 'RETURNED', remainingQuantity: 5, expiryDate: '2028-01-01' },     // 5 units (removed)
    ];

    InventoryLot.find = () => ({ lean: async () => mockLots });
    GlobalInventoryItem.find = () => ({
      lean: async () => [{ itemId: 'ITEM-X', name: 'Specialty Beans', unitCostPaisa: 10000 }], // ₹100.00
    });

    try {
      const res = await calculateInventoryMetrics({ organisationId: ORG_A });
      const s = res.summary;

      // 1. Physical on-hand: 10 + 15 + 5 + 8 + 12 + 7 + 6 + 4 = 67 units
      assert.equal(s.physicalOnHandQuantity, 67);
      assert.equal(s.physicalOnHandStandardValuePaisa, 670000); // ₹6,700.00
      assert.equal(s.physicalOnHandStandardValue, 6700);

      // 2. Available for use: 10 + 15 = 25 units
      assert.equal(s.availableForUseQuantity, 25);
      assert.equal(s.availableForUseStandardValuePaisa, 250000); // ₹2,500.00
      assert.equal(s.availableForUseStandardValue, 2500);

      // 3. Quarantine (unexpired only): 8 units
      assert.equal(s.quarantineQuantity, 8);
      assert.equal(s.quarantineStandardValuePaisa, 80000); // ₹800.00
      assert.equal(s.quarantineStandardValue, 800);

      // 4. Recall-hold (unexpired only): 7 units
      assert.equal(s.recallHoldQuantity, 7);
      assert.equal(s.recallHoldStandardValuePaisa, 70000); // ₹700.00
      assert.equal(s.recallHoldStandardValue, 700);

      // 5. Expired stock exposure (all expired lots): 5 + 12 + 6 + 4 = 27 units
      assert.equal(s.expiredQuantity, 27);
      assert.equal(s.expiredExposureQuantity, 27);
      assert.equal(s.expiredStandardCostExposurePaisa, 270000); // ₹2,700.00
      assert.equal(s.expiredStandardCostExposure, 2700);

      // 6. Value decomposition exact integer paise invariant:
      // physicalOnHandStandardValuePaisa === available + quarantine + recallHold + expired
      const sumExposureValuesPaisa = s.availableForUseStandardValuePaisa +
        s.quarantineStandardValuePaisa +
        s.recallHoldStandardValuePaisa +
        s.expiredStandardCostExposurePaisa;
      assert.equal(s.physicalOnHandStandardValuePaisa, sumExposureValuesPaisa, 'Value decomposition invariant must hold with zero paise error');

      // 7. Quantity decomposition exact unit invariant:
      // physicalOnHandQuantity === available + quarantine + recallHold + expired
      const sumExposureQuantities = s.availableForUseQuantity +
        s.quarantineQuantity +
        s.recallHoldQuantity +
        s.expiredQuantity;
      assert.equal(s.physicalOnHandQuantity, sumExposureQuantities, 'Quantity decomposition invariant must hold with zero unit error');

      // 8. Invariant verification flag in summary
      assert.equal(s.decompositionInvariantVerified, true);
      assert.equal(s.exposureClassificationMethodology, 'CONDITION_OVER_RESTRICTION');
    } finally {
      InventoryLot.find = origLotFind;
      GlobalInventoryItem.find = origItemFind;
    }
  });

  await suite.test('20.3 Legacy ON_HOLD normalization provenance: statusSource = LEGACY_NORMALIZED', async () => {
    const { classifyInventoryExposure } = require('../src/reporting/calculations/inventoryCalculations');
    const { LOT_STATUSES } = require('../src/models/InventoryLot');

    // Canonical schema enum does not contain ON_HOLD
    assert.equal(LOT_STATUSES.includes('ON_HOLD'), false, 'Canonical schema enum must not contain ON_HOLD');

    // Normalization test
    const legacyLot = {
      lotId: 'LOT-LEGACY-01',
      itemId: 'ITEM-A',
      status: 'ON_HOLD',
      remainingQuantity: 25,
      expiryDate: '2028-01-01',
    };

    const classified = classifyInventoryExposure(legacyLot, '2026-09-09');
    assert.equal(classified.rawStatus, 'ON_HOLD');
    assert.equal(classified.persistedStatus, 'RECALL_HOLD');
    assert.equal(classified.statusSource, 'LEGACY_NORMALIZED');
    assert.equal(classified.exposureBucket, 'RECALL_HOLD');
    assert.equal(classified.isPhysicalOnHand, true);
    assert.equal(classified.isAvailableForUse, false);
  });

  await suite.test('20.4 Temperature rule specificity hierarchy: Cafe+Category > Cafe+ALL > Org+Category > Org+ALL', async () => {
    const { resolveTemperatureRule } = require('../src/reporting/calculations/procurementCalculations');

    const rules = [
      {
        ruleId: 'RULE-ORG-ALL',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: null,
        foodCategory: 'ALL',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 10 }],
      },
      {
        ruleId: 'RULE-ORG-DAIRY',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: null,
        foodCategory: 'DAIRY',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
      },
      {
        ruleId: 'RULE-CAFE1-ALL',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: CAFE_1,
        foodCategory: 'ALL',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 6 }],
      },
      {
        ruleId: 'RULE-CAFE1-DAIRY',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: CAFE_1,
        foodCategory: 'DAIRY',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
      },
    ];

    const itemMap = {
      'ITEM-MILK': { itemId: 'ITEM-MILK', category: 'DAIRY' },
      'ITEM-BEANS': { itemId: 'ITEM-BEANS', category: 'COFFEE_BEANS' },
    };

    // Case 1: Cafe 1 + DAIRY inspection -> All 4 rules match, Level 4 (Cafe1+Dairy) must win
    const r1 = resolveTemperatureRule({ cafeId: CAFE_1, itemId: 'ITEM-MILK' }, rules, itemMap);
    assert.equal(r1.status, 'MATCHED');
    assert.equal(r1.ruleId, 'RULE-CAFE1-DAIRY');
    assert.equal(r1.specificity, 4);
    assert.equal(r1.scope, 'CAFE_FOOD_CATEGORY');

    // Case 2: Cafe 1 + BEANS inspection -> Cafe1+ALL and Org+ALL match, Level 3 (Cafe1+ALL) must win
    const r2 = resolveTemperatureRule({ cafeId: CAFE_1, itemId: 'ITEM-BEANS' }, rules, itemMap);
    assert.equal(r2.status, 'MATCHED');
    assert.equal(r2.ruleId, 'RULE-CAFE1-ALL');
    assert.equal(r2.specificity, 3);
    assert.equal(r2.scope, 'CAFE_ALL');

    // Case 3: Cafe 2 + DAIRY inspection -> Org+Dairy and Org+ALL match, Level 2 (Org+Dairy) must win
    const r3 = resolveTemperatureRule({ cafeId: CAFE_2, itemId: 'ITEM-MILK' }, rules, itemMap);
    assert.equal(r3.status, 'MATCHED');
    assert.equal(r3.ruleId, 'RULE-ORG-DAIRY');
    assert.equal(r3.specificity, 2);
    assert.equal(r3.scope, 'ORGANISATION_FOOD_CATEGORY');

    // Case 4: Cafe 2 + BEANS inspection -> Only Org+ALL matches, Level 1 (Org+ALL) wins
    const r4 = resolveTemperatureRule({ cafeId: CAFE_2, itemId: 'ITEM-BEANS' }, rules, itemMap);
    assert.equal(r4.status, 'MATCHED');
    assert.equal(r4.ruleId, 'RULE-ORG-ALL');
    assert.equal(r4.specificity, 1);
    assert.equal(r4.scope, 'ORGANISATION_ALL');
  });

  await suite.test('20.5 Ambiguous equal-priority temperature rules degrade safely to AMBIGUOUS_RULE_CONFIGURATION and PARTIAL', async () => {
    const { resolveTemperatureRule, calculateProcurementMetrics } = require('../src/reporting/calculations/procurementCalculations');
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const { Vendor } = require('../src/models/Vendor');

    const origInspFind = IncomingInspection.find;
    const origRuleFind = FoodSafetyTemperatureRule.find;
    const origItemFind = GlobalInventoryItem.find;
    const origPoFind = PurchaseOrder.find;
    const origInvFind = APInvoice.find;
    const origVenFind = Vendor.find;

    // Two active rules with identical top specificity (Level 2: Org+DAIRY) but conflicting criteria:
    const conflictingRules = [
      {
        ruleId: 'RULE-DAIRY-STRICT',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: null,
        foodCategory: 'DAIRY',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
      },
      {
        ruleId: 'RULE-DAIRY-RELAXED',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: null,
        foodCategory: 'DAIRY',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 7 }],
      },
    ];

    const itemMap = {
      'ITEM-MILK': { itemId: 'ITEM-MILK', category: 'DAIRY' },
    };

    // Direct resolution test
    const resolution = resolveTemperatureRule({ cafeId: CAFE_1, itemId: 'ITEM-MILK' }, conflictingRules, itemMap);
    assert.equal(resolution.status, 'AMBIGUOUS_RULE_CONFIGURATION');
    assert.equal(resolution.isAmbiguous, true);
    assert.equal(resolution.rule, null);
    assert.ok(resolution.reason.includes('AMBIGUOUS_RULE_CONFIGURATION'));

    // Engine-level integration test: verify no silent arbitrary selection and degradation to PARTIAL
    IncomingInspection.find = () => ({
      lean: async () => [
        {
          inspectionId: 'INS-01',
          cafeId: CAFE_1,
          itemId: 'ITEM-MILK',
          receivedQuantity: 50,
          temperatureCelsius: 5.5, // Fails strict (5.5 > 4), passes relaxed (5.5 <= 7)
        },
      ],
    });
    FoodSafetyTemperatureRule.find = () => ({ lean: async () => conflictingRules });
    GlobalInventoryItem.find = () => ({ lean: async () => [{ itemId: 'ITEM-MILK', name: 'Fresh Milk', category: 'DAIRY' }] });
    PurchaseOrder.find = () => ({ lean: async () => [] });
    APInvoice.find = () => ({ lean: async () => [] });
    Vendor.find = () => ({ lean: async () => [] });

    try {
      const res = await calculateProcurementMetrics({ organisationId: ORG_A });
      const q = res.vendorIntelligence.qualityAnalytics;

      // Evaluation must NOT pick one rule silently!
      // Must degrade to PARTIAL or UNAVAILABLE
      assert.equal(q.temperatureRuleAmbiguous, true, 'Ambiguity flag must be raised');
      assert.equal(q.ambiguousRuleCount, 1, 'Exactly 1 ambiguous evaluation');
      assert.equal(q.evaluatedTemperatureCount, 0, 'Zero silent arbitrary evaluations');
      assert.equal(q.unevaluatedTemperatureCount, 1, 'Ambiguous reading marked unevaluated');
      assert.equal(q.temperatureFailureAvailability, 'UNAVAILABLE', 'Degraded safely because evaluated count is 0');
    } finally {
      IncomingInspection.find = origInspFind;
      FoodSafetyTemperatureRule.find = origRuleFind;
      GlobalInventoryItem.find = origItemFind;
      PurchaseOrder.find = origPoFind;
      APInvoice.find = origInvFind;
      Vendor.find = origVenFind;
    }
  });

  await suite.test('21. PM-02E-R5 Historical temperature-rule effective-dating & temporal applicability suite', async (s21) => {
    const { resolveTemperatureRule, calculateProcurementMetrics } = require('../src/reporting/calculations/procurementCalculations');
    const { IncomingInspection } = require('../src/models/IncomingInspection');
    const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
    const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
    const { PurchaseOrder } = require('../src/models/PurchaseOrder');
    const { APInvoice } = require('../src/models/APInvoice');
    const { Vendor } = require('../src/models/Vendor');

    const itemMap = {
      'ITEM-MILK': { itemId: 'ITEM-MILK', category: 'DAIRY' },
      'ITEM-BEANS': { itemId: 'ITEM-BEANS', category: 'COFFEE_BEANS' },
    };

    await s21.test('21.1 Inspection before rule effectiveFrom must be ignored/unevaluated', () => {
      const rules = [
        {
          ruleId: 'RULE-2026-OCT',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2026-10-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 5 }],
        },
      ];
      // Inspection on 2026-09-15 is before 2026-10-01
      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-BEANS',
        inspectedAt: '2026-09-15T10:00:00.000Z',
        temperatureCelsius: 4,
      }, rules, itemMap);

      assert.equal(res.status, 'NO_HISTORICALLY_APPLICABLE_RULE');
      assert.equal(res.rule, null);
      assert.equal(res.temporalApplicability, 'UNAVAILABLE');
    });

    await s21.test('21.2 Inspection exactly at effectiveFrom is historically applicable (inclusive boundary)', () => {
      const rules = [
        {
          ruleId: 'RULE-2026-OCT',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2026-10-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 5 }],
        },
      ];
      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-BEANS',
        inspectedAt: '2026-10-01T00:00:00.000Z',
        temperatureCelsius: 4,
      }, rules, itemMap);

      assert.equal(res.status, 'MATCHED');
      assert.equal(res.ruleId, 'RULE-2026-OCT');
      assert.equal(res.temporalApplicability, 'COMPLETE');
    });

    await s21.test('21.3 Historical V1 vs V2 replacement: March inspection -> V1, August inspection -> V2', () => {
      const rules = [
        {
          ruleId: 'RULE-DAIRY-V1',
          processType: 'RECEIVING',
          status: 'SUPERSEDED',
          active: false,
          version: 1,
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2026-07-01T00:00:00.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 6 }],
        },
        {
          ruleId: 'RULE-DAIRY-V2',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          active: true,
          version: 2,
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
        },
      ];

      // March inspection -> V1
      const resMarch = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-03-15T11:00:00.000Z',
        temperatureCelsius: 5,
      }, rules, itemMap);

      assert.equal(resMarch.status, 'MATCHED');
      assert.equal(resMarch.ruleId, 'RULE-DAIRY-V1');
      assert.equal(resMarch.version, 1);
      assert.equal(resMarch.rule.criteria[0].maximumTemperatureC, 6);

      // August inspection -> V2
      const resAugust = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-08-15T11:00:00.000Z',
        temperatureCelsius: 5,
      }, rules, itemMap);

      assert.equal(resAugust.status, 'MATCHED');
      assert.equal(resAugust.ruleId, 'RULE-DAIRY-V2');
      assert.equal(resAugust.version, 2);
      assert.equal(resAugust.rule.criteria[0].maximumTemperatureC, 4);
    });

    await s21.test('21.4 Future rule ignored even if more specific', () => {
      const rules = [
        {
          ruleId: 'RULE-ORG-ALL-JAN',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 10 }],
        },
        {
          ruleId: 'RULE-CAFE1-DAIRY-DEC',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 3 }],
        },
      ];

      // Inspection in June 2026: Cafe1+Dairy is Level 4 specificity, but future! Org+ALL (Level 1) must win.
      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-06-15T10:00:00.000Z',
        temperatureCelsius: 7,
      }, rules, itemMap);

      assert.equal(res.status, 'MATCHED');
      assert.equal(res.ruleId, 'RULE-ORG-ALL-JAN');
      assert.equal(res.specificity, 1);
    });

    await s21.test('21.5 Inactive historical rule remains historically applicable', () => {
      const rules = [
        {
          ruleId: 'RULE-OLD-INACTIVE',
          processType: 'RECEIVING',
          status: 'INACTIVE',
          active: false,
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2025-01-01T00:00:00.000Z',
          effectiveTo: '2025-12-31T23:59:59.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
        },
      ];

      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-BEANS',
        inspectedAt: '2025-06-01T12:00:00.000Z',
        temperatureCelsius: 5,
      }, rules, itemMap);

      assert.equal(res.status, 'MATCHED');
      assert.equal(res.ruleId, 'RULE-OLD-INACTIVE');
    });

    await s21.test('21.6 Current rule must not rewrite historical inspection evaluation', () => {
      // Rule V1 was max 8C in March; Rule V2 is max 4C in August
      // An inspection of 6C in March passed under V1. Current rule V2 must NOT rewrite it as a failure!
      const rules = [
        {
          ruleId: 'RULE-V1',
          processType: 'RECEIVING',
          status: 'SUPERSEDED',
          active: false,
          version: 1,
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2026-07-01T00:00:00.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
        },
        {
          ruleId: 'RULE-V2',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          active: true,
          version: 2,
          cafeId: null,
          foodCategory: 'ALL',
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
        },
      ];

      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-BEANS',
        inspectedAt: '2026-03-10T10:00:00.000Z',
        temperatureCelsius: 6,
      }, rules, itemMap);

      assert.equal(res.ruleId, 'RULE-V1');
      assert.equal(res.rule.criteria[0].maximumTemperatureC, 8);
      // 6C <= 8C is compliant
      assert.ok(6 <= res.rule.criteria[0].maximumTemperatureC);
    });

    await s21.test('21.7 updatedAt metadata edit does not alter business effective date', () => {
      const rule = {
        ruleId: 'RULE-METADATA-EDIT',
        processType: 'RECEIVING',
        status: 'ACTIVE',
        cafeId: null,
        foodCategory: 'ALL',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        updatedAt: '2026-09-01T15:30:00.000Z', // September metadata edit
        createdAt: '2026-01-01T00:00:00.000Z',
        criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 5 }],
      };

      // Inspection in March 2026
      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-BEANS',
        inspectedAt: '2026-03-01T00:00:00.000Z',
      }, [rule], itemMap);

      assert.equal(res.status, 'MATCHED');
      assert.equal(res.effectiveFrom, '2026-01-01T00:00:00.000Z');
      assert.equal(res.effectiveAt, '2026-01-01T00:00:00.000Z');
      assert.notEqual(res.effectiveAt, '2026-09-01T15:30:00.000Z');
    });

    await s21.test('21.8 Missing historical rule reports UNAVAILABLE and not zero failures', async () => {
      const origInspFind = IncomingInspection.find;
      const origRuleFind = FoodSafetyTemperatureRule.find;
      const origItemFind = GlobalInventoryItem.find;
      const origPoFind = PurchaseOrder.find;
      const origInvFind = APInvoice.find;
      const origVenFind = Vendor.find;

      // 1 historical inspection in 2025, but rules only start in 2026
      IncomingInspection.find = () => ({
        lean: async () => [
          {
            inspectionId: 'INS-HIST-01',
            cafeId: CAFE_1,
            itemId: 'ITEM-MILK',
            receivedQuantity: 20,
            inspectedAt: '2025-05-10T10:00:00.000Z',
            temperatureCelsius: 8.5,
          },
        ],
      });
      FoodSafetyTemperatureRule.find = () => ({
        lean: async () => [
          {
            ruleId: 'RULE-2026-NEW',
            processType: 'RECEIVING',
            status: 'ACTIVE',
            cafeId: null,
            foodCategory: 'ALL',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
          },
        ],
      });
      GlobalInventoryItem.find = () => ({ lean: async () => [{ itemId: 'ITEM-MILK', category: 'DAIRY' }] });
      PurchaseOrder.find = () => ({ lean: async () => [] });
      APInvoice.find = () => ({ lean: async () => [] });
      Vendor.find = () => ({ lean: async () => [] });

      try {
        const res = await calculateProcurementMetrics({ organisationId: ORG_A });
        const q = res.vendorIntelligence.qualityAnalytics;

        assert.equal(q.temperatureRecordedCount, 1);
        assert.equal(q.evaluatedTemperatureCount, 0);
        assert.equal(q.unevaluatedTemperatureCount, 1);
        assert.equal(q.temperatureFailureCount, null, 'Unknown history must NOT be reported as 0 failures');
        assert.equal(q.temperatureFailureAvailability, 'UNAVAILABLE');
        assert.equal(q.temporalApplicability, 'UNAVAILABLE');
        assert.equal(q.historicalRuleAvailability, 'UNAVAILABLE');
      } finally {
        IncomingInspection.find = origInspFind;
        FoodSafetyTemperatureRule.find = origRuleFind;
        GlobalInventoryItem.find = origItemFind;
        PurchaseOrder.find = origPoFind;
        APInvoice.find = origInvFind;
        Vendor.find = origVenFind;
      }
    });

    await s21.test('21.9 Partial historical rule coverage reports PARTIAL availability', async () => {
      const origInspFind = IncomingInspection.find;
      const origRuleFind = FoodSafetyTemperatureRule.find;
      const origItemFind = GlobalInventoryItem.find;
      const origPoFind = PurchaseOrder.find;
      const origInvFind = APInvoice.find;
      const origVenFind = Vendor.find;

      // 10 inspections: 7 in 2026 (covered), 3 in 2025 (uncovered)
      const mockInspections = [];
      for (let i = 1; i <= 7; i++) {
        mockInspections.push({
          inspectionId: `INS-2026-${i}`,
          cafeId: CAFE_1,
          itemId: 'ITEM-MILK',
          receivedQuantity: 10,
          inspectedAt: '2026-03-10T10:00:00.000Z',
          temperatureCelsius: 3.5, // compliant with max 4
        });
      }
      for (let i = 1; i <= 3; i++) {
        mockInspections.push({
          inspectionId: `INS-2025-${i}`,
          cafeId: CAFE_1,
          itemId: 'ITEM-MILK',
          receivedQuantity: 10,
          inspectedAt: '2025-11-10T10:00:00.000Z',
          temperatureCelsius: 3.5,
        });
      }

      IncomingInspection.find = () => ({ lean: async () => mockInspections });
      FoodSafetyTemperatureRule.find = () => ({
        lean: async () => [
          {
            ruleId: 'RULE-2026-ONLY',
            processType: 'RECEIVING',
            status: 'ACTIVE',
            cafeId: null,
            foodCategory: 'ALL',
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
          },
        ],
      });
      GlobalInventoryItem.find = () => ({ lean: async () => [{ itemId: 'ITEM-MILK', category: 'DAIRY' }] });
      PurchaseOrder.find = () => ({ lean: async () => [] });
      APInvoice.find = () => ({ lean: async () => [] });
      Vendor.find = () => ({ lean: async () => [] });

      try {
        const res = await calculateProcurementMetrics({ organisationId: ORG_A });
        const q = res.vendorIntelligence.qualityAnalytics;

        assert.equal(q.temperatureRecordedCount, 10);
        assert.equal(q.evaluatedTemperatureCount, 7);
        assert.equal(q.unevaluatedTemperatureCount, 3);
        assert.equal(q.temperatureFailureCount, 0, '0 failures among 7 evaluated');
        assert.equal(q.temperatureFailureAvailability, 'PARTIAL', 'Must be PARTIAL due to 3 unevaluated');
        assert.equal(q.temporalApplicability, 'PARTIAL');
        assert.equal(q.historicalRuleAvailability, 'PARTIAL');
      } finally {
        IncomingInspection.find = origInspFind;
        FoodSafetyTemperatureRule.find = origRuleFind;
        GlobalInventoryItem.find = origItemFind;
        PurchaseOrder.find = origPoFind;
        APInvoice.find = origInvFind;
        Vendor.find = origVenFind;
      }
    });

    await s21.test('21.10 Historically overlapping equal-specificity rules degrade to AMBIGUOUS', () => {
      const overlappingRules = [
        {
          ruleId: 'RULE-OVERLAP-1',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2026-12-31T23:59:59.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
        },
        {
          ruleId: 'RULE-OVERLAP-2',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2026-12-31T23:59:59.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 7 }],
        },
      ];

      const res = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-06-01T10:00:00.000Z',
      }, overlappingRules, itemMap);

      assert.equal(res.status, 'AMBIGUOUS_RULE_CONFIGURATION');
      assert.equal(res.isAmbiguous, true);
      assert.equal(res.temporalApplicability, 'PARTIAL');
    });

    await s21.test('21.11 Section 17 Temporal + Specificity interaction cascade', () => {
      const matrixRules = [
        {
          ruleId: 'RULE-ORG-DAIRY-V1',
          processType: 'RECEIVING',
          status: 'SUPERSEDED',
          cafeId: null,
          foodCategory: 'DAIRY',
          version: 1,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2026-07-01T00:00:00.000Z',
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 8 }],
        },
        {
          ruleId: 'RULE-ORG-DAIRY-V2',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: null,
          foodCategory: 'DAIRY',
          version: 2,
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 7 }],
        },
        {
          ruleId: 'RULE-CAFE-ALL',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: CAFE_1,
          foodCategory: 'ALL',
          effectiveFrom: '2026-02-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 6 }],
        },
        {
          ruleId: 'RULE-CAFE-DAIRY',
          processType: 'RECEIVING',
          status: 'ACTIVE',
          cafeId: CAFE_1,
          foodCategory: 'DAIRY',
          effectiveFrom: '2026-05-01T00:00:00.000Z',
          effectiveTo: null,
          criteria: [{ minimumTemperatureC: 0, maximumTemperatureC: 4 }],
        },
      ];

      // Inspection in March (2026-03-15):
      // Org Dairy V1 (Spec 2, Jan) & Cafe ALL (Spec 3, Feb) are applicable.
      // Cafe Dairy (May) is FUTURE, Org Dairy V2 (Jul) is FUTURE.
      // Winner must be Cafe ALL (Spec 3 > Spec 2). Future Cafe Dairy (Spec 4) must NOT win early!
      const resMarch = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-03-15T10:00:00.000Z',
      }, matrixRules, itemMap);

      assert.equal(resMarch.status, 'MATCHED');
      assert.equal(resMarch.ruleId, 'RULE-CAFE-ALL');
      assert.equal(resMarch.specificity, 3);

      // Inspection in June (2026-06-15):
      // Cafe Dairy (May) is now effective (Spec 4).
      // Winner must be Cafe Dairy (Spec 4).
      const resJune = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-06-15T10:00:00.000Z',
      }, matrixRules, itemMap);

      assert.equal(resJune.status, 'MATCHED');
      assert.equal(resJune.ruleId, 'RULE-CAFE-DAIRY');
      assert.equal(resJune.specificity, 4);

      // Inspection in August (2026-08-15):
      // Cafe Dairy remains highest specificity (Spec 4).
      const resAugust = resolveTemperatureRule({
        cafeId: CAFE_1,
        itemId: 'ITEM-MILK',
        inspectedAt: '2026-08-15T10:00:00.000Z',
      }, matrixRules, itemMap);

      assert.equal(resAugust.status, 'MATCHED');
      assert.equal(resAugust.ruleId, 'RULE-CAFE-DAIRY');
      assert.equal(resAugust.specificity, 4);
    });
  });
});


