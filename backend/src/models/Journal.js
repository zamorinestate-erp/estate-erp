'use strict';

const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema(
  {
    lineId: {
      type: String,
      required: true,
    },
    accountCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    debitPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    creditPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    dimensionCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    dimensionDepartment: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sourceReference: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const journalSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    journalId: {
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
    journalDate: {
      type: String,
      required: true,
      index: true,
    },
    journalType: {
      type: String,
      enum: [
        'SYSTEM',
        'MANUAL',
        'RECURRING',
        'ADJUSTMENT',
        'ACCRUAL',
        'REVERSAL',
        'CLOSING',
      ],
      default: 'MANUAL',
      index: true,
    },
    sourceModule: {
      type: String,
      enum: [
        'POS',
        'EXPENSES',
        'PROCUREMENT',
        'PAYROLL',
        'INVENTORY',
        'ASSETS',
        'BANK',
        'MANUAL',
      ],
      default: 'MANUAL',
      index: true,
    },
    sourceReferenceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    lines: {
      type: [journalLineSchema],
      required: true,
      validate: [
        (lines) => Array.isArray(lines) && lines.length >= 2,
        'A journal must contain at least 2 lines (double-entry).',
      ],
    },
    totalDebitPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCreditPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'PENDING_APPROVAL',
        'APPROVED',
        'POSTED',
        'REVERSED',
      ],
      default: 'DRAFT',
      index: true,
    },
    makerUserId: {
      type: String,
      required: true,
      trim: true,
    },
    checkerUserId: {
      type: String,
      trim: true,
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },
    postedBy: {
      type: String,
      trim: true,
      default: null,
    },
    reversedJournalId: {
      type: String,
      trim: true,
      default: null,
    },
    reversalReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

journalSchema.index(
  { organisationId: 1, journalId: 1 },
  { unique: true }
);

const Journal =
  mongoose.models.Journal || mongoose.model('Journal', journalSchema);

module.exports = {
  Journal,
};
