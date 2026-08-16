'use strict';

/**
 * ATTACHMENT REGISTRY — MONGOOSE MODEL
 *
 * Attachment Security Gateway & Hash Registry.
 * Enforces file size limits, MIME validation, dangerous extension blocking
 * (.exe, .bat, .cmd, .scr, .ps1, .js, .msi, .vbs, .hta, macro docs),
 * calculates SHA-256 digests, and detects duplicate invoices/documents.
 */

const mongoose = require('mongoose');

const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'scr', 'ps1', 'js', 'msi', 'com', 'vbs',
  'hta', 'pif', 'cpl', 'jar', 'gadget', 'wsf', 'reg', 'docm', 'xlsm'
];

const SCAN_STATUSES = ['PASSED', 'QUARANTINED', 'BLOCKED_EXTENSION', 'MALICIOUS_SUSPECTED'];
const DOCUMENT_TYPES = [
  'INVOICE',
  'QUOTATION',
  'PURCHASE_ORDER',
  'DELIVERY_CHALLAN',
  'CERTIFICATE',
  'REPORT',
  'IMAGE',
  'OTHER',
  'DANGEROUS_REJECTED',
];

const attachmentRegistrySchema = new mongoose.Schema(
  {
    attachmentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: 'ZAMORIN',
    },

    inboundId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: null,
    },

    gmailMessageId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    gmailThreadId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    originalFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    sanitizedFilename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    extension: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 30,
    },

    mimeType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },

    sha256Hash: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 64,
    },

    scanStatus: {
      type: String,
      enum: SCAN_STATUSES,
      default: 'PASSED',
    },

    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: 'OTHER',
    },

    isDangerous: {
      type: Boolean,
      default: false,
    },

    quarantineReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    matchedVendorId: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    isDuplicateInvoice: {
      type: Boolean,
      default: false,
    },

    duplicateReferenceId: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'attachment_registries',
  }
);

attachmentRegistrySchema.index({ attachmentId: 1 }, { unique: true });
attachmentRegistrySchema.index({ sha256Hash: 1 });
attachmentRegistrySchema.index({ organisationId: 1, matchedVendorId: 1, sha256Hash: 1 });

const AttachmentRegistry = mongoose.model('AttachmentRegistry', attachmentRegistrySchema);

module.exports = {
  AttachmentRegistry,
  DANGEROUS_EXTENSIONS,
  SCAN_STATUSES,
  DOCUMENT_TYPES,
};
