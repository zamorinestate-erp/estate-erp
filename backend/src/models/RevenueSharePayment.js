'use strict';

/**
 * REVENUE SHARE PAYMENT — MONGOOSE MODEL (SCR-026)
 * Records payments received from operators, allocations to settlements, advance balances, and maker-checker verification.
 */

const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['ENTERED', 'VERIFIED', 'ALLOCATED', 'PARTIALLY_ALLOCATED', 'REVERSED', 'RETURNED'];
const PAYMENT_MODES = ['BANK_TRANSFER_NEFT_RTGS', 'UPI', 'CHEQUE', 'DIRECT_DEBIT', 'ADVANCE_OFFSET', 'CASH'];

const revenueSharePaymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^RSP-\d{4,}$/,
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

    operatorId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    paymentDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: 'BANK_TRANSFER_NEFT_RTGS',
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    allocatedAmountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    unallocatedAmountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    transactionReferenceUtr: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'ENTERED',
      index: true,
    },

    allocations: [
      {
        settlementId: { type: String, required: true, trim: true, uppercase: true },
        outletId: { type: String, required: true, trim: true, uppercase: true },
        allocatedPaisa: { type: Number, required: true, min: 1 },
        allocatedAt: { type: Date, default: Date.now },
      },
    ],

    // Maker-Checker Verification Segregation
    enteredByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    verifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verificationNotes: {
      type: String,
      trim: true,
      default: '',
    },

    reversalReason: {
      type: String,
      trim: true,
      default: null,
    },

    receiptFileUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'revenue_share_payments',
  }
);

revenueSharePaymentSchema.index({ organisationId: 1, operatorId: 1, paymentDate: -1 });

const RevenueSharePayment =
  mongoose.models.RevenueSharePayment ||
  mongoose.model('RevenueSharePayment', revenueSharePaymentSchema);

module.exports = {
  RevenueSharePayment,
  PAYMENT_STATUSES,
  PAYMENT_MODES,
};
