'use strict';

/**
 * PURCHASE REQUISITION (PRQ) — MONGOOSE MODEL (PM-03)
 *
 * Internal department and café replenishment demand requests raised before
 * vendor purchase order commitment.
 */

const mongoose = require('mongoose');

const REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CONVERTED_TO_PO',
  'CANCELLED',
];

const REQUISITION_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
];

const prqLineItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    itemNameSnapshot: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    uom: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
      default: 'unit',
    },
    estimatedUnitPricePaisa: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalEstimatedPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },
    preferredVendorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { _id: true }
);

const purchaseRequisitionSchema = new mongoose.Schema(
  {
    requisitionId: {
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
    },

    cafeId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    requesterId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    priority: {
      type: String,
      enum: REQUISITION_PRIORITIES,
      default: 'NORMAL',
    },

    status: {
      type: String,
      required: true,
      enum: REQUISITION_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    estimatedAmountPaise: {
      type: Number,
      min: 0,
      default: 0,
    },

    requiredByDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    items: {
      type: [prqLineItemSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    approvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    rejectedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    convertedPurchaseOrderId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    convertedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'purchase_requisitions',
  }
);

purchaseRequisitionSchema.index(
  { organisationId: 1, cafeId: 1, status: 1, createdAt: -1 },
  { name: 'org_cafe_status_date' }
);

purchaseRequisitionSchema.pre('validate', function normalisePrqFields(next) {
  const upperFields = [
    'requisitionId', 'organisationId', 'cafeId', 'requesterId',
    'approvedByUserId', 'rejectedByUserId', 'convertedPurchaseOrderId'
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
  if (typeof next === 'function') next();
});

const PurchaseRequisition =
  mongoose.models.PurchaseRequisition ||
  mongoose.model('PurchaseRequisition', purchaseRequisitionSchema);

module.exports = {
  PurchaseRequisition,
  REQUISITION_STATUSES,
  REQUISITION_PRIORITIES,
};
