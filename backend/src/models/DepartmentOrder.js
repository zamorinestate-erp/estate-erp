'use strict';

/**
 * DEPARTMENT / INSTITUTIONAL ORDER — MONGOOSE MODEL (SCREEN 007)
 *
 * Implements Institutional Order Lifecycle Management:
 *   - Requests, Quotes, Institutional Accounts, PO Numbers, Headcount Tracking
 *   - Fulfilment Status, Receiving Contact, Proof of Fulfilment
 *   - Revisions History, Returnable Resources, Disputes, and Settlement References
 */

const mongoose = require('mongoose');

const ORDER_CATEGORIES = [
  'CONFERENCE',
  'FACULTY_MEETING',
  'EXECUTIVE_PROGRAMME',
  'SEMINAR',
  'WORKSHOP',
  'SPECIAL_EVENT',
  'OTHER',
];

const ORDER_STATUSES = [
  'DRAFT',
  'AWAITING_APPROVAL',
  'CONFIRMED',
  'SCHEDULED',
  'IN_FULFILMENT',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELLED',
  'CLOSED',
];

const FULFILMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_FULFILMENT',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELLED',
];

const CREDIT_STATUSES = [
  'PREPAID',
  'CREDIT_OPEN',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'OVERDUE',
  'DISPUTED',
];

const deptOrderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: String, trim: true, default: null },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, lowercase: true, default: 'units' },
    unitPricePaisa: { type: Number, required: true, min: 0, default: 0 },
    totalPaisa: { type: Number, required: true, min: 0, default: 0 },
    isSpecialItem: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: true }
);

const revisionSchema = new mongoose.Schema(
  {
    revisionNumber: { type: Number, required: true },
    field: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, required: true, trim: true },
    changedByUserId: { type: String, required: true, trim: true, uppercase: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const returnableResourceSchema = new mongoose.Schema(
  {
    resourceName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['ISSUED', 'RETURNED', 'OVERDUE', 'LOST'], default: 'ISSUED' },
    dueDate: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
  },
  { _id: true }
);

const settlementSchema = new mongoose.Schema(
  {
    settlementId: { type: String, required: true, trim: true },
    amountPaisa: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, enum: ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CREDIT_NOTE', 'CASH'], default: 'BANK_TRANSFER' },
    paymentReference: { type: String, trim: true, default: '' },
    settledAt: { type: Date, default: Date.now },
    recordedByUserId: { type: String, required: true, trim: true, uppercase: true },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const departmentOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^DO-\d{4}-\d{3,}$/,
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

    institutionName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    departmentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    careOfContact: {
      type: String,
      trim: true,
      default: '',
    },

    requesterName: {
      type: String,
      trim: true,
      default: '',
    },

    requesterContact: {
      type: String,
      trim: true,
      default: '',
    },

    approverName: {
      type: String,
      trim: true,
      default: '',
    },

    poNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },

    costCentre: {
      type: String,
      trim: true,
      default: '',
    },

    orderCategory: {
      type: String,
      enum: ORDER_CATEGORIES,
      default: 'CONFERENCE',
    },

    orderDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    fulfilmentDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    requestedTime: {
      type: String,
      trim: true,
      default: '10:00',
    },

    promisedTimeWindow: {
      type: String,
      trim: true,
      default: '09:50 - 10:10',
    },

    fulfilmentType: {
      type: String,
      enum: ['PICKUP', 'DELIVERY'],
      default: 'DELIVERY',
    },

    deliveryLocation: {
      building: { type: String, trim: true, default: '' },
      floor: { type: String, trim: true, default: '' },
      room: { type: String, trim: true, default: '' },
      deliveryPoint: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' },
    },

    headcount: {
      estimated: { type: Number, min: 0, default: 0 },
      guaranteed: { type: Number, min: 0, default: 0 },
      final: { type: Number, min: 0, default: 0 },
      actual: { type: Number, min: 0, default: 0 },
    },

    items: {
      type: [deptOrderItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item.',
      },
    },

    subtotalPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    discountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    taxPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    settledPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    orderStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'CONFIRMED',
      index: true,
    },

    fulfilmentStatus: {
      type: String,
      enum: FULFILMENT_STATUSES,
      default: 'SCHEDULED',
      index: true,
    },

    creditStatus: {
      type: String,
      enum: CREDIT_STATUSES,
      default: 'CREDIT_OPEN',
      index: true,
    },

    fulfilmentProof: {
      receivingContactName: { type: String, trim: true, default: '' },
      receivingSignature: { type: String, trim: true, default: '' },
      fulfilledAt: { type: Date, default: null },
      discrepancyNotes: { type: String, trim: true, default: '' },
      actualFulfilledItems: [
        {
          name: String,
          quantity: Number,
        },
      ],
    },

    revisions: {
      type: [revisionSchema],
      default: [],
    },

    returnableResources: {
      type: [returnableResourceSchema],
      default: [],
    },

    settlements: {
      type: [settlementSchema],
      default: [],
    },

    isInvoiceReady: {
      type: Boolean,
      default: true,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },

    notes: {
      internalNotes: { type: String, trim: true, maxlength: 2000, default: '' },
      institutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    },

    requestedByUserId: {
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
    optimisticConcurrency: true,
    collection: 'department_orders',
  }
);

departmentOrderSchema.virtual('outstandingBalancePaisa').get(function () {
  return Math.max(0, (this.totalPaisa || 0) - (this.settledPaisa || 0));
});

departmentOrderSchema.index(
  { organisationId: 1, institutionName: 1, orderDate: -1 },
  { name: 'org_institution_date_idx' }
);

departmentOrderSchema.index(
  { organisationId: 1, cafeId: 1, fulfilmentDate: 1, orderStatus: 1 },
  { name: 'org_cafe_fulfilment_idx' }
);

const DepartmentOrder =
  mongoose.models.DepartmentOrder ||
  mongoose.model('DepartmentOrder', departmentOrderSchema);

module.exports = {
  DepartmentOrder,
  ORDER_CATEGORIES,
  ORDER_STATUSES,
  FULFILMENT_STATUSES,
  CREDIT_STATUSES,
};
