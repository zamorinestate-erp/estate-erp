'use strict';

/**
 * INCIDENT — MONGOOSE MODEL
 *
 * Incident management and smart alert grouping engine for Zamorin Cafe ERP.
 * Groups high-frequency error bursts into a single incident entity with occurrence counts,
 * deduplication windows, automated recovery tracking, and P0/P1 SLA timers.
 */

const mongoose = require('mongoose');

const INCIDENT_SEVERITIES = ['P0', 'P1', 'P2', 'P3'];
const INCIDENT_CATEGORIES = [
  'DATABASE',
  'BACKEND_API',
  'NETWORK_CONNECTIVITY',
  'DEVICE_FLEET',
  'SECURITY_BREACH_ATTEMPT',
  'PAYROLL_INTEGRITY',
  'ATTENDANCE_LEISURE',
  'GMAIL_SYNC',
  'CRITICAL_INVENTORY',
  'SYSTEM_DEAD_MAN',
];

const INCIDENT_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'MONITORING',
  'RECOVERED',
  'CLOSED',
];

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    severity: {
      type: String,
      enum: INCIDENT_SEVERITIES,
      required: true,
      default: 'P2',
    },

    category: {
      type: String,
      enum: INCIDENT_CATEGORIES,
      required: true,
      default: 'BACKEND_API',
    },

    status: {
      type: String,
      enum: INCIDENT_STATUSES,
      default: 'OPEN',
    },

    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    deduplicationKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    eventCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    affectedServices: [
      {
        type: String,
        trim: true,
        maxlength: 100,
      },
    ],

    affectedCafes: [
      {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 50,
      },
    ],

    rootCorrelationIds: [
      {
        type: String,
        trim: true,
        maxlength: 100,
      },
    ],

    startedAt: {
      type: Date,
      default: Date.now,
    },

    detectedAt: {
      type: Date,
      default: Date.now,
    },

    lastEventAt: {
      type: Date,
      default: Date.now,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },

    acknowledgedBy: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    escalationStage: {
      type: Number,
      default: 0,
    },

    lastEscalationAt: {
      type: Date,
      default: null,
    },

    rootCause: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    correctiveAction: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    preventiveAction: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    recoveryEmailSent: {
      type: Boolean,
      default: false,
    },

    postmortemDraft: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'incidents',
  }
);

incidentSchema.index({ incidentId: 1 }, { unique: true });
incidentSchema.index({ organisationId: 1, deduplicationKey: 1, status: 1 });
incidentSchema.index({ organisationId: 1, severity: 1, status: 1 });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = {
  Incident,
  INCIDENT_SEVERITIES,
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
};
