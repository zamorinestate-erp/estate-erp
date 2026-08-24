'use strict';

/**
 * SYSTEM COMMUNICATION SETTINGS — MONGOOSE MODEL
 *
 * Canonical system & operations communication configuration for Zamorin Cafe ERP.
 * Manages the business operations mailbox: zamorinestatepvtltd.erp@gmail.com
 * and primary master contact: pradeeshk331@gmail.com (MU-0001).
 */

const mongoose = require('mongoose');

const PROVIDERS = ['GMAIL_API', 'CONSOLE_TEST', 'TRANSACTIONAL_API'];
const IDENTITIES = ['SYSTEM_OPERATIONS_MAILBOX'];
const WATCH_STATUSES = ['ACTIVE', 'EXPIRING', 'EXPIRED', 'FAILED', 'DISABLED'];
const OAUTH_STATUSES = ['CONNECTED', 'TOKEN_REFRESH_REQUIRED', 'REAUTH_REQUIRED', 'SCOPE_CHANGED', 'REVOKED', 'CONFIGURATION_ERROR', 'DISCONNECTED'];

const systemCommunicationSettingsSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: 'ZAMORIN',
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

    oauthStatus: {
      type: String,
      enum: OAUTH_STATUSES,
      default: 'CONNECTED',
    },

    oauthCapabilities: {
      readMail: { type: Boolean, default: true },
      sendMail: { type: Boolean, default: true },
      modifyLabels: { type: Boolean, default: true },
      sendAsSettings: { type: Boolean, default: false },
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

    outboundPaused: {
      type: Boolean,
      default: false,
    },

    dailySendBudgetLimit: {
      type: Number,
      default: 500,
    },

    gmailWatch: {
      status: {
        type: String,
        enum: WATCH_STATUSES,
        default: 'ACTIVE',
      },
      historyId: {
        type: String,
        default: '100001',
      },
      watchExpiration: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 86400000), // 7 days
      },
      lastRenewedAt: {
        type: Date,
        default: Date.now,
      },
      lastSuccessfulSyncAt: {
        type: Date,
        default: Date.now,
      },
      lastPushNotificationAt: {
        type: Date,
        default: Date.now,
      },
    },

    allowListDomains: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    blockListDomains: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'system_communication_settings',
  }
);

systemCommunicationSettingsSchema.index({ organisationId: 1 }, { unique: true });

const SystemCommunicationSettings =
  mongoose.models.SystemCommunicationSettings ||
  mongoose.model('SystemCommunicationSettings', systemCommunicationSettingsSchema);

module.exports = {
  SystemCommunicationSettings,
  PROVIDERS,
  IDENTITIES,
  WATCH_STATUSES,
  OAUTH_STATUSES,
};
