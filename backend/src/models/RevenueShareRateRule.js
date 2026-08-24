'use strict';

/**
 * REVENUE SHARE RATE RULE — MONGOOSE MODEL (SCR-026)
 * Effective-dated calculation rules defining methods, bases, tiers, and minimum guarantees.
 */

const mongoose = require('mongoose');

const CALCULATION_METHODS = [
  'PERCENTAGE_ONLY',
  'FIXED_AMOUNT_ONLY',
  'FIXED_PLUS_PERCENTAGE',
  'HIGHER_OF_FIXED_OR_PERCENTAGE',
  'TIERED_PERCENTAGE',
  'PERCENTAGE_WITH_MINIMUM_GUARANTEE',
  'PERCENTAGE_WITH_MAXIMUM_CAP',
  'RENT_RECOVERY_FIRST',
  'UTILITY_RECOVERY_FIRST',
  'CUSTOM_APPROVED_ADJUSTMENT',
];

const CALCULATION_BASES = [
  'GROSS_SALES',
  'NET_SALES',
  'NET_SALES_EXCLUDING_GST',
  'COLLECTED_REVENUE',
  'GROSS_PROFIT',
  'NET_OPERATING_PROFIT',
  'CUSTOM_ELIGIBLE_REVENUE',
];

const CREDIT_SALES_TREATMENTS = ['SALES_BASIS', 'COLLECTION_BASIS', 'HYBRID_BASIS'];
const RULE_STATUSES = ['DRAFT', 'APPROVAL_PENDING', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'SUPERSEDED'];

const rateTierSchema = new mongoose.Schema(
  {
    fromPaisa: { type: Number, required: true, min: 0 },
    toPaisa: { type: Number, default: null }, // null = open-ended infinity
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const revenueShareRateRuleSchema = new mongoose.Schema(
  {
    rateRuleId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^RR-\d{4,}$/,
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

    agreementId: {
      type: String,
      required: true,
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

    ruleName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: RULE_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    effectiveFrom: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    effectiveTo: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
      index: true,
    },

    calculationMethod: {
      type: String,
      enum: CALCULATION_METHODS,
      required: true,
      default: 'PERCENTAGE_ONLY',
    },

    calculationBasis: {
      type: String,
      enum: CALCULATION_BASES,
      required: true,
      default: 'GROSS_SALES',
    },

    creditSalesTreatment: {
      type: String,
      enum: CREDIT_SALES_TREATMENTS,
      default: 'SALES_BASIS',
    },

    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    fixedAmountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    minimumGuaranteePaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    maximumCapPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    thresholdPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    tiers: [rateTierSchema],

    changeReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    approvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    createdByUserId: {
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
    collection: 'revenue_share_rate_rules',
  }
);

revenueShareRateRuleSchema.index({ organisationId: 1, agreementId: 1, status: 1 });
revenueShareRateRuleSchema.index({ organisationId: 1, outletId: 1, effectiveFrom: 1, effectiveTo: 1 });

const RevenueShareRateRule =
  mongoose.models.RevenueShareRateRule ||
  mongoose.model('RevenueShareRateRule', revenueShareRateRuleSchema);

module.exports = {
  RevenueShareRateRule,
  CALCULATION_METHODS,
  CALCULATION_BASES,
  CREDIT_SALES_TREATMENTS,
  RULE_STATUSES,
};
