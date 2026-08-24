'use strict';

/**
 * DispositionCertificate — SCR-024
 *
 * Immutable proof of permanent, governed data disposition.
 * Contains safe, minimized metadata only (NEVER contains disposed payload).
 * Generates ZURF v1 compliance certificates for audit and regulatory compliance.
 */

const mongoose = require('mongoose');

const dispositionCertificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^CERT-DISP-\d{6}-\d{5}$/,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'GLOBAL',
      index: true,
    },

    trashId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    sourceModule: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    entityType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    entityId: {
      type: String,
      required: true,
      trim: true,
    },

    recordReference: {
      type: String,
      required: true,
      trim: true,
    },

    policyId: {
      type: String,
      required: true,
      trim: true,
    },

    policyVersion: {
      type: Number,
      default: 1,
    },

    retentionCompletedAt: {
      type: Date,
      required: true,
    },

    requestedByUserId: {
      type: String,
      trim: true,
      default: 'SYSTEM',
    },

    approvedByUserId: {
      type: String,
      trim: true,
      default: 'MASTER',
    },

    executedByUserId: {
      type: String,
      required: true,
      trim: true,
      default: 'SYSTEM_PURGE_WORKER',
    },

    executedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    propagationStages: {
      primaryDatabase: { type: String, enum: ['COMPLETED', 'FAILED', 'NOT_APPLICABLE'], default: 'COMPLETED' },
      searchIndex: { type: String, enum: ['COMPLETED', 'FAILED', 'NOT_APPLICABLE'], default: 'COMPLETED' },
      fileStorage: { type: String, enum: ['COMPLETED', 'FAILED', 'NOT_APPLICABLE'], default: 'COMPLETED' },
      cacheLayer: { type: String, enum: ['COMPLETED', 'FAILED', 'NOT_APPLICABLE'], default: 'COMPLETED' },
      analyticsReadModel: { type: String, enum: ['COMPLETED', 'FAILED', 'NOT_APPLICABLE'], default: 'COMPLETED' },
    },

    integrityHash: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'disposition_certificates',
  }
);

const DispositionCertificate = mongoose.model('DispositionCertificate', dispositionCertificateSchema);

module.exports = {
  DispositionCertificate,
};
