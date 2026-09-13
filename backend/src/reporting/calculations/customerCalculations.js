'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: customerCalculations.js (PM-02H-R1)
 * 
 * Canonical Customer, POS, Order & Service Intelligence:
 * - Authoritative Identity Hierarchy (CustomerId -> Verified Phone -> Phone Fallback -> Anonymous)
 * - Strict Role Scope (Owner & CAFE_ADMIN scoped strictly to authorized café transactions)
 * - Factual Guest Covers (No defaulting to 1; explicit tracking of known vs missing covers; zero denominator safety)
 * - Factual Discounts (No hardcoded 20% threshold; largest discounts ranking & distribution)
 * - Kitchen Prep Duration (Precisely labeled KDS prep; total service time declared UNAVAILABLE)
 * - Table Performance (Completed dine-in checks per active table; table turns and dining times declared UNAVAILABLE)
 * - Complimentary Order Deduplication (Single count per bill across tender and discount markers)
 * - Payment Reversals tracked separately from voids/refunds
 * - Database Outage Integrity (Returns nulls and UNAVAILABLE status; never misleading zeroes)
 * - Strict Customer Privacy: Zero PII returned in aggregate BI payloads (Masked phones/emails)
 */

const mongoose = require('mongoose');
const { Customer } = require('../../models/Customer');
const { Bill } = require('../../models/Bill');
const { LoyaltyLedger } = require('../../models/LoyaltyLedger');
const { CustomerFeedback } = require('../../models/CustomerFeedback');
const { KdsTicket } = require('../../models/KdsTicket');
const { RegisterSession } = require('../../models/RegisterSession');

const CANONICAL_SERVICE_MODES = [
  'QUICK_SALE',
  'DINE_IN',
  'TAKEAWAY',
  'DELIVERY',
  'SCHEDULED_PICKUP',
];

const LOYALTY_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

/**
 * Calculates canonical customer, loyalty, POS, and service intelligence metrics.
 *
 * @param {Object} options
 * @param {string} options.organisationId - Tenant organisation ID (mandatory)
 * @param {string|string[]|null} [options.cafeScope] - Authorized café scope
 * @param {string} options.dateFrom - ISO date string YYYY-MM-DD
 * @param {string} options.dateTo - ISO date string YYYY-MM-DD
 * @param {Object} [options.filters] - Optional dimensional filters
 * @returns {Promise<Object>} Calculated metrics, multidimensional breakdowns, and provenance
 */
