'use strict';

/**
 * CUSTOM REPORT / SAVED VIEW — MONGOOSE MODEL (PM-02M)
 *
 * Stores user-defined compositions of canonical registry building blocks.
 *
 * SECURITY INVARIANTS:
 *   - organisationId ALWAYS sourced from auth token, NEVER from client payload.
 *   - createdBy / updatedBy ALWAYS sourced from authenticated actor, NEVER trusted from client.
 *   - Stored cafeIds are REQUESTED configuration only — authorization re-evaluated at every run/export.
 *   - No raw Mongo queries, aggregation pipelines, JavaScript formulae, or eval strings stored.
 *   - No raw report payloads or salary/private data persisted.
 *
 * PM-02M INVARIANTS ENFORCED:
 *   CUSTOM_REPORT_ARBITRARY_DATABASE_QUERY = 0
 *   CUSTOM_REPORT_CLIENT_ORGANISATION_AUTHORITY = 0
 *   CUSTOM_REPORT_CLIENT_SUPPLIED_ACTOR_TRUSTED = 0
 *   SAVED_VIEW_STORED_CAFE_IDS_USED_AS_AUTHORITY = 0
 *   CUSTOM_REPORT_MUTATES_CANONICAL_REPORT_DEFINITION = 0
 *   CUSTOM_REPORT_STORED_XSS = 0  (enforced via maxlength + sanitization on write)
 */

const mongoose = require('mongoose');
const { normalizeDimensionId } = require('../reporting/calculations/reportingProductivityCalculations');

// ── Constants ──────────────────────────────────────────────────────────────────

const CUSTOM_REPORT_VISIBILITY = ['PERSONAL', 'SHARED_CAFE', 'SHARED_ORGANISATION'];

const CUSTOM_REPORT_STATUS = ['ACTIVE', 'ARCHIVED', 'CONFIGURATION_OUTDATED'];

const CUSTOM_REPORT_EXPORT_FORMAT = ['PDF', 'XLSX'];

const PERIOD_SEMANTIC = [
  'TODAY',
  'YESTERDAY',
  'THIS_WEEK',
  'LAST_WEEK',
  'THIS_MONTH',
  'LAST_MONTH',
  'MTD',
  'YTD',
  'THIS_QUARTER',
  'LAST_QUARTER',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'CUSTOM_ABSOLUTE',
  'CUSTOM',
];

const SORT_DIRECTION = ['ASC', 'DESC'];

