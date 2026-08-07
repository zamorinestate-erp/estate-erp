'use strict';

/**
 * ASSET — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const ASSET_CATEGORIES = [
  'KITCHEN_EQUIPMENT',
  'COFFEE_MACHINE',
  'REFRIGERATION',
  'FURNITURE',
  'POS_HARDWARE',
  'HVAC',
  'OTHER',
];

const ASSET_STATUSES = [
  'OPERATIONAL',
  'UNDER_MAINTENANCE',
  'REPAIRED',
  'DISCARDED',
];

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^AST-\d{4,}$/,
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    category: {
      type: String,
      enum: ASSET_CATEGORIES,
      default: 'KITCHEN_EQUIPMENT',
    },

    serialNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    purchaseDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    warrantyExpiryDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    status: {
      type: String,
      enum: ASSET_STATUSES,
      default: 'OPERATIONAL',
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'assets',
  }
);

assetSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

assetSchema.pre('validate', function normaliseAssetFields() {
  const upperFields = ['assetId', 'organisationId', 'cafeId', 'createdByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.category) this.category = this.category.trim().toUpperCase();
  if (this.status) this.status = this.status.trim().toUpperCase();
});

const Asset =
  mongoose.models.Asset ||
  mongoose.model('Asset', assetSchema);

module.exports = {
  Asset,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
};
