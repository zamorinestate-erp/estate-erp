'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CafeOpsSecurityEventSchema = new Schema({
  eventType: { type: String, required: true, index: true },
  organisationId: { type: Schema.Types.ObjectId, index: true },
  cafeId: { type: Schema.Types.ObjectId, index: true },
  deviceId: { type: Schema.Types.ObjectId, index: true },
  employeeId: { type: Schema.Types.ObjectId, index: true },
  sessionId: { type: Schema.Types.ObjectId, index: true },
  sessionType: { type: String },
  actorRole: { type: String },
  outcome: { type: String },
  reasonCode: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

module.exports = mongoose.model('CafeOpsSecurityEvent', CafeOpsSecurityEventSchema);
