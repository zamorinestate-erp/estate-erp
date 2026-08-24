'use strict';

/**
 * SECURITY DEPOSIT — MONGOOSE MODEL (SCR-026)
 * Governs the security deposit lifecycle for leased outlets (required, received, held, top-up alerts, authorized deductions, refund processing).
 */

const mongoose = require('mongoose');

const DEPOSIT_STATUSES = ['REQUIRED', 'HELD_ACTIVE', 'TOP_UP_DUE', 'DEDUCTION_PENDING', 'REFUND_PENDING', 'REFUNDED', 'FORFEITED'];

const securityDepositSchema = new mongoose.Schema(
  {
    depositId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^DEP-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    operatorId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    outletId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    agreementId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    requiredAmountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    heldBalancePaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    totalDeductionsPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalRefundedPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: DEPOSIT_STATUSES,
      default: 'REQUIRED',
      index: true,
    },

    ledgerTransactions: [
      {
        transactionType: {
          type: String,
          enum: ['INITIAL_DEPOSIT', 'TOP_UP', 'DAMAGE_DEDUCTION', 'DEFAULT_DEDUCTION', 'REFUND'],
        },
        amountPaisa: { type: Number, required: true },
        balanceAfterPaisa: { type: Number, required: true },
        referenceDoc: { type: String, trim: true },
        authorizedByUserId: { type: String, trim: true },
        reason: { type: String, trim: true },
        recordedAt: { type: Date, default: Date.now },
      },
    ],

    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'security_deposits',
  }
);

securityDepositSchema.index({ organisationId: 1, agreementId: 1 }, { unique: true });

const SecurityDeposit =
  mongoose.models.SecurityDeposit ||
  mongoose.model('SecurityDeposit', securityDepositSchema);

module.exports = {
  SecurityDeposit,
  DEPOSIT_STATUSES,
};
