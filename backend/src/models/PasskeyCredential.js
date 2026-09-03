'use strict';

const mongoose = require('mongoose');

const PASSKEY_STATUSES = ['ACTIVE', 'REVOKED'];

const passkeyCredentialSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // Serialized raw public key (base64url string or Buffer)
    publicKey: {
      type: String,
      required: true,
      trim: true,
    },

    counter: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    transports: {
      type: [String],
      default: [],
    },

    authenticatorAttachment: {
      type: String,
      enum: ['platform', 'cross-platform', null],
      default: null,
    },

    aaguid: {
      type: String,
      trim: true,
      default: null,
    },

    friendlyName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Passkey Device',
    },

    status: {
      type: String,
      required: true,
      enum: PASSKEY_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

passkeyCredentialSchema.index({ organisationId: 1, userId: 1, status: 1 });
passkeyCredentialSchema.index({ organisationId: 1, credentialId: 1 }, { unique: true });

passkeyCredentialSchema.methods.toJSON = function safePasskeyJSON() {
  const value = this.toObject();
  delete value.publicKey; // Do not leak public key in regular user responses
  return value;
};

const PasskeyCredential =
  mongoose.models.PasskeyCredential ||
  mongoose.model('PasskeyCredential', passkeyCredentialSchema);

module.exports = {
  PasskeyCredential,
  PASSKEY_STATUSES,
};
