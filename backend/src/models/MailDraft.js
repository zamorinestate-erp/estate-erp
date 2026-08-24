'use strict';

const mongoose = require('mongoose');

const mailDraftSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    draftId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    fromIdentityId: {
      type: String,
      trim: true,
      default: 'DEFAULT',
    },
    to: [
      {
        email: { type: String, required: true, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],
    cc: [
      {
        email: { type: String, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],
    bcc: [
      {
        email: { type: String, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    bodyPlain: {
      type: String,
      default: '',
    },
    templateId: {
      type: String,
      trim: true,
      default: null,
    },
    templateVersion: {
      type: Number,
      default: null,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    sourceModule: {
      type: String,
      enum: ['PROCUREMENT', 'FINANCE', 'EMPLOYEES', 'DEPARTMENT_ORDERS', 'CUSTOMERS', 'INVENTORY', 'QUALITY', 'ADMINISTRATION', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    linkedEntityType: {
      type: String,
      default: null,
    },
    linkedEntityId: {
      type: String,
      default: null,
    },
    inReplyToGmailMessageId: {
      type: String,
      trim: true,
      default: null,
    },
    gmailThreadId: {
      type: String,
      trim: true,
      default: null,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvedByUserId: {
      type: String,
      default: null,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    createdByUserId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lastUpdatedByUserId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'DISCARDED'],
      default: 'DRAFT',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

mailDraftSchema.index({ organisationId: 1, draftId: 1 }, { unique: true });

const MailDraft =
  mongoose.models.MailDraft || mongoose.model('MailDraft', mailDraftSchema);

module.exports = {
  MailDraft,
};
