'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — INCOMING MATERIAL INSPECTION MONGOOSE MODEL
 * ============================================================================
 * Delivery dock gate inspection for incoming ingredients and goods.
 * Enforces temperature checks, packaging verification, and quality acceptance
 * before stock is received into usable inventory.
 */

const mongoose = require('mongoose');

const INSPECTION_DECISIONS = ['ACCEPT', 'PARTIAL_ACCEPT', 'REJECT'];
const PACKAGING_CONDITIONS = ['INTACT', 'DAMAGED', 'LEAKING', 'IMPROPER_LABEL'];
const QUALITY_CONDITIONS = ['ACCEPTABLE', 'SPOILED', 'FOREIGN_MATTER', 'DISCOLORED', 'OFF_ODOR'];

const incomingInspectionSchema = new mongoose.Schema(
  {
    inspectionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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

    vendorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    vendorName: {
      type: String,
      trim: true,
      default: '',
    },

    poReference: {
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

    itemName: {
      type: String,
      trim: true,
      default: '',
    },

    supplierLot: {
      type: String,
      trim: true,
      default: '',
    },

    expiryDate: {
      type: String,
      trim: true,
      default: null,
    },

    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    rejectedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: 'kg',
    },

    temperatureCelsius: {
      type: Number,
      default: null,
    },

    packagingCondition: {
      type: String,
      enum: PACKAGING_CONDITIONS,
      default: 'INTACT',
    },

    qualityCondition: {
      type: String,
      enum: QUALITY_CONDITIONS,
      default: 'ACCEPTABLE',
    },

    decision: {
      type: String,
      enum: INSPECTION_DECISIONS,
      required: true,
      default: 'ACCEPT',
      index: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },

    inspectedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    inspectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    createdLotId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

incomingInspectionSchema.index({ organisationId: 1, cafeId: 1, inspectedAt: -1 });

const IncomingInspection =
  mongoose.models.IncomingInspection ||
  mongoose.model('IncomingInspection', incomingInspectionSchema);

module.exports = {
  IncomingInspection,
  INSPECTION_DECISIONS,
  PACKAGING_CONDITIONS,
  QUALITY_CONDITIONS,
};
