'use strict';

/**
 * WORK ORDER — MONGOOSE MODEL (SCREEN 003: EQUIPMENT & ASSET MANAGEMENT)
 */

const mongoose = require('mongoose');

const WORK_ORDER_TYPES = [
  'PREVENTIVE_MAINTENANCE',
  'CORRECTIVE_REPAIR',
  'INSPECTION',
  'CALIBRATION',
  'INSTALLATION',
  'DECOMMISSIONING',
];

const WORK_ORDER_SOURCES = [
  'MANUAL_ISSUE',
  'PM_PLAN',
  'INSPECTION_FAILURE',
  'METER_THRESHOLD',
  'FOLLOW_UP',
  'WARRANTY_CLAIM',
  'ASSET_REVIEW',
  'OTHER',
];

const WORK_ORDER_PRIORITIES = [
  'CRITICAL',
  'URGENT',
  'NORMAL',
  'LOW',
];

const WORK_ORDER_STATUSES = [
  'OPEN',
  'TRIAGED',
  'PLANNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'WAITING_VENDOR',
  'COMPLETED',
  'VERIFIED',
  'CLOSED',
  'CANCELLED',
];

const WORK_ORDER_BLOCKERS = [
  'NONE',
  'WAITING_FOR_PART',
  'WAITING_FOR_VENDOR',
  'AWAITING_CAFE_ACCESS',
  'AWAITING_APPROVAL',
  'SAFETY_HOLD',
  'OTHER',
];

const partConsumedSchema = new mongoose.Schema(
  {
    itemId: { type: String, trim: true, uppercase: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unit: { type: String, trim: true, default: 'PCS' },
    costPaisa: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const workOrderSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^WO-\d{4,}$/,
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

    assetId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    workType: {
      type: String,
      enum: WORK_ORDER_TYPES,
      default: 'CORRECTIVE_REPAIR',
      index: true,
    },

    source: {
      type: String,
      enum: WORK_ORDER_SOURCES,
      default: 'MANUAL_ISSUE',
    },

    priority: {
      type: String,
      enum: WORK_ORDER_PRIORITIES,
      default: 'NORMAL',
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: WORK_ORDER_STATUSES,
      default: 'OPEN',
      index: true,
    },

    blocker: {
      type: String,
      enum: WORK_ORDER_BLOCKERS,
      default: 'NONE',
    },

    blockerNotes: {
      type: String,
      trim: true,
      default: '',
    },

    reportedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    assignedExecutionType: {
      type: String,
      enum: ['INTERNAL_USER', 'EXTERNAL_VENDOR', 'UNASSIGNED'],
      default: 'UNASSIGNED',
    },

    assignedUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    vendorId: {
      type: String,
      trim: true,
      default: null,
    },

    technicianName: {
      type: String,
      trim: true,
      default: '',
    },

    plannedStartDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    dueDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    actualStartDate: {
      type: Date,
      default: null,
    },

    actualCompletionDate: {
      type: Date,
      default: null,
    },

    downtimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    isPlannedShutdown: {
      type: Boolean,
      default: false,
    },

    costPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    partsCostPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    externalServiceCostPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    parts: [partConsumedSchema],

    failureAnalysis: {
      problem: { type: String, trim: true, default: '' },
      cause: { type: String, trim: true, default: '' },
      rootCause: { type: String, trim: true, default: '' },
      remedy: { type: String, trim: true, default: '' },
      resultRestored: { type: Boolean, default: true },
    },

    completionNotes: {
      type: String,
      trim: true,
      default: '',
    },

    completionEvidence: [
      {
        evidenceType: { type: String, default: 'PHOTO' },
        name: { type: String, trim: true },
        url: { type: String, trim: true },
      },
    ],

    verifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    isSafetyHoldTriggered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'work_orders',
  }
);

workOrderSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

workOrderSchema.index(
  { organisationId: 1, assetId: 1, status: 1 },
  { name: 'org_asset_status' }
);

const WorkOrder =
  mongoose.models.WorkOrder ||
  mongoose.model('WorkOrder', workOrderSchema);

module.exports = {
  WorkOrder,
  WORK_ORDER_TYPES,
  WORK_ORDER_SOURCES,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_BLOCKERS,
};
