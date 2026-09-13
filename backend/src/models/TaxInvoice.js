'use strict';

/**
 * TAX INVOICE MODEL (STAGE 08 — FINANCE + GST + STATUTORY INVOICING)
 *
 * Implements authoritative CBIC-compliant GST Tax Invoice schema:
 *  - Unique sequential invoice number per fiscal year
 *  - Strict separation of intra-state (CGST + SGST) vs inter-state (IGST)
 *  - Full HSN/SAC itemization and tax slab summary (0%, 5%, 12%, 18%, 28%)
 *  - B2B recipient details (GSTIN, legal name, place of supply)
 *  - Indian numbering system amount in words
 *  - B2B E-Invoicing readiness (IRN, Signed QR Payload)
 */

const mongoose = require('mongoose');

const taxInvoiceLineItemSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true },
    itemCode: { type: String, default: null },
    description: { type: String, required: true, trim: true },
    hsnCode: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    uqc: { type: String, default: 'NOS', uppercase: true, trim: true }, // Unit Quantity Code per CBIC (NOS, KGS, LTR, etc.)
    ratePaisa: { type: Number, required: true, min: 0 },
    grossAmountPaisa: { type: Number, required: true, min: 0 },
    discountPaisa: { type: Number, default: 0, min: 0 },
    taxableAmountPaisa: { type: Number, required: true, min: 0 },
    gstRatePercent: { type: Number, required: true, min: 0, max: 100 },
    cgstRatePercent: { type: Number, default: 0, min: 0 },
    cgstAmountPaisa: { type: Number, default: 0, min: 0 },
    sgstRatePercent: { type: Number, default: 0, min: 0 },
    sgstAmountPaisa: { type: Number, default: 0, min: 0 },
    igstRatePercent: { type: Number, default: 0, min: 0 },
    igstAmountPaisa: { type: Number, default: 0, min: 0 },
    totalItemAmountPaisa: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const hsnSummarySchema = new mongoose.Schema(
  {
    hsnCode: { type: String, required: true, trim: true },
    taxableValuePaisa: { type: Number, required: true, min: 0 },
    cgstRatePercent: { type: Number, default: 0 },
    cgstAmountPaisa: { type: Number, default: 0 },
    sgstRatePercent: { type: Number, default: 0 },
    sgstAmountPaisa: { type: Number, default: 0 },
    igstRatePercent: { type: Number, default: 0 },
    igstAmountPaisa: { type: Number, default: 0 },
    totalTaxPaisa: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const taxInvoiceSchema = new mongoose.Schema(
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
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    }, // e.g. "2026-27"
    sequenceNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    billId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    supplyType: {
      type: String,
      enum: ['INTRA_STATE', 'INTER_STATE'],
      required: true,
      default: 'INTRA_STATE',
    },
    placeOfSupply: {
      type: String,
      required: true,
      trim: true,
    }, // e.g. "32-Kerala", "29-Karnataka"
    reverseCharge: {
      type: Boolean,
      default: false,
    },
    supplierDetails: {
      legalName: { type: String, required: true, trim: true },
      tradeName: { type: String, required: true, trim: true },
      gstin: { type: String, required: true, trim: true, uppercase: true },
      address: { type: String, required: true, trim: true },
      stateCode: { type: String, required: true, trim: true },
      stateName: { type: String, required: true, trim: true },
      pan: { type: String, trim: true, uppercase: true },
    },
    recipientDetails: {
      isB2B: { type: Boolean, default: false },
      legalName: { type: String, trim: true, default: 'Cash Customer' },
      tradeName: { type: String, trim: true, default: null },
      gstin: { type: String, trim: true, uppercase: true, default: null },
      address: { type: String, trim: true, default: null },
      stateCode: { type: String, trim: true, default: null },
      stateName: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
    },
    lineItems: {
      type: [taxInvoiceLineItemSchema],
      required: true,
      validate: [
        (items) => Array.isArray(items) && items.length > 0,
        'Tax Invoice must contain at least one line item.',
      ],
    },
    hsnSummary: {
      type: [hsnSummarySchema],
      required: true,
    },
    taxSummary: {
      totalTaxablePaisa: { type: Number, required: true, min: 0 },
      totalCgstPaisa: { type: Number, default: 0, min: 0 },
      totalSgstPaisa: { type: Number, default: 0, min: 0 },
      totalIgstPaisa: { type: Number, default: 0, min: 0 },
      totalTaxPaisa: { type: Number, required: true, min: 0 },
      roundOffPaisa: { type: Number, default: 0 },
      grandTotalPaisa: { type: Number, required: true, min: 0 },
    },
    amountInWords: {
      type: String,
      required: true,
      trim: true,
    },
    irn: {
      type: String,
      trim: true,
      default: null,
    },
    signedQrData: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'CANCELLED', 'AMENDED'],
      default: 'ISSUED',
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: String,
      trim: true,
      default: null,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    seriesPrefix: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    statutorySeriesCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    authorizedSignatory: {
      name: { type: String, default: 'Authorized Signatory' },
      designation: { type: String, default: 'Store Manager' },
    },
  },
  {
    timestamps: true,
  }
);

taxInvoiceSchema.index(
  { organisationId: 1, invoiceNumber: 1 },
  { unique: true }
);

taxInvoiceSchema.index(
  { organisationId: 1, financialYear: 1, cafeId: 1, sequenceNumber: 1 },
  { unique: true }
);

// P0-01 & P0-03: Statutory GSTIN-level uniqueness invariant
taxInvoiceSchema.index(
  { gstin: 1, financialYear: 1, invoiceNumber: 1 },
  { unique: true }
);

taxInvoiceSchema.index(
  { 'supplierDetails.gstin': 1, financialYear: 1, invoiceNumber: 1 },
  { unique: true }
);

const TaxInvoice =
  mongoose.models.TaxInvoice || mongoose.model('TaxInvoice', taxInvoiceSchema);

module.exports = {
  TaxInvoice,
};
