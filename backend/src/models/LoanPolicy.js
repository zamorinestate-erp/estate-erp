'use strict';

/**
 * LOAN POLICY & STATUTORY PARAMETERS — MONGOOSE MODEL (SCR-014)
 *
 * Configurable loan eligibility, salary advance limits, interest rates,
 * and Code on Wages statutory 50% deduction ceiling parameters.
 */

const mongoose = require('mongoose');

const loanPolicySchema = new mongoose.Schema(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
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
      default: 'ZAMORIN',
      index: true,
    },

    policyVersion: {
      type: String,
      required: true,
      default: 'POL-LOAN-2026-V1',
    },

    maxLoanAmountPaise: {
      type: Number,
      default: 20000000, // ₹2,00,000
    },

    maxAdvanceAmountPaise: {
      type: Number,
      default: 5000000, // ₹50,000
    },

    minServiceMonths: {
      type: Number,
      default: 3,
    },

    maxTenureMonths: {
      type: Number,
      default: 24,
    },

    maxActiveLoansPerEmployee: {
      type: Number,
      default: 2,
    },

    statutoryDeductionCapPercent: {
      type: Number,
      default: 50, // 50% max under Code on Wages Section 18
      min: 10,
      max: 75,
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUPERSEDED'],
      default: 'ACTIVE',
      index: true,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'loan_policies',
  }
);

loanPolicySchema.index({ organisationId: 1, status: 1 });

const LoanPolicy =
  mongoose.models.LoanPolicy || mongoose.model('LoanPolicy', loanPolicySchema);

module.exports = {
  LoanPolicy,
};
