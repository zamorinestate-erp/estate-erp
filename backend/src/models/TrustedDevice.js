'use strict';

const mongoose = require('mongoose');

const TRUSTED_DEVICE_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED'];

const trustedDeviceSchema = new mongoose.Schema(
  {
    deviceTrustId: {
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
      uppercase: true,
      trim: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: TRUSTED_DEVICE_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    roleSnapshot: {
      type: String,
      required: true,
      enum: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    },

    sessionVersionSnapshot: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    deviceLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Browser Device',
    },

    deviceType: {
      type: String,
      enum: ['DESKTOP', 'LAPTOP', 'TABLET', 'MOBILE', 'PWA', 'OTHER'],
      default: 'DESKTOP',
    },

    browser: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    operatingSystem: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    lastIpMasked: {
      type: String,
      trim: true,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    revocationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'trusted_devices',
  }
);

trustedDeviceSchema.index({ organisationId: 1, userId: 1, status: 1 });
trustedDeviceSchema.index({ organisationId: 1, status: 1, expiresAt: 1 });
trustedDeviceSchema.index({ userId: 1, status: 1, lastUsedAt: -1 });

const TrustedDevice =
  mongoose.models.TrustedDevice ||
  mongoose.model('TrustedDevice', trustedDeviceSchema);

module.exports = {
  TrustedDevice,
  TRUSTED_DEVICE_STATUSES,
};
