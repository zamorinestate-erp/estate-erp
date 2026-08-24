'use strict';

/**
 * LEASED OUTLET / COMMERCIAL SPACE — MONGOOSE MODEL (SCR-026)
 * Represents a physical or designated commercial space (kiosk, counter, stall, café space)
 * that Zamorin leases to an external operator under a Revenue Share Agreement.
 */

const mongoose = require('mongoose');

const OUTLET_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'FIT_OUT',
  'OCCUPIED',
  'TEMPORARILY_CLOSED',
  'VACANT',
  'MAINTENANCE',
  'DECOMMISSIONED',
];

const SPACE_TYPES = ['KIOSK', 'COUNTER', 'STALL', 'DEDICATED_SPACE', 'POP_UP', 'DRIVE_THRU'];

const leasedOutletSchema = new mongoose.Schema(
  {
    outletId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^LO-\d{4,}$/,
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

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    spaceType: {
      type: String,
      enum: SPACE_TYPES,
      default: 'COUNTER',
    },

    zoneFloor: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Ground Floor',
    },

    stallNumber: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    areaSqFt: {
      type: Number,
      min: 0,
      default: 0,
    },

    permittedCategory: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Food & Beverage',
    },

    status: {
      type: String,
      enum: OUTLET_STATUSES,
      default: 'AVAILABLE',
      index: true,
    },

    currentOperatorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    currentAgreementId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    utilityMeters: [
      {
        meterId: { type: String, trim: true, uppercase: true },
        utilityType: { type: String, enum: ['ELECTRICITY', 'WATER', 'GAS', 'CAM'], default: 'ELECTRICITY' },
        meterNumber: { type: String, trim: true },
        initialReading: { type: Number, default: 0 },
        currentReading: { type: Number, default: 0 },
        multiplier: { type: Number, default: 1 },
        status: { type: String, enum: ['ACTIVE', 'FAULTY', 'DISCONNECTED'], default: 'ACTIVE' },
      },
    ],

    occupancyHistory: [
      {
        operatorId: { type: String, trim: true, uppercase: true },
        operatorNameSnapshot: { type: String, trim: true },
        agreementId: { type: String, trim: true, uppercase: true },
        commencementDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        vacatedDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
        exitReason: { type: String, trim: true, default: '' },
      },
    ],

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'leased_outlets',
  }
);

leasedOutletSchema.index({ organisationId: 1, cafeId: 1, status: 1 });
leasedOutletSchema.index({ organisationId: 1, currentOperatorId: 1 });

const LeasedOutlet =
  mongoose.models.LeasedOutlet || mongoose.model('LeasedOutlet', leasedOutletSchema);

module.exports = {
  LeasedOutlet,
  OUTLET_STATUSES,
  SPACE_TYPES,
};
