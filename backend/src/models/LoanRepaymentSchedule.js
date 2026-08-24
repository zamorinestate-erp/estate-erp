'use strict';

/**
 * LOAN REPAYMENT SCHEDULE — MONGOOSE MODEL (SCR-014)
 *
 * Detailed instalment schedule for employee loans and advances.
 */

const mongoose = require('mongoose');

const SCHEDULE_STATUSES = [
  'UPCOMING',
  'PAID',
  'PARTIALLY_PAID',
  'DEFERRED',
  'PAUSED',
  'ARREARS',
  'CANCELLED',
];

const loanRepaymentScheduleSchema = new mongoose.Schema(
  {
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

    instalmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    duePayrollPeriod: {
      type: String, // e.g. "2026-08"
      required: true,
      trim: true,
    },

    principalPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    interestPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    expectedTotalPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    actualPaidPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceAfterPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: 'UPCOMING',
      index: true,
    },

    paidPayrollRunId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'loan_repayment_schedules',
  }
);

loanRepaymentScheduleSchema.index(
  { organisationId: 1, loanAdvanceId: 1, instalmentNumber: 1 },
  { unique: true }
);

const LoanRepaymentSchedule =
  mongoose.models.LoanRepaymentSchedule ||
  mongoose.model('LoanRepaymentSchedule', loanRepaymentScheduleSchema);

module.exports = {
  LoanRepaymentSchedule,
  SCHEDULE_STATUSES,
};
