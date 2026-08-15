'use strict';

const mongoose = require('mongoose');

const DEVICE_CLASSES = ['PERSONAL', 'CAFE_OWNED'];
const DEVICE_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'TRANSFERRED'];

const deviceRegistrationSchema = new mongoose.Schema(
  {
    deviceId: {
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

    deviceClass: {
      type: String,
      required: true,
      enum: DEVICE_CLASSES,
      default: 'PERSONAL',
      index: true,
    },

    assignedCafeId: {
      type: String,
      default: null,
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          if (this.deviceClass === 'CAFE_OWNED') {
            return typeof v === 'string' && /^ZC-\d{4,}$/.test(v);
          }
          return true;
        },
        message: 'Assigned cafeId must match /^ZC-\\d{4,}$/ when deviceClass is CAFE_OWNED',
      },
    },

    deviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    status: {
      type: String,
      required: true,
      enum: DEVICE_STATUSES,
      default: 'PENDING',
      index: true,
    },

    publicSigningKey: {
      type: String,
      default: null,
    },

    signingKeyThumbprint: {
      type: String,
      default: null,
      index: true,
    },

    webAuthnCredentialIds: {
      type: [String],
      default: [],
    },

    credentialBackupEligible: {
      type: Boolean,
      default: false,
    },

    trustLevel: {
      type: String,
      enum: ['UNVERIFIED', 'ENROLLED', 'HARDWARE_BACKED', 'MANAGED_FLEET'],
      default: 'UNVERIFIED',
    },

    policyVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    deviceVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    enrollmentCode: {
      type: String,
      default: null,
      index: true,
    },

    enrollmentExpiresAt: {
      type: Date,
      default: null,
    },

    enrollmentApprovedBy: {
      type: String,
      default: null,
    },

    enrollmentApprovedAt: {
      type: Date,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revocationReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'device_registrations',
  }
);

deviceRegistrationSchema.index({ organisationId: 1, assignedCafeId: 1, status: 1 });
deviceRegistrationSchema.index({ organisationId: 1, deviceClass: 1, status: 1 });

const DeviceRegistration = mongoose.models.DeviceRegistration || mongoose.model('DeviceRegistration', deviceRegistrationSchema);

module.exports = {
  DeviceRegistration,
  DEVICE_CLASSES,
  DEVICE_STATUSES,
};
