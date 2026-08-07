'use strict';

/**
 * REVENUE SHARE AGREEMENT — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const AGREEMENT_STATUSES = ['ACTIVE', 'SUSPENDED', 'TERMINATED'];

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

    partnerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

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

    status: {
      type: String,
      enum: AGREEMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    effectiveFrom: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

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

revenueShareAgreementSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

revenueShareAgreementSchema.pre('validate', function normaliseRSAFields() {
  const upperFields = ['agreementId', 'organisationId', 'cafeId', 'createdByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) this.status = this.status.trim().toUpperCase();
});

const RevenueShareAgreement =
  mongoose.models.RevenueShareAgreement ||
  mongoose.model('RevenueShareAgreement', revenueShareAgreementSchema);

module.exports = {
  RevenueShareAgreement,
  AGREEMENT_STATUSES,
};
