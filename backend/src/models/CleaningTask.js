'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CLEANING & SANITATION TASK MONGOOSE MODEL
 * ============================================================================
 * Supports scheduled and ad-hoc cleaning procedures across café areas and
 * food-contact equipment. Tracks due dates, completion, verification, and
 * missed cleaning exceptions.
 */

const mongoose = require('mongoose');

const CLEANING_FREQUENCIES = ['PER_SHIFT', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];

const CLEANING_STATUSES = [
  'DUE',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'VERIFICATION_REQUIRED',
];

const cleaningTaskSchema = new mongoose.Schema(
  {
    taskId: {
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
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    areaOrEquipment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    procedure: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    frequency: {
      type: String,
      enum: CLEANING_FREQUENCIES,
      default: 'DAILY',
      index: true,
    },

    assignedRole: {
      type: String,
      trim: true,
      default: 'OPERATOR',
    },

    assignedUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    dueDateTime: {
      type: Date,
      required: true,
      index: true,
    },

    completedDateTime: {
      type: Date,
      default: null,
    },

    completedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    verifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    verificationDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: CLEANING_STATUSES,
      default: 'DUE',
      index: true,
    },

    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

cleaningTaskSchema.index({ organisationId: 1, cafeId: 1, status: 1, dueDateTime: 1 });

const CleaningTask =
  mongoose.models.CleaningTask ||
  mongoose.model('CleaningTask', cleaningTaskSchema);

module.exports = {
  CleaningTask,
  CLEANING_FREQUENCIES,
  CLEANING_STATUSES,
};
