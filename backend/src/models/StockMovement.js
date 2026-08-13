'use strict';

/**
 * STOCK MOVEMENT — MONGOOSE MODEL
 *
 * Immutable ledger of every stock change at every café.
 * No movement record may ever be deleted or edited through the application.
 * Errors are corrected by posting a CORRECTION movement that references the
 * original movement's movementId.
 *
 * Atomicity guarantee:
 *   Every StockMovement creation must be paired with an atomic $inc on the
 *   corresponding CafeInventoryConfig.currentQuantityBase.
 *   The inventoryService must execute these together. If the StockMovement
 *   save succeeds but the $inc fails (or vice versa), the discrepancy is
 *   detected by a stock-count reconciliation.
 *
 * Idempotency:
 *   idempotencyKey is unique per organisation. The movement controller
 *   checks for an existing movement with the same key before creating a new
 *   one, preventing duplicate-request double-counting.
 *
 * Movement types and quantity sign:
 *   - OPENING, RECEIPT, TRANSFER_IN, STOCK_COUNT (positive, can be zero)
 *   - ISSUE, TRANSFER_OUT, WASTAGE (negative — stored as negative quantityDelta)
 *   - ADJUSTMENT, CORRECTION (can be positive or negative)
 */

const mongoose = require('mongoose');

const MOVEMENT_TYPES = [
  'OPENING',        // Initial opening balance
  'RECEIPT',        // Received from purchase order / vendor delivery
  'ISSUE',          // Issued to production / service (deduction)
  'TRANSFER_OUT',   // Transferred out to another café
  'TRANSFER_IN',    // Received from another café
  'WASTAGE',        // Recorded waste / spoilage (deduction)
  'STOCK_COUNT',    // Physical stock count result (sets balance to counted)
  'ADJUSTMENT',     // Manual authorised adjustment
  'CORRECTION',     // Correction of a previous erroneous movement
  'RETURN_TO_VENDOR', // Returned to vendor
  'RETURN_FROM_SERVICE', // Returned unused from service
];

const MOVEMENT_STATUSES = [
  'ACTIVE',      // Counted in current balance
  'CORRECTED',   // Replaced by a CORRECTION movement — excluded from balance
  'PENDING',     // Awaiting approval (e.g., large adjustments)
  'REJECTED',    // Approval denied — not counted
];

const stockMovementSchema = new mongoose.Schema(
  {
    // ── Business identifier ──────────────────────────────────────────────────
    movementId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^SMOV-\d{8}-\d{4,}$/,
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

    itemId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ── Movement core ────────────────────────────────────────────────────────
    movementType: {
      type: String,
      required: true,
      immutable: true,
      enum: MOVEMENT_TYPES,
      index: true,
    },

    // Positive = stock increase. Negative = stock decrease.
    // Always in the item's baseUnit.
    quantityDelta: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: (v) => Number.isFinite(v) && v !== 0,
        message: 'quantityDelta must be a non-zero finite number.',
      },
    },

    // Snapshot of balance BEFORE this movement was applied.
    // Used for reconciliation and display in movement history.
    balanceBefore: {
      type: Number,
      required: true,
      immutable: true,
    },

    // Snapshot of balance AFTER this movement was applied.
    balanceAfter: {
      type: Number,
      required: true,
      immutable: true,
    },

    // ── Business date ────────────────────────────────────────────────────────
    // Server-generated in IST. Never accepted from the browser.
    businessDate: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    serverTimestamp: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
      index: true,
    },

    // ── Status ───────────────────────────────────────────────────────────────
    // ACTIVE and PENDING affect the running balance.
    // CORRECTED and REJECTED do not.
    status: {
      type: String,
      required: true,
      enum: MOVEMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    // ── Source references ─────────────────────────────────────────────────────
    // Links this movement to its originating business document.
    sourceModule: {
      type: String,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: null,
    },

    sourceRecordId: {
      type: String,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 150,
      default: null,
    },

    // For TRANSFER movements: the partner café.
    partnerCafeId: {
      type: String,
      immutable: true,
      trim: true,
      uppercase: true,
      default: null,
    },

    // For CORRECTION: the movement being corrected.
    correctedMovementId: {
      type: String,
      immutable: true,
      trim: true,
      uppercase: true,
      default: null,
    },

    // On the original: populated when a correction is posted.
    // This is the only mutable field after creation.
    correctedByMovementId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    correctedAt: {
      type: Date,
      default: null,
    },

    // ── Description and reason ───────────────────────────────────────────────
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // ── Actor ────────────────────────────────────────────────────────────────
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    createdByRole: {
      type: String,
      required: true,
      immutable: true,
      enum: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF', 'SYSTEM'],
    },

    // ── Approval ─────────────────────────────────────────────────────────────
    requiresApproval: {
      type: Boolean,
      immutable: true,
      default: false,
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

    approvalReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // ── Idempotency ───────────────────────────────────────────────────────────
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
      sparse: true,
      default: null,
    },

    correlationId: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 150,
      default: null,
    },

    // ── Batch & Lot Traceability (Capability 12) ─────────────────────────────
    // Internal batch identifier assigned at receipt. Enables lot-level lineage.
    batchId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 100,
      default: null,
      index: true,
    },

    // Supplier's own batch/lot reference number.
    supplierBatchNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    // Expiry date of this specific lot/batch.
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },

    // Manufacturing date of this batch (optional).
    manufacturingDate: {
      type: Date,
      default: null,
    },

    // ── Recall & Quarantine (Capability 13) ──────────────────────────────────
    // Whether this movement's stock is currently under quarantine.
    isQuarantined: {
      type: Boolean,
      default: false,
      index: true,
    },

    quarantinedAt: {
      type: Date,
      default: null,
    },

    quarantineReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    quarantinedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // Recall notice ID that triggered this quarantine (if any).
    recallNoticeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    releasedFromQuarantineAt: {
      type: Date,
      default: null,
    },

    releasedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'stock_movements',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

