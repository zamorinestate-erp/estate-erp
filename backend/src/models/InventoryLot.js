'use strict';

const mongoose = require('mongoose');

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
    storageLocation: {
      type: String,
      trim: true,
      default: 'Main Store',
    },
    mfgDate: {
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
    quantityBase: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'QUARANTINE', 'RECALL_HOLD', 'EXPIRED', 'DEPLETED'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

inventoryLotSchema.index(
  { organisationId: 1, lotId: 1 },
  { unique: true }
);

inventoryLotSchema.index(
  { organisationId: 1, cafeId: 1, itemId: 1, expiryDate: 1 }
);

const InventoryLot =
  mongoose.models.InventoryLot ||
  mongoose.model('InventoryLot', inventoryLotSchema);

module.exports = {
  InventoryLot,
};
