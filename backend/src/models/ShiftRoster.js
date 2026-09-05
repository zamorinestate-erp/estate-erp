'use strict';

/**
 * SHIFT ROSTER — MONGOOSE MODEL (SCREEN 004: ATTENDANCE & SHIFTS)
 */

const mongoose = require('mongoose');

const ROSTER_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'LOCKED',
  'ARCHIVED',
];

const shiftAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, uppercase: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // shiftTemplateId references a Shift document — must not be hardcoded
    shiftTemplateId: { type: String, trim: true, uppercase: true, default: null },
    shiftName: { type: String, trim: true, default: null },
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    // breakMinutes is informational only; actual breaks tracked on Attendance.breaks
    breakMinutes: { type: Number, default: 0 },
    assignedRole: { type: String, default: null },
  },
  { _id: false }
);

const shiftRosterSchema = new mongoose.Schema(
  {
    rosterId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
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

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    weekStartDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    status: {
      type: String,
      enum: ROSTER_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    assignments: [shiftAssignmentSchema],

    publishedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'shift_rosters',
  }
);

shiftRosterSchema.index(
  { organisationId: 1, cafeId: 1, weekStartDate: 1 },
  { unique: true, name: 'org_cafe_week_roster' }
);

const ShiftRoster =
  mongoose.models.ShiftRoster ||
  mongoose.model('ShiftRoster', shiftRosterSchema);

module.exports = {
  ShiftRoster,
  ROSTER_STATUSES,
};
