'use strict';

/**
 * PASSBOOK ACCOUNT MASTER — MONGOOSE MODEL
 * Represents Bank, Cash, Petty Cash, Settlement & Internal Treasury Accounts.
 * Supports Multi-Café Scopes: CAFE_SPECIFIC, ORGANISATION_GLOBAL, SHARED_MULTI_CAFE.
 * Currency: INR only. All monetary amounts stored as integer paise (1 INR = 100 paise).
 */

const mongoose = require('mongoose');

const ACCOUNT_TYPES = [
  'BANK_OPERATING',
  'CASH_IN_HAND',
  'PETTY_CASH',
  'PAYROLL',
  'RESERVE',
  'SETTLEMENT_CLEARING',
  'MARKETPLACE_CLEARING',
  'INTERNAL_FUND',
  'DEPOSIT_IN_TRANSIT',
  'OTHER',
];

const BANK_SUBTYPES = [
  'CURRENT',
  'SAVINGS',
  'CASH_CREDIT',
  'OVERDRAFT',
  'TERM_DEPOSIT',
  'NOT_APPLICABLE',
];

const SCOPE_TYPES = [
  'CAFE_SPECIFIC',
  'ORGANISATION_GLOBAL',
  'SHARED_MULTI_CAFE',
];

const ACCOUNT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'CLOSED',
  'ARCHIVED',
];

const RECONCILIATION_CADENCES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'PER_STATEMENT',
  'CUSTOM',
];

const passbookAccountSchema = new mongoose.Schema(
  {
    accountId: {
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

    nickname: {
      type: String,
      trim: true,
      default: '',
    },

    accountType: {
      type: String,
      required: true,
      enum: ACCOUNT_TYPES,
      default: 'BANK_OPERATING',
      index: true,
    },

    bankSubtype: {
      type: String,
      enum: BANK_SUBTYPES,
      default: 'CURRENT',
    },

    scopeType: {
      type: String,
      required: true,
      enum: SCOPE_TYPES,
      default: 'CAFE_SPECIFIC',
      index: true,
    },

    assignedCafeIds: {
      type: [String],
      default: [],
      index: true,
    },

    primaryCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    institutionName: {
      type: String,
      trim: true,
      default: '',
    },

    branchName: {
      type: String,
      trim: true,
      default: '',
    },

    maskedAccountNumber: {
      type: String,
      required: true,
      trim: true,
    },

    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },

    currency: {
      type: String,
      required: true,
      enum: ['INR'],
      default: 'INR',
      immutable: true,
    },

    // Integer paisa monetary balances
    bookBalancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    verifiedStatementBalancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    reservedPaisa: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    freeBalancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    openingDate: {
      type: String,
      required: true,
      default: () => new Date().toISOString().slice(0, 10),
    },

    openingBalancePaisa: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    purpose: {
      type: String,
      trim: true,
      default: 'OPERATING',
    },

    reconciliationCadence: {
      type: String,
      enum: RECONCILIATION_CADENCES,
      default: 'MONTHLY',
    },

    lastReconciledDate: {
      type: String,
      default: null,
    },

    lastStatementDate: {
      type: String,
      default: null,
    },

    lastTransactionDate: {
      type: String,
      default: null,
    },

    thresholds: {
      minPreferredBalancePaisa: { type: Number, default: 0 },
      maxPettyCashPaisa: { type: Number, default: 5000000 }, // 50,000 INR
      largeTxnThresholdPaisa: { type: Number, default: 10000000 }, // 100,000 INR
    },

    imprestLimitPaisa: {
      type: Number,
      default: 0,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'passbook_accounts',
  }
);

passbookAccountSchema.index({ organisationId: 1, accountId: 1 }, { unique: true });
passbookAccountSchema.index({ organisationId: 1, accountCode: 1 }, { unique: true });
passbookAccountSchema.index({ organisationId: 1, scopeType: 1, status: 1 });

const PassbookAccount =
  mongoose.models.PassbookAccount ||
  mongoose.model('PassbookAccount', passbookAccountSchema);

module.exports = {
  PassbookAccount,
  ACCOUNT_TYPES,
  BANK_SUBTYPES,
  SCOPE_TYPES,
  ACCOUNT_STATUSES,
  RECONCILIATION_CADENCES,
};
