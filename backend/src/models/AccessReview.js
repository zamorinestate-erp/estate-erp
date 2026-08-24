'use strict';

const mongoose = require('mongoose');

const ACCESS_REVIEW_STATUSES = [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
];

const ACCESS_DECISIONS = [
  'PENDING',
  'KEEP',
  'MODIFY',
  'SUSPEND',
  'DEACTIVATE',
];

const reviewFindingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },

    userName: {
      type: String,
      trim: true,
      default: '',
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    isPrimaryMaster: {
      type: Boolean,
      default: false,
    },

    assignedCafeIds: {
      type: [String],
      default: [],
    },

    accountStatus: {
      type: String,
      default: 'ACTIVE',
    },

    lastActivityAt: {
      type: Date,
      default: null,
    },

    decision: {
      type: String,
      enum: ACCESS_DECISIONS,
      default: 'PENDING',
    },

    decisionReason: {
      type: String,
      trim: true,
      default: null,
    },

    decidedAt: {
      type: Date,
      default: null,
    },

    remediationExecuted: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

const accessReviewSchema = new mongoose.Schema(
  {
    reviewId: {
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

    campaignName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    scopeType: {
      type: String,
      enum: ['ALL', 'ROLE', 'CAFE'],
      default: 'ALL',
    },

    scopeRole: {
      type: String,
      trim: true,
      default: null,
    },

    scopeCafeId: {
      type: String,
      trim: true,
      default: null,
    },

    reviewerUserId: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ACCESS_REVIEW_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    findings: {
      type: [reviewFindingSchema],
      default: [],
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

accessReviewSchema.index({ organisationId: 1, status: 1 });

const AccessReview = mongoose.models.AccessReview ||
  mongoose.model('AccessReview', accessReviewSchema);

module.exports = {
  AccessReview,
  ACCESS_REVIEW_STATUSES,
  ACCESS_DECISIONS,
};
