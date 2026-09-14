'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — THIRD-PARTY PROCESSOR REGISTER (STAGE 08)
 * ============================================================================
 * Governance of data processors, service contracts, data storage geographies,
 * sub-processors, and exit/deletion obligations under DPDP Act readiness.
 */

const mongoose = require('mongoose');

const thirdPartyProcessorSchema = new mongoose.Schema(
  {
    processorId: {
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
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceDescription: {
      type: String,
      required: true,
      trim: true,
    },
    dataCategoriesProcessed: [
      {
        type: String,
        trim: true,
      },
    ],
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    contractReference: {
      type: String,
      trim: true,
      default: '',
    },
    securityReviewDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },
    dataStorageGeography: {
      type: String,
      trim: true,
      default: 'India (MeitY empaneled cloud)',
    },
    subProcessors: [
      {
        name: { type: String, trim: true },
        service: { type: String, trim: true },
        country: { type: String, trim: true },
      },
    ],
    exitDeletionObligation: {
      type: String,
      trim: true,
      default: 'Mandatory certificate of destruction within 30 days of contract termination',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'third_party_processors',
  }
);

thirdPartyProcessorSchema.index({ organisationId: 1, isActive: 1 });

const ThirdPartyProcessor =
  mongoose.models.ThirdPartyProcessor ||
  mongoose.model('ThirdPartyProcessor', thirdPartyProcessorSchema);

module.exports = {
  ThirdPartyProcessor,
};
