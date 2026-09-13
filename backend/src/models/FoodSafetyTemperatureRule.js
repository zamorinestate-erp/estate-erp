'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — FSSAI FOOD SAFETY TEMPERATURE RULE MODEL (R02A-01)
 * ============================================================================
 * Configurable, versioned statutory temperature and time rules conforming to
 * FSSAI Food Safety and Standards (Licensing and Registration of Food Businesses)
 * Regulations, Schedule 4 (General Hygienic and Sanitary Practices).
 *
 * Supports multi-criteria combinations (e.g. 60°C/10m OR 65°C/2m for veg,
 * 65°C/10m OR 70°C/2m OR 75°C/15s for non-veg), distinct process types
 * (COOKING, REHEATING, HOT_HOLDING, COLD_HOLDING, COOLING, RECEIVING, STORAGE),
 * and food categories.
 */

const mongoose = require('mongoose');

const FOOD_CATEGORIES = [
  'VEGETARIAN',
  'NON_VEGETARIAN',
  'DAIRY',
  'SEAFOOD',
  'BAKERY',
  'ALL',
];

const PROCESS_TYPES = [
  'COOKING',
  'REHEATING',
  'HOT_HOLDING',
  'COLD_HOLDING',
  'COOLING',
  'RECEIVING',
  'STORAGE',
];

const ruleCriterionSchema = new mongoose.Schema(
  {
    minimumTemperatureC: {
      type: Number,
      required: true,
    },
    minimumDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumTemperatureC: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const RULE_STATUSES = [
  'ACTIVE',
  'SUPERSEDED',
  'INACTIVE',
  'EXPIRED',
];

const foodSafetyTemperatureRuleSchema = new mongoose.Schema(
  {
    ruleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    foodCategory: {
      type: String,
      enum: FOOD_CATEGORIES,
      required: true,
      default: 'ALL',
      index: true,
    },

    processType: {
      type: String,
      enum: PROCESS_TYPES,
      required: true,
      index: true,
    },

    criteria: {
      type: [ruleCriterionSchema],
      required: true,
      validate: [
        (c) => Array.isArray(c) && c.length > 0,
        'At least one temperature criterion must be specified.',
      ],
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: RULE_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    sourceReference: {
      type: String,
      trim: true,
      default: 'FSSAI Schedule 4 (General Hygienic and Sanitary Practices)',
    },

    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

foodSafetyTemperatureRuleSchema.pre('validate', function syncStatusAndActive() {
  if (this.status === 'ACTIVE') {
    this.active = true;
  } else if (['SUPERSEDED', 'INACTIVE', 'EXPIRED'].includes(this.status)) {
    this.active = false;
  } else if (this.active === false && !this.status) {
    this.status = 'INACTIVE';
  } else if (this.active === true && !this.status) {
    this.status = 'ACTIVE';
  }
});

// Version unique index: same org, cafe, processType, foodCategory with distinct version
foodSafetyTemperatureRuleSchema.index(
  { organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1, version: 1 },
  { unique: true, name: 'uniq_trule_org_cafe_proc_cat_ver' }
);

// At most one ACTIVE rule allowed per (org, cafe, processType, foodCategory)
// Database partial unique index guarantees AT MOST ONE active rule; service layer is responsible for activation, supersession, and ensuring rule existence
foodSafetyTemperatureRuleSchema.index(
  { organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: 'uniq_trule_org_cafe_proc_cat_active',
  }
);

const FoodSafetyTemperatureRule =
  mongoose.models.FoodSafetyTemperatureRule ||
  mongoose.model('FoodSafetyTemperatureRule', foodSafetyTemperatureRuleSchema);

module.exports = {
  FoodSafetyTemperatureRule,
  FOOD_CATEGORIES,
  PROCESS_TYPES,
  RULE_STATUSES,
};
