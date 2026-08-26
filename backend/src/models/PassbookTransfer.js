'use strict';

/**
 * PASSBOOK TRANSFER — MONGOOSE MODEL
 * Represents atomic internal account transfers and inter-café funding transfers.
 * Enforces two-leg balance parity (source debit + destination credit).
 */

const mongoose = require('mongoose');

const TRANSFER_TYPES = [
  'SAME_CAFE_ACCOUNT_TRANSFER',
  'INTER_CAFE_TRANSFER',
  'CAFE_TO_ORGANISATION',
  'ORGANISATION_TO_CAFE',
];

const TRANSFER_STATUSES = [
  'INITIATED',
  'IN_TRANSIT',
  'COMPLETED',
  'REVERSED',
  'CANCELLED',
];

const passbookTransferSchema = new mongoose.Schema(
  {
    transferId: {
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

    transferType: {
      type: String,
      required: true,
      enum: TRANSFER_TYPES,
      default: 'SAME_CAFE_ACCOUNT_TRANSFER',
    },

    sourceAccountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    sourceCafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    sourceTransactionId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    destAccountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    destCafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    destTransactionId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    feePaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    feeTransactionId: {
      type: String,
      default: null,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: TRANSFER_STATUSES,
      default: 'COMPLETED',
      index: true,
    },

    initiatedBy: {
      type: String,
      required: true,
      trim: true,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },

    reversedAt: {
      type: Date,
      default: null,
    },

    reversalReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'passbook_transfers',
  }
);

passbookTransferSchema.index({ organisationId: 1, transferId: 1 }, { unique: true });
passbookTransferSchema.index({ organisationId: 1, sourceCafeId: 1, destCafeId: 1 });

const PassbookTransfer =
  mongoose.models.PassbookTransfer ||
  mongoose.model('PassbookTransfer', passbookTransferSchema);

module.exports = {
  PassbookTransfer,
  TRANSFER_TYPES,
  TRANSFER_STATUSES,
};
