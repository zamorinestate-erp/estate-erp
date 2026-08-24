'use strict';

/**
 * PURCHASE ORDER — MONGOOSE MODEL (SCR-025)
 *
 * Lifecycle:
 *   DRAFT → SUBMITTED → APPROVED → ORDER_PLACED / ORDERED → ACKNOWLEDGED →
 *   DISPATCHED → PARTIALLY_RECEIVED → RECEIVED_PENDING_FINAL_POSTING →
 *   POSTED_TO_INVENTORY / INVOICED → CLOSED
 *
 * A PurchaseOrder belongs to a single café and a single vendor.
 * Line items reference GlobalInventoryItem.itemId or pure service items.
 *
 * Owner-Mandated Posting Safeguard:
 *   Physical arrival (GRN) records delivery and sets state to RECEIVED_PENDING_FINAL_POSTING.
 *   Stock movements are NOT created until authenticated MASTER approves the validated 3-Way Match.
 *   Inventory is posted atomically and exactly once with unique idempotency protection.
 *   Service lines NEVER update stock.
 */

const mongoose = require('mongoose');

const PO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'ORDER_PLACED',
  'ORDERED',
  'ACKNOWLEDGED',
  'DISPATCHED',
  'PARTIALLY_RECEIVED',
  'RECEIVED_PENDING_FINAL_POSTING',
  'RECEIVED',
  'CLOSED',
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

    itemNameSnapshot: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    itemType: {
      type: String,
      enum: ['GOODS', 'SERVICE'],
      default: 'GOODS',
    },

    supplierItemCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    packSize: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '1 UNIT',
    },

    uomConversionFactor: {
      type: Number,
      min: 0.0001,
      default: 1,
    },

    baseUnit: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 30,
      default: '',
    },

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

    invoicedQuantityBase: {
      type: Number,
      min: 0,
      default: 0,
    },

    unitPricePaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPricePaisa must be an integer.',
      },
    },

    totalLinePaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    lineNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { _id: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    milestoneKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true, default: Date.now },
    actorUserId: { type: String, trim: true, uppercase: true, default: 'SYSTEM' },
    details: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const grnItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, trim: true, uppercase: true },
    deliveredQty: { type: Number, required: true, min: 0 },
    acceptedQty: { type: Number, required: true, min: 0 },
    rejectedQty: { type: Number, min: 0, default: 0 },
    lotNumber: { type: String, trim: true, default: null },
    manufacturingDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const grnSchema = new mongoose.Schema(
  {
    grnId: { type: String, required: true, trim: true, uppercase: true },
    deliveryNoteNumber: { type: String, trim: true, default: '' },
    receivedAt: { type: Date, default: Date.now },
    receivedByUserId: { type: String, required: true, trim: true, uppercase: true },
    items: [grnItemSchema],
    notes: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['ACCEPTED', 'PARTIAL', 'REJECTED'], default: 'ACCEPTED' },
  },
  { _id: true }
);

const supplierInvoiceRefSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, trim: true, uppercase: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: String, required: true, trim: true },
    amountPaisa: { type: Number, required: true, min: 0 },
    taxPaisa: { type: Number, default: 0, min: 0 },
    totalPaisa: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, default: Date.now },
    irn: { type: String, trim: true, default: '' },
    signedQr: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['CAPTURED', 'MATCHED', 'APPROVED', 'DISPUTED'], default: 'CAPTURED' },
  },
  { _id: true }
);

const threeWayMatchSchema = new mongoose.Schema(
  {
    matchStatus: {
      type: String,
      enum: ['MATCHED', 'PRICE_VARIANCE', 'QUANTITY_VARIANCE', 'TAX_VARIANCE', 'REVIEW_REQUIRED', 'PENDING'],
      default: 'PENDING',
    },
    matchedAt: { type: Date, default: null },
    matchedByUserId: { type: String, trim: true, uppercase: true, default: null },
    priceVariancePaisa: { type: Number, default: 0 },
    quantityVarianceBase: { type: Number, default: 0 },
    taxVariancePaisa: { type: Number, default: 0 },
    isExceptionApproved: { type: Boolean, default: false },
    exceptionReason: { type: String, trim: true, default: '' },
    exceptionApprovedByUserId: { type: String, trim: true, uppercase: true, default: null },
  },
  { _id: false }
);

