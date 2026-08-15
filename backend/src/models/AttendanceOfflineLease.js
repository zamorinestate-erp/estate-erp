'use strict';

const mongoose = require('mongoose');

const attendanceOfflineLeaseSchema = new mongoose.Schema(
  {
    leaseId: {
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

    deviceId: {
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

    serverNotBefore: {
      type: Date,
      required: true,
    },

    serverNotAfter: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL auto-cleanup
    },

    maxSequence: {
      type: Number,
      default: 5000,
    },

    policyVersion: {
      type: Number,
      default: 1,
    },

    serverSignature: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revocationReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'attendance_offline_leases',
  }
);

const AttendanceOfflineLease = mongoose.models.AttendanceOfflineLease || mongoose.model('AttendanceOfflineLease', attendanceOfflineLeaseSchema);

module.exports = {
  AttendanceOfflineLease,
};
