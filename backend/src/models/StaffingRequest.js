'use strict';

const mongoose = require('mongoose');

const STAFFING_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'POSITION_OPEN',
  'FILLED',
  'CLOSED',
  'REJECTED',
];

const STAFFING_REASONS = [
  'REPLACEMENT',
  'EXPANSION',
  'NEW_CAFE',
  'TEMPORARY',
  'SEASONAL',
  'BACKFILL',
  'OTHER',
];

const staffingRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^SR-\d{4}-\d{4}$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    positionTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    headcountRequired: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    fteRequired: {
      type: Number,
      required: true,
      min: 0.1,
      default: 1.0,
    },
    desiredDate: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      enum: STAFFING_REASONS,
      default: 'REPLACEMENT',
    },
    status: {
      type: String,
      enum: STAFFING_REQUEST_STATUSES,
      default: 'DRAFT',
      index: true,
    },
    requestedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    approvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    decisionNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

staffingRequestSchema.index({ organisationId: 1, cafeId: 1, status: 1 });

const StaffingRequest = mongoose.model('StaffingRequest', staffingRequestSchema);

module.exports = {
  StaffingRequest,
  STAFFING_REQUEST_STATUSES,
  STAFFING_REASONS,
};
