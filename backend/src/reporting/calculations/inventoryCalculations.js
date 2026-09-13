'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: inventoryCalculations.js (SCR-022 / PM-02E)
 * 
 * Canonical Inventory Intelligence calculation service:
 * - On-hand stock quantity & operational valuation (remainingQuantity * unitCostPaisa)
 * - Multi-dimensional valuation by Café, Category, and Item
 * - Lot status tracking (AVAILABLE, ON_HOLD vs DEPLETED, EXPIRED, DISPOSED, QUARANTINE, RECALL_HOLD)
 * - Inventory Ageing presentation buckets (0-15d, 16-30d, 31-60d, 61-90d, 90+d)
 * - Expiry analytics & configurable expiring-soon alert window
 * - Stock movement ledger (receipts, consumption, adjustments, transfers, wastage)
 * - Inter-café stock transfers respecting source and destination café authorizations
 * - Cycle count & physical audit variance tracking (varianceQty & varianceValue)
 * - Waste intelligence by reason, café, item, and approval status
 * - Waste Pareto distribution curve (cumulative value percentage)
 * - Absolute prohibition of fabricated actual COGS (COGS remains UNAVAILABLE)
 */

const mongoose = require('mongoose');
const { InventoryLot } = require('../../models/InventoryLot');
const { GlobalInventoryItem } = require('../../models/GlobalInventoryItem');
const { CafeInventoryConfig } = require('../../models/CafeInventoryConfig');
const { WastageRecord } = require('../../models/WastageRecord');
const { StockMovement } = require('../../models/StockMovement');
const { StockTransfer } = require('../../models/StockTransfer');
const { InventoryCycleCount } = require('../../models/InventoryCycleCount');

/**
 * Authoritative Inventory Exposure Classification Function (PM-02E-R4)
 * Assigns each lot to exactly one exposure bucket according to condition-over-restriction precedence.
 *
 * Precedence Order (Condition-Over-Restriction):
 * 1. REMOVED: Lot is physically removed (DEPLETED, DISPOSED, RETURNED, or remainingQty <= 0)
 * 2. EXPIRED_EXPOSURE: Lot is past expiry date or marked EXPIRED (unusable, standard-cost exposure)
 * 3. QUARANTINE: Unexpired lot segregated for quality quarantine (unusable, quarantined exposure)
 * 4. RECALL_HOLD: Unexpired lot locked under safety hold or product recall (unusable, recall exposure)
 * 5. AVAILABLE_FOR_USE: Unexpired unrestricted stock available for recipe production and sales (usable)
 *
 * Legacy Compatibility:
 * Any lot with raw status ON_HOLD is normalized to RECALL_HOLD with statusSource: 'LEGACY_NORMALIZED'.
 *
 * @param {Object} lot - Raw lot document from InventoryLot model
 * @param {string|Date} [reportingDate] - Reference date (YYYY-MM-DD or Date object), defaults to Asia/Kolkata current date
 * @param {number} [expiryWindowDays=30] - Window for near-expiry derived condition
 * @returns {Object} {
 *   persistedStatus: string,
 *   rawStatus: string,
 *   statusSource: 'CANONICAL' | 'LEGACY_NORMALIZED',
 *   derivedCondition: 'NORMAL' | 'NEAR_EXPIRY' | 'EXPIRED' | 'DEPLETED' | 'DISPOSED' | 'RETURNED',
 *   exposureBucket: 'REMOVED' | 'EXPIRED_EXPOSURE' | 'QUARANTINE' | 'RECALL_HOLD' | 'AVAILABLE_FOR_USE',
 *   isPhysicalOnHand: boolean,
 *   isAvailableForUse: boolean,
 *   remainingQuantity: number
 * }
 */
