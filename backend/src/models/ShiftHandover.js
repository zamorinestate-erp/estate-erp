'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — SHIFT HANDOVER MONGOOSE MODEL (R02-07)
 * ============================================================================
 * Captures formal shift handovers between outgoing and incoming shift leads:
 * cash drawer reconciliation, food safety checklists, pending tasks,
 * equipment issues, and dual-signoff acknowledgements.
 */

const mongoose = require('mongoose');

const HANDOVER_TYPES = [
  'OPENING',
  'HANDOVER',
  'CLOSING',
];

const SHIFT_TYPES = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'NIGHT',
  'CUSTOM',
];

const ACKNOWLEDGEMENT_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'DISPUTED',
];

const shiftHandoverSchema = new mongoose.Schema(
  {
    handoverId: {
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
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    handoverType: {
      type: String,
      enum: HANDOVER_TYPES,
      required: true,
      default: 'HANDOVER',
    },

    shiftType: {
      type: String,
      enum: SHIFT_TYPES,
      required: true,
      default: 'MORNING',
    },

    handoverDate: {
      type: String,
      required: true,
      index: true,
    },

    handingOverUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    receivingUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    cashDrawer: {
      openingFloatPaisa: { type: Number, default: 0 },
      countedCashPaisa: { type: Number, default: 0 },
      expectedCashPaisa: { type: Number, default: 0 },
      variancePaisa: { type: Number, default: 0 },
      varianceReason: { type: String, trim: true, default: '' },
      cashDropPaisa: { type: Number, default: 0 },
      pettyCashRemainingPaisa: { type: Number, default: 0 },
    },

    operationalChecklist: {
      cleaningCompleted: { type: Boolean, default: false },
      temperaturesLogged: { type: Boolean, default: false },
      foodWasteLogged: { type: Boolean, default: false },
      posReconciled: { type: Boolean, default: false },
      stockReplenished: { type: Boolean, default: false },
    },

    equipmentStatusNotes: {
      type: String,
      trim: true,
      default: '',
    },

    stockIssuesNotes: {
      type: String,
      trim: true,
      default: '',
    },

    pendingOrdersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    managerNotes: {
      type: String,
      trim: true,
      default: '',
    },

    acknowledgementStatus: {
      type: String,
      enum: ACKNOWLEDGEMENT_STATUSES,
      default: 'PENDING',
      index: true,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },

    disputeReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

shiftHandoverSchema.index(
  { organisationId: 1, cafeId: 1, handoverDate: -1 },
  { name: 'idx_handover_org_cafe_date' }
);
shiftHandoverSchema.index(
  { organisationId: 1, cafeId: 1, acknowledgementStatus: 1 },
  { name: 'idx_handover_org_cafe_status' }
);

const ShiftHandover = mongoose.model('ShiftHandover', shiftHandoverSchema);

module.exports = {
  ShiftHandover,
  HANDOVER_TYPES,
  SHIFT_TYPES,
  ACKNOWLEDGEMENT_STATUSES,
};
