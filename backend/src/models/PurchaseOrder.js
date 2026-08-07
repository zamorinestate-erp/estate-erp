'use strict';

/**
 * PURCHASE ORDER — MONGOOSE MODEL
 *
 * Lifecycle:
 *   DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED
 *   → RECEIVED → CLOSED
 *   DRAFT / SUBMITTED / APPROVED → CANCELLED
 *
 * A PurchaseOrder belongs to a single café and a single vendor.
 * Line items reference GlobalInventoryItem.itemId.
 *
 * On receipt:
 *   Each received line item triggers a StockMovement (RECEIPT type)
 *   and atomically updates CafeInventoryConfig.currentQuantityBase.
 *   The procurementController handles this chained operation.
 *
 * Idempotency:
 *   The receipt endpoint accepts an idempotencyKey to prevent
 *   double-posting of the same delivery.
 */

const mongoose = require('mongoose');

const PO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'ORDERED',           // Sent to vendor
  'PARTIALLY_RECEIVED',
  'RECEIVED',          // All quantities received
  'CLOSED',            // Manually closed / invoiced
  'CANCELLED',
];

const poLineItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Snapshot of item name at PO creation time.
    itemNameSnapshot: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    baseUnit: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
      default: '',
    },

    // Quantities in baseUnit.
    orderedQuantityBase: {
      type: Number,
      required: true,
      min: 0.001,
    },

    receivedQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Price per baseUnit in paisa.
    unitPricePaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPricePaisa must be an integer.',
      },
    },

    // Total line value in paisa: orderedQuantityBase × unitPricePaisa.
    totalLinePaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    // Notes for this line only (e.g., brand preference).
    lineNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    // ── Business identifier ──────────────────────────────────────────────────
    purchaseOrderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^PO-\d{4,}$/,
      index: true,
    },

    // ── Scope ────────────────────────────────────────────────────────────────
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

    // Snapshot of vendor name at PO creation.
    vendorNameSnapshot: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    // ── Line items ────────────────────────────────────────────────────────────
    lineItems: {
      type: [poLineItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A PurchaseOrder must have at least one line item.',
      },
    },

    // ── Totals (in paisa) ─────────────────────────────────────────────────────
    subtotalPaisa: {
      type: Number,
      min: 0,
      default: 0,
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
      min: 0,
      default: 0,
    },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: PO_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    // ── Dates ────────────────────────────────────────────────────────────────
    // Server-generated in IST.
    orderDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    expectedDeliveryDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    receivedDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    // ── Approval trail ────────────────────────────────────────────────────────
    submittedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    submittedAt: { type: Date, default: null },

    approvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    approvedAt: { type: Date, default: null },
    approvalNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    cancelledByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    cancelledAt: { type: Date, default: null },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // ── Vendor invoice / reference ────────────────────────────────────────────
    vendorInvoiceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    vendorInvoiceDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    // ── Notes / terms ─────────────────────────────────────────────────────────
    terms: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    // ── Governance ───────────────────────────────────────────────────────────
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
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
    collection: 'purchase_orders',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

purchaseOrderSchema.index(
  { organisationId: 1, cafeId: 1, status: 1, createdAt: -1 },
  { name: 'org_cafe_status_date' }
);

purchaseOrderSchema.index(
  { organisationId: 1, vendorId: 1, status: 1 },
  { name: 'org_vendor_status' }
);

// ── Normalisation ────────────────────────────────────────────────────────────

purchaseOrderSchema.pre('validate', function normalisePOFields() {
  const upperFields = [
    'purchaseOrderId', 'organisationId', 'cafeId', 'vendorId',
    'createdByUserId', 'lastModifiedByUserId',
    'submittedByUserId', 'approvedByUserId', 'cancelledByUserId',
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
});

const PurchaseOrder =
  mongoose.models.PurchaseOrder ||
  mongoose.model('PurchaseOrder', purchaseOrderSchema);

module.exports = {
  PurchaseOrder,
  PO_STATUSES,
};
