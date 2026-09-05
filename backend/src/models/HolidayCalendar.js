'use strict';

/**
 * HOLIDAY CALENDAR — MONGOOSE MODEL (P1: ATTENDANCE INTEGRATION)
 * Stores official holidays per organisation and optionally per café.
 */

const mongoose = require('mongoose');

const HOLIDAY_TYPES = [
  'NATIONAL',
  'REGIONAL',
  'RESTRICTED',
  'CAFE_SPECIFIC',
];

const holidayCalendarSchema = new mongoose.Schema(
  {
    holidayId: {
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

    // null = applies org-wide; set to cafeId for café-specific override
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    type: {
      type: String,
      enum: HOLIDAY_TYPES,
      default: 'NATIONAL',
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    updatedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'holiday_calendar',
  }
);

holidayCalendarSchema.index(
  { organisationId: 1, date: 1, cafeId: 1 },
  { name: 'org_date_cafe' }
);

holidayCalendarSchema.index(
  { organisationId: 1, date: 1, isActive: 1 },
  { name: 'org_date_active' }
);

const HolidayCalendar =
  mongoose.models.HolidayCalendar ||
  mongoose.model('HolidayCalendar', holidayCalendarSchema);

module.exports = {
  HolidayCalendar,
  HOLIDAY_TYPES,
};
