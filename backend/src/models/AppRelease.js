'use strict';

const mongoose = require('mongoose');

const RELEASE_CATEGORIES = [
  'FEATURE',
  'SECURITY_PATCH',
  'POLICY_UPDATE',
  'UI_IMPROVEMENT',
  'HOTFIX',
  'COMPLIANCE',
  'MAINTENANCE',
];

const TARGET_AUDIENCES = [
  'ALL',
  'PRIMARY_MASTER',
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
  'STAFF',
];

const CRITICALITY_LEVELS = [
  'OPTIONAL',
  'RECOMMENDED',
  'MANDATORY',
];

const RELEASE_STATUSES = [
  'ACTIVE',
  'ROLLED_BACK',
  'ARCHIVED',
];

const installationRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    userRole: {
      type: String,
      required: true,
      trim: true,
    },
    clientVersion: {
      type: String,
      trim: true,
      default: 'v1.0.0',
    },
    deviceId: {
      type: String,
      trim: true,
      default: null,
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const appReleaseSchema = new mongoose.Schema(
  {
    releaseId: {
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

    version: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    category: {
      type: String,
      enum: RELEASE_CATEGORIES,
      default: 'FEATURE',
    },

    targetAudience: {
      type: [String],
      enum: TARGET_AUDIENCES,
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one target audience role or ALL must be specified.',
      },
    },

    criticality: {
      type: String,
      enum: CRITICALITY_LEVELS,
      default: 'RECOMMENDED',
    },

    releaseNotes: {
      type: String,
      required: true,
      trim: true,
    },

    sha256Checksum: {
      type: String,
      trim: true,
      default: function () {
        const crypto = require('crypto');
        return crypto
          .createHash('sha256')
          .update(`${this.releaseId}:${this.version}:${this.title}`)
          .digest('hex');
      },
    },

    packageSizeKb: {
      type: Number,
      default: 256,
    },

    packagePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        manifestVersion: '2.0',
        componentsUpdated: ['core-engine', 'settings-hub', 'pos-till', 'governance-validator'],
        migrationRequired: false,
        verificationSeal: 'SHA256_VERIFIED_ZAMORIN_OFFICIAL',
      }),
    },

    publishedBy: {
      userId: { type: String, required: true, trim: true },
      name: { type: String, required: true, trim: true },
      role: { type: String, required: true, trim: true },
    },

    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    status: {
      type: String,
      enum: RELEASE_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    installations: {
      type: [installationRecordSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

appReleaseSchema.index({ organisationId: 1, status: 1, publishedAt: -1 });

const AppRelease = mongoose.models.AppRelease || mongoose.model('AppRelease', appReleaseSchema);

module.exports = {
  AppRelease,
  RELEASE_CATEGORIES,
  TARGET_AUDIENCES,
  CRITICALITY_LEVELS,
  RELEASE_STATUSES,
};
