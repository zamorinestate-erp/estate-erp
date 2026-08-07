'use strict';

/**
 * INVENTORY CONTROLLER
 *
 * Implements:
 *   - Global item catalogue management (MASTER)
 *   - Café inventory configuration (MASTER + CAFE_ADMIN for assigned cafés)
 *   - Stock movement recording (MASTER + CAFE_ADMIN for assigned cafés)
 *   - Stock balance queries
 *   - Reorder alerts
 *
 * Architecture:
 *   GlobalInventoryItem → CafeInventoryConfig → StockMovement (immutable)
 *
 * Security:
 *   Actor identity from request.auth only.
 *   Café scope enforced per-request: MASTER sees all; CAFE_ADMIN sees
 *   only their assignedCafeIds.
 *   Negative-stock control enforced before every deduction movement.
 *
 * Amounts / quantities:
 *   All quantities in the item's baseUnit.
 *   Conversion is a display concern only.
 *
 * IST dates:
 *   businessDate is always server-generated in Asia/Kolkata timezone.
 */

const {
  GlobalInventoryItem,
  ITEM_STATUSES,
  ITEM_CATEGORIES,
} = require('../models/GlobalInventoryItem');

const {
  CafeInventoryConfig,
  CAFE_ITEM_STATUSES,
} = require('../models/CafeInventoryConfig');

const {
  StockMovement,
  MOVEMENT_TYPES,
} = require('../models/StockMovement');

const {
  Cafe,
} = require('../models/Cafe');

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * Enforce café access. MASTER sees all; CAFE_ADMIN only their assigned cafés.
 */
