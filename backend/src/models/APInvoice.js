'use strict';

const mongoose = require('mongoose');

const apInvoiceSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    invoiceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    vendorId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    rawSupplierInvoiceNumber: {
      type: String,
      trim: false,
    },
    supplierInvoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
      set: function (val) {
        if (typeof val === 'string' && this && typeof this === 'object') {
          if (!this.rawSupplierInvoiceNumber) {
            this.rawSupplierInvoiceNumber = val;
          }
          return val.trim().toUpperCase();
        }
        return val;
      },
    },
    invoiceDate: {
      type: String,
      required: true,
      index: true,
    },
    dueDate: {
      type: String,
      required: true,
      index: true,
    },
    amountPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    taxPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    paidPaisa: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    outstandingPaisa: {
      type: Number,
      required: true,
      min: 0,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      index: true,
    },
    poReferenceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    expenseReferenceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    validationStatus: {
      type: String,
      enum: ['INCOMPLETE', 'VALIDATED'],
      default: 'VALIDATED',
    },
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    accountingStatus: {
      type: String,
      enum: ['UNACCOUNTED', 'POSTED'],
      default: 'UNACCOUNTED',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'ON_HOLD'],
      default: 'UNPAID',
      index: true,
    },
    holds: [
      {
        holdCode: { type: String, required: true },
        reason: { type: String, required: true },
        placedAt: { type: Date, default: Date.now },
        placedBy: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

apInvoiceSchema.pre('validate', function (next) {
  if (this.supplierInvoiceNumber) {
    if (!this.rawSupplierInvoiceNumber) {
      this.rawSupplierInvoiceNumber = this.supplierInvoiceNumber;
    }
    this.supplierInvoiceNumber = this.supplierInvoiceNumber.trim().toUpperCase();
  }
  if (typeof next === 'function') next();
});

apInvoiceSchema.index(
  { organisationId: 1, invoiceId: 1 },
  { unique: true }
);

apInvoiceSchema.index(
  { organisationId: 1, vendorId: 1, supplierInvoiceNumber: 1 },
  { unique: true, name: 'org_vendor_invoice_unique' }
);

apInvoiceSchema.index(
  { organisationId: 1, vendorName: 1, supplierInvoiceNumber: 1 },
  { unique: true }
);

const APInvoice =
  mongoose.models.APInvoice || mongoose.model('APInvoice', apInvoiceSchema);

module.exports = {
  APInvoice,
};
