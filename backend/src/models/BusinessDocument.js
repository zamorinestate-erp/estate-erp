'use strict';

const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    internalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    checksum: {
      type: String,
      trim: true,
      default: null,
    },
    fileData: {
      type: String, // Base64 fallback if string provided
      default: null,
    },
    fileBuffer: {
      type: Buffer, // Raw binary buffer fallback for legacy records
      default: null,
      select: false,
    },
    storagePath: {
      type: String, // Disk-backed protected storage path
      trim: true,
      default: null,
    },
    storageKey: {
      type: String, // Canonical non-public storage key
      trim: true,
      default: null,
    },
    storageDriver: {
      type: String,
      enum: ['RENDER_PERSISTENT_DISK', 'PRIVATE_OBJECT_STORAGE', 'LEGACY_BUFFER'],
      default: 'RENDER_PERSISTENT_DISK',
    },
    securityScanStatus: {
      type: String,
      enum: ['PENDING_SCAN', 'CLEAN', 'REJECTED', 'SCAN_FAILED'],
      default: 'PENDING_SCAN',
    },
    securityScanDetails: {
      type: String,
      trim: true,
      default: 'scanner integration ready — production provider pending',
    },
    changeReason: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const businessDocumentSchema = new mongoose.Schema(
  {
    documentId: {
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
    relatedModule: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // e.g., 'PROCUREMENT', 'INVENTORY', 'ASSETS', 'EMPLOYEE', 'FINANCE', 'COMPLIANCE'
      index: true,
    },
    relatedRecordId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // e.g. PO ID, Asset ID, Employee ID
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      trim: true, // e.g., 'SUPPLIER_INVOICE', 'DELIVERY_CHALLAN', 'QUOTATION', 'GRN_PHOTO', 'APPOINTMENT_LETTER', 'GST_CERTIFICATE'
    },
    classification: {
      type: String,
      enum: [
        'PROCUREMENT',
        'INVENTORY',
        'FINANCE',
        'HR_SELF',
        'HR_CONFIDENTIAL',
        'SUPPLIER_GENERAL',
        'SUPPLIER_BANKING',
        'COMPLIANCE',
        'ASSET',
        'MANAGEMENT_CONFIDENTIAL',
      ],
      default: 'PROCUREMENT',
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    documentNumber: {
      type: String,
      trim: true,
      default: '',
    },
    entityName: {
      type: String, // Supplier name, Employee name, or Issuing Authority
      trim: true,
      default: '',
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    renewalOwner: {
      type: String,
      trim: true,
      default: null,
    },
    supersededBy: {
      type: String,
      trim: true,
      default: null,
    },
    amountPaisa: {
      type: Number,
      min: 0,
      default: null,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    internalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    checksum: {
      type: String,
      trim: true,
      default: null,
    },
    fileData: {
      type: String, // Base64 fallback if string provided
      default: null,
    },
    fileBuffer: {
      type: Buffer, // Raw binary buffer fallback for legacy records
      default: null,
      select: false,
    },
    storagePath: {
      type: String, // Disk-backed protected storage path
      trim: true,
      default: null,
    },
    storageKey: {
      type: String, // Canonical non-public storage key
      trim: true,
      default: null,
      index: true,
    },
    storageDriver: {
      type: String,
      enum: ['RENDER_PERSISTENT_DISK', 'PRIVATE_OBJECT_STORAGE', 'LEGACY_BUFFER'],
      default: 'RENDER_PERSISTENT_DISK',
      index: true,
    },
    securityScanStatus: {
      type: String,
      enum: ['PENDING_SCAN', 'CLEAN', 'REJECTED', 'SCAN_FAILED'],
      default: 'PENDING_SCAN',
      index: true,
    },
    securityScanDetails: {
      type: String,
      trim: true,
      default: 'scanner integration ready — production provider pending',
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    versions: {
      type: [documentVersionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['UPLOADED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED'],
      default: 'UPLOADED',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedBy: {
      type: String,
      trim: true,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationReason: {
      type: String,
      trim: true,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
    },
    deletionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'business_documents',
  }
);

businessDocumentSchema.virtual('version').get(function () {
  return this.currentVersion;
}).set(function (v) {
  this.currentVersion = v;
});

documentVersionSchema.virtual('versionNumber').get(function () {
  return this.version;
});

businessDocumentSchema.index({ organisationId: 1, relatedModule: 1, relatedRecordId: 1 });
businessDocumentSchema.index({ organisationId: 1, cafeId: 1, isDeleted: 1 });

const BusinessDocument =
  mongoose.models.BusinessDocument ||
  mongoose.model('BusinessDocument', businessDocumentSchema);

module.exports = {
  BusinessDocument,
};
