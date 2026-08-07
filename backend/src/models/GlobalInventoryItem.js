'use strict';

/**
 * GLOBAL INVENTORY ITEM — MONGOOSE MODEL
 *
 * Architecture:
 *   GlobalInventoryItem (organisation-wide catalogue)
 *     ↓ propagates to
 *   CafeInventoryConfig  (per-café availability, reorder levels, local vendor)
 *     ↓ balance tracked in
 *   CafeInventoryConfig.currentQuantityBase (atomic $inc operations)
 *     ↓ every change recorded in
 *   StockMovement (immutable ledger)
 *
 * Global items are MASTER-created and owned.
 * Café Admin may configure local availability/thresholds for assigned cafés.
 * When a global item is created, CafeInventoryConfig records are seeded with
 * ZERO quantity for every existing café (propagation — see inventoryController).
 *
 * Units:
 *   Base unit is the smallest stock-keeping unit (e.g., ml, grams, pieces).
 *   Conversion rules define how display units map to base units.
 *   Example: 1 litre = 1000 ml (baseUnit = 'ml', displayUnit = 'litre',
 *   factor = 1000). All quantities stored in baseUnit.
 */

const mongoose = require('mongoose');

const ITEM_STATUSES = [
  'ACTIVE',     // Available for use, ordering, and POS
  'DRAFT',      // Created but not yet published
  'ARCHIVED',   // No longer in use; read-only
];

const ITEM_CATEGORIES = [
  'BEVERAGE',
  'FOOD',
  'PACKAGING',
  'CLEANING',
  'EQUIPMENT',
  'STATIONERY',
  'PERISHABLE',
  'NON_PERISHABLE',
  'OTHER',
];

const unitConversionSchema = new mongoose.Schema(
  {
    // e.g., 'litre', 'kg', 'dozen'
    displayUnit: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 30,
    },
    // How many base units equals 1 displayUnit.
    // e.g., litre→ml: factor = 1000
    factor: {
      type: Number,
      required: true,
      min: 0.001,
    },
    // Display label for purchase orders / receipts.
    label: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
  },
  { _id: false }
);

const globalInventoryItemSchema = new mongoose.Schema(
  {
    // ── Business identifier ──────────────────────────────────────────────────
    itemId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^ITEM-\d{4,}$/,
      index: true,
    },

    // ── Scope ────────────────────────────────────────────────────────────────
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ── Item identity ────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },

    // Normalised lowercase name for case-insensitive duplicate detection.
    nameLower: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    category: {
      type: String,
      required: true,
      enum: ITEM_CATEGORIES,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    // ── Units ────────────────────────────────────────────────────────────────
    // The canonical stock-keeping unit. All quantities stored in this unit.
    // e.g., 'ml', 'grams', 'pieces'
    baseUnit: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 30,
    },

    // Optional conversion rules. If none, only baseUnit is available.
    unitConversions: {
      type: [unitConversionSchema],
      default: [],
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: ITEM_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    // Whether this item appears in POS (only when status=ACTIVE and
    // the café's CafeInventoryConfig also marks it available).
    availableForPOS: {
      type: Boolean,
      default: false,
    },

    // ── Governance ───────────────────────────────────────────────────────────
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    archiveReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // ── Tags / metadata ──────────────────────────────────────────────────────
    tags: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'global_inventory_items',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

globalInventoryItemSchema.index(
  { organisationId: 1, status: 1 },
  { name: 'org_status' }
);

globalInventoryItemSchema.index(
  { organisationId: 1, nameLower: 1 },
  { unique: true, name: 'org_name_unique' }
);

globalInventoryItemSchema.index(
  { organisationId: 1, category: 1, status: 1 },
  { name: 'org_category_status' }
);

// ── Text index for search ────────────────────────────────────────────────────

globalInventoryItemSchema.index(
  { name: 'text', description: 'text', tags: 'text' },
  { name: 'item_text_search' }
);

// ── Pre-validate normalisation ───────────────────────────────────────────────

globalInventoryItemSchema.pre('validate', function normaliseItemFields() {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  if (this.category) {
    this.category = this.category.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
  if (this.baseUnit) {
    this.baseUnit = this.baseUnit.trim().toLowerCase();
  }

  const stringUpperFields = [
    'itemId', 'organisationId', 'createdByUserId',
    'lastModifiedByUserId', 'archivedByUserId',
  ];
  for (const field of stringUpperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
});

const GlobalInventoryItem =
  mongoose.models.GlobalInventoryItem ||
  mongoose.model('GlobalInventoryItem', globalInventoryItemSchema);

module.exports = {
  GlobalInventoryItem,
  ITEM_STATUSES,
  ITEM_CATEGORIES,
};
