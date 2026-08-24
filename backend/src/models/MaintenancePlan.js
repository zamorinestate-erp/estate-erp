'use strict';

/**
 * MAINTENANCE PLAN — MONGOOSE MODEL (SCREEN 003: EQUIPMENT & ASSET MANAGEMENT)
 */

const mongoose = require('mongoose');

const maintenancePlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^PLN-\d{4,}$/,
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

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    targetType: {
      type: String,
      enum: ['SPECIFIC_ASSET', 'CATEGORY', 'ALL_CAFES'],
      default: 'SPECIFIC_ASSET',
    },

    assetId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    category: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    frequencyType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'ANNUALLY', 'CUSTOM_DAYS'],
      default: 'QUARTERLY',
    },

    intervalDays: {
      type: Number,
      min: 1,
      default: 90,
    },

    startDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: () => new Date().toISOString().split('T')[0],
    },

    nextDueDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: () => new Date().toISOString().split('T')[0],
      index: true,
    },

    jobPlan: {
      title: { type: String, trim: true, default: 'Standard Preventive Maintenance SOP' },
      tasks: [{ order: Number, taskDescription: String, isMandatory: Boolean }],
      safetyNotes: { type: String, trim: true, default: 'Isolate power and water supplies before service.' },
      estimatedDurationMinutes: { type: Number, default: 60 },
      requiredTools: [String],
      requiredParts: [String],
      evidenceRequired: { type: Boolean, default: true },
    },

    preferredMaintenanceWindow: {
      type: String,
      default: 'Before Opening (06:00 - 08:00)',
    },

    serviceProviderId: {
      type: String,
      trim: true,
      default: null,
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
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'maintenance_plans',
  }
);

maintenancePlanSchema.index(
  { organisationId: 1, nextDueDate: 1, isActive: 1 },
  { name: 'org_next_due_active' }
);

const MaintenancePlan =
  mongoose.models.MaintenancePlan ||
  mongoose.model('MaintenancePlan', maintenancePlanSchema);

module.exports = {
  MaintenancePlan,
};
