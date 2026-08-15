'use strict';

const mongoose = require('mongoose');

const attendanceSubmissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    challengeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    idempotencyKeyHash: {
      type: String,
      required: true,
      trim: true,
    },

    transition: {
      type: String,
      required: true,
      enum: ['CHECK_IN', 'CHECK_OUT'],
    },

    challengeIssuedAt: {
      type: Date,
      required: true,
    },

    clientScannedAt: {
      type: Date,
      required: true,
    },

    serverReceivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    isOffline: {
      type: Boolean,
      default: false,
    },

    offlineLeaseId: {
      type: String,
      default: null,
    },

    result: {
      type: String,
      required: true,
      enum: ['ACCEPTED', 'REPLAY_REJECTED', 'EXPIRED_REJECTED', 'SIGNATURE_INVALID', 'SCOPE_DENIED'],
      default: 'ACCEPTED',
    },

    correlationId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'attendance_submissions',
  }
);

// Enforce unique idempotency per organisation + user
attendanceSubmissionSchema.index({ organisationId: 1, userId: 1, idempotencyKeyHash: 1 }, { unique: true });
// Enforce unique transition per challenge + user
attendanceSubmissionSchema.index({ challengeId: 1, userId: 1, transition: 1 }, { unique: true });

const AttendanceSubmission = mongoose.models.AttendanceSubmission || mongoose.model('AttendanceSubmission', attendanceSubmissionSchema);

module.exports = {
  AttendanceSubmission,
};
