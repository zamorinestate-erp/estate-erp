'use strict';

const mongoose = require('mongoose');

const cafePinReservationSchema = new mongoose.Schema(
  {
    pinLookupHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    cafeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'cafe_pin_reservations',
  }
);

const CafePinReservation =
  mongoose.models.CafePinReservation ||
  mongoose.model('CafePinReservation', cafePinReservationSchema);

module.exports = {
  CafePinReservation,
};
