'use strict';

/**
 * CUSTOMER FEEDBACK & SERVICE CASE — MONGOOSE MODEL (SCREEN 006)
 *
 * Implements guest feedback tracking and service recovery cases.
 */

const mongoose = require('mongoose');

const FEEDBACK_CATEGORIES = [
  'SERVICE',
  'PRODUCT',
  'CLEANLINESS',
  'BILLING',
  'STAFF_EXPERIENCE',
  'OTHER',
];

const customerFeedbackSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    customerId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    billId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },

    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      default: 'SERVICE',
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ['NEW', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED'],
      default: 'NEW',
      index: true,
    },

    serviceCaseId: {
      type: String,
      trim: true,
      default: null,
    },

    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },

    resolvedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'customer_feedbacks',
  }
);

const CustomerFeedback =
  mongoose.models.CustomerFeedback ||
  mongoose.model('CustomerFeedback', customerFeedbackSchema);

module.exports = {
  CustomerFeedback,
  FEEDBACK_CATEGORIES,
};
