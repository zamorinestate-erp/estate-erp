'use strict';

const mongoose = require('mongoose');

const mailCaseSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    caseId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['VENDOR', 'PURCHASE_ORDER', 'EXPENSE', 'INVOICE', 'DEPARTMENT_ORDER', 'EMPLOYEE', 'ASSET', 'QUALITY', 'INCIDENT'],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    threadIds: [
      {
        type: String,
        trim: true,
      },
    ],
    assignedToUserId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    createdByUserId: {
      type: String,
      required: true,
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

mailCaseSchema.index({ organisationId: 1, caseId: 1 }, { unique: true });

const MailCase =
  mongoose.models.MailCase || mongoose.model('MailCase', mailCaseSchema);

module.exports = {
  MailCase,
};
