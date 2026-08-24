'use strict';

/**
 * Delegation — SCR-023
 *
 * Scoped Out-of-Office and workflow coverage delegation model.
 *
 * RULES:
 *   1. Scoped to specific workflows only (never "delegate entire account").
 *   2. Delegate uses their own authenticated account.
 *   3. No password or session sharing.
 *   4. Delegator cannot delegate to themselves.
 *   5. Auto-activates and expires based on startDate / endDate.
 *   6. Can be revoked early by the delegator.
 *   7. Full audit trail for all delegations and actions taken under delegation.
 */

const mongoose = require('mongoose');

const DELEGATION_SCOPES = [
  'PROCUREMENT_APPROVAL',
  'EXPENSE_APPROVAL',
  'DEPARTMENT_ORDER_APPROVAL',
  'SHIFT_COVERAGE',
  'LEAVE_APPROVAL',
];

const DELEGATION_STATUSES = [
  'ACTIVE',
  'SCHEDULED',
  'EXPIRED',
  'REVOKED',
];

const delegationSchema = new mongoose.Schema(
  {
    delegationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^DEL-\d{6}-\d{5}$/,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    delegatorUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    delegateUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    delegateName: {
      type: String,
      trim: true,
      default: '',
    },

    scope: {
      type: String,
      required: true,
      enum: DELEGATION_SCOPES,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: DELEGATION_STATUSES,
      default: 'SCHEDULED',
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedByUserId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'delegations',
  }
);

delegationSchema.index({ delegatorUserId: 1, status: 1 });
delegationSchema.index({ delegateUserId: 1, status: 1 });
delegationSchema.index({ organisationId: 1, status: 1 });

/**
 * Determine effective status based on current date
 */
delegationSchema.methods.calculateStatus = function (at = new Date()) {
  if (this.revokedAt) return 'REVOKED';
  if (at > this.endDate) return 'EXPIRED';
  if (at >= this.startDate && at <= this.endDate) return 'ACTIVE';
  return 'SCHEDULED';
};

const Delegation = mongoose.model('Delegation', delegationSchema);

module.exports = {
  Delegation,
  DELEGATION_SCOPES,
  DELEGATION_STATUSES,
};
