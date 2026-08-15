'use strict';

const mongoose = require('mongoose');

const deviceSecurityEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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

    deviceClass: {
      type: String,
      required: true,
      enum: ['PERSONAL', 'CAFE_OWNED'],
    },

    cafeId: {
      type: String,
      default: null,
      trim: true,
    },

    actorUserId: {
      type: String,
      required: true,
      trim: true,
    },

    actorRole: {
      type: String,
      required: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        'DEVICE_ENROLLMENT_STARTED',
        'DEVICE_KEY_REGISTERED',
        'DEVICE_APPROVED',
        'DEVICE_REVOKED',
        'DEVICE_POSSESSION_FAILED',
        'DEVICE_SCOPE_VIOLATION',
        'QR_CHALLENGE_ISSUED',
        'QR_ATTENDANCE_ACCEPTED',
        'QR_ATTENDANCE_REPLAY_BLOCKED',
        'QR_ATTENDANCE_EXPIRED',
        'MANUAL_ATTENDANCE_EXCEPTION',
        'OFFLINE_LEASE_ISSUED',
      ],
      index: true,
    },

    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    correlationId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'device_security_events',
  }
);

deviceSecurityEventSchema.index({ organisationId: 1, eventType: 1, createdAt: -1 });

const DeviceSecurityEvent = mongoose.models.DeviceSecurityEvent || mongoose.model('DeviceSecurityEvent', deviceSecurityEventSchema);

module.exports = {
  DeviceSecurityEvent,
};
