'use strict';

const mongoose = require('mongoose');

const POSITION_STATUSES = ['OPEN', 'FILLED', 'ON_HOLD', 'FROZEN', 'CLOSED'];

const positionSchema = new mongoose.Schema(
  {
    positionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^POS-[A-Z0-9]{2,10}-\d{3,6}$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    positionTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    jobCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'GENERAL',
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    reportsToPositionId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    approvedCapacity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    currentIncumbents: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: POSITION_STATUSES,
      default: 'OPEN',
      index: true,
    },
    isCritical: {
      type: Boolean,
      default: false,
    },
    designatedBackupUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    requiredCertifications: {
      type: [String],
      default: [],
    },
    effectiveDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

positionSchema.index({ organisationId: 1, cafeId: 1, department: 1 });
positionSchema.index({ organisationId: 1, status: 1 });

const Position = mongoose.model('Position', positionSchema);

module.exports = {
  Position,
  POSITION_STATUSES,
};