function assertCafeAccess(request, cafeId) {
  if (request.auth.role === 'MASTER') return;
  if (!request.auth.assignedCafeIds.includes(cafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

// ── GLOBAL ITEM HANDLERS ─────────────────────────────────────────────────────

/**
 * GET /inventory/items
 * List global inventory items. MASTER sees all; others see ACTIVE only.
 */
const listItems = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };

  const { category, status, search } = request.query;

  // Non-Master roles can only see ACTIVE items.
  if (request.auth.role !== 'MASTER') {
    filter.status = 'ACTIVE';
  } else if (status && ITEM_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  if (category && ITEM_CATEGORIES.includes(category.toUpperCase())) {
    filter.category = category.toUpperCase();
  }

  if (search && typeof search === 'string' && search.trim()) {
    filter.$text = { $search: search.trim() };
  }

  const [items, total] = await Promise.all([
    GlobalInventoryItem.find(filter)
      .select('-__v -version -nameLower')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GlobalInventoryItem.countDocuments(filter),
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
 * GET /inventory/items/:itemId
 * Fetch a single global item.
 */
const getItem = asyncHandler(async (request, response) => {
  const itemId = normalizeId(request.params.itemId);
  if (!itemId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid item ID is required.');
  }

  const item = await GlobalInventoryItem.findOne({
    itemId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version -nameLower').lean();

  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Inventory item not found.');
  }

  // Non-Master cannot see archived items.
  if (request.auth.role !== 'MASTER' && item.status === 'ARCHIVED') {
    throw new ApiError(404, 'NOT_FOUND', 'Inventory item not found.');
  }

  return response.status(200).json({
    success: true,
    data: { item },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /inventory/items
 * Create a global inventory item. MASTER ONLY.
 * Propagates zero-quantity CafeInventoryConfig to all active cafés.
 */
const createItem = asyncHandler(async (request, response) => {
  const {
    name,
    category,
    description,
    baseUnit,
    unitConversions,
    availableForPOS,
    tags,
    notes,
  } = request.body;

  // ── Validate ─────────────────────────────────────────────────────────────
  const nameText = typeof name === 'string' ? name.trim() : '';
  if (!nameText) {
    throw new ApiError(400, 'NAME_REQUIRED', 'name is required.');
  }
  if (nameText.length > 200) {
    throw new ApiError(400, 'NAME_TOO_LONG', 'name must not exceed 200 characters.');
  }

  const normalizedCategory = normalizeId(category);
  if (!ITEM_CATEGORIES.includes(normalizedCategory)) {
    throw new ApiError(
      400, 'INVALID_CATEGORY',
      `category must be one of: ${ITEM_CATEGORIES.join(', ')}.`
    );
  }

  const baseUnitText = typeof baseUnit === 'string' ? baseUnit.trim().toLowerCase() : '';
  if (!baseUnitText) {
    throw new ApiError(400, 'BASE_UNIT_REQUIRED', 'baseUnit is required (e.g., ml, grams, pieces).');
  }

  // ── Duplicate detection ──────────────────────────────────────────────────
  const duplicate = await GlobalInventoryItem.findOne({
    organisationId: request.auth.organisationId,
    nameLower: nameText.toLowerCase(),
  }).lean();

  if (duplicate) {
    throw new ApiError(
      409,
      'DUPLICATE_ITEM_NAME',
      `An inventory item with the name "${nameText}" already exists.`
    );
  }

  // ── Generate ID ──────────────────────────────────────────────────────────
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'GLOBAL_INVENTORY_ITEM',
    prefix: 'ITEM',
    minimumDigits: 4,
  });

  // ── Create item ──────────────────────────────────────────────────────────
  const item = new GlobalInventoryItem({
    itemId: seqId,
    organisationId: request.auth.organisationId,
    name: nameText,
    nameLower: nameText.toLowerCase(),
    category: normalizedCategory,
    description: typeof description === 'string' ? description.trim().slice(0, 1000) : '',
    baseUnit: baseUnitText,
    unitConversions: Array.isArray(unitConversions) ? unitConversions : [],
    status: 'ACTIVE',
    availableForPOS: Boolean(availableForPOS),
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    notes: typeof notes === 'string' ? notes.trim().slice(0, 3000) : '',
    createdByUserId: request.auth.userId,
  });

  await item.save();

  // ── Propagate to all active cafés ────────────────────────────────────────
  const cafes = await Cafe.find({
    organisationId: request.auth.organisationId,
    status: 'ACTIVE',
  }).select('cafeId').lean();

  const cafeIds = cafes.map((c) => c.cafeId);
  if (cafeIds.length > 0) {
    await CafeInventoryConfig.seedForNewItem({
      organisationId: request.auth.organisationId,
      itemId: seqId,
      cafeIds,
    });
  }

  await recordRequestAudit({
    request,
    module: 'INVENTORY',
    action: 'CREATE_GLOBAL_ITEM',
    entityType: 'GLOBAL_INVENTORY_ITEM',
    entityId: seqId,
    after: { itemId: seqId, name: nameText, category: normalizedCategory, baseUnit: baseUnitText },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { item: item.toObject() },
    propagatedToCafes: cafeIds.length,
    correlationId: request.correlationId || null,
  });
});

/**
 * PATCH /inventory/items/:itemId
 * Update a global item's non-identity fields. MASTER ONLY.
 * Name changes check for duplicates.
 */
const updateItem = asyncHandler(async (request, response) => {
  const itemId = normalizeId(request.params.itemId);
  if (!itemId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid item ID is required.');
  }

  const item = await GlobalInventoryItem.findOne({
    itemId,
    organisationId: request.auth.organisationId,
  });

  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Inventory item not found.');
  }

  if (item.status === 'ARCHIVED') {
    throw new ApiError(409, 'ITEM_ARCHIVED', 'Archived items cannot be modified. Restore first.');
  }

  const {
    name,
    category,
    description,
    unitConversions,
    availableForPOS,
    tags,
    notes,
    status,
  } = request.body;

  const before = { name: item.name, category: item.category, status: item.status };

  // Name change — check for duplicates.
  if (name !== undefined) {
    const nameText = String(name).trim();
    if (!nameText) {
      throw new ApiError(400, 'NAME_REQUIRED', 'name must not be empty.');
    }
    if (nameText.toLowerCase() !== item.nameLower) {
      const duplicate = await GlobalInventoryItem.findOne({
        organisationId: request.auth.organisationId,
        nameLower: nameText.toLowerCase(),
        itemId: { $ne: itemId },
      }).lean();
      if (duplicate) {
        throw new ApiError(409, 'DUPLICATE_ITEM_NAME', `An item named "${nameText}" already exists.`);
      }
      item.name = nameText;
      item.nameLower = nameText.toLowerCase();
    }
  }

  if (category !== undefined) {
    const cat = normalizeId(category);
    if (!ITEM_CATEGORIES.includes(cat)) {
      throw new ApiError(400, 'INVALID_CATEGORY', `category must be one of: ${ITEM_CATEGORIES.join(', ')}.`);
    }
    item.category = cat;
  }

  if (description !== undefined) {
    item.description = String(description).trim().slice(0, 1000);
  }
  if (unitConversions !== undefined && Array.isArray(unitConversions)) {
    item.unitConversions = unitConversions;
  }
  if (availableForPOS !== undefined) {
    item.availableForPOS = Boolean(availableForPOS);
  }
  if (tags !== undefined && Array.isArray(tags)) {
    item.tags = tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (notes !== undefined) {
    item.notes = String(notes).trim().slice(0, 3000);
  }
  if (status !== undefined) {
    const normalizedStatus = normalizeId(status);
    if (!ITEM_STATUSES.includes(normalizedStatus)) {
      throw new ApiError(400, 'INVALID_STATUS', `status must be one of: ${ITEM_STATUSES.join(', ')}.`);
    }
    item.status = normalizedStatus;
  }

  item.lastModifiedByUserId = request.auth.userId;
  await item.save();

  await recordRequestAudit({
    request,
    module: 'INVENTORY',
    action: 'UPDATE_GLOBAL_ITEM',
    entityType: 'GLOBAL_INVENTORY_ITEM',
    entityId: itemId,
    before,
    after: { name: item.name, category: item.category, status: item.status },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { item: item.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /inventory/items/:itemId/archive
 * Archive a global item. MASTER ONLY. Requires reason.
 */
const archiveItem = asyncHandler(async (request, response) => {
  const itemId = normalizeId(request.params.itemId);
  if (!itemId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid item ID is required.');
  }

  const { reason } = request.body;
  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 5) {
    throw new ApiError(400, 'REASON_REQUIRED', 'A reason (minimum 5 characters) is required to archive an item.');
  }

  const item = await GlobalInventoryItem.findOne({
    itemId,
    organisationId: request.auth.organisationId,
  });

  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'Inventory item not found.');
  }
  if (item.status === 'ARCHIVED') {
    throw new ApiError(409, 'ALREADY_ARCHIVED', 'This item is already archived.');
  }

  item.status = 'ARCHIVED';
  item.archivedAt = new Date();
  item.archivedByUserId = request.auth.userId;
  item.archiveReason = reasonText;
  item.lastModifiedByUserId = request.auth.userId;

  await item.save();

  await recordRequestAudit({
    request,
    module: 'INVENTORY',
    action: 'ARCHIVE_GLOBAL_ITEM',
    entityType: 'GLOBAL_INVENTORY_ITEM',
    entityId: itemId,
    before: { status: 'ACTIVE' },
    after: { status: 'ARCHIVED', archiveReason: reasonText },
    reason: reasonText,
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { item: item.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ── CAFÉ STOCK HANDLERS ───────────────────────────────────────────────────────

/**
 * GET /inventory/cafes/:cafeId/stock
 * List all items and their stock levels for a café.
 */
const listCafeStock = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  if (!cafeId) {
    throw new ApiError(400, 'INVALID_CAFE_ID', 'A valid cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 50, 200);
  const skip = (page - 1) * limit;

  const filter = {
    organisationId: request.auth.organisationId,
    cafeId,
  };

  const { status } = request.query;
  if (status && CAFE_ITEM_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  const [configs, total] = await Promise.all([
    CafeInventoryConfig.find(filter)
      .select('-__v -version')
      .sort({ itemId: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CafeInventoryConfig.countDocuments(filter),
  ]);

  // Enrich with item names in one batch query.
  const itemIds = configs.map((c) => c.itemId);
  const items = await GlobalInventoryItem.find({
    organisationId: request.auth.organisationId,
    itemId: { $in: itemIds },
  }).select('itemId name category baseUnit').lean();

  const itemMap = {};
  for (const item of items) {
    itemMap[item.itemId] = item;
  }

  const enriched = configs.map((config) => ({
    ...config,
    item: itemMap[config.itemId] || null,
  }));

  return response.status(200).json({
    success: true,
    data: {
      cafeId,
      stock: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /inventory/cafes/:cafeId/stock/:itemId
 * Fetch stock details for a specific item at a café.
 */
const getCafeStockItem = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  const itemId = normalizeId(request.params.itemId);

  if (!cafeId || !itemId) {
    throw new ApiError(400, 'INVALID_ID', 'Valid cafeId and itemId are required.');
  }
  assertCafeAccess(request, cafeId);

  const config = await CafeInventoryConfig.findOne({
    organisationId: request.auth.organisationId,
    cafeId,
    itemId,
  }).select('-__v -version').lean();

  if (!config) {
    throw new ApiError(404, 'NOT_FOUND', 'No stock configuration found for this item at this café.');
  }

  const item = await GlobalInventoryItem.findOne({
    organisationId: request.auth.organisationId,
    itemId,
  }).select('itemId name category baseUnit unitConversions').lean();

  return response.status(200).json({
    success: true,
    data: { config, item },
    correlationId: request.correlationId || null,
  });
});

/**
 * PATCH /inventory/cafes/:cafeId/stock/:itemId/configure
 * Update thresholds, vendor preference, storage location for a café+item.
 * MASTER or CAFE_ADMIN (assigned café).
 */
const configureCafeStock = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  const itemId = normalizeId(request.params.itemId);

  if (!cafeId || !itemId) {
    throw new ApiError(400, 'INVALID_ID', 'Valid cafeId and itemId are required.');
  }
  assertCafeAccess(request, cafeId);

  const config = await CafeInventoryConfig.findOne({
    organisationId: request.auth.organisationId,
    cafeId,
    itemId,
  });

  if (!config) {
    throw new ApiError(404, 'NOT_FOUND', 'No stock configuration found for this item at this café.');
  }

  const {
    minimumQuantityBase,
    maximumQuantityBase,
    safetyStockBase,
    reorderLevelBase,
    reorderQuantityBase,
    negativeStockAllowed,
    availableAtPOS,
    preferredVendorId,
    storageLocation,
    status,
    notes,
  } = request.body;

  if (minimumQuantityBase !== undefined) config.minimumQuantityBase = Math.max(0, Number(minimumQuantityBase) || 0);
  if (maximumQuantityBase !== undefined) config.maximumQuantityBase = maximumQuantityBase === null ? null : Math.max(0, Number(maximumQuantityBase) || 0);
  if (safetyStockBase !== undefined) config.safetyStockBase = Math.max(0, Number(safetyStockBase) || 0);
  if (reorderLevelBase !== undefined) config.reorderLevelBase = Math.max(0, Number(reorderLevelBase) || 0);
  if (reorderQuantityBase !== undefined) config.reorderQuantityBase = Math.max(0, Number(reorderQuantityBase) || 0);
  if (negativeStockAllowed !== undefined) config.negativeStockAllowed = Boolean(negativeStockAllowed);
  if (availableAtPOS !== undefined) config.availableAtPOS = Boolean(availableAtPOS);
  if (preferredVendorId !== undefined) config.preferredVendorId = preferredVendorId ? normalizeId(preferredVendorId) : null;
  if (storageLocation !== undefined) config.storageLocation = String(storageLocation).trim().slice(0, 200);
  if (notes !== undefined) config.notes = String(notes).trim().slice(0, 2000);
  if (status !== undefined) {
    const s = normalizeId(status);
    if (!CAFE_ITEM_STATUSES.includes(s)) {
      throw new ApiError(400, 'INVALID_STATUS', `status must be one of: ${CAFE_ITEM_STATUSES.join(', ')}.`);
    }
    config.status = s;
  }

  config.lastModifiedByUserId = request.auth.userId;
  await config.save();

  await recordRequestAudit({
    request,
    module: 'INVENTORY',
    action: 'CONFIGURE_CAFE_STOCK',
    entityType: 'CAFE_INVENTORY_CONFIG',
    entityId: `${cafeId}::${itemId}`,
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { config: config.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ── STOCK MOVEMENT HANDLERS ───────────────────────────────────────────────────

/**
 * POST /inventory/cafes/:cafeId/movements
 * Record a stock movement.
 *
 * MASTER or CAFE_ADMIN (assigned café).
 * Atomically updates CafeInventoryConfig.currentQuantityBase.
 * Enforces negative-stock control.
 * Idempotency: rejects duplicate idempotencyKey.
 */
const recordMovement = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  if (!cafeId) {
    throw new ApiError(400, 'INVALID_CAFE_ID', 'A valid cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  const {
    itemId: rawItemId,
    movementType,
    quantityDelta: rawDelta,
    description,
    reason,
    sourceModule,
    sourceRecordId,
    partnerCafeId,
    idempotencyKey,
  } = request.body;

  const itemId = normalizeId(rawItemId);
  if (!itemId) {
    throw new ApiError(400, 'INVALID_ITEM_ID', 'itemId is required.');
  }

  const normalizedType = normalizeId(movementType);
  if (!MOVEMENT_TYPES.includes(normalizedType)) {
    throw new ApiError(400, 'INVALID_MOVEMENT_TYPE',
      `movementType must be one of: ${MOVEMENT_TYPES.join(', ')}.`);
  }

  const quantityDelta = Number(rawDelta);
  if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
    throw new ApiError(400, 'INVALID_QUANTITY',
      'quantityDelta must be a non-zero finite number (positive = inflow, negative = outflow).');
  }

  // ── Idempotency check ────────────────────────────────────────────────────
  if (idempotencyKey) {
    const existing = await StockMovement.findOne({
      organisationId: request.auth.organisationId,
      idempotencyKey: String(idempotencyKey).trim(),
    }).lean();
    if (existing) {
      return response.status(200).json({
        success: true,
        duplicate: true,
        data: { movement: existing },
        correlationId: request.correlationId || null,
      });
    }
  }

  // ── Fetch the café stock config ──────────────────────────────────────────
  const config = await CafeInventoryConfig.findOne({
    organisationId: request.auth.organisationId,
    cafeId,
    itemId,
  });

  if (!config) {
    throw new ApiError(404, 'STOCK_CONFIG_NOT_FOUND',
      'No stock configuration found for this item at this café. Ensure the item is seeded first.');
  }

  // ── Negative-stock control ───────────────────────────────────────────────
  const projectedBalance = config.currentQuantityBase + quantityDelta;
  if (!config.negativeStockAllowed && projectedBalance < 0) {
    throw new ApiError(409, 'INSUFFICIENT_STOCK',
      `Movement would result in negative stock (current: ${config.currentQuantityBase}, delta: ${quantityDelta}). ` +
      `Enable negativeStockAllowed on this item's café config to override.`);
  }

  // ── Generate movement ID ─────────────────────────────────────────────────
  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `STOCK_MOVEMENT_${datePart}`,
    prefix: `SMOV-${datePart}`,
    minimumDigits: 4,
  });

  // ── Create movement ──────────────────────────────────────────────────────
  const movement = new StockMovement({
    movementId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    itemId,
    movementType: normalizedType,
    quantityDelta,
    balanceBefore: config.currentQuantityBase,
    balanceAfter: projectedBalance,
    businessDate,
    serverTimestamp: new Date(),
    status: 'ACTIVE',
    sourceModule: sourceModule ? normalizeId(sourceModule) : null,
    sourceRecordId: sourceRecordId ? normalizeId(sourceRecordId) : null,
    partnerCafeId: partnerCafeId ? normalizeId(partnerCafeId) : null,
    description: typeof description === 'string' ? description.trim().slice(0, 1000) : '',
    reason: typeof reason === 'string' ? reason.trim().slice(0, 2000) : '',
    createdByUserId: request.auth.userId,
    createdByRole: request.auth.role,
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
    correlationId: request.correlationId || null,
  });

  await movement.save();

  // ── Atomic balance update ─────────────────────────────────────────────────
  await CafeInventoryConfig.findOneAndUpdate(
    {
      organisationId: request.auth.organisationId,
      cafeId,
      itemId,
    },
    {
      $inc: { currentQuantityBase: quantityDelta },
      $set: { lastModifiedByUserId: request.auth.userId },
    },
    { runValidators: false }
  );

  await recordRequestAudit({
    request,
    module: 'INVENTORY',
    action: 'RECORD_STOCK_MOVEMENT',
    entityType: 'STOCK_MOVEMENT',
    entityId: seqId,
    after: {
      movementId: seqId,
      cafeId,
      itemId,
      movementType: normalizedType,
      quantityDelta,
      balanceBefore: config.currentQuantityBase,
      balanceAfter: projectedBalance,
    },
    result: 'SUCCESS',
    riskClassification: Math.abs(quantityDelta) > 1000 ? 'MEDIUM' : 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { movement: movement.toObject(), balanceAfter: projectedBalance },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /inventory/cafes/:cafeId/movements
 * List stock movements for a café. Supports filtering by item, type, date range.
 */
const listMovements = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  if (!cafeId) {
    throw new ApiError(400, 'INVALID_CAFE_ID', 'A valid cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 50, 200);
  const skip = (page - 1) * limit;

  const filter = {
    organisationId: request.auth.organisationId,
    cafeId,
  };

  const { itemId, movementType, from, to, status } = request.query;

  if (itemId) filter.itemId = normalizeId(itemId);
  if (movementType && MOVEMENT_TYPES.includes(normalizeId(movementType))) {
    filter.movementType = normalizeId(movementType);
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    filter.businessDate = { ...filter.businessDate, $gte: from };
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    filter.businessDate = { ...filter.businessDate, $lte: to };
  }
  if (status) {
    filter.status = normalizeId(status);
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .select('-__v -version')
      .sort({ serverTimestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      cafeId,
      movements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /inventory/cafes/:cafeId/reorder-alerts
 * Return items at or below their reorder level.
 */
const getReorderAlerts = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  if (!cafeId) {
    throw new ApiError(400, 'INVALID_CAFE_ID', 'A valid cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  // Find items where current quantity <= reorder level (and reorder level > 0).
  const alerts = await CafeInventoryConfig.aggregate([
    {
      $match: {
        organisationId: request.auth.organisationId,
        cafeId,
        status: 'ACTIVE',
        reorderLevelBase: { $gt: 0 },
        $expr: { $lte: ['$currentQuantityBase', '$reorderLevelBase'] },
      },
    },
    {
      $lookup: {
        from: 'global_inventory_items',
        localField: 'itemId',
        foreignField: 'itemId',
        as: 'item',
      },
    },
    { $unwind: { path: '$item', preserveNullAndEmpty: true } },
    {
      $project: {
        _id: 0,
        itemId: 1,
        cafeId: 1,
        currentQuantityBase: 1,
        reorderLevelBase: 1,
        reorderQuantityBase: 1,
        minimumQuantityBase: 1,
        preferredVendorId: 1,
        'item.name': 1,
        'item.baseUnit': 1,
        'item.category': 1,
      },
    },
    { $sort: { currentQuantityBase: 1 } },
  ]);

  return response.status(200).json({
    success: true,
    data: { cafeId, alerts, count: alerts.length },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  archiveItem,
  listCafeStock,
  getCafeStockItem,
  configureCafeStock,
  recordMovement,
  listMovements,
  getReorderAlerts,
};