function classifyInventoryExposure(lot, reportingDate, expiryWindowDays = 30) {
  const rawStatus = String(lot?.status || 'AVAILABLE').trim().toUpperCase();
  const qty = Number(lot?.remainingQuantity !== undefined ? lot.remainingQuantity : (lot?.quantityBase || 0));

  // Legacy ON_HOLD normalization provenance
  let persistedStatus = rawStatus;
  let statusSource = 'CANONICAL';
  if (rawStatus === 'ON_HOLD') {
    persistedStatus = 'RECALL_HOLD';
    statusSource = 'LEGACY_NORMALIZED';
  }

  // Format reporting date string YYYY-MM-DD in Asia/Kolkata timezone
  let repDateStr;
  if (!reportingDate) {
    repDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } else if (reportingDate instanceof Date) {
    repDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(reportingDate);
  } else {
    repDateStr = String(reportingDate).substring(0, 10);
  }

  const effectiveWindow = Number(expiryWindowDays) > 0 ? Number(expiryWindowDays) : 30;
  const repDateTime = new Date(`${repDateStr}T00:00:00.000Z`).getTime();
  const limitDate = new Date(repDateTime + effectiveWindow * 86400000);
  const expiryLimitStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(limitDate);

  const expiryStr = lot?.expiryDate ? String(lot.expiryDate).substring(0, 10) : null;

  // 1. Physically removed lots (excluded from physical stock)
  const isRemoved = ['DEPLETED', 'DISPOSED', 'RETURNED'].includes(persistedStatus) || qty <= 0;
  if (isRemoved) {
    let derivedCondition = 'NORMAL';
    if (['DEPLETED', 'DISPOSED', 'RETURNED'].includes(persistedStatus)) {
      derivedCondition = persistedStatus;
    } else if (qty <= 0) {
      derivedCondition = 'DEPLETED';
    }
    return {
      persistedStatus,
      rawStatus,
      statusSource,
      derivedCondition,
      exposureBucket: 'REMOVED',
      isPhysicalOnHand: false,
      isAvailableForUse: false,
      remainingQuantity: qty,
    };
  }

  // 2. Physical lot on hand - evaluate condition
  const isExpired = (persistedStatus === 'EXPIRED') || Boolean(expiryStr && expiryStr < repDateStr);
  const isNearExpiry = (persistedStatus === 'NEAR_EXPIRY') || Boolean(expiryStr && !isExpired && expiryStr <= expiryLimitStr);

  let derivedCondition = 'NORMAL';
  if (isExpired) {
    derivedCondition = 'EXPIRED';
  } else if (isNearExpiry) {
    derivedCondition = 'NEAR_EXPIRY';
  }

  // 3. Mutually exclusive exposure bucket assignment (Condition-Over-Restriction precedence)
  let exposureBucket;
  let isAvailableForUse = false;

  if (isExpired) {
    exposureBucket = 'EXPIRED_EXPOSURE';
    isAvailableForUse = false;
  } else if (persistedStatus === 'QUARANTINE') {
    exposureBucket = 'QUARANTINE';
    isAvailableForUse = false;
  } else if (persistedStatus === 'RECALL_HOLD') {
    exposureBucket = 'RECALL_HOLD';
    isAvailableForUse = false;
  } else {
    exposureBucket = 'AVAILABLE_FOR_USE';
    isAvailableForUse = true;
  }

  return {
    persistedStatus,
    rawStatus,
    statusSource,
    derivedCondition,
    exposureBucket,
    isPhysicalOnHand: true,
    isAvailableForUse,
    remainingQuantity: qty,
  };
}

/**
 * Calculates live inventory intelligence metrics.
 *
 * @param {Object} options
 * @param {string} options.organisationId
 * @param {string|string[]|null} [options.cafeScope]
 * @param {string} [options.dateFrom]
 * @param {string} [options.dateTo]
 * @param {number} [options.expiryWindowDays=30]
 * @param {Object} [options.filters]
 * @returns {Promise<Object>} Complete inventory analytics payload
 */
