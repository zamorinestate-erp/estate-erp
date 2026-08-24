'use strict';

/**
 * COMBO DEFINITION — MONGOOSE MODEL (SCR-013)
 *
 * Defines multi-item combinations and restaurant set menus (e.g. Burger + Side + Drink),
 * with selectable choice rules, premium component surcharges, and circular component prevention.
 */

const mongoose = require('mongoose');

const comboChoiceSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // References canonical MenuItem
    },
    choiceName: {
      type: String,
      required: true,
      trim: true,
    },
    surchargePaisa: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const comboGroupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    requiredCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    choices: {
      type: [comboChoiceSchema],
      default: [],
    },
  },
  { _id: true }
);

const comboDefinitionSchema = new mongoose.Schema(
  {
    comboId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^CMB-\d{4,}$/,
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

    pricingType: {
      type: String,
      enum: ['FIXED_PRICE', 'SUM_LESS_DISCOUNT', 'BASE_PLUS_SURCHARGE'],
      default: 'FIXED_PRICE',
    },

    basePricePaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    groups: {
      type: [comboGroupSchema],
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
    collection: 'combo_definitions',
  }
);

comboDefinitionSchema.index({ organisationId: 1, name: 1 });

const ComboDefinition = mongoose.models.ComboDefinition || mongoose.model('ComboDefinition', comboDefinitionSchema);

module.exports = {
  ComboDefinition,
};
