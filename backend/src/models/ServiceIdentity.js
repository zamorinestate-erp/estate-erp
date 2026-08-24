'use strict';

const mongoose = require('mongoose');

const CREDENTIAL_STATUSES = [
  'HEALTHY',
  'EXPIRING_SOON',
  'EXPIRED',
  'REVOKED',
  'ROTATION_REQUIRED',
];

const serviceIdentitySchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    ownerUserId: {
      type: String,
      required: true,
      trim: true,
    },

    scopeType: {
      type: String,
      enum: ['ORGANISATION', 'CAFE'],
      default: 'ORGANISATION',
    },

    assignedCafeIds: {
      type: [String],
      default: [],
    },

    authMethod: {
      type: String,
      enum: ['API_KEY', 'OAUTH2_SERVICE_ACCOUNT', 'MUTUAL_TLS', 'HMAC_TOKEN'],
      default: 'API_KEY',
    },

    credentialStatus: {
      type: String,
      enum: CREDENTIAL_STATUSES,
      default: 'HEALTHY',
      index: true,
    },

    credentialLastRotatedAt: {
      type: Date,
      default: Date.now,
    },

    credentialExpiryDate: {
      type: Date,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceIdentitySchema.index({ organisationId: 1, isActive: 1 });

const ServiceIdentity = mongoose.models.ServiceIdentity ||
  mongoose.model('ServiceIdentity', serviceIdentitySchema);

module.exports = {
  ServiceIdentity,
  CREDENTIAL_STATUSES,
};
