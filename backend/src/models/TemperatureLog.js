'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — TEMPERATURE LOG MONGOOSE MODEL
 * ============================================================================
 * Food safety monitoring points: Cold chain, hot holding, preparation,
 * cooking, reheating, cooling, and display units.
 *
 * Enforces automated out-of-range evaluation, preserves historical excursions,
 * and tracks corrective actions without overwriting original readings.
 */

const mongoose = require('mongoose');

const TEMPERATURE_STATUSES = [
  'WITHIN_RANGE',
  'OUT_OF_RANGE',
  'CORRECTIVE_ACTION_REQUIRED',
  'CORRECTED',
];

const MONITORING_POINTS = [
  'REFRIGERATOR',
  'FREEZER',
  'COLD_DISPLAY',
  'HOT_HOLDING',
  'FOOD_RECEIVING',
  'COOKING',
  'COOLING',
  'REHEATING',
  'MILK_FROTHING',
  'CUSTOM',
];

const temperatureLogSchema = new mongoose.Schema(
  {
    logId: {
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

    monitoringPoint: {
      type: String,
      enum: MONITORING_POINTS,
      required: true,
      default: 'REFRIGERATOR',
    },

    monitoringPointName: {
      type: String,
      trim: true,
      default: '',
    },

    equipmentId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    equipmentName: {
      type: String,
      trim: true,
      default: '',
    },

    readingCelsius: {
      type: Number,
      required: true,
    },

    minimumAllowedCelsius: {
      type: Number,
      required: true,
    },

    maximumAllowedCelsius: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: TEMPERATURE_STATUSES,
      required: true,
      index: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    recordedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    operatorSessionId: {
      type: String,
      trim: true,
      default: null,
    },

    // Statutory FSSAI Rule Engine Linkage (R02A-01)
    processType: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    foodCategory: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ALL',
      index: true,
    },

    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },

    ruleId: {
      type: String,
      trim: true,
      default: null,
    },

    temperatureRuleId: {
      type: String,
      trim: true,
      default: null,
    },

    ruleVersion: {
      type: Number,
      default: null,
    },

    ruleEvaluationStatus: {
      type: String,
      enum: ['PASS', 'FAIL', 'NOT_EVALUATED', 'RULE_NOT_CONFIGURED'],
      default: 'NOT_EVALUATED',
      index: true,
    },

    // Excursion & Corrective Action Tracking (Section 9 & 10)
    originalExcursionReading: {
      type: Number,
      default: null,
    },

    isExcursion: {
      type: Boolean,
      default: false,
      index: true,
    },

    correctiveAction: {
      type: String,
      trim: true,
      default: '',
    },

    actionTakenByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    actionTakenAt: {
      type: Date,
      default: null,
    },

    resolvedReadingCelsius: {
      type: Number,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

temperatureLogSchema.index({ organisationId: 1, cafeId: 1, recordedAt: -1 });
temperatureLogSchema.index({ organisationId: 1, cafeId: 1, isExcursion: 1, status: 1 });

const TemperatureLog =
  mongoose.models.TemperatureLog ||
  mongoose.model('TemperatureLog', temperatureLogSchema);

module.exports = {
  TemperatureLog,
  TEMPERATURE_STATUSES,
  MONITORING_POINTS,
};
