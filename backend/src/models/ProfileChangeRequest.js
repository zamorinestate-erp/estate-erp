'use strict';

const mongoose = require('mongoose');

const PCR_TYPES = [
  'LEGAL_NAME',
  'BANK_DETAILS',
  'CAFE_ASSIGNMENT',
  'STATUTORY',
  'CONTACT_UPDATE',
  'EMERGENCY_CONTACT',
  'DOCUMENT_CORRECTION',
  'OTHER',
];

const PCR_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'RETURNED',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'WITHDRAWN',
];

const profileChangeRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^PCR-\d{6}-\d{5}$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: PCR_TYPES,
      index: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      default: 'PERSONAL',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    proposedValues: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    status: {
      type: String,
      required: true,
      enum: PCR_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },
    reviewerId: {
      type: String,
      trim: true,
      default: null,
    },
    reviewerNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    appliedAt: {
      type: Date,
      default: null,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    supportingDocuments: [
      {
        documentName: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    auditCorrelationId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

profileChangeRequestSchema.index({ organisationId: 1, userId: 1, createdAt: -1 });
profileChangeRequestSchema.index({ organisationId: 1, status: 1 });

const ProfileChangeRequest = mongoose.models.ProfileChangeRequest || mongoose.model('ProfileChangeRequest', profileChangeRequestSchema);

module.exports = {
  ProfileChangeRequest,
  PCR_TYPES,
  PCR_STATUSES,
};
