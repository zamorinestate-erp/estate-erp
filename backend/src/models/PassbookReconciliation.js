'use strict';

/**
 * PASSBOOK RECONCILIATION — MONGOOSE MODEL
 * Represents bank/account statement reconciliation sessions, matching statuses,
 * difference schedules, and balance confirmation sign-offs.
 */

const mongoose = require('mongoose');

const RECONCILIATION_STATUSES = [
  'NOT_STARTED',
  'UNRECONCILED',
  'IN_PROGRESS',
  'MATCHED',
  'PARTIALLY_MATCHED',
  'RECONCILED',
  'RECONCILED_WITH_OUTSTANDING',
  'EXCEPTION',
  'CONFIRMED',
];

const RECONCILING_ITEM_TYPES = [
  'CHEQUE_ISSUED_NOT_PRESENTED',
  'DEPOSIT_IN_TRANSIT',
  'BANK_CHARGE_NOT_RECORDED',
  'INTEREST_NOT_RECORDED',
  'DIRECT_BANK_CREDIT',
  'DIRECT_BANK_DEBIT',
  'RETURNED_INSTRUMENT',
  'TIMING_DIFFERENCE',
  'STATEMENT_ENTRY_MISSING_IN_ERP',
  'ERP_ENTRY_MISSING_IN_STATEMENT',
  'UNALLOCATED_SHARED_ENTRY',
  'POSSIBLE_DUPLICATE',
  'OTHER',
];

const reconcilingItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    type: { type: String, enum: RECONCILING_ITEM_TYPES, required: true },
    amountPaisa: { type: Number, required: true },
    explanation: { type: String, required: true },
    ageDays: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'RESOLVED', 'CARRIED_FORWARD'], default: 'OPEN' },
    relatedTxnId: { type: String, default: null },
    relatedStatementRowId: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: '' },
  },
  { _id: false }
);

const passbookReconciliationSchema = new mongoose.Schema(
  {
    reconciliationId: {
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

    periodId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    fiscalYear: {
      type: String,
      required: true,
      trim: true,
    },

    statementPeriodStart: {
      type: String,
      required: true,
    },

    statementPeriodEnd: {
      type: String,
      required: true,
    },

    openingBookBalancePaisa: {
      type: Number,
      required: true,
    },

    closingBookBalancePaisa: {
      type: Number,
      required: true,
    },

    openingStatementBalancePaisa: {
      type: Number,
      required: true,
    },

    closingStatementBalancePaisa: {
      type: Number,
      required: true,
    },

    differencePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    unexplainedDifferencePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    matchedCount: {
      type: Number,
      default: 0,
    },

    matchedAmountPaisa: {
      type: Number,
      default: 0,
    },

    unmatchedErpCount: {
      type: Number,
      default: 0,
    },

    unmatchedErpAmountPaisa: {
      type: Number,
      default: 0,
    },

    unmatchedStatementCount: {
      type: Number,
      default: 0,
    },

    unmatchedStatementAmountPaisa: {
      type: Number,
      default: 0,
    },

    reconcilingItems: {
      type: [reconcilingItemSchema],
      default: [],
    },

    status: {
      type: String,
      enum: RECONCILIATION_STATUSES,
      default: 'UNRECONCILED',
      index: true,
    },

    confirmedBy: {
      type: String,
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    reopenHistory: [
      {
        reopenedAt: { type: Date, default: Date.now },
        reopenedBy: { type: String, required: true },
        reopenReason: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'passbook_reconciliations',
  }
);

passbookReconciliationSchema.index({ organisationId: 1, accountId: 1, periodId: 1 }, { unique: true });

const PassbookReconciliation =
  mongoose.models.PassbookReconciliation ||
  mongoose.model('PassbookReconciliation', passbookReconciliationSchema);

module.exports = {
  PassbookReconciliation,
  RECONCILIATION_STATUSES,
  RECONCILING_ITEM_TYPES,
};
