'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CafeOpsDeviceEnrollmentTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  organisationId: { type: Schema.Types.ObjectId, required: true },
  cafeId: { type: Schema.Types.ObjectId, required: true },
  cafeDisplayName: { type: String },
  intendedDisplayName: { type: String },
  status: { type: String, enum: ['PENDING', 'USED', 'EXPIRED', 'REVOKED'], default: 'PENDING' },
  createdByEmployeeId: { type: Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  usedByDeviceId: { type: Schema.Types.ObjectId, ref: 'CafeOpsDevice' },
}, { timestamps: true });

module.exports = mongoose.model('CafeOpsDeviceEnrollmentToken', CafeOpsDeviceEnrollmentTokenSchema);
