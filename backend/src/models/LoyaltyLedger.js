'use strict';

/**
 * LOYALTY LEDGER — MONGOOSE MODEL
 *
 * Immutable ledger of points earned, redeemed, adjusted, or expired.
 */

const mongoose = require('mongoose');

const LOYALTY_TX_TYPES = [
  'EARN',
  'REDEEM',
  'ADJUSTMENT',
  'EXPIRE',
];

const loyaltyLedgerSchema = new mongoose.Schema(
  {
    loyaltyLedgerId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^LOY-\d{8}-\d{4,}$/,
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

    customerId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    transactionType: {
      type: String,
      required: true,
      enum: LOYALTY_TX_TYPES,
    },

    pointsDelta: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Number.isInteger(v) && v !== 0,
        message: 'pointsDelta must be a non-zero integer.',
      },
    },

    balanceBefore: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    referenceBillId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    performedByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    serverTimestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'loyalty_ledger_entries',
  }
);

loyaltyLedgerSchema.index(
  { organisationId: 1, customerId: 1, serverTimestamp: -1 },
  { name: 'org_cust_time' }
);

loyaltyLedgerSchema.pre('validate', function normaliseLoyaltyFields() {
  const upperFields = ['loyaltyLedgerId', 'organisationId', 'customerId', 'referenceBillId', 'performedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.transactionType) this.transactionType = this.transactionType.trim().toUpperCase();
});

const LoyaltyLedger =
  mongoose.models.LoyaltyLedger ||
  mongoose.model('LoyaltyLedger', loyaltyLedgerSchema);

module.exports = {
  LoyaltyLedger,
  LOYALTY_TX_TYPES,
};
