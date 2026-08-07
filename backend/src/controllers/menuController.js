'use strict';

/**
 * MENU CONTROLLER
 *
 * Implements:
 *   - Catalogue listing and item details (MASTER, OWNER, CAFE_ADMIN, STAFF)
 *   - Item creation and updates (MASTER)
 *   - Price history updates (MASTER)
 */

const {
  MenuItem,
  MENU_CATEGORIES,
} = require('../models/MenuItem');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * GET /menu/items
 * List menu items (filterable by cafeId, category, status, search).
 */
const listMenuItems = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 50, 200);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, category, status } = request.query;

  if (cafeId) {
    filter.availableCafeIds = normalizeId(cafeId);
  }
  if (category && MENU_CATEGORIES.includes(category.toUpperCase())) {
    filter.category = category.toUpperCase();
  }
  if (status) {
    filter.status = normalizeId(status);
  } else if (request.auth.role !== 'MASTER') {
    filter.status = 'ACTIVE';
  }

  const [items, total] = await Promise.all([
    MenuItem.find(filter)
      .select('-__v -version -nameLower')
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MenuItem.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /menu/items/:menuItemId
 */
const getMenuItem = asyncHandler(async (request, response) => {
  const menuItemId = normalizeId(request.params.menuItemId);
  if (!menuItemId) {
    throw new ApiError(400, 'INVALID_ID', 'Valid menuItemId is required.');
  }

  const item = await MenuItem.findOne({
    menuItemId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version -nameLower').lean();

  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Menu item not found.');
  }

  return response.status(200).json({
    success: true,
    data: { item },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /menu/items
 * Create menu item (MASTER ONLY).
 */
const createMenuItem = asyncHandler(async (request, response) => {
  const {
    name,
    category,
    description,
    currentPricePaisa,
    taxRatePercent,
    isTaxInclusive,
    inventoryItemId,
    recipeDeductionBaseQuantity,
    availableCafeIds,
  } = request.body;

  const nameText = typeof name === 'string' ? name.trim() : '';
  if (!nameText) {
    throw new ApiError(400, 'NAME_REQUIRED', 'Menu item name is required.');
  }

  const normCat = normalizeId(category);
  if (!MENU_CATEGORIES.includes(normCat)) {
    throw new ApiError(400, 'INVALID_CATEGORY', `Category must be one of: ${MENU_CATEGORIES.join(', ')}.`);
  }

  const price = Number(currentPricePaisa);
  if (!Number.isInteger(price) || price < 0) {
    throw new ApiError(400, 'INVALID_PRICE', 'currentPricePaisa must be a non-negative integer (paisa).');
  }

  const duplicate = await MenuItem.findOne({
    organisationId: request.auth.organisationId,
    nameLower: nameText.toLowerCase(),
  }).lean();

  if (duplicate) {
    throw new ApiError(409, 'DUPLICATE_NAME', `A menu item named "${nameText}" already exists.`);
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'MENU_ITEM',
    prefix: 'MENU',
    minimumDigits: 4,
  });

  const item = new MenuItem({
    menuItemId: seqId,
    organisationId: request.auth.organisationId,
    name: nameText,
    nameLower: nameText.toLowerCase(),
    category: normCat,
    description: typeof description === 'string' ? description.trim() : '',
    currentPricePaisa: price,
    taxRatePercent: taxRatePercent !== undefined ? Math.max(0, Number(taxRatePercent) || 0) : 5,
    isTaxInclusive: isTaxInclusive !== undefined ? Boolean(isTaxInclusive) : true,
    inventoryItemId: inventoryItemId ? normalizeId(inventoryItemId) : null,
    recipeDeductionBaseQuantity: Math.max(0, Number(recipeDeductionBaseQuantity) || 1),
    availableCafeIds: Array.isArray(availableCafeIds) ? availableCafeIds : [],
    status: 'ACTIVE',
    priceHistory: [
      {
        pricePaisa: price,
        effectiveFrom: new Date(),
        changedByUserId: request.auth.userId,
        reason: 'Initial pricing on item creation',
      },
    ],
    createdByUserId: request.auth.userId,
  });

  await item.save();

  await recordRequestAudit({
    request,
    module: 'MENU',
    action: 'CREATE_MENU_ITEM',
    entityType: 'MENU_ITEM',
    entityId: seqId,
    after: { menuItemId: seqId, name: nameText, currentPricePaisa: price },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { item: item.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * PATCH /menu/items/:menuItemId
 * Update menu item fields and/or record price change.
 */
const updateMenuItem = asyncHandler(async (request, response) => {
  const menuItemId = normalizeId(request.params.menuItemId);
  const item = await MenuItem.findOne({
    menuItemId,
    organisationId: request.auth.organisationId,
  });

  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Menu item not found.');
  }

  const {
    name,
    category,
    description,
    currentPricePaisa,
    priceChangeReason,
    taxRatePercent,
    isTaxInclusive,
    inventoryItemId,
    recipeDeductionBaseQuantity,
    availableCafeIds,
    status,
  } = request.body;

  if (name !== undefined) {
    const nameText = String(name).trim();
    if (!nameText) throw new ApiError(400, 'NAME_REQUIRED', 'Name cannot be empty.');
    if (nameText.toLowerCase() !== item.nameLower) {
      const dup = await MenuItem.findOne({
        organisationId: request.auth.organisationId,
        nameLower: nameText.toLowerCase(),
        menuItemId: { $ne: menuItemId },
      }).lean();
      if (dup) throw new ApiError(409, 'DUPLICATE_NAME', `A menu item named "${nameText}" already exists.`);
      item.name = nameText;
      item.nameLower = nameText.toLowerCase();
    }
  }

  if (category !== undefined) {
    const cat = normalizeId(category);
    if (!MENU_CATEGORIES.includes(cat)) throw new ApiError(400, 'INVALID_CATEGORY', 'Invalid category.');
    item.category = cat;
  }

  if (description !== undefined) item.description = String(description).trim();
  if (taxRatePercent !== undefined) item.taxRatePercent = Math.max(0, Number(taxRatePercent) || 0);
  if (isTaxInclusive !== undefined) item.isTaxInclusive = Boolean(isTaxInclusive);
  if (inventoryItemId !== undefined) item.inventoryItemId = inventoryItemId ? normalizeId(inventoryItemId) : null;
  if (recipeDeductionBaseQuantity !== undefined) item.recipeDeductionBaseQuantity = Math.max(0, Number(recipeDeductionBaseQuantity) || 1);
  if (availableCafeIds !== undefined && Array.isArray(availableCafeIds)) item.availableCafeIds = availableCafeIds;
  if (status !== undefined) item.status = normalizeId(status);

  // Price change check
  if (currentPricePaisa !== undefined) {
    const newPrice = Number(currentPricePaisa);
    if (!Number.isInteger(newPrice) || newPrice < 0) {
      throw new ApiError(400, 'INVALID_PRICE', 'Price must be a non-negative integer (paisa).');
    }

    if (newPrice !== item.currentPricePaisa) {
      item.priceHistory.push({
        pricePaisa: newPrice,
        effectiveFrom: new Date(),
        changedByUserId: request.auth.userId,
        reason: priceChangeReason ? String(priceChangeReason).trim() : 'Price adjustment',
      });
      item.currentPricePaisa = newPrice;
    }
  }

  item.lastModifiedByUserId = request.auth.userId;
  await item.save();

  await recordRequestAudit({
    request,
    module: 'MENU',
    action: 'UPDATE_MENU_ITEM',
    entityType: 'MENU_ITEM',
    entityId: menuItemId,
    after: { menuItemId, name: item.name, price: item.currentPricePaisa },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { item: item.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
};
