'use strict';

/**
 * REPORT FAVOURITE — MONGOOSE MODEL (PM-02M)
 *
 * Records a user's favourited/pinned reports and saved views.
 * Favourites are a navigation preference ONLY.
 *
 * INVARIANTS:
 *   - Favouriting does NOT create or escalate permission.
 *   - If the referenced report/view becomes unauthorized, it is suppressed
 *     from the actionable favourite list at retrieval time.
 *   - Metadata leakage prevented: confidential report titles not returned
 *     to unauthorized roles even through the favourite list.
 *   - organisationId always from auth, never trusted from client.
 */

const mongoose = require('mongoose');

const FAVOURITE_ITEM_TYPE = ['CANONICAL_REPORT', 'CUSTOM_REPORT', 'REPORT_PACK'];

const reportFavouriteSchema = new mongoose.Schema(
  {
    favouriteId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^FAV-[A-Z0-9]+-\d+$/,
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

    ownerUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    itemType: {
      type: String,
      required: true,
      enum: FAVOURITE_ITEM_TYPE,
    },

    // The canonical reportId, customReportId, or reportPackId
    itemId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
      index: true,
    },

    // Whether this favourite is also pinned (affects navigation order)
    isPinned: {
      type: Boolean,
      default: false,
    },

    pinnedOrder: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'report_favourites',
  }
);

reportFavouriteSchema.index(
  { organisationId: 1, ownerUserId: 1 },
  { name: 'org_owner_favourites' }
);

// Unique: one favourite per user per item
reportFavouriteSchema.index(
  { organisationId: 1, ownerUserId: 1, itemType: 1, itemId: 1 },
  { unique: true, name: 'org_owner_item_unique' }
);

reportFavouriteSchema.pre('validate', function normalizeFavouriteFields() {
  if (this.favouriteId) this.favouriteId = this.favouriteId.trim().toUpperCase();
  if (this.organisationId) this.organisationId = this.organisationId.trim().toUpperCase();
  if (this.ownerUserId) this.ownerUserId = this.ownerUserId.trim().toUpperCase();
  if (this.itemId) this.itemId = this.itemId.trim().toUpperCase();
});

const ReportFavourite =
  mongoose.models.ReportFavourite ||
  mongoose.model('ReportFavourite', reportFavouriteSchema);

module.exports = {
  ReportFavourite,
  FAVOURITE_ITEM_TYPE,
};
