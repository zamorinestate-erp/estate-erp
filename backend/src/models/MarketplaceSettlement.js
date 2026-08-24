'use strict';

const mongoose = require('mongoose');

const marketplaceSettlementSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    settlementId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ZOMATO', 'SWIGGY'],
      required: true,
      index: true,
    },
    externalSettlementId: {
      type: String,
      required: true,
      trim: true,
    },
    periodStart: {
      type: String,
      required: true,
    },
    periodEnd: {
      type: String,
      required: true,
    },
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    grossSalesPaisa: {
      type: Number,
      default: 0,
    },
    discountsPaisa: {
      type: Number,
      default: 0,
    },
    commissionPaisa: {
      type: Number,
      default: 0,
    },
    platformFeesPaisa: {
      type: Number,
      default: 0,
    },
    taxWithheldPaisa: {
      type: Number,
      default: 0,
    },
    netSettlementPaisa: {
      type: Number,
      default: 0,
    },
    bankReceivedPaisa: {
      type: Number,
      default: 0,
    },
    variancePaisa: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        'EXPECTED',
        'RECEIVED',
        'MATCHED',
        'DISPUTED',
        'RECONCILED',
      ],
      default: 'RECEIVED',
      index: true,
    },
    bankMatchReference: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

marketplaceSettlementSchema.index(
  { organisationId: 1, settlementId: 1 },
  { unique: true }
);

marketplaceSettlementSchema.index(
  { organisationId: 1, platform: 1, externalSettlementId: 1 },
  { unique: true }
);

const MarketplaceSettlement =
  mongoose.models.MarketplaceSettlement ||
  mongoose.model('MarketplaceSettlement', marketplaceSettlementSchema);

module.exports = {
  MarketplaceSettlement,
};
