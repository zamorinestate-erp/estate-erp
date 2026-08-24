'use strict';

const mongoose = require('mongoose');

const OPERATOR_SESSION_STATUSES = ['ACTIVE', 'LOCKED', 'ENDED', 'EXPIRED', 'REVOKED'];

const operatorSessionSchema = new mongoose.Schema(
  {
    operatorSessionId: {
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

    cafeId: {
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

    operatorUserId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    operatorNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      required: true,
      enum: OPERATOR_SESSION_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    authMethod: {
      type: String,
      enum: ['OPERATOR_PIN', 'NFC_BADGE', 'BIOMETRIC_REAUTH', 'MASTER_OVERRIDE', 'MASTER_PASSWORD_MFA'],
      default: 'OPERATOR_PIN',
    },

    workspaceMode: {
      type: String,
      enum: ['CAFE_OPERATIONS', 'MASTER_WORKSPACE'],
      default: 'CAFE_OPERATIONS',
    },

    sessionStartedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    lastActivityAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    endReason: {
      type: String,
      enum: [
        'SWITCH_OPERATOR',
        'MANUAL_LOCK',
        'MANUAL_END',
        'INACTIVITY_TIMEOUT',
        'SESSION_EXPIRED',
        'DEVICE_REVOKED',
        'DEVICE_LOST',
        'DEVICE_RETIRED',
        'DEVICE_REPLACED',
        'OPERATOR_REVOKED',
        'CAFE_MISMATCH',
        'SECURITY_EVENT',
        null,
      ],
      default: null,
    },

    handoverNote: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    handoverAcknowledgedBy: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },

    handoverAcknowledgedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'operator_sessions',
  }
);

operatorSessionSchema.index({ organisationId: 1, cafeId: 1, status: 1 });
operatorSessionSchema.index({ deviceId: 1, status: 1 });
operatorSessionSchema.index({ operatorUserId: 1, sessionStartedAt: -1 });

const OperatorSession =
  mongoose.models.OperatorSession || mongoose.model('OperatorSession', operatorSessionSchema);

module.exports = {
  OperatorSession,
  OPERATOR_SESSION_STATUSES,
};
