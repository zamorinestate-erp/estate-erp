'use strict';

/**
 * MAINTENANCE JOB — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const MAINTENANCE_STATUSES = ['LOGGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const maintenanceJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^MNT-\d{4,}$/,
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

    assetId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    issueDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: 'LOGGED',
      index: true,
    },

    costPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    technicianName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    loggedByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'maintenance_jobs',
  }
);

maintenanceJobSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

maintenanceJobSchema.pre('validate', function normaliseMntFields() {
  const upperFields = ['jobId', 'organisationId', 'cafeId', 'assetId', 'loggedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.status) this.status = this.status.trim().toUpperCase();
});

const MaintenanceJob =
  mongoose.models.MaintenanceJob ||
  mongoose.model('MaintenanceJob', maintenanceJobSchema);

module.exports = {
  MaintenanceJob,
  MAINTENANCE_STATUSES,
};
