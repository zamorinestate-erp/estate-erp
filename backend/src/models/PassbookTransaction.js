'use strict';

/**
 * PASSBOOK TRANSACTION — MONGOOSE MODEL
 * Represents authoritative, immutable money movements through Passbook accounts.
 * Includes deterministic sequence ordering, running balance after each row,
 * structured payment modes, multi-café allocations, and source linkages.
 */

const mongoose = require('mongoose');

const TRANSACTION_TYPES = [
  'OPENING_BALANCE',
  'EXTERNAL_INCOME',
  'EXTERNAL_EXPENSE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'INTER_CAFE_TRANSFER_IN',
  'INTER_CAFE_TRANSFER_OUT',
  'BALANCE_ADJUSTMENT',
  'BANK_CHARGE',
  'INTEREST_INCOME',
  'INTEREST_EXPENSE',
  'REFUND_IN',
  'REFUND_OUT',
  'CASH_DEPOSIT',
  'CASH_WITHDRAWAL',
  'SETTLEMENT',
  'REVERSAL',
  'MIGRATED',
  'OTHER',
];

const PAYMENT_MODES = [
  'CASH',
  'UPI',
  'NEFT',
  'RTGS',
  'IMPS',
  'CARD',
  'CHEQUE',
  'DEMAND_DRAFT',
  'BANK_TRANSFER',
  'MARKETPLACE_SETTLEMENT',
  'INTERNAL_TRANSFER',
  'OTHER',
];

const SOURCE_TYPES = [
  'MANUAL',
  'ERP_GENERATED',
  'STATEMENT_IMPORT',
  'RECONCILIATION_ADJUSTMENT',
  'MIGRATED',
  'CASH_BOOK',
  'EXPENSE',
  'BILL',
  'PAYROLL',
  'PERSONAL_LEDGER',
  'REVENUE_SHARE',
];

const TRANSACTION_STATUSES = [
  'DRAFT',
  'POSTED',
  'IN_TRANSIT',
  'CLEARED',
  'REVERSED',
  'CANCELLED',
];

const RECONCILIATION_STATUSES = [
  'UNRECONCILED',
  'MATCHED',
  'PARTIALLY_MATCHED',
  'CONFIRMED',
  'EXCEPTION',
];

const allocationSchema = new mongoose.Schema(
  {
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: 'application/pdf' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const passbookTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
      default: 'ZAMORIN',
    },

    accountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    postingSequence: {
      type: Number,
      required: true,
      index: true,
    },

    businessDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    postingDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    valueDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    type: {
      type: String,
      required: true,
      enum: TRANSACTION_TYPES,
      index: true,
    },

    direction: {
      type: String,
      required: true,
      enum: ['CREDIT', 'DEBIT'],
      index: true,
    },

    // Amount stored in integer paise
    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    runningBalancePaisa: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      required: true,
      enum: ['INR'],
      default: 'INR',
      immutable: true,
    },

    paymentMode: {
      type: String,
      enum: PAYMENT_MODES,
      default: 'BANK_TRANSFER',
    },

    remitter: {
      type: String,
      trim: true,
      default: '',
    },

    beneficiary: {
      type: String,
      trim: true,
      default: '',
    },

    counterpartyType: {
      type: String,
      trim: true,
      default: null,
    },

    counterpartyId: {
      type: String,
      trim: true,
      default: null,
    },

    externalReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    narration: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      default: 'GENERAL',
      index: true,
    },

    sourceType: {
      type: String,
      required: true,
      enum: SOURCE_TYPES,
      default: 'MANUAL',
      index: true,
    },

    sourceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    journalId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    journalLineId: {
      type: String,
      trim: true,
      default: null,
    },

    correlationId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    transferId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    economicCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ALL',
      index: true,
    },

    allocations: {
      type: [allocationSchema],
      default: [],
    },

    reconciliationStatus: {
      type: String,
      enum: RECONCILIATION_STATUSES,
      default: 'UNRECONCILED',
      index: true,
    },

    reconciledStatementRowId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: 'POSTED',
      index: true,
    },

    reversalOf: {
      type: String,
      default: null,
    },

    reversalTransactionId: {
      type: String,
      default: null,
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    isBackdated: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    tags: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'passbook_transactions',
  }
);

passbookTransactionSchema.index({ organisationId: 1, accountId: 1, postingDate: -1, postingSequence: -1 });
passbookTransactionSchema.index({ organisationId: 1, economicCafeId: 1, postingDate: -1 });
passbookTransactionSchema.index({ organisationId: 1, sourceType: 1, sourceId: 1 });
passbookTransactionSchema.index({ organisationId: 1, transferId: 1 });

const PassbookTransaction =
  mongoose.models.PassbookTransaction ||
  mongoose.model('PassbookTransaction', passbookTransactionSchema);

module.exports = {
  PassbookTransaction,
  TRANSACTION_TYPES,
  PAYMENT_MODES,
  SOURCE_TYPES,
  TRANSACTION_STATUSES,
  RECONCILIATION_STATUSES,
};
