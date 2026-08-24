'use strict';

/**
 * INBOUND EMAIL MESSAGE — MONGOOSE MODEL
 *
 * Records and processes incoming operational emails arriving at:
 * zamorinestatepvtltd.erp@gmail.com
 *
 * Implements message idempotency, classification, risk scoring, BEC detection,
 * quarantine rules, and linking to ERP objects (SupportCase, RFQ, PO, Invoice, Dept Order, etc.).
 */

const mongoose = require('mongoose');

const INBOUND_CLASSIFICATIONS = [
  'SECURITY',
  'DEVICE',
  'ATTENDANCE',
  'UAT',
  'SUPPORT',
  'VENDOR',
  'PROCUREMENT',
  'RFQ',
  'PURCHASE_ORDER',
  'INVOICE',
  'DELIVERY',
  'INVENTORY',
  'FINANCE_EXCEPTION',
  'SYSTEM',
  'MAINTENANCE',
  'UNKNOWN',
  'NEEDS_REVIEW',
];

const RISK_SCORES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PROCESSING_STATUSES = [
  'PENDING',
  'PROCESSED',
  'QUARANTINED',
  'DUPLICATE_IGNORED',
  'AWAITING_REVIEW',
  'REJECTED',
];

const QUEUE_STATUSES = [
  'NEW',
  'REQUIRES_ACTION',
  'ASSIGNED',
  'AWAITING_REPLY',
  'SNOOZED',
  'RESOLVED',
  'UNMATCHED',
  'SECURITY_REVIEW',
  'QUARANTINE',
  'ARCHIVED',
];

const inboundEmailMessageSchema = new mongoose.Schema(
  {
    inboundId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: 'ZAMORIN',
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    gmailMessageId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    gmailThreadId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    historyId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    rfcMessageId: {
      type: String,
      trim: true,
      default: null,
    },

    senderEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    senderName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    recipients: [
      {
        email: { type: String, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],

    cc: [
      {
        email: { type: String, trim: true, lowercase: true },
        name: { type: String, trim: true, default: '' },
      },
    ],

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },

    bodyText: {
      type: String,
      default: '',
    },

    bodyHtml: {
      type: String,
      default: '',
    },

    bodySnippet: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    classification: {
      type: String,
      enum: INBOUND_CLASSIFICATIONS,
      default: 'NEEDS_REVIEW',
    },

    riskScore: {
      type: String,
      enum: RISK_SCORES,
      default: 'LOW',
    },

    riskSignals: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],

    isBecSuspected: {
      type: Boolean,
      default: false,
    },

    becReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    isQuarantined: {
      type: Boolean,
      default: false,
    },

    quarantineReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    matchedVendorId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    matchedPoId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    matchedRfqId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    linkedEntityType: {
      type: String,
      enum: ['VENDOR', 'PURCHASE_ORDER', 'EXPENSE', 'INVOICE', 'DEPARTMENT_ORDER', 'EMPLOYEE', 'ASSET', 'QUALITY', 'INCIDENT', null],
      default: null,
      index: true,
    },

    linkedEntityId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    linkedSupportCaseId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: null,
    },

    linkedIncidentId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: null,
    },

    assignedToUserId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    internalNotes: [
      {
        noteId: { type: String, required: true },
        authorUserId: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    attachmentCount: {
      type: Number,
      default: 0,
    },

    attachments: [
      {
        attachmentId: { type: String },
        filename: { type: String },
        contentType: { type: String },
        sizeBytes: { type: Number },
        sha256Hash: { type: String },
        status: { type: String, default: 'SAFE' },
      },
    ],

    status: {
      type: String,
      enum: PROCESSING_STATUSES,
      default: 'PENDING',
    },

    queueStatus: {
      type: String,
      enum: QUEUE_STATUSES,
      default: 'NEW',
      index: true,
    },

    snoozedUntil: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'inbound_email_messages',
  }
);

inboundEmailMessageSchema.index({ inboundId: 1 }, { unique: true });
inboundEmailMessageSchema.index({ gmailMessageId: 1 }, { unique: true });
inboundEmailMessageSchema.index({ organisationId: 1, gmailThreadId: 1 });
inboundEmailMessageSchema.index({ classification: 1, riskScore: 1, status: 1 });
inboundEmailMessageSchema.index({ senderEmail: 1, receivedAt: -1 });
inboundEmailMessageSchema.index({ organisationId: 1, queueStatus: 1 });

const InboundEmailMessage =
  mongoose.models.InboundEmailMessage || mongoose.model('InboundEmailMessage', inboundEmailMessageSchema);

module.exports = {
  InboundEmailMessage,
  INBOUND_CLASSIFICATIONS,
  RISK_SCORES,
  PROCESSING_STATUSES,
  QUEUE_STATUSES,
};
