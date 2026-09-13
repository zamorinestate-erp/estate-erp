'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: salesCalculations.js (PM-02D)
 * 
 * Deep Analytical Sales Engine:
 * - Sales Overview & Gross-to-Net Sales Waterfall
 * - Sales Trend (Hour IST, Day, Week, Month, Business Date)
 * - Sales by Café (Portfolio Contribution %)
 * - Sales by Menu Category (Volume, Revenue, Bill Penetration, Sales Share)
 * - Sales by Menu Item & Comprehensive Product Mix (PMIX)
 * - Top / Bottom Rankings (Volume, Net Sales, Growth)
 * - Modifier Analytics (Counts, Sales, Attach Rate to Base Items)
 * - Variant & Size Analytics (Configured Size, Temperature, Sweetness)
 * - Service Mode & Order Source / Channel Breakdowns
 * - Payment Mix & Split-Tender Exact Paise Allocation
 * - Discount Intelligence (Value, %, Count, by Café, Category, Item, Operator)
 * - Refund Analytics (Full vs Partial, Traceability, by Café, Reasons)
 * - Void & Reversal Analytics (Audited Voids vs Payment Reversals)
 * - Day of Week & 7x24 Sales Heatmap
 * - Category & Item Pareto Distribution
 * - Basket / Item Co-occurrence Affinity
 * - Combo & Open / Manual Item Operational Controls
 * - Period Comparison Support (Prior Period / Prior Year)
 * - Data Quality & Lineage Transparency
 */

const mongoose = require('mongoose');
const { Bill } = require('../../models/Bill');
const { MenuItem } = require('../../models/MenuItem');
const { reconstructGrossSales, computeGrossToNetBridge } = require('../reportingMoney');
const { resolveComparisonPeriod } = require('../reportingTime');
const { PROPOSED_DEFAULT_DAYPARTS } = require('../dimensionRegistry');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BUSINESS_DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CANONICAL_SERVICE_MODES = ['QUICK_SALE', 'DINE_IN', 'TAKEAWAY', 'DELIVERY', 'SCHEDULED_PICKUP'];
const CANONICAL_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'CREDIT', 'COMPLIMENTARY'];

/**
 * Calculates deep canonical sales metrics for a given scope, date range, and filters.
 *
 * @param {Object} options
 * @param {string} options.organisationId - Tenant organisation ID
 * @param {string|string[]|null} [options.cafeScope] - Authorized café scope
 * @param {string} options.dateFrom - ISO date string YYYY-MM-DD
 * @param {string} options.dateTo - ISO date string YYYY-MM-DD
 * @param {string|null} [options.comparison] - Comparison type ('PRIOR_PERIOD', 'PRIOR_YEAR', null)
 * @param {Object} [options.filters] - Optional dimensional filters
 * @returns {Promise<Object>} Calculated metrics, multidimensional breakdowns, and provenance
 */
async function calculateSalesMetrics({ organisationId, cafeScope, dateFrom, dateTo, comparison = null, filters = {} }) {
  if (!organisationId) {
    throw new Error('salesCalculations: organisationId is required.');
  }

  // 1. Fetch MenuItem catalogue for category enrichment and master metadata
  const menuItemMap = {};
  if (mongoose.connection?.readyState === 1 || MenuItem.find !== mongoose.Model.find) {
    try {
      const items = await MenuItem.find({ organisationId }).select('menuItemId name category currentPricePaisa variants').lean();
      for (const it of items) {
        if (it.menuItemId) menuItemMap[it.menuItemId.toUpperCase()] = it;
        if (it.name) menuItemMap[it.name.toLowerCase()] = it;
      }
    } catch (_) {
      // in-memory / unit-test tolerance
    }
  }

  // 2. Execute Primary Period Calculation
  const primaryResult = await _computePeriodSales({
    organisationId,
    cafeScope,
    dateFrom,
    dateTo,
    filters,
    menuItemMap,
  });

  // 3. Execute Comparison Period Calculation if requested
  let comparisonData = null;
  if (comparison && dateFrom && dateTo) {
    const compPeriod = resolveComparisonPeriod(
      { dateFrom, dateTo, period: 'CUSTOM', label: `${dateFrom} to ${dateTo}` },
      comparison
    );
    if (compPeriod && compPeriod.dateFrom && compPeriod.dateTo) {
      try {
        const compResult = await _computePeriodSales({
          organisationId,
          cafeScope,
          dateFrom: compPeriod.dateFrom,
          dateTo: compPeriod.dateTo,
          filters,
          menuItemMap,
        });

        const curNet = primaryResult.summary.netSalesPaise || 0;
        const priorNet = compResult.summary.netSalesPaise || 0;
        const curOrders = primaryResult.summary.orderCount || 0;
        const priorOrders = compResult.summary.orderCount || 0;

        const netSalesGrowthPct = priorNet > 0
          ? Number((((curNet - priorNet) / priorNet) * 100).toFixed(1))
          : null;
        const orderGrowthPct = priorOrders > 0
          ? Number((((curOrders - priorOrders) / priorOrders) * 100).toFixed(1))
          : null;

        comparisonData = {
          comparisonType: comparison,
          period: compPeriod,
          summary: compResult.summary,
          growthRates: {
            netSalesGrowthPercent: netSalesGrowthPct,
            orderGrowthPercent: orderGrowthPct,
          },
        };
      } catch (_) {
        comparisonData = null;
      }
    }
  }

  return {
    ...primaryResult,
    comparison: comparisonData,
  };
}

/**
 * Internal worker calculating sales for a single date boundary.
 */
