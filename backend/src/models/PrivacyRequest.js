'use strict';

/**
 * PrivacyRequest — governed personal-data request workflow.
 *
 * Implements a DPDP-aware request framework for:
 *   - ACCESS  : Request to see a summary of personal data held
 *   - CORRECTION : Request to correct inaccurate personal data
 *   - ERASURE : Request to erase personal data (subject to retention obligations)
 *   - PORTABILITY : Request a structured data export
 *   - CONSENT_WITHDRAWAL : Withdraw a consent previously given
 *
 * CRITICAL RULES:
 *   - ERASURE requests never automatically delete payroll, finance,
 *     employment, security, or legally-required retention records.
 *   - All requests go through policy/legal review workflow.
 *   - Users see only their own request history.
 */

const mongoose = require('mongoose');

const PRIVACY_REQUEST_TYPES = [
  'ACCESS',
  'CORRECTION',
  'ERASURE',
  'PORTABILITY',
  'CONSENT_WITHDRAWAL',
  'GRIEVANCE',
];

const PRIVACY_REQUEST_STATUSES = [
  'SUBMITTED',
  'IN_REVIEW',
  'INFORMATION_REQUIRED',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'DECLINED',
  'WITHDRAWN',
];

const privacyRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^PRV-\d{6}-\d{5}$/,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // Subject (resolved from authenticated session — never from client body)
    subjectUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    requestType: {
      type: String,
      required: true,
      enum: PRIVACY_REQUEST_TYPES,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: PRIVACY_REQUEST_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // For CORRECTION — what data and what the correct value should be
    dataCategory: { type: String, trim: true, maxlength: 200, default: '' },
    proposedCorrection: { type: String, trim: true, maxlength: 2000, default: '' },

    // Reviewer actions
    reviewedByUserId: { type: String, trim: true, uppercase: true, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 2000, default: '' },
    retentionJustification: { type: String, trim: true, maxlength: 2000, default: '' },

    // Idempotency key to prevent duplicate submissions
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      default: null,
      sparse: true,
    },

    auditHistory: [
      {
        action: { type: String, required: true },
        performedByUserId: { type: String, required: true },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'privacy_requests',
  }
);

privacyRequestSchema.index({ subjectUserId: 1, status: 1 });
privacyRequestSchema.index({ organisationId: 1, status: 1 });

const PrivacyRequest = mongoose.model('PrivacyRequest', privacyRequestSchema);

module.exports = { PrivacyRequest, PRIVACY_REQUEST_TYPES, PRIVACY_REQUEST_STATUSES };
