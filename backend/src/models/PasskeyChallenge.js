'use strict';

const mongoose = require('mongoose');

const CEREMONIES = ['REGISTRATION', 'AUTHENTICATION'];
const CHALLENGE_STATUSES = ['PENDING', 'CONSUMED', 'EXPIRED'];

const passkeyChallengeSchema = new mongoose.Schema(
  {
    challengeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },

    challenge: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },

    ceremony: {
      type: String,
      required: true,
      enum: CEREMONIES,
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
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: CHALLENGE_STATUSES,
      default: 'PENDING',
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

passkeyChallengeSchema.index({ challengeId: 1, status: 1 });
passkeyChallengeSchema.index({ organisationId: 1, challengeId: 1 });

const PasskeyChallenge =
  mongoose.models.PasskeyChallenge ||
  mongoose.model('PasskeyChallenge', passkeyChallengeSchema);

module.exports = {
  PasskeyChallenge,
  CEREMONIES,
  CHALLENGE_STATUSES,
};
