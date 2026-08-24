'use strict';

/**
 * MENU CHANGE SET & PUBLICATION — MONGOOSE MODELS (SCR-013)
 *
 * Manages versioned change sets, pre-publish validation gates, snapshots,
 * atomic multi-outlet deployment, and rollback history.
 */

const mongoose = require('mongoose');

const CHANGE_SET_STATUSES = [
  'DRAFT',
  'VALIDATED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'ROLLED_BACK',
];

const menuChangeSetSchema = new mongoose.Schema(
  {
    changeSetId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^CHG-\d{4,}$/,
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    scope: {
      type: String,
      enum: ['GLOBAL', 'CAFE_CONCEPT', 'RESTAURANT_CONCEPT', 'OUTLET'],
      default: 'GLOBAL',
    },

    targetOutletIds: {
      type: [String],
      default: [],
    },

    stagedChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: CHANGE_SET_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    scheduledFor: {
      type: Date,
      default: null,
    },

    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    approvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'menu_change_sets',
  }
);

menuChangeSetSchema.index({ organisationId: 1, status: 1 });

const MenuChangeSet = mongoose.models.MenuChangeSet || mongoose.model('MenuChangeSet', menuChangeSetSchema);

module.exports = {
  MenuChangeSet,
  CHANGE_SET_STATUSES,
};
