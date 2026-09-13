'use strict';

/**
 * ============================================================================
 * PM-02D — SALES, MENU, PRODUCT-MIX & UNIT-ECONOMICS INTELLIGENCE TEST SUITE
 * ============================================================================
 * Authoritative verification for Stage 4 of Consolidated Reports & Analytics:
 * - Section 73: Sales Test Matrix (Base, discount, tax, split-tender, refunds, voids)
 * - Section 74: Menu Test Matrix (BOM costing, unmapped items, modifiers, attach rates)
 * - Section 75: Menu Engineering Matrix (Quadrants, thresholds, zero-fake-terms)
 * - Section 76: Visual ↔ Table Reconciliation
 * - Section 77: Export Policy (PDF, XLSX, CSV/HTML rejection, OpenXML integrity)
 * - Section 79/80: Static Mock Audit (PRODUCTION_FAKE_DATA = 0) & Vendor Boundary
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const { calculateSalesMetrics } = require('../src/reporting/calculations/salesCalculations');
const { calculateMenuMetrics, formatCostAsOf, buildTheoreticalCostingNotice } = require('../src/reporting/calculations/menuCalculations');
const { ReportRegistry } = require('../src/reporting/reportRegistry');
const reportController = require('../src/controllers/reportController');
const { ZurfService } = require('../src/services/zurfService');
const { Bill } = require('../src/models/Bill');
const { MenuItem } = require('../src/models/MenuItem');
const { Recipe } = require('../src/models/Recipe');
const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');

// Helper to construct mock request/response
function buildMockReqRes(role = 'PRIMARY_MASTER', body = {}, query = {}, params = {}) {
  const req = {
    auth: {
      userId: 'USER-001',
      role,
      organisationId: 'ORG-ZAMORIN',
      assignedCafeIds: ['ZC-0001', 'ZC-0002'],
    },
    body,
    query,
    params,
    headers: {},
  };
  let statusCode = 200;
  let jsonData = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(d) { jsonData = d; return this; },
    setHeader() {},
  };
  return { req, res, getResult: () => ({ statusCode, data: jsonData }) };
}

test('PM-02D: Sales, Menu, Product-Mix & Unit-Economics Intelligence Suite', async (suite) => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SALES TEST MATRIX (Section 73)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('1.1 Base completed sale: Gross sales, SBT, Net sales, Tax, Orders, AOV with exact paise precision', async () => {
    // Mock Bill.find for this test
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-001',
          billNumber: 'B-001',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T10:30:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 50000, // ₹500.00
          discountPaisa: 5000,    // ₹50.00
          taxPaisa: 2250,         // ₹22.50
          totalPaisa: 47250,      // ₹472.50
          refundedTotalPaisa: 0,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [
            { paymentMethod: 'UPI', amountPaisa: 47250, status: 'COLLECTED' }
          ],
          lineItems: [
            {
              menuItemId: 'ITEM-01',
              itemName: 'Single Origin Filter Kaapi',
              quantity: 2,
              pricePaisa: 25000,
              subtotalPaisa: 45000, // net after discount
              discountPaisa: 5000,
              grossPaisa: 50000,
            }
          ]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        cafeScope: 'ZC-0001',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.grossSalesPaise, 50000, 'Gross sales must be ₹500.00 (50000 paise)');
      assert.equal(res.summary.salesBeforeTaxPaise, 45000, 'Sales Before Tax must be ₹450.00');
      assert.equal(res.summary.discountPaise, 5000, 'Discount must be ₹50.00');
      assert.equal(res.summary.taxChargedPaise, 2250, 'Tax charged must be ₹22.50');
      assert.equal(res.summary.netSalesPaise, 45000, 'Net sales must be ₹450.00 (pre-tax net)');
      assert.equal(res.summary.orderCount, 1, 'Order count must be 1');
      assert.equal(res.summary.aovPaise, 45000, 'AOV must equal Net sales for single bill');
      assert.equal(res.dataQuality.state, 'CLEAN');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('1.2 Split Tender exact paise: Single bill with multi-tender allocated accurately without double-counting', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-SPLIT',
          billNumber: 'B-SPLIT',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T12:00:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 100000,
          discountPaisa: 0,
          taxPaisa: 5000,
          totalPaisa: 105000,
          refundedTotalPaisa: 0,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          // Split tender: ₹600.00 Card + ₹450.00 Cash = ₹1,050.00
          tenders: [
            { paymentMethod: 'CARD', amountPaisa: 60000, status: 'COLLECTED' },
            { paymentMethod: 'CASH', amountPaisa: 45000, status: 'COLLECTED' }
          ],
          lineItems: [
            { itemName: 'Cold Brew', quantity: 2, subtotalPaisa: 100000 }
          ]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.splitTenderSummary.count, 1, 'Must recognize 1 split tender bill');
      assert.equal(res.splitTenderSummary.amountPaisa, 105000, 'Split tender total must be ₹1050.00');

      const cardTender = res.paymentMix.find(p => p.method === 'CARD');
      const cashTender = res.paymentMix.find(p => p.method === 'CASH');

      assert.ok(cardTender && cashTender, 'Both tenders must be reported');
      assert.equal(cardTender.amountPaisa, 60000, 'Card tender must be exactly 60000 paise');
      assert.equal(cashTender.amountPaisa, 45000, 'Cash tender must be exactly 45000 paise');
      assert.equal(cardTender.amountPaisa + cashTender.amountPaisa, 105000, 'Tenders sum must reconcile to bill total');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('1.3 Partial refund without line allocation: Data quality state becomes PARTIAL with transparent notice', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-PARTIAL',
          billNumber: 'B-PARTIAL',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T14:00:00.000Z'),
          status: 'PARTIALLY_REFUNDED',
          grossSalesPaisa: 50000,
          discountPaisa: 0,
          taxPaisa: 2500,
          totalPaisa: 52500,
          // Unallocated refund at bill level without line breakdown
          refundedTotalPaisa: 20000,
          preTaxRefundPaisa: 0, // unallocated pre-tax
          refundedTaxPaisa: 0,
          serviceMode: 'TAKEAWAY',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 52500 }],
          lineItems: [{ itemName: 'Snack', quantity: 2, subtotalPaisa: 50000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.customerRefundPaise, 20000, 'Customer refund records exact ₹200.00 tender return');
      assert.equal(res.summary.preTaxRefundPaise, 0, 'No manufactured pre-tax refund deduction without allocation');
      assert.equal(res.summary.preTaxRefundAvailability, 'PARTIAL_SOURCE', 'Pre-tax refund must carry PARTIAL_SOURCE');
      assert.equal(res.summary.netSalesPaise, 50000, 'Canonical net sales does not manufacture unallocated deduction');
      assert.equal(res.summary.netSalesAvailability, 'PARTIAL_SOURCE', 'Net sales must carry PARTIAL_SOURCE');
      assert.equal(res.dataQuality.state, 'PARTIAL', 'Quality state must become PARTIAL due to unallocated refund');
      assert.ok(res.dataQuality.warnings.includes('PARTIAL_REFUND_PRE_TAX_UNKNOWN'));
      assert.equal(res.provenance.NET_SALES.availability, 'PARTIAL_SOURCE');
      assert.equal(res.provenance.NET_TAX.availability, 'PARTIAL_SOURCE');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('1.3b Partial refund with exact allocation: Authoritative pre-tax refund and tax adjustment calculated', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-ALLOCATED',
          billNumber: 'B-ALLOCATED',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T14:00:00.000Z'),
          status: 'PARTIALLY_REFUNDED',
          grossSalesPaisa: 50000,
          discountPaisa: 0,
          taxPaisa: 2500,
          totalPaisa: 52500,
          // Authoritative pre-tax and tax allocation stored on bill
          refundedTotalPaisa: 21000,
          preTaxRefundPaisa: 20000,
          refundedTaxPaisa: 1000,
          serviceMode: 'TAKEAWAY',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 52500 }],
          lineItems: [{ itemName: 'Snack', quantity: 2, subtotalPaisa: 50000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.customerRefundPaise, 21000, 'Customer refund records ₹210.00');
      assert.equal(res.summary.preTaxRefundPaise, 20000, 'Exact pre-tax refund deduction of ₹200.00');
      assert.equal(res.summary.netSalesPaise, 30000, 'Exact net sales ₹300.00 (50000 - 20000)');
      assert.equal(res.summary.refundedTaxPaise, 1000, 'Exact refunded tax ₹10.00');
      assert.equal(res.summary.netTaxPaise, 1500, 'Net tax ₹15.00 (2500 - 1000)');
      assert.equal(res.dataQuality.state, 'CLEAN', 'Allocated refund preserves clean data quality');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('1.4 Full refund: Net sales and taxes completely zeroed while Gross sales remain recorded', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-FULLREF',
          billNumber: 'B-FULLREF',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T15:00:00.000Z'),
          status: 'REFUNDED',
          grossSalesPaisa: 40000,
          discountPaisa: 0,
          taxPaisa: 2000,
          totalPaisa: 42000,
          refundedTotalPaisa: 42000,
          preTaxRefundPaisa: 40000,
          refundedTaxPaisa: 2000,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'CASH', amountPaisa: 42000 }],
          lineItems: [{ itemName: 'Meal', quantity: 1, subtotalPaisa: 40000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.grossSalesPaise, 40000, 'Gross sales preserved as historical truth');
      assert.equal(res.summary.customerRefundPaise, 42000, 'Customer refund recorded');
      assert.equal(res.summary.netSalesPaise, 0, 'Net sales must zeroize completely');
      assert.equal(res.summary.netTaxPaise, 0, 'Net tax must zeroize completely');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('1.5 Void & Payment Reversal isolation: VOIDED & REVERSED bills counted separately, excluded from sales', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-COMP',
          organisationId: 'ORG-ZAMORIN',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          grossSalesPaisa: 30000,
          totalPaisa: 31500,
          refundedTotalPaisa: 0,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 31500 }],
          lineItems: [{ itemName: 'Item 1', quantity: 1, subtotalPaisa: 30000 }]
        },
        {
          _id: 'BILL-VOID',
          organisationId: 'ORG-ZAMORIN',
          status: 'VOIDED',
          businessDate: '2026-08-15',
          totalPaisa: 25000,
          voidReason: 'Mistake in order',
          cashierId: 'OP-01'
        },
        {
          _id: 'BILL-REV',
          organisationId: 'ORG-ZAMORIN',
          status: 'PAYMENT_REVERSED',
          businessDate: '2026-08-15',
          totalPaisa: 15000,
          voidReason: 'Bank gateway reversal',
          cashierId: 'OP-02'
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.grossSalesPaise, 30000, 'Only completed bill gross sales counted');
      assert.equal(res.summary.netSalesPaise, 30000, 'Only completed bill net sales counted');
      assert.equal(res.voidAnalytics.voids.count, 1, 'Must record 1 voided bill');
      assert.equal(res.voidAnalytics.voids.totalValuePaisa, 25000, 'Void value must be ₹250.00');
      assert.equal(res.voidAnalytics.reversals.count, 1, 'Must record 1 reversal');
      assert.equal(res.voidAnalytics.reversals.totalValuePaisa, 15000, 'Reversal value must be ₹150.00');
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MENU TEST MATRIX & THEORETICAL COSTING (Section 74)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('2.1 Modifier attach rate: Denominator strictly uses eligible base item units, not total orders', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        // Bill 1: 2 Kaapi, 1 with Extra Shot
        {
          _id: 'B-MOD-1',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          grossSalesPaisa: 30000,
          totalPaisa: 30000,
          refundedTotalPaisa: 0,
          lineItems: [
            {
              itemName: 'Filter Kaapi',
              quantity: 2,
              subtotalPaisa: 30000,
              modifiers: [
                { name: 'Extra Shot', modifierPricePaisa: 3000 }
              ]
            }
          ]
        },
        // Bill 2: 1 Croissant (no modifiers)
        {
          _id: 'B-MOD-2',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          grossSalesPaisa: 15000,
          totalPaisa: 15000,
          refundedTotalPaisa: 0,
          lineItems: [
            {
              itemName: 'Butter Croissant',
              quantity: 1,
              subtotalPaisa: 15000
            }
          ]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const topMods = res.modifierAnalytics.topModifiers;
      assert.ok(topMods.length > 0, 'Must identify modifier');
      const extraShot = topMods.find(m => m.name === 'Extra Shot');
      assert.ok(extraShot);
      assert.equal(extraShot.selectionCount, 1);
      // Denominator: 2 Filter Kaapi units sold (not 2 total orders) -> 1/2 = 50.0%
      assert.equal(extraShot.attachRatePercent, 50.0, 'Attach rate must be 50.0% of Filter Kaapi units');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('2.2 Theoretical recipe cost explosion & estimated contribution safeguards', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'B-REC-1',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          totalPaisa: 30000,
          refundedTotalPaisa: 0,
          lineItems: [
            {
              menuItemId: 'MENU-KAAPI',
              itemName: 'Filter Kaapi',
              quantity: 2,
              subtotalPaisa: 30000, // ₹300.00
            }
          ]
        }
      ])
    });

    MenuItem.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'MENU-KAAPI',
          name: 'Filter Kaapi',
          category: 'Hot Coffee',
          pricePaisa: 15000,
          primaryRecipeId: 'REC-KAAPI',
          auditHistory: []
        }
      ])
    });

    Recipe.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'REC-KAAPI',
          recipeId: 'REC-KAAPI',
          batchYield: 1,
          portionSize: 1,
          preparationLossPercent: 0,
          ingredients: [
            {
              itemId: 'INV-COFFEE-POWDER',
              quantity: 20, // 20g
              uom: 'G',
              lossFactorPercent: 0,
            },
            {
              itemId: 'INV-MILK',
              quantity: 150, // 150ml
              uom: 'ML',
              lossFactorPercent: 0,
            }
          ]
        }
      ])
    });

    GlobalInventoryItem.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'INV-COFFEE-POWDER',
          itemId: 'INV-COFFEE-POWDER',
          unitCostPaisa: 150, // 150 paise per gram -> 20g = 3000 paise (₹30.00)
        },
        {
          _id: 'INV-MILK',
          itemId: 'INV-MILK',
          unitCostPaisa: 10,  // 10 paise per ml -> 150ml = 1500 paise (₹15.00)
        }
      ])
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.ok(res.engineering.items.length > 0);
      const kaapi = res.engineering.items.find(i => i.itemName === 'Filter Kaapi');
      assert.ok(kaapi);
      // Unit theoretical cost = 3000 + 1500 = 4500 paise (₹45.00). Sold 2 units = 9000 paise (₹90.00).
      assert.equal(kaapi.theoreticalCostPaise, 9000, 'Total theoretical cost for 2 units must be 9000 paise');
      // Net Sales = 30000 paise. Estimated contribution = 30000 - 9000 = 21000 paise (₹210.00).
      assert.equal(kaapi.estimatedContributionPaise, 21000, 'Estimated contribution must be 21000 paise');
      // Estimated Contribution % = 21000 / 30000 = 70.0%
      assert.equal(kaapi.estimatedContributionPercent, 70.0, 'Estimated contribution % must be 70.0%');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  await suite.test('2.3 Missing recipe BOM: Item is classified as UNCLASSIFIED with null theoretical cost', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'B-NOMENU-1',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          totalPaisa: 20000,
          refundedTotalPaisa: 0,
          lineItems: [{ itemName: 'Special Cup', quantity: 1, subtotalPaisa: 20000 }]
        }
      ])
    });

    MenuItem.find = () => ({ lean: () => Promise.resolve([]) });
    Recipe.find = () => ({ lean: () => Promise.resolve([]) });
    GlobalInventoryItem.find = () => ({ lean: () => Promise.resolve([]) });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const item = res.engineering.items.find(i => i.itemName === 'Special Cup');
      assert.ok(item);
      assert.equal(item.theoreticalCostPaise, null);
      assert.equal(item.estimatedContributionPaise, null);
      assert.equal(item.estimatedContributionPercent, null);
      assert.equal(item.quadrant, 'UNCLASSIFIED');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MENU ENGINEERING MATRIX & QUADRANTS (Section 75)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('3.1 Boston Box 4-quadrant classification logic with dataset-relative mean thresholds', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    Bill.find = () => ({
      lean: () => Promise.resolve([
        // Star: High Pop (10), High Contrib (₹80)
        { _id: 'B1', status: 'COMPLETED', businessDate: '2026-08-15', totalPaisa: 100000, refundedTotalPaisa: 0, lineItems: [{ menuItemId: 'M1', itemName: 'Star Brew', quantity: 10, subtotalPaisa: 100000 }] },
        // Plowhorse: High Pop (10), Low Contrib (₹20)
        { _id: 'B2', status: 'COMPLETED', businessDate: '2026-08-15', totalPaisa: 50000, refundedTotalPaisa: 0, lineItems: [{ menuItemId: 'M2', itemName: 'Plow Snack', quantity: 10, subtotalPaisa: 50000 }] },
        // Puzzle: Low Pop (2), High Contrib (₹90)
        { _id: 'B3', status: 'COMPLETED', businessDate: '2026-08-15', totalPaisa: 30000, refundedTotalPaisa: 0, lineItems: [{ menuItemId: 'M3', itemName: 'Puzzle Dessert', quantity: 2, subtotalPaisa: 30000 }] },
        // Dog: Low Pop (2), Low Contrib (₹10)
        { _id: 'B4', status: 'COMPLETED', businessDate: '2026-08-15', totalPaisa: 10000, refundedTotalPaisa: 0, lineItems: [{ menuItemId: 'M4', itemName: 'Dog Water', quantity: 2, subtotalPaisa: 10000 }] },
      ])
    });

    MenuItem.find = () => ({
      lean: () => Promise.resolve([
        { _id: 'M1', name: 'Star Brew', pricePaisa: 10000, primaryRecipeId: 'R1' },
        { _id: 'M2', name: 'Plow Snack', pricePaisa: 5000, primaryRecipeId: 'R2' },
        { _id: 'M3', name: 'Puzzle Dessert', pricePaisa: 15000, primaryRecipeId: 'R3' },
        { _id: 'M4', name: 'Dog Water', pricePaisa: 5000, primaryRecipeId: 'R4' },
      ])
    });

    Recipe.find = () => ({
      lean: () => Promise.resolve([
        { recipeId: 'R1', batchYield: 1, portionSize: 1, preparationLossPercent: 0, ingredients: [{ itemId: 'INV1', quantity: 1 }] },
        { recipeId: 'R2', batchYield: 1, portionSize: 1, preparationLossPercent: 0, ingredients: [{ itemId: 'INV2', quantity: 1 }] },
        { recipeId: 'R3', batchYield: 1, portionSize: 1, preparationLossPercent: 0, ingredients: [{ itemId: 'INV3', quantity: 1 }] },
        { recipeId: 'R4', batchYield: 1, portionSize: 1, preparationLossPercent: 0, ingredients: [{ itemId: 'INV4', quantity: 1 }] },
      ])
    });

    GlobalInventoryItem.find = () => ({
      lean: () => Promise.resolve([
        { itemId: 'INV1', unitCostPaisa: 2000 }, // M1: price 10000 - cost 2000 = unit contrib 8000
        { itemId: 'INV2', unitCostPaisa: 3000 }, // M2: price 5000 - cost 3000 = unit contrib 2000
        { itemId: 'INV3', unitCostPaisa: 6000 }, // M3: price 15000 - cost 6000 = unit contrib 9000
        { itemId: 'INV4', unitCostPaisa: 4000 }, // M4: price 5000 - cost 4000 = unit contrib 1000
      ])
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.quadrants.STAR.length, 1, 'Must classify exactly 1 Star');
      assert.equal(res.quadrants.STAR[0].itemName, 'Star Brew');

      assert.equal(res.quadrants.PLOWHORSE.length, 1, 'Must classify exactly 1 Plowhorse');
      assert.equal(res.quadrants.PLOWHORSE[0].itemName, 'Plow Snack');

      assert.equal(res.quadrants.PUZZLE.length, 1, 'Must classify exactly 1 Puzzle');
      assert.equal(res.quadrants.PUZZLE[0].itemName, 'Puzzle Dessert');

      assert.equal(res.quadrants.DOG.length, 1, 'Must classify exactly 1 Dog');
      assert.equal(res.quadrants.DOG[0].itemName, 'Dog Water');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  await suite.test('3.2 Strict Guardrail: No forbidden actual-margin terms in output structures', async () => {
    const origBillFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        { _id: 'B1', status: 'COMPLETED', businessDate: '2026-08-15', totalPaisa: 10000, refundedTotalPaisa: 0, lineItems: [{ itemName: 'Item 1', quantity: 1, subtotalPaisa: 10000 }] }
      ])
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const serialized = JSON.stringify(res).toLowerCase();
      const forbiddenWords = ['actual cogs', 'actual margin', 'actual gross profit', 'actual contribution', 'actual menu profit'];
      for (const f of forbiddenWords) {
        assert.ok(!serialized.includes(f), `Output must not contain forbidden term "${f}"`);
      }
    } finally {
      Bill.find = origBillFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. VISUAL & TABLE RECONCILIATION (Section 76)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('4.1 Reconciliations: Hourly sum, category sum, item sum all equal Net Sales', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'B1',
          status: 'COMPLETED',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T11:00:00.000Z'),
          grossSalesPaisa: 50000,
          totalPaisa: 50000,
          refundedTotalPaisa: 0,
          lineItems: [
            { itemName: 'Latte', category: 'Coffee', quantity: 2, subtotalPaisa: 30000 },
            { itemName: 'Muffin', category: 'Bakery', quantity: 1, subtotalPaisa: 20000 },
          ],
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 50000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const netSales = res.summary.netSalesPaise;

      // 1. Hourly sum
      const hourlyNetSum = res.hourlyTrends.reduce((acc, h) => acc + h.netSalesPaisa, 0);
      assert.equal(hourlyNetSum, netSales, 'Hourly trend net sales sum must equal summary net sales');

      // 2. Category sum
      const categoryNetSum = res.categorySales.reduce((acc, c) => acc + c.netSalesPaise, 0);
      assert.equal(categoryNetSum, netSales, 'Category net sales sum must equal summary net sales');

      // 3. Item sum
      const itemNetSum = res.itemSales.reduce((acc, i) => acc + i.netSalesPaise, 0);
      assert.equal(itemNetSum, netSales, 'Item net sales sum must equal summary net sales');
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. EXPORT POLICY MATRIX (Section 77)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('5.1 PDF & Multi-Sheet XLSX Accepted; CSV and HTML Rejected with 400', async () => {
    // 1. PDF export for daily-sales
    const { req: pdfReq, res: pdfRes, getResult: getPdfRes } = buildMockReqRes('PRIMARY_MASTER', {
      reportId: 'daily-sales',
      format: 'PDF',
      period: 'THIS_MONTH'
    });
    await reportController.generateZurfExport(pdfReq, pdfRes, () => {});
    const pdfResult = getPdfRes();
    assert.equal(pdfResult.statusCode, 200);
    assert.equal(pdfResult.data.data.format, 'PDF');
    assert.ok(pdfResult.data.data.pdfBase64);

    // 2. XLSX export for daily-sales (Multi-sheet)
    const { req: xlsxReq, res: xlsxRes, getResult: getXlsxRes } = buildMockReqRes('PRIMARY_MASTER', {
      reportId: 'daily-sales',
      format: 'XLSX',
      period: 'THIS_MONTH'
    });
    await reportController.generateZurfExport(xlsxReq, xlsxRes, () => {});
    const xlsxResult = getXlsxRes();
    assert.equal(xlsxResult.statusCode, 200);
    assert.equal(xlsxResult.data.data.format, 'XLSX');
    assert.ok(xlsxResult.data.data.xlsxBase64);
    assert.ok(xlsxResult.data.data.filename.endsWith('.xlsx'));

    // OpenXML PKZip Magic Number check: PK\x03\x04
    const xlsxBuffer = Buffer.from(xlsxResult.data.data.xlsxBase64, 'base64');
    assert.equal(xlsxBuffer[0], 0x50); // 'P'
    assert.equal(xlsxBuffer[1], 0x4B); // 'K'
    assert.equal(xlsxBuffer[2], 0x03);
    assert.equal(xlsxBuffer[3], 0x04);

    // 3. CSV Rejected with 400
    let csvError = null;
    const { req: csvReq, res: csvRes } = buildMockReqRes('PRIMARY_MASTER', {
      reportId: 'daily-sales',
      format: 'CSV',
    });
    await reportController.generateZurfExport(csvReq, csvRes, (err) => { csvError = err; });
    assert.ok(csvError);
    assert.equal(csvError.statusCode, 400);
    assert.equal(csvError.code, 'UNSUPPORTED_EXPORT_FORMAT');

    // 4. HTML Rejected with 400
    let htmlError = null;
    const { req: htmlReq, res: htmlRes } = buildMockReqRes('PRIMARY_MASTER', {
      reportId: 'daily-sales',
      format: 'HTML',
    });
    await reportController.generateZurfExport(htmlReq, htmlRes, (err) => { htmlError = err; });
    assert.ok(htmlError);
    assert.equal(htmlError.statusCode, 400);
    assert.equal(htmlError.code, 'UNSUPPORTED_EXPORT_FORMAT');
  });

  await suite.test('5.2 Menu Engineering XLSX export contains dedicated sheets and estimated contribution notice', async () => {
    const { req, res, getResult } = buildMockReqRes('PRIMARY_MASTER', {
      reportId: 'menu-engineering',
      format: 'XLSX',
      period: 'THIS_MONTH'
    });
    await reportController.generateZurfExport(req, res, () => {});
    const result = getResult();
    assert.equal(result.statusCode, 200);
    assert.equal(result.data.data.manifest.reportTitle, 'Menu Engineering & Contribution Intelligence');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. GOVERNANCE BOUNDARY & STATIC MOCK AUDIT (Section 79, 80)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('6.1 Vendor Intelligence governance under PROCUREMENT_VENDORS', () => {
    const vendorReport = ReportRegistry.getReport('vendor-performance-intelligence');
    assert.ok(vendorReport, 'Vendor performance report must be registered in catalogue');
    assert.ok(['AVAILABLE', 'NOT_IMPLEMENTED'].includes(vendorReport.availability), 'Availability must be valid enum');
    if (vendorReport.availability === 'AVAILABLE') {
      assert.equal(vendorReport.runnable, true, 'Runnable when activated in PM-02E');
      assert.deepEqual(vendorReport.supportedExports, ['PDF', 'XLSX'], 'Exports must be PDF and XLSX');
    } else {
      assert.equal(vendorReport.runnable, false, 'Must not be runnable prior to PM-02E');
      assert.deepEqual(vendorReport.supportedExports, [], 'supportedExports must be empty array');
    }
  });

  await suite.test('6.2 PRODUCTION_FAKE_DATA = 0: Calculation engines do not contain hardcoded demo data', () => {
    const salesCalcCode = fs.readFileSync(path.join(__dirname, '../src/reporting/calculations/salesCalculations.js'), 'utf8');
    const menuCalcCode = fs.readFileSync(path.join(__dirname, '../src/reporting/calculations/menuCalculations.js'), 'utf8');

    // Ensure no fallback arrays of hardcoded production numbers
    assert.ok(!salesCalcCode.includes('chartData = ['), 'No hardcoded chartData arrays in sales calculations');
    assert.ok(!menuCalcCode.includes('chartData = ['), 'No hardcoded chartData arrays in menu calculations');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. EXPANDED SALES EXACT-PAISE MATRIX (Section 39)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('7.1 Sales Exact-Paise: multi-item, multi-category, multi-cafe, cross-org isolation, and empty period', async () => {
    const origFind = Bill.find;
    Bill.find = (filter) => ({
      lean: () => {
        if (filter.organisationId !== 'ORG-ZAMORIN') return Promise.resolve([]);
        return Promise.resolve([
          {
            _id: 'BILL-101',
            billNumber: 'B-101',
            organisationId: 'ORG-ZAMORIN',
            cafeId: 'ZC-0001',
            businessDate: '2026-08-20',
            completedAt: new Date('2026-08-20T11:00:00.000Z'),
            status: 'COMPLETED',
            grossSalesPaisa: 60000,
            discountPaisa: 5000,
            taxPaisa: 2750,
            totalPaisa: 57750,
            refundedTotalPaisa: 0,
            serviceMode: 'DINE_IN',
            orderSource: 'POS',
            tenders: [{ paymentMethod: 'UPI', amountPaisa: 57750 }],
            lineItems: [
              { menuItemId: 'ITEM-01', itemName: 'Filter Kaapi', quantity: 2, unitPricePaisa: 15000, lineSubtotalPaisa: 30000, grossPaisa: 30000 },
              { menuItemId: 'ITEM-02', itemName: 'Banana Roast', quantity: 2, unitPricePaisa: 15000, lineSubtotalPaisa: 25000, grossPaisa: 30000, discountPaisa: 5000 },
            ],
          },
          {
            _id: 'BILL-102',
            billNumber: 'B-102',
            organisationId: 'ORG-ZAMORIN',
            cafeId: 'ZC-0002',
            businessDate: '2026-08-20',
            completedAt: new Date('2026-08-20T14:00:00.000Z'),
            status: 'COMPLETED',
            grossSalesPaisa: 40000,
            discountPaisa: 0,
            taxPaisa: 2000,
            totalPaisa: 42000,
            refundedTotalPaisa: 0,
            serviceMode: 'TAKEAWAY',
            orderSource: 'POS',
            tenders: [{ paymentMethod: 'CARD', amountPaisa: 42000 }],
            lineItems: [
              { menuItemId: 'ITEM-03', itemName: 'Cold Brew', quantity: 1, unitPricePaisa: 40000, lineSubtotalPaisa: 40000, grossPaisa: 40000 },
            ],
          },
        ]);
      }
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        cafeScope: ['ZC-0001', 'ZC-0002'],
        dateFrom: '2026-08-20',
        dateTo: '2026-08-20',
      });

      assert.equal(res.summary.grossSalesPaise, 100000);
      assert.equal(res.summary.discountPaise, 5000);
      assert.equal(res.summary.netSalesPaise, 95000);
      assert.equal(res.summary.orderCount, 2);
      assert.equal(res.salesByCafe.length, 2);
      assert.equal(res.salesByCafe[0].cafeId, 'ZC-0001');
      assert.equal(res.salesByCafe[0].netSalesPaisa, 55000);
      assert.equal(res.salesByCafe[1].cafeId, 'ZC-0002');
      assert.equal(res.salesByCafe[1].netSalesPaisa, 40000);

      const otherOrgRes = await calculateSalesMetrics({
        organisationId: 'ORG-OTHER',
        dateFrom: '2026-08-20',
        dateTo: '2026-08-20',
      });
      assert.equal(otherOrgRes.summary.grossSalesPaise, 0);
      assert.equal(otherOrgRes.summary.netSalesPaise, 0);
      assert.equal(otherOrgRes.summary.orderCount, 0);
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('7.2 Split tender arithmetic: SUM(tenders) = Receipt Total with zero double counting', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-SPLIT',
          billNumber: 'B-SPLIT',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-21',
          completedAt: new Date('2026-08-21T12:00:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 100000,
          discountPaisa: 0,
          taxPaisa: 5000,
          totalPaisa: 105000,
          refundedTotalPaisa: 0,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [
            { paymentMethod: 'CASH', amountPaisa: 50000 },
            { paymentMethod: 'UPI', amountPaisa: 55000 },
          ],
          lineItems: [
            { menuItemId: 'ITEM-01', itemName: 'Special Feast', quantity: 1, unitPricePaisa: 100000, lineSubtotalPaisa: 100000, grossPaisa: 100000 },
          ],
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-21',
        dateTo: '2026-08-21',
      });

      assert.equal(res.splitTenderSummary.count, 1);
      assert.equal(res.splitTenderSummary.amountPaisa, 105000);

      const cashTender = res.paymentMix.find(p => p.method === 'CASH');
      const upiTender = res.paymentMix.find(p => p.method === 'UPI');
      assert.ok(cashTender);
      assert.ok(upiTender);
      assert.equal(cashTender.amountPaisa, 50000);
      assert.equal(upiTender.amountPaisa, 55000);

      const sumTenders = cashTender.amountPaisa + upiTender.amountPaisa;
      assert.equal(sumTenders, 105000);
      assert.equal(res.summary.orderCount, 1);
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. DIMENSION INTEGRITY & UNSUPPORTED VALUE REJECTION (Section 40)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('8.1 Canonical service modes verified, unsupported DRIVE_THRU and ROOM_SERVICE absent', async () => {
    const origFind = Bill.find;
    Bill.find = (filter) => ({
      lean: () => {
        if (filter.serviceMode === '__UNSUPPORTED_MODE__') return Promise.resolve([]);
        return Promise.resolve([
          {
            _id: 'BILL-MODE',
            organisationId: 'ORG-ZAMORIN',
            cafeId: 'ZC-0001',
            businessDate: '2026-08-22',
            completedAt: new Date(),
            status: 'COMPLETED',
            grossSalesPaisa: 20000,
            discountPaisa: 0,
            taxPaisa: 1000,
            totalPaisa: 21000,
            serviceMode: 'DINE_IN',
            tenders: [{ paymentMethod: 'CASH', amountPaisa: 21000 }],
            lineItems: [{ menuItemId: 'ITEM-01', itemName: 'Item 1', quantity: 1, unitPricePaisa: 20000, lineSubtotalPaisa: 20000 }],
          }
        ]);
      }
    });

    try {
      const validRes = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-22',
        dateTo: '2026-08-22',
        filters: { serviceMode: 'DINE_IN' },
      });
      assert.equal(validRes.summary.orderCount, 1);
      assert.ok(validRes.serviceModes.some(m => m.mode === 'DINE_IN'));

      const invalidRes = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-22',
        dateTo: '2026-08-22',
        filters: { serviceMode: 'DRIVE_THRU' },
      });
      assert.equal(invalidRes.summary.orderCount, 0);

      const allModes = validRes.serviceModes.map(m => m.mode);
      assert.ok(!allModes.includes('DRIVE_THRU'), 'DRIVE_THRU must not be in serviceModes');
      assert.ok(!allModes.includes('ROOM_SERVICE'), 'ROOM_SERVICE must not be in serviceModes');
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('8.2 Canonical tenders verified, unsupported GIFT_CARD and WALLET absent', async () => {
    const origFind = Bill.find;
    Bill.find = (filter) => ({
      lean: () => {
        if (filter.paymentMethod === '__UNSUPPORTED_TENDER__') return Promise.resolve([]);
        return Promise.resolve([
          {
            _id: 'BILL-TEND',
            organisationId: 'ORG-ZAMORIN',
            cafeId: 'ZC-0001',
            businessDate: '2026-08-22',
            completedAt: new Date(),
            status: 'COMPLETED',
            grossSalesPaisa: 20000,
            discountPaisa: 0,
            taxPaisa: 1000,
            totalPaisa: 21000,
            serviceMode: 'DINE_IN',
            paymentMethod: 'UPI',
            tenders: [{ paymentMethod: 'UPI', amountPaisa: 21000 }],
            lineItems: [{ menuItemId: 'ITEM-01', itemName: 'Item 1', quantity: 1, unitPricePaisa: 20000, lineSubtotalPaisa: 20000 }],
          }
        ]);
      }
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-22',
        dateTo: '2026-08-22',
      });

      const tenderMethods = res.paymentMix.map(p => p.method);
      assert.ok(!tenderMethods.includes('GIFT_CARD'), 'GIFT_CARD must not be in paymentMix');
      assert.ok(!tenderMethods.includes('WALLET'), 'WALLET must not be in paymentMix');

      const invalidTenderRes = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-22',
        dateTo: '2026-08-22',
        filters: { paymentMethod: 'GIFT_CARD' },
      });
      assert.equal(invalidTenderRes.summary.orderCount, 0);
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. DAYPART CONTRACT & HOURLY AUTHORITATIVE ANALYSIS (Section 41)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('9.1 Daypart status is NOT_CONFIGURED, hourly analysis is authoritative, no fake official dayparts', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-DP',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-23',
          completedAt: new Date('2026-08-23T08:30:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 30000,
          discountPaisa: 0,
          taxPaisa: 1500,
          totalPaisa: 31500,
          serviceMode: 'DINE_IN',
          tenders: [{ paymentMethod: 'CASH', amountPaisa: 31500 }],
          lineItems: [{ menuItemId: 'ITEM-01', itemName: 'Kaapi', quantity: 1, unitPricePaisa: 30000, lineSubtotalPaisa: 30000 }],
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-23',
        dateTo: '2026-08-23',
      });

      assert.ok(res.dayparts);
      assert.equal(res.dayparts.status, 'NOT_CONFIGURED');
      assert.equal(res.dayparts.template, 'PROPOSED_DEFAULT');
      assert.ok(res.dayparts.notice.includes('hourly analysis is authoritative'));

      assert.ok(Array.isArray(res.hourlyTrends));
      assert.equal(res.hourlyTrends.length, 24);
      assert.equal(res.salesHeatmap.length, 168);
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. HISTORICAL COST & RECIPE PROVENANCE SAFEGUARDS (Section 42)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('10.1 Historical cost and recipe history unavailable: Carries explicit standard-cost warnings', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-HIST',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-24',
          completedAt: new Date(),
          status: 'COMPLETED',
          lineItems: [
            { menuItemId: 'MENU-01', itemName: 'Espresso Single', quantity: 10, unitPricePaisa: 10000, lineSubtotalPaisa: 100000, grossPaisa: 100000 },
          ],
        }
      ])
    });

    MenuItem.find = () => ({
      lean: () => Promise.resolve([
        { menuItemId: 'MENU-01', name: 'Espresso Single', category: 'Coffee', primaryRecipeId: 'RCP-0001', recipeDeductionBaseQuantity: 1 },
      ])
    });

    Recipe.find = () => ({
      lean: () => Promise.resolve([
        { recipeId: 'RCP-0001', batchYield: 1, ingredients: [{ itemId: 'INV-01', quantity: 1, lossFactorPercent: 0 }] },
      ])
    });

    GlobalInventoryItem.find = () => ({
      select: () => ({
        lean: () => Promise.resolve([
          { itemId: 'INV-01', unitCostPaisa: 3000 },
        ])
      })
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-24',
        dateTo: '2026-08-24',
      });

      assert.equal(res.costBasis, 'THEORETICAL_COGS_CURRENT_STANDARD');
      assert.equal(res.actuality, 'ESTIMATED');
      assert.equal(res.historicalCostAvailability, 'UNAVAILABLE');
      assert.equal(res.recipeBasis, 'CURRENT_RECIPE_ESTIMATE');

      assert.ok(res.dataQuality.warnings.some(w => w.includes('Historical ingredient-cost reconstruction unavailable')));
      assert.ok(res.dataQuality.warnings.includes('CURRENT_RECIPE_ESTIMATE'));
      assert.ok(res.dataQuality.warnings.includes('ACTUAL_COGS_UNAVAILABLE'));

      const item = res.menuPerformance[0];
      assert.equal(item.costBasis, 'THEORETICAL_COGS_CURRENT_STANDARD');
      assert.equal(item.recipeBasis, 'CURRENT_RECIPE_ESTIMATE');
      assert.equal(item.actuality, 'ESTIMATED');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. MENU ENGINEERING MATRIX & 4 QUADRANTS (Section 43)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('11.1 Menu Engineering Matrix: exact threshold calculation and 4-quadrant assignment', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-ENG',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-25',
          completedAt: new Date(),
          status: 'COMPLETED',
          lineItems: [
            { menuItemId: 'MENU-STAR', itemName: 'Star Item', quantity: 50, unitPricePaisa: 15000, lineSubtotalPaisa: 750000, grossPaisa: 750000 },
            { menuItemId: 'MENU-PLOW', itemName: 'Plow Item', quantity: 50, unitPricePaisa: 5000, lineSubtotalPaisa: 250000, grossPaisa: 250000 },
            { menuItemId: 'MENU-PUZZ', itemName: 'Puzz Item', quantity: 10, unitPricePaisa: 15000, lineSubtotalPaisa: 150000, grossPaisa: 150000 },
            { menuItemId: 'MENU-DOG', itemName: 'Dog Item', quantity: 10, unitPricePaisa: 5000, lineSubtotalPaisa: 50000, grossPaisa: 50000 },
            { menuItemId: 'MENU-UNCL', itemName: 'Uncl Item', quantity: 5, unitPricePaisa: 10000, lineSubtotalPaisa: 50000, grossPaisa: 50000 },
          ],
        }
      ])
    });

    MenuItem.find = () => ({
      lean: () => Promise.resolve([
        { menuItemId: 'MENU-STAR', name: 'Star Item', category: 'CatA', primaryRecipeId: 'RCP-5000' },
        { menuItemId: 'MENU-PLOW', name: 'Plow Item', category: 'CatA', primaryRecipeId: 'RCP-3000' },
        { menuItemId: 'MENU-PUZZ', name: 'Puzz Item', category: 'CatB', primaryRecipeId: 'RCP-5000' },
        { menuItemId: 'MENU-DOG', name: 'Dog Item', category: 'CatB', primaryRecipeId: 'RCP-3000' },
        { menuItemId: 'MENU-UNCL', name: 'Uncl Item', category: 'CatC', primaryRecipeId: null },
      ])
    });

    Recipe.find = () => ({
      lean: () => Promise.resolve([
        { recipeId: 'RCP-5000', batchYield: 1, ingredients: [{ itemId: 'INV-HIGH', quantity: 1 }] },
        { recipeId: 'RCP-3000', batchYield: 1, ingredients: [{ itemId: 'INV-LOW', quantity: 1 }] },
      ])
    });

    GlobalInventoryItem.find = () => ({
      select: () => ({
        lean: () => Promise.resolve([
          { itemId: 'INV-HIGH', unitCostPaisa: 5000 },
          { itemId: 'INV-LOW', unitCostPaisa: 3000 },
        ])
      })
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-25',
        dateTo: '2026-08-25',
      });

      assert.equal(res.thresholds.popularityCutoffUnits, 25);
      assert.equal(res.thresholds.methodology, 'DATASET_RELATIVE_ITEM_MEAN');
      assert.equal(res.thresholds.methodVersion, '1.0.0');
      assert.ok(res.thresholds.contributionCutoffUnitPaisa > 0);

      const qStar = res.quadrants.STAR.map(i => i.itemId);
      const qPlow = res.quadrants.PLOWHORSE.map(i => i.itemId);
      const qPuzz = res.quadrants.PUZZLE.map(i => i.itemId);
      const qDog = res.quadrants.DOG.map(i => i.itemId);
      const qUncl = res.quadrants.UNCLASSIFIED.map(i => i.itemId);

      assert.ok(qStar.includes('MENU-STAR'), 'MENU-STAR must be in STAR quadrant');
      assert.ok(qPlow.includes('MENU-PLOW'), 'MENU-PLOW must be in PLOWHORSE quadrant');
      assert.ok(qPuzz.includes('MENU-PUZZ'), 'MENU-PUZZ must be in PUZZLE quadrant');
      assert.ok(qDog.includes('MENU-DOG'), 'MENU-DOG must be in DOG quadrant');
      assert.ok(qUncl.includes('MENU-UNCL'), 'MENU-UNCL must be UNCLASSIFIED');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ROLE MODEL AUDIT & SCOPE SECURITY (Sections 45, 46)
  // ═══════════════════════════════════════════════════════════════════════════

  await suite.test('12.1 Canonical roles verified: MASTER, OWNER, CAFE_ADMIN, STAFF; Area Manager is NOT an auth role', () => {
    const { USER_ROLES } = require('../src/models/User');
    assert.deepEqual(USER_ROLES, ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF']);
    assert.ok(!USER_ROLES.includes('AREA_MANAGER'), 'AREA_MANAGER must NOT be in USER_ROLES');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. BUSINESS DATE VS CREATED_AT & BOUNDARY TESTS (Blocker D-R2-002)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('13.1 Business Date vs createdAt: Report period filtering strictly uses businessDate', async () => {
    let capturedQuery = null;
    const origFind = Bill.find;
    Bill.find = (q) => {
      capturedQuery = q;
      return { lean: () => Promise.resolve([]) };
    };

    try {
      await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      });

      assert.ok(capturedQuery.businessDate, 'Query must filter by businessDate');
      assert.equal(capturedQuery.createdAt, undefined, 'Query must NOT filter business period by createdAt');
      assert.deepEqual(capturedQuery.businessDate, { $gte: '2026-08-01', $lte: '2026-08-31' });
    } finally {
      Bill.find = origFind;
    }
  });

  await suite.test('13.2 IST midnight & Backdated transaction boundary behavior', async () => {
    const origFind = Bill.find;
    // Bill created late UTC (previous day UTC) but businessDate is IST operating day
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-MIDNIGHT',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          createdAt: new Date('2026-08-14T20:30:00.000Z'), // 02:00 IST on Aug 15
          completedAt: new Date('2026-08-14T20:35:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 20000,
          discountPaisa: 0,
          taxPaisa: 1000,
          totalPaisa: 21000,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'CASH', amountPaisa: 21000 }],
          lineItems: [{ itemName: 'Midnight Brew', quantity: 1, subtotalPaisa: 20000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      assert.equal(res.summary.netSalesPaise, 20000, 'Must record sale under its businessDate (2026-08-15)');
      assert.equal(res.summary.orderCount, 1, 'Must count 1 order for the business day');
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. ORDER SOURCE DERIVATION & UNKNOWN HANDLING (Blocker D-R2-003)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('14.1 Order Source: KIOSK derived, POS explicit, UNKNOWN when absent, external aggregator safe', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-POS',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          status: 'COMPLETED',
          orderSource: 'POS',
          grossSalesPaisa: 10000,
          totalPaisa: 10000,
          tenders: [{ paymentMethod: 'CASH', amountPaisa: 10000 }]
        },
        {
          _id: 'BILL-KIOSK',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          status: 'COMPLETED',
          registerId: 'KIOSK-02', // derived kiosk
          grossSalesPaisa: 20000,
          totalPaisa: 20000,
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 20000 }]
        },
        {
          _id: 'BILL-ONLINE',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          status: 'COMPLETED',
          metadata: { channel: 'ONLINE' },
          grossSalesPaisa: 30000,
          totalPaisa: 30000,
          tenders: [{ paymentMethod: 'CARD', amountPaisa: 30000 }]
        },
        {
          _id: 'BILL-UNKNOWN',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          status: 'COMPLETED',
          // No orderSource, channel, or kiosk register
          grossSalesPaisa: 15000,
          totalPaisa: 15000,
          tenders: [{ paymentMethod: 'CASH', amountPaisa: 15000 }]
        },
        {
          _id: 'BILL-SWIGGY',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          status: 'COMPLETED',
          metadata: { channel: 'SWIGGY' },
          grossSalesPaisa: 40000,
          totalPaisa: 40000,
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 40000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const sources = res.orderSourceBreakdown;
      assert.ok(sources.POS, 'Must recognize POS');
      assert.equal(sources.POS.orders, 1);
      assert.ok(sources.KIOSK, 'Must recognize KIOSK');
      assert.equal(sources.KIOSK.orders, 1);
      assert.ok(sources.ONLINE, 'Must recognize ONLINE');
      assert.equal(sources.ONLINE.orders, 1);
      assert.ok(sources.UNKNOWN, 'Must categorize missing source as UNKNOWN (not defaulting to POS)');
      assert.equal(sources.UNKNOWN.orders, 1);
      assert.ok(sources.SWIGGY, 'Must safely retain external channel without crashing');
      assert.equal(sources.SWIGGY.orders, 1);
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. MENU ENGINEERING ARITHMETIC MEAN METHODOLOGY (Blocker D-R2-004)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('15.1 Menu Engineering: Unweighted arithmetic-mean vs volume-weighted threshold distinction', async () => {
    const origBillFind = Bill.find;
    const origMenuFind = MenuItem.find;
    const origRecipeFind = Recipe.find;
    const origInvFind = GlobalInventoryItem.find;

    // Fixture designed specifically so volume-weighted mean != arithmetic mean:
    // Item A: 1 unit sold @ 10000 net, recipe cost 2000 -> unit contribution 8000
    // Item B: 99 units sold @ 3000 net/unit, recipe cost 1000 -> unit contribution 2000
    // Arithmetic mean unit contribution = (8000 + 2000) / 2 = 5000 paise
    // Volume weighted mean = (1 * 8000 + 99 * 2000) / 100 = 2060 paise
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-WEIGHTED-TEST',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-25',
          completedAt: new Date(),
          status: 'COMPLETED',
          lineItems: [
            { menuItemId: 'MENU-A', itemName: 'High Margin Low Vol', quantity: 1, unitPricePaisa: 10000, lineSubtotalPaisa: 10000, grossPaisa: 10000 },
            { menuItemId: 'MENU-B', itemName: 'Low Margin High Vol', quantity: 99, unitPricePaisa: 3000, lineSubtotalPaisa: 297000, grossPaisa: 297000 },
          ],
        }
      ])
    });

    MenuItem.find = () => ({
      lean: () => Promise.resolve([
        { menuItemId: 'MENU-A', name: 'High Margin Low Vol', category: 'Coffee', primaryRecipeId: 'RCP-A' },
        { menuItemId: 'MENU-B', name: 'Low Margin High Vol', category: 'Bakery', primaryRecipeId: 'RCP-B' },
      ])
    });

    Recipe.find = () => ({
      lean: () => Promise.resolve([
        { recipeId: 'RCP-A', batchYield: 1, ingredients: [{ itemId: 'INV-A', quantity: 1 }] },
        { recipeId: 'RCP-B', batchYield: 1, ingredients: [{ itemId: 'INV-B', quantity: 1 }] },
      ])
    });

    GlobalInventoryItem.find = () => ({
      select: () => ({
        lean: () => Promise.resolve([
          { itemId: 'INV-A', unitCostPaisa: 2000 },
          { itemId: 'INV-B', unitCostPaisa: 1000 },
        ])
      })
    });

    try {
      const res = await calculateMenuMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-25',
        dateTo: '2026-08-25',
      });

      assert.equal(res.thresholds.methodology, 'DATASET_RELATIVE_ITEM_MEAN');
      assert.equal(res.thresholds.methodVersion, '1.0.0');
      // Arithmetic mean of unit contributions (8000 + 2000) / 2 = 5000 paise (₹50.00)
      assert.equal(res.thresholds.contributionCutoffUnitPaisa, 5000, 'Contribution threshold must be arithmetic mean (5000), not volume weighted (2060)');
      assert.equal(res.thresholds.contributionCutoffUnitInr, 50.00);

      const itemB = res.engineering.items.find(i => i.itemId === 'MENU-B');
      // Item B has unit contribution 2000 paise < threshold 5000 paise, and high volume (99 >= 50) -> PLOWHORSE
      assert.equal(itemB.quadrant, 'PLOWHORSE', 'Item B must be classified as PLOWHORSE under arithmetic mean cutoff');
    } finally {
      Bill.find = origBillFind;
      MenuItem.find = origMenuFind;
      Recipe.find = origRecipeFind;
      GlobalInventoryItem.find = origInvFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. COST-AS-OF DISCLOSURE & MISSING TIMESTAMP (Blocker D-R2-005)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('16.1 CostAsOf formatting: Concrete formatted date and safe timestamp-unavailable fallback', () => {
    // When timestamp is provided
    const formatted = formatCostAsOf('2026-09-08T16:45:00.000Z');
    assert.ok(formatted.includes('IST'), 'Formatted string must include IST');
    const noticeWithDate = buildTheoreticalCostingNotice('2026-09-08T16:45:00.000Z');
    assert.ok(noticeWithDate.includes('uses current standard ingredient cost as of'), 'Must include as of date');
    assert.ok(!noticeWithDate.includes('as of .'), 'Must never have dangling as of .');

    // When timestamp is missing
    const noticeMissing = buildTheoreticalCostingNotice(null);
    assert.ok(noticeMissing.includes('Cost timestamp unavailable.'), 'Must include timestamp unavailable message');
    assert.ok(!noticeMissing.includes('as of .'), 'Must never have dangling as of .');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. BASKET AFFINITY TOP-50 COVERAGE METADATA (Blocker D-R2-006)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('17.1 Basket Affinity: Top-50 velocity bounding, metadata disclosure, memory safety', async () => {
    const origFind = Bill.find;
    // Generate synthetic bills with items
    const syntheticBills = [];
    for (let b = 1; b <= 10; b++) {
      syntheticBills.push({
        _id: `BILL-SYN-${b}`,
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        businessDate: '2026-08-15',
        status: 'COMPLETED',
        grossSalesPaisa: 50000,
        totalPaisa: 50000,
        tenders: [{ paymentMethod: 'CASH', amountPaisa: 50000 }],
        lineItems: [
          { menuItemId: 'ITEM-COFFEE', itemName: 'Signature Coffee', quantity: 1, subtotalPaisa: 25000 },
          { menuItemId: 'ITEM-CROISSANT', itemName: 'Butter Croissant', quantity: 1, subtotalPaisa: 25000 },
        ]
      });
    }

    Bill.find = () => ({ lean: () => Promise.resolve(syntheticBills) });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const aff = res.basketAffinity;
      assert.equal(aff.analysisCoverage, 'TOP_N_BY_VELOCITY');
      assert.equal(aff.analysisLimit, 50);
      assert.ok(aff.disclosure.includes('50 highest-velocity items'));
      assert.ok(Array.isArray(aff.pairs), 'Pairs must be an array');
      assert.equal(aff.pairs.length, 1, 'Coffee and Croissant must form 1 pair');
      assert.equal(aff.pairs[0].coOccurrenceCount, 10, 'Must co-occur in 10 bills');
    } finally {
      Bill.find = origFind;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. EXTENDED VISUAL TOTAL INVARIANTS & RECONCILIATION (Section 36)
  // ═══════════════════════════════════════════════════════════════════════════
  await suite.test('18.1 Visual Total Invariants: Hourly, Category, ServiceMode and Heatmap reconcile to Net Sales', async () => {
    const origFind = Bill.find;
    Bill.find = () => ({
      lean: () => Promise.resolve([
        {
          _id: 'BILL-V1',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T09:30:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 60000,
          discountPaisa: 5000,
          taxPaisa: 2750,
          totalPaisa: 57750,
          serviceMode: 'DINE_IN',
          orderSource: 'POS',
          tenders: [{ paymentMethod: 'UPI', amountPaisa: 57750 }],
          lineItems: [{ menuItemId: 'IT-1', itemName: 'Coffee', quantity: 2, grossPaisa: 60000, discountPaisa: 5000, subtotalPaisa: 55000, lineSubtotalPaisa: 55000 }]
        },
        {
          _id: 'BILL-V2',
          organisationId: 'ORG-ZAMORIN',
          cafeId: 'ZC-0001',
          businessDate: '2026-08-15',
          completedAt: new Date('2026-08-15T14:30:00.000Z'),
          status: 'COMPLETED',
          grossSalesPaisa: 40000,
          discountPaisa: 0,
          taxPaisa: 2000,
          totalPaisa: 42000,
          serviceMode: 'TAKEAWAY',
          orderSource: 'KIOSK',
          tenders: [{ paymentMethod: 'CARD', amountPaisa: 42000 }],
          lineItems: [{ menuItemId: 'IT-2', itemName: 'Pastry', quantity: 1, subtotalPaisa: 40000 }]
        }
      ])
    });

    try {
      const res = await calculateSalesMetrics({
        organisationId: 'ORG-ZAMORIN',
        dateFrom: '2026-08-15',
        dateTo: '2026-08-15',
      });

      const netSales = res.summary.netSalesPaise; // 55000 + 40000 = 95000
      assert.equal(netSales, 95000);

      // Hourly sum == Net Sales
      const hourlySum = res.hourlyTrends.reduce((acc, h) => acc + h.netSalesPaisa, 0);
      assert.equal(hourlySum, netSales, 'Hourly trend sum must equal Net Sales');

      // Category sum == Net Sales
      const catSum = res.categorySales.reduce((acc, c) => acc + c.netSalesPaisa, 0);
      assert.equal(catSum, netSales, 'Category sales sum must equal Net Sales');

      // Service mode sum == Net Sales
      const smSum = res.serviceModes.reduce((acc, sm) => acc + sm.netSalesPaisa, 0);
      assert.equal(smSum, netSales, 'Service mode sum must equal Net Sales');

      // Heatmap sum == Net Sales
      const heatmapSum = res.salesHeatmap.reduce((acc, cell) => acc + cell.netSalesPaisa, 0);
      assert.equal(heatmapSum, netSales, 'Heatmap matrix sum must equal Net Sales');
    } finally {
      Bill.find = origFind;
    }
  });

});
