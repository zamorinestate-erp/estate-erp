'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OFFLINE RISK CONFIGURATION MODEL (R02B-04)
 * ============================================================================
 * Master-governed offline risk parameters replacing hardcoded constants.
 * Manages maximum offline discount allowances and high-value offline sale caps.
 *
 * Scoped strictly by organisationId and optional cafeId override.
 * Financial amounts are represented exclusively in integer minor units (paise).
 */

const mongoose = require('mongoose');

const DEFAULT_OFFLINE_RISK_CONFIG = Object.freeze({
  maxDiscountPercent: 40,
  highValueAmountPaise: 2500000, // ₹25,000 in integer paise
  allowCafeOverride: false,
});

const offlineRiskConfigSchema = new mongoose.Schema(
  {
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

    maxDiscountPercent: {
      type: Number,
      required: true,
      default: 40,
      min: 0,
      max: 100,
    },

    highValueAmountPaise: {
      type: Number,
      required: true,
      default: 2500000,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'highValueAmountPaise must be an integer value in paise.',
      },
    },

    allowCafeOverride: {
      type: Boolean,
      default: false,
    },

    updatedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'SYSTEM',
    },
  },
  {
    timestamps: true,
  }
);

offlineRiskConfigSchema.index(
  { organisationId: 1, cafeId: 1 },
  { unique: true, name: 'uniq_offline_risk_cfg_org_cafe' }
);

const OfflineRiskConfig =
  mongoose.models.OfflineRiskConfig ||
  mongoose.model('OfflineRiskConfig', offlineRiskConfigSchema);

module.exports = {
  OfflineRiskConfig,
  DEFAULT_OFFLINE_RISK_CONFIG,
};
