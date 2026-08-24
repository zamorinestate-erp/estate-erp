'use strict';

/**
 * MENU & MENU SECTION — MONGOOSE MODELS (SCR-013)
 *
 * Defines commercial menus (e.g. All-Day Café, Breakfast, Restaurant Lunch, Dinner, Special Event),
 * time-of-day / day-of-week operating schedules, section hierarchies, and item placements.
 */

const mongoose = require('mongoose');

const MENU_TYPES = [
  'ALL_DAY',
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'BRUNCH',
  'BEVERAGE',
  'DESSERT',
  'SPECIAL_EVENT',
];

const menuScheduleSchema = new mongoose.Schema(
  {
    startTime: {
      type: String, // HH:MM in 24h format, e.g. "07:00"
      default: '00:00',
    },
    endTime: {
      type: String, // HH:MM in 24h format, e.g. "23:59"
      default: '23:59',
    },
    daysOfWeek: {
      type: [Number], // 0=Sunday, 1=Monday ... 6=Saturday
      default: [0, 1, 2, 3, 4, 5, 6],
    },
    effectiveFromDate: {
      type: Date,
      default: null,
    },
    effectiveToDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const menuSchema = new mongoose.Schema(
  {
    menuId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^MNU-CAT-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      default: 'ZAMORIN',
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    concept: {
      type: String,
      enum: ['CAFE', 'RESTAURANT', 'SHARED'],
      default: 'CAFE',
      index: true,
    },

    menuType: {
      type: String,
      enum: MENU_TYPES,
      default: 'ALL_DAY',
    },

    schedule: {
      type: menuScheduleSchema,
      default: () => ({}),
    },

    version: {
      type: Number,
      default: 1,
    },

    outletIds: {
      type: [String],
      default: [], // List of outlet IDs (e.g. ZC-0001) where this menu is active
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'menus',
  }
);

menuSchema.index({ organisationId: 1, concept: 1, status: 1 });

const Menu = mongoose.models.Menu || mongoose.model('Menu', menuSchema);

module.exports = {
  Menu,
  MENU_TYPES,
};
