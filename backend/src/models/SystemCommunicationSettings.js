'use strict';

/**
 * SYSTEM COMMUNICATION SETTINGS — MONGOOSE MODEL
 *
 * Canonical system & operations communication configuration for Zamorin Cafe ERP.
 * Manages the business operations mailbox: zamorinestatepvtltd.erp@gmail.com
 * and primary master contact: pradeeshk331@gmail.com (MU-0001).
 *
 * This mailbox is for business/ERP operations only, has applicationRole = 'NONE',
 * cannot log in to ERP, and is distinct from human users.
 */

const mongoose = require('mongoose');

const PROVIDERS = ['GMAIL_API', 'CONSOLE_TEST', 'TRANSACTIONAL_API'];
const IDENTITIES = ['SYSTEM_OPERATIONS_MAILBOX'];
const WATCH_STATUSES = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'FAILED', 'DISABLED'];

const systemCommunicationSettingsSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    operationsEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: 'zamorinestatepvtltd.erp@gmail.com',
    },

    primaryMasterEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: 'pradeeshk331@gmail.com',
    },

    identityType: {
      type: String,
      enum: IDENTITIES,
      default: 'SYSTEM_OPERATIONS_MAILBOX',
    },

    applicationRole: {
      type: String,
      default: 'NONE',
      immutable: true,
    },

    canLoginToERP: {
      type: Boolean,
      default: false,
      immutable: true,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    provider: {
      type: String,
      enum: PROVIDERS,
      default: 'GMAIL_API',
    },

    defaultSenderName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Zamorin Cafe ERP',
    },

    replyTo: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: 'zamorinestatepvtltd.erp@gmail.com',
    },

    inboundEnabled: {
      type: Boolean,
      default: true,
    },

    outboundEnabled: {
      type: Boolean,
      default: true,
    },

    mailOpsEnabled: {
      type: Boolean,
      default: true,
    },

    // Daily Quota Management
    dailyQuotaBudget: {
      dailyLimit: { type: Number, default: 500 },
      reservedCritical: { type: Number, default: 100 },
      reservedSecurity: { type: Number, default: 100 },
      normalBudget: { type: Number, default: 250 },
      optionalBudget: { type: Number, default: 50 },
    },

    // Gmail API Watch Context
    gmailWatch: {
      watchId: { type: String, trim: true, default: null },
      historyId: { type: String, trim: true, default: null },
      watchExpiresAt: { type: Date, default: null },
      watchLastRenewedAt: { type: Date, default: null },
      lastPushReceivedAt: { type: Date, default: null },
      lastSuccessfulSyncAt: { type: Date, default: null },
      lastReconciliationAt: { type: Date, default: null },
      status: {
        type: String,
        enum: WATCH_STATUSES,
        default: 'DISABLED',
      },
    },

    // SLA Policies (in minutes)
    slaPolicy: {
      p0AcknowledgeMinutes: { type: Number, default: 5 },
      p1AcknowledgeMinutes: { type: Number, default: 15 },
      p2AcknowledgeMinutes: { type: Number, default: 240 },
      p3AcknowledgeMinutes: { type: Number, default: 1440 },
    },
  },
  {
    timestamps: true,
    collection: 'system_communication_settings',
  }
);

systemCommunicationSettingsSchema.index({ organisationId: 1 }, { unique: true });

const SystemCommunicationSettings = mongoose.model(
  'SystemCommunicationSettings',
  systemCommunicationSettingsSchema
);

module.exports = {
  SystemCommunicationSettings,
  PROVIDERS,
  IDENTITIES,
  WATCH_STATUSES,
};
