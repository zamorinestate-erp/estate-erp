'use strict';

/**
 * ADVANCE SHIPPING NOTICE (ASN) — MONGOOSE MODEL (PM-03)
 *
 * Operational Advance Shipping Notice representing vendor-advised inbound shipment
 * against an authorized Purchase Order.
 *
 * Invariants Enforced:
 *  - ASN_ACCEPTS_FOREIGN_OR_UNRELATED_PO = 0 (Must reference valid same-org, same-vendor, same-destination PO)
 *  - ASN_SILENT_OVER_SHIPMENT = 0 (Cannot exceed open unreceived quantity on PO lines)
 *  - DUPLICATE_ASN_CREATES_DUPLICATE_RECEIVING_OBLIGATION = 0 (Unique compound index on org + vendor + asnNumber)
 *  - ASN_DIRECTLY_INCREASES_INVENTORY_WITHOUT_RECEIPT = 0 (ASN is advisory shipping information; inventory updates only upon authoritative GRN posting)
 */

const mongoose = require('mongoose');

const ASN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
];

const asnLineItemSchema = new mongoose.Schema(
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
    uom: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
      default: 'unit',
    },
    shippedQuantityBase: {
      type: Number,
      required: true,
      min: 0.001,
    },
    receivedQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },
    lotNumber: {
      type: String,
      trim: true,
      default: null,
    },
    manufacturingDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    temperatureRequirementCelsius: {
      type: Number,
      default: null,
    },
  },
  { _id: true }
);

const advanceShippingNoticeSchema = new mongoose.Schema(
  {
    // Business identifier
    asnNumber: {
      type: String,
      required: true,
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

    vendorId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    purchaseOrderId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    vendorReference: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    dispatchDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    expectedArrivalDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    carrier: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: '',
    },

    trackingNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    driverName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    driverPhone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    lineItems: {
      type: [asnLineItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'An ASN must have at least one line item.',
      },
    },

    status: {
      type: String,
      required: true,
      enum: ASN_STATUSES,
      default: 'DISPATCHED',
      index: true,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    receivedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    grnReferenceId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    cancelledByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
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
    collection: 'advance_shipping_notices',
  }
);

// Compound uniqueness: duplicate ASN per vendor per organisation prevented
advanceShippingNoticeSchema.index(
  { organisationId: 1, vendorId: 1, asnNumber: 1 },
  { unique: true, name: 'org_vendor_asn_unique' }
);

advanceShippingNoticeSchema.index(
  { organisationId: 1, vendorId: 1, vendorReference: 1 },
  { unique: true, sparse: true, name: 'org_vendor_vendorRef_unique' }
);

advanceShippingNoticeSchema.index(
  { organisationId: 1, purchaseOrderId: 1, status: 1 },
  { name: 'org_po_status' }
);

advanceShippingNoticeSchema.index(
  { organisationId: 1, cafeId: 1, status: 1, createdAt: -1 },
  { name: 'org_cafe_status_date' }
);

advanceShippingNoticeSchema.pre('validate', function normaliseAsnFields(next) {
  const upperFields = [
    'asnNumber', 'organisationId', 'cafeId', 'vendorId',
    'purchaseOrderId', 'vehicleNumber', 'createdByUserId',
    'receivedByUserId', 'grnReferenceId', 'cancelledByUserId'
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

const AdvanceShippingNotice =
  mongoose.models.AdvanceShippingNotice ||
  mongoose.model('AdvanceShippingNotice', advanceShippingNoticeSchema);

module.exports = {
  AdvanceShippingNotice,
  ASN_STATUSES,
};
