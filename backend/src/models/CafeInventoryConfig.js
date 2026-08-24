'use strict';

/**
 * CAFE INVENTORY CONFIG — MONGOOSE MODEL
 *
 * One document per (organisationId, cafeId, itemId) triple.
 * Created when a GlobalInventoryItem is published — seeded at ZERO quantity.
 * Never created with fake opening stock.
 */

const mongoose = require('mongoose');

const CAFE_ITEM_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DISCONTINUED',
];

const cafeInventoryConfigSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cafeId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    itemId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    currentQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    availableQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reservedQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quarantinedQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    expiredQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    inTransitQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    incomingQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    reorderLevelBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderQuantityBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    minQuantityBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    parQuantityBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxQuantityBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    safetyStockBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgDailyUsageBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadTimeDays: {
      type: Number,
      default: 1,
      min: 1,
      max: 365,
    },
    lastRecommendedOrderQtyBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRecommendationComputedAt: {
      type: Date,
      default: null,
    },
    nearExpiryQuantityBase: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockedHere: {
      type: Boolean,
      default: true,
    },
    replenishmentEnabled: {
      type: Boolean,
      default: true,
    },
    primaryLocation: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    storageLocations: {
      type: [String],
      default: ['Main Store'],
    },
    defaultVendorId: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: CAFE_ITEM_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    lastMovementAt: {
      type: Date,
      default: null,
    },
    lastCountAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

cafeInventoryConfigSchema.index(
  { organisationId: 1, cafeId: 1, itemId: 1 },
  { unique: true }
);

const CafeInventoryConfig =
  mongoose.models.CafeInventoryConfig ||
  mongoose.model('CafeInventoryConfig', cafeInventoryConfigSchema);

module.exports = {
  CafeInventoryConfig,
  CAFE_ITEM_STATUSES,
};
