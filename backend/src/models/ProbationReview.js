'use strict';

const mongoose = require('mongoose');

const PROBATION_DECISIONS = ['CONFIRM', 'EXTEND', 'FURTHER_REVIEW', 'TERMINATE', 'PENDING'];

const probationReviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^PRB-\d{4}-\d{4}$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    probationStartDate: {
      type: String,
      required: true,
    },
    expectedEndDate: {
      type: String,
      required: true,
    },
    reviewDueDate: {
      type: String,
      required: true,
    },
    reviewerUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    ratings: {
      jobKnowledge: { type: Number, min: 1, max: 5, default: 3 },
      serviceStandards: { type: Number, min: 1, max: 5, default: 3 },
      reliability: { type: Number, min: 1, max: 5, default: 3 },
      roleCompetency: { type: Number, min: 1, max: 5, default: 3 },
      learningProgress: { type: Number, min: 1, max: 5, default: 3 },
    },
    decision: {
      type: String,
      enum: PROBATION_DECISIONS,
      default: 'PENDING',
      index: true,
    },
    decisionEffectiveDate: {
      type: String,
      default: null,
    },
    extensionDays: {
      type: Number,
      default: 0,
    },
    managerComments: {
      type: String,
      trim: true,
      default: '',
    },
    employeeComments: {
      type: String,
      trim: true,
      default: '',
    },
    developmentNeeds: {
      type: String,
      trim: true,
      default: '',
    },
    confirmedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

probationReviewSchema.index({ organisationId: 1, userId: 1, decision: 1 });

const ProbationReview = mongoose.model('ProbationReview', probationReviewSchema);

module.exports = {
  ProbationReview,
  PROBATION_DECISIONS,
};
