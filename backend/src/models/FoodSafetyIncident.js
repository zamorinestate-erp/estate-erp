'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — FOOD SAFETY INCIDENT & COMPLAINT MODEL (R02-06)
 * ============================================================================
 * Handles food safety complaints, foreign object discoveries, illness
 * allegations, allergen reactions, and links them to items, bills, lots & CAPA.
 */

const mongoose = require('mongoose');

const INCIDENT_TYPES = [
  'FOREIGN_OBJECT',
  'ILLNESS_ALLEGATION',
  'ALLERGEN_REACTION',
  'HYGIENE_BREACH',
  'UNDERCOOKED_TEMPERATURE',
  'SPOILED_CONTAMINATED_PRODUCT',
  'OTHER',
];

const INCIDENT_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

const INCIDENT_STATUSES = [
  'REPORTED',
  'INVESTIGATING',
  'CORRECTIVE_ACTION_TAKEN',
  'RESOLVED',
  'CLOSED',
];

const foodSafetyIncidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
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

    cafeId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    incidentType: {
      type: String,
      enum: INCIDENT_TYPES,
      required: true,
      index: true,
    },

    severity: {
      type: String,
      enum: INCIDENT_SEVERITIES,
      default: 'MEDIUM',
      index: true,
    },

    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: 'REPORTED',
      index: true,
    },

    customerName: {
      type: String,
      trim: true,
      default: '',
    },

    customerContact: {
      type: String,
      trim: true,
      default: '',
    },

    billId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    menuItemId: {
      type: String,
      trim: true,
      default: '',
    },

    menuItemName: {
      type: String,
      trim: true,
      default: '',
    },

    lotId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    sampleRetained: {
      type: Boolean,
      default: false,
    },

    sampleStorageLocation: {
      type: String,
      trim: true,
      default: '',
    },

    investigationFindings: {
      type: String,
      trim: true,
      default: '',
    },

    correctiveAction: {
      type: String,
      trim: true,
      default: '',
    },

    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    reportedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

foodSafetyIncidentSchema.index(
  { organisationId: 1, cafeId: 1, status: 1, createdAt: -1 },
  { name: 'idx_fsi_org_cafe_status' }
);
foodSafetyIncidentSchema.index(
  { organisationId: 1, cafeId: 1, severity: 1 },
  { name: 'idx_fsi_org_cafe_severity' }
);

const FoodSafetyIncident = mongoose.model('FoodSafetyIncident', foodSafetyIncidentSchema);

module.exports = {
  FoodSafetyIncident,
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
};
