'use strict';

/**
 * MODIFIER GROUP — MONGOOSE MODEL (SCR-013)
 *
 * Defines reusable modifier groups (e.g. Milk Choice, Extra Shot, Spice Level)
 * with selection bounds (min/max), pricing deltas, and inventory consumption deltas.
 */

const mongoose = require('mongoose');

const modifierOptionSchema = new mongoose.Schema(
  {
    modifierId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    pricePaisaDelta: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'pricePaisaDelta must be an integer in paisa.',
      },
    },
    standardCostPaisaDelta: {
      type: Number,
      default: 0,
    },
    recipeDeltas: [
      {
        inventoryItemId: { type: String, trim: true, uppercase: true, required: true },
        quantityDelta: { type: Number, required: true }, // positive (add) or negative (remove)
        uom: { type: String, trim: true, uppercase: true, required: true },
      },
    ],
    allergenTags: {
      type: [String],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const modifierGroupSchema = new mongoose.Schema(
  {
    modifierGroupId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^MOD-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    conceptEligibility: {
      type: String,
      enum: ['CAFE', 'RESTAURANT', 'SHARED'],
      default: 'SHARED',
    },

    minSelections: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    maxSelections: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    isRequired: {
      type: Boolean,
      default: false,
    },

    isMultiSelect: {
      type: Boolean,
      default: false,
    },

    modifiers: {
      type: [modifierOptionSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'modifier_groups',
  }
);

modifierGroupSchema.index({ organisationId: 1, name: 1 });

const ModifierGroup = mongoose.models.ModifierGroup || mongoose.model('ModifierGroup', modifierGroupSchema);

module.exports = {
  ModifierGroup,
};
