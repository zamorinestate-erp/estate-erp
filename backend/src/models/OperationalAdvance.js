'use strict';

const mongoose = require('mongoose');

const OPERATIONAL_ADVANCE_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'DISBURSED',
  'PARTIALLY_LIQUIDATED',
  'FULLY_LIQUIDATED',
  'CLOSED',
];

const operationalAdvanceSchema = new mongoose.Schema(
  {
    advanceId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^ADV-OP-\d{4}-\d{4,}$/,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    recipientUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    liquidatedAmountPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnedBalancePaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      required: true,
      enum: OPERATIONAL_ADVANCE_STATUSES,
      default: 'DISBURSED',
      index: true,
    },

    disbursedAt: {
      type: Date,
      default: Date.now,
    },

    returnDueDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    liquidatedExpenseIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'operational_advances',
  }
);

operationalAdvanceSchema.index(
  { organisationId: 1, recipientUserId: 1, status: 1 },
  { name: 'op_advance_org_user_status' }
);

const OperationalAdvance = mongoose.model('OperationalAdvance', operationalAdvanceSchema);

module.exports = {
  OperationalAdvance,
  OPERATIONAL_ADVANCE_STATUSES,
};
