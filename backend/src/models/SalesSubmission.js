'use strict';

/**
 * SALES SUBMISSION — MONGOOSE MODEL (SCR-026)
 * Raw reported sales reports submitted by/for an outlet, decoupled from final settlements.
 */

const mongoose = require('mongoose');

const SUBMISSION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'VALIDATION_REQUIRED',
  'UNDER_REVIEW',
  'RETURNED_FOR_CORRECTION',
  'APPROVED',
  'CERTIFIED',
  'SUPERSEDED',
  'LOCKED',
];

const SALES_SOURCES = [
  'ZAMORIN_POS',
  'EXTERNAL_POS_API',
  'CSV_IMPORT',
  'XLSX_IMPORT',
  'MANUAL',
  'CERTIFIED_STATEMENT',
];

const salesSubmissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^SS-\d{4,}$/,
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

    businessDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    periodStart: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    periodEnd: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },

    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    source: {
      type: String,
      enum: SALES_SOURCES,
      default: 'MANUAL',
    },

    isZeroSalesDeclaration: {
      type: Boolean,
      default: false,
    },

    zeroSalesReason: {
      type: String,
      trim: true,
      default: '',
    },

    // Sales Breakdown (in integer Paise)
    grossSalesPaisa: { type: Number, required: true, min: 0, default: 0 },
    discountsPaisa: { type: Number, min: 0, default: 0 },
    cancellationsPaisa: { type: Number, min: 0, default: 0 },
    refundsPaisa: { type: Number, min: 0, default: 0 },
    gstPaisa: { type: Number, min: 0, default: 0 },
    excludedTransactionsPaisa: { type: Number, min: 0, default: 0 },
    creditSalesPaisa: { type: Number, min: 0, default: 0 },
    creditCollectionsPaisa: { type: Number, min: 0, default: 0 },
    costOfGoodsSoldPaisa: { type: Number, min: 0, default: 0 }, // for GROSS_PROFIT
    operatingExpensesPaisa: { type: Number, min: 0, default: 0 }, // for NET_OPERATING_PROFIT
    netEligibleRevenuePaisa: { type: Number, min: 0, default: 0 },

    // Channel Breakdown
    channels: {
      cashPaisa: { type: Number, min: 0, default: 0 },
      cardPaisa: { type: Number, min: 0, default: 0 },
      upiPaisa: { type: Number, min: 0, default: 0 },
      deliveryAggregatorPaisa: { type: Number, min: 0, default: 0 },
      creditPaisa: { type: Number, min: 0, default: 0 },
      otherPaisa: { type: Number, min: 0, default: 0 },
    },

    // Evidence & Certifications
    evidenceFileUrl: { type: String, trim: true, default: '' },
    isCertified: { type: Boolean, default: false },
    certifiedBy: { type: String, trim: true, default: '' },
    certifiedAt: { type: Date, default: null },

    // Variance vs POS Check
    posReconciliation: {
      posGrossSalesPaisa: { type: Number, default: null },
      variancePaisa: { type: Number, default: 0 },
      hasVariance: { type: Boolean, default: false },
      reviewNotes: { type: String, trim: true, default: '' },
    },

    reviewNotes: { type: String, trim: true, default: '' },
    reviewedByUserId: { type: String, trim: true, default: null },
    reviewedAt: { type: Date, default: null },

    restatementHistory: [
      {
        restatedAt: { type: Date, default: Date.now },
        restatedByUserId: { type: String, trim: true },
        previousGrossPaisa: { type: Number },
        newGrossPaisa: { type: Number },
        reason: { type: String, trim: true },
      },
    ],

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
    collection: 'sales_submissions',
  }
);

salesSubmissionSchema.index({ organisationId: 1, outletId: 1, businessDate: 1 }, { unique: true });
salesSubmissionSchema.index({ organisationId: 1, agreementId: 1, status: 1 });

const SalesSubmission =
  mongoose.models.SalesSubmission ||
  mongoose.model('SalesSubmission', salesSubmissionSchema);

module.exports = {
  SalesSubmission,
  SUBMISSION_STATUSES,
  SALES_SOURCES,
};
