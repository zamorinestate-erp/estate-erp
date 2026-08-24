'use strict';

const mongoose = require('mongoose');

const EXPENSE_POLICY_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'SUPERSEDED',
  'RETIRED',
];

const categoryRuleSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    maxAmountPaisa: {
      type: Number,
      default: null,
    },
    receiptRequired: {
      type: Boolean,
      default: true,
    },
    poRequiredThresholdPaisa: {
      type: Number,
      default: 5000000, // 50,000 INR
    },
    requiresJustification: {
      type: Boolean,
      default: false,
    },
    allowedPaymentSources: {
      type: [String],
      default: ['COMPANY_BANK_UPI', 'CASH', 'PETTY_CASH', 'CORPORATE_CARD', 'EMPLOYEE_FUNDS'],
    },
  },
  { _id: false }
);

const expensePolicySchema = new mongoose.Schema(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    version: {
      type: String,
      required: true,
      trim: true,
    },

    policyName: {
      type: String,
      required: true,
      trim: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    receiptThresholdPaisa: {
      type: Number,
      default: 50000, // 500 INR
    },

    poRequiredThresholdPaisa: {
      type: Number,
      default: 5000000, // 50,000 INR
    },

    autoAuditPercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },

    categoryRules: {
      type: [categoryRuleSchema],
      default: [],
    },

    status: {
      type: String,
      required: true,
      enum: EXPENSE_POLICY_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    effectiveFrom: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    publishedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'expense_policies',
  }
);

expensePolicySchema.index(
  { organisationId: 1, status: 1 },
  { name: 'expense_policy_org_status' }
);

const ExpensePolicy = mongoose.model('ExpensePolicy', expensePolicySchema);

module.exports = {
  ExpensePolicy,
  EXPENSE_POLICY_STATUSES,
};
