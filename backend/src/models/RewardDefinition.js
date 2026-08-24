'use strict';

/**
 * REWARD DEFINITION — MONGOOSE MODEL (SCREEN 006)
 *
 * Configurable reward catalogue supporting item discounts, percentage discounts,
 * complimentary beverages, and tier-restricted benefits.
 */

const mongoose = require('mongoose');

const REWARD_TYPES = [
  'DISCOUNT_AMOUNT',
  'DISCOUNT_PERCENT',
  'FREE_ITEM',
  'FREE_CATEGORY_ITEM',
  'COMBO_BENEFIT',
];

const rewardDefinitionSchema = new mongoose.Schema(
  {
    rewardId: {
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    customerFacingName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    pointsCost: {
      type: Number,
      required: true,
      min: 1,
    },

    rewardType: {
      type: String,
      enum: REWARD_TYPES,
      default: 'DISCOUNT_AMOUNT',
    },

    discountPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    applicableItemIds: {
      type: [String],
      default: [],
    },

    applicableCategoryIds: {
      type: [String],
      default: [],
    },

    participatingCafeIds: {
      type: [String],
      default: [],
    },

    minTierRequired: {
      type: String,
      enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'BRONZE',
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },

    validFrom: {
      type: Date,
      default: Date.now,
    },

    validUntil: {
      type: Date,
      default: null,
    },

    maxUsesPerCustomer: {
      type: Number,
      min: 0,
      default: 0, // 0 = unlimited
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'reward_definitions',
  }
);

const RewardDefinition =
  mongoose.models.RewardDefinition ||
  mongoose.model('RewardDefinition', rewardDefinitionSchema);

module.exports = {
  RewardDefinition,
  REWARD_TYPES,
};
