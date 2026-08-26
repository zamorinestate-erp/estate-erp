'use strict';

/**
 * PASSBOOK RESERVATION — MONGOOSE MODEL
 * Represents committed/earmarked funds (Payroll, Taxes, Supplier Bills, Rent, Maintenance, Capex, Emergency).
 * Reduces Free/Available Balance without mutating authoritative ERP Book Balance.
 */

const mongoose = require('mongoose');

const RESERVATION_PURPOSES = [
  'PAYROLL',
  'SUPPLIER_PAYMENTS',
  'RENT',
  'TAX',
  'MAINTENANCE',
  'CAPEX',
  'EMERGENCY_RESERVE',
  'OTHER',
];

const RESERVATION_STATUSES = [
  'ACTIVE',
  'PARTIALLY_USED',
  'CONSUMED',
  'RELEASED',
  'CANCELLED',
];

const passbookReservationSchema = new mongoose.Schema(
  {
    reservationId: {
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

    accountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ALL',
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    purpose: {
      type: String,
      required: true,
      enum: RESERVATION_PURPOSES,
      default: 'SUPPLIER_PAYMENTS',
      index: true,
    },

    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    utilizedPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    releasedPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    effectiveDate: {
      type: String,
      required: true,
    },

    expiryDate: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    linkedObligationType: {
      type: String,
      trim: true,
      default: null,
    },

    linkedObligationId: {
      type: String,
      trim: true,
      default: null,
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
    collection: 'passbook_reservations',
  }
);

passbookReservationSchema.index({ organisationId: 1, accountId: 1, status: 1 });

const PassbookReservation =
  mongoose.models.PassbookReservation ||
  mongoose.model('PassbookReservation', passbookReservationSchema);

module.exports = {
  PassbookReservation,
  RESERVATION_PURPOSES,
  RESERVATION_STATUSES,
};
