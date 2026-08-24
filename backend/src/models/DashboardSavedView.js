'use strict';

/**
 * DASHBOARD SAVED VIEW — MONGOOSE MODEL
 *
 * Stores user-specific named dashboard filter presets.
 * These are purely presentation/UX state — they do NOT persist or escalate
 * RBAC permissions. Authorization is always re-evaluated live on every request.
 *
 * Fields:
 *   savedViewId   — Unique business ID (SV-{userId}-{timestamp})
 *   organisationId — Scopes to org
 *   ownerUserId   — The user who created this saved view
 *   name          — Human-readable view name (max 120 chars)
 *   isDefault     — If true, loaded automatically on Command Centre render
 *   filters       — Serialized filter state (no role/permission escalation)
 *     .cafeIds    — Array of cafe IDs (empty = all permitted cafes)
 *     .period     — One of: today, yesterday, 7d, 30d, this_month, custom
 *     .customFrom — ISO date string (only used when period = 'custom')
 *     .customTo   — ISO date string (only used when period = 'custom')
 *     .comparison — One of: previous_period, previous_month, target, none
 */

const mongoose = require('mongoose');

const PERIOD_OPTIONS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'this_month',
  'custom',
];

const COMPARISON_OPTIONS = [
  'previous_period',
  'previous_month',
  'target',
  'none',
];

const savedViewFiltersSchema = new mongoose.Schema(
  {
    cafeIds: {
      type: [String],
      default: [],
    },

    period: {
      type: String,
      enum: PERIOD_OPTIONS,
      default: 'today',
    },

    customFrom: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    customTo: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    comparison: {
      type: String,
      enum: COMPARISON_OPTIONS,
      default: 'previous_period',
    },
  },
  { _id: false }
);

const dashboardSavedViewSchema = new mongoose.Schema(
  {
    savedViewId: {
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

    ownerUserId: {
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
      maxlength: 120,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    filters: {
      type: savedViewFiltersSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'dashboard_saved_views',
  }
);

dashboardSavedViewSchema.index(
  { organisationId: 1, ownerUserId: 1 },
  { name: 'org_owner_views' }
);

dashboardSavedViewSchema.pre('validate', function normaliseSavedViewFields() {
  if (this.savedViewId) this.savedViewId = this.savedViewId.trim().toUpperCase();
  if (this.organisationId) this.organisationId = this.organisationId.trim().toUpperCase();
  if (this.ownerUserId) this.ownerUserId = this.ownerUserId.trim().toUpperCase();
});

const DashboardSavedView =
  mongoose.models.DashboardSavedView ||
  mongoose.model('DashboardSavedView', dashboardSavedViewSchema);

module.exports = {
  DashboardSavedView,
  PERIOD_OPTIONS,
  COMPARISON_OPTIONS,
};
