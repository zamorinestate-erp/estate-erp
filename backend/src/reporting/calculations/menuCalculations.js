'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: menuCalculations.js (PM-02D)
 * 
 * Authoritative Menu Engineering & Theoretical Costing Engine:
 * - Line-item sales aggregation (Bill.lineItems)
 * - Bill penetration & category sales shares
 * - Theoretical Recipe Cost calculation via Recipe BOM & GlobalInventoryItem unit costs
 * - Estimated Contribution & Estimated Contribution % (ESTIMATED only)
 * - Boston Box Quadrants (STAR, PLOWHORSE, PUZZLE, DOG, UNCLASSIFIED)
 * - Dataset-relative configurable thresholds (average units & average unit contribution)
 * - Price history auditing & sales velocity tracking
 * - Strict COGS guardrail: Actual COGS remains UNAVAILABLE; zero forbidden actual-margin terms
 * - Unmapped & archived items preservation
 */

const mongoose = require('mongoose');
const { Bill } = require('../../models/Bill');
const { MenuItem } = require('../../models/MenuItem');
const { Recipe } = require('../../models/Recipe');
const { GlobalInventoryItem } = require('../../models/GlobalInventoryItem');

/**
 * Calculates live menu performance, theoretical recipe costs, and engineering matrix.
 *
 * @param {Object} options
 * @param {string} options.organisationId
 * @param {string|string[]|null} [options.cafeScope]
 * @param {string} options.dateFrom
 * @param {string} options.dateTo
 * @param {Object} [options.filters]
 * @returns {Promise<Object>} Menu performance, quadrants, thresholds, and data quality
 */

/**
 * Formats a costAsOf timestamp into a clean, human-readable date/time in Asia/Kolkata (IST).
 * @param {string|Date|null} timestamp
 * @returns {string|null}
 */