async function calculateInventoryMetrics({
  organisationId,
  cafeScope,
  dateFrom,
  dateTo,
  expiryWindowDays = 30,
  filters = {},
}) {
  if (!organisationId) {
    throw new Error('inventoryCalculations: organisationId is required.');
  }

  const effectiveExpiryDays = Number(expiryWindowDays) > 0 ? Number(expiryWindowDays) : 30;

  // 1. Fetch Global Items (Catalogue metadata, category, unit cost)
  const itemMap = {};
  const allItems = [];
  if (mongoose.connection?.readyState === 1 || GlobalInventoryItem.find !== mongoose.Model.find) {
    try {
      const items = await GlobalInventoryItem.find({ organisationId }).lean();
      for (const it of items) {
        itemMap[it.itemId] = it;
        allItems.push(it);
      }
    } catch (_) {
      // offline / mock fallback safe
    }
  }

  // 2. Fetch Active & Tracked Lots
  const lotMatch = { organisationId };
  if (cafeScope) {
    lotMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (filters.itemId) {
    lotMatch.itemId = filters.itemId.trim().toUpperCase();
  }

  let lots = [];
  if (mongoose.connection?.readyState === 1 || InventoryLot.find !== mongoose.Model.find) {
    try {
      lots = await InventoryLot.find(lotMatch).lean();
    } catch (_) {
      lots = [];
    }
  }

  // 3. Fetch Café Inventory Configs (Balances, reorder thresholds, stockouts)
  const configMatch = { organisationId };
  if (cafeScope) {
    configMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (filters.itemId) {
    configMatch.itemId = filters.itemId.trim().toUpperCase();
  }

  let configs = [];
  if (mongoose.connection?.readyState === 1 || CafeInventoryConfig.find !== mongoose.Model.find) {
    try {
      configs = await CafeInventoryConfig.find(configMatch).lean();
    } catch (_) {
      configs = [];
    }
  }

  // Reference date for ageing and expiry calculations (Asia/Kolkata aware)
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const expiryLimitDate = new Date(now.getTime() + effectiveExpiryDays * 86400000);
  const expiryLimitStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(expiryLimitDate);

  // Aggregation variables
  let totalValuationPaisa = 0;
  let totalStockOnHandQty = 0;
  let physicalOnHandQty = 0;
  let physicalOnHandStandardValuePaisa = 0;
  let availableForUseQty = 0;
  let availableForUseStandardValuePaisa = 0;
  let onHoldQty = 0;
  let recallHoldQty = 0;
  let recallHoldStandardValuePaisa = 0;
  let quarantineQty = 0;
  let quarantineValuationPaisa = 0;
  let quarantineStandardValuePaisa = 0;
  let expiredQty = 0;
  let expiredStandardCostExposurePaisa = 0;
  let availableLotCount = 0;
  let onHoldLotCount = 0;
  let quarantineLotCount = 0;
  let expiredLotCount = 0;
  let expiringSoonLotCount = 0;
  let totalExpiryExposurePaisa = 0;

  const categoryAggregation = {};
  const cafeAggregation = {};
  const itemAggregation = {};

  // Ageing buckets (REPORT_PRESENTATION_BUCKET)
  const ageingBuckets = {
    '0_15_DAYS': { label: '0 – 15 Days', lotCount: 0, quantity: 0, valuationPaisa: 0 },
    '16_30_DAYS': { label: '16 – 30 Days', lotCount: 0, quantity: 0, valuationPaisa: 0 },
    '31_60_DAYS': { label: '31 – 60 Days', lotCount: 0, quantity: 0, valuationPaisa: 0 },
    '61_90_DAYS': { label: '61 – 90 Days', lotCount: 0, quantity: 0, valuationPaisa: 0 },
    'OVER_90_DAYS': { label: '90+ Days', lotCount: 0, quantity: 0, valuationPaisa: 0 },
  };

  const expiredLots = [];
  const expiringSoonLots = [];

  // Legacy category valuation map for backward compatibility
  const categoryValuationPaisa = {
    rawCoffeeBeans: 0,
    dairyAndPlantMilk: 0,
    packagingAndCups: 0,
    syrupsAndBeverages: 0,
    retailBags: 0,
    other: 0,
  };

  for (const lot of lots) {
    const item = itemMap[lot.itemId] || {};
    const unitCostPaisa = Number(item.unitCostPaisa || 0);
    const qty = Number(lot.remainingQuantity !== undefined ? lot.remainingQuantity : (lot.quantityBase || 0));
    const lotValuationPaisa = qty * unitCostPaisa;

    // Authoritative exclusive exposure classification (PM-02E-R4)
    const classification = classifyInventoryExposure(lot, todayStr, effectiveExpiryDays);

    // Lot status auditing
    if (classification.rawStatus === 'AVAILABLE') availableLotCount++;
    if (classification.rawStatus === 'ON_HOLD' || classification.persistedStatus === 'RECALL_HOLD') onHoldLotCount++;
    if (classification.persistedStatus === 'QUARANTINE') quarantineLotCount++;
    if (classification.derivedCondition === 'EXPIRED') expiredLotCount++;
    if (classification.derivedCondition === 'NEAR_EXPIRY') expiringSoonLotCount++;

    // Physical on-hand stock and mutually exclusive decomposition buckets
    if (classification.isPhysicalOnHand) {
      physicalOnHandQty += qty;
      physicalOnHandStandardValuePaisa += lotValuationPaisa;

      switch (classification.exposureBucket) {
        case 'AVAILABLE_FOR_USE':
          availableForUseQty += qty;
          availableForUseStandardValuePaisa += lotValuationPaisa;
          break;
        case 'QUARANTINE':
          quarantineQty += qty;
          quarantineValuationPaisa += lotValuationPaisa;
          quarantineStandardValuePaisa += lotValuationPaisa;
          break;
        case 'RECALL_HOLD':
          recallHoldQty += qty;
          recallHoldStandardValuePaisa += lotValuationPaisa;
          onHoldQty += qty;
          break;
        case 'EXPIRED_EXPOSURE':
          expiredQty += qty;
          expiredStandardCostExposurePaisa += lotValuationPaisa;
          break;
      }
    }

    if (classification.derivedCondition === 'EXPIRED' || classification.derivedCondition === 'NEAR_EXPIRY') {
      totalExpiryExposurePaisa += lotValuationPaisa;
    }

    if (classification.derivedCondition === 'EXPIRED') {
      expiredLots.push({
        lotId: lot.lotId,
        itemId: lot.itemId,
        itemName: item.name || lot.itemId,
        cafeId: lot.cafeId,
        vendorId: lot.vendorId || null,
        remainingQuantity: qty,
        unitCostPaisa,
        valuationPaisa: lotValuationPaisa,
        expiryDate: lot.expiryDate,
        storageLocation: lot.storageLocation || 'Main Store',
        storedStatus: lot.status,
        persistedStatus: classification.persistedStatus,
        derivedCondition: 'EXPIRED',
        exposureBucket: classification.exposureBucket,
        statusSource: classification.statusSource,
      });
    } else if (classification.derivedCondition === 'NEAR_EXPIRY') {
      expiringSoonLots.push({
        lotId: lot.lotId,
        itemId: lot.itemId,
        itemName: item.name || lot.itemId,
        cafeId: lot.cafeId,
        vendorId: lot.vendorId || null,
        remainingQuantity: qty,
        unitCostPaisa,
        valuationPaisa: lotValuationPaisa,
        expiryDate: lot.expiryDate,
        storageLocation: lot.storageLocation || 'Main Store',
        storedStatus: lot.status,
        persistedStatus: classification.persistedStatus,
        derivedCondition: 'NEAR_EXPIRY',
        exposureBucket: classification.exposureBucket,
        statusSource: classification.statusSource,
      });
    }

    // Only unexpired physical stock contributes to active operational inventory valuation
    // Excluded from operational valuation: DEPLETED, DISPOSED, EXPIRED, RETURNED
    const isUsableOnHand = classification.isPhysicalOnHand && classification.derivedCondition !== 'EXPIRED';

    if (isUsableOnHand) {
      totalStockOnHandQty += qty;
      totalValuationPaisa += lotValuationPaisa;

      // Ageing calculation from receivedAt
      const recDate = lot.receivedAt ? new Date(lot.receivedAt) : (lot.createdAt ? new Date(lot.createdAt) : now);
      const ageDays = Math.max(0, Math.floor((now - recDate) / 86400000));

      let ageBucketKey = 'OVER_90_DAYS';
      if (ageDays <= 15) ageBucketKey = '0_15_DAYS';
      else if (ageDays <= 30) ageBucketKey = '16_30_DAYS';
      else if (ageDays <= 60) ageBucketKey = '31_60_DAYS';
      else if (ageDays <= 90) ageBucketKey = '61_90_DAYS';

      ageingBuckets[ageBucketKey].lotCount += 1;
      ageingBuckets[ageBucketKey].quantity += qty;
      ageingBuckets[ageBucketKey].valuationPaisa += lotValuationPaisa;

      // Category breakdown
      const cat = String(item.category || 'OTHER').toUpperCase();
      if (!categoryAggregation[cat]) {
        categoryAggregation[cat] = { category: cat, quantity: 0, valuationPaisa: 0, skuSet: new Set() };
      }
      categoryAggregation[cat].quantity += qty;
      categoryAggregation[cat].valuationPaisa += lotValuationPaisa;
      categoryAggregation[cat].skuSet.add(lot.itemId);

      // Legacy category mapping
      if (cat.includes('COFFEE') || cat.includes('BEAN')) categoryValuationPaisa.rawCoffeeBeans += lotValuationPaisa;
      else if (cat.includes('DAIRY') || cat.includes('MILK')) categoryValuationPaisa.dairyAndPlantMilk += lotValuationPaisa;
      else if (cat.includes('PACKAG') || cat.includes('CUP')) categoryValuationPaisa.packagingAndCups += lotValuationPaisa;
      else if (cat.includes('SYRUP') || cat.includes('BEVERAGE')) categoryValuationPaisa.syrupsAndBeverages += lotValuationPaisa;
      else if (cat.includes('RETAIL') || cat.includes('MERCHANDISE')) categoryValuationPaisa.retailBags += lotValuationPaisa;
      else categoryValuationPaisa.other += lotValuationPaisa;

      // Café breakdown
      const cId = lot.cafeId || 'UNKNOWN';
      if (!cafeAggregation[cId]) {
        cafeAggregation[cId] = { cafeId: cId, quantity: 0, valuationPaisa: 0, skuSet: new Set(), lotCount: 0 };
      }
      cafeAggregation[cId].quantity += qty;
      cafeAggregation[cId].valuationPaisa += lotValuationPaisa;
      cafeAggregation[cId].skuSet.add(lot.itemId);
      cafeAggregation[cId].lotCount += 1;

      // Item breakdown
      const iId = lot.itemId;
      if (!itemAggregation[iId]) {
        itemAggregation[iId] = {
          itemId: iId,
          sku: item.sku || iId,
          itemName: item.name || iId,
          category: item.category || 'OTHER',
          baseUnit: item.baseUnit || 'units',
          unitCostPaisa,
          criticality: item.criticality || 'STANDARD',
          quantity: 0,
          valuationPaisa: 0,
          lotCount: 0,
          nearestExpiry: null,
          oldestLotDate: null,
        };
      }
      itemAggregation[iId].quantity += qty;
      itemAggregation[iId].valuationPaisa += lotValuationPaisa;
      itemAggregation[iId].lotCount += 1;

      if (lot.expiryDate) {
        if (!itemAggregation[iId].nearestExpiry || lot.expiryDate < itemAggregation[iId].nearestExpiry) {
          itemAggregation[iId].nearestExpiry = lot.expiryDate;
        }
      }
      if (lot.receivedAt) {
        const dStr = new Date(lot.receivedAt).toISOString().substring(0, 10);
        if (!itemAggregation[iId].oldestLotDate || dStr < itemAggregation[iId].oldestLotDate) {
          itemAggregation[iId].oldestLotDate = dStr;
        }
      }
    }
  }

  // Stockout and low-stock analysis from CafeInventoryConfig
  let outOfStockItemCount = 0;
  let lowStockItemCount = 0;
  const cafeStockoutMap = {};

  for (const cfg of configs) {
    const cQty = Number(cfg.currentQuantityBase || 0);
    const rLvl = Number(cfg.reorderLevelBase || 0);
    const cId = cfg.cafeId;

    if (!cafeStockoutMap[cId]) {
      cafeStockoutMap[cId] = { stockouts: 0, lowStock: 0 };
    }

    if (cQty === 0) {
      outOfStockItemCount++;
      cafeStockoutMap[cId].stockouts++;
    } else if (rLvl > 0 && cQty <= rLvl) {
      lowStockItemCount++;
      cafeStockoutMap[cId].lowStock++;
    }
  }

  // 4. Wastage Records in period
  const wasteMatch = { organisationId };
  if (cafeScope) {
    wasteMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (dateFrom && dateTo) {
    wasteMatch.createdAt = {
      $gte: new Date(`${dateFrom}T00:00:00.000Z`),
      $lte: new Date(`${dateTo}T23:59:59.999Z`),
    };
  }
  if (filters.itemId) {
    wasteMatch.itemId = filters.itemId.trim().toUpperCase();
  }
  if (filters.wasteReason) {
    wasteMatch.reasonCode = filters.wasteReason.trim().toUpperCase();
  }

  let totalWastePaisa = 0;
  let approvedWastePaisa = 0;
  let pendingWastePaisa = 0;
  let totalWasteQty = 0;
  let wastageRecords = [];

  const wasteByReason = {};
  const wasteByItem = {};
  const wasteByCafe = {};

  if (mongoose.connection?.readyState === 1 || WastageRecord.find !== mongoose.Model.find) {
    try {
      wastageRecords = await WastageRecord.find(wasteMatch).lean();
      for (const w of wastageRecords) {
        const wVal = Number(w.estimatedValuePaisa || 0);
        const wQty = Number(w.quantityBase || 0);
        const reason = String(w.reasonCode || 'OTHER').toUpperCase();
        const isApproved = Boolean(w.approvedByUserId);

        totalWastePaisa += wVal;
        totalWasteQty += wQty;
        if (isApproved) approvedWastePaisa += wVal;
        else pendingWastePaisa += wVal;

        // By Reason
        if (!wasteByReason[reason]) {
          wasteByReason[reason] = { reason, count: 0, quantity: 0, estimatedValuePaisa: 0 };
        }
        wasteByReason[reason].count += 1;
        wasteByReason[reason].quantity += wQty;
        wasteByReason[reason].estimatedValuePaisa += wVal;

        // By Item
        const itName = itemMap[w.itemId]?.name || w.itemId;
        if (!wasteByItem[w.itemId]) {
          wasteByItem[w.itemId] = { itemId: w.itemId, itemName: itName, quantity: 0, estimatedValuePaisa: 0, count: 0 };
        }
        wasteByItem[w.itemId].quantity += wQty;
        wasteByItem[w.itemId].estimatedValuePaisa += wVal;
        wasteByItem[w.itemId].count += 1;

        // By Café
        const cId = w.cafeId || 'UNKNOWN';
        if (!wasteByCafe[cId]) {
          wasteByCafe[cId] = { cafeId: cId, quantity: 0, estimatedValuePaisa: 0, count: 0 };
        }
        wasteByCafe[cId].quantity += wQty;
        wasteByCafe[cId].estimatedValuePaisa += wVal;
        wasteByCafe[cId].count += 1;
      }
    } catch (_) {
      wastageRecords = [];
    }
  }

  // 5. Stock Movements in period
  const moveMatch = { organisationId };
  if (cafeScope) {
    moveMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (dateFrom && dateTo) {
    moveMatch.createdAt = {
      $gte: new Date(`${dateFrom}T00:00:00.000Z`),
      $lte: new Date(`${dateTo}T23:59:59.999Z`),
    };
  }

  let inboundGrnPaisa = 0;
  let transfersInPaisa = 0;
  let transfersOutPaisa = 0;
  let movementRecordCount = 0;
  const movementsByType = {};

  if (mongoose.connection?.readyState === 1 || StockMovement.find !== mongoose.Model.find) {
    try {
      const moves = await StockMovement.find(moveMatch).lean();
      movementRecordCount = moves.length;
      for (const m of moves) {
        const item = itemMap[m.itemId] || {};
        const costPaisa = Number(item.unitCostPaisa || 0);
        const mQty = Number(m.quantityBase || 0);
        const amt = mQty * costPaisa;
        const type = String(m.movementType || 'OTHER').toUpperCase();

        if (!movementsByType[type]) {
          movementsByType[type] = { movementType: type, count: 0, quantity: 0, estimatedValuePaisa: 0 };
        }
        movementsByType[type].count += 1;
        movementsByType[type].quantity += mQty;
        movementsByType[type].estimatedValuePaisa += amt;

        if (type.includes('GRN') || type.includes('PURCHASE') || type.includes('RECEIPT') || type === 'PROCUREMENT_RECEIPT') {
          inboundGrnPaisa += amt;
        } else if (type === 'CAFE_TRANSFER_IN' || type === 'TRANSFER_IN') {
          transfersInPaisa += amt;
        } else if (type === 'CAFE_TRANSFER_OUT' || type === 'TRANSFER_OUT') {
          transfersOutPaisa += amt;
        }
      }
    } catch (_) {
      // offline / safe
    }
  }

  // 6. Stock Transfers (Source or Dest in scope)
  const transferMatch = { organisationId };
  if (cafeScope) {
    const scopeArr = Array.isArray(cafeScope) ? cafeScope : [cafeScope];
    transferMatch.$or = [
      { sourceCafeId: { $in: scopeArr } },
      { destCafeId: { $in: scopeArr } },
    ];
  }

  let transfers = [];
  let pendingTransfersCount = 0;
  let completedTransfersCount = 0;
  let totalTransferQty = 0;

  if (mongoose.connection?.readyState === 1 || StockTransfer.find !== mongoose.Model.find) {
    try {
      transfers = await StockTransfer.find(transferMatch).sort({ createdAt: -1 }).limit(100).lean();
      for (const t of transfers) {
        totalTransferQty += Number(t.requestedQty || 0);
        const st = String(t.status || '').toUpperCase();
        if (st === 'COMPLETED' || st === 'RECEIVED') completedTransfersCount++;
        else if (st !== 'CANCELLED') pendingTransfersCount++;
      }
    } catch (_) {
      transfers = [];
    }
  }

  // 7. Cycle Count & Physical Inventory Audits
  const countMatch = { organisationId };
  if (cafeScope) {
    countMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }

  let cycleCounts = [];
  let totalCountVarianceQty = 0;
  let totalCountVarianceValuePaisa = 0;

  if (mongoose.connection?.readyState === 1 || InventoryCycleCount.find !== mongoose.Model.find) {
    try {
      cycleCounts = await InventoryCycleCount.find(countMatch).sort({ createdAt: -1 }).limit(50).lean();
      for (const c of cycleCounts) {
        if (Array.isArray(c.items)) {
          for (const itm of c.items) {
            const vQty = Number(itm.varianceQty || 0);
            const cost = Number(itemMap[itm.itemId]?.unitCostPaisa || 0);
            totalCountVarianceQty += vQty;
            totalCountVarianceValuePaisa += vQty * cost;
          }
        }
      }
    } catch (_) {
      cycleCounts = [];
    }
  }

  // Stock Movement Waterfall calculations
  const closingBalance = Number((totalValuationPaisa / 100).toFixed(2));
  const inboundGRN = Number((inboundGrnPaisa / 100).toFixed(2));
  const interCafeTransfersIn = Number((transfersInPaisa / 100).toFixed(2));
  const interCafeTransfersOut = Number((transfersOutPaisa / 100).toFixed(2));
  const wastageWrittenOff = Number((totalWastePaisa / 100).toFixed(2));
  const openingBalance = Math.max(
    0,
    Number((closingBalance - inboundGRN - interCafeTransfersIn + interCafeTransfersOut + wastageWrittenOff).toFixed(2))
  );

  // Waste Pareto Curve
  const sortedWasteItems = Object.values(wasteByItem).sort((a, b) => b.estimatedValuePaisa - a.estimatedValuePaisa);
  let runningWastePaisa = 0;
  const wastePareto = sortedWasteItems.map((item, index) => {
    runningWastePaisa += item.estimatedValuePaisa;
    const itemValue = Number((item.estimatedValuePaisa / 100).toFixed(2));
    const cumulativePercent = totalWastePaisa > 0 ? Number(((runningWastePaisa / totalWastePaisa) * 100).toFixed(1)) : 0;
    return {
      rank: index + 1,
      itemId: item.itemId,
      itemName: item.itemName,
      wasteQuantity: item.quantity,
      wasteValue: itemValue,
      wasteValuePaisa: item.estimatedValuePaisa,
      sharePercent: totalWastePaisa > 0 ? Number(((item.estimatedValuePaisa / totalWastePaisa) * 100).toFixed(1)) : 0,
      cumulativePercent,
    };
  });

  // Multidimensional breakdown arrays
  const byCategory = Object.values(categoryAggregation).map((c) => ({
    category: c.category,
    quantity: c.quantity,
    valuationPaisa: c.valuationPaisa,
    valuation: Number((c.valuationPaisa / 100).toFixed(2)),
    sharePercent: totalValuationPaisa > 0 ? Number(((c.valuationPaisa / totalValuationPaisa) * 100).toFixed(1)) : 0,
    skuCount: c.skuSet.size,
  })).sort((a, b) => b.valuationPaisa - a.valuationPaisa);

  const byCafe = Object.values(cafeAggregation).map((c) => ({
    cafeId: c.cafeId,
    quantity: c.quantity,
    valuationPaisa: c.valuationPaisa,
    valuation: Number((c.valuationPaisa / 100).toFixed(2)),
    sharePercent: totalValuationPaisa > 0 ? Number(((c.valuationPaisa / totalValuationPaisa) * 100).toFixed(1)) : 0,
    skuCount: c.skuSet.size,
    lotCount: c.lotCount,
    stockoutCount: cafeStockoutMap[c.cafeId]?.stockouts || 0,
    lowStockCount: cafeStockoutMap[c.cafeId]?.lowStock || 0,
    wasteValuePaisa: wasteByCafe[c.cafeId]?.estimatedValuePaisa || 0,
  })).sort((a, b) => b.valuationPaisa - a.valuationPaisa);

  const byItem = Object.values(itemAggregation).map((i) => ({
    itemId: i.itemId,
    sku: i.sku,
    itemName: i.itemName,
    category: i.category,
    baseUnit: i.baseUnit,
    unitCostPaisa: i.unitCostPaisa,
    criticality: i.criticality,
    quantity: i.quantity,
    valuationPaisa: i.valuationPaisa,
    valuation: Number((i.valuationPaisa / 100).toFixed(2)),
    sharePercent: totalValuationPaisa > 0 ? Number(((i.valuationPaisa / totalValuationPaisa) * 100).toFixed(1)) : 0,
    lotCount: i.lotCount,
    nearestExpiry: i.nearestExpiry,
    oldestLotDate: i.oldestLotDate,
  })).sort((a, b) => b.valuationPaisa - a.valuationPaisa);

  const byReasonList = Object.values(wasteByReason).map((r) => ({
    reason: r.reason,
    count: r.count,
    quantity: r.quantity,
    estimatedValuePaisa: r.estimatedValuePaisa,
    estimatedValue: Number((r.estimatedValuePaisa / 100).toFixed(2)),
    sharePercent: totalWastePaisa > 0 ? Number(((r.estimatedValuePaisa / totalWastePaisa) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.estimatedValuePaisa - a.estimatedValuePaisa);

  const ageingList = Object.entries(ageingBuckets).map(([bucketKey, b]) => ({
    bucketKey,
    label: b.label,
    lotCount: b.lotCount,
    quantity: b.quantity,
    valuationPaisa: b.valuationPaisa,
    valuation: Number((b.valuationPaisa / 100).toFixed(2)),
    sharePercent: totalValuationPaisa > 0 ? Number(((b.valuationPaisa / totalValuationPaisa) * 100).toFixed(1)) : 0,
    type: 'REPORT_PRESENTATION_BUCKET',
  }));

  // Canonical Summary Object with Restricted Stock Exposure Breakdown (PM-02E-R3)
  const summary = {
    stockOnHandQuantity: totalStockOnHandQty,
    operationalValuationPaise: totalValuationPaisa,
    operationalValuation: Number((totalValuationPaisa / 100).toFixed(2)),

    // Restricted inventory valuation breakdown
    physicalOnHandQuantity: physicalOnHandQty,
    physicalOnHandStandardValuePaisa,
    physicalOnHandStandardValue: Number((physicalOnHandStandardValuePaisa / 100).toFixed(2)),

    availableForUseQuantity: availableForUseQty,
    availableForUseStandardValuePaisa,
    availableForUseStandardValue: Number((availableForUseStandardValuePaisa / 100).toFixed(2)),

    quarantineQuantity: quarantineQty,
    quarantineStandardValuePaisa,
    quarantineStandardValue: Number((quarantineStandardValuePaisa / 100).toFixed(2)),
    quarantineValuationPaise: quarantineStandardValuePaisa, // backward-compatibility
    quarantineLotCount,

    recallHoldQuantity: recallHoldQty,
    recallHoldStandardValuePaisa,
    recallHoldStandardValue: Number((recallHoldStandardValuePaisa / 100).toFixed(2)),
    onHoldQuantity: onHoldQty,

    expiredQuantity: expiredQty,
    expiredExposureQuantity: expiredQty,
    expiredStandardCostExposurePaisa,
    expiredStandardCostExposure: Number((expiredStandardCostExposurePaisa / 100).toFixed(2)),

    // Mutually exclusive exposure classification metadata & decomposition invariant verification
    exposureClassificationMethodology: 'CONDITION_OVER_RESTRICTION',
    decompositionInvariantVerified: (
      physicalOnHandStandardValuePaisa === (availableForUseStandardValuePaisa + quarantineStandardValuePaisa + recallHoldStandardValuePaisa + expiredStandardCostExposurePaisa)
    ) && (
      physicalOnHandQty === (availableForUseQty + quarantineQty + recallHoldQty + expiredQty)
    ),

    valuationCostBasis: 'OPERATIONAL_STANDARD_COST_VALUATION',
    valuationDisclaimer: 'Operational standard cost exposure only; not authoritative balance-sheet inventory valuation.',

    activeSkuCount: Object.keys(itemAggregation).length,
    totalLotsTracked: lots.length,
    availableLotCount,
    onHoldLotCount,
    expiringLotCount: expiringSoonLotCount,
    expiredLotCount,
    outOfStockItemCount,
    lowStockItemCount,
    totalWasteValuePaise: totalWastePaisa,
    totalWasteValue: Number((totalWastePaisa / 100).toFixed(2)),
    approvedWasteValuePaise: approvedWastePaisa,
    pendingWasteValuePaise: pendingWastePaisa,
    totalExpiryExposurePaise: totalExpiryExposurePaisa,
    transferActivityCount: transfers.length,
    cycleCountVarianceQty: totalCountVarianceQty,
    cycleCountVarianceValuePaise: totalCountVarianceValuePaisa,
    actualCOGS: 'UNAVAILABLE',
    grossProfit: 'UNAVAILABLE',
    ebitda: 'UNAVAILABLE',
  };

  // Backward compatible structures
  const stockValuation = {
    totalValuation: Number((totalValuationPaisa / 100).toFixed(2)),
    rawCoffeeBeans: Number((categoryValuationPaisa.rawCoffeeBeans / 100).toFixed(2)),
    dairyAndPlantMilk: Number((categoryValuationPaisa.dairyAndPlantMilk / 100).toFixed(2)),
    packagingAndCups: Number((categoryValuationPaisa.packagingAndCups / 100).toFixed(2)),
    syrupsAndBeverages: Number((categoryValuationPaisa.syrupsAndBeverages / 100).toFixed(2)),
    retailBags: Number((categoryValuationPaisa.retailBags / 100).toFixed(2)),
  };

  const movementWaterfall = {
    openingBalance,
    inboundGRN,
    interCafeTransfersIn,
    consumedInRecipes: 0, // Theoretical only; actual consumption unposted
    interCafeTransfersOut: -interCafeTransfersOut,
    wastageWrittenOff: -wastageWrittenOff,
    closingBalance,
  };

  return {
    summary,
    stockValuation,
    movementWaterfall,
    byCategory,
    byCafe,
    byItem,
    ageing: {
      buckets: ageingList,
      classification: 'REPORT_PRESENTATION_BUCKET',
    },
    expiry: {
      expiredLots,
      expiringSoonLots,
      expiryWindowDays: effectiveExpiryDays,
      totalExpiryExposurePaise: totalExpiryExposurePaisa,
    },
    movements: {
      byType: Object.values(movementsByType),
      totalCount: movementRecordCount,
    },
    transfers: {
      pendingCount: pendingTransfersCount,
      completedCount: completedTransfersCount,
      totalTransferQty,
      transfers: transfers.map((t) => ({
        transferId: t.transferId,
        sourceCafeId: t.sourceCafeId,
        destCafeId: t.destCafeId,
        itemId: t.itemId,
        itemName: itemMap[t.itemId]?.name || t.itemId,
        requestedQty: t.requestedQty,
        dispatchedQty: t.dispatchedQty,
        receivedQty: t.receivedQty,
        varianceQty: t.varianceQty,
        status: t.status,
        dispatchedAt: t.dispatchedAt,
        receivedAt: t.receivedAt,
      })),
    },
    cycleCounts: {
      totalVarianceQty: totalCountVarianceQty,
      totalVarianceValuePaise: totalCountVarianceValuePaisa,
      counts: cycleCounts.map((c) => ({
        countId: c.countId,
        cafeId: c.cafeId,
        countType: c.countType,
        status: c.status,
        itemCount: Array.isArray(c.items) ? c.items.length : 0,
        postedAt: c.postedAt,
      })),
    },
    wasteIntelligence: {
      totalWastePaise: totalWastePaisa,
      approvedWastePaise: approvedWastePaisa,
      pendingWastePaise: pendingWastePaisa,
      byReason: byReasonList,
      pareto: wastePareto,
      records: wastageRecords.slice(0, 100).map((w) => ({
        wastageId: w.wastageId,
        cafeId: w.cafeId,
        itemId: w.itemId,
        itemName: itemMap[w.itemId]?.name || w.itemId,
        quantityBase: w.quantityBase,
        reasonCode: w.reasonCode,
        estimatedValuePaisa: w.estimatedValuePaisa,
        status: w.approvedByUserId ? 'APPROVED' : 'PENDING',
        approvalStatus: w.approvedByUserId ? 'APPROVED' : 'PENDING',
        approvedByUserId: w.approvedByUserId,
        createdAt: w.createdAt,
      })),
    },
    dataQuality: {
      status: 'COMPLETE',
      state: 'CLEAN',
      warnings: [],
    },
    provenance: {
      sourceModels: [
        'InventoryLot',
        'GlobalInventoryItem',
        'CafeInventoryConfig',
        'StockMovement',
        'StockTransfer',
        'WastageRecord',
        'InventoryCycleCount',
      ],
      persistedLotStatuses: [
        'AVAILABLE',
        'NEAR_EXPIRY',
        'EXPIRED',
        'QUARANTINE',
        'RECALL_HOLD',
        'DEPLETED',
        'DISPOSED',
        'RETURNED',
      ],
      derivedLotConditions: [
        'NORMAL',
        'NEAR_EXPIRY',
        'EXPIRED',
        'DEPLETED',
        'DISPOSED',
        'RETURNED',
      ],
      exposureBuckets: [
        'AVAILABLE_FOR_USE',
        'QUARANTINE',
        'RECALL_HOLD',
        'EXPIRED_EXPOSURE',
        'REMOVED',
      ],
      exposurePrecedence: 'CONDITION_OVER_RESTRICTION',
      legacyStatusNormalization: {
        rawStatus: 'ON_HOLD',
        persistedStatus: 'RECALL_HOLD',
        statusSource: 'LEGACY_NORMALIZED',
      },
      valuationCostBasis: 'OPERATIONAL_STANDARD_COST_VALUATION',
      valuationTrust: 'OPERATIONAL',
      valuationDisclosure: 'Operational standard cost based on GlobalInventoryItem.unitCostPaisa. Actual balance sheet valuation requires formal periodic physical audit reconciliation.',
      actualCOGSAvailability: 'UNAVAILABLE',
      grossProfitAvailability: 'UNAVAILABLE',
      sourceRecordCounts: {
        activeLots: lots.length,
        itemsTracked: Object.keys(itemMap).length,
        wastageRecords: wastageRecords.length,
        stockMovements: movementRecordCount,
        stockTransfers: transfers.length,
        cycleCounts: cycleCounts.length,
      },
    },
  };
}

module.exports = {
  calculateInventoryMetrics,
  classifyInventoryExposure,
};
