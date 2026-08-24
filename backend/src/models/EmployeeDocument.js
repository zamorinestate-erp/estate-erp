'use strict';

const mongoose = require('mongoose');

const DOCUMENT_CATEGORIES = [
  'APPOINTMENT_LETTER',
  'EMPLOYMENT_CONTRACT',
  'CONFIRMATION_LETTER',
  'TRANSFER_LETTER',
  'PROMOTION_LETTER',
  'EXPERIENCE_CERTIFICATE',
  'POLICY_ACKNOWLEDGEMENT',
  'IDENTITY_DOCUMENT',
  'FOOD_SAFETY_CERTIFICATE',
  'OTHER',
];

const DOCUMENT_STATUSES = ['ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_ACKNOWLEDGEMENT'];

const employeeDocumentSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^DOC-\d{4}-\d{4}$/,
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
    category: {
      type: String,
      enum: DOCUMENT_CATEGORIES,
      default: 'APPOINTMENT_LETTER',
    },
    documentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    templateVersion: {
      type: String,
      trim: true,
      default: 'v1.0',
    },
    fileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    isRestricted: {
      type: Boolean,
      default: false,
    },
    issuedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    expiryDate: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    generatedPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

employeeDocumentSchema.index({ organisationId: 1, userId: 1, category: 1 });

const EmployeeDocument = mongoose.model('EmployeeDocument', employeeDocumentSchema);

module.exports = {
  EmployeeDocument,
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
};
