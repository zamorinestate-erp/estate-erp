'use strict';

const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema(
  {
    exportId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      trim: true,
      default: 'REPORT',
    },
    reportTitle: {
      type: String,
      required: true,
      trim: true,
    },
    relatedRecordId: {
      type: String,
      trim: true,
      default: null,
    },
    format: {
      type: String,
      required: true,
      enum: ['PDF', 'XLSX'],
      uppercase: true,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    generatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    actorRole: {
      type: String,
      trim: true,
      default: 'OPERATOR',
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    destinationType: {
      type: String,
      enum: ['DEVICE_STORAGE', 'BROWSER_DOWNLOAD', 'PWA_PICKER'],
      default: 'BROWSER_DOWNLOAD',
    },
    status: {
      type: String,
      enum: ['GENERATED', 'DOWNLOADED', 'PRINTED', 'ARCHIVED'],
      default: 'GENERATED',
    },
    templateVersion: {
      type: String,
      default: 'Zamorin Universal Report Template v1.0',
    },
    checksum: {
      type: String,
      trim: true,
      default: null,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    filterCriteria: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'export_histories',
  }
);

exportHistorySchema.index({ organisationId: 1, createdAt: -1 });
exportHistorySchema.index({ organisationId: 1, cafeId: 1, createdAt: -1 });

const ExportHistory = mongoose.models.ExportHistory || mongoose.model('ExportHistory', exportHistorySchema);

module.exports = {
  ExportHistory,
};
