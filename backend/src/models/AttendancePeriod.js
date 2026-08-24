'use strict';

/**
 * ATTENDANCE PERIOD — MONGOOSE MODEL (SCREEN 004: ATTENDANCE & SHIFTS)
 */

const mongoose = require('mongoose');

const PERIOD_STATUSES = [
  'OPEN',
  'EMPLOYEE_REVIEW',
  'SUBMITTED',
  'APPROVED',
  'PAYROLL_READY',
  'LOCKED',
];

const attendancePeriodSchema = new mongoose.Schema(
  {
    periodId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^PER-\d{4}-\d{2}$/,
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

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2100,
    },

    status: {
      type: String,
      enum: PERIOD_STATUSES,
      default: 'OPEN',
      index: true,
    },

    totalEmployees: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalHoursWorked: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalOvertimeHours: {
      type: Number,
      min: 0,
      default: 0,
    },

    unresolvedExceptionsCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    lockedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    reopenedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },

    reopenReason: {
      type: String,
      trim: true,
      default: '',
    },

    reopenHistory: [
      {
        reopenedAt: { type: Date, default: Date.now },
        reopenedByUserId: { type: String, required: true, trim: true, uppercase: true },
        reason: { type: String, required: true, trim: true },
        relockedAt: { type: Date, default: null },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'attendance_periods',
  }
);

attendancePeriodSchema.index(
  { organisationId: 1, year: 1, month: 1 },
  { unique: true, name: 'org_period_year_month' }
);

const AttendancePeriod =
  mongoose.models.AttendancePeriod ||
  mongoose.model('AttendancePeriod', attendancePeriodSchema);

module.exports = {
  AttendancePeriod,
  PERIOD_STATUSES,
};
