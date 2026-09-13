'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CALIBRATION RECORD MONGOOSE MODEL
 * ============================================================================
 * Integrates Quality with Assets for measuring equipment (thermometers,
 * weighing scales, pressure gauges, oil testers).
 * Tracks calibration validity, test results, certificates, and renewal due dates.
 */

const mongoose = require('mongoose');

const CALIBRATION_RESULTS = ['PASS', 'FAIL', 'ADJUSTED'];
const CALIBRATION_STATUSES = ['VALID', 'OVERDUE', 'FAILED'];

const calibrationRecordSchema = new mongoose.Schema(
  {
    calibrationId: {
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

    assetId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    assetName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    equipmentType: {
      type: String,
      trim: true,
      default: 'PROBE_THERMOMETER', // PROBE_THERMOMETER, WEIGHING_SCALE, OIL_TESTER, INFRARED_THERMOMETER
    },

    calibrationDate: {
      type: Date,
      required: true,
      index: true,
    },

    result: {
      type: String,
      enum: CALIBRATION_RESULTS,
      required: true,
      default: 'PASS',
    },

    certificateNumber: {
      type: String,
      trim: true,
      default: '',
    },

    nextDueDate: {
      type: Date,
      required: true,
      index: true,
    },

    performedBy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    status: {
      type: String,
      enum: CALIBRATION_STATUSES,
      default: 'VALID',
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

calibrationRecordSchema.index({ organisationId: 1, cafeId: 1, assetId: 1 });
calibrationRecordSchema.index({ organisationId: 1, cafeId: 1, nextDueDate: 1 });

const CalibrationRecord =
  mongoose.models.CalibrationRecord ||
  mongoose.model('CalibrationRecord', calibrationRecordSchema);

module.exports = {
  CalibrationRecord,
  CALIBRATION_RESULTS,
  CALIBRATION_STATUSES,
};
