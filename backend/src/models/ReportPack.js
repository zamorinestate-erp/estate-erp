'use strict';

/**
 * REPORT PACK — MONGOOSE MODEL (PM-02M)
 *
 * An ordered collection of canonical and/or custom report references
 * with independent per-item authorization at every preview/generate/export.
 *
 * SECURITY INVARIANTS:
 *   REPORT_PACK_SINGLE_AUTH_CHECK_GRANTS_ALL_ITEMS = 0
 *   ARBITRARY_REPORT_PACK_SCORE = 0
 *   REPORT_PACK_SILENT_TRUNCATION = 0
 *   PM02M_REINTRODUCES_CSV_EXPORT = 0
 *   CUSTOM_REPORT_CLIENT_ORGANISATION_AUTHORITY = 0
 *   CUSTOM_REPORT_STORED_XSS = 0
 *
 * Maximum pack items: REPORT_PACK_LIMIT = 20
 * Authority: TECHNICAL_GUARDRAIL (not business policy)
 */

const mongoose = require('mongoose');

// ── Constants ──────────────────────────────────────────────────────────────────

const REPORT_PACK_VISIBILITY = ['PERSONAL', 'SHARED_CAFE', 'SHARED_ORGANISATION'];
const REPORT_PACK_STATUS = ['ACTIVE', 'ARCHIVED'];
const REPORT_PACK_EXPORT_FORMAT = ['PDF', 'XLSX'];
const REPORT_PACK_ITEM_TYPE = ['CANONICAL_REPORT', 'CUSTOM_REPORT'];
const REPORT_PACK_CLASSIFICATION = ['INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'];

/**
 * Technical guardrail: Maximum number of items in a single report pack.
 * Based on memory and rendering constraints — not a business policy limit.
 */
const REPORT_PACK_LIMIT = 20;

// ── Pack Item Sub-schema ───────────────────────────────────────────────────────

const packItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      required: true,
      enum: REPORT_PACK_ITEM_TYPE,
    },

    // For CANONICAL_REPORT: canonical ReportRegistry reportId
    // For CUSTOM_REPORT: CustomReport.customReportId
    reportId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // Display label override (sanitized)
    label: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },

    // Stored filter configuration for this item — REQUESTED scope only, not authority
    storedConfiguration: {
      periodSemantic: {
        type: String,
        enum: [
          'TODAY', 'YESTERDAY', 'THIS_WEEK', 'LAST_WEEK',
          'THIS_MONTH', 'LAST_MONTH', 'MTD', 'YTD',
          'THIS_QUARTER', 'LAST_QUARTER',
          'LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS',
          'CUSTOM_ABSOLUTE',
        ],
        default: 'THIS_MONTH',
      },
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
      // Requested café IDs — never authority; server re-evaluates on every run
      requestedCafeIds: { type: [String], default: [] },
    },

    // Classification of this specific item — governs the pack's overall classification
    classification: {
      type: String,
      enum: REPORT_PACK_CLASSIFICATION,
      default: 'INTERNAL',
    },

    // Display order (0-based)
    order: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// ── Main Schema ────────────────────────────────────────────────────────────────

const reportPackSchema = new mongoose.Schema(
  {
    reportPackId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^RP-[A-Z0-9]+-\d+$/,
      index: true,
    },

    // Tenant isolation — ALWAYS set from auth.organisationId
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

    // Sanitized title
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
      enum: REPORT_PACK_VISIBILITY,
      default: 'PERSONAL',
      index: true,
    },

    sharedCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // Ordered pack items — max REPORT_PACK_LIMIT items enforced at controller level
    orderedItems: {
      type: [packItemSchema],
      default: [],
    },

    // Effective classification = strongest classification among all items
    effectiveClassification: {
      type: String,
      enum: REPORT_PACK_CLASSIFICATION,
      default: 'INTERNAL',
    },

    preferredExportFormat: {
      type: String,
      enum: REPORT_PACK_EXPORT_FORMAT,
      default: 'PDF',
    },

    status: {
      type: String,
      enum: REPORT_PACK_STATUS,
      default: 'ACTIVE',
      index: true,
    },

    // Pack template type — for named templates
    templateType: {
      type: String,
      enum: [
        'DAILY_OPERATIONS',
        'WEEKLY_MANAGEMENT',
        'MONTHLY_EXECUTIVE',
        'FINANCE_REVIEW',
        'WORKFORCE_REVIEW',
        'PROCUREMENT_VENDOR',
        'CAFE_PERFORMANCE',
        'DATA_TRUST',
        'CUSTOM',
        null,
      ],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'report_packs',
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────────

reportPackSchema.index(
  { organisationId: 1, ownerUserId: 1, status: 1 },
  { name: 'org_owner_status' }
);

reportPackSchema.index(
  { organisationId: 1, visibility: 1, status: 1 },
  { name: 'org_visibility_status' }
);

// ── Pre-validate normalization ─────────────────────────────────────────────────

reportPackSchema.pre('validate', function normalizeReportPackFields() {
  if (this.reportPackId) this.reportPackId = this.reportPackId.trim().toUpperCase();
  if (this.organisationId) this.organisationId = this.organisationId.trim().toUpperCase();
  if (this.ownerUserId) this.ownerUserId = this.ownerUserId.trim().toUpperCase();
  if (this.sharedCafeId) this.sharedCafeId = this.sharedCafeId.trim().toUpperCase();

  if (this.visibility === 'SHARED_CAFE' && !this.sharedCafeId) {
    this.visibility = 'PERSONAL';
  }

  // Sanitize text fields
  const strip = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);
  if (this.name) this.name = strip(this.name);
  if (this.description) this.description = strip(this.description);
  if (Array.isArray(this.orderedItems)) {
    this.orderedItems.forEach((item) => {
      if (item.label) item.label = strip(item.label);
    });
  }

  // Derive effectiveClassification = strongest among items
  const classOrder = { INTERNAL: 0, CONFIDENTIAL: 1, HIGHLY_CONFIDENTIAL: 2 };
  let strongest = 'INTERNAL';
  if (Array.isArray(this.orderedItems)) {
    for (const item of this.orderedItems) {
      if ((classOrder[item.classification] || 0) > (classOrder[strongest] || 0)) {
        strongest = item.classification;
      }
    }
  }
  this.effectiveClassification = strongest;
});

// ── Model ──────────────────────────────────────────────────────────────────────

const ReportPack =
  mongoose.models.ReportPack ||
  mongoose.model('ReportPack', reportPackSchema);

module.exports = {
  ReportPack,
  REPORT_PACK_VISIBILITY,
  REPORT_PACK_STATUS,
  REPORT_PACK_EXPORT_FORMAT,
  REPORT_PACK_ITEM_TYPE,
  REPORT_PACK_CLASSIFICATION,
  REPORT_PACK_LIMIT,
};