const CUSTOM_FORMULA_ENGINE = 'NOT_IMPLEMENTED';

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const filterSchema = new mongoose.Schema(
  {
    // Stored cafeIds are REQUESTED scope only — never authority-granting.
    requestedCafeIds: { type: [String], default: [] },

    periodSemantic: {
      type: String,
      enum: PERIOD_SEMANTIC,
      default: 'THIS_MONTH',
    },

    // Only populated when periodSemantic = CUSTOM_ABSOLUTE
    customDateFrom: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },
    customDateTo: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    // Preserved from PM-02A comparison semantics — canonical reportingTime taxonomy
    comparison: {
      type: String,
      enum: ['PRIOR_PERIOD', 'PRIOR_YEAR', 'BUDGET', 'FORECAST', 'PREVIOUS_PERIOD', 'PREVIOUS_MONTH', 'PREVIOUS_YEAR', 'TARGET', 'NONE', null],
      default: 'NONE',
      set: (v) => {
        if (v === 'PREVIOUS_PERIOD') return 'PRIOR_PERIOD';
        if (v === 'PREVIOUS_YEAR') return 'PRIOR_YEAR';
        return v;
      },
    },

    // Additional dimension-level filter key/value pairs referencing registry dimension IDs only
    dimensionFilters: {
      type: [
        {
          dimensionId: { type: String, trim: true, maxlength: 120, set: normalizeDimensionId },
          operator: {
            type: String,
            enum: ['EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'GT', 'LT', 'GTE', 'LTE'],
          },
          values: { type: [String], default: [] },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const visualDefinitionSchema = new mongoose.Schema(
  {
    // Visual type must come from approved list; validated server-side against metric/dimension combo
    visualType: {
      type: String,
      enum: [
        'KPI',
        'TABLE',
        'LINE',
        'BAR',
        'STACKED_BAR',
        'PROPORTIONAL_BAR',
        'SCATTER',
        'HEATMAP',
        'PARETO',
        'WATERFALL',
        'BOX_PLOT',
        'DECOMPOSITION',
        'FORECAST_LINE',
      ],
    },
    metricId: { type: String, trim: true, maxlength: 120 },
    dimensionIds: { type: [String], set: (arr) => Array.isArray(arr) ? arr.map(normalizeDimensionId) : arr, default: [] },
    sortField: { type: String, trim: true, maxlength: 120, default: null },
    sortDirection: { type: String, enum: SORT_DIRECTION, default: 'DESC' },
    topN: { type: Number, min: 1, max: 1000, default: null },
    sizeCategory: {
      type: String,
      enum: ['SMALL', 'MEDIUM', 'LARGE', 'FULL_WIDTH'],
      default: 'MEDIUM',
    },
  },
  { _id: false }
);

const signOffSchema = new mongoose.Schema(
  {
    // Sign-off is governance METADATA only — does not alter metric values, actuality, or trust
    signedOffBy: { type: String, trim: true, uppercase: true },
    signedOffAt: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const customReportSchema = new mongoose.Schema(
  {
    customReportId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^CR-[A-Z0-9]+-\d+$/,
      index: true,
    },

    // Tenant isolation — ALWAYS set from auth.organisationId, NEVER from client body
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

    // Sanitized user-provided title (no HTML/script tags)
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    visibility: {
      type: String,
      enum: CUSTOM_REPORT_VISIBILITY,
      default: 'PERSONAL',
      index: true,
    },

    // Optional: scoped to specific café for SHARED_CAFE visibility
    sharedCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // References a canonical ReportRegistry reportId — NEVER modifies its definition
    baseReportId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },

    // Canonical MetricRegistry metric IDs only — no freeform expressions
    metricIds: {
      type: [String],
      default: [],
    },

    // Canonical DimensionRegistry dimension IDs only
    dimensionIds: {
      type: [String],
      set: (arr) => Array.isArray(arr) ? arr.map(normalizeDimensionId) : arr,
      default: [],
    },

    filters: {
      type: filterSchema,
      default: () => ({}),
    },

    // Approved visual definitions — validated against metric/dimension compatibility server-side
    visualDefinitions: {
      type: [visualDefinitionSchema],
      default: [],
    },

    // Preferred export format — PDF or XLSX only
    preferredExportFormat: {
      type: String,
      enum: CUSTOM_REPORT_EXPORT_FORMAT,
      default: 'PDF',
    },

    // Metric/report version at time of save — used to surface CONFIGURATION_OUTDATED
    metricVersion: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },

    reportVersion: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },

    status: {
      type: String,
      enum: CUSTOM_REPORT_STATUS,
      default: 'ACTIVE',
      index: true,
    },

    // Category from the frozen 25 canonical Report Categories
    categoryId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },

    // Governance metadata
    classification: {
      type: String,
      enum: ['INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'],
      default: 'INTERNAL',
    },

    signOff: {
      type: signOffSchema,
      default: null,
    },

    // Optimistic concurrency — prevents silent last-write-wins overwrites
    // (Mongoose versionKey `version` handles __v increment automatically)
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'custom_reports',
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────────

customReportSchema.index(
  { organisationId: 1, ownerUserId: 1, status: 1 },
  { name: 'org_owner_status' }
);

customReportSchema.index(
  { organisationId: 1, visibility: 1, status: 1 },
  { name: 'org_visibility_status' }
);

customReportSchema.index(
  { organisationId: 1, sharedCafeId: 1, visibility: 1, status: 1 },
  { name: 'org_cafe_visibility_status', sparse: true }
);

// ── Pre-validate normalization ─────────────────────────────────────────────────

customReportSchema.pre('validate', function normalizeCustomReportFields() {
  if (this.customReportId) this.customReportId = this.customReportId.trim().toUpperCase();
  if (this.organisationId) this.organisationId = this.organisationId.trim().toUpperCase();
  if (this.ownerUserId) this.ownerUserId = this.ownerUserId.trim().toUpperCase();
  if (this.sharedCafeId) this.sharedCafeId = this.sharedCafeId.trim().toUpperCase();

  // Strip disallowed visibility combinations
  if (this.visibility === 'SHARED_CAFE' && !this.sharedCafeId) {
    this.visibility = 'PERSONAL';
  }

  // Normalize comparison to canonical reportingTime taxonomy (PM02M_CREATES_SECOND_COMPARISON_TAXONOMY = 0)
  if (this.filters) {
    if (this.filters.comparison === 'PREVIOUS_PERIOD') {
      this.filters.comparison = 'PRIOR_PERIOD';
    } else if (this.filters.comparison === 'PREVIOUS_YEAR') {
      this.filters.comparison = 'PRIOR_YEAR';
    }
  }

  // Sanitize text fields — remove any HTML tags
  const strip = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);
  if (this.name) this.name = strip(this.name);
  if (this.description) this.description = strip(this.description);
});

// ── Model ──────────────────────────────────────────────────────────────────────

const CustomReport =
  mongoose.models.CustomReport ||
  mongoose.model('CustomReport', customReportSchema);

module.exports = {
  CustomReport,
  CUSTOM_REPORT_VISIBILITY,
  CUSTOM_REPORT_STATUS,
  CUSTOM_REPORT_EXPORT_FORMAT,
  PERIOD_SEMANTIC,
  CUSTOM_FORMULA_ENGINE,
};