function formatCostAsOf(timestamp) {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || d.getDate();
    const month = parts.find(p => p.type === 'month')?.value || 'Sep';
    const year = parts.find(p => p.type === 'year')?.value || d.getFullYear();
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${day} ${month} ${year} ${hour}:${minute} IST`;
  } catch (_) {
    return d.toISOString();
  }
}

/**
 * Builds user-facing theoretical costing notice with safe costAsOf disclosure.
 * Prevents dangling 'as of .' strings.
 * @param {string|Date|null} timestamp
 * @returns {string}
 */
function buildTheoreticalCostingNotice(timestamp) {
  const formatted = formatCostAsOf(timestamp);
  if (formatted) {
    return `Historical ingredient-cost reconstruction unavailable; estimated contribution uses current standard ingredient cost as of ${formatted}.`;
  }
  return 'Historical ingredient-cost reconstruction unavailable; estimated contribution uses current standard ingredient cost. Cost timestamp unavailable.';
}

async function calculateMenuMetrics({ organisationId, cafeScope, dateFrom, dateTo, filters = {} }) {
  if (!organisationId) {
    throw new Error('menuCalculations: organisationId is required.');
  }

  const billMatch = {
    organisationId,
    status: { $in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
  };

  if (cafeScope) {
    billMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (dateFrom && dateTo) {
    billMatch.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  }
  if (filters.cafeId && (!cafeScope || (Array.isArray(cafeScope) && cafeScope.includes(filters.cafeId)) || cafeScope === filters.cafeId)) {
    billMatch.cafeId = filters.cafeId;
  }

  // 1. Fetch all matching bills
  let bills = [];
  if (mongoose.connection?.readyState === 1 || Bill.find !== mongoose.Model.find) {
    try {
      bills = await Bill.find(billMatch).lean();
    } catch (_) {
      bills = [];
    }
  }

  const totalBillsCount = bills.length;

  // 2. Fetch MenuItems, Recipes, and GlobalInventoryItems
  let menuItems = [];
  let recipes = [];
  let inventoryItems = [];

  if (mongoose.connection?.readyState === 1 || MenuItem.find !== mongoose.Model.find) {
    try {
      const invQuery = GlobalInventoryItem.find({ organisationId });
      const invPromise = typeof invQuery?.select === 'function'
        ? invQuery.select('itemId unitCostPaisa baseUnit').lean()
        : (typeof invQuery?.lean === 'function' ? invQuery.lean() : invQuery);

      const recipeQuery = Recipe.find({ organisationId });
      const recipePromise = typeof recipeQuery?.lean === 'function' ? recipeQuery.lean() : recipeQuery;

      const menuQuery = MenuItem.find({ organisationId });
      const menuPromise = typeof menuQuery?.lean === 'function' ? menuQuery.lean() : menuQuery;

      [menuItems, recipes, inventoryItems] = await Promise.all([
        menuPromise,
        recipePromise,
        invPromise,
      ]);
    } catch (_) {
      menuItems = [];
      recipes = [];
      inventoryItems = [];
    }
  }

  // Build Lookup Dictionaries
  const menuItemMap = {};
  for (const it of menuItems) {
    if (it.menuItemId) menuItemMap[it.menuItemId.toUpperCase()] = it;
    if (it._id) menuItemMap[String(it._id).toUpperCase()] = it;
    if (it.name) menuItemMap[it.name.toLowerCase()] = it;
  }

  const recipeMap = {};
  for (const r of recipes) {
    if (r.recipeId) recipeMap[r.recipeId.toUpperCase()] = r;
    if (r._id) recipeMap[String(r._id).toUpperCase()] = r;
  }

  const invItemMap = {};
  for (const inv of inventoryItems) {
    if (inv.itemId) invItemMap[inv.itemId.toUpperCase()] = inv;
    if (inv.inventoryItemId) invItemMap[inv.inventoryItemId.toUpperCase()] = inv;
    if (inv._id) invItemMap[String(inv._id).toUpperCase()] = inv;
  }

  // 3. Aggregate Line Items from Bills
  const rawItemAgg = {};
  let totalUnitsAll = 0;
  let totalGrossRevenuePaisaAll = 0;
  let totalNetRevenuePaisaAll = 0;

  for (const bill of bills) {
    const lineItems = Array.isArray(bill.lineItems) ? bill.lineItems : [];
    const seenItemsInBill = new Set();

    for (const li of lineItems) {
      const rawItemId = (li.menuItemId || '').trim().toUpperCase();
      const rawName = li.itemNameSnapshot || li.itemName || li.name || 'Unnamed Item';
      const key = rawItemId || rawName;

      const qty = Number(li.quantity || 1);
      const unitPrice = Number(li.unitPricePaisa || li.pricePaisa || 0);
      const disc = Number(li.discountPaisa || 0);
      const subtotal = Number(li.lineSubtotalPaisa !== undefined ? li.lineSubtotalPaisa : (li.subtotalPaisa !== undefined ? li.subtotalPaisa : Math.max(0, unitPrice * qty - disc)));
      const gross = li.grossPaisa !== undefined ? Number(li.grossPaisa) : (unitPrice > 0 ? unitPrice * qty : subtotal);

      if (!rawItemAgg[key]) {
        rawItemAgg[key] = {
          itemId: rawItemId || 'UNMAPPED',
          name: rawName,
          quantity: 0,
          grossRevenuePaisa: 0,
          netRevenuePaisa: 0,
          discountPaisa: 0,
          billCount: 0,
          cafes: new Set(),
        };
      }

      rawItemAgg[key].quantity += qty;
      rawItemAgg[key].grossRevenuePaisa += gross;
      rawItemAgg[key].netRevenuePaisa += subtotal;
      rawItemAgg[key].discountPaisa += disc;
      if (bill.cafeId) rawItemAgg[key].cafes.add(bill.cafeId);

      if (!seenItemsInBill.has(key)) {
        rawItemAgg[key].billCount += 1;
        seenItemsInBill.add(key);
      }

      totalUnitsAll += qty;
      totalGrossRevenuePaisaAll += gross;
      totalNetRevenuePaisaAll += subtotal;
    }
  }

  // 4. Calculate Theoretical Recipe Costs for Each Item
  const performanceList = [];
  let totalTheoreticalCogsAllPaisa = 0;
  let calculableItemsCount = 0;
  let totalCalculableUnits = 0;
  let totalCalculableContributionPaisa = 0;

  for (const [key, agg] of Object.entries(rawItemAgg)) {
    const masterItem = menuItemMap[agg.itemId] || menuItemMap[agg.name.toLowerCase()] || {};
    const category = masterItem.category || 'OTHER';
    const primaryRecipeId = (masterItem.primaryRecipeId || masterItem.recipeId) ? (masterItem.primaryRecipeId || masterItem.recipeId).toUpperCase() : null;
    const deductionBaseQty = Number(masterItem.recipeDeductionBaseQuantity || 1);

    // Calculate theoretical recipe cost if recipe exists
    let unitTheoreticalCostPaisa = null;
    let recipeCostStatus = 'UNAVAILABLE';

    if (primaryRecipeId && recipeMap[primaryRecipeId]) {
      const recipe = recipeMap[primaryRecipeId];
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

      if (ingredients.length > 0) {
        let totalBatchRawCostPaisa = 0;
        let allIngredientsResolved = true;

        for (const ing of ingredients) {
          const invId = (ing.inventoryItemId || ing.itemId) ? (ing.inventoryItemId || ing.itemId).toUpperCase() : null;
          const invItem = invId ? invItemMap[invId] : null;
          const unitCost = invItem ? Number(invItem.unitCostPaisa || 0) : 0;
          const ingQty = Number(ing.quantity || 0);
          const lossFactor = Number(ing.lossFactorPercent || 0);

          if (!invItem && !ing.isOptional) {
            allIngredientsResolved = false;
          }

          const ingCost = ingQty * (1 + lossFactor / 100) * unitCost;
          totalBatchRawCostPaisa += ingCost;
        }

        if (allIngredientsResolved && totalBatchRawCostPaisa > 0) {
          const prepLoss = Number(recipe.preparationLossPercent || 0);
          const totalBatchCost = totalBatchRawCostPaisa * (1 + prepLoss / 100);
          const batchYield = Number(recipe.batchYield || 1);
          const portionCost = totalBatchCost / batchYield;
          unitTheoreticalCostPaisa = Math.round(portionCost * deductionBaseQty);
          recipeCostStatus = 'THEORETICAL_AVAILABLE';
        } else if (!allIngredientsResolved) {
          recipeCostStatus = 'INGREDIENT_COST_MISSING';
        }
      } else {
        recipeCostStatus = 'RECIPE_NO_INGREDIENTS';
      }
    } else if (!primaryRecipeId) {
      recipeCostStatus = 'RECIPE_NOT_CONFIGURED';
    } else {
      recipeCostStatus = 'RECIPE_NOT_FOUND';
    }

    // Contribution Calculations (Safe against zero net sales)
    let theoreticalCogsPaisa = null;
    let estimatedContributionPaisa = null;
    let estimatedContributionPercent = null;
    let unitEstimatedContributionPaisa = null;

    if (unitTheoreticalCostPaisa !== null) {
      theoreticalCogsPaisa = unitTheoreticalCostPaisa * agg.quantity;
      estimatedContributionPaisa = agg.netRevenuePaisa - theoreticalCogsPaisa;
      estimatedContributionPercent = agg.netRevenuePaisa > 0
        ? Number(((estimatedContributionPaisa / agg.netRevenuePaisa) * 100).toFixed(1))
        : null;
      unitEstimatedContributionPaisa = agg.quantity > 0
        ? Math.round(estimatedContributionPaisa / agg.quantity)
        : 0;

      totalTheoreticalCogsAllPaisa += theoreticalCogsPaisa;
      calculableItemsCount += 1;
      totalCalculableUnits += agg.quantity;
      totalCalculableContributionPaisa += estimatedContributionPaisa;
    }

    const billPenetration = totalBillsCount > 0 ? Number(((agg.billCount / totalBillsCount) * 100).toFixed(1)) : 0;
    const salesSharePercent = totalNetRevenuePaisaAll > 0 ? Number(((agg.netRevenuePaisa / totalNetRevenuePaisaAll) * 100).toFixed(1)) : 0;

    performanceList.push({
      itemId: agg.itemId,
      item: agg.name,
      name: agg.name,
      itemName: agg.name,
      category,
      quantity: agg.quantity,
      unitsSold: agg.quantity,
      revenue: Number((agg.grossRevenuePaisa / 100).toFixed(2)),
      grossRevenuePaisa: agg.grossRevenuePaisa,
      netRevenue: Number((agg.netRevenuePaisa / 100).toFixed(2)),
      netSalesPaisa: agg.netRevenuePaisa,
      discountPaisa: agg.discountPaisa,
      billCount: agg.billCount,
      billPenetration,
      salesSharePercent,
      // Theoretical Costing
      unitTheoreticalCostPaisa,
      unitTheoreticalCost: unitTheoreticalCostPaisa !== null ? Number((unitTheoreticalCostPaisa / 100).toFixed(2)) : null,
      theoreticalCogsPaisa,
      theoreticalCostPaise: theoreticalCogsPaisa,
      theoreticalCogs: theoreticalCogsPaisa !== null ? Number((theoreticalCogsPaisa / 100).toFixed(2)) : null,
      cogs: theoreticalCogsPaisa !== null ? Number((theoreticalCogsPaisa / 100).toFixed(2)) : null, // backward compatibility
      // Estimated Contribution
      estimatedContributionPaisa,
      estimatedContributionPaise: estimatedContributionPaisa,
      estimatedContribution: estimatedContributionPaisa !== null ? Number((estimatedContributionPaisa / 100).toFixed(2)) : null,
      estimatedContributionPercent,
      marginPct: estimatedContributionPercent, // backward compatibility
      unitEstimatedContributionPaisa,
      unitEstimatedContribution: unitEstimatedContributionPaisa !== null ? Number((unitEstimatedContributionPaisa / 100).toFixed(2)) : null,
      // Actuality & Metadata
      actuality: 'ESTIMATED',
      costBasis: 'THEORETICAL_COGS_CURRENT_STANDARD',
      recipeBasis: 'CURRENT_RECIPE_ESTIMATE',
      ingredientCostBasis: 'CURRENT_STANDARD_COST',
      costAsOf: new Date().toISOString(),
      historicalCostAvailability: 'UNAVAILABLE',
      recipeHistoryAvailability: 'UNAVAILABLE',
      recipeCostStatus,
      priceHistory: masterItem.priceHistory || [],
      cafesSoldIn: Array.from(agg.cafes),
    });
  }

  // 5. Dataset-Relative Thresholds for Quadrants (Standard Arithmetic Means across items)
  const distinctItemsSold = performanceList.length;
  const totalUnitsSold = performanceList.reduce((acc, it) => acc + it.quantity, 0);
  const popularityCutoffUnits = distinctItemsSold > 0 ? (totalUnitsSold / distinctItemsSold) : 0;

  // Contribution Threshold: arithmetic mean across eligible items with valid theoretical recipe cost
  const calculableItems = performanceList.filter(it => it.unitTheoreticalCostPaisa !== null && it.unitEstimatedContributionPaisa !== null);
  const calculableCount = calculableItems.length;
  const sumUnitContributionPaisa = calculableItems.reduce((acc, it) => acc + (it.unitEstimatedContributionPaisa || 0), 0);
  const contributionCutoffUnitPaisa = calculableCount > 0 ? Math.round(sumUnitContributionPaisa / calculableCount) : 0;

  // 6. Assign Menu Engineering Quadrants
  for (const item of performanceList) {
    if (item.unitTheoreticalCostPaisa === null || item.estimatedContributionPaisa === null) {
      item.quadrant = 'UNCLASSIFIED';
      item.class = 'Unclassified (Theoretical Cost Unavailable)';
    } else {
      const isHighPopularity = item.quantity >= popularityCutoffUnits;
      const isHighContribution = (item.unitEstimatedContributionPaisa || 0) >= contributionCutoffUnitPaisa;

      if (isHighPopularity && isHighContribution) {
        item.quadrant = 'STAR';
        item.class = 'Star (High Volume / High Contribution)';
      } else if (isHighPopularity && !isHighContribution) {
        item.quadrant = 'PLOWHORSE';
        item.class = 'Plowhorse (High Volume / Low Contribution)';
      } else if (!isHighPopularity && isHighContribution) {
        item.quadrant = 'PUZZLE';
        item.class = 'Puzzle (Low Volume / High Contribution)';
      } else {
        item.quadrant = 'DOG';
        item.class = 'Dog (Low Volume / Low Contribution)';
      }
    }
  }

  // Sort by net sales descending
  performanceList.sort((a, b) => b.netSalesPaisa - a.netSalesPaisa);

  // 7. Calculate Duration in Days for Velocity
  let daysInPeriod = 1;
  if (dateFrom && dateTo) {
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    const diffTime = Math.abs(d2 - d1);
    daysInPeriod = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }

  const velocityList = performanceList.map((it) => ({
    itemId: it.itemId,
    name: it.name,
    category: it.category,
    totalUnits: it.quantity,
    unitsPerDay: Number((it.quantity / daysInPeriod).toFixed(2)),
    netSales: it.netRevenue,
    quadrant: it.quadrant,
  }));

  const thresholdMethodology = `Dataset-relative arithmetic mean: Popularity cut-off = average ${popularityCutoffUnits.toFixed(1)} units sold; Contribution cut-off = arithmetic mean ₹${(contributionCutoffUnitPaisa / 100).toFixed(2)} estimated unit contribution.`;
  const costAsOfTimestamp = new Date().toISOString();
  const theoreticalCostingNotice = buildTheoreticalCostingNotice(costAsOfTimestamp);

  const quadrants = {
    STAR: performanceList.filter(it => it.quadrant === 'STAR'),
    PLOWHORSE: performanceList.filter(it => it.quadrant === 'PLOWHORSE'),
    PUZZLE: performanceList.filter(it => it.quadrant === 'PUZZLE'),
    DOG: performanceList.filter(it => it.quadrant === 'DOG'),
    UNCLASSIFIED: performanceList.filter(it => it.quadrant === 'UNCLASSIFIED'),
  };

  const engineering = {
    items: performanceList,
    summary: {
      totalUnitsSold: totalUnitsAll,
      totalGrossRevenuePaisa: totalGrossRevenuePaisaAll,
      totalNetRevenuePaisa: totalNetRevenuePaisaAll,
      totalTheoreticalCogsPaisa: totalTheoreticalCogsAllPaisa,
      totalEstimatedContributionPaisa: totalCalculableContributionPaisa,
      overallEstimatedContributionPercent: totalNetRevenuePaisaAll > 0
        ? Number(((totalCalculableContributionPaisa / totalNetRevenuePaisaAll) * 100).toFixed(1))
        : null,
    },
  };

  return {
    engineering,
    quadrants,
    menuPerformance: performanceList,
    items: performanceList,
    totalItemsTracked: performanceList.length,
    calculableItemsCount,
    unclassifiedItemsCount: performanceList.length - calculableItemsCount,
    unmappedItems: performanceList.filter(it => it.quadrant === 'UNCLASSIFIED'),
    priceHistory: performanceList.flatMap(it => it.priceHistory || []),
    salesVelocity: velocityList,
    thresholds: {
      popularityCutoffUnits: Number(popularityCutoffUnits.toFixed(1)),
      contributionCutoffUnitPaisa,
      contributionCutoffUnitInr: Number((contributionCutoffUnitPaisa / 100).toFixed(2)),
      methodology: 'DATASET_RELATIVE_ITEM_MEAN',
      methodVersion: '1.0.0',
      description: thresholdMethodology,
      distinctItemsCount: distinctItemsSold,
      calculableItemCount: calculableCount,
    },
    velocity: velocityList,
    summary: {
      totalUnitsSold: totalUnitsAll,
      totalGrossRevenuePaisa: totalGrossRevenuePaisaAll,
      totalNetRevenuePaisa: totalNetRevenuePaisaAll,
      totalTheoreticalCogsPaisa: totalTheoreticalCogsAllPaisa,
      totalEstimatedContributionPaisa: totalCalculableContributionPaisa,
      overallEstimatedContributionPercent: totalNetRevenuePaisaAll > 0
        ? Number(((totalCalculableContributionPaisa / totalNetRevenuePaisaAll) * 100).toFixed(1))
        : null,
    },
    costBasis: 'THEORETICAL_COGS_CURRENT_STANDARD',
    costAsOf: costAsOfTimestamp,
    actuality: 'ESTIMATED',
    historicalCostAvailability: 'UNAVAILABLE',
    recipeHistoryAvailability: 'UNAVAILABLE',
    recipeBasis: 'CURRENT_RECIPE_ESTIMATE',
    ingredientCostBasis: 'CURRENT_STANDARD_COST',
    theoreticalCostingNotice,
    dataQuality: {
      status: calculableItemsCount < performanceList.length ? 'PARTIAL' : 'COMPLETE',
      warnings: [
        theoreticalCostingNotice,
        'CURRENT_RECIPE_ESTIMATE',
        'ACTUAL_COGS_UNAVAILABLE',
        ...(calculableItemsCount < performanceList.length ? ['SOME_ITEMS_MISSING_THEORETICAL_RECIPE_COST'] : []),
      ],
      actuality: 'ESTIMATED',
      costBasis: 'THEORETICAL_COGS_CURRENT_STANDARD',
      historicalCostAvailability: 'UNAVAILABLE',
      recipeHistoryAvailability: 'UNAVAILABLE',
    },
    provenance: {
      sourceModels: ['Bill', 'MenuItem', 'Recipe', 'GlobalInventoryItem'],
      menuEngineeringMethod: 'DATASET_RELATIVE_ITEM_MEAN',
      methodVersion: '1.0.0',
      recipeVersion: 1,
      recipeBasis: 'CURRENT_RECIPE_ESTIMATE',
      ingredientCostBasis: 'CURRENT_STANDARD_COST',
      costBasis: 'THEORETICAL_COGS_CURRENT_STANDARD',
      costAsOf: costAsOfTimestamp,
      historicalCostAvailability: 'UNAVAILABLE',
      recipeHistoryAvailability: 'UNAVAILABLE',
      missingIngredientCount: performanceList.filter(i => i.recipeCostStatus === 'INGREDIENT_COST_MISSING').length,
      unmappedRecipeCount: performanceList.filter(i => i.recipeCostStatus === 'RECIPE_NOT_CONFIGURED' || i.recipeCostStatus === 'RECIPE_NOT_FOUND').length,
      sourceRecordCounts: {
        distinctItemsSold: performanceList.length,
        itemsWithTheoreticalCost: calculableItemsCount,
        unclassifiedItems: performanceList.length - calculableItemsCount,
        billsAnalyzed: totalBillsCount,
      },
      metricVersions: {
        THEORETICAL_COGS: '1.0.0',
        ESTIMATED_CONTRIBUTION: '1.0.0',
        ESTIMATED_CONTRIBUTION_PERCENT: '1.0.0',
      },
    },
  };
}

module.exports = {
  calculateMenuMetrics,
  formatCostAsOf,
  buildTheoreticalCostingNotice,
};
