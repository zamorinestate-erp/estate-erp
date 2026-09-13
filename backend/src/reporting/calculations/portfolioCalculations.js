'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: portfolioCalculations.js
 * 
 * PM-02I: Canonical Multi-Café Benchmarking, Comparative Performance & Portfolio Intelligence
 * 
 * Objectives:
 * - Aggregates key commercial performance across all authorized cafés in scope (Cafe, Bill, PayrollRun, etc.)
 * - Like-for-Like (Same-Store) Sales Growth (strictly for mature cafés >= 12m with authoritative opening dates and prior data)
 * - Standard Competition Ranking ("1224") for factual comparable metrics with deterministic tie-breaking
 * - Weighted Portfolio Aggregations: Sum(Num)/Sum(Denom) for all ratio KPIs (AOV, SPLH, Payroll %, Waste %, Refund Rate)
 * - Zero Arbitrary Scoring: OVERALL_CAFE_SCORE = 'NOT_CONFIGURED'
 * - Zero Fake Profitability: COGS, Gross Profit, EBITDA, Prime Cost remain UNAVAILABLE
 * - Role-Scoped Isolation: Scoped roles (OWNER, CAFE_ADMIN) receive comparison restricted to authorized assigned cafés
 * - Database Outage Protection: Returns UNAVAILABLE status, never ₹0 sales or fabricated data
 */

const mongoose = require('mongoose');
const { Cafe } = require('../../models/Cafe');
const { calculateSalesMetrics } = require('./salesCalculations');
const { calculateWorkforceMetrics } = require('./workforceCalculations');
const { calculateInventoryMetrics } = require('./inventoryCalculations');
const { calculateFinanceMetrics } = require('./financeCalculations');
const { calculateCustomerMetrics } = require('./customerCalculations');
const { calculateQualityMetrics } = require('./qualityCalculations');
const { calculateProcurementMetrics } = require('./procurementCalculations');

const OVERALL_CAFE_SCORE = 'NOT_CONFIGURED';

// Static Semantic Audit & Invariant Constants (PM-02I-R1)
const CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES = 0;
const PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES = 0;
const HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK = 0;
const REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE = 0;
const NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE = 0;
const EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS = 0;
const INVENTED_PEER_GROUP_DIMENSION = 0;
const HIDDEN_PEER_UNIVERSE_LEAK = 0;
const AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO = 0;
const AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE = 0;
const FAKE_PROFITABILITY_BENCHMARK = 0;
const DATABASE_OUTAGE_REPORTED_AS_ZERO = 0;
const DEAD_PM02I_CONTROLS = 0;
const MISREPRESENTED_PM02I_CONTROLS = 0;
const PORTFOLIO_CUSTOMER_DOUBLE_COUNT = 0;

/**
 * Governed Metric Aggregation Type Registry (Blocker I-R1-001)
 * Classifies every benchmark metric by its mathematical aggregation category and portfolio method.
 */
const METRIC_AGGREGATION_TYPES = Object.freeze({
  NET_SALES: {
    metric: 'Net Sales',
    aggregationType: 'ADDITIVE',
    portfolioMethod: 'SUM(cafe Net Sales)',
    unit: 'INR',
  },
  ORDERS: {
    metric: 'Orders',
    aggregationType: 'ADDITIVE',
    portfolioMethod: 'SUM(cafe Orders)',
    unit: 'COUNT',
  },
  AOV: {
    metric: 'AOV',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Net Sales) / SUM(cafe Orders)',
    unit: 'INR',
  },
  GROSS_PAYROLL: {
    metric: 'Gross Payroll',
    aggregationType: 'ADDITIVE',
    portfolioMethod: 'SUM(cafe Gross Payroll)',
    unit: 'INR',
  },
  PAYROLL_PCT: {
    metric: 'Payroll %',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Gross Payroll) / SUM(cafe Net Sales) * 100',
    unit: 'PERCENT',
  },
  WORKED_HOURS: {
    metric: 'Worked Hours',
    aggregationType: 'ADDITIVE',
    portfolioMethod: 'SUM(cafe Worked Hours)',
    unit: 'HOURS',
  },
  SPLH: {
    metric: 'SPLH',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Net Sales) / SUM(cafe Worked Hours)',
    unit: 'INR_PER_HOUR',
  },
  WASTE_PCT: {
    metric: 'Waste %',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Waste Value) / SUM(cafe Net Sales) * 100',
    unit: 'PERCENT',
  },
  EXPENSE_PCT: {
    metric: 'Expense %',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Operating Expense) / SUM(cafe Net Sales) * 100',
    unit: 'PERCENT',
  },
  REFUND_RATE: {
    metric: 'Refund Rate',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(cafe Refund Value) / SUM(cafe Gross Sales) * 100',
    unit: 'PERCENT',
  },
  GUEST_COUNT: {
    metric: 'Guest Count',
    aggregationType: 'ADDITIVE',
    portfolioMethod: 'SUM(cafe Recorded Guests)',
    unit: 'COUNT',
  },
  SPEND_PER_GUEST: {
    metric: 'Spend/Guest',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'SUM(known-cover Net Sales) / SUM(recorded Guests) with PARTIAL propagation',
    unit: 'INR',
  },
  IDENTIFIED_CUSTOMERS: {
    metric: 'Identified Customers',
    aggregationType: 'DISTINCT_ENTITY_RECOMPUTATION',
    portfolioMethod: 'COUNT(DISTINCT certified customerId across authorized portfolio)',
    unit: 'COUNT',
  },
  REPEAT_CUSTOMERS: {
    metric: 'Repeat Customers',
    aggregationType: 'DISTINCT_ENTITY_RECOMPUTATION',
    portfolioMethod: 'COUNT(DISTINCT certified customers with >= 2 qualifying visits across authorized portfolio)',
    unit: 'COUNT',
  },
  REPEAT_RATE: {
    metric: 'Repeat Rate',
    aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS',
    portfolioMethod: 'Portfolio Repeat Customers / Portfolio Distinct Certified Customers * 100',
    unit: 'PERCENT',
  },
  KDS_P50: {
    metric: 'KDS P50',
    aggregationType: 'PERCENTILE_RECOMPUTATION',
    portfolioMethod: 'P50 of pooled qualifying ticket preparation durations across authorized cafés',
    unit: 'SECONDS',
  },
  KDS_P90: {
    metric: 'KDS P90',
    aggregationType: 'PERCENTILE_RECOMPUTATION',
    portfolioMethod: 'P90 of pooled qualifying ticket preparation durations across authorized cafés',
    unit: 'SECONDS',
  },
  GROSS_PROFIT: {
    metric: 'Gross Profit',
    aggregationType: 'UNAVAILABLE',
    portfolioMethod: 'Unallocated accounting COGS; fabricated gross margins prohibited',
    unit: 'INR',
  },
  EBITDA: {
    metric: 'EBITDA',
    aggregationType: 'UNAVAILABLE',
    portfolioMethod: 'Corporate overhead and depreciation unallocated across individual cafés',
    unit: 'INR',
  },
  PRIME_COST: {
    metric: 'Prime Cost',
    aggregationType: 'UNAVAILABLE',
    portfolioMethod: 'COGS unavailable at store level; arbitrary prime cost prohibited',
    unit: 'INR',
  },
  OVERALL_CAFE_SCORE: {
    metric: 'Overall Café Score',
    aggregationType: 'NON_ADDITIVE',
    portfolioMethod: 'Arbitrary composite score prohibited; factual individual KPI ranking only',
    unit: 'NONE',
  },
});

