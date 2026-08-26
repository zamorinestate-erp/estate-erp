'use strict';

/**
 * PASSBOOK MAPPING — MONGOOSE MODEL
 * Represents effective-dated café-to-account defaults for POS Cash, UPI, Card,
 * Petty Cash, Supplier Payments, and Payroll disbursements.
 */

const mongoose = require('mongoose');

const PAYMENT_CHANNELS = [
  'POS_CASH',
  'UPI_SETTLEMENT',
  'CARD_SETTLEMENT',
  'MARKETPLACE_SETTLEMENT',
  'PETTY_CASH',
  'SUPPLIER_PAYMENTS',
  'PAYROLL',
  'OTHER',
];

const passbookMappingSchema = new mongoose.Schema(
  {
    mappingId: {
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

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    channel: {
      type: String,
      required: true,
      enum: PAYMENT_CHANNELS,
      index: true,
    },

    accountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    isDefault: {
      type: Boolean,
      default: true,
    },

    effectiveFrom: {
      type: String,
      required: true,
    },

    effectiveTo: {
      type: String,
      default: null,
    },

    history: [
      {
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String, required: true },
        previousAccountId: { type: String, default: null },
        reason: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'passbook_mappings',
  }
);

passbookMappingSchema.index({ organisationId: 1, cafeId: 1, channel: 1, isDefault: 1 });

const PassbookMapping =
  mongoose.models.PassbookMapping ||
  mongoose.model('PassbookMapping', passbookMappingSchema);

module.exports = {
  PassbookMapping,
  PAYMENT_CHANNELS,
};
