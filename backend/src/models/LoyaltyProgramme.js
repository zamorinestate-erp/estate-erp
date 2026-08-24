'use strict';

/**
 * LOYALTY PROGRAMME VERSION — MONGOOSE MODEL (SCREEN 006)
 *
 * Governed loyalty programme versioning with effective dating, tier qualification rules,
 * earning ratios, and points expiry configurations.
 */

const mongoose = require('mongoose');

const loyaltyProgrammeSchema = new mongoose.Schema(
  {
    programmeVersion: {
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

    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'SUPERSEDED'],
      default: 'DRAFT',
      index: true,
    },

    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },

    spendToPointsRatio: {
      type: Number,
      required: true,
      default: 0.1, // 1 point per ₹10 spent
    },

    minSpendForAccrualPaisa: {
      type: Number,
      default: 10000, // ₹100 min spend
    },

    tierRules: [
      {
        tier: { type: String, enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'], required: true },
        minSpendPaisa: { type: Number, required: true },
        minVisits: { type: Number, default: 0 },
        earnMultiplier: { type: Number, default: 1.0 },
      },
    ],

    pointsExpiryDays: {
      type: Number,
      default: 365,
    },

    publishedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'loyalty_programmes',
  }
);

const LoyaltyProgramme =
  mongoose.models.LoyaltyProgramme ||
  mongoose.model('LoyaltyProgramme', loyaltyProgrammeSchema);

module.exports = {
  LoyaltyProgramme,
};