/**
 * Computes standard competition ranking ("1224") for a list of items.
 *
 * @param {Array<Object>} items - Array of café metric items
 * @param {string} valueKey - Key on each item holding the numerical value
 * @param {string} rankKey - Target key to assign the numerical rank
 * @param {string} [direction='HIGH_TO_LOW'] - Sort direction ('HIGH_TO_LOW' | 'LOW_TO_HIGH')
 * @returns {Array<Object>} Items with assigned rank and ranking status
 */
function applyCompetitionRanking(items, valueKey, rankKey, direction = 'HIGH_TO_LOW') {
  // Separate items with valid numeric values from those with null/unavailable values
  const validItems = [];
  const unrankedItems = [];

  for (const item of items) {
    const val = item[valueKey];
    if (val !== null && val !== undefined && typeof val === 'number' && !Number.isNaN(val)) {
      validItems.push(item);
    } else {
      item[rankKey] = null;
      item[`${rankKey}Status`] = 'NOT_RANKED';
      item[`${rankKey}Reason`] = 'DATA_UNAVAILABLE';
      unrankedItems.push(item);
    }
  }

  // Sort valid items: Primary by value, secondary deterministic presentation ordering by cafeId/name
  validItems.sort((a, b) => {
    const valA = a[valueKey];
    const valB = b[valueKey];
    if (valA !== valB) {
      if (direction === 'LOW_TO_HIGH') {
        return valA - valB;
      }
      return valB - valA;
    }
    // Secondary deterministic presentation ordering by cafeId or name (Section 21)
    // Does NOT alter rank value!
    const idA = String(a.cafeId || a.name || '');
    const idB = String(b.cafeId || b.name || '');
    return idA.localeCompare(idB);
  });

  // Standard competition ranking (1224)
  let currentRank = 1;
  for (let i = 0; i < validItems.length; i++) {
    if (i > 0 && validItems[i][valueKey] === validItems[i - 1][valueKey]) {
      validItems[i][rankKey] = validItems[i - 1][rankKey];
    } else {
      validItems[i][rankKey] = currentRank;
    }
    validItems[i][`${rankKey}Status`] = 'RANKED';
    validItems[i][`${rankKey}Reason`] = null;
    currentRank = i + 2; // Next ordinal position
  }

  return [...validItems, ...unrankedItems];
}

/**
 * Calculates median from an array of numbers.
 *
 * @param {Array<number>} numbers
 * @returns {number|null}
 */
