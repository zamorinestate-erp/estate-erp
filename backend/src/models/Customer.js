'use strict';

/**
 * CUSTOMER — MONGOOSE MODEL
 *
 * Tracks customer profile, total spend, points balance, and loyalty tier.
 */

const mongoose = require('mongoose');

const LOYALTY_TIERS = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
];

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^CUST-\d{4,}$/,
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

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
      index: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: '',
    },

    totalSpendPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    pointsBalance: {
      type: Number,
      min: 0,
      default: 0,
    },

    tier: {
      type: String,
      enum: LOYALTY_TIERS,
      default: 'BRONZE',
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
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
    optimisticConcurrency: true,
    collection: 'customers',
  }
);

customerSchema.index(
  { organisationId: 1, phone: 1 },
  { unique: true, name: 'org_phone_unique' }
);

customerSchema.pre('validate', function normaliseCustomerFields() {
  const upperFields = ['customerId', 'organisationId', 'createdByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.tier) this.tier = this.tier.trim().toUpperCase();
  if (this.status) this.status = this.status.trim().toUpperCase();
});

const Customer =
  mongoose.models.Customer ||
  mongoose.model('Customer', customerSchema);

module.exports = {
  Customer,
  LOYALTY_TIERS,
};
