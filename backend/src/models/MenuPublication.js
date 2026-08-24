'use strict';

/**
 * MENU PUBLICATION SNAPSHOT — MONGOOSE MODEL (SCR-013)
 *
 * Stores immutable publication snapshots, target outlet deployment statuses,
 * and rollback references.
 */

const mongoose = require('mongoose');

const targetStatusSchema = new mongoose.Schema(
  {
    outletId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SYNCED', 'FAILED'],
      default: 'PENDING',
    },
    syncedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const menuPublicationSchema = new mongoose.Schema(
  {
    publicationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^PUB-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    changeSetId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    snapshotVersionName: {
      type: String,
      required: true,
      trim: true,
    },

    snapshotData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    targetOutlets: {
      type: [targetStatusSchema],
      default: [],
    },

    overallStatus: {
      type: String,
      enum: ['IN_PROGRESS', 'DEPLOYED', 'PARTIALLY_DEPLOYED', 'FAILED', 'ROLLED_BACK'],
      default: 'IN_PROGRESS',
      index: true,
    },

    isRollback: {
      type: Boolean,
      default: false,
    },

    rolledBackFromPublicationId: {
      type: String,
      default: null,
    },

    publishedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'menu_publications',
  }
);

menuPublicationSchema.index({ organisationId: 1, publishedAt: -1 });

const MenuPublication =
  mongoose.models.MenuPublication || mongoose.model('MenuPublication', menuPublicationSchema);

module.exports = {
  MenuPublication,
};
