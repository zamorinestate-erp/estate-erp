'use strict';

const mongoose = require('mongoose');

const QR_TYPES = [
  'CAFE_LOGIN',
  'TABLE_ORDER',
  'EMPLOYEE_BADGE',
  'ATTENDANCE_TOKEN',
  'PAYMENT_UPI',
  'INVENTORY_BATCH',
  'DOCUMENT_VERIFICATION'
];

const QR_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'];

const UniversalQrRecordSchema = new mongoose.Schema(
  {
    qrId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    qrType: {
      type: String,
      required: true,
      enum: QR_TYPES,
      index: true,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    cafeId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    targetEntityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Zamorin Official QR',
      trim: true,
    },
    payload: {
      type: String,
      required: true,
    },
    opaqueToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    hmacSignature: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: QR_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    scanCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastScannedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    createdBy: {
      type: String,
      default: 'SYSTEM',
    },
    revocationReason: {
      type: String,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'universal_qr_records',
  }
);

UniversalQrRecordSchema.index({ organisationId: 1, qrType: 1, status: 1 });
UniversalQrRecordSchema.index({ cafeId: 1, qrType: 1, status: 1 });

const UniversalQrRecord = mongoose.models.UniversalQrRecord || mongoose.model('UniversalQrRecord', UniversalQrRecordSchema);

module.exports = {
  UniversalQrRecord,
  QR_TYPES,
  QR_STATUSES,
};