const masterApprovalSchema = new mongoose.Schema(
  {
    approvedAt: { type: Date, default: null },
    approvedByUserId: { type: String, trim: true, uppercase: true, default: null },
    approvalNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    isHighRiskReauthConfirmed: { type: Boolean, default: false },
  },
  { _id: false }
);

const inventoryPostingSchema = new mongoose.Schema(
  {
    postingId: { type: String, trim: true, uppercase: true, default: null },
    postedAt: { type: Date, default: null },
    postedByUserId: { type: String, trim: true, uppercase: true, default: null },
    stockMovementIds: [{ type: String, trim: true, uppercase: true }],
    status: {
      type: String,
      enum: ['IDLE', 'PENDING', 'POSTED', 'FAILED'],
      default: 'IDLE',
    },
    error: { type: String, trim: true, default: null },
  },
  { _id: false }
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
      match: /^PO-[\dA-Z-]+$/,
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

    vendorSiteId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
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
    subtotalPaisa: { type: Number, min: 0, default: 0 },
    taxPaisa: { type: Number, min: 0, default: 0 },
    discountPaisa: { type: Number, min: 0, default: 0 },
    totalPaisa: { type: Number, min: 0, default: 0 },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: PO_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    // ── Order Tracking & Dates ────────────────────────────────────────────────
    orderDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    orderPlacedAt: {
      type: Date,
      default: null,
    },

    expectedDeliveryDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    supplierConfirmedDeliveryDate: {
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

    // ── Supplier Collaboration ────────────────────────────────────────────────
    supplierAcknowledgedAt: { type: Date, default: null },
    supplierAcknowledgementStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'ACCEPTED_WITH_CHANGES', 'CANNOT_SUPPLY', 'NEW_DELIVERY_PROPOSED'],
      default: 'PENDING',
    },
    supplierProposedChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── Receiving & Invoicing Arrays ───────────────────────────────────────────
    receivingStatus: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED_PENDING_FINAL_POSTING', 'POSTED_TO_INVENTORY'],
      default: 'PENDING',
    },
    grnReceipts: [grnSchema],
    invoices: [supplierInvoiceRefSchema],

    // ── 3-Way Match & MASTER Approval & Inventory Posting ─────────────────────
    threeWayMatch: {
      type: threeWayMatchSchema,
      default: () => ({}),
    },

    masterApproval: {
      type: masterApprovalSchema,
      default: () => ({}),
    },

    inventoryPosting: {
      type: inventoryPostingSchema,
      default: () => ({}),
    },

    // ── Milestones Timeline ───────────────────────────────────────────────────
    milestones: [milestoneSchema],

    // ── Approval trail ────────────────────────────────────────────────────────
    submittedByUserId: { type: String, trim: true, uppercase: true, default: null },
    submittedAt: { type: Date, default: null },

    approvedByUserId: { type: String, trim: true, uppercase: true, default: null },
    approvedAt: { type: Date, default: null },
    approvalNotes: { type: String, trim: true, maxlength: 2000, default: '' },

    cancelledByUserId: { type: String, trim: true, uppercase: true, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: 2000, default: '' },

    // ── Vendor invoice / reference (Legacy compatibility) ─────────────────────
    vendorInvoiceNumber: { type: String, trim: true, maxlength: 100, default: '' },
    vendorInvoiceDate: { type: String, trim: true, match: /^\d{4}-\d{2}-\d{2}$/, default: null },

    // ── Notes / terms ─────────────────────────────────────────────────────────
    terms: { type: String, trim: true, maxlength: 3000, default: '' },
    notes: { type: String, trim: true, maxlength: 3000, default: '' },

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
