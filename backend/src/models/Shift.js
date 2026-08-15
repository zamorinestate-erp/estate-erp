'use strict';

const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    shiftId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // e.g. "07:00"
    },

    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/, // e.g. "15:00"
    },

    graceMinutes: {
      type: Number,
      default: 15,
      min: 0,
      max: 120,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'shifts',
  }
);

shiftSchema.index({ organisationId: 1, cafeId: 1, isActive: 1 });

const Shift = mongoose.models.Shift || mongoose.model('Shift', shiftSchema);

module.exports = {
  Shift,
};
