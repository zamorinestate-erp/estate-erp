'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — INVENTORY LOT / BATCH MONGOOSE MODEL
 * ============================================================================
 * Authoritative batch and lot tracking for perishable ingredients and retail
 * stock across all branch cafés.
 *
 * Implements FEFO (First Expired, First Out), quarantine locking, recall holds,
 * and immutable disposition auditing.
 */

const mongoose = require('mongoose');

const LOT_STATUSES = [
  'AVAILABLE',
  'NEAR_EXPIRY',
  'EXPIRED',
  'QUARANTINE',
  'RECALL_HOLD',
  'DEPLETED',
  'DISPOSED',
  'RETURNED',
];

const DISPOSITION_STATUSES = [
  'NONE',
  'RETURN_TO_VENDOR',
  'DESTROY',
  'RELEASE',
  'OTHER_AUTHORISED_DISPOSITION',
];

const inventoryLotSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    lotId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    supplierLot: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    itemId: {
      type: String,
      required: true,
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
    vendorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    procurementReference: {
      type: String,
      trim: true,
      default: '',
    },
    receivingInspectionId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    storageLocation: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    mfgDate: {
      type: String,
      default: null,
    },
    bestBeforeDate: {
      type: String,
      default: null,
    },
    expiryDate: {
      type: String,
      required: true,
      index: true,
    },
    roastDate: {
      type: String,
      default: null,
    },
    unit: {
      type: String,
      trim: true,
      default: 'units',
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantityBase: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    remainingQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: LOT_STATUSES,
      default: 'AVAILABLE',
      index: true,
    },

    // Quarantine & Traceability
    quarantineReason: {
      type: String,
      trim: true,
      default: '',
    },
    quarantineDate: {
      type: Date,
      default: null,
    },
    quarantinedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    releaseReason: {
      type: String,
      trim: true,
      default: '',
    },
    releaseDate: {
      type: Date,
      default: null,
    },
    releasedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // Disposition
    dispositionStatus: {
      type: String,
      enum: DISPOSITION_STATUSES,
      default: 'NONE',
    },
    dispositionReason: {
      type: String,
      trim: true,
      default: '',
    },
    dispositionDate: {
      type: Date,
      default: null,
    },
    dispositionByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

inventoryLotSchema.pre('save', function (next) {
  if (this.isModified('quantityBase') && !this.isModified('remainingQuantity')) {
    this.remainingQuantity = this.quantityBase;
  }
  if (this.initialQuantity === 0 && this.quantityBase > 0) {
    this.initialQuantity = this.quantityBase;
  }
  if (this.remainingQuantity === 0 && this.status === 'AVAILABLE') {
    this.status = 'DEPLETED';
  }
  if (typeof next === 'function') next();
});

inventoryLotSchema.index(
  { organisationId: 1, lotId: 1 },
  { unique: true }
);

inventoryLotSchema.index(
  { organisationId: 1, cafeId: 1, itemId: 1, expiryDate: 1 }
);

inventoryLotSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 }
);

const InventoryLot =
  mongoose.models.InventoryLot ||
  mongoose.model('InventoryLot', inventoryLotSchema);

module.exports = {
  InventoryLot,
  LOT_STATUSES,
  DISPOSITION_STATUSES,
};
