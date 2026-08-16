'use strict';

/**
 * NOTIFICATION OUTBOX — MONGOOSE MODEL
 *
 * Durable outbox for email, in-app, and external notification delivery.
 * Ensures non-blocking business transactions (Gmail failure never fails ERP),
 * deterministic idempotency, exponential backoff with jitter, and dead-letter handling.
 */

const mongoose = require('mongoose');

const OUTBOX_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'SENT',
  'RETRY',
  'FAILED',
  'SUPPRESSED',
  'QUARANTINED',
];

const SEVERITIES = ['INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'MANDATORY_SECURITY'];

const notificationOutboxSchema = new mongoose.Schema(
  {
    outboxId: {
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
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    recipientUserId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    recipientRole: {
      type: String,
      enum: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF', 'VENDOR', 'EXTERNAL_OPERATIONS'],
      default: 'STAFF',
    },

    templateId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    templateVersion: {
      type: Number,
      default: 1,
    },

    language: {
      type: String,
      trim: true,
      maxlength: 10,
      default: 'en',
    },

    severity: {
      type: String,
      enum: SEVERITIES,
      default: 'INFO',
    },

    priority: {
      type: String,
      enum: PRIORITIES,
      default: 'NORMAL',
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    from: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'zamorinestatepvtltd.erp@gmail.com',
    },

    replyTo: {
      type: String,
      trim: true,
      maxlength: 200,
      default: 'zamorinestatepvtltd.erp@gmail.com',
    },

    htmlBody: {
      type: String,
      required: true,
    },

    textBody: {
      type: String,
      required: true,
    },

    isDraftFirst: {
      type: Boolean,
      default: false,
    },

    draftStatus: {
      type: String,
      enum: ['NONE', 'DRAFT_PREPARED', 'AWAITING_REVIEW', 'APPROVED_FOR_SEND', 'CANCELLED'],
      default: 'NONE',
    },

    correlationId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    status: {
      type: String,
      enum: OUTBOX_STATUSES,
      default: 'QUEUED',
    },

    attemptCount: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
    },

    nextRetryAt: {
      type: Date,
      default: null,
    },

    provider: {
      type: String,
      trim: true,
      maxlength: 50,
      default: 'GMAIL_API',
    },

    providerMessageId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    providerDraftId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    processingAt: {
      type: Date,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    lastErrorCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    lastErrorSafeMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'notification_outbox',
  }
);

notificationOutboxSchema.index({ outboxId: 1 }, { unique: true });
notificationOutboxSchema.index({ organisationId: 1, idempotencyKey: 1 }, { unique: true });
notificationOutboxSchema.index({ status: 1, nextRetryAt: 1 });
notificationOutboxSchema.index({ organisationId: 1, eventType: 1, createdAt: -1 });

const NotificationOutbox = mongoose.model('NotificationOutbox', notificationOutboxSchema);

module.exports = {
  NotificationOutbox,
  OUTBOX_STATUSES,
  SEVERITIES,
  PRIORITIES,
};
