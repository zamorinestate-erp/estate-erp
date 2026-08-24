'use strict';

const mongoose = require('mongoose');

const EXPENSE_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PARTIALLY_USED',
  'FULLY_USED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
];

const expenseRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^REQ-\d{4}-\d{4,}$/,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
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

    requesterUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    justification: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    estimatedAmountPaisa: {
      type: Number,
      required: true,
      min: 1,
    },

    actualSpentPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },

    validUntil: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    status: {
      type: String,
      required: true,
      enum: EXPENSE_REQUEST_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    approvedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'expense_requests',
  }
);

expenseRequestSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'expense_request_org_cafe_status' }
);

const ExpenseRequest = mongoose.model('ExpenseRequest', expenseRequestSchema);

module.exports = {
  ExpenseRequest,
  EXPENSE_REQUEST_STATUSES,
};
