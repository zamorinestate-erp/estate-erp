'use strict';

/**
 * CAFE INVENTORY CONFIG — MONGOOSE MODEL
 *
 * One document per (organisationId, cafeId, itemId) triple.
 * Created when a GlobalInventoryItem is published — seeded at ZERO quantity.
 * Never created with fake opening stock.
 *
 * currentQuantityBase:
 *   The live stock balance in the item's baseUnit.
 *   Must ONLY be modified via atomic $inc operations (never by direct set).
 *   Each $inc corresponds to exactly one StockMovement record.
 *   This ensures the ledger and the balance are always in sync.
 *
 * Concurrency:
 *   optimisticConcurrency: true prevents lost-update races.
 *   Stock-movement service must use findOneAndUpdate with $inc.
 *
 * Negative stock:
 *   negativeStockAllowed defaults to false.
 *   All movement handlers must check this before allowing a deduction.
 */

const mongoose = require('mongoose');

const CAFE_ITEM_STATUSES = [
  'ACTIVE',      // Item stocked and available at this café
  'INACTIVE',    // Temporarily unavailable (e.g., seasonal)
  'DISCONTINUED',// No longer stocked; balance may be depleted
];

const cafeInventoryConfigSchema = new mongoose.Schema(
  {
    // ── Scope keys ───────────────────────────────────────────────────────────
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

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: CAFE_ITEM_STATUSES,
      default: 'ACTIVE',
    },

    // ── Stock balance ─────────────────────────────────────────────────────────
    // All stock quantities are in the item's baseUnit.
    // RULE: Only update via $inc — never via $set directly.
    currentQuantityBase: {
      type: Number,
      required: true,
      default: 0,
      // Note: can temporarily go negative only when negativeStockAllowed=true.
    },

    // ── Thresholds (all in baseUnit) ─────────────────────────────────────────
    minimumQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    maximumQuantityBase: {
      type: Number,
      min: 0,
      default: null,
    },

    safetyStockBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    reorderLevelBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    reorderQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ── Controls ─────────────────────────────────────────────────────────────
    negativeStockAllowed: {
      type: Boolean,
      default: false,
    },

    // Whether this item is visible and purchasable at this café's POS.
    availableAtPOS: {
      type: Boolean,
      default: false,
    },

    // ── Local vendor preference ───────────────────────────────────────────────
    // References a Vendor.vendorId. Optional.
    preferredVendorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ── Purchase Recommendation Engine (Capability 10) ────────────────────────
    // Average number of base units consumed per day (rolling calculation).
    // Used by the deterministic reorder recommendation engine.
    avgDailyUsageBase: {
      type: Number,
      min: 0,
      default: null,
    },

    // Supplier lead time in calendar days (used for reorder timing calculation).
    leadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
      default: null,
    },

    // Last recommended order quantity computed by the engine (in baseUnit).
    // Formula: (avgDailyUsage × (leadTime + reviewCycle)) + safetyStock − currentQty
    lastRecommendedOrderQtyBase: {
      type: Number,
      min: 0,
      default: null,
    },

    // Timestamp when the last recommendation was computed.
    lastRecommendationComputedAt: {
      type: Date,
      default: null,
    },

    // Expiry exposure: total base units of near-expiry stock (within 7 days).
    nearExpiryQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ── Storage location ─────────────────────────────────────────────────────
    storageLocation: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    // ── Governance ───────────────────────────────────────────────────────────
    lastStockCountDate: {
      type: String,    // YYYY-MM-DD IST
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    lastStockCountByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'cafe_inventory_configs',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

// Primary lookup key — unique per café+item combination.
cafeInventoryConfigSchema.index(
  { organisationId: 1, cafeId: 1, itemId: 1 },
  { unique: true, name: 'org_cafe_item_unique' }
);

// Reorder alert queries: find items below reorder level for a café.
cafeInventoryConfigSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

// ── Normalisation ────────────────────────────────────────────────────────────

cafeInventoryConfigSchema.pre('validate', function normaliseCafeConfigFields() {
  const upperFields = [
    'organisationId', 'cafeId', 'itemId',
    'preferredVendorId', 'lastStockCountByUserId', 'lastModifiedByUserId',
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
});

// ── Virtual: is below reorder level? ────────────────────────────────────────

cafeInventoryConfigSchema.virtual('isBelowReorderLevel').get(function () {
  return (
    this.reorderLevelBase > 0 &&
    this.currentQuantityBase <= this.reorderLevelBase
  );
});

// ── Static: seed café configs for a new global item ─────────────────────────
// Called from inventoryController after creating a GlobalInventoryItem.
// Creates ZERO-quantity config for each cafeId. Does not overwrite existing.

cafeInventoryConfigSchema.statics.seedForNewItem =
  async function seedForNewItem({ organisationId, itemId, cafeIds }) {
    if (!cafeIds || cafeIds.length === 0) return;

    const docs = cafeIds.map((cafeId) => ({
      organisationId: organisationId.trim().toUpperCase(),
      cafeId: cafeId.trim().toUpperCase(),
      itemId: itemId.trim().toUpperCase(),
      currentQuantityBase: 0,
      status: 'ACTIVE',
    }));

    // insertMany with ordered:false continues even if some already exist.
    await this.insertMany(docs, {
      ordered: false,
      rawResult: false,
    }).catch((error) => {
      // Ignore duplicate key errors (E11000) — config already exists.
      if (error.code !== 11000 && !error.writeErrors?.every((e) => e.code === 11000)) {
        throw error;
      }
    });
  };

const CafeInventoryConfig =
  mongoose.models.CafeInventoryConfig ||
  mongoose.model('CafeInventoryConfig', cafeInventoryConfigSchema);

module.exports = {
  CafeInventoryConfig,
  CAFE_ITEM_STATUSES,
};