stockMovementSchema.index(
  { organisationId: 1, cafeId: 1, itemId: 1, serverTimestamp: -1 },
  { name: 'org_cafe_item_time' }
);

stockMovementSchema.index(
  { organisationId: 1, cafeId: 1, businessDate: -1 },
  { name: 'org_cafe_date' }
);

stockMovementSchema.index(
  { organisationId: 1, cafeId: 1, movementType: 1, serverTimestamp: -1 },
  { name: 'org_cafe_type_time' }
);

stockMovementSchema.index(
  { organisationId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true, name: 'org_idempotency' }
);

// Batch traceability (Capability 12)
stockMovementSchema.index(
  { organisationId: 1, batchId: 1 },
  { sparse: true, name: 'org_batch_id' }
);

stockMovementSchema.index(
  { organisationId: 1, cafeId: 1, expiryDate: 1 },
  { sparse: true, name: 'org_cafe_expiry' }
);

// Quarantine / recall (Capability 13)
stockMovementSchema.index(
  { organisationId: 1, cafeId: 1, isQuarantined: 1 },
  { name: 'org_cafe_quarantine' }
);

// ── Normalisation ────────────────────────────────────────────────────────────

stockMovementSchema.pre('validate', function normaliseMovementFields() {
  const upperFields = [
    'movementId', 'organisationId', 'cafeId', 'itemId',
    'createdByUserId', 'partnerCafeId', 'correctedMovementId',
    'correctedByMovementId', 'approvedByUserId', 'sourceRecordId',
    'batchId', 'quarantinedByUserId', 'releasedByUserId', 'recallNoticeId',
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.movementType) {
    this.movementType = this.movementType.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
  if (this.sourceModule) {
    this.sourceModule = this.sourceModule.trim().toUpperCase();
  }
  if (this.createdByRole) {
    this.createdByRole = this.createdByRole.trim().toUpperCase();
  }
});

// ── Deletion guard ────────────────────────────────────────────────────────────
// Stock movements are immutable — post a CORRECTION instead.

const BLOCKED_OPS = ['deleteOne', 'deleteMany', 'findOneAndDelete'];
BLOCKED_OPS.forEach((op) => {
  stockMovementSchema.pre(op, function blockMovementDeletion() {
    throw new Error(
      'Stock movements are immutable. Post a CORRECTION movement to fix an error.'
    );
  });
});

const StockMovement =
  mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema);

module.exports = {
  StockMovement,
  MOVEMENT_TYPES,
  MOVEMENT_STATUSES,
};
