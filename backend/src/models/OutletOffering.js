'use strict';

/**
 * OUTLET OFFERING — MONGOOSE MODEL (SCR-013)
 *
 * Defines outlet-specific sellability, local price overrides, channel availability,
 * and temporary sold-out states with auto-restore scheduling.
 */

const mongoose = require('mongoose');

const outletOfferingSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    outletId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // References Café / Outlet ID e.g. ZC-0001
      index: true,
    },

    menuItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // References canonical MenuItem
      index: true,
    },

    isEnabled: {
      type: Boolean,
      default: true,
    },

    localPricePaisaOverride: {
      type: Number,
      default: null, // If null, inherits from concept/global
      validate: {
        validator: function (v) {
          return v === null || (Number.isInteger(v) && v >= 0);
        },
        message: 'localPricePaisaOverride must be null or positive integer in paisa.',
      },
    },

    priceSourceExplanation: {
      type: String,
      default: 'Inherited from Global Default',
    },

    channels: {
      pos: { type: Boolean, default: true },
      dineIn: { type: Boolean, default: true },
      takeaway: { type: Boolean, default: true },
      delivery: { type: Boolean, default: true },
    },

    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },

    soldOutReason: {
      type: String,
      trim: true,
      default: null,
    },

    soldOutUntil: {
      type: Date,
      default: null,
    },

    autoRestore: {
      type: Boolean,
      default: false,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'outlet_offerings',
  }
);

outletOfferingSchema.index({ organisationId: 1, outletId: 1, menuItemId: 1 }, { unique: true });

const OutletOffering = mongoose.models.OutletOffering || mongoose.model('OutletOffering', outletOfferingSchema);

module.exports = {
  OutletOffering,
};
