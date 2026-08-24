'use strict';

/**
 * INSTITUTIONAL QUOTE — MONGOOSE MODEL (SCREEN 007)
 */

const mongoose = require('mongoose');

const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED'];

const quoteItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, default: 'units' },
    unitPricePaisa: { type: Number, required: true, min: 0 },
    totalPaisa: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const institutionalQuoteSchema = new mongoose.Schema(
  {
    quoteId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
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
      trim: true,
      uppercase: true,
      index: true,
    },

    institutionName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    departmentName: {
      type: String,
      required: true,
      trim: true,
    },

    contactName: {
      type: String,
      required: true,
      trim: true,
    },

    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },

    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },

    validUntil: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    headcount: {
      type: Number,
      min: 0,
      default: 0,
    },

    items: {
      type: [quoteItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Quote must contain at least one item.',
      },
    },

    subtotalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPaisa: {
      type: Number,
      default: 0,
    },

    taxPaisa: {
      type: Number,
      default: 0,
    },

    totalPaisa: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: QUOTE_STATUSES,
      default: 'SENT',
      index: true,
    },

    convertedOrderId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'institutional_quotes',
  }
);

const InstitutionalQuote =
  mongoose.models.InstitutionalQuote ||
  mongoose.model('InstitutionalQuote', institutionalQuoteSchema);

module.exports = {
  InstitutionalQuote,
  QUOTE_STATUSES,
};
