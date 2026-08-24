'use strict';

const mongoose = require('mongoose');

const mailThreadSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    threadId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    gmailThreadId: {
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
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    snippet: {
      type: String,
      trim: true,
      default: '',
    },
    participants: [
      {
        email: { type: String, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],
    messageCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    hasAttachments: {
      type: Boolean,
      default: false,
    },
    hasBecRisk: {
      type: Boolean,
      default: false,
    },
    hasQuarantineRisk: {
      type: Boolean,
      default: false,
    },
    linkedEntityType: {
      type: String,
      enum: ['VENDOR', 'PURCHASE_ORDER', 'EXPENSE', 'INVOICE', 'DEPARTMENT_ORDER', 'EMPLOYEE', 'ASSET', 'QUALITY', 'SUPPORT_CASE', null],
      default: null,
      index: true,
    },
    linkedEntityId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    assignedToUserId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['NEW', 'REQUIRES_ACTION', 'ASSIGNED', 'AWAITING_REPLY', 'SNOOZED', 'RESOLVED', 'UNMATCHED', 'SECURITY_REVIEW', 'QUARANTINE', 'ARCHIVED'],
      default: 'NEW',
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

mailThreadSchema.index({ organisationId: 1, threadId: 1 }, { unique: true });
mailThreadSchema.index({ organisationId: 1, gmailThreadId: 1 });

const MailThread =
  mongoose.models.MailThread || mongoose.model('MailThread', mailThreadSchema);

module.exports = {
  MailThread,
};
