'use strict';

/**
 * REVENUE SHARE DISPUTE & DEFAULT CASE — MONGOOSE MODEL (SCR-026)
 * Tracks formal billing disputes, breach/default notices, cure periods, and resolutions.
 */

const mongoose = require('mongoose');

const DISPUTE_STATUSES = [
  'OPEN',
  'OPERATOR_RESPONSE_PENDING',
  'INTERNAL_REVIEW',
  'EVIDENCE_REQUIRED',
  'RESOLUTION_PENDING',
  'RESOLVED',
  'CLOSED',
];

const DEFAULT_STATUSES = [
  'OPEN',
  'NOTICE_PENDING',
  'NOTICE_SENT',
  'CURE_PERIOD',
  'REMEDIED',
  'ESCALATED',
  'WAIVED',
  'TERMINATION_REVIEW',
  'CLOSED',
];

const revenueShareDisputeSchema = new mongoose.Schema(
  {
    disputeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^DSP-\d{4,}$/,
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
      index: true,
    },

    settlementId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    caseType: {
      type: String,
      enum: ['SETTLEMENT_CALCULATION', 'SALES_VARIANCE', 'UTILITY_RECOVERY', 'MAINTENANCE_DAMAGE', 'PAYMENT_DEFAULT', 'COMPLIANCE_BREACH'],
      default: 'SETTLEMENT_CALCULATION',
    },

    totalAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    disputedAmountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    undisputedAmountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: 'OPEN',
      index: true,
    },

    defaultStatus: {
      type: String,
      enum: DEFAULT_STATUSES,
      default: 'OPEN',
    },

    cureDeadline: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    resolution: {
      action: { type: String, enum: ['ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'NO_CHANGE_UPHELD', 'WAIVED'], default: null },
      adjustmentPaisa: { type: Number, default: 0 },
      resolvedByUserId: { type: String, trim: true, default: null },
      resolvedAt: { type: Date, default: null },
      notes: { type: String, trim: true, default: '' },
    },

    evidenceFileUrl: {
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
    collection: 'revenue_share_disputes',
  }
);

revenueShareDisputeSchema.index({ organisationId: 1, outletId: 1, status: 1 });

const RevenueShareDispute =
  mongoose.models.RevenueShareDispute ||
  mongoose.model('RevenueShareDispute', revenueShareDisputeSchema);

module.exports = {
  RevenueShareDispute,
  DISPUTE_STATUSES,
  DEFAULT_STATUSES,
};
