'use strict';

const mongoose = require('mongoose');

const inventoryReservationSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    reservationId: {
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
    itemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    lotId: {
      type: String,
      trim: true,
      default: null,
    },
    reservedQty: {
      type: Number,
      required: true,
      min: 0.001,
    },
    reservationType: {
      type: String,
      enum: ['DEPARTMENT_ORDER', 'CATERING', 'INSTITUTIONAL', 'MANUAL_HOLD'],
      default: 'DEPARTMENT_ORDER',
      index: true,
    },
    demandReferenceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 86400000), // 7 days default
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    createdByUserId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

inventoryReservationSchema.index(
  { organisationId: 1, reservationId: 1 },
  { unique: true }
);

const InventoryReservation =
  mongoose.models.InventoryReservation ||
  mongoose.model('InventoryReservation', inventoryReservationSchema);

module.exports = {
  InventoryReservation,
};
