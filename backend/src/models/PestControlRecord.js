'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — PEST CONTROL RECORD MONGOOSE MODEL
 * ============================================================================
 * Tracks certified pest management service treatments, provider details,
 * findings, follow-up dates, and statutory compliance certificates.
 */

const mongoose = require('mongoose');

const PEST_STATUSES = ['COMPLETED', 'FOLLOW_UP_SCHEDULED', 'PENDING_REVIEW'];

const pestControlRecordSchema = new mongoose.Schema(
  {
    recordId: {
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

    serviceProvider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    vendorId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    serviceDate: {
      type: Date,
      required: true,
      index: true,
    },

    areasTreated: {
      type: [String],
      default: ['Kitchen', 'Dining', 'Storage', 'Waste Area'],
    },

    treatmentAction: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    findings: {
      type: String,
      trim: true,
      default: 'No active infestation detected. Preventive baiting applied.',
    },

    followUpRequired: {
      type: Boolean,
      default: false,
    },

    nextDueDate: {
      type: Date,
      required: true,
      index: true,
    },

    certificateNumber: {
      type: String,
      trim: true,
      default: '',
    },

    status: {
      type: String,
      enum: PEST_STATUSES,
      default: 'COMPLETED',
      index: true,
    },

    recordedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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

pestControlRecordSchema.index({ organisationId: 1, cafeId: 1, serviceDate: -1 });

const PestControlRecord =
  mongoose.models.PestControlRecord ||
  mongoose.model('PestControlRecord', pestControlRecordSchema);

module.exports = {
  PestControlRecord,
  PEST_STATUSES,
};