async function calculateCustomerMetrics({ organisationId, cafeScope, dateFrom, dateTo, filters = {}, discountThresholdPercent, highDiscountThresholdPercent, isDatabaseOutage, _isDbConnected }) {
  if (!organisationId) {
    throw new Error('customerCalculations: organisationId is required.');
  }

  // Explicit database outage signal
  if (isDatabaseOutage || _isDbConnected === false) {
    return _buildOutageResponse(organisationId, cafeScope, dateFrom, dateTo);
  }

  const warnings = [];
  const sourceModels = [];

  // Parse cafe scope
  let cafes = null;
  if (cafeScope) {
    cafes = Array.isArray(cafeScope) ? cafeScope.map(c => String(c).trim().toUpperCase()) : [String(cafeScope).trim().toUpperCase()];
  }
  const isScoped = Boolean(cafes && cafes.length > 0);

  // ── 1. Fetch Registered Customers ─────────────────────────────────────────
  let customers = [];
  let isOutageDetected = false;

  if (mongoose.connection?.readyState === 1 || Customer.find !== mongoose.Model.find) {
    try {
      // We query Customer directory for organisation to resolve identities
      customers = await Customer.find({ organisationId }).lean();
      sourceModels.push('Customer');
    } catch (err) {
      if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
        isOutageDetected = true;
      } else {
        warnings.push(`Customer query failed: ${err.message}`);
      }
    }
  }

  const customerMapById = new Map();
  const phoneToCustomersMap = new Map();
  let totalRegisteredLifetimeSpendPaisa = 0;
  const tierCounts = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
  let activeLoyaltyMembersCount = 0;

  for (const c of customers) {
    if (c.phone) {
      const cleanPhone = String(c.phone).trim();
      if (!phoneToCustomersMap.has(cleanPhone)) {
        phoneToCustomersMap.set(cleanPhone, []);
      }
      phoneToCustomersMap.get(cleanPhone).push(c);
    }
    if (c.customerId) {
      const cleanId = String(c.customerId).trim().toUpperCase();
      customerMapById.set(cleanId, c);
    }
    totalRegisteredLifetimeSpendPaisa += Number(c.totalSpendPaisa || 0);

    const tier = (c.tier && LOYALTY_TIERS.includes(c.tier.toUpperCase()))
      ? c.tier.toUpperCase()
      : 'BRONZE';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;

    if (c.loyaltyStatus === 'ACTIVE') {
      activeLoyaltyMembersCount += 1;
    }
  }

  // ── 2. Fetch Bills for Period ─────────────────────────────────────────────
  const billQuery = {
    organisationId,
  };

  if (cafes && cafes.length > 0) {
    billQuery.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
  }

  if (dateFrom && dateTo) {
    billQuery.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  } else if (dateFrom) {
    billQuery.businessDate = { $gte: dateFrom };
  } else if (dateTo) {
    billQuery.businessDate = { $lte: dateTo };
  }

  let bills = [];
  if (mongoose.connection?.readyState === 1 || Bill.find !== mongoose.Model.find) {
    try {
      bills = await Bill.find(billQuery).lean();
      sourceModels.push('Bill');
    } catch (err) {
      if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
        isOutageDetected = true;
      } else {
        warnings.push(`Bill query failed: ${err.message}`);
      }
    }
  }

  if (isOutageDetected) {
    return _buildOutageResponse(organisationId, cafeScope, dateFrom, dateTo);
  }

  // Prior bills check for scoped new vs repeat customer determination (Blocker H-R2-003)
  const priorCustomerKeysInScope = new Set();
  if (isScoped && dateFrom && (mongoose.connection?.readyState === 1 || Bill.find !== mongoose.Model.find)) {
    try {
      const priorQuery = {
        organisationId,
        cafeId: cafes.length === 1 ? cafes[0] : { $in: cafes },
        businessDate: { $lt: dateFrom },
        status: 'COMPLETED',
      };
      const priorBills = await Bill.find(priorQuery).lean();
      for (const pb of priorBills) {
        if (pb.customerId) priorCustomerKeysInScope.add(String(pb.customerId).trim().toUpperCase());
        if (pb.customerPhone) priorCustomerKeysInScope.add(String(pb.customerPhone).trim());
      }
    } catch (_) {
      // Safe fallback
    }
  }

  // ── 3. Process Bills (Sales, Customers, Visits, Service Modes, Exceptions) ─
  let totalCheckCount = 0;
  let identifiedCheckCount = 0;
  let anonymousCheckCount = 0;
  let totalNetSalesPaise = 0;
  let identifiedSalesPaise = 0;
  let anonymousSalesPaise = 0;
  let totalGrossSalesPaise = 0;
  let totalDiscountPaise = 0;
  let totalRefundPaise = 0;

  // Guest covers tracking (Blocker H-R2-001: Option A Compatible Known-Cover Numerator)
  let dineInBillCount = 0;
  let guestCountKnownBillCount = 0;
  let guestCountMissingBillCount = 0;
  let recordedGuestCount = 0;
  let dineInNetSalesPaise = 0;
  let knownCoverNetSalesPaise = 0;

  // Identity quality tracking
  let identityCustomerIdMatches = 0;
  let identityVerifiedPhoneLinks = 0;
  let identityVerifiedPhoneCurrentStateLinks = 0;
  let identityPhoneOnlyFallbacks = 0;
  let identityUnresolvedAnonymous = 0;
  let ambiguousPhoneCheckCount = 0;

  // Visit tracking: unique (canonicalCustomerKey, businessDate, cafeId)
  const visitKeySet = new Set();
  const customerTransactingBillsMap = new Map(); // customerKey -> { customer, customerKey, bills, totalSpendPaise }
  const anonymousBillsList = [];

  // Service Mode aggregation
  const serviceModeMap = {};
  for (const mode of CANONICAL_SERVICE_MODES) {
    serviceModeMap[mode] = {
      serviceMode: mode,
      orderCount: 0,
      netSalesPaise: 0,
      guestCount: 0,
      discountPaise: 0,
    };
  }

  // Order source aggregation
  const orderSourceMap = {
    STORE_REGISTER: { source: 'STORE_REGISTER', orderCount: 0, netSalesPaise: 0 },
    UNKNOWN: { source: 'UNKNOWN', orderCount: 0, netSalesPaise: 0 },
  };

  // Tender allocation
  const tenderMap = {};

  // Exceptions tracking
  const voidsList = [];
  const refundsList = [];
  const discountRecordsList = [];
  const compBillsList = [];
  const paymentReversalsList = [];
  let reprintEventsCount = 0;
  let billsReprintedCount = 0;
  let offlineReplayCount = 0;
  let offlineReplayTotalPaise = 0;
  let heldBillCount = 0;
  let heldBillTotalPaise = 0;

  // Active tables set
  const activeTablesSet = new Set();
  const tableBillsCountMap = new Map();

  // Café aggregation
  const cafeMetricsMap = new Map();

  for (const bill of bills) {
    const cafeId = bill.cafeId || 'UNKNOWN';
    if (!cafeMetricsMap.has(cafeId)) {
      cafeMetricsMap.set(cafeId, {
        cafeId,
        identifiedCustomers: new Set(),
        visitsSet: new Set(),
        orderCount: 0,
        netSalesPaise: 0,
      });
    }
    const cafeAgg = cafeMetricsMap.get(cafeId);

    // Track Exceptions regardless of completion status
    if (bill.status === 'VOIDED') {
      voidsList.push({
        billId: bill.billId,
        invoiceNumber: bill.invoiceNumber || null,
        cafeId: bill.cafeId,
        businessDate: bill.businessDate,
        amountPaise: bill.totalPaisa || 0,
        voidedByUserId: bill.voidedByUserId || bill.cashierUserId || 'UNKNOWN',
        voidReason: bill.voidReason || 'Not Specified',
        voidedAt: bill.voidedAt || bill.updatedAt || null,
      });
    }

    if (bill.status === 'PAYMENT_REVERSED' || (bill.tenders && Array.isArray(bill.tenders) && bill.tenders.some(t => t.status === 'REVERSED'))) {
      paymentReversalsList.push({
        billId: bill.billId,
        cafeId: bill.cafeId,
        businessDate: bill.businessDate,
        amountPaise: bill.totalPaisa || 0,
        status: bill.status,
      });
    }

    if (bill.reprints && Array.isArray(bill.reprints) && bill.reprints.length > 0) {
      reprintEventsCount += bill.reprints.length;
      billsReprintedCount += 1;
    }

    if (bill.isOfflineReplay) {
      offlineReplayCount += 1;
      offlineReplayTotalPaise += (bill.totalPaisa || 0);
    }

    if (bill.isHeld) {
      heldBillCount += 1;
      heldBillTotalPaise += (bill.totalPaisa || 0);
    }

    if (bill.refunds && Array.isArray(bill.refunds) && bill.refunds.length > 0) {
      for (const ref of bill.refunds) {
        refundsList.push({
          refundId: ref.refundId,
          billId: bill.billId,
          cafeId: bill.cafeId,
          businessDate: bill.businessDate,
          refundType: ref.refundType || 'FULL',
          amountPaise: ref.amountPaisa || 0,
          reason: ref.reason || 'Unspecified',
          requestedBy: ref.requestedBy || 'UNKNOWN',
          approvedBy: ref.approvedBy || null,
          status: ref.status || 'COMPLETED',
        });
      }
    }

    // Process only COMPLETED bills for sales, visits, customers, and guest counts
    if (bill.status !== 'COMPLETED') {
      continue;
    }

    totalCheckCount += 1;
    cafeAgg.orderCount += 1;

    // Monetary amounts in paise
    const billNetSales = Math.max(0, (bill.totalPaisa || 0) - (bill.taxPaisa || 0));
    const billGrossSales = (bill.subtotalPaisa || 0) + (bill.taxPaisa || 0);
    const billDiscount = bill.discountPaisa || 0;
    const billRefund = bill.refundedTotalPaisa || 0;

    totalNetSalesPaise += billNetSales;
    totalGrossSalesPaise += billGrossSales;
    totalDiscountPaise += billDiscount;
    totalRefundPaise += billRefund;
    cafeAgg.netSalesPaise += billNetSales;

    // Service Mode tracking
    const sMode = (bill.serviceMode && CANONICAL_SERVICE_MODES.includes(bill.serviceMode.toUpperCase()))
      ? bill.serviceMode.toUpperCase()
      : (bill.orderType && CANONICAL_SERVICE_MODES.includes(bill.orderType.toUpperCase()) ? bill.orderType.toUpperCase() : 'QUICK_SALE');

    if (serviceModeMap[sMode]) {
      serviceModeMap[sMode].orderCount += 1;
      serviceModeMap[sMode].netSalesPaise += billNetSales;
      serviceModeMap[sMode].discountPaise += billDiscount;
    }

    // Guest Covers tracking (Blocker H-R2-001: Option A Compatible Known-Cover Numerator)
    const isDineIn = sMode === 'DINE_IN';
    if (isDineIn) {
      dineInBillCount += 1;
      dineInNetSalesPaise += billNetSales;
      const rawCovers = bill.guestCovers;
      if (rawCovers !== undefined && rawCovers !== null && !isNaN(Number(rawCovers)) && Number(rawCovers) >= 1) {
        const covers = Math.floor(Number(rawCovers));
        recordedGuestCount += covers;
        guestCountKnownBillCount += 1;
        knownCoverNetSalesPaise += billNetSales;
        if (serviceModeMap[sMode]) {
          serviceModeMap[sMode].guestCount += covers;
        }
      } else {
        guestCountMissingBillCount += 1;
      }
    } else if (bill.guestCovers !== undefined && bill.guestCovers !== null && !isNaN(Number(bill.guestCovers)) && Number(bill.guestCovers) >= 1) {
      const covers = Math.floor(Number(bill.guestCovers));
      recordedGuestCount += covers;
      guestCountKnownBillCount += 1;
      knownCoverNetSalesPaise += billNetSales;
      if (serviceModeMap[sMode]) {
        serviceModeMap[sMode].guestCount += covers;
      }
    }

    // Table Tracking
    const tNum = bill.tableNumber || bill.tableToken;
    if (tNum && String(tNum).trim() !== '') {
      const cleanTable = String(tNum).trim().toUpperCase();
      activeTablesSet.add(cleanTable);
      tableBillsCountMap.set(cleanTable, (tableBillsCountMap.get(cleanTable) || 0) + 1);
    }

    // Discount tracking (Blocker H-R1-006: Factual discounts, NO hardcoded 20% threshold)
    if (bill.subtotalPaisa > 0 && billDiscount > 0) {
      const discPct = Number(((billDiscount / bill.subtotalPaisa) * 100).toFixed(1));
      discountRecordsList.push({
        billId: bill.billId,
        cafeId: bill.cafeId,
        businessDate: bill.businessDate,
        subtotalPaisa: bill.subtotalPaisa,
        discountPaisa: billDiscount,
        discountPercent: discPct,
        cashierUserId: bill.cashierUserId || 'UNKNOWN',
      });
    }

    // Complimentary Bills (Blocker H-R1-010: Deduplicated single count per bill across markers)
    const hasCompTender = (
      (bill.payments && Array.isArray(bill.payments) && bill.payments.some(p => (p.paymentMethod || p.method) === 'COMPLIMENTARY')) ||
      (bill.tenders && Array.isArray(bill.tenders) && bill.tenders.some(t => (t.paymentMethod || t.method) === 'COMPLIMENTARY')) ||
      bill.paymentMethod === 'COMPLIMENTARY'
    );
    const has100PctDiscount = (bill.subtotalPaisa > 0 && billDiscount >= bill.subtotalPaisa);
    const isComplimentary = hasCompTender || has100PctDiscount;

    if (isComplimentary) {
      compBillsList.push({
        billId: bill.billId,
        cafeId: bill.cafeId,
        businessDate: bill.businessDate,
        amountPaise: bill.subtotalPaisa || bill.totalPaisa || 0,
        compType: hasCompTender && has100PctDiscount ? 'TENDER_AND_PROMO' : (hasCompTender ? 'COMPLIMENTARY_TENDER' : 'FULL_PROMO_DISCOUNT'),
        cashierUserId: bill.cashierUserId || 'UNKNOWN',
      });
    }

    // Tenders allocation
    if (bill.tenders && Array.isArray(bill.tenders) && bill.tenders.length > 0) {
      for (const t of bill.tenders) {
        const method = t.paymentMethod ? t.paymentMethod.toUpperCase() : 'CASH';
        tenderMap[method] = (tenderMap[method] || 0) + (t.amountPaisa || 0);
      }
    } else if (bill.payments && Array.isArray(bill.payments) && bill.payments.length > 0) {
      for (const p of bill.payments) {
        const method = (p.paymentMethod || p.method) ? String(p.paymentMethod || p.method).toUpperCase() : 'CASH';
        tenderMap[method] = (tenderMap[method] || 0) + (p.amountPaisa || p.amount || 0);
      }
    } else {
      const method = bill.paymentMethod ? bill.paymentMethod.toUpperCase() : 'CASH';
      tenderMap[method] = (tenderMap[method] || 0) + (bill.totalPaisa || 0);
    }

    // Order Source
    const oSource = 'STORE_REGISTER';
    orderSourceMap[oSource].orderCount += 1;
    orderSourceMap[oSource].netSalesPaise += billNetSales;

    // Customer Attribution — Canonical Hierarchy (Blocker H-R2-002):
    // 1. Bill.customerId ↔ Customer.customerId (highest priority, high confidence)
    // 2. Bill.customerPhone ↔ Customer.phone (VERIFIED_PHONE_LINK only if Customer.isPhoneVerified === true and unique)
    // 3. Ambiguous phone (matches 2+ customers): UNRESOLVED / ANONYMOUS (never auto-resolved)
    // 4. Single unverified phone / standalone phone: PHONE_ONLY_FALLBACK (weak link, excluded from certified retention)
    // 5. Otherwise: ANONYMOUS
    let identifiedCust = null;
    let identityLinkageType = 'ANONYMOUS';
    let customerKey = null;
    let isCertifiedIdentity = false;

    const bCustId = bill.customerId ? String(bill.customerId).trim().toUpperCase() : '';
    const phone = bill.customerPhone ? String(bill.customerPhone).trim() : '';

    if (bCustId && customerMapById.has(bCustId)) {
      identifiedCust = customerMapById.get(bCustId);
      identityLinkageType = 'CUSTOMER_ID_MATCH';
      customerKey = identifiedCust.customerId;
      isCertifiedIdentity = true;
    } else if (bCustId) {
      identityLinkageType = 'CUSTOMER_ID_MATCH';
      customerKey = bCustId;
      isCertifiedIdentity = true;
    } else if (phone) {
      const matchingCusts = phoneToCustomersMap.get(phone) || [];
      if (matchingCusts.length === 1) {
        const singleCust = matchingCusts[0];
        if (singleCust.isPhoneVerified === true) {
          identifiedCust = singleCust;
          customerKey = singleCust.customerId;

          // Production-backed Customer Identity Hierarchy (Blocker H-R4-001):
          // In the current production Customer schema, only isPhoneVerified: Boolean is persisted.
          // No temporal verification timestamps (phoneVerifiedAt, phoneEffectiveFrom) exist in production.
          // Non-persisted temporal fields must NOT be treated as production authority.
          // Therefore, phone-linked bills without Bill.customerId cannot be certified as historical lifecycle identity:
          // identityLinkageType = 'VERIFIED_PHONE_LINK_CURRENT_STATE'
          // isCertifiedIdentity = false
          // matchConfidence = 'PARTIAL_SOURCE'
          identityLinkageType = 'VERIFIED_PHONE_LINK_CURRENT_STATE';
          isCertifiedIdentity = false;
        } else {
          // Unverified phone match: WEAK_LINK / PHONE_ONLY_FALLBACK
          identifiedCust = singleCust;
          identityLinkageType = 'PHONE_ONLY_FALLBACK';
          customerKey = singleCust.customerId;
          isCertifiedIdentity = false;
        }
      } else if (matchingCusts.length > 1) {
        // AMBIGUOUS_PHONE_MATCH: Phone matches multiple customers and Bill.customerId is absent!
        // Required: Do NOT auto-resolve to any customer! Must be UNRESOLVED / ANONYMOUS!
        identityLinkageType = 'ANONYMOUS';
        customerKey = null;
        isCertifiedIdentity = false;
        ambiguousPhoneCheckCount++;
      } else if (phone.length >= 7) {
        // Phone not in Customer directory
        identityLinkageType = 'PHONE_ONLY_FALLBACK';
        customerKey = `PHONE-${phone}`;
        isCertifiedIdentity = false;
      }
    }

    if (identityLinkageType === 'CUSTOMER_ID_MATCH') identityCustomerIdMatches++;
    else if (identityLinkageType === 'VERIFIED_PHONE_LINK') identityVerifiedPhoneLinks++;
    else if (identityLinkageType === 'VERIFIED_PHONE_LINK_CURRENT_STATE') identityVerifiedPhoneCurrentStateLinks++;
    else if (identityLinkageType === 'PHONE_ONLY_FALLBACK') identityPhoneOnlyFallbacks++;
    else identityUnresolvedAnonymous++;

    if (customerKey) {
      // Identified customer bill
      identifiedCheckCount += 1;
      identifiedSalesPaise += billNetSales;

      if (!customerTransactingBillsMap.has(customerKey)) {
        customerTransactingBillsMap.set(customerKey, {
          customer: identifiedCust,
          customerKey,
          phone,
          bills: [],
          totalSpendPaise: 0,
          isCertifiedIdentity,
        });
      }
      const custEntry = customerTransactingBillsMap.get(customerKey);
      custEntry.bills.push(bill);
      custEntry.totalSpendPaise += billNetSales;
      if (isCertifiedIdentity) {
        custEntry.isCertifiedIdentity = true;
      }

      // Customer Visit Rule: 1 visit per (customerKey, businessDate, cafeId)
      const bDate = bill.businessDate || (bill.createdAt ? new Date(bill.createdAt).toISOString().slice(0, 10) : 'UNKNOWN');
      const visitKey = `${customerKey}@${bDate}@${cafeId}`;
      visitKeySet.add(visitKey);
      cafeAgg.visitsSet.add(visitKey);
      cafeAgg.identifiedCustomers.add(customerKey);
    } else {
      // Anonymous bill — no customer invented, no multi-bill merging
      anonymousCheckCount += 1;
      anonymousSalesPaise += billNetSales;
      anonymousBillsList.push(bill);
    }
  }

  // ── 4. Customer Segmentation & Frequency / Recency ────────────────────────
  // Scoped derivation: For Owner & CAFE_ADMIN, derive strictly from authorized bills
  const activeIdentifiedCustomersCount = customerTransactingBillsMap.size;
  const customerEntries = Array.from(customerTransactingBillsMap.values());
  const certifiedCustomerEntries = customerEntries.filter(e => e.isCertifiedIdentity);
  const certifiedIdentifiedCustomersCount = certifiedCustomerEntries.length;
  const weakLinkCustomerCount = activeIdentifiedCustomersCount - certifiedIdentifiedCustomersCount;

  let newCustomersCount = 0;
  let repeatCustomersCount = 0;

  const frequencyBuckets = {
    '1 Visit': { bracket: '1 Visit (Single Visit)', count: 0, spendPaise: 0 },
    '2-4 Visits': { bracket: '2-4 Visits (Occasional Regular)', count: 0, spendPaise: 0 },
    '5-9 Visits': { bracket: '5-9 Visits (Frequent Guest)', count: 0, spendPaise: 0 },
    '10+ Visits': { bracket: '10+ Visits (High Frequency Guest)', count: 0, spendPaise: 0 },
  };

  const recencyBuckets = {
    '<= 7 Days': { bracket: '<= 7 Days', count: 0 },
    '8-30 Days': { bracket: '8-30 Days', count: 0 },
    '31-90 Days': { bracket: '31-90 Days', count: 0 },
    '> 90 Days': { bracket: '> 90 Days', count: 0 },
  };

  const spendBrackets = {
    'Under ₹500': { bracket: 'Under ₹500', count: 0, spendPaise: 0 },
    '₹500 - ₹1,500': { bracket: '₹500 - ₹1,500', count: 0, spendPaise: 0 },
    '₹1,500 - ₹5,000': { bracket: '₹1,500 - ₹5,000', count: 0, spendPaise: 0 },
    'Over ₹5,000': { bracket: 'Over ₹5,000', count: 0, spendPaise: 0 },
  };

  const dToDate = dateTo ? new Date(dateTo) : new Date();

  // Evaluate retention and acquisition strictly on certified identified customers (Blocker H-R2-002 / H-R2-003)
  for (const entry of certifiedCustomerEntries) {
    const cust = entry.customer;
    const billCount = entry.bills.length;
    const spendPaise = entry.totalSpendPaise;

    // Distinct visit dates for this customer in period within authorized bills
    const custVisitDates = new Set(entry.bills.map(b => b.businessDate));
    const periodVisits = custVisitDates.size;

    let isNew = false;
    let isRepeat = false;

    if (isScoped) {
      // Scoped role (Owner / CAFE_ADMIN): NEVER leak out-of-scope visits (Blocker H-R2-003)
      // Repeat if visited this authorized café prior to period or visited on >= 2 distinct dates in period or has multiple authorized bills
      if (priorCustomerKeysInScope.has(entry.customerKey) || periodVisits >= 2 || billCount >= 2) {
        isRepeat = true;
      } else {
        isNew = true;
      }
    } else {
      // Organisation-wide (Primary Master): can evaluate global customer record
      if (cust) {
        if (cust.totalVisits > periodVisits || (cust.totalVisits >= 2)) {
          isRepeat = true;
        } else if (cust.firstVisitAt && dateFrom && dateTo) {
          const firstV = new Date(cust.firstVisitAt).toISOString().slice(0, 10);
          if (firstV >= dateFrom && firstV <= dateTo && cust.totalVisits <= periodVisits) {
            isNew = true;
          } else {
            isRepeat = true;
          }
        } else if (periodVisits >= 2) {
          isRepeat = true;
        } else {
          isNew = true;
        }
      } else {
        if (periodVisits >= 2 || billCount >= 2) {
          isRepeat = true;
        } else {
          isNew = true;
        }
      }
    }

    if (isRepeat) {
      repeatCustomersCount += 1;
    } else if (isNew) {
      newCustomersCount += 1;
    }

    // Frequency Bucketing
    if (periodVisits >= 10) {
      frequencyBuckets['10+ Visits'].count += 1;
      frequencyBuckets['10+ Visits'].spendPaise += spendPaise;
    } else if (periodVisits >= 5) {
      frequencyBuckets['5-9 Visits'].count += 1;
      frequencyBuckets['5-9 Visits'].spendPaise += spendPaise;
    } else if (periodVisits >= 2) {
      frequencyBuckets['2-4 Visits'].count += 1;
      frequencyBuckets['2-4 Visits'].spendPaise += spendPaise;
    } else {
      frequencyBuckets['1 Visit'].count += 1;
      frequencyBuckets['1 Visit'].spendPaise += spendPaise;
    }

    // Recency Bucketing (days since latest bill)
    const latestBill = entry.bills.reduce((latest, b) => {
      const dt = b.createdAt ? new Date(b.createdAt) : new Date(b.businessDate);
      return (!latest || dt > latest) ? dt : latest;
    }, null);

    if (latestBill) {
      const daysDiff = Math.max(0, Math.floor((dToDate - latestBill) / (1000 * 60 * 60 * 24)));
      if (daysDiff <= 7) {
        recencyBuckets['<= 7 Days'].count += 1;
      } else if (daysDiff <= 30) {
        recencyBuckets['8-30 Days'].count += 1;
      } else if (daysDiff <= 90) {
        recencyBuckets['31-90 Days'].count += 1;
      } else {
        recencyBuckets['> 90 Days'].count += 1;
      }
    }

    // Spend Bucketing (in Rupees)
    const spendRupees = spendPaise / 100;
    if (spendRupees < 500) {
      spendBrackets['Under ₹500'].count += 1;
      spendBrackets['Under ₹500'].spendPaise += spendPaise;
    } else if (spendRupees <= 1500) {
      spendBrackets['₹500 - ₹1,500'].count += 1;
      spendBrackets['₹500 - ₹1,500'].spendPaise += spendPaise;
    } else if (spendRupees <= 5000) {
      spendBrackets['₹1,500 - ₹5,000'].count += 1;
      spendBrackets['₹1,500 - ₹5,000'].spendPaise += spendPaise;
    } else {
      spendBrackets['Over ₹5,000'].count += 1;
      spendBrackets['Over ₹5,000'].spendPaise += spendPaise;
    }
  }

  // Zero-Denominator Protection for All Customer Ratios (Blocker H-R2-004)
  const totalCustomerVisits = visitKeySet.size;
  const repeatCustomerRatePct = certifiedIdentifiedCustomersCount > 0
    ? Number(((repeatCustomersCount / certifiedIdentifiedCustomersCount) * 100).toFixed(1))
    : null;
  const repeatPurchaseRatePct = repeatCustomerRatePct;
  const repeatVisitRatePct = certifiedIdentifiedCustomersCount > 0
    ? Number(((repeatCustomersCount / certifiedIdentifiedCustomersCount) * 100).toFixed(1))
    : null;

  const averageSpendPerIdentifiedCustomerPaise = certifiedIdentifiedCustomersCount > 0
    ? Math.round(certifiedCustomerEntries.reduce((sum, e) => sum + e.totalSpendPaise, 0) / certifiedIdentifiedCustomersCount)
    : (activeIdentifiedCustomersCount > 0 ? Math.round(identifiedSalesPaise / activeIdentifiedCustomersCount) : null);

  const averageVisitsPerCustomer = certifiedIdentifiedCustomersCount > 0
    ? Number((certifiedCustomerEntries.reduce((sum, e) => sum + new Set(e.bills.map(b => b.businessDate)).size, 0) / certifiedIdentifiedCustomersCount).toFixed(2))
    : (activeIdentifiedCustomersCount > 0 ? Number((totalCustomerVisits / activeIdentifiedCustomersCount).toFixed(2)) : null);

  const averageCheckPaise = totalCheckCount > 0
    ? Math.round(totalNetSalesPaise / totalCheckCount)
    : null;

  // Guest Count & Average Spend per Guest (Blocker H-R2-001: Option A Compatible Known-Cover Numerator)
  let guestCountValue = null;
  let guestCountAvailability = 'COMPLETE';

  if (dineInBillCount === 0) {
    guestCountValue = recordedGuestCount > 0 ? recordedGuestCount : null;
    guestCountAvailability = recordedGuestCount > 0 ? 'COMPLETE' : 'NO_DATA';
  } else if (guestCountMissingBillCount === 0) {
    guestCountValue = recordedGuestCount;
    guestCountAvailability = 'COMPLETE';
  } else if (recordedGuestCount > 0) {
    guestCountValue = recordedGuestCount;
    guestCountAvailability = 'PARTIAL_SOURCE';
  } else {
    guestCountValue = null;
    guestCountAvailability = 'UNAVAILABLE';
  }

  let averageSpendPerGuestPaise = null;
  let averageSpendPerGuestAvailability = 'COMPLETE';

  if (recordedGuestCount > 0) {
    averageSpendPerGuestPaise = Math.round(knownCoverNetSalesPaise / recordedGuestCount);
    averageSpendPerGuestAvailability = guestCountMissingBillCount > 0 ? 'PARTIAL_SOURCE' : 'COMPLETE';
  } else {
    averageSpendPerGuestPaise = null;
    averageSpendPerGuestAvailability = 'UNAVAILABLE';
  }

  // ── 5. Fetch Loyalty Ledger Analytics ─────────────────────────────────────
  const loyaltyQuery = { organisationId };
  if (cafes && cafes.length > 0) {
    loyaltyQuery.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
  }
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    loyaltyQuery.createdAt = { $gte: fromDate, $lte: toDate };
  }

  let loyaltyPointsEarned = 0;
  let loyaltyPointsRedeemed = 0;
  let loyaltyRedemptionCount = 0;
  let loyaltyLedgerEntries = [];

  if (mongoose.connection?.readyState === 1 || LoyaltyLedger.find !== mongoose.Model.find) {
    try {
      loyaltyLedgerEntries = await LoyaltyLedger.find(loyaltyQuery).lean();
      sourceModels.push('LoyaltyLedger');
      for (const entry of loyaltyLedgerEntries) {
        if (['PURCHASE_ACCRUAL', 'PROMOTION_BONUS'].includes(entry.transactionType)) {
          loyaltyPointsEarned += (entry.pointsDelta || 0);
        } else if (entry.transactionType === 'REWARD_REDEEMED') {
          loyaltyPointsRedeemed += Math.abs(entry.pointsDelta || 0);
          loyaltyRedemptionCount += 1;
        }
      }
    } catch (err) {
      warnings.push(`LoyaltyLedger query failed: ${err.message}`);
    }
  }

  const loyaltyRedemptionRatePct = loyaltyPointsEarned > 0
    ? Number(((loyaltyPointsRedeemed / loyaltyPointsEarned) * 100).toFixed(1))
    : null;

  // ── 6. Fetch Customer Feedback Analytics ──────────────────────────────────
  const feedbackQuery = { organisationId };
  if (cafes && cafes.length > 0) {
    feedbackQuery.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
  }
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    feedbackQuery.createdAt = { $gte: fromDate, $lte: toDate };
  }

  let feedbackEntries = [];
  let totalRatingSum = 0;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const feedbackCategoryMap = {
    SERVICE: 0,
    PRODUCT: 0,
    CLEANLINESS: 0,
    BILLING: 0,
    STAFF_EXPERIENCE: 0,
    OTHER: 0,
  };
  const feedbackStatusMap = {
    NEW: 0,
    ACKNOWLEDGED: 0,
    UNDER_REVIEW: 0,
    RESOLVED: 0,
  };

  if (mongoose.connection?.readyState === 1 || CustomerFeedback.find !== mongoose.Model.find) {
    try {
      feedbackEntries = await CustomerFeedback.find(feedbackQuery).lean();
      sourceModels.push('CustomerFeedback');
      for (const f of feedbackEntries) {
        const r = Math.min(5, Math.max(1, Math.round(f.rating || 5)));
        ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
        totalRatingSum += r;

        const cat = f.category ? f.category.toUpperCase() : 'OTHER';
        feedbackCategoryMap[cat] = (feedbackCategoryMap[cat] || 0) + 1;

        const st = f.status ? f.status.toUpperCase() : 'NEW';
        feedbackStatusMap[st] = (feedbackStatusMap[st] || 0) + 1;
      }
    } catch (err) {
      warnings.push(`CustomerFeedback query failed: ${err.message}`);
    }
  }

  const feedbackCount = feedbackEntries.length;
  const averageFeedbackRating = feedbackCount > 0
    ? Number((totalRatingSum / feedbackCount).toFixed(2))
    : null;

  // ── 7. Fetch KDS Tickets for Kitchen Prep Durations ───────────────────────
  const kdsQuery = { organisationId };
  if (cafes && cafes.length > 0) {
    kdsQuery.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
  }
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    kdsQuery.receivedAt = { $gte: fromDate, $lte: toDate };
  }

  let kdsTickets = [];
  const prepDurationsSeconds = [];
  const stationPrepMap = {};

  if (mongoose.connection?.readyState === 1 || KdsTicket.find !== mongoose.Model.find) {
    try {
      kdsTickets = await KdsTicket.find(kdsQuery).lean();
      sourceModels.push('KdsTicket');
      for (const ticket of kdsTickets) {
        const station = ticket.prepStation ? ticket.prepStation.toUpperCase() : 'HOT_KITCHEN';
        if (!stationPrepMap[station]) {
          stationPrepMap[station] = { ticketCount: 0, totalSeconds: 0, completedCount: 0 };
        }
        stationPrepMap[station].ticketCount += 1;

        if (ticket.status === 'COMPLETED' && ticket.completedAt && ticket.receivedAt) {
          const durSec = Math.max(0, Math.floor((new Date(ticket.completedAt) - new Date(ticket.receivedAt)) / 1000));
          prepDurationsSeconds.push(durSec);
          stationPrepMap[station].totalSeconds += durSec;
          stationPrepMap[station].completedCount += 1;
        }
      }
    } catch (err) {
      warnings.push(`KdsTicket query failed: ${err.message}`);
    }
  }

  prepDurationsSeconds.sort((a, b) => a - b);
  const completedTicketCount = prepDurationsSeconds.length;
  const meanPrepTimeSeconds = completedTicketCount > 0
    ? Math.round(prepDurationsSeconds.reduce((acc, v) => acc + v, 0) / completedTicketCount)
    : 0;
  const medianPrepTimeSeconds = completedTicketCount > 0
    ? prepDurationsSeconds[Math.floor(completedTicketCount * 0.5)]
    : 0;
  const p90PrepTimeSeconds = completedTicketCount > 0
    ? prepDurationsSeconds[Math.floor(completedTicketCount * 0.9)]
    : 0;

  const stationPerformance = Object.entries(stationPrepMap).map(([station, stData]) => ({
    prepStation: station,
    ticketCount: stData.ticketCount,
    completedTicketCount: stData.completedCount,
    avgPrepTimeSeconds: stData.completedCount > 0 ? Math.round(stData.totalSeconds / stData.completedCount) : 0,
  }));

  // ── 8. Fetch Register Sessions for Cash Variance Exceptions ───────────────
  const regSessionQuery = { organisationId };
  if (cafes && cafes.length > 0) {
    regSessionQuery.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
  }
  if (dateFrom && dateTo) {
    regSessionQuery.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  }

  let registerSessions = [];
  let totalCashVariancePaise = 0;
  let sessionsWithVarianceCount = 0;

  if (mongoose.connection?.readyState === 1 || RegisterSession.find !== mongoose.Model.find) {
    try {
      registerSessions = await RegisterSession.find(regSessionQuery).lean();
      sourceModels.push('RegisterSession');
      for (const session of registerSessions) {
        if (session.cashVariancePaisa && session.cashVariancePaisa !== 0) {
          totalCashVariancePaise += session.cashVariancePaisa;
          sessionsWithVarianceCount += 1;
        }
      }
    } catch (err) {
      warnings.push(`RegisterSession query failed: ${err.message}`);
    }
  }

  // ── 9. Construct Final Governed Payloads ───────────────────────────────────
  const customerSummary = {
    totalIdentifiableCustomers: activeIdentifiedCustomersCount,
    certifiedIdentifiedCustomers: certifiedIdentifiedCustomersCount,
    weakLinkIdentifiedCustomers: weakLinkCustomerCount,
    totalRegisteredCustomers: isScoped ? activeIdentifiedCustomersCount : customers.length,
    activeIdentifiedCustomers: activeIdentifiedCustomersCount,
    acquisitionScopeType: isScoped ? 'NEW_TO_AUTHORISED_SCOPE' : 'NEW_TO_ORGANISATION',
    newCustomersThisPeriod: newCustomersCount,
    repeatCustomersThisPeriod: repeatCustomersCount,
    repeatCustomerRatePct,
    repeatPurchaseRatePct,
    totalCustomerVisits,
    repeatVisitRatePct,
    averageVisitsPerCustomer,
    averageSpendPerIdentifiedCustomerPaise,
    averageLifetimeSpend: customers.length > 0 && !isScoped
      ? Number((totalRegisteredLifetimeSpendPaisa / customers.length / 100).toFixed(2))
      : (certifiedIdentifiedCustomersCount > 0 ? Number((identifiedSalesPaise / certifiedIdentifiedCustomersCount / 100).toFixed(2)) : null),
    identifiedCheckCount,
    identifiedSalesPaise,
    anonymousCheckCount,
    anonymousSalesPaise,
    anonymousCheckSharePct: totalCheckCount > 0
      ? Number(((anonymousCheckCount / totalCheckCount) * 100).toFixed(1))
      : null,
    totalCheckCount,
    totalNetSalesPaise,
    averageCheckPaise,
    guestCount: guestCountValue,
    guestCountAvailability,
    dineInBillCount,
    guestCountKnownBillCount,
    guestCountMissingBillCount,
    knownCoverBillCount: guestCountKnownBillCount,
    missingCoverBillCount: guestCountMissingBillCount,
    knownCoverNetSalesPaise,
    recordedGuestCount,
    averageSpendPerGuestPaise,
    averageSpendPerGuestAvailability,
  };

  const loyaltyAnalytics = {
    membershipScope: isScoped ? 'SCOPED_LOYALTY_ACTIVITY' : 'GLOBAL_MEMBERSHIP_STATUS',
    totalMembers: isScoped ? activeIdentifiedCustomersCount : customers.length,
    activeMembers: isScoped ? activeIdentifiedCustomersCount : activeLoyaltyMembersCount,
    newEnrollments: isScoped ? newCustomersCount : customers.filter(c => {
      if (!c.createdAt || !dateFrom || !dateTo) return false;
      const cr = new Date(c.createdAt).toISOString().slice(0, 10);
      return cr >= dateFrom && cr <= dateTo;
    }).length,
    pointsEarned: loyaltyPointsEarned,
    pointsRedeemed: loyaltyPointsRedeemed,
    redemptionCount: loyaltyRedemptionCount,
    redemptionRatePct: loyaltyRedemptionRatePct,
    tierDistribution: isScoped ? null : LOYALTY_TIERS.map(tier => ({
      tier,
      count: tierCounts[tier] || 0,
      percentage: customers.length > 0 ? Number(((tierCounts[tier] / customers.length) * 100).toFixed(1)) : 0.0,
    })),
    tierDistributionAvailability: isScoped ? 'REDACTED_SCOPED_ROLE' : 'COMPLETE',
    globalPointsBalance: isScoped ? null : customers.reduce((sum, c) => sum + (c.pointsBalance || 0), 0),
    globalBalanceAvailability: isScoped ? 'UNAVAILABLE_SCOPED_ROLE' : 'COMPLETE',
    memberVsNonMemberComparison: {
      member: {
        customerCount: activeIdentifiedCustomersCount,
        orderCount: identifiedCheckCount,
        totalSpendPaise: identifiedSalesPaise,
        avgOrderSpendPaise: identifiedCheckCount > 0 ? Math.round(identifiedSalesPaise / identifiedCheckCount) : null,
      },
      nonMember: {
        customerCount: null, // anonymous - count unavailable
        orderCount: anonymousCheckCount,
        totalSpendPaise: anonymousSalesPaise,
        avgOrderSpendPaise: anonymousCheckCount > 0 ? Math.round(anonymousSalesPaise / anonymousCheckCount) : null,
      },
    },
  };

  const feedbackAnalytics = {
    feedbackCount,
    averageRating: averageFeedbackRating,
    resolutionRatePct: feedbackCount > 0 ? Number(((feedbackStatusMap.RESOLVED / feedbackCount) * 100).toFixed(1)) : null,
    ratingDistribution,
    categoryBreakdown: Object.entries(feedbackCategoryMap).map(([cat, cnt]) => ({
      category: cat,
      count: cnt,
      percentage: feedbackCount > 0 ? Number(((cnt / feedbackCount) * 100).toFixed(1)) : 0.0,
    })),
    statusBreakdown: feedbackStatusMap,
    nps: {
      score: null,
      availability: 'UNAVAILABLE',
      reason: 'No 0–10 Net Promoter Score question exists in customer feedback schema.',
    },
  };

  const posOperations = {
    totalCheckCount,
    totalNetSalesPaise,
    orderCount: totalCheckCount,
    orderCountEquivalence: 'BILL_COUNT_EQUIVALENCE',
    knownCoverBillCount: guestCountKnownBillCount,
    missingCoverBillCount: guestCountMissingBillCount,
    guestCountMissingBillCount,
    completedDineInChecksPerActiveTable: activeTablesSet.size > 0
      ? Number((dineInBillCount / activeTablesSet.size).toFixed(1))
      : null,
    knownCoverNetSalesPaise,
    recordedGuestCount,
    guestCount: guestCountValue,
    guestCountAvailability,
    averageSpendPerGuestPaise,
    averageSpendPerGuestAvailability,
    serviceModes: CANONICAL_SERVICE_MODES.map(mode => {
      const sm = serviceModeMap[mode];
      return {
        serviceMode: mode,
        orderCount: sm.orderCount,
        netSalesPaise: sm.netSalesPaise,
        guestCount: sm.guestCount,
        discountPaise: sm.discountPaise,
        salesSharePct: totalNetSalesPaise > 0 ? Number(((sm.netSalesPaise / totalNetSalesPaise) * 100).toFixed(1)) : 0.0,
        avgCheckPaise: sm.orderCount > 0 ? Math.round(sm.netSalesPaise / sm.orderCount) : 0,
      };
    }),
    orderSources: Object.values(orderSourceMap).map(src => ({
      orderSource: src.source,
      orderCount: src.orderCount,
      netSalesPaise: src.netSalesPaise,
      salesSharePct: totalNetSalesPaise > 0 ? Number(((src.netSalesPaise / totalNetSalesPaise) * 100).toFixed(1)) : 0.0,
    })),
    tenders: Object.entries(tenderMap).map(([method, amountPaise]) => ({
      paymentMethod: method,
      amountPaise,
      percentage: (totalGrossSalesPaise > 0) ? Number(((amountPaise / totalGrossSalesPaise) * 100).toFixed(1)) : 0.0,
    })),
    speedOfKitchenPrep: {
      totalTickets: kdsTickets.length,
      completedTickets: completedTicketCount,
      meanKitchenPrepDurationSeconds: meanPrepTimeSeconds,
      medianKitchenPrepDurationSeconds: medianPrepTimeSeconds,
      p90KitchenPrepDurationSeconds: p90PrepTimeSeconds,
      stationPerformance,
      totalServiceTimeAvailability: 'UNAVAILABLE',
      note: 'KDS ticket duration measures kitchen prep duration (completedAt - receivedAt), not total guest service time.',
    },
    // Backwards-compatible alias with clear documentation
    speedOfService: {
      totalTickets: kdsTickets.length,
      completedTickets: completedTicketCount,
      meanPrepTimeSeconds,
      medianPrepTimeSeconds,
      p90PrepTimeSeconds,
      stationPerformance,
      kitchenPrepOnly: true,
      totalServiceTimeAvailability: 'UNAVAILABLE',
    },
    tablePerformance: {
      activeTableCount: activeTablesSet.size,
      completedDineInChecksPerActiveTable: activeTablesSet.size > 0
        ? Number((dineInBillCount / activeTablesSet.size).toFixed(1))
        : null,
      tableTurns: {
        value: null,
        availability: 'UNAVAILABLE',
        reason: 'Dedicated table session lifecycle unavailable in production backend.',
      },
      diningTime: {
        value: null,
        availability: 'UNAVAILABLE',
        reason: 'Authoritative seatedAt and clearedAt timestamps not recorded in Bill schema.',
      },
    },
    reservations: {
      availability: 'UNAVAILABLE',
      reason: 'Dining table reservation module unavailable in production backend.',
    },
  };

  // Parameterized discount threshold (Blocker H-R1-006: REPORT_SIDE_HARDCODED_DISCOUNT_THRESHOLD = 0)
  const explicitThreshold = discountThresholdPercent ?? highDiscountThresholdPercent ?? filters?.discountThresholdPercent ?? filters?.highDiscountThresholdPercent;
  const numThreshold = (explicitThreshold !== undefined && explicitThreshold !== null && !isNaN(Number(explicitThreshold)) && Number(explicitThreshold) > 0)
    ? Number(explicitThreshold)
    : null;

  let highDiscountsResult = null;
  if (numThreshold !== null) {
    const highDiscRecords = discountRecordsList.filter(d => d.discountPercent >= numThreshold);
    highDiscountsResult = {
      thresholdPercent: numThreshold,
      count: highDiscRecords.length,
      totalDiscountPaise: highDiscRecords.reduce((acc, d) => acc + d.discountPaisa, 0),
      records: highDiscRecords.slice(0, 50),
    };
  }

  const posExceptions = {
    totalExceptionsCount: voidsList.length + discountRecordsList.length + compBillsList.length + billsReprintedCount + offlineReplayCount + sessionsWithVarianceCount + paymentReversalsList.length,
    voids: {
      count: voidsList.length,
      totalAmountPaise: voidsList.reduce((acc, v) => acc + v.amountPaise, 0),
      records: voidsList.slice(0, 50),
    },
    refunds: {
      count: refundsList.length,
      totalAmountPaise: refundsList.reduce((acc, r) => acc + r.amountPaise, 0),
      records: refundsList.slice(0, 50),
    },
    discounts: {
      count: discountRecordsList.length,
      totalDiscountPaise,
      largestDiscounts: discountRecordsList.sort((a, b) => b.discountPaisa - a.discountPaisa).slice(0, 50),
      discountDistribution: [
        { bracket: 'Under 10%', count: discountRecordsList.filter(d => d.discountPercent < 10).length },
        { bracket: '10% - 25%', count: discountRecordsList.filter(d => d.discountPercent >= 10 && d.discountPercent < 25).length },
        { bracket: '25% - 50%', count: discountRecordsList.filter(d => d.discountPercent >= 25 && d.discountPercent < 50).length },
        { bracket: '50% and Above', count: discountRecordsList.filter(d => d.discountPercent >= 50).length },
      ],
    },
    highDiscounts: highDiscountsResult,
    complimentaryBills: {
      count: compBillsList.length,
      totalAmountPaise: compBillsList.reduce((acc, c) => acc + c.amountPaise, 0),
      records: compBillsList.slice(0, 50),
    },
    paymentReversals: {
      count: paymentReversalsList.length,
      totalAmountPaise: paymentReversalsList.reduce((acc, p) => acc + p.amountPaise, 0),
      records: paymentReversalsList.slice(0, 50),
    },
    reprints: {
      reprintEventsCount,
      billsReprintedCount,
    },
    offlineReplays: {
      count: offlineReplayCount,
      totalAmountPaise: offlineReplayTotalPaise,
    },
    heldBills: {
      count: heldBillCount,
      totalAmountPaise: heldBillTotalPaise,
    },
    cashVariances: {
      totalSessionsAudited: registerSessions.length,
      sessionsWithVarianceCount,
      totalVariancePaise: totalCashVariancePaise,
    },
  };

  // Deterministic RFM segments (no unapproved subjective labels)
  const deterministicRfmSegments = [
    {
      segment: 'High Frequency Regulars (>= 5 Visits)',
      count: frequencyBuckets['5-9 Visits'].count + frequencyBuckets['10+ Visits'].count,
      spendPaise: frequencyBuckets['5-9 Visits'].spendPaise + frequencyBuckets['10+ Visits'].spendPaise,
      spendPct: identifiedSalesPaise > 0
        ? Number((((frequencyBuckets['5-9 Visits'].spendPaise + frequencyBuckets['10+ Visits'].spendPaise) / identifiedSalesPaise) * 100).toFixed(1))
        : 0.0,
    },
    {
      segment: 'Occasional Regulars (2-4 Visits)',
      count: frequencyBuckets['2-4 Visits'].count,
      spendPaise: frequencyBuckets['2-4 Visits'].spendPaise,
      spendPct: identifiedSalesPaise > 0
        ? Number(((frequencyBuckets['2-4 Visits'].spendPaise / identifiedSalesPaise) * 100).toFixed(1))
        : 0.0,
    },
    {
      segment: 'Single Visit Guests (1 Visit in Period)',
      count: frequencyBuckets['1 Visit'].count,
      spendPaise: frequencyBuckets['1 Visit'].spendPaise,
      spendPct: identifiedSalesPaise > 0
        ? Number(((frequencyBuckets['1 Visit'].spendPaise / identifiedSalesPaise) * 100).toFixed(1))
        : 0.0,
    },
    {
      segment: 'Lapsed / Inactive Registered Customers',
      count: Math.max(0, (isScoped ? activeIdentifiedCustomersCount : customers.length) - activeIdentifiedCustomersCount),
      spendPaise: 0,
      spendPct: 0.0,
    },
  ];

  // Scoped Monthly Acquisition Cohort Retention (Blocker H-R2-003)
  const cohortMap = new Map();
  for (const entry of certifiedCustomerEntries) {
    const earliestBill = entry.bills.reduce((min, b) => {
      const bDate = b.businessDate || (b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '9999-99-99');
      return bDate < min ? bDate : min;
    }, '9999-99-99');
    const acqMonth = earliestBill !== '9999-99-99' ? earliestBill.slice(0, 7) : 'UNKNOWN';
    if (!cohortMap.has(acqMonth)) {
      cohortMap.set(acqMonth, { cohortMonth: acqMonth, customerKeys: new Set(), returnMonths: new Map() });
    }
    const cGroup = cohortMap.get(acqMonth);
    cGroup.customerKeys.add(entry.customerKey);
    for (const b of entry.bills) {
      const bMonth = (b.businessDate || (b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : '')).slice(0, 7);
      if (bMonth && bMonth >= acqMonth) {
        if (!cGroup.returnMonths.has(bMonth)) cGroup.returnMonths.set(bMonth, new Set());
        cGroup.returnMonths.get(bMonth).add(entry.customerKey);
      }
    }
  }

  const cohorts = Array.from(cohortMap.values()).sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth)).map(c => ({
    cohortMonth: c.cohortMonth,
    cohortSize: c.customerKeys.size,
    retentionByMonth: Array.from(c.returnMonths.entries()).map(([m, set]) => ({
      returnMonth: m,
      retainedCount: set.size,
      retentionRatePct: c.customerKeys.size > 0 ? Number(((set.size / c.customerKeys.size) * 100).toFixed(1)) : 0.0,
    })),
  }));

  const cohortRetention = {
    availability: cohorts.length > 0 ? 'COMPLETE' : 'NO_DATA',
    methodology: isScoped ? 'AUTHORISED_SCOPE_MONTHLY_COHORT_V1' : 'ORGANISATION_MONTHLY_COHORT_V1',
    scopeType: isScoped ? 'NEW_TO_AUTHORISED_SCOPE' : 'NEW_TO_ORGANISATION',
    cohorts,
  };

  const segmentation = {
    frequencyDistribution: Object.values(frequencyBuckets),
    recencyDistribution: Object.values(recencyBuckets),
    spendPresentationBuckets: Object.values(spendBrackets),
    rfmSegments: deterministicRfmSegments,
    cohortRetention,
  };

  const byCafe = Array.from(cafeMetricsMap.values()).map(c => ({
    cafeId: c.cafeId,
    identifiedCustomers: c.identifiedCustomers.size,
    visits: c.visitsSet.size,
    orderCount: c.orderCount,
    netSalesPaise: c.netSalesPaise,
    avgSpendPaise: c.orderCount > 0 ? Math.round(c.netSalesPaise / c.orderCount) : 0,
  }));

  const identityQuality = {
    customerIdMatches: identityCustomerIdMatches,
    verifiedPhoneLinks: identityVerifiedPhoneLinks,
    verifiedPhoneCurrentStateLinks: identityVerifiedPhoneCurrentStateLinks,
    phoneOnlyFallbacks: identityPhoneOnlyFallbacks + identityVerifiedPhoneCurrentStateLinks,
    phoneOnlyFallbackLinks: identityPhoneOnlyFallbacks,
    unresolvedAnonymous: identityUnresolvedAnonymous,
    anonymousChecks: identityUnresolvedAnonymous,
    ambiguousPhoneCheckCount,
    ambiguousPhoneChecks: ambiguousPhoneCheckCount,
    ambiguousPhoneLinks: ambiguousPhoneCheckCount,
    certifiedIdentifiedCustomersCount,
    weakLinkCustomerCount,
    totalChecksEvaluated: totalCheckCount,
    matchConfidence: (identityPhoneOnlyFallbacks > 0 || identityVerifiedPhoneCurrentStateLinks > 0 || ambiguousPhoneCheckCount > 0) ? 'PARTIAL_SOURCE' : (identityCustomerIdMatches > 0 ? 'HIGH' : 'PROVENANCE_BASED'),
    identityHierarchyApplied: ['CUSTOMER_ID_MATCH', 'VERIFIED_PHONE_LINK_CURRENT_STATE', 'PHONE_ONLY_FALLBACK', 'ANONYMOUS'],
    operationalPhoneVerificationBacked: true,
    phoneVerificationModel: 'Customer.isPhoneVerified',
    temporalPhoneVerificationAvailability: 'UNAVAILABLE',
    temporalPhoneVerificationReason: 'PHONE_VERIFICATION_HISTORY_NOT_PERSISTED',
    temporalVerificationApplied: false,
  };

  return {
    customerSummary,
    loyaltyAnalytics,
    feedbackAnalytics,
    posOperations,
    posExceptions,
    segmentation,
    retention: {
      cohortRetention,
      repeatCustomerRatePct,
      repeatVisitRatePct,
    },
    rfmSegments: deterministicRfmSegments,
    byCafe,
    identityQuality,
    privacyMode: 'ANONYMIZED_AGGREGATES_ONLY',
    dataQuality: {
      status: warnings.length > 0 ? 'PARTIAL_SOURCE' : 'COMPLETE',
      warnings,
    },
    provenance: {
      sourceModels: Array.from(new Set(sourceModels)),
      sourceRecordCounts: {
        customers: customers.length,
        bills: bills.length,
        loyaltyEntries: loyaltyLedgerEntries.length,
        feedbackEntries: feedbackEntries.length,
        kdsTickets: kdsTickets.length,
        registerSessions: registerSessions.length,
      },
      identityQuality,
      timeBasis: 'BUSINESS_DATE_IST',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Builds structured outage response when database is disconnected.
 * Returns null for source-required values and UNAVAILABLE status.
 */
function _buildOutageResponse(organisationId, cafeScope, dateFrom, dateTo) {
  return {
    customerSummary: {
      totalIdentifiableCustomers: null,
      certifiedIdentifiedCustomers: null,
      weakLinkIdentifiedCustomers: null,
      totalRegisteredCustomers: null,
      activeIdentifiedCustomers: null,
      acquisitionScopeType: 'UNAVAILABLE',
      newCustomersThisPeriod: null,
      repeatCustomersThisPeriod: null,
      repeatCustomerRatePct: null,
      repeatPurchaseRatePct: null,
      totalCustomerVisits: null,
      repeatVisitRatePct: null,
      averageVisitsPerCustomer: null,
      averageSpendPerIdentifiedCustomerPaise: null,
      averageLifetimeSpend: null,
      identifiedCheckCount: null,
      identifiedSalesPaise: null,
      anonymousCheckCount: null,
      anonymousSalesPaise: null,
      anonymousCheckSharePct: null,
      totalCheckCount: null,
      totalNetSalesPaise: null,
      averageCheckPaise: null,
      guestCount: null,
      guestCountAvailability: 'UNAVAILABLE',
      dineInBillCount: null,
      guestCountKnownBillCount: null,
      guestCountMissingBillCount: null,
      knownCoverBillCount: null,
      missingCoverBillCount: null,
      knownCoverNetSalesPaise: null,
      recordedGuestCount: null,
      averageSpendPerGuestPaise: null,
      averageSpendPerGuestAvailability: 'UNAVAILABLE',
    },
    loyaltyAnalytics: {
      membershipScope: 'UNAVAILABLE',
      totalMembers: null,
      activeMembers: null,
      newEnrollments: null,
      pointsEarned: null,
      pointsRedeemed: null,
      redemptionCount: null,
      redemptionRatePct: null,
      tierDistribution: [],
      memberVsNonMemberComparison: {
        member: { customerCount: null, orderCount: null, totalSpendPaise: null, avgOrderSpendPaise: null },
        nonMember: { customerCount: null, orderCount: null, totalSpendPaise: null, avgOrderSpendPaise: null },
      },
    },
    feedbackAnalytics: {
      feedbackCount: null,
      averageRating: null,
      resolutionRatePct: null,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryBreakdown: [],
      statusBreakdown: { NEW: 0, ACKNOWLEDGED: 0, UNDER_REVIEW: 0, RESOLVED: 0 },
      nps: { score: null, availability: 'UNAVAILABLE', reason: 'No 0–10 Net Promoter Score question exists in customer feedback schema.' },
    },
    posOperations: {
      totalCheckCount: null,
      totalNetSalesPaise: null,
      totalGrossSalesPaise: null,
      guestCount: null,
      averageCheckPaise: null,
      averageSpendPerGuestPaise: null,
      knownCoverBillCount: null,
      missingCoverBillCount: null,
      knownCoverNetSalesPaise: null,
      recordedGuestCount: null,
      guestCountAvailability: 'UNAVAILABLE',
      averageSpendPerGuestAvailability: 'UNAVAILABLE',
      orderCount: null,
      orderCountEquivalence: 'BILL_COUNT_EQUIVALENCE',
      serviceModes: [],
      orderSources: [],
      tenders: [],
      speedOfKitchenPrep: {
        totalTickets: null,
        completedTickets: null,
        meanKitchenPrepDurationSeconds: null,
        medianKitchenPrepDurationSeconds: null,
        p90KitchenPrepDurationSeconds: null,
        stationPerformance: [],
        totalServiceTimeAvailability: 'UNAVAILABLE',
        note: 'KDS measures kitchen prep duration (completedAt - receivedAt), not total guest service time.',
      },
      speedOfService: {
        totalTickets: null,
        completedTickets: null,
        meanPrepTimeSeconds: null,
        medianPrepTimeSeconds: null,
        p90PrepTimeSeconds: null,
        stationPerformance: [],
        availability: 'UNAVAILABLE',
      },
      tablePerformance: {
        activeTableCount: null,
        completedDineInChecksPerActiveTable: null,
        tableTurns: { value: null, availability: 'UNAVAILABLE', reason: 'Dedicated table session lifecycle unavailable in production backend.' },
        diningTime: { value: null, availability: 'UNAVAILABLE', reason: 'Authoritative seatedAt and clearedAt timestamps not recorded in Bill schema.' },
      },
      reservations: {
        availability: 'UNAVAILABLE',
        reason: 'Dining table reservation module unavailable in production backend.',
      },
    },
    posExceptions: {
      totalExceptionsCount: null,
      voids: { count: null, totalAmountPaise: null, records: [] },
      refunds: { count: null, totalAmountPaise: null, records: [] },
      discounts: { count: null, totalAmountPaise: null, largestDiscounts: [], discountDistribution: [] },
      complimentaryBills: { count: null, totalAmountPaise: null, records: [] },
      paymentReversals: { count: null, totalAmountPaise: null, records: [] },
      reprints: { reprintEventsCount: null, billsReprintedCount: null },
      offlineReplays: { count: null, totalAmountPaise: null },
      heldBills: { count: null, totalAmountPaise: null },
      cashVariances: { totalSessionsAudited: null, sessionsWithVarianceCount: null, totalVariancePaise: null },
    },
    segmentation: {
      frequencyDistribution: [],
      recencyDistribution: [],
      spendPresentationBuckets: [],
      rfmSegments: [],
      cohortRetention: { availability: 'UNAVAILABLE', methodology: 'NONE', cohorts: [] },
    },
    retention: {
      cohortRetention: { availability: 'UNAVAILABLE', methodology: 'NONE', cohorts: [] },
      repeatCustomerRatePct: null,
      repeatVisitRatePct: null,
    },
    rfmSegments: [],
    byCafe: [],
    identityQuality: {
      confidenceLevel: 'UNAVAILABLE',
      reason: 'DATABASE_UNAVAILABLE',
    },
    privacyMode: 'ANONYMIZED_AGGREGATES_ONLY',
    dataQuality: {
      status: 'UNAVAILABLE',
      reason: 'DATABASE_UNAVAILABLE',
      warnings: ['DATABASE_UNAVAILABLE: Database connection is unavailable. Figures reflect UNAVAILABLE status, not zero live transactions.'],
    },
    provenance: {
      sourceModels: [],
      sourceRecordCounts: { customers: null, bills: null, loyaltyEntries: null, feedbackEntries: null, kdsTickets: null, registerSessions: null },
      timeBasis: 'BUSINESS_DATE_IST',
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  calculateCustomerMetrics,
  CANONICAL_SERVICE_MODES,
  LOYALTY_TIERS,
};
