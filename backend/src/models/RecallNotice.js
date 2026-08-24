'use strict';

const mongoose = require('mongoose');

const affectedCafeSchema = new mongoose.Schema(
  {
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    locatedQty: {
      type: Number,
      default: 0,
    },
    quarantinedQty: {
      type: Number,
      default: 0,
    },
    disposition: {
      type: String,
      enum: ['PENDING', 'QUARANTINED', 'RETURNED_TO_SUPPLIER', 'DESTROYED', 'RELEASED'],
      default: 'QUARANTINED',
    },
  },
  { _id: false }
);

const recallNoticeSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    recallId: {
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
    supplierLot: {
      type: String,
      trim: true,
      default: '',
    },
    zamorinLot: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    affectedCafes: {
      type: [affectedCafeSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CONTAINED', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
    initiatedByUserId: {
      type: String,
      required: true,
      trim: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

recallNoticeSchema.index(
  { organisationId: 1, recallId: 1 },
  { unique: true }
);

const RecallNotice =
  mongoose.models.RecallNotice ||
  mongoose.model('RecallNotice', recallNoticeSchema);

module.exports = {
  RecallNotice,
};
