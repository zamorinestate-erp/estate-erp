'use strict';

/**
 * RECOVERY CHARGE & UTILITY METERS — MONGOOSE MODEL (SCR-026)
 * Governs pass-through utility charges (electricity, water, gas), meter readings, CAM cost pools, and reconciliation true-ups.
 */

const mongoose = require('mongoose');

const UTILITY_TYPES = ['ELECTRICITY', 'WATER', 'GAS', 'CAM_COMMON_AREA', 'MAINTENANCE', 'CLEANING', 'WASTE'];
const RECOVERY_METHODS = ['ACTUAL_METER', 'FIXED_AMOUNT', 'AREA_ALLOCATION', 'PERCENTAGE_ALLOCATION', 'SHARED_COST_POOL'];

const recoveryChargeSchema = new mongoose.Schema(
  {
    recoveryId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^REC-\d{4,}$/,
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

    outletId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    operatorId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    agreementId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    periodKey: {
      type: String,
      required: true,
      trim: true,
    },

    utilityType: {
      type: String,
      enum: UTILITY_TYPES,
      required: true,
    },

    recoveryMethod: {
      type: String,
      enum: RECOVERY_METHODS,
      default: 'ACTUAL_METER',
    },

    // Meter Data (if meter-based)
    meterId: { type: String, trim: true, default: '' },
    previousReading: { type: Number, default: 0 },
    currentReading: { type: Number, default: 0 },
    unitsConsumed: { type: Number, default: 0 },
    unitRatePaisa: { type: Number, default: 0 },
    isEstimated: { type: Boolean, default: false },

    // Cost Pool / Allocation Data
    totalPoolCostPaisa: { type: Number, default: 0 },
    allocationSharePercent: { type: Number, default: 0 },

    // Financial Value
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['ESTIMATED', 'PENDING_BILLING', 'BILLED_IN_SETTLEMENT', 'SETTLED', 'ADJUSTED'],
      default: 'PENDING_BILLING',
    },

    settlementId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    evidenceFileUrl: {
      type: String,
      trim: true,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      default: '',
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
    versionKey: 'version',
    collection: 'recovery_charges',
  }
);

recoveryChargeSchema.index({ organisationId: 1, outletId: 1, periodKey: 1, utilityType: 1 });

const RecoveryCharge =
  mongoose.models.RecoveryCharge ||
  mongoose.model('RecoveryCharge', recoveryChargeSchema);

module.exports = {
  RecoveryCharge,
  UTILITY_TYPES,
  RECOVERY_METHODS,
};
