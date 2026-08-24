'use strict';

/**
 * REVENUE SHARE OPERATOR — MONGOOSE MODEL (SCR-026)
 * Represents an external commercial tenant / brand partner who operates one or more
 * leased outlets under Revenue Share terms.
 */

const mongoose = require('mongoose');

const OPERATOR_STATUSES = [
  'DRAFT',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'AGREEMENT_PENDING',
  'APPROVAL_PENDING',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
];

const revenueShareOperatorSchema = new mongoose.Schema(
  {
    operatorId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^OPR-\d{4,}$/,
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

    legalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
      index: true,
    },

    tradeName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    brandCategory: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Speciality Beverage',
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 15,
      default: '',
      index: true,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: '',
      index: true,
    },

    status: {
      type: String,
      enum: OPERATOR_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    contacts: [
      {
        name: { type: String, required: true, trim: true },
        role: {
          type: String,
          enum: ['COMMERCIAL', 'ACCOUNTS', 'OPERATIONS', 'ESCALATION', 'AUTHORISED_SIGNATORY'],
          default: 'COMMERCIAL',
        },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, lowercase: true, default: '' },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    bankDetails: {
      accountHolderName: { type: String, trim: true, default: '' },
      bankName: { type: String, trim: true, default: '' },
      accountNumberMasked: { type: String, trim: true, default: '' },
      ifscCode: { type: String, trim: true, uppercase: true, default: '' },
      branchName: { type: String, trim: true, default: '' },
    },

    securityDepositBalancePaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    advanceBalancePaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    currentOutstandingPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    documents: [
      {
        documentType: {
          type: String,
          enum: ['GST_CERTIFICATE', 'PAN_CARD', 'BANK_PROOF', 'FSSAI_LICENSE', 'SIGNED_AGREEMENT', 'INSURANCE_POLICY', 'OTHER'],
        },
        documentNumber: { type: String, trim: true, default: '' },
        fileUrl: { type: String, trim: true, default: '' },
        validUntil: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
        verifiedStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
        verifiedAt: { type: Date, default: null },
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
    collection: 'revenue_share_operators',
  }
);

revenueShareOperatorSchema.index({ organisationId: 1, gstin: 1 });
revenueShareOperatorSchema.index({ organisationId: 1, legalName: 1 });

const RevenueShareOperator =
  mongoose.models.RevenueShareOperator ||
  mongoose.model('RevenueShareOperator', revenueShareOperatorSchema);

module.exports = {
  RevenueShareOperator,
  OPERATOR_STATUSES,
};
