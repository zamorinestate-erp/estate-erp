'use strict';

/**
 * CUSTOM FIELD DEFINITION — MONGOOSE MODEL  (Capability 26)
 *
 * Organisation-level registry of custom field keys that may be attached to
 * User records via User.customFields (a Map). The controller enforces that
 * only keys defined here can be written to User.customFields.
 *
 * Design rules:
 *  - key must be alphanumeric + underscore, max 64 chars (validated here).
 *  - An organisation may have at most 50 active custom field definitions.
 *  - Deleting a definition does NOT remove the data from existing User records;
 *    it prevents new writes for that key. A MASTER must explicitly clear old
 *    values via the user API if cleanup is required.
 *  - Only MASTER may create, edit or archive definitions.
 */

const mongoose = require('mongoose');

const FIELD_TYPES = [
  'TEXT',       // Short string (≤ 500 chars)
  'LONG_TEXT',  // Multiline string (≤ 2000 chars)
  'NUMBER',     // Numeric value (integer or float)
  'BOOLEAN',    // true / false
  'DATE',       // ISO date string YYYY-MM-DD
  'SELECT',     // Single value from allowedValues list
];

const FIELD_STATUSES = [
  'ACTIVE',    // Writable and visible
  'ARCHIVED',  // Read-only (no new writes); historical data preserved
];

const customFieldDefinitionSchema = new mongoose.Schema(
  {
    // ── Scope ─────────────────────────────────────────────────────────────────
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ── Field identity ────────────────────────────────────────────────────────
    // The Map key that will appear in User.customFields.
    // Pattern enforced: alphanumeric + underscore only, max 64 chars.
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]{1,64}$/,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    fieldType: {
      type: String,
      required: true,
      enum: FIELD_TYPES,
    },

    // For SELECT type: the list of allowed values.
    allowedValues: {
      type: [String],
      default: [],
    },

    isRequired: {
      type: Boolean,
      default: false,
    },

    // Which entity this field applies to. Currently only 'USER' is supported.
    appliesTo: {
      type: String,
      required: true,
      enum: ['USER'],
      immutable: true,
      default: 'USER',
    },

    // Display order in the UI.
    displayOrder: {
      type: Number,
      min: 0,
      default: 0,
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: FIELD_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    // ── Governance ────────────────────────────────────────────────────────────
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'custom_field_definitions',
  }
);

// ── Compound indexes ──────────────────────────────────────────────────────────

// Unique key per org (case-insensitive via pre-validate lowercase normalisation).
customFieldDefinitionSchema.index(
  { organisationId: 1, key: 1 },
  { unique: true, name: 'org_key_unique' }
);

customFieldDefinitionSchema.index(
  { organisationId: 1, status: 1, displayOrder: 1 },
  { name: 'org_status_order' }
);

// ── Normalisation ─────────────────────────────────────────────────────────────

customFieldDefinitionSchema.pre('validate', function normaliseCustomFieldDef() {
  if (this.key) {
    this.key = this.key.trim().toLowerCase();
  }
  if (this.fieldType) {
    this.fieldType = this.fieldType.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
  const upperFields = [
    'organisationId',
    'createdByUserId',
    'lastModifiedByUserId',
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  // Sanitise allowedValues entries.
  if (Array.isArray(this.allowedValues)) {
    this.allowedValues = this.allowedValues.map((v) =>
      typeof v === 'string' ? v.trim() : String(v)
    );
  }
});

const CustomFieldDefinition =
  mongoose.models.CustomFieldDefinition ||
  mongoose.model('CustomFieldDefinition', customFieldDefinitionSchema);

module.exports = {
  CustomFieldDefinition,
  FIELD_TYPES,
  FIELD_STATUSES,
};
