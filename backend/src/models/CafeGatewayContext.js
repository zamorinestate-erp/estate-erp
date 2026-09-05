'use strict';

const mongoose = require('mongoose');

const ACCESS_METHODS = ['PIN', 'QR', 'LINK'];

const cafeGatewayContextSchema = new mongoose.Schema(
  {
    gatewayContextId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    accessMethod: {
      type: String,
      enum: ACCESS_METHODS,
      required: true,
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index: automatically purged by MongoDB
    },

    consumed: {
      type: Boolean,
      default: false,
    },

    consumedAt: {
      type: Date,
      default: null,
    },

    consumedByUserId: {
      type: String,
      trim: true,
      default: null,
    },

    correlationId: {
      type: String,
      default: null,
    },

    clientIp: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'cafe_gateway_contexts',
  }
);

const CafeGatewayContext =
  mongoose.models.CafeGatewayContext ||
  mongoose.model('CafeGatewayContext', cafeGatewayContextSchema);

module.exports = {
  CafeGatewayContext,
  ACCESS_METHODS,
};
