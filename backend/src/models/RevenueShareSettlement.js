'use strict';

/**
 * REVENUE SHARE SETTLEMENT — MONGOOSE MODEL (SCR-026)
 * Periodic settlement calculation snapshot, approval status, Finance receivable linkage, and posting idempotency.
 */

const mongoose = require('mongoose');

const SETTLEMENT_STATUSES = [
  'DRAFT',
  'CALCULATED',
  'REVIEW_REQUIRED',
  'APPROVAL_PENDING',
  'APPROVED',
  'FINANCE_POSTING_PENDING',
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'ADJUSTED',
  'CLOSED',
  'POSTING_FAILED',
];

const revenueShareSettlementSchema = new mongoose.Schema(
  {
    settlementId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^SET-\d{4,}$/,
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

    rateRuleId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    periodKey: {
      type: String, // e.g. "2026-08" or "2026-W34" or "2026-08-19"
      required: true,
      trim: true,
      index: true,
    },

    periodStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    periodEnd: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    dueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },

    status: {
      type: String,
      enum: SETTLEMENT_STATUSES,
      default: 'CALCULATED',
      index: true,
    },

    // Aggregated Revenue Figures (in integer Paise)
    totalGrossSalesPaisa: { type: Number, required: true, min: 0, default: 0 },
    totalDeductionsPaisa: { type: Number, min: 0, default: 0 },
    eligibleRevenuePaisa: { type: Number, required: true, min: 0, default: 0 },

    // Calculation Method & Rate Snapshot
    calculationSnapshot: {
      calculationMethod: { type: String, required: true },
      calculationBasis: { type: String, required: true },
      percentageApplied: { type: Number, default: null },
      fixedAmountPaisa: { type: Number, default: 0 },
      minimumGuaranteePaisa: { type: Number, default: 0 },
      maximumCapPaisa: { type: Number, default: 0 },
      tiersSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // Calculated Components (in Paise)
    baseRevenueSharePaisa: { type: Number, required: true, min: 0, default: 0 },
    fixedFeeComponentPaisa: { type: Number, min: 0, default: 0 },
    minimumGuaranteeShortfallPaisa: { type: Number, min: 0, default: 0 },
    capReductionPaisa: { type: Number, min: 0, default: 0 },

    // Recoveries & Pass-Throughs
    recoveries: {
      electricityPaisa: { type: Number, min: 0, default: 0 },
      waterPaisa: { type: Number, min: 0, default: 0 },
      gasPaisa: { type: Number, min: 0, default: 0 },
      camMaintenancePaisa: { type: Number, min: 0, default: 0 },
      totalRecoveriesPaisa: { type: Number, min: 0, default: 0 },
    },

    // Adjustments, Deductions, & Advance Offsets
    adjustmentsPaisa: { type: Number, default: 0 }, // positive (extra debit) or negative (credit)
    previousOutstandingPaisa: { type: Number, min: 0, default: 0 },
    advanceOffsetPaisa: { type: Number, min: 0, default: 0 },
    penaltyLateChargePaisa: { type: Number, min: 0, default: 0 },

    // Final Total Payable / Receivable
    netPayablePaisa: { type: Number, required: true, min: 0, default: 0 },
    paidAmountPaisa: { type: Number, min: 0, default: 0 },
    balanceOutstandingPaisa: { type: Number, min: 0, default: 0 },

    // Human-Readable Calculation Breakdown Logs
    calculationBreakdown: [
      {
        step: { type: Number },
        description: { type: String },
        amountPaisa: { type: Number },
      },
    ],

    // Approval Metadata
    approvalNotes: { type: String, trim: true, default: '' },
    approvedByUserId: { type: String, trim: true, uppercase: true, default: null },
    approvedAt: { type: Date, default: null },

    // Finance / AP / AR Linkage
    financePosting: {
      status: { type: String, enum: ['IDLE', 'POSTED', 'FAILED'], default: 'IDLE' },
      financeInvoiceId: { type: String, trim: true, default: null },
      postedAt: { type: Date, default: null },
      errorMessage: { type: String, trim: true, default: null },
      idempotencyKey: { type: String, trim: true, default: null },
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
    collection: 'revenue_share_settlements',
  }
);

revenueShareSettlementSchema.index(
  { organisationId: 1, outletId: 1, periodKey: 1 },
  { unique: true }
);
revenueShareSettlementSchema.index({ organisationId: 1, operatorId: 1, status: 1 });

const RevenueShareSettlement =
  mongoose.models.RevenueShareSettlement ||
  mongoose.model('RevenueShareSettlement', revenueShareSettlementSchema);

module.exports = {
  RevenueShareSettlement,
  SETTLEMENT_STATUSES,
};
