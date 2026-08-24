'use strict';

const mongoose = require('mongoose');

const senderIdentitySchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    identityId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    replyTo: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING_VERIFICATION', 'UNVERIFIED', 'DISABLED'],
      default: 'VERIFIED',
      index: true,
    },
    enabledModules: [
      {
        type: String,
        enum: ['PROCUREMENT', 'FINANCE', 'EMPLOYEES', 'DEPARTMENT_ORDERS', 'CUSTOMERS', 'INVENTORY', 'QUALITY', 'ADMINISTRATION', 'GENERAL'],
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

senderIdentitySchema.index({ organisationId: 1, identityId: 1 }, { unique: true });

const SenderIdentity =
  mongoose.models.SenderIdentity || mongoose.model('SenderIdentity', senderIdentitySchema);

module.exports = {
  SenderIdentity,
};
