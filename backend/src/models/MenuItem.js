'use strict';

/**
 * MENU ITEM — MONGOOSE MODEL
 *
 * Defines items offered for sale across cafes.
 * Stores price history embedded array for auditability of pricing changes.
 *
 * Each price change pushes an entry to `priceHistory`:
 *   { pricePaisa, effectiveFrom, changedByUserId, reason }
 */

const mongoose = require('mongoose');

const MENU_CATEGORIES = [
  'COFFEE',
  'TEA',
  'BEVERAGES_OTHER',
  'BAKERY',
  'SNACKS',
  'MAIN_COURSE',
  'DESSERTS',
  'MERCHANDISE',
  'OTHER',
];

const priceHistorySchema = new mongoose.Schema(
  {
    pricePaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'pricePaisa must be an integer.',
      },
    },

    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },

    changedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { _id: true }
);

const menuItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^MENU-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },

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
      enum: MENU_CATEGORIES,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    // Current price in paisa (INR x 100)
    currentPricePaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'currentPricePaisa must be an integer.',
      },
    },

    taxRatePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 5, // Default GST 5% for food/bev
    },

    isTaxInclusive: {
      type: Boolean,
      default: true,
    },

    // Link to inventory item for stock deduction (optional)
    inventoryItemId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    recipeDeductionBaseQuantity: {
      type: Number,
      min: 0,
      default: 1,
    },

    // Cafes where this item is offered
    availableCafeIds: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },

    priceHistory: {
      type: [priceHistorySchema],
      default: [],
    },

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
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'menu_items',
  }
);

menuItemSchema.index(
  { organisationId: 1, nameLower: 1 },
  { unique: true, name: 'org_menu_name_unique' }
);

menuItemSchema.index(
  { organisationId: 1, status: 1, category: 1 },
  { name: 'org_status_category' }
);

menuItemSchema.pre('validate', function normaliseMenuFields() {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  if (this.category) {
    this.category = this.category.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }

  const upperFields = ['menuItemId', 'organisationId', 'inventoryItemId', 'createdByUserId', 'lastModifiedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }

  if (Array.isArray(this.availableCafeIds)) {
    this.availableCafeIds = this.availableCafeIds.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  }
});

const MenuItem =
  mongoose.models.MenuItem ||
  mongoose.model('MenuItem', menuItemSchema);

module.exports = {
  MenuItem,
  MENU_CATEGORIES,
};
