'use strict';

/**
 * LOAN TRANSACTION — MONGOOSE MODEL (SCR-014)
 *
 * Immutable financial ledger tracking all disbursements, payroll recoveries,
 * manual repayments, interest accruals, reversals, and settlements.
 */

const mongoose = require('mongoose');

const TRANSACTION_TYPES = [
  'DISBURSEMENT',
  'PAYROLL_REPAYMENT',
  'MANUAL_REPAYMENT',
  'INTEREST_ACCRUAL',
  'ADJUSTMENT',
  'REVERSAL',
  'SETTLEMENT',
  'WAIVER',
];

const TRANSACTION_STATUSES = ['POSTED', 'REVERSED', 'AWAITING_VERIFICATION'];

const loanTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^TXN-LN-\d{4,}/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    loanAdvanceId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    employeeUserId: {
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
      enum: TRANSACTION_TYPES,
      index: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    principalDeltaPaise: {
      type: Number,
      default: 0,
    },

    interestDeltaPaise: {
      type: Number,
      default: 0,
    },

    arrearsDeltaPaise: {
      type: Number,
      default: 0,
    },

    balanceAfterPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    payrollRunId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    payrollPeriod: {
      type: String,
      trim: true,
      default: null,
    },

    paymentReference: {
      type: String,
      trim: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: 'POSTED',
      index: true,
    },

    reversalOfTransactionId: {
      type: String,
      default: null,
    },

    verifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    performedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    postedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'loan_transactions',
  }
);

loanTransactionSchema.index({ organisationId: 1, loanAdvanceId: 1, postedAt: 1 });
loanTransactionSchema.index({ organisationId: 1, payrollRunId: 1, loanAdvanceId: 1 });

const LoanTransaction =
  mongoose.models.LoanTransaction || mongoose.model('LoanTransaction', loanTransactionSchema);

module.exports = {
  LoanTransaction,
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
};
