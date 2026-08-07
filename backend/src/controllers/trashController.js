'use strict';

/**
 * TRASH CONTROLLER
 *
 * ABSOLUTE RESTRICTION: MASTER ONLY
 * Lists archived/soft-deleted items across modules for Master administrative restore.
 */

const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
const { Vendor } = require('../models/Vendor');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('../services/auditService');

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

const listTrashItems = asyncHandler(async (request, response) => {
  const orgId = request.auth.organisationId;

  const [archivedInventoryItems, archivedVendors] = await Promise.all([
    GlobalInventoryItem.find({ organisationId: orgId, status: 'ARCHIVED' })
      .select('itemId name category status archivedAt archiveReason')
      .lean(),
    Vendor.find({ organisationId: orgId, status: 'ARCHIVED' })
      .select('vendorId name category status statusChangedAt statusChangeReason')
      .lean(),
  ]);

  const items = [
    ...archivedInventoryItems.map((i) => ({ entityType: 'INVENTORY_ITEM', id: i.itemId, name: i.name, archivedAt: i.archivedAt, reason: i.archiveReason })),
    ...archivedVendors.map((v) => ({ entityType: 'VENDOR', id: v.vendorId, name: v.name, archivedAt: v.statusChangedAt, reason: v.statusChangeReason })),
  ];

  return response.status(200).json({
    success: true,
    data: { items, count: items.length },
    correlationId: request.correlationId || null,
  });
});

const restoreTrashItem = asyncHandler(async (request, response) => {
  const { entityType, entityId } = request.body;

  if (!entityType || !entityId) {
    throw new ApiError(400, 'MISSING_FIELDS', 'entityType and entityId are required.');
  }

  const normType = String(entityType).trim().toUpperCase();
  const normId = String(entityId).trim().toUpperCase();
  const orgId = request.auth.organisationId;

  let restoredName = '';

  if (normType === 'INVENTORY_ITEM') {
    const item = await GlobalInventoryItem.findOne({ organisationId: orgId, itemId: normId });
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item not found in trash.');
    item.status = 'ACTIVE';
    item.archivedAt = null;
    item.archivedByUserId = null;
    item.archiveReason = '';
    await item.save();
    restoredName = item.name;
  } else if (normType === 'VENDOR') {
    const vendor = await Vendor.findOne({ organisationId: orgId, vendorId: normId });
    if (!vendor) throw new ApiError(404, 'NOT_FOUND', 'Vendor not found in trash.');
    vendor.status = 'ACTIVE';
    vendor.statusChangedAt = null;
    vendor.statusChangeReason = '';
    await vendor.save();
    restoredName = vendor.name;
  } else {
    throw new ApiError(400, 'INVALID_ENTITY_TYPE', 'Unsupported entityType for restoration.');
  }

  await recordRequestAudit({
    request,
    module: 'TRASH_BIN',
    action: 'RESTORE_TRASH_ITEM',
    entityType: normType,
    entityId: normId,
    after: { entityType: normType, entityId: normId, name: restoredName },
    result: 'SUCCESS',
    riskClassification: 'HIGH',
  });

  return response.status(200).json({
    success: true,
    message: `Restored ${normType} ${normId} (${restoredName})`,
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listTrashItems,
  restoreTrashItem,
};
