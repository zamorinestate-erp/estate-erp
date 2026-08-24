'use strict';

const mongoose = require('mongoose');

const ADMIN_REQUEST_TYPES = [
  'CREATE_MASTER_USER',
  'PROMOTE_TO_MASTER',
  'ORGANISATION_PROFILE_CHANGE',
  'SENSITIVE_CONFIGURATION_CHANGE',
  'RESTRICTED_RECOVERY',
  'SERVICE_CREDENTIAL_ROTATION',
  'CUSTOM_FIELD_SCHEMA_CHANGE',
  'OTHER',
];

const ADMIN_REQUEST_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
];

const administrativeRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    requestType: {
      type: String,
      required: true,
      enum: ADMIN_REQUEST_TYPES,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    targetId: {
      type: String,
      trim: true,
      default: null,
    },

    cafeId: {
      type: String,
      trim: true,
      default: null,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      required: true,
      enum: ADMIN_REQUEST_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    requestedByUserId: {
      type: String,
      required: true,
      trim: true,
    },

    requestedByRole: {
      type: String,
      required: true,
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    decidedByUserId: {
      type: String,
      trim: true,
      default: null,
    },

    decidedAt: {
      type: Date,
      default: null,
    },

    decisionComment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

administrativeRequestSchema.index({ organisationId: 1, status: 1 });
administrativeRequestSchema.index({ organisationId: 1, requestedByUserId: 1 });

const AdministrativeRequest = mongoose.models.AdministrativeRequest ||
  mongoose.model('AdministrativeRequest', administrativeRequestSchema);

module.exports = {
  AdministrativeRequest,
  ADMIN_REQUEST_TYPES,
  ADMIN_REQUEST_STATUSES,
};
