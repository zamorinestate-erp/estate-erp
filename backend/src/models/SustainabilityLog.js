'use strict';

/**
 * SUSTAINABILITY LOG — MONGOOSE MODEL (Capability 32 — Sustainability Tracking)
 *
 * Environmental, resource consumption, and waste management metrics per café.
 */

const mongoose = require('mongoose');

const SUSTAINABILITY_CATEGORIES = [
  'ENERGY_KWH',
  'WATER_LITRES',
  'FOOD_WASTE_KG',
  'PACKAGING_WASTE_KG',
  'RECYCLING_KG',
];

const sustainabilityLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^SUS-\d{4,}$/,
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
      trim: true,
      uppercase: true,
      index: true,
    },

    category: {
      type: String,
      required: true,
      enum: SUSTAINABILITY_CATEGORIES,
      index: true,
    },

    metricDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    recordedByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'sustainability_logs',
  }
);

sustainabilityLogSchema.index(
  { organisationId: 1, cafeId: 1, metricDate: 1 },
  { name: 'org_cafe_date' }
);

sustainabilityLogSchema.pre('validate', function normaliseSus() {
  const upperFields = ['logId', 'organisationId', 'cafeId', 'category', 'recordedByUserId'];
  for (const f of upperFields) {
    if (this[f] && typeof this[f] === 'string') this[f] = this[f].trim().toUpperCase();
  }
});

const SustainabilityLog =
  mongoose.models.SustainabilityLog ||
  mongoose.model('SustainabilityLog', sustainabilityLogSchema);

module.exports = {
  SustainabilityLog,
  SUSTAINABILITY_CATEGORIES,
};
