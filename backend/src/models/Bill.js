'use strict';

/**
 * BILL / RECEIPT — MONGOOSE MODEL
 *
 * Implements POS sale records.
 * Line items snapshot menuItemId, name, pricePaisa, and taxRate at sale time.
 * Bill statuses: OPEN → COMPLETED, or CANCELLED / VOIDED.
 */

const mongoose = require('mongoose');

const BILL_STATUSES = [
  'OPEN',        // Order started, pending payment
  'COMPLETED',   // Paid and finalised
  'VOIDED',      // Cancelled/voided with audit reason
];

const PAYMENT_METHODS = [
  'CASH',
  'UPI',
  'CARD',
  'CREDIT',
  'COMPLIMENTARY',
  'MIXED',
];

const ORDER_TYPES = [
  'DINE_IN',
  'TAKEAWAY',
  'DELIVERY',
];

const billLineItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    itemNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'quantity must be an integer.' },
    },

    unitPricePaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'unitPricePaisa must be an integer.' },
    },

    taxRatePercent: {
      type: Number,
      min: 0,
      default: 5,
    },

    lineSubtotalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    billId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^BILL-\d{8}-\d{4,}$/,
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

    orderType: {
      type: String,
      enum: ORDER_TYPES,
      default: 'DINE_IN',
    },

    tableNumber: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    customerName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    customerPhone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    lineItems: {
      type: [billLineItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Bill must contain at least one line item.',
      },
    },

    subtotalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    taxPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    discountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'CASH',
    },

    businessDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: BILL_STATUSES,
      default: 'OPEN',
      index: true,
    },

    voidedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    voidReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    voidedAt: {
      type: Date,
      default: null,
    },

    cashierUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    correlationId: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 150,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'bills',
  }
);

billSchema.index(
  { organisationId: 1, cafeId: 1, businessDate: -1, status: 1 },
  { name: 'org_cafe_date_status' }
);

billSchema.pre('validate', function normaliseBillFields() {
  const upperFields = ['billId', 'organisationId', 'cafeId', 'cashierUserId', 'voidedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) this.status = this.status.trim().toUpperCase();
  if (this.paymentMethod) this.paymentMethod = this.paymentMethod.trim().toUpperCase();
  if (this.orderType) this.orderType = this.orderType.trim().toUpperCase();
});

const Bill =
  mongoose.models.Bill ||
  mongoose.model('Bill', billSchema);

module.exports = {
  Bill,
  BILL_STATUSES,
  PAYMENT_METHODS,
  ORDER_TYPES,
};
