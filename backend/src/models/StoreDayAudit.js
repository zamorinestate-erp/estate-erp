'use strict';

const mongoose = require('mongoose');

const storeDayAuditSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    storeDayId: {
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
    businessDate: {
      type: String,
      required: true,
      index: true,
    },
    posEventCount: {
      type: Number,
      default: 0,
    },
    financeEventCount: {
      type: Number,
      default: 0,
    },
    grossSalesPaisa: {
      type: Number,
      default: 0,
    },
    discountsPaisa: {
      type: Number,
      default: 0,
    },
    netSalesPaisa: {
      type: Number,
      default: 0,
    },
    taxPaisa: {
      type: Number,
      default: 0,
    },
    tenderBreakdown: {
      cashPaisa: { type: Number, default: 0 },
      upiPaisa: { type: Number, default: 0 },
      cardPaisa: { type: Number, default: 0 },
      departmentCreditPaisa: { type: Number, default: 0 },
      marketplacePaisa: { type: Number, default: 0 },
    },
    cashExpectedPaisa: {
      type: Number,
      default: 0,
    },
    cashDeclaredPaisa: {
      type: Number,
      default: 0,
    },
    cashVariancePaisa: {
      type: Number,
      default: 0,
    },
    overShortReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'OPEN',
        'DATA_RECEIVED',
        'AUDIT_REQUIRED',
        'FINANCE_CLEARED',
        'CLOSED',
      ],
      default: 'DATA_RECEIVED',
      index: true,
    },
    clearedBy: {
      type: String,
      default: null,
    },
    clearedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

storeDayAuditSchema.index(
  { organisationId: 1, storeDayId: 1 },
  { unique: true }
);

storeDayAuditSchema.index(
  { organisationId: 1, cafeId: 1, businessDate: 1 },
  { unique: true }
);

const StoreDayAudit =
  mongoose.models.StoreDayAudit ||
  mongoose.model('StoreDayAudit', storeDayAuditSchema);

module.exports = {
  StoreDayAudit,
};