async function _computePeriodSales({ organisationId, cafeScope, dateFrom, dateTo, filters = {}, menuItemMap = {} }) {
  const billMatch = {
    organisationId,
    status: { $in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'PAYMENT_REVERSED'] },
  };

  if (cafeScope) {
    billMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }

  if (dateFrom && dateTo) {
    billMatch.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  }

  // Dimensional filters
  if (filters.serviceMode) {
    const sm = String(filters.serviceMode).toUpperCase();
    if (CANONICAL_SERVICE_MODES.includes(sm)) {
      billMatch.serviceMode = sm;
    } else {
      billMatch.serviceMode = '__UNSUPPORTED_MODE__';
    }
  }
  if (filters.paymentMethod) {
    const pm = String(filters.paymentMethod).toUpperCase();
    if (CANONICAL_PAYMENT_METHODS.includes(pm)) {
      billMatch.$or = [
        { paymentMethod: pm },
        { 'tenders.paymentMethod': pm },
      ];
    } else {
      billMatch.paymentMethod = '__UNSUPPORTED_TENDER__';
    }
  }
  if (filters.orderSource) {
    const os = String(filters.orderSource).toUpperCase();
    if (os === 'KIOSK') {
      billMatch.$or = [
        { orderSource: 'KIOSK' },
        { 'metadata.channel': 'KIOSK' },
        { source: 'KIOSK' },
        { registerId: /^KIOSK/i },
      ];
    } else if (os === 'POS') {
      billMatch.$or = [
        { orderSource: 'POS' },
        { 'metadata.channel': 'POS' },
        { source: 'POS' },
      ];
    } else if (os === 'ONLINE') {
      billMatch.$or = [
        { orderSource: 'ONLINE' },
        { 'metadata.channel': 'ONLINE' },
        { source: 'ONLINE' },
      ];
    } else if (os === 'QR_ORDER') {
      billMatch.$or = [
        { orderSource: 'QR_ORDER' },
        { 'metadata.channel': 'QR_ORDER' },
        { source: 'QR_ORDER' },
      ];
    } else if (os === 'UNKNOWN') {
      billMatch.$and = [
        { orderSource: { $nin: ['POS', 'KIOSK', 'ONLINE', 'QR_ORDER'] } },
        { 'metadata.channel': { $nin: ['POS', 'KIOSK', 'ONLINE', 'QR_ORDER'] } },
        { source: { $nin: ['POS', 'KIOSK', 'ONLINE', 'QR_ORDER'] } },
        { registerId: { $not: /^KIOSK/i } },
      ];
    } else {
      billMatch.$or = [
        { orderSource: os },
        { 'metadata.channel': os },
        { source: os },
      ];
    }
  }
  if (filters.cafeId && (!cafeScope || (Array.isArray(cafeScope) && cafeScope.includes(filters.cafeId)) || cafeScope === filters.cafeId)) {
    billMatch.cafeId = filters.cafeId;
  }

  let bills = [];
  if (mongoose.connection?.readyState === 1 || Bill.find !== mongoose.Model.find) {
    try {
      bills = await Bill.find(billMatch).lean();
    } catch (err) {
      bills = [];
    }
  }

  // Headline totals
  let totalOrders = 0;
  let grossSalesPaisa = 0;
  let salesBeforeTaxPaisa = 0;
  let discountPaisa = 0;
  let customerRefundPaisa = 0;
  let preTaxRefundPaisa = 0;
  let taxChargedPaisa = 0;
  let refundedTaxPaisa = 0;
  let netSalesPaisa = 0;

  // Quality & Counts
  let partialRefundCount = 0;
  let unallocatedPartialRefundCount = 0;
  let fullRefundCount = 0;
  const allBillItemsList = [];
  let legacyInsufficientBillsCount = 0;
  let totalBillLines = 0;
  let unmappedItemsCount = 0;

  // Voids & Reversals (Isolated)
  let voidCount = 0;
  let voidTotalPaisa = 0;
  let paymentReversedCount = 0;
  let paymentReversedTotalPaisa = 0;
  const voidRecords = [];

  // Breakdowns
  const hourlyMap = {};
  const dayOfWeekMap = {};
  const heatmapGrid = {};
  const cafeMap = {};
  const categoryMap = {};
  const itemMap = {};
  const pmixMap = {};
  const modifierMap = {};
  const sizeMap = {};
  const tempMap = {};
  const serviceModeMap = {};
  const orderSourceMap = {};
  const tenderMap = {};
  let splitTenderCount = 0;
  let splitTenderTotalPaisa = 0;
  const discountByCafeMap = {};
  const discountByCategoryMap = {};
  const discountByItemMap = {};
  const discountByOperatorMap = {};
  const refundByCafeMap = {};
  const refundReasons = [];
  const basketCoOccurrence = {};
  const itemBillOccurrences = {};
  const openItemsList = [];

  // Initialize hourly slots (00:00 to 23:00)
  for (let h = 0; h < 24; h++) {
    const hStr = (h < 10 ? '0' + h : '' + h) + ':00';
    hourlyMap[hStr] = { orders: 0, netSalesPaisa: 0, grossSalesPaisa: 0 };
  }

  // Initialize day of week slots
  for (const day of BUSINESS_DAYS_ORDER) {
    dayOfWeekMap[day] = { orders: 0, netSalesPaisa: 0, grossSalesPaisa: 0 };
    heatmapGrid[day] = {};
    for (let h = 0; h < 24; h++) {
      const hStr = (h < 10 ? '0' + h : '' + h) + ':00';
      heatmapGrid[day][hStr] = { orders: 0, netSalesPaisa: 0 };
    }
  }

  // Process Bills
  for (const bill of bills) {
    const status = bill.status;

    // ── Void & Reversal Track ────────────────────────────────────────────────
    if (status === 'VOIDED') {
      voidCount += 1;
      const amt = Number(bill.totalPaisa || 0);
      voidTotalPaisa += amt;
      voidRecords.push({
        billId: bill.billId,
        cafeId: bill.cafeId,
        amountPaisa: amt,
        amount: Number((amt / 100).toFixed(2)),
        operatorId: bill.voidedByUserId || bill.cashierUserId || 'UNKNOWN',
        reason: bill.voidReason || 'Not Specified',
        voidedAt: bill.voidedAt || bill.updatedAt || bill.createdAt,
        type: 'VOIDED',
      });
      continue;
    }

    if (status === 'PAYMENT_REVERSED') {
      paymentReversedCount += 1;
      const amt = Number(bill.totalPaisa || 0);
      paymentReversedTotalPaisa += amt;
      voidRecords.push({
        billId: bill.billId,
        cafeId: bill.cafeId,
        amountPaisa: amt,
        amount: Number((amt / 100).toFixed(2)),
        operatorId: bill.cashierUserId || 'UNKNOWN',
        reason: bill.voidReason || 'Processor Reversal',
        voidedAt: bill.updatedAt || bill.createdAt,
        type: 'PAYMENT_REVERSED',
      });
      continue;
    }

    // ── Completed / Refund Track ─────────────────────────────────────────────
    const isCompleted = status === 'COMPLETED';
    const isPartialRefund = status === 'PARTIALLY_REFUNDED';
    const isFullRefund = status === 'REFUNDED';

    if (isCompleted || isPartialRefund) {
      totalOrders += 1;
    }

    // 1. Gross Sales via Hierarchy A-E
    let bGross = typeof bill.grossSalesPaisa === 'number' && !Number.isNaN(bill.grossSalesPaisa)
      ? Math.round(bill.grossSalesPaisa)
      : null;

    if (bGross === null) {
      const bGrossResult = reconstructGrossSales(bill);
      bGross = typeof bGrossResult === 'object' && bGrossResult !== null
        ? bGrossResult.grossSalesPaisa
        : (typeof bGrossResult === 'number' ? bGrossResult : null);
    }

    if (bGross === null) {
      legacyInsufficientBillsCount += 1;
    } else {
      grossSalesPaisa += bGross;
    }

    // 2. Discounts
    const bDiscount = Number(bill.discountPaisa || 0);
    discountPaisa += bDiscount;

    // 3. Sales Before Tax (pre-tax post-discount)
    const bEffectiveSubtotal = bGross !== null ? bGross : Number(bill.subtotalPaisa || bill.taxableAmountPaisa || 0);
    const bSalesBeforeTax = Math.max(0, bEffectiveSubtotal - bDiscount);
    salesBeforeTaxPaisa += bSalesBeforeTax;

    // 4. Tax Charged
    const bTaxCharged = Number(bill.taxPaisa || 0);
    taxChargedPaisa += bTaxCharged;

    // 5. Refunds & Returns
    const bCustomerRefund = Number(bill.refundedTotalPaisa || 0);
    customerRefundPaisa += bCustomerRefund;

    let bPreTaxRefund = 0;
    let bRefundedTax = 0;
    let hasAuthoritativeAllocation = false;

    if (isFullRefund) {
      fullRefundCount += 1;
      bPreTaxRefund = bSalesBeforeTax;
      bRefundedTax = bTaxCharged;
      hasAuthoritativeAllocation = true;
    } else if (isPartialRefund) {
      partialRefundCount += 1;
      if (typeof bill.preTaxRefundPaisa === 'number' && bill.preTaxRefundPaisa > 0) {
        bPreTaxRefund = bill.preTaxRefundPaisa;
        bRefundedTax = Number(bill.refundedTaxPaisa || 0);
        hasAuthoritativeAllocation = true;
      } else if (Array.isArray(bill.creditNotes) && bill.creditNotes.length > 0) {
        const cnTaxable = bill.creditNotes.reduce((acc, cn) => acc + Number(cn.taxableAdjustmentPaisa || 0), 0);
        const cnTax = bill.creditNotes.reduce((acc, cn) => acc + Number(cn.taxAdjustmentPaisa || 0), 0);
        if (cnTaxable > 0 || cnTax > 0) {
          bPreTaxRefund = cnTaxable;
          bRefundedTax = cnTax;
          hasAuthoritativeAllocation = true;
        }
      } else if (Array.isArray(bill.refunds) && bill.refunds.length > 0) {
        const rfTaxable = bill.refunds.reduce((acc, rf) => acc + Number(rf.taxableAdjustmentPaisa || rf.preTaxPaisa || 0), 0);
        const rfTax = bill.refunds.reduce((acc, rf) => acc + Number(rf.taxAdjustmentPaisa || rf.taxPaisa || 0), 0);
        if (rfTaxable > 0 || rfTax > 0) {
          bPreTaxRefund = rfTaxable;
          bRefundedTax = rfTax;
          hasAuthoritativeAllocation = true;
        }
      }

      if (!hasAuthoritativeAllocation) {
        // PM-02A Freeze Gate: Do NOT manufacture pro-rata pre-tax refund or reverse-engineered tax!
        unallocatedPartialRefundCount += 1;
        bPreTaxRefund = 0;
        bRefundedTax = 0;
      }
    }

    preTaxRefundPaisa += bPreTaxRefund;
    refundedTaxPaisa += bRefundedTax;

    // 6. Net Sales per bill
    const bridge = computeGrossToNetBridge({
      grossSalesPaisa: bGross !== null ? bGross : bSalesBeforeTax + bDiscount,
      discountPaisa: bDiscount,
      preTaxRefundPaisa: bPreTaxRefund,
    });
    const billNetSalesPaisa = bridge.netSalesPaisa;
    netSalesPaisa += billNetSalesPaisa;

    const bCafeId = bill.cafeId || 'ZC-UNKNOWN';
    const bServiceMode = bill.serviceMode || bill.orderType || 'QUICK_SALE';

    // Canonical Order Source Derivation (no unconditional POS fallback)
    let bOrderSource = 'UNKNOWN';
    let bSourceClassification = 'UNKNOWN';
    if (bill.orderSource && typeof bill.orderSource === 'string' && bill.orderSource.trim().length > 0) {
      bOrderSource = bill.orderSource.trim().toUpperCase();
      bSourceClassification = 'STORED';
    } else if (bill.metadata?.channel && typeof bill.metadata.channel === 'string' && bill.metadata.channel.trim().length > 0) {
      bOrderSource = bill.metadata.channel.trim().toUpperCase();
      bSourceClassification = 'STORED';
    } else if (bill.source && typeof bill.source === 'string' && bill.source.trim().length > 0) {
      bOrderSource = bill.source.trim().toUpperCase();
      bSourceClassification = 'STORED';
    } else if (bill.registerId && typeof bill.registerId === 'string' && bill.registerId.toUpperCase().startsWith('KIOSK')) {
      bOrderSource = 'KIOSK';
      bSourceClassification = 'DERIVED_REGISTER_CONVENTION';
    } else {
      bOrderSource = 'UNKNOWN';
      bSourceClassification = 'UNKNOWN';
    }

    const bCashier = bill.cashierUserId || 'STAFF';

    // 7. Café Analytics
    if (!cafeMap[bCafeId]) {
      cafeMap[bCafeId] = {
        cafeId: bCafeId,
        grossSalesPaisa: 0,
        netSalesPaisa: 0,
        orderCount: 0,
        discountPaisa: 0,
        refundPaisa: 0,
        taxPaisa: 0,
      };
    }
    if (isCompleted || isPartialRefund) cafeMap[bCafeId].orderCount += 1;
    cafeMap[bCafeId].grossSalesPaisa += (bGross || 0);
    cafeMap[bCafeId].netSalesPaisa += billNetSalesPaisa;
    cafeMap[bCafeId].discountPaisa += bDiscount;
    cafeMap[bCafeId].refundPaisa += bCustomerRefund;
    cafeMap[bCafeId].taxPaisa += bTaxCharged;

    // 8. Temporal Aggregations (Asia/Kolkata)
    const billTimestamp = bill.completedAt || bill.paidAt || bill.createdAt || bill.updatedAt;
    if (billTimestamp && (isCompleted || isPartialRefund)) {
      const d = new Date(billTimestamp);
      let hourStr = '12:00';
      let dayName = 'Monday';
      try {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hour12: false,
          weekday: 'long',
        }).formatToParts(d);
        const hPart = parts.find((p) => p.type === 'hour');
        const wPart = parts.find((p) => p.type === 'weekday');
        if (hPart) hourStr = hPart.value + ':00';
        if (wPart) dayName = wPart.value;
      } catch (_) {
        hourStr = (d.getHours() < 10 ? '0' + d.getHours() : '' + d.getHours()) + ':00';
        dayName = DAYS_OF_WEEK[d.getDay()] || 'Monday';
      }

      if (hourlyMap[hourStr]) {
        hourlyMap[hourStr].orders += 1;
        hourlyMap[hourStr].netSalesPaisa += billNetSalesPaisa;
        hourlyMap[hourStr].grossSalesPaisa += (bGross || 0);
      }
      if (dayOfWeekMap[dayName]) {
        dayOfWeekMap[dayName].orders += 1;
        dayOfWeekMap[dayName].netSalesPaisa += billNetSalesPaisa;
        dayOfWeekMap[dayName].grossSalesPaisa += (bGross || 0);
      }
      if (heatmapGrid[dayName] && heatmapGrid[dayName][hourStr]) {
        heatmapGrid[dayName][hourStr].orders += 1;
        heatmapGrid[dayName][hourStr].netSalesPaisa += billNetSalesPaisa;
      }
    }

    // 9. Service Mode & Order Source Breakdown
    if (!serviceModeMap[bServiceMode]) {
      serviceModeMap[bServiceMode] = { orders: 0, grossSalesPaisa: 0, netSalesPaisa: 0, discountPaisa: 0, refundPaisa: 0 };
    }
    if (isCompleted || isPartialRefund) serviceModeMap[bServiceMode].orders += 1;
    serviceModeMap[bServiceMode].grossSalesPaisa += (bGross || 0);
    serviceModeMap[bServiceMode].netSalesPaisa += billNetSalesPaisa;
    serviceModeMap[bServiceMode].discountPaisa += bDiscount;
    serviceModeMap[bServiceMode].refundPaisa += bCustomerRefund;

    if (!orderSourceMap[bOrderSource]) {
      orderSourceMap[bOrderSource] = { orders: 0, netSalesPaisa: 0 };
    }
    if (isCompleted || isPartialRefund) orderSourceMap[bOrderSource].orders += 1;
    orderSourceMap[bOrderSource].netSalesPaisa += billNetSalesPaisa;

    // 10. Tender & Split-Tender Exact Allocation
    const tenders = Array.isArray(bill.tenders) && bill.tenders.length > 0
      ? bill.tenders
      : [{ paymentMethod: bill.paymentMethod || 'CASH', amountPaisa: Number(bill.totalPaisa || 0) }];

    if (tenders.length > 1) {
      splitTenderCount += 1;
      splitTenderTotalPaisa += tenders.reduce((acc, t) => acc + Number(t.amountPaisa || 0), 0);
    }

    for (const t of tenders) {
      const m = (t.paymentMethod || 'CASH').toUpperCase();
      const amt = Number(t.amountPaisa || 0);
      if (!tenderMap[m]) tenderMap[m] = { amountPaisa: 0, count: 0 };
      tenderMap[m].amountPaisa += amt;
      tenderMap[m].count += 1;
    }

    // 11. Discounts & Operator Audit
    if (bDiscount > 0) {
      discountByCafeMap[bCafeId] = (discountByCafeMap[bCafeId] || 0) + bDiscount;
      discountByOperatorMap[bCashier] = (discountByOperatorMap[bCashier] || 0) + bDiscount;
    }

    // 12. Refunds Audit
    if (bCustomerRefund > 0) {
      refundByCafeMap[bCafeId] = (refundByCafeMap[bCafeId] || 0) + bCustomerRefund;
      if (Array.isArray(bill.refunds) && bill.refunds.length > 0) {
        for (const rf of bill.refunds) {
          refundReasons.push({
            refundId: rf.refundId,
            billId: bill.billId,
            cafeId: bCafeId,
            amountPaisa: Number(rf.amountPaisa || 0),
            reason: rf.reason || 'General Customer Refund',
            requestedBy: rf.requestedBy,
            tender: rf.tender || 'CASH',
            date: rf.createdAt || bill.updatedAt,
          });
        }
      }
    }

    // 13. Line Item Deep Analytics (Categories, Items, PMIX, Modifiers, Basket)
    const distinctBillItemIds = new Set();
    const lineItems = Array.isArray(bill.lineItems) ? bill.lineItems : [];
    totalBillLines += lineItems.length;

    for (const li of lineItems) {
      const rawItemId = (li.menuItemId || '').trim().toUpperCase();
      const rawItemName = li.itemNameSnapshot || li.itemName || li.name || 'Unnamed Item';
      const masterItem = menuItemMap[rawItemId] || menuItemMap[rawItemName.toLowerCase()] || {};
      const category = masterItem.category || li.taxClassification || 'OTHER';
      const qty = Number(li.quantity || 1);
      const unitPrice = Number(li.unitPricePaisa || li.pricePaisa || 0);
      const liDiscount = Number(li.discountPaisa || 0);
      const liSubtotal = Number(li.lineSubtotalPaisa !== undefined ? li.lineSubtotalPaisa : (li.subtotalPaisa !== undefined ? li.subtotalPaisa : Math.max(0, unitPrice * qty - liDiscount)));
      const liGross = li.grossPaisa !== undefined ? Number(li.grossPaisa) : (unitPrice > 0 ? unitPrice * qty : liSubtotal);

      if (!masterItem.name && !rawItemId.startsWith('MENU-')) {
        unmappedItemsCount += 1;
      }

      // Check for Open/Manual Items
      if (rawItemId.startsWith('MANUAL') || rawItemId.startsWith('OPEN') || rawItemId === 'CUSTOM') {
        openItemsList.push({
          billId: bill.billId,
          cafeId: bCafeId,
          itemId: rawItemId,
          itemName: rawItemName,
          quantity: qty,
          amountPaisa: liSubtotal,
          operatorId: bCashier,
          date: bill.businessDate,
        });
      }

      // Category Aggregates
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          quantity: 0,
          grossSalesPaisa: 0,
          netSalesPaisa: 0,
          discountPaisa: 0,
          refundPaisa: 0,
          billCount: 0,
          distinctItems: new Set(),
        };
      }
      categoryMap[category].quantity += qty;
      categoryMap[category].grossSalesPaisa += liGross;
      categoryMap[category].netSalesPaisa += liSubtotal;
      categoryMap[category].discountPaisa += liDiscount;
      categoryMap[category].distinctItems.add(rawItemId || rawItemName);
      if (liDiscount > 0) {
        discountByCategoryMap[category] = (discountByCategoryMap[category] || 0) + liDiscount;
      }

      // Item Aggregates
      const itemKey = rawItemId || rawItemName;
      if (!itemMap[itemKey]) {
        itemMap[itemKey] = {
          itemId: rawItemId || 'UNMAPPED',
          name: rawItemName,
          category,
          quantity: 0,
          grossSalesPaisa: 0,
          netSalesPaisa: 0,
          discountPaisa: 0,
          refundPaisa: 0,
          billCount: 0,
          cafes: new Set(),
        };
      }
      itemMap[itemKey].quantity += qty;
      itemMap[itemKey].grossSalesPaisa += liGross;
      itemMap[itemKey].netSalesPaisa += liSubtotal;
      itemMap[itemKey].discountPaisa += liDiscount;
      itemMap[itemKey].cafes.add(bCafeId);
      distinctBillItemIds.add(itemKey);

      if (liDiscount > 0) {
        discountByItemMap[itemKey] = (discountByItemMap[itemKey] || 0) + liDiscount;
      }

      // PMIX Multidimensional Records (Item x Category x Cafe x ServiceMode x OrderSource)
      const pmixKey = `${itemKey}__${bCafeId}__${bServiceMode}__${bOrderSource}`;
      if (!pmixMap[pmixKey]) {
        pmixMap[pmixKey] = {
          itemId: rawItemId || 'UNMAPPED',
          itemName: rawItemName,
          category,
          cafeId: bCafeId,
          serviceMode: bServiceMode,
          orderSource: bOrderSource,
          quantity: 0,
          grossSalesPaisa: 0,
          netSalesPaisa: 0,
          discountPaisa: 0,
          billCount: 0,
        };
      }
      pmixMap[pmixKey].quantity += qty;
      pmixMap[pmixKey].grossSalesPaisa += liGross;
      pmixMap[pmixKey].netSalesPaisa += liSubtotal;
      pmixMap[pmixKey].discountPaisa += liDiscount;

      // Modifier Analytics
      if (Array.isArray(li.modifiers)) {
        for (const mod of li.modifiers) {
          const modName = typeof mod === 'string' ? mod : (mod.name || mod.modifierName || 'Modifier');
          const modPrice = typeof mod === 'object' ? Number(mod.modifierPricePaisa || mod.pricePaisa || 0) : 0;
          const modQty = (typeof mod === 'object' && mod.quantity) ? Number(mod.quantity) : 1;
          if (!modifierMap[modName]) {
            modifierMap[modName] = {
              modifier: modName,
              name: modName,
              selectionCount: 0,
              salesPaisa: 0,
              baseItems: {},
              cafes: {},
            };
          }
          modifierMap[modName].selectionCount += modQty;
          modifierMap[modName].salesPaisa += (modPrice * modQty);
          modifierMap[modName].baseItems[rawItemName] = (modifierMap[modName].baseItems[rawItemName] || 0) + modQty;
          modifierMap[modName].cafes[bCafeId] = (modifierMap[modName].cafes[bCafeId] || 0) + modQty;
        }
      } else {
        const mods = li.modifiers || {};
        const modPrice = Number(mods.modifierPricePaisa || 0);
        const modCount = (Array.isArray(mods.addOns) ? mods.addOns.length : 0) + (mods.size && mods.size !== 'Regular' ? 1 : 0);

        if (modCount > 0 || modPrice > 0) {
          const modKey = (mods.addOns && mods.addOns.length > 0) ? mods.addOns.join(' + ') : (mods.size || 'Custom Modifier');
          if (!modifierMap[modKey]) {
            modifierMap[modKey] = {
              modifier: modKey,
              name: modKey,
              selectionCount: 0,
              salesPaisa: 0,
              baseItems: {},
              cafes: {},
            };
          }
          modifierMap[modKey].selectionCount += qty;
          modifierMap[modKey].salesPaisa += (modPrice * qty);
          modifierMap[modKey].baseItems[rawItemName] = (modifierMap[modKey].baseItems[rawItemName] || 0) + qty;
          modifierMap[modKey].cafes[bCafeId] = (modifierMap[modKey].cafes[bCafeId] || 0) + qty;
        }

        // Variant & Attributes
        if (mods.size) {
          sizeMap[mods.size] = (sizeMap[mods.size] || 0) + qty;
        }
        if (mods.temperature) {
          tempMap[mods.temperature] = (tempMap[mods.temperature] || 0) + qty;
        }
      }
    }

    // Bill penetration and item co-occurrence tracking
    const billItemsArr = Array.from(distinctBillItemIds);
    for (const itId of billItemsArr) {
      if (itemMap[itId]) itemMap[itId].billCount += 1;
      itemBillOccurrences[itId] = (itemBillOccurrences[itId] || 0) + 1;
    }

    // Record items on bill for bounded Top-50 Basket Affinity
    allBillItemsList.push(billItemsArr);

    // Category bill penetration
    const distinctCategories = new Set(lineItems.map((li) => {
      const m = menuItemMap[(li.menuItemId || '').toUpperCase()] || {};
      return m.category || 'OTHER';
    }));
    for (const cat of distinctCategories) {
      if (categoryMap[cat]) categoryMap[cat].billCount += 1;
    }
  }

  // ── Post-Processing & Normalization ──────────────────────────────────────────
  const aovPaisa = totalOrders > 0 ? Math.round(netSalesPaisa / totalOrders) : 0;
  const netTaxPaisa = Math.max(0, taxChargedPaisa - refundedTaxPaisa);

  // 1. Hourly Trend Formatting
  const hourlyTrends = totalOrders === 0 ? [] : Object.keys(hourlyMap).sort().map((hour) => {
    const h = hourlyMap[hour];
    const hOrders = h.orders;
    const hNetPaisa = h.netSalesPaisa;
    return {
      hour,
      orders: hOrders,
      transactions: hOrders,
      netSalesPaisa: hNetPaisa,
      netSales: Number((hNetPaisa / 100).toFixed(2)),
      sales: Number((hNetPaisa / 100).toFixed(2)),
      grossSalesPaisa: h.grossSalesPaisa,
      grossSales: Number((h.grossSalesPaisa / 100).toFixed(2)),
      aov: hOrders > 0 ? Number((hNetPaisa / hOrders / 100).toFixed(2)) : 0,
    };
  });

  // 2. Day of Week Formatting
  const dayOfWeekTrends = BUSINESS_DAYS_ORDER.map((day, idx) => {
    const d = dayOfWeekMap[day];
    const dOrders = d.orders;
    const dNetPaisa = d.netSalesPaisa;
    return {
      dayOfWeek: day,
      dayNumber: idx + 1,
      orders: dOrders,
      netSalesPaisa: dNetPaisa,
      netSales: Number((dNetPaisa / 100).toFixed(2)),
      grossSalesPaisa: d.grossSalesPaisa,
      grossSales: Number((d.grossSalesPaisa / 100).toFixed(2)),
      aov: dOrders > 0 ? Number((dNetPaisa / dOrders / 100).toFixed(2)) : 0,
    };
  });

  // 3. Sales Heatmap (Day x Hour Matrix)
  const salesHeatmap = [];
  for (const day of BUSINESS_DAYS_ORDER) {
    for (let h = 0; h < 24; h++) {
      const hStr = (h < 10 ? '0' + h : '' + h) + ':00';
      const cell = heatmapGrid[day][hStr];
      salesHeatmap.push({
        dayOfWeek: day,
        hour: hStr,
        orders: cell.orders,
        netSalesPaisa: cell.netSalesPaisa,
        netSales: Number((cell.netSalesPaisa / 100).toFixed(2)),
        aov: cell.orders > 0 ? Number((cell.netSalesPaisa / cell.orders / 100).toFixed(2)) : 0,
      });
    }
  }

  // 4. Sales by Café Breakdown
  const salesByCafe = Object.values(cafeMap).map((c) => {
    const cafeNet = c.netSalesPaisa;
    const cOrders = c.orderCount;
    return {
      cafeId: c.cafeId,
      grossSalesPaisa: c.grossSalesPaisa,
      grossSalesPaise: c.grossSalesPaisa,
      grossSales: Number((c.grossSalesPaisa / 100).toFixed(2)),
      netSalesPaisa: cafeNet,
      netSalesPaise: cafeNet,
      netSales: Number((cafeNet / 100).toFixed(2)),
      orderCount: cOrders,
      aovPaisa: cOrders > 0 ? Math.round(cafeNet / cOrders) : 0,
      aov: cOrders > 0 ? Number((cafeNet / cOrders / 100).toFixed(2)) : 0,
      discountPaisa: c.discountPaisa,
      refundPaisa: c.refundPaisa,
      taxPaisa: c.taxPaisa,
      contributionPercent: netSalesPaisa > 0 ? Number(((cafeNet / netSalesPaisa) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 5. Sales by Category
  const salesByCategory = Object.values(categoryMap).map((cat) => {
    return {
      category: cat.category,
      quantity: cat.quantity,
      grossSalesPaisa: cat.grossSalesPaisa,
      grossSalesPaise: cat.grossSalesPaisa,
      grossSales: Number((cat.grossSalesPaisa / 100).toFixed(2)),
      netSalesPaisa: cat.netSalesPaisa,
      netSalesPaise: cat.netSalesPaisa,
      netSales: Number((cat.netSalesPaisa / 100).toFixed(2)),
      discountPaisa: cat.discountPaisa,
      refundPaisa: cat.refundPaisa,
      billCount: cat.billCount,
      billPenetration: totalOrders > 0 ? Number(((cat.billCount / totalOrders) * 100).toFixed(1)) : 0,
      salesSharePercent: netSalesPaisa > 0 ? Number(((cat.netSalesPaisa / netSalesPaisa) * 100).toFixed(1)) : 0,
      distinctItemCount: cat.distinctItems.size,
    };
  }).sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 6. Sales by Item & PMIX
  const salesByItem = Object.values(itemMap).map((it) => {
    const itemNet = it.netSalesPaisa;
    const itemQty = it.quantity;
    const catTotalNet = (categoryMap[it.category] && categoryMap[it.category].netSalesPaisa) || 1;
    return {
      itemId: it.itemId,
      name: it.name,
      category: it.category,
      quantity: itemQty,
      grossSalesPaisa: it.grossSalesPaisa,
      grossSalesPaise: it.grossSalesPaisa,
      grossSales: Number((it.grossSalesPaisa / 100).toFixed(2)),
      netSalesPaisa: itemNet,
      netSalesPaise: itemNet,
      netSales: Number((itemNet / 100).toFixed(2)),
      averagePricePaisa: itemQty > 0 ? Math.round(itemNet / itemQty) : 0,
      averagePrice: itemQty > 0 ? Number((itemNet / itemQty / 100).toFixed(2)) : 0,
      discountPaisa: it.discountPaisa,
      refundPaisa: it.refundPaisa,
      billCount: it.billCount,
      billPenetration: totalOrders > 0 ? Number(((it.billCount / totalOrders) * 100).toFixed(1)) : 0,
      salesSharePercent: netSalesPaisa > 0 ? Number(((itemNet / netSalesPaisa) * 100).toFixed(1)) : 0,
      categorySharePercent: Number(((itemNet / catTotalNet) * 100).toFixed(1)),
      cafesSoldIn: Array.from(it.cafes),
    };
  }).sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 7. Product Mix (PMIX)
  const productMix = Object.values(pmixMap).map((pm) => {
    return {
      itemId: pm.itemId,
      name: pm.itemName,
      category: pm.category,
      cafeId: pm.cafeId,
      serviceMode: pm.serviceMode,
      orderSource: pm.orderSource,
      quantity: pm.quantity,
      grossSales: Number((pm.grossSalesPaisa / 100).toFixed(2)),
      netSales: Number((pm.netSalesPaisa / 100).toFixed(2)),
      grossSalesPaisa: pm.grossSalesPaisa,
      netSalesPaisa: pm.netSalesPaisa,
      discountPaisa: pm.discountPaisa,
      averageSellingPrice: pm.quantity > 0 ? Number((pm.netSalesPaisa / pm.quantity / 100).toFixed(2)) : 0,
      totalSalesPercent: netSalesPaisa > 0 ? Number(((pm.netSalesPaisa / netSalesPaisa) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 8. Rankings: Top and Bottom Items
  const itemsByQty = [...salesByItem].sort((a, b) => b.quantity - a.quantity);
  const itemsBySales = [...salesByItem].sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  const topItems = {
    byQuantity: itemsByQty.slice(0, 10),
    byNetSales: itemsBySales.slice(0, 10),
  };
  const bottomItems = {
    byQuantity: [...itemsByQty].reverse().slice(0, 10),
    byNetSales: [...itemsBySales].reverse().slice(0, 10),
  };

  // 9. Modifier Analytics & Attach Rate
  const totalBaseItemUnits = salesByItem.reduce((acc, it) => acc + it.quantity, 0);
  const totalModifierSelections = Object.values(modifierMap).reduce((acc, m) => acc + m.selectionCount, 0);
  const totalModifierSalesPaisa = Object.values(modifierMap).reduce((acc, m) => acc + m.salesPaisa, 0);

  const modifierAnalyticsList = Object.values(modifierMap).map((m) => {
    let eligibleBaseUnits = 0;
    for (const bin of Object.keys(m.baseItems)) {
      if (itemMap[bin]) {
        eligibleBaseUnits += itemMap[bin].quantity;
      }
    }
    const denom = eligibleBaseUnits > 0 ? eligibleBaseUnits : (totalBaseItemUnits > 0 ? totalBaseItemUnits : m.selectionCount);
    const attachPct = denom > 0 ? Number(((m.selectionCount / denom) * 100).toFixed(1)) : 0;
    return {
      modifier: m.modifier,
      name: m.modifier,
      selectionCount: m.selectionCount,
      salesPaisa: m.salesPaisa,
      sales: Number((m.salesPaisa / 100).toFixed(2)),
      averagePrice: m.selectionCount > 0 ? Number((m.salesPaisa / m.selectionCount / 100).toFixed(2)) : 0,
      attachRatePercent: attachPct,
      topBaseItem: Object.entries(m.baseItems).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Various',
    };
  }).sort((a, b) => b.selectionCount - a.selectionCount);

  // 10. Variant & Attribute Analytics
  const variantAnalytics = {
    sizes: Object.keys(sizeMap).map((sz) => ({ size: sz, quantity: sizeMap[sz] })),
    temperatures: Object.keys(tempMap).map((tp) => ({ temperature: tp, quantity: tempMap[tp] })),
  };

  // 11. Payment Tender Mix (with exact paise)
  const totalTenderPaisa = Object.values(tenderMap).reduce((acc, t) => acc + t.amountPaisa, 0);
  const paymentMix = Object.keys(tenderMap)
    .filter(method => CANONICAL_PAYMENT_METHODS.includes(method))
    .map((method) => ({
      method,
      tender: method,
      amountPaisa: tenderMap[method].amountPaisa,
      amount: Number((tenderMap[method].amountPaisa / 100).toFixed(2)),
      pct: totalTenderPaisa > 0 ? Number(((tenderMap[method].amountPaisa / totalTenderPaisa) * 100).toFixed(1)) : 0,
      count: tenderMap[method].count,
    })).sort((a, b) => b.amountPaisa - a.amountPaisa);

  // 12. Service Modes
  const serviceModes = Object.keys(serviceModeMap)
    .filter(mode => CANONICAL_SERVICE_MODES.includes(mode))
    .map((mode) => ({
      mode,
      orders: serviceModeMap[mode].orders,
      amount: Number((serviceModeMap[mode].netSalesPaisa / 100).toFixed(2)),
      sales: Number((serviceModeMap[mode].netSalesPaisa / 100).toFixed(2)),
      netSalesPaisa: serviceModeMap[mode].netSalesPaisa,
      grossSalesPaisa: serviceModeMap[mode].grossSalesPaisa,
      discountPaisa: serviceModeMap[mode].discountPaisa,
      refundPaisa: serviceModeMap[mode].refundPaisa,
      aov: serviceModeMap[mode].orders > 0 ? Number((serviceModeMap[mode].netSalesPaisa / serviceModeMap[mode].orders / 100).toFixed(2)) : 0,
    })).sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 13. Pareto Analysis
  let runningSalesPaisa = 0;
  const pareto = salesByItem.map((it) => {
    runningSalesPaisa += it.netSalesPaisa;
    const cumPct = netSalesPaisa > 0 ? Number(((runningSalesPaisa / netSalesPaisa) * 100).toFixed(1)) : 0;
    let paretoClass = 'A';
    if (cumPct > 95) paretoClass = 'C';
    else if (cumPct > 80) paretoClass = 'B';
    return {
      itemId: it.itemId,
      name: it.name,
      netSalesPaisa: it.netSalesPaisa,
      netSales: it.netSales,
      sharePercent: it.salesSharePercent,
      cumulativePercent: cumPct,
      paretoClass,
    };
  });

  // 14. Basket / Item Co-occurrence Affinity (Bounded to Top-50 Velocity Items)
  const topVelocityItems = Object.values(itemMap)
    .sort((a, b) => (b.quantity || b.unitsSold || 0) - (a.quantity || a.unitsSold || 0))
    .slice(0, 50);
  const topVelocityItemIds = new Set(topVelocityItems.map(i => i.itemId));

  for (const itemsArr of allBillItemsList) {
    const eligibleItems = itemsArr.filter(id => topVelocityItemIds.has(id));
    if (eligibleItems.length >= 2) {
      for (let i = 0; i < eligibleItems.length; i++) {
        for (let j = i + 1; j < eligibleItems.length; j++) {
          const itA = eligibleItems[i];
          const itB = eligibleItems[j];
          const pairKey = itA < itB ? `${itA}__${itB}` : `${itB}__${itA}`;
          basketCoOccurrence[pairKey] = (basketCoOccurrence[pairKey] || 0) + 1;
        }
      }
    }
  }

  const basketAffinityPairs = Object.entries(basketCoOccurrence).map(([pair, count]) => {
    const [itAKey, itBKey] = pair.split('__');
    const itA = itemMap[itAKey] || { name: itAKey, billCount: 1 };
    const itB = itemMap[itBKey] || { name: itBKey, billCount: 1 };
    const attachPct = itA.billCount > 0 ? Number(((count / itA.billCount) * 100).toFixed(1)) : 0;
    return {
      itemAId: itA.itemId || itAKey,
      itemAName: itA.name,
      itemBId: itB.itemId || itBKey,
      itemBName: itB.name,
      coOccurrenceCount: count,
      attachPercent: attachPct,
    };
  }).sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount).slice(0, 50);

  const basketAffinity = {
    analysisCoverage: 'TOP_N_BY_VELOCITY',
    analysisLimit: 50,
    disclosure: 'Affinity analysis covers the 50 highest-velocity items for the selected scope and period.',
    pairs: basketAffinityPairs,
  };

  // 15. Data Quality State
  let qualityStatus = 'COMPLETE';
  const warnings = [];

  if (legacyInsufficientBillsCount > 0) {
    qualityStatus = 'PARTIAL';
    warnings.push('LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS');
  }

  if (unallocatedPartialRefundCount > 0) {
    qualityStatus = 'PARTIAL';
    warnings.push('PARTIAL_REFUND_PRE_TAX_UNKNOWN');
  }

  return {
    summary: {
      grossSalesPaise: grossSalesPaisa,
      salesBeforeTaxPaise: salesBeforeTaxPaisa,
      discountPaise: discountPaisa,
      customerRefundPaise: customerRefundPaisa,
      preTaxRefundPaise: preTaxRefundPaisa,
      preTaxRefundAvailability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
      refundPaise: customerRefundPaisa, // backward-compatibility
      taxesPaise: taxChargedPaisa,
      taxChargedPaise: taxChargedPaisa,
      refundedTaxPaise: refundedTaxPaisa,
      refundedTaxAvailability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
      netTaxPaise: netTaxPaisa,
      netTaxAvailability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
      netSalesPaise: netSalesPaisa,
      netSalesAvailability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
      orderCount: totalOrders,
      transactionCount: totalOrders,
      aovPaise: aovPaisa,
      gstCollectedPaise: taxChargedPaisa,
    },
    salesByCafe,
    cafeSales: salesByCafe,
    salesByCategory,
    categorySales: salesByCategory,
    salesByItem,
    itemSales: salesByItem,
    productMix,
    topItems,
    bottomItems,
    hourlyTrends,
    dayOfWeekTrends,
    salesHeatmap,
    hourlyHeatmap: salesHeatmap,
    dayparts: {
      status: 'NOT_CONFIGURED',
      configurationSource: 'NOT_CONFIGURED',
      template: 'PROPOSED_DEFAULT',
      periods: PROPOSED_DEFAULT_DAYPARTS,
      notice: 'Configurable operating dayparts are not configured in system settings; hourly analysis is authoritative.',
      isConfigured: false,
    },
    serviceModes,
    paymentMix,
    splitTenderSummary: {
      count: splitTenderCount,
      amountPaisa: splitTenderTotalPaisa,
      amount: Number((splitTenderTotalPaisa / 100).toFixed(2)),
    },
    modifierAnalytics: {
      summary: {
        totalModifierSelections,
        totalModifierSalesPaisa,
        totalModifierSales: Number((totalModifierSalesPaisa / 100).toFixed(2)),
        overallAttachRatePercent: totalBaseItemUnits > 0 ? Number(((totalModifierSelections / totalBaseItemUnits) * 100).toFixed(1)) : 0,
        eligibilityMethod: 'CANONICAL_MENU_CONFIG_OR_TRANSACTION_BASE_ITEMS',
        eligibilityNotice: 'Historical modifier-group eligibility changes are unversioned; eligibility reflects transaction attachment and active menu configuration.',
      },
      modifiers: modifierAnalyticsList,
      topModifiers: modifierAnalyticsList,
      variantAnalytics,
    },
    discountIntelligence: {
      totalDiscountValuePaisa: discountPaisa,
      totalDiscountValue: Number((discountPaisa / 100).toFixed(2)),
      discountPercent: grossSalesPaisa > 0 ? Number(((discountPaisa / grossSalesPaisa) * 100).toFixed(1)) : 0,
      byCafe: Object.entries(discountByCafeMap).map(([cafeId, amt]) => ({ cafeId, amountPaisa: amt, amount: Number((amt / 100).toFixed(2)) })),
      byCategory: Object.entries(discountByCategoryMap).map(([category, amt]) => ({ category, amountPaisa: amt, amount: Number((amt / 100).toFixed(2)) })),
      byItem: Object.entries(discountByItemMap).map(([itemId, amt]) => ({ itemId, amountPaisa: amt, amount: Number((amt / 100).toFixed(2)) })),
      byOperator: Object.entries(discountByOperatorMap).map(([operatorId, amt]) => ({ operatorId, amountPaisa: amt, amount: Number((amt / 100).toFixed(2)) })),
    },
    refundAnalytics: {
      customerRefundTotalPaisa: customerRefundPaisa,
      customerRefundTotal: Number((customerRefundPaisa / 100).toFixed(2)),
      refundCount: fullRefundCount + partialRefundCount,
      fullyRefundedCount: fullRefundCount,
      partiallyRefundedCount: partialRefundCount,
      byCafe: Object.entries(refundByCafeMap).map(([cafeId, amt]) => ({ cafeId, amountPaisa: amt, amount: Number((amt / 100).toFixed(2)) })),
      reasons: refundReasons,
    },
    voidAnalytics: {
      voidCount,
      voidTotalPaisa,
      voidTotal: Number((voidTotalPaisa / 100).toFixed(2)),
      paymentReversedCount,
      paymentReversedTotalPaisa,
      paymentReversedTotal: Number((paymentReversedTotalPaisa / 100).toFixed(2)),
      records: voidRecords,
      voids: { count: voidCount, totalValuePaisa: voidTotalPaisa },
      reversals: { count: paymentReversedCount, totalValuePaisa: paymentReversedTotalPaisa },
    },
    pareto,
    basketAffinity,
    openItemAnalysis: {
      count: openItemsList.length,
      totalValuePaisa: openItemsList.reduce((acc, it) => acc + it.amountPaisa, 0),
      items: openItemsList,
    },
    orderSources: orderSourceMap,
    orderSourceBreakdown: orderSourceMap,
    basketAffinityPairs,
    dataQuality: {
      status: qualityStatus,
      state: qualityStatus === 'COMPLETE' ? 'CLEAN' : qualityStatus,
      warnings,
      hasPartialRefundsWithoutPreTax: unallocatedPartialRefundCount > 0,
      partialRefundCount: unallocatedPartialRefundCount,
      fullRefundCount,
      affectedBillCount: unallocatedPartialRefundCount + legacyInsufficientBillsCount,
      warningCode: unallocatedPartialRefundCount > 0 ? 'PARTIAL_REFUND_PRE_TAX_UNKNOWN' : (legacyInsufficientBillsCount > 0 ? 'LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS' : null),
      freshness: {
        template: 'PROPOSED_DEFAULT',
        configurationSource: 'NOT_CONFIGURED',
        freshnessStatus: 'UNASSESSED',
      },
    },
    provenance: {
      sourceModel: 'Bill',
      NET_SALES: {
        metricId: 'NET_SALES',
        availability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
        warningCode: unallocatedPartialRefundCount > 0 ? 'PARTIAL_REFUND_PRE_TAX_UNKNOWN' : null,
        partialRefundCount: unallocatedPartialRefundCount,
        affectedBillCount: unallocatedPartialRefundCount,
      },
      NET_TAX: {
        metricId: 'NET_TAX',
        availability: unallocatedPartialRefundCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
        warningCode: unallocatedPartialRefundCount > 0 ? 'PARTIAL_REFUND_TAX_ALLOCATION_UNKNOWN' : null,
        partialRefundCount: unallocatedPartialRefundCount,
        affectedBillCount: unallocatedPartialRefundCount,
      },
      sourceRecordCounts: {
        billsTotal: bills.length,
        completedBills: totalOrders,
        partialRefundBills: partialRefundCount,
        unallocatedPartialRefundBills: unallocatedPartialRefundCount,
        refundedBills: fullRefundCount,
        voidedBills: voidCount,
        paymentReversedBills: paymentReversedCount,
        billLinesTotal: totalBillLines,
        unmappedItemsCount,
      },
      metricVersions: {
        GROSS_SALES: '1.3.0',
        SALES_BEFORE_TAX: '1.2.0',
        NET_SALES: '1.3.0',
        TAX_CHARGED: '1.0.0',
        NET_TAX: '1.0.0',
        MODIFIER_ATTACH_RATE: '1.0.0',
        BILL_PENETRATION: '1.0.0',
      },
    },
  };
}

/**
 * Canonical Bill Sales & Order Extractor (PM-02D Lineage Provider)
 * Extracts authoritative Net Sales (paise), Gross Sales, Discounts, Refunds, and Order count.
 * Guarantees zero redefinition of Net Sales or Order Count across downstream reporting/forecasting modules.
 *
 * @param {object} bill - Bill document or plain object
 * @returns {{ netSalesPaisa: number, grossSalesPaisa: number, discountPaisa: number, preTaxRefundPaisa: number, orderCount: number, isOrder: boolean }}
 */
function extractCanonicalBillSales(bill) {
  if (!bill) {
    return { netSalesPaisa: 0, grossSalesPaisa: 0, discountPaisa: 0, preTaxRefundPaisa: 0, orderCount: 0, isOrder: false };
  }

  const status = String(bill.status || '').toUpperCase();

  // Voids and payment reversals produce zero sales and zero orders
  if (status === 'VOIDED' || status === 'PAYMENT_REVERSED' || status === 'CANCELLED') {
    return { netSalesPaisa: 0, grossSalesPaisa: 0, discountPaisa: 0, preTaxRefundPaisa: 0, orderCount: 0, isOrder: false };
  }

  const isCompleted = status === 'COMPLETED';
  const isPartialRefund = status === 'PARTIALLY_REFUNDED';
  const isFullRefund = status === 'REFUNDED';

  // Only completed or partially refunded transactions count as orders
  const orderCount = (isCompleted || isPartialRefund) ? 1 : 0;

  // 1. Gross Sales via Hierarchy A-E
  let bGross = typeof bill.grossSalesPaisa === 'number' && !Number.isNaN(bill.grossSalesPaisa)
    ? Math.round(bill.grossSalesPaisa)
    : null;

  if (bGross === null) {
    const bGrossResult = reconstructGrossSales(bill);
    bGross = typeof bGrossResult === 'object' && bGrossResult !== null
      ? bGrossResult.grossSalesPaisa
      : (typeof bGrossResult === 'number' ? bGrossResult : null);
  }

  // 2. Discounts
  const bDiscount = Number(bill.discountPaisa || 0);

  // 3. Sales Before Tax (pre-tax post-discount)
  const bEffectiveSubtotal = bGross !== null ? bGross : Number(bill.subtotalPaisa || bill.taxableAmountPaisa || 0);
  const bSalesBeforeTax = Math.max(0, bEffectiveSubtotal - bDiscount);

  // 4. Pre-tax Refund
  let bPreTaxRefund = 0;
  if (isFullRefund) {
    bPreTaxRefund = bSalesBeforeTax;
  } else if (isPartialRefund) {
    if (typeof bill.preTaxRefundPaisa === 'number' && bill.preTaxRefundPaisa > 0) {
      bPreTaxRefund = bill.preTaxRefundPaisa;
    } else if (Array.isArray(bill.creditNotes) && bill.creditNotes.length > 0) {
      bPreTaxRefund = bill.creditNotes.reduce((acc, cn) => acc + Number(cn.taxableAdjustmentPaisa || 0), 0);
    } else if (Array.isArray(bill.refunds) && bill.refunds.length > 0) {
      bPreTaxRefund = bill.refunds.reduce((acc, rf) => acc + Number(rf.taxableAdjustmentPaisa || rf.preTaxPaisa || 0), 0);
    }
  }

  // 5. Net Sales per bill via canonical Gross-to-Net Bridge
  const bridge = computeGrossToNetBridge({
    grossSalesPaisa: bGross !== null ? bGross : bSalesBeforeTax + bDiscount,
    discountPaisa: bDiscount,
    preTaxRefundPaisa: bPreTaxRefund,
  });

  return {
    netSalesPaisa: bridge.netSalesPaisa,
    grossSalesPaisa: bGross !== null ? bGross : bSalesBeforeTax + bDiscount,
    discountPaisa: bDiscount,
    preTaxRefundPaisa: bPreTaxRefund,
    orderCount,
    isOrder: orderCount > 0,
  };
}

module.exports = {
  calculateSalesMetrics,
  extractCanonicalBillSales,
};
