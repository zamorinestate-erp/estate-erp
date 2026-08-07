'use strict';

/**
 * PRIVATE FILE — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const privateFileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^FILE-\d{4,}$/,
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

    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },

    storagePath: {
      type: String,
      required: true,
      trim: true,
    },

    uploadedByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'private_files',
  }
);

privateFileSchema.pre('validate', function normaliseFileFields() {
  const upperFields = ['fileId', 'organisationId', 'uploadedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
});

const PrivateFile =
  mongoose.models.PrivateFile ||
  mongoose.model('PrivateFile', privateFileSchema);

module.exports = {
  PrivateFile,
};
