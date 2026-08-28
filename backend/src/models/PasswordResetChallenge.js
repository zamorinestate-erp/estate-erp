'use strict';

const mongoose = require('mongoose');

const PASSWORD_RESET_STATUSES = [
  'PENDING',
  'VERIFIED',
  'CONSUMED',
  'LOCKED',
  'EXPIRED',
];

const passwordResetChallengeSchema = new mongoose.Schema(
  {
    challengeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^PRC-\d{8}-\d{4,}$/,
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
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      required: true,
      enum: PASSWORD_RESET_STATUSES,
      default: 'PENDING',
      index: true,
    },
    verificationAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxVerificationAttempts: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    codeExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    resetTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
    absoluteExpiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version',
    collection: 'password_reset_challenges',
  }
);

passwordResetChallengeSchema.index(
  { organisationId: 1, userId: 1, status: 1, createdAt: -1 },
  { name: 'password_reset_user_status_created' }
);

passwordResetChallengeSchema.index(
  { absoluteExpiresAt: 1 },
  { expireAfterSeconds: 0, name: 'expired_password_reset_cleanup' }
);

passwordResetChallengeSchema.pre('validate', function normalizeFields() {
  if (this.challengeId) this.challengeId = this.challengeId.trim().toUpperCase();
  if (this.organisationId) this.organisationId = this.organisationId.trim().toUpperCase();
  if (this.userId) this.userId = this.userId.trim().toUpperCase();

  if (
    this.codeExpiresAt &&
    this.absoluteExpiresAt &&
    this.codeExpiresAt > this.absoluteExpiresAt
  ) {
    this.invalidate('codeExpiresAt', 'Code expiry must not exceed absolute expiry.');
  }

  if (
    this.resetTokenExpiresAt &&
    this.absoluteExpiresAt &&
    this.resetTokenExpiresAt > this.absoluteExpiresAt
  ) {
    this.invalidate('resetTokenExpiresAt', 'Reset token expiry must not exceed absolute expiry.');
  }
});

passwordResetChallengeSchema.methods.toJSON = function safeChallengeJSON() {
  const value = this.toObject();
  delete value.codeHash;
  delete value.resetTokenHash;
  return value;
};

const PasswordResetChallenge =
  mongoose.models.PasswordResetChallenge ||
  mongoose.model('PasswordResetChallenge', passwordResetChallengeSchema);

module.exports = {
  PasswordResetChallenge,
  PASSWORD_RESET_STATUSES,
};
