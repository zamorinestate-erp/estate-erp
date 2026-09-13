'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — RELEASE MANIFEST MONGOOSE MODEL
 * ============================================================================
 * Immutable ledger tracking software release candidates across their controlled
 * lifecycle from DRAFT through VALIDATING to ACTIVE or ROLLED_BACK.
 */

const mongoose = require('mongoose');

const RELEASE_LIFECYCLE_STATES = [
  'DRAFT',
  'VALIDATING',
  'READY_FOR_STAGING',
  'STAGING_VALIDATED',
  'READY_FOR_PRODUCTION',
  'DEPLOYING',
  'VERIFYING',
  'ACTIVE',
  'FAILED',
  'ROLLED_BACK',
  'SUPERSEDED',
];

const releaseManifestSchema = new mongoose.Schema(
  {
    releaseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    gitCommit: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    frontendDeploymentUrl: {
      type: String,
      trim: true,
      default: null,
    },
    backendDeploymentId: {
      type: String,
      trim: true,
      default: null,
    },
    migrationVersion: {
      type: String,
      trim: true,
      default: 'v1.0.0-initial',
    },
    configSchemaVersion: {
      type: String,
      trim: true,
      default: 'v1.2.0',
    },
    reportTemplateVersion: {
      type: String,
      trim: true,
      default: 'v2.1',
    },
    releaseStatus: {
      type: String,
      enum: RELEASE_LIFECYCLE_STATES,
      default: 'DRAFT',
      index: true,
    },
    approvedBy: {
      type: String,
      trim: true,
      default: 'Primary Master (MU-0001)',
    },
    testSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rollbackTargetCommit: {
      type: String,
      trim: true,
      default: 'e2ec643811b2e26550a54aebb37cbfe91c60be2f',
    },
    knownIssues: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const ReleaseManifest = mongoose.models.ReleaseManifest || mongoose.model('ReleaseManifest', releaseManifestSchema);

module.exports = {
  RELEASE_LIFECYCLE_STATES,
  ReleaseManifest,
};
