'use strict';

const mongoose = require('mongoose');

const MOVEMENT_TYPES = [
  'TRANSFER',
  'PROMOTION',
  'ACTING_ASSIGNMENT',
  'TEMPORARY_ROTATION',
  'POSITION_CHANGE',
  'OFFBOARDING',
  'REHIRE',
];

const MOVEMENT_STATUSES = ['SCHEDULED', 'EFFECTIVE', 'COMPLETED', 'CANCELLED'];

const employeeMovementSchema = new mongoose.Schema(
  {
    movementId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^MVT-\d{4}-\d{4}$/,
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
    movementType: {
      type: String,
      enum: MOVEMENT_TYPES,
      required: true,
    },
    fromCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    toCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    fromPosition: {
      type: String,
      trim: true,
      default: null,
    },
    toPosition: {
      type: String,
      trim: true,
      default: null,
    },
    fromDepartment: {
      type: String,
      trim: true,
      default: null,
    },
    toDepartment: {
      type: String,
      trim: true,
      default: null,
    },
    effectiveDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: MOVEMENT_STATUSES,
      default: 'SCHEDULED',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    approvedBy: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    accessReviewRequired: {
      type: Boolean,
      default: false,
    },
    accessReviewStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'REVIEWED'],
      default: 'NOT_REQUIRED',
    },
  },
  {
    timestamps: true,
  }
);

employeeMovementSchema.index({ organisationId: 1, userId: 1, effectiveDate: 1 });

const EmployeeMovement = mongoose.model('EmployeeMovement', employeeMovementSchema);

module.exports = {
  EmployeeMovement,
  MOVEMENT_TYPES,
  MOVEMENT_STATUSES,
};
