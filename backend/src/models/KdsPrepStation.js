'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — KDS PREP STATION MODEL (R02A-02)
 * ============================================================================
 * Configurable prep station configuration scoped strictly by organisationId
 * and cafeId. Prevents global prep station values from leaking across cafés.
 * Supports station routing from menu items and categories.
 */

const mongoose = require('mongoose');

const DEFAULT_STATION_FIXTURES = [
  { code: 'HOT_KITCHEN', name: 'Hot Kitchen', description: 'Primary cook line, grills, fryers and ovens', sequence: 1, displayOrder: 1, isExpediter: false },
  { code: 'BEVERAGE_BAR', name: 'Beverage Bar', description: 'Espresso machines, manual brews, teas, cold beverages', sequence: 2, displayOrder: 2, isExpediter: false },
  { code: 'BAKERY_COLD', name: 'Bakery & Cold Prep', description: 'Pastries, viennoiserie, sandwiches, cold prep', sequence: 3, displayOrder: 3, isExpediter: false },
  { code: 'DESSERT', name: 'Dessert Bay', description: 'Plated desserts, ice creams, sundaes', sequence: 4, displayOrder: 4, isExpediter: false },
  { code: 'EXPEDITER', name: 'Expediter', description: 'Final order assembly, tray audit, collection aggregation', sequence: 5, displayOrder: 5, isExpediter: true },
];

const kdsPrepStationSchema = new mongoose.Schema(
  {
    prepStationId: {
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
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },

    sequence: {
      type: Number,
      default: 1,
      min: 1,
    },

    active: {
      type: Boolean,
      default: true,
      index: true,
    },

    isExpediter: {
      type: Boolean,
      default: false,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    assignedMenuItemIds: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],

    assignedCategories: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'kds_prep_stations',
  }
);

kdsPrepStationSchema.index(
  { organisationId: 1, cafeId: 1, code: 1 },
  { unique: true, name: 'org_cafe_station_code_unique' }
);

kdsPrepStationSchema.index(
  { organisationId: 1, cafeId: 1, active: 1, displayOrder: 1 },
  { name: 'org_cafe_station_active_display' }
);

const KdsPrepStation =
  mongoose.models.KdsPrepStation || mongoose.model('KdsPrepStation', kdsPrepStationSchema);

module.exports = {
  KdsPrepStation,
  DEFAULT_STATION_FIXTURES,
};
