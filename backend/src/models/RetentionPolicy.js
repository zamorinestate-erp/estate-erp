'use strict';

/**
 * RetentionPolicy — SCR-024
 *
 * Governed policy registry defining retention schedules, legal hold rules,
 * disposition review requirements, and classification categories across ERP entities.
 */

const mongoose = require('mongoose');

const DATA_CLASSIFICATIONS = [
  'OPERATIONAL_DATA',
  'FINANCIAL_RECORDS',
  'PAYROLL_STATUTORY',
  'EMPLOYEE_HR',
  'QUALITY_FOOD_SAFETY',
  'AUDIT_SECURITY',
  'CUSTOMER_DATA',
  'GENERAL_CATALOGUE',
];

const retentionPolicySchema = new mongoose.Schema(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^RET-\d{6}-\d{5}$/,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    entityType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    dataClassification: {
      type: String,
      required: true,
      enum: DATA_CLASSIFICATIONS,
    },

    softDeleteAllowed: {
      type: Boolean,
      default: true,
    },

    restoreAllowed: {
      type: Boolean,
      default: true,
    },

    retentionDurationDays: {
      type: Number,
      required: true,
      default: 30, // 30 days default recovery window
    },

    retentionStartBasis: {
      type: String,
      enum: ['DELETED_AT', 'CREATED_AT', 'EVENT_DRIVEN'],
      default: 'DELETED_AT',
    },

    dispositionReviewRequired: {
      type: Boolean,
      default: false,
    },

    makerCheckerRequired: {
      type: Boolean,
      default: false,
    },

    holdEligible: {
      type: Boolean,
      default: true,
    },

    permanentDispositionAllowed: {
      type: Boolean,
      default: true,
    },

    version: {
      type: Number,
      default: 1,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'retention_policies',
  }
);

const RetentionPolicy = mongoose.model('RetentionPolicy', retentionPolicySchema);

module.exports = {
  RetentionPolicy,
  DATA_CLASSIFICATIONS,
};
