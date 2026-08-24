'use strict';

const mongoose = require('mongoose');

const financialPeriodSchema = new mongoose.Schema(
  {
    organisationId: {
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
      index: true,
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    periodName: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['FUTURE', 'OPEN', 'CLOSING', 'CLOSED', 'REOPENED'],
      default: 'OPEN',
      index: true,
    },
    closeSnapshot: {
      closedAt: { type: Date, default: null },
      closedBy: { type: String, default: null },
      trialBalanceHash: { type: String, default: null },
      totalRevenuePaisa: { type: Number, default: 0 },
      totalExpensePaisa: { type: Number, default: 0 },
      netResultPaisa: { type: Number, default: 0 },
      signOffNotes: { type: String, default: null },
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
  }
);

financialPeriodSchema.index(
  { organisationId: 1, periodId: 1 },
  { unique: true }
);

const FinancialPeriod =
  mongoose.models.FinancialPeriod ||
  mongoose.model('FinancialPeriod', financialPeriodSchema);

module.exports = {
  FinancialPeriod,
};
