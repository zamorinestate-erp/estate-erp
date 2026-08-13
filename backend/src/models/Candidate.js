'use strict';

/**
 * CANDIDATE — MONGOOSE MODEL (Capability 17 — Recruitment / ATS)
 *
 * Applicant tracking record for café staff and management recruitment.
 */

const mongoose = require('mongoose');

const CANDIDATE_STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];

const candidateSchema = new mongoose.Schema(
  {
    candidateId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^CAN-\d{4,}$/,
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

    targetCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    appliedRole: {
      type: String,
      required: true,
      enum: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
      default: 'STAFF',
    },

    stage: {
      type: String,
      required: true,
      enum: CANDIDATE_STAGES,
      default: 'APPLIED',
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

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
    collection: 'candidates',
  }
);

candidateSchema.index(
  { organisationId: 1, stage: 1 },
  { name: 'org_stage' }
);

candidateSchema.pre('validate', function normaliseCandidate() {
  if (this.email) this.email = this.email.trim().toLowerCase();
  const upperFields = ['candidateId', 'organisationId', 'targetCafeId', 'appliedRole', 'stage', 'createdByUserId', 'lastModifiedByUserId'];
  for (const f of upperFields) {
    if (this[f] && typeof this[f] === 'string') this[f] = this[f].trim().toUpperCase();
  }
});

const Candidate =
  mongoose.models.Candidate ||
  mongoose.model('Candidate', candidateSchema);

module.exports = {
  Candidate,
  CANDIDATE_STAGES,
};
