'use strict';

/**
 * REVENUE SHARE AGREEMENT — MONGOOSE MODEL (SCR-026)
 * Governs the commercial and legal terms between Zamorin and an Operator for a Leased Outlet.
 */

const mongoose = require('mongoose');

const AGREEMENT_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVAL_PENDING',
  'APPROVED',
  'ACTIVE',
  'AMENDED',
  'RENEWAL_PENDING',
  'HOLDOVER',
  'TEMPORARY_EXTENSION',
  'TERMINATION_PENDING',
  'EXPIRED',
  'CLOSED',
  'SUSPENDED',
];

const SETTLEMENT_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const REPORTING_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'];
const RESPONSIBILITY_MODES = ['ZAMORIN', 'OPERATOR', 'SHARED', 'INCLUDED', 'RECOVERED_SEPARATELY'];

const revenueShareAgreementSchema = new mongoose.Schema(
  {
    agreementId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^RSA-\d{4,}$/,
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

    operatorNameSnapshot: {
      type: String,
      trim: true,
      default: '',
    },

    partnerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    agreementVersion: {
      type: Number,
      min: 1,
      default: 1,
    },

    status: {
      type: String,
      enum: AGREEMENT_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    // Dates & Terms
    executionDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    commencementDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    commercialOpeningDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    salesReportingStart: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    billingStart: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    expiryDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    effectiveFrom: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    noticePeriodDays: { type: Number, min: 0, default: 30 },
    lockInMonths: { type: Number, min: 0, default: 6 },

    // Frequencies
    salesReportingFrequency: {
      type: String,
      enum: REPORTING_FREQUENCIES,
      default: 'DAILY',
    },

    settlementFrequency: {
      type: String,
      enum: SETTLEMENT_FREQUENCIES,
      default: 'MONTHLY',
    },

    paymentDueDaysAfterPeriod: {
      type: Number,
      min: 1,
      default: 7,
    },

    // Financial Provisions
    sharePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    fixedFeePaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    minimumGuaranteeMonthlyPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    maximumCapMonthlyPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    securityDepositRequiredPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Responsibilities Matrix
    responsibilities: {
      rent: { type: String, enum: RESPONSIBILITY_MODES, default: 'INCLUDED' },
      electricity: { type: String, enum: RESPONSIBILITY_MODES, default: 'RECOVERED_SEPARATELY' },
      water: { type: String, enum: RESPONSIBILITY_MODES, default: 'RECOVERED_SEPARATELY' },
      maintenance: { type: String, enum: RESPONSIBILITY_MODES, default: 'SHARED' },
      cleaning: { type: String, enum: RESPONSIBILITY_MODES, default: 'OPERATOR' },
      wasteDisposal: { type: String, enum: RESPONSIBILITY_MODES, default: 'OPERATOR' },
    },

    // Options Register (Renewal, Expansion, Early Termination)
    options: [
      {
        optionType: { type: String, enum: ['RENEWAL', 'EXTENSION', 'EARLY_TERMINATION', 'EXPANSION', 'RELOCATION'] },
        availableFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        exerciseByDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        status: { type: String, enum: ['AVAILABLE', 'EXERCISED', 'LAPSED', 'DECLINED'], default: 'AVAILABLE' },
        termsNotes: { type: String, trim: true, default: '' },
      },
    ],

    // Contractual Milestones & Covenants
    milestones: [
      {
        milestoneKey: { type: String, trim: true },
        title: { type: String, trim: true },
        dueDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        status: { type: String, enum: ['PENDING', 'COMPLETED', 'OVERDUE', 'WAIVED'], default: 'PENDING' },
        completedAt: { type: Date, default: null },
      },
    ],

    // Holdover / Temporary Extension Metadata
    holdoverTerms: {
      isHoldover: { type: Boolean, default: false },
      holdoverEffectiveFrom: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
      holdoverReason: { type: String, trim: true, default: '' },
      holdoverPremiumPercent: { type: Number, default: 0 },
    },

    // Amendment History Snapshots
    versionHistory: [
      {
        versionNumber: { type: Number, required: true },
        amendedAt: { type: Date, default: Date.now },
        amendedByUserId: { type: String, trim: true },
        amendmentReason: { type: String, trim: true },
        snapshot: { type: mongoose.Schema.Types.Mixed },
      },
    ],

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
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
    collection: 'revenue_share_agreements',
  }
);

revenueShareAgreementSchema.index({ organisationId: 1, cafeId: 1, status: 1 });
revenueShareAgreementSchema.index({ organisationId: 1, outletId: 1, status: 1 });
revenueShareAgreementSchema.index({ organisationId: 1, operatorId: 1, status: 1 });

const RevenueShareAgreement =
  mongoose.models.RevenueShareAgreement ||
  mongoose.model('RevenueShareAgreement', revenueShareAgreementSchema);

module.exports = {
  RevenueShareAgreement,
  AGREEMENT_STATUSES,
  SETTLEMENT_FREQUENCIES,
  REPORTING_FREQUENCIES,
  RESPONSIBILITY_MODES,
};
