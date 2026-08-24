'use strict';

const mongoose = require('mongoose');

const chartOfAccountSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    accountCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
      index: true,
    },
    accountGroup: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    parentAccountCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    controlAccountType: {
      type: String,
      enum: [
        'NONE',
        'ACCOUNTS_RECEIVABLE',
        'ACCOUNTS_PAYABLE',
        'INVENTORY_CONTROL',
        'PAYROLL_CLEARING',
        'TAX_CONTROL',
        'CARD_CLEARING',
        'MARKETPLACE_CLEARING',
      ],
      default: 'NONE',
    },
    isPostingAllowed: {
      type: Boolean,
      default: true,
    },
    reconciliationRequired: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    effectiveFrom: {
      type: String,
      required: true,
    },
    effectiveTo: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

chartOfAccountSchema.index(
  { organisationId: 1, accountCode: 1 },
  { unique: true }
);

const ChartOfAccount =
  mongoose.models.ChartOfAccount ||
  mongoose.model('ChartOfAccount', chartOfAccountSchema);

module.exports = {
  ChartOfAccount,
};
