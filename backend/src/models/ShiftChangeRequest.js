'use strict';

const mongoose = require('mongoose');

const SHIFT_CHANGE_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

const shiftChangeRequestSchema = new mongoose.Schema(
  {
    requestId: {
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
      trim: true,
      uppercase: true,
      index: true,
    },
    employeeUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    employeeName: {
      type: String,
      trim: true,
      default: '',
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    requestedDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    endDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },
    currentShift: {
      type: String,
      trim: true,
      default: '',
    },
    requestedShift: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: SHIFT_CHANGE_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },
    reviewedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'shift_change_requests',
  }
);

shiftChangeRequestSchema.index({ organisationId: 1, employeeUserId: 1, createdAt: -1 });
shiftChangeRequestSchema.index({ organisationId: 1, cafeId: 1, status: 1 });

const ShiftChangeRequest =
  mongoose.models.ShiftChangeRequest ||
  mongoose.model('ShiftChangeRequest', shiftChangeRequestSchema);

module.exports = {
  ShiftChangeRequest,
  SHIFT_CHANGE_STATUSES,
};
