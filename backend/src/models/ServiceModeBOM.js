'use strict';

/**
 * SERVICE MODE BOM — MONGOOSE MODEL (SCR-013)
 *
 * Defines packaging requirements and supporting inventory consumption by service mode
 * (e.g. Dine-In uses cup/saucer vs Takeaway uses disposable cup + lid).
 */

const mongoose = require('mongoose');

const packagingItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // References SCR-011 GlobalInventoryItem
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 0.01,
    },
    uom: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  { _id: true }
);

const serviceModeBOMSchema = new mongoose.Schema(
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

    menuItemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    serviceMode: {
      type: String,
      required: true,
      enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'COUNTER'],
      index: true,
    },

    packagingItems: {
      type: [packagingItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'service_mode_boms',
  }
);

serviceModeBOMSchema.index({ organisationId: 1, menuItemId: 1, serviceMode: 1 }, { unique: true });

const ServiceModeBOM = mongoose.models.ServiceModeBOM || mongoose.model('ServiceModeBOM', serviceModeBOMSchema);

module.exports = {
  ServiceModeBOM,
};