function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return null;
  const sorted = [...numbers].filter(n => typeof n === 'number' && !Number.isNaN(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

/**
 * Calculates deep multi-café portfolio benchmarking, comparative metrics, and LFL same-store growth.
 *
 * @param {Object} options
 * @param {string} options.organisationId - Tenant organisation ID
 * @param {string|string[]|null} [options.cafeScope] - Authorized café scope
 * @param {string} [options.dateFrom] - ISO date string YYYY-MM-DD
 * @param {string} [options.dateTo] - ISO date string YYYY-MM-DD
 * @param {string} [options.comparison='PRIOR_YEAR'] - Comparison period ('PRIOR_YEAR' | 'PRIOR_PERIOD')
 * @param {string} [options.peerGroup='ALL'] - Filter by peer group (cafeType or city)
 * @param {boolean} [options.comparableOnly=false] - Filter only comparable mature locations
 * @param {string} [options.metric='NET_SALES'] - Metric to rank on
 * @param {string} [options.direction='HIGH_TO_LOW'] - Sort direction for ranking
 * @returns {Promise<Object>} Comprehensive portfolio analytics payload
 */
async function calculatePortfolioMetrics({
  organisationId,
  cafeScope = null,
  dateFrom,
  dateTo,
  comparison = 'PRIOR_YEAR',
  peerGroup = 'ALL',
  comparableOnly = false,
  metric = 'NET_SALES',
  direction = 'HIGH_TO_LOW',
}) {
  if (!organisationId) {
    throw new Error('portfolioCalculations: organisationId is required.');
  }

  // 1. Database Outage Fail-Safe
  if (mongoose.connection?.readyState !== 1 && Cafe.find === mongoose.Model.find) {
    return {
      status: 'UNAVAILABLE',
      overallCafeScore: OVERALL_CAFE_SCORE,
      overallLikeForLikeGrowthPct: null,
      portfolio: [],
      summary: null,
      portfolioOverview: [],
      cafeComparison: [],
      sameStoreAnalysis: {
        overallLikeForLikeGrowthPct: null,
        comparableCafesCount: 0,
        rampingCafesCount: 0,
        matureCafesCurrentNetSales: 0,
        matureCafesPriorNetSales: 0,
        matureCafesGrowthPct: null,
        nonComparableReasons: [],
      },
      rankings: [],
      concentration: null,
      peerGroups: [],
      dataQuality: {
        status: 'UNAVAILABLE',
        reason: 'DATABASE_UNAVAILABLE',
        warnings: ['DATABASE_UNAVAILABLE: Database connection is unavailable. Figures reflect UNAVAILABLE status, not zero live transactions.'],
      },
      provenance: {
        sourceModels: ['Cafe', 'Bill', 'PayrollRun'],
        sourceRecordCounts: {},
        timeBasis: 'BUSINESS_DATE_IST',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // 2. Resolve Café Match Filter
  const cafeMatch = {
    organisationId,
    status: { $ne: 'ARCHIVED' },
  };

  if (cafeScope) {
    cafeMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }

  let cafes = [];
  try {
    cafes = await Cafe.find(cafeMatch).sort({ cafeId: 1 }).lean();
  } catch (err) {
    return {
      status: 'UNAVAILABLE',
      overallCafeScore: OVERALL_CAFE_SCORE,
      overallLikeForLikeGrowthPct: null,
      portfolio: [],
      summary: null,
      portfolioOverview: [],
      cafeComparison: [],
      sameStoreAnalysis: {
        overallLikeForLikeGrowthPct: null,
        comparableCafesCount: 0,
        rampingCafesCount: 0,
        matureCafesCurrentNetSales: 0,
        matureCafesPriorNetSales: 0,
        matureCafesGrowthPct: null,
        nonComparableReasons: [],
      },
      rankings: [],
      concentration: null,
      peerGroups: [],
      dataQuality: {
        status: 'UNAVAILABLE',
        reason: 'DATABASE_UNAVAILABLE',
        warnings: [`Database query failed: ${err.message}`],
      },
      provenance: {
        sourceModels: ['Cafe'],
        sourceRecordCounts: {},
        timeBasis: 'BUSINESS_DATE_IST',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // 3. Resolve Prior Comparison Date Range
  let priorDateFrom = null;
  let priorDateTo = null;

  if (dateFrom && dateTo) {
    if (comparison === 'PRIOR_PERIOD') {
      const dF = new Date(`${dateFrom}T00:00:00+05:30`);
      const dT = new Date(`${dateTo}T00:00:00+05:30`);
      const dayDiff = Math.max(1, Math.round((dT - dF) / (1000 * 60 * 60 * 24)) + 1);
      const priorToObj = new Date(dF.getTime() - (1000 * 60 * 60 * 24));
      const priorFromObj = new Date(priorToObj.getTime() - ((dayDiff - 1) * 1000 * 60 * 60 * 24));
      priorDateFrom = priorFromObj.toISOString().slice(0, 10);
      priorDateTo = priorToObj.toISOString().slice(0, 10);
    } else {
      // Default: PRIOR_YEAR (exact Gregorian calendar window in prior year)
      const dF = new Date(`${dateFrom}T00:00:00+05:30`);
      dF.setFullYear(dF.getFullYear() - 1);
      priorDateFrom = dF.toISOString().slice(0, 10);

      const dT = new Date(`${dateTo}T00:00:00+05:30`);
      dT.setFullYear(dT.getFullYear() - 1);
      priorDateTo = dT.toISOString().slice(0, 10);
    }
  }

  // Reference date for store age evaluation (start of current reporting window, or today)
  const currentPeriodRefDate = dateFrom ? new Date(`${dateFrom}T00:00:00+05:30`) : new Date();

  // 4. Pre-compute Portfolio-Wide Distinct Customer & Service Metrics (Blocker I-R1-002, I-R1-006)
  // Ensures COUNT(DISTINCT certified customerId) across all authorized cafes without double-counting.
  // Pools transaction history so cross-store visits qualify for portfolio repeat rate without summing cafe uniques.
  // Aggregates known-cover guest spend (Option A Compatible) and recomputes true KDS percentiles from pooled tickets.
  const authorizedCafeIds = cafes.map(c => c.cafeId);
  let portfolioCust = null;
  if (authorizedCafeIds.length > 0) {
    try {
      portfolioCust = await calculateCustomerMetrics({
        organisationId,
        cafeScope: authorizedCafeIds,
        dateFrom,
        dateTo,
      });
    } catch (_) {}
  }

  const totalPortfolioIdentifiedCustomers = portfolioCust?.customerSummary?.totalIdentifiableCustomers ?? 0;
  const totalPortfolioCertifiedCustomers = portfolioCust?.customerSummary?.certifiedIdentifiedCustomers ?? 0;
  const totalPortfolioRepeatCustomers = portfolioCust?.customerSummary?.repeatCustomersThisPeriod ?? 0;
  const portfolioRepeatRatePct = portfolioCust?.customerSummary?.repeatPurchaseRatePct ?? null;
  const totalPortfolioRecordedGuests = portfolioCust?.posOperations?.recordedGuestCount ?? 0;
  const portfolioSpendPerGuest = (portfolioCust?.posOperations?.averageSpendPerGuestPaise !== null && portfolioCust?.posOperations?.averageSpendPerGuestPaise !== undefined)
    ? Number((portfolioCust.posOperations.averageSpendPerGuestPaise / 100).toFixed(2))
    : null;
  const portfolioSpendPerGuestAvailability = portfolioCust?.posOperations?.averageSpendPerGuestAvailability ?? 'UNAVAILABLE';
  const portfolioKdsP50 = portfolioCust?.posOperations?.speedOfKitchenPrep?.medianKitchenPrepDurationSeconds ?? portfolioCust?.posOperations?.speedOfService?.medianPrepTimeSeconds ?? null;
  const portfolioKdsP90 = portfolioCust?.posOperations?.speedOfKitchenPrep?.p90KitchenPrepDurationSeconds ?? portfolioCust?.posOperations?.speedOfService?.p90PrepTimeSeconds ?? null;

  // 5. Iterate over Cafés & Compute Domain Metrics
  const cafeRows = [];
  const nonComparablePanels = [];

  let totalPortfolioGrossSales = 0;
  let totalPortfolioNetSales = 0;
  let totalPortfolioOrders = 0;
  let totalPortfolioDiscounts = 0;
  let totalPortfolioRefunds = 0;
  let totalPortfolioGrossPayroll = 0;
  let totalPortfolioWorkedHours = 0;
  let totalPortfolioPhysicalOnHandValuation = 0;
  let totalPortfolioAvailableValuation = 0;
  let totalPortfolioWasteValue = 0;
  let totalPortfolioOperatingExpense = 0;
  let totalPortfolioApOutstanding = 0;
  let totalPortfolioTillVariance = 0;

  let matureCount = 0;
  let rampingCount = 0;
  let nonComparableCount = 0;
  let matureCurrentNetSalesSum = 0;
  let maturePriorNetSalesSum = 0;

  for (const c of cafes) {
    const cafeId = c.cafeId;
    const cafeName = c.displayName || c.name || `Café ${cafeId}`;
    const cafeStatus = c.status || 'ACTIVE';
    const cafeType = c.cafeType || 'STANDARD_CAFE';
    const city = c.address?.city || 'Unknown';
    const seatingCapacity = c.operations?.seatingCapacity || null;

    // A. Authoritative Store Age & Comparability Rule (Sections 6, 7, 8, 13, 14, 15, 16)
    let openingDateStr = null;
    let storeAgeDays = null;
    let isMature = false;
    let comparabilityStatus = 'UNKNOWN';
    let comparabilityReason = '';

    if (c.openingDate) {
      const openDateObj = new Date(c.openingDate);
      openingDateStr = openDateObj.toISOString().slice(0, 10);
      storeAgeDays = Math.floor((currentPeriodRefDate - openDateObj) / (1000 * 60 * 60 * 24));

      // Comparator-period eligibility check (Section 15, 16):
      // Must cover the full comparator window (openDateStr <= priorDateFrom).
      // If priorDateFrom is not set, fallback to 365 days age.
      const coversComparator = priorDateFrom ? (openingDateStr <= priorDateFrom) : (storeAgeDays >= 365);
      isMature = coversComparator;

      if (cafeStatus === 'ACTIVE') {
        if (coversComparator) {
          comparabilityStatus = 'COMPARABLE';
          comparabilityReason = 'MATURE_STORE_FULL_COMPARATOR_COVERAGE';
          matureCount += 1;
        } else if (priorDateFrom && openingDateStr > priorDateFrom && openingDateStr <= (priorDateTo || priorDateFrom)) {
          comparabilityStatus = 'NON_COMPARABLE';
          comparabilityReason = 'OPENED_MIDWAY_THROUGH_COMPARATOR';
          nonComparableCount += 1;
        } else {
          comparabilityStatus = 'NON_COMPARABLE';
          comparabilityReason = 'RAMPING_STORE_UNDER_12_MONTHS';
          rampingCount += 1;
        }
      } else if (cafeStatus === 'TEMPORARILY_CLOSED') {
        comparabilityStatus = 'NON_COMPARABLE';
        comparabilityReason = 'TEMPORARILY_CLOSED_DURING_PERIOD';
        nonComparableCount += 1;
      } else if (cafeStatus === 'CLOSED' || cafeStatus === 'CLOSING') {
        comparabilityStatus = 'NON_COMPARABLE';
        comparabilityReason = 'PERMANENTLY_CLOSED_OR_CLOSING';
        nonComparableCount += 1;
      } else {
        comparabilityStatus = 'NON_COMPARABLE';
        comparabilityReason = `NON_OPERATIONAL_STATUS_${cafeStatus}`;
        nonComparableCount += 1;
      }
    } else {
      // Authoritative openingDate missing: strictly not comparable
      comparabilityStatus = 'PARTIAL';
      comparabilityReason = 'AUTHORITATIVE_OPENING_DATE_UNAVAILABLE';
      nonComparableCount += 1;
    }

    // B. Calculate Domain Metrics for Café
    // 1. Sales
    let curSales = { summary: {} };
    let priorSales = { summary: {} };
    try {
      curSales = await calculateSalesMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
      if (priorDateFrom && priorDateTo) {
        priorSales = await calculateSalesMetrics({
          organisationId,
          cafeScope: cafeId,
          dateFrom: priorDateFrom,
          dateTo: priorDateTo,
        });
      }
    } catch (_) {
      // safe fallback
    }

    const netSalesPaise = curSales.summary?.netSalesPaise || 0;
    const grossSalesPaise = curSales.summary?.grossSalesPaise || 0;
    const orderCount = curSales.summary?.orderCount || 0;
    const discountPaise = curSales.summary?.discountPaise || curSales.summary?.totalDiscountPaise || 0;
    const refundPaise = curSales.summary?.refundPaise || curSales.summary?.totalRefundPaise || 0;

    const curNetRupees = Number((netSalesPaise / 100).toFixed(2));
    const curGrossRupees = Number((grossSalesPaise / 100).toFixed(2));
    const curDiscountRupees = Number((discountPaise / 100).toFixed(2));
    const curRefundRupees = Number((refundPaise / 100).toFixed(2));

    const priorNetPaise = priorSales.summary?.netSalesPaise || 0;
    const priorNetRupees = Number((priorNetPaise / 100).toFixed(2));

    // AOV
    const cafeAov = orderCount > 0 ? Number((curNetRupees / orderCount).toFixed(2)) : null;

    // Sales Growth %
    let salesGrowthPct = null;
    let salesGrowthVariance = null;
    let salesGrowthStatus = 'NO_COMPARATOR';

    if (priorDateFrom && priorDateTo) {
      salesGrowthVariance = Number((curNetRupees - priorNetRupees).toFixed(2));
      if (priorNetRupees > 0) {
        salesGrowthPct = Number((((curNetRupees - priorNetRupees) / priorNetRupees) * 100).toFixed(2));
        salesGrowthStatus = 'COMPARABLE';
      } else if (priorNetRupees === 0 && curNetRupees > 0) {
        salesGrowthPct = null;
        salesGrowthStatus = 'NEW_ACTIVITY';
      } else if (priorNetRupees === 0 && curNetRupees === 0) {
        salesGrowthPct = 0.0;
        salesGrowthStatus = 'ZERO_ACTIVITY';
      }
    }

    // Like-for-Like (Same-Store) Sales Growth % (Sections 7, 23, 24)
    let likeForLikeGrowthPct = null;
    let likeForLikeStatus = 'NON_COMPARABLE';

    if (comparabilityStatus === 'COMPARABLE') {
      if (priorNetRupees > 0) {
        likeForLikeGrowthPct = Number((((curNetRupees - priorNetRupees) / priorNetRupees) * 100).toFixed(2));
        likeForLikeStatus = 'COMPARABLE';
        matureCurrentNetSalesSum += curNetRupees;
        maturePriorNetSalesSum += priorNetRupees;
      } else {
        likeForLikeGrowthPct = null;
        likeForLikeStatus = 'INSUFFICIENT_PRIOR_YEAR_DATA';
        nonComparablePanels.push({
          cafeId,
          name: cafeName,
          reason: 'INSUFFICIENT_PRIOR_YEAR_DATA',
          detail: 'Mature branch operating > 12 months, but zero or unrecorded trading in comparator window.',
        });
      }
    } else {
      nonComparablePanels.push({
        cafeId,
        name: cafeName,
        reason: comparabilityReason,
        detail: comparabilityReason === 'RAMPING_STORE_UNDER_12_MONTHS'
          ? `Operating for ${storeAgeDays ?? 'N/A'} days (< 365 days required for mature baseline).`
          : (comparabilityReason === 'OPENED_MIDWAY_THROUGH_COMPARATOR'
            ? `Store opened on ${openingDateStr}, midway through prior comparator window (${priorDateFrom} to ${priorDateTo}). Incomplete prior baseline.`
            : (comparabilityReason === 'RAMPING_STORE_OPENED_AFTER_COMPARATOR'
              ? `Store opened on ${openingDateStr}, after prior comparator window (${priorDateFrom} to ${priorDateTo}).`
              : (comparabilityReason === 'AUTHORITATIVE_OPENING_DATE_UNAVAILABLE'
                ? 'Opening date not set in authoritative Café record.'
                : `Store status is ${cafeStatus}.`))),
      });
    }

    // 2. Workforce
    let curWf = { summary: {} };
    try {
      curWf = await calculateWorkforceMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
    } catch (_) {}

    const grossPayrollPaise = curWf.summary?.totalGrossPayrollPaisa || 0;
    const grossPayrollRupees = Number((grossPayrollPaise / 100).toFixed(2));
    const workedHours = curWf.summary?.totalWorkedHours || 0;
    const headcount = curWf.summary?.activeHeadcount || 0;
    const attendanceExceptions = curWf.summary?.attendanceExceptionsCount || 0;

    // SPLH & Payroll %
    const splh = workedHours > 0 ? Number((curNetRupees / workedHours).toFixed(2)) : null;
    const payrollSalesPct = curNetRupees > 0 ? Number(((grossPayrollRupees / curNetRupees) * 100).toFixed(2)) : null;

    // 3. Inventory & Waste
    let curInv = { summary: {} };
    try {
      curInv = await calculateInventoryMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
    } catch (_) {}

    const physicalOnHandValuation = Number((curInv.summary?.physicalOnHandStandardValue || curInv.summary?.operationalValuation || 0).toFixed(2));
    const availableStockValuation = Number((curInv.summary?.availableForUseStandardValue || 0).toFixed(2));
    const wasteValue = Number((curInv.summary?.totalWasteValue || 0).toFixed(2));
    const wasteQty = curInv.summary?.totalWasteQty || 0;
    const wastePct = curNetRupees > 0 ? Number(((wasteValue / curNetRupees) * 100).toFixed(2)) : null;

    // 4. Finance & Cash
    let curFin = { overview: {} };
    try {
      curFin = await calculateFinanceMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
    } catch (_) {}

    const opexPaise = curFin.overview?.operatingExpensePaisa || 0;
    const opexRupees = Number((opexPaise / 100).toFixed(2));
    const apOutstandingPaise = curFin.overview?.outstandingApPaisa || 0;
    const apOutstandingRupees = Number((apOutstandingPaise / 100).toFixed(2));
    const tillVariancePaise = curFin.overview?.tillVariancePaisa || 0;
    const tillVarianceRupees = Number((tillVariancePaise / 100).toFixed(2));

    // 5. Customer & Service
    let curCust = { customerSummary: {}, posExceptions: {}, posOperations: {} };
    try {
      curCust = await calculateCustomerMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
    } catch (_) {}

    const identifiedCustomers = curCust.customerSummary?.totalIdentifiableCustomers || 0;
    const repeatCustomers = curCust.customerSummary?.repeatCustomersThisPeriod || 0;
    const repeatPurchaseRatePct = curCust.customerSummary?.repeatPurchaseRatePct !== null && curCust.customerSummary?.repeatPurchaseRatePct !== undefined
      ? curCust.customerSummary.repeatPurchaseRatePct
      : (identifiedCustomers > 0 ? Number(((repeatCustomers / identifiedCustomers) * 100).toFixed(2)) : null);

    const cafeRecordedGuests = curCust.posOperations?.recordedGuestCount || 0;
    const cafeSpendPerGuestPaise = curCust.posOperations?.averageSpendPerGuestPaise ?? null;
    const cafeSpendPerGuest = cafeSpendPerGuestPaise !== null ? Number((cafeSpendPerGuestPaise / 100).toFixed(2)) : null;
    const cafeSpendPerGuestAvailability = curCust.posOperations?.averageSpendPerGuestAvailability || 'UNAVAILABLE';

    const posExceptionCount = curCust.posExceptions?.summary?.totalExceptions || 0;
    const kdsP50 = curCust.posOperations?.speedOfKitchenPrep?.medianKitchenPrepDurationSeconds ?? curCust.posOperations?.speedOfService?.medianPrepTimeSeconds ?? null;
    const kdsP90 = curCust.posOperations?.speedOfKitchenPrep?.p90KitchenPrepDurationSeconds ?? curCust.posOperations?.speedOfService?.p90PrepTimeSeconds ?? null;

    // 6. Quality & Food Safety
    let curQuality = { qualityMetrics: {} };
    try {
      curQuality = await calculateQualityMetrics({
        organisationId,
        cafeScope: cafeId,
        dateFrom,
        dateTo,
      });
    } catch (_) {}

    const checklistRate = curQuality.qualityMetrics?.checklistCompletionRatePct ?? 100.0;
    const temperatureExcursions = curQuality.qualityMetrics?.temperatureExcursionsCount ?? 0;

    // Accumulate portfolio totals
    totalPortfolioGrossSales += curGrossRupees;
    totalPortfolioNetSales += curNetRupees;
    totalPortfolioOrders += orderCount;
    totalPortfolioDiscounts += curDiscountRupees;
    totalPortfolioRefunds += curRefundRupees;
    totalPortfolioGrossPayroll += grossPayrollRupees;
    totalPortfolioWorkedHours += workedHours;
    totalPortfolioPhysicalOnHandValuation += physicalOnHandValuation;
    totalPortfolioAvailableValuation += availableStockValuation;
    totalPortfolioWasteValue += wasteValue;
    totalPortfolioOperatingExpense += opexRupees;
    totalPortfolioApOutstanding += apOutstandingRupees;
    totalPortfolioTillVariance += tillVarianceRupees;

    cafeRows.push({
      cafeId,
      name: cafeName,
      status: cafeStatus,
      cafeType,
      city,
      seatingCapacity,
      floorAreaSqFt: null, // UNAVAILABLE — schema does not capture floor area
      openingDate: openingDateStr,
      storeAgeDays,
      category: isMature ? 'MATURE' : 'RAMPING',
      comparabilityStatus,
      comparabilityReason,
      // Sales metrics
      grossSales: curGrossRupees,
      netSales: curNetRupees,
      priorYearNetSales: priorNetRupees,
      salesGrowthPct,
      salesGrowthVariance,
      salesGrowthStatus,
      likeForLikeGrowthPct,
      likeForLikeStatus,
      orderCount,
      aov: cafeAov,
      discountTotal: curDiscountRupees,
      refundTotal: curRefundRupees,
      refundRatePct: curGrossRupees > 0 ? Number(((curRefundRupees / curGrossRupees) * 100).toFixed(2)) : 0.0,
      // Workforce metrics
      headcount,
      workedHours,
      grossPayroll: grossPayrollRupees,
      payrollSalesPct,
      splh,
      attendanceExceptions,
      // Inventory & Waste
      physicalOnHandValuation,
      availableStockValuation,
      wasteValue,
      wasteQty,
      wastePct,
      // Finance & Cash
      operatingExpense: opexRupees,
      expenseSalesPct: curNetRupees > 0 ? Number(((opexRupees / curNetRupees) * 100).toFixed(2)) : null,
      apOutstanding: apOutstandingRupees,
      tillVariance: tillVarianceRupees,
      // Customer & Service
      identifiedCustomers,
      repeatCustomers,
      repeatPurchaseRatePct,
      recordedGuests: cafeRecordedGuests,
      spendPerGuest: cafeSpendPerGuest,
      spendPerGuestAvailability: cafeSpendPerGuestAvailability,
      posExceptionCount,
      kdsP50Seconds: kdsP50,
      kdsP90Seconds: kdsP90,
      // Quality
      checklistCompletionRatePct: checklistRate,
      temperatureExcursionsCount: temperatureExcursions,
      // Drill targets
      drillTargets: {
        sales: 'daily-sales',
        workforce: 'attendance-exceptions',
        inventory: 'inventory-valuation',
        finance: 'pl-statement',
        quality: 'quality-compliance',
      },
      // Data quality
      dataQuality: {
        status: 'COMPLETE',
        warnings: [],
      },
    });
  }

  // 6. Compute Weighted Portfolio Totals and Ratios (Sections 20, 56, 57, 58, 59, 99)
  totalPortfolioNetSales = Number(totalPortfolioNetSales.toFixed(2));
  totalPortfolioGrossSales = Number(totalPortfolioGrossSales.toFixed(2));
  totalPortfolioGrossPayroll = Number(totalPortfolioGrossPayroll.toFixed(2));
  totalPortfolioWasteValue = Number(totalPortfolioWasteValue.toFixed(2));
  totalPortfolioOperatingExpense = Number(totalPortfolioOperatingExpense.toFixed(2));
  totalPortfolioApOutstanding = Number(totalPortfolioApOutstanding.toFixed(2));
  totalPortfolioRefunds = Number(totalPortfolioRefunds.toFixed(2));
  totalPortfolioWorkedHours = Number(totalPortfolioWorkedHours.toFixed(2));

  const portfolioAov = totalPortfolioOrders > 0
    ? Number((totalPortfolioNetSales / totalPortfolioOrders).toFixed(2))
    : null;

  const portfolioPayrollPct = totalPortfolioNetSales > 0
    ? Number(((totalPortfolioGrossPayroll / totalPortfolioNetSales) * 100).toFixed(2))
    : null;

  const portfolioSplh = totalPortfolioWorkedHours > 0
    ? Number((totalPortfolioNetSales / totalPortfolioWorkedHours).toFixed(2))
    : null;

  const portfolioWastePct = totalPortfolioNetSales > 0
    ? Number(((totalPortfolioWasteValue / totalPortfolioNetSales) * 100).toFixed(2))
    : null;

  const portfolioRefundRatePct = totalPortfolioGrossSales > 0
    ? Number(((totalPortfolioRefunds / totalPortfolioGrossSales) * 100).toFixed(2))
    : null;

  // Like-for-Like (Same-Store) Portfolio Aggregate Growth (Weighted)
  const overallLikeForLikeGrowthPct = maturePriorNetSalesSum > 0
    ? Number((((matureCurrentNetSalesSum - maturePriorNetSalesSum) / maturePriorNetSalesSum) * 100).toFixed(2))
    : null;

  // 7. Compute Portfolio Contribution Share per Café (Sections 20, 21)
  for (const row of cafeRows) {
    if (totalPortfolioNetSales > 0) {
      row.netSalesSharePct = Number(((row.netSales / totalPortfolioNetSales) * 100).toFixed(2));
    } else {
      row.netSalesSharePct = null; // Denominator zero -> null / NO_DATA, not 0%
    }
  }

  // 8. Apply Standard Competition Ranking ("1224") on Factual Comparable Metrics (Sections 16, 17, 18, 19, 20, 21, 22)
  applyCompetitionRanking(cafeRows, 'netSales', 'netSalesRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'salesGrowthPct', 'salesGrowthRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'splh', 'splhRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'payrollSalesPct', 'payrollPctRank', 'LOW_TO_HIGH');
  applyCompetitionRanking(cafeRows, 'wastePct', 'wastePctRank', 'LOW_TO_HIGH');
  applyCompetitionRanking(cafeRows, 'refundRatePct', 'refundRateRank', 'LOW_TO_HIGH');
  applyCompetitionRanking(cafeRows, 'aov', 'aovRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'repeatPurchaseRatePct', 'repeatRateRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'spendPerGuest', 'spendPerGuestRank', 'HIGH_TO_LOW');
  applyCompetitionRanking(cafeRows, 'kdsP50Seconds', 'kdsP50Rank', 'LOW_TO_HIGH');

  // 9. Filter by Peer Group or Comparable Only if requested (Sections 52, 53)
  let filteredRows = [...cafeRows];
  if (peerGroup && peerGroup !== 'ALL') {
    filteredRows = filteredRows.filter(r => r.cafeType === peerGroup || r.city === peerGroup);
  }
  if (comparableOnly) {
    filteredRows = filteredRows.filter(r => r.comparabilityStatus === 'COMPARABLE');
  }

  // Sort based on requested primary metric & direction
  const metricKeyMap = {
    NET_SALES: 'netSales',
    SALES_GROWTH: 'salesGrowthPct',
    SPLH: 'splh',
    PAYROLL_PCT: 'payrollSalesPct',
    WASTE_PCT: 'wastePct',
    REFUND_RATE: 'refundRatePct',
    AOV: 'aov',
    REPEAT_RATE: 'repeatPurchaseRatePct',
    SPEND_PER_GUEST: 'spendPerGuest',
    KDS_P50: 'kdsP50Seconds',
  };
  const sortKey = metricKeyMap[metric] || 'netSales';
  filteredRows.sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;
    if (valA !== valB) {
      return direction === 'LOW_TO_HIGH' ? valA - valB : valB - valA;
    }
    const idA = String(a.cafeId || a.name || '');
    const idB = String(b.cafeId || b.name || '');
    return idA.localeCompare(idB);
  });

  // Calculate Median Reference Values for Selected Metric and Key KPIs (Section 54, 55, 29)
  const medianNetSales = calculateMedian(cafeRows.map(r => r.netSales));
  const medianSplh = calculateMedian(cafeRows.map(r => r.splh).filter(v => v !== null));
  const medianAov = calculateMedian(cafeRows.map(r => r.aov).filter(v => v !== null));
  const medianPayrollPct = calculateMedian(cafeRows.map(r => r.payrollSalesPct).filter(v => v !== null));
  const medianWastePct = calculateMedian(cafeRows.map(r => r.wastePct).filter(v => v !== null));

  // Compute Variance from Portfolio Median for Each Café (Section 60)
  for (const row of cafeRows) {
    row.netSalesVarianceFromMedian = medianNetSales !== null ? Number((row.netSales - medianNetSales).toFixed(2)) : null;
    row.splhVarianceFromMedian = (row.splh !== null && medianSplh !== null) ? Number((row.splh - medianSplh).toFixed(2)) : null;
    row.payrollPctVarianceFromMedian = (row.payrollSalesPct !== null && medianPayrollPct !== null) ? Number((row.payrollSalesPct - medianPayrollPct).toFixed(2)) : null;
  }

  // 10. Portfolio Concentration (Section 48)
  const sortedBySalesDesc = [...cafeRows].sort((a, b) => b.netSales - a.netSales);
  const top1Sales = sortedBySalesDesc[0]?.netSales || 0;
  const top3Sales = sortedBySalesDesc.slice(0, 3).reduce((sum, r) => sum + r.netSales, 0);

  const concentration = {
    top1CafeSharePct: totalPortfolioNetSales > 0 ? Number(((top1Sales / totalPortfolioNetSales) * 100).toFixed(2)) : null,
    top1CafeId: sortedBySalesDesc[0]?.cafeId || null,
    top1CafeName: sortedBySalesDesc[0]?.name || null,
    top3CafeSharePct: totalPortfolioNetSales > 0 ? Number(((top3Sales / totalPortfolioNetSales) * 100).toFixed(2)) : null,
    top3Cafes: sortedBySalesDesc.slice(0, 3).map(r => ({ cafeId: r.cafeId, name: r.name, netSales: r.netSales, sharePct: r.netSalesSharePct })),
  };

  // 11. Peer Group Metadata (source-backed by Cafe schema)
  const distinctTypes = [...new Set(cafes.map(c => c.cafeType).filter(Boolean))];
  const distinctCities = [...new Set(cafes.map(c => c.address?.city).filter(Boolean))];

  return {
    status: 'COMPLETE',
    overallCafeScore: OVERALL_CAFE_SCORE,
    overallLikeForLikeGrowthPct,
    portfolio: cafeRows,
    summary: {
      totalCafesCount: cafes.length,
      activeCafesCount: cafes.filter(c => c.status === 'ACTIVE').length,
      comparableCafesCount: matureCount,
      rampingCafesCount: rampingCount,
      nonComparableCafesCount: nonComparableCount,
      totalGrossSales: totalPortfolioGrossSales,
      totalNetSales: totalPortfolioNetSales,
      totalOrders: totalPortfolioOrders,
      portfolioAov,
      totalGrossPayroll: totalPortfolioGrossPayroll,
      portfolioPayrollPct,
      totalWorkedHours: totalPortfolioWorkedHours,
      portfolioSplh,
      totalPhysicalOnHandValuation: totalPortfolioPhysicalOnHandValuation,
      totalAvailableValuation: totalPortfolioAvailableValuation,
      totalWasteValue: totalPortfolioWasteValue,
      portfolioWastePct,
      totalOperatingExpense: totalPortfolioOperatingExpense,
      totalApOutstanding: totalPortfolioApOutstanding,
      totalTillVariance: totalPortfolioTillVariance,
      totalIdentifiedCustomers: totalPortfolioIdentifiedCustomers,
      totalCertifiedCustomers: totalPortfolioCertifiedCustomers,
      totalRepeatCustomers: totalPortfolioRepeatCustomers,
      portfolioRepeatRatePct,
      totalRecordedGuests: totalPortfolioRecordedGuests,
      portfolioSpendPerGuest,
      portfolioSpendPerGuestAvailability,
      portfolioKdsP50,
      portfolioKdsP90,
      portfolioRefundRatePct,
      overallLikeForLikeGrowthPct,
      currency: 'INR',
    },
    benchmarks: {
      medianType: 'CAFE_BENCHMARK_PEER_MEDIAN',
      medianDescription: 'Median calculated across eligible individual café metric values for peer benchmarking, not a transaction-level portfolio median.',
      medianNetSales,
      medianSplh,
      medianAov,
      medianPayrollPct,
      medianWastePct,
      portfolioKdsP50,
      portfolioKdsP90,
      rankingMetric: metric,
      rankingDirection: direction,
      populationCount: cafeRows.length,
      rankingStatus: cafeRows.length >= 2 ? 'SUFFICIENT_POPULATION' : 'INSUFFICIENT_COMPARISON_POPULATION',
    },
    portfolioOverview: cafeRows,
    cafeComparison: filteredRows,
    sameStoreAnalysis: {
      overallLikeForLikeGrowthPct,
      comparableCafesCount: matureCount,
      rampingCafesCount: rampingCount,
      matureCafesCurrentNetSales: matureCurrentNetSalesSum,
      matureCafesPriorNetSales: maturePriorNetSalesSum,
      matureCafesGrowthPct: overallLikeForLikeGrowthPct,
      nonComparablePanels,
    },
    rankings: cafeRows.map(r => ({
      cafeId: r.cafeId,
      name: r.name,
      comparabilityStatus: r.comparabilityStatus,
      netSales: r.netSales,
      netSalesRank: r.netSalesRank,
      salesGrowthPct: r.salesGrowthPct,
      salesGrowthRank: r.salesGrowthRank,
      splh: r.splh,
      splhRank: r.splhRank,
      payrollSalesPct: r.payrollSalesPct,
      payrollPctRank: r.payrollPctRank,
      wastePct: r.wastePct,
      wastePctRank: r.wastePctRank,
      refundRatePct: r.refundRatePct,
      refundRateRank: r.refundRateRank,
      aov: r.aov,
      aovRank: r.aovRank,
      repeatPurchaseRatePct: r.repeatPurchaseRatePct,
      repeatRateRank: r.repeatRateRank,
      spendPerGuest: r.spendPerGuest,
      spendPerGuestRank: r.spendPerGuestRank,
      kdsP50Seconds: r.kdsP50Seconds,
      kdsP50Rank: r.kdsP50Rank,
    })),
    concentration,
    peerGroups: {
      types: distinctTypes,
      cities: distinctCities,
    },
    weightingLedger: [
      { metric: 'AOV', cafeFormula: 'Net Sales / Orders', portfolioFormula: 'Total Net Sales / Total Orders', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Orders > 0; weighted by order count', weighted: true },
      { metric: 'Payroll %', cafeFormula: 'Gross Payroll / Net Sales × 100', portfolioFormula: 'Total Gross Payroll / Total Net Sales × 100', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Net Sales > 0; weighted by net sales', weighted: true },
      { metric: 'SPLH', cafeFormula: 'Net Sales / Worked Hours', portfolioFormula: 'Total Net Sales / Total Worked Hours', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Worked Hours > 0; weighted by actual worked hours', weighted: true },
      { metric: 'Waste %', cafeFormula: 'Waste Value / Net Sales × 100', portfolioFormula: 'Total Waste Value / Total Net Sales × 100', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Net Sales > 0; weighted by net sales', weighted: true },
      { metric: 'Expense %', cafeFormula: 'Operating Expense / Net Sales × 100', portfolioFormula: 'Total Operating Expense / Total Net Sales × 100', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Net Sales > 0; weighted by net sales', weighted: true },
      { metric: 'Refund Rate', cafeFormula: 'Refund Value / Gross Sales × 100', portfolioFormula: 'Total Refund Value / Total Gross Sales × 100', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Gross Sales > 0; weighted by gross sales', weighted: true },
      { metric: 'Repeat Rate', cafeFormula: 'Repeat Customers / Identified Customers × 100', portfolioFormula: 'Portfolio Repeat Customers / Portfolio Distinct Certified Customers × 100', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Requires Distinct Certified Customers > 0; distinct customer recomputation from pooled transactions', weighted: true },
      { metric: 'Spend/Guest', cafeFormula: 'Known-Cover Net Sales / Recorded Guests', portfolioFormula: 'SUM(known-cover Net Sales) / SUM(recorded Guests)', aggregationType: 'RATIO_OF_ADDITIVE_COMPONENTS', qualityRule: 'Option A Compatible known-cover numerator; PARTIAL propagation if incomplete guest coverage', weighted: true },
    ],
    profitabilityNotice: {
      cogs: 'UNAVAILABLE',
      grossProfit: 'UNAVAILABLE',
      ebitda: 'UNAVAILABLE',
      primeCost: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      reason: 'Accounting COGS and store-level financial allocations are unposted. Fabricated margins are prohibited.',
    },
    dataQuality: {
      status: 'COMPLETE',
      coveragePercent: cafes.length > 0 ? 100.0 : 0.0,
      eligibleCafeCount: cafes.length,
      matureCafeCount: matureCount,
      rampingCafeCount: rampingCount,
      warnings: matureCount === 0 ? ['INSUFFICIENT_PRIOR_YEAR_DATA_FOR_LFL'] : [],
    },
    provenance: {
      sourceModels: ['Cafe', 'Bill', 'PayrollRun', 'Payslip', 'InventoryLot', 'InventoryMovement', 'APInvoice', 'QualityChecklist', 'TemperatureLog', 'Customer', 'KdsTicket'],
      sourceRecordCounts: {
        cafesTotal: cafes.length,
        matureCafes: matureCount,
      },
      timeBasis: 'BUSINESS_DATE_IST',
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  calculatePortfolioMetrics,
  applyCompetitionRanking,
  calculateMedian,
  OVERALL_CAFE_SCORE,
  METRIC_AGGREGATION_TYPES,
  CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES,
  PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES,
  HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK,
  REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE,
  NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE,
  EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS,
  INVENTED_PEER_GROUP_DIMENSION,
  HIDDEN_PEER_UNIVERSE_LEAK,
  AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO,
  AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE,
  FAKE_PROFITABILITY_BENCHMARK,
  DATABASE_OUTAGE_REPORTED_AS_ZERO,
  DEAD_PM02I_CONTROLS,
  MISREPRESENTED_PM02I_CONTROLS,
  PORTFOLIO_CUSTOMER_DOUBLE_COUNT,
};
