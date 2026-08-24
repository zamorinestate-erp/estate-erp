'use strict';

const mongoose = require('mongoose');

const CARD_MATCH_STATUSES = [
  'UNMATCHED',
  'MATCHED',
  'RECEIPT_MISSING',
  'PERSONAL',
  'DISPUTED',
  'SUBMITTED',
];

const corporateCardTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^TXN-CARD-\d{4}-\d{4,}$/,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    maskedCardNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^••••\s\d{4}$/,
    },

    cardholderUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    merchantName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    transactionDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    transactionTimestamp: {
      type: Date,
      required: true,
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },

    matchStatus: {
      type: String,
      required: true,
      enum: CARD_MATCH_STATUSES,
      default: 'UNMATCHED',
      index: true,
    },

    matchedExpenseId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    isPersonal: {
      type: Boolean,
      default: false,
    },

    personalPortionPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'corporate_card_transactions',
  }
);

corporateCardTransactionSchema.index(
  { organisationId: 1, cardholderUserId: 1, matchStatus: 1 },
  { name: 'card_txn_org_user_status' }
);

const CorporateCardTransaction = mongoose.model('CorporateCardTransaction', corporateCardTransactionSchema);

module.exports = {
  CorporateCardTransaction,
  CARD_MATCH_STATUSES,
};
