'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { OPERATOR_ACCESS_STATUS } = require('../utils/constants');

// Explicit, revocable grant: "this employee may operate this cafe's
// terminal." Never inferred from holding the CAFE_ADMIN role — see
// ARCHITECTURE_DECISIONS.md section 3 for why that distinction is load-bearing.
const CafeOpsOperatorAccessSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, required: true, index: true },
  cafeId: { type: Schema.Types.ObjectId, required: true, index: true },
  organisationId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: Object.values(OPERATOR_ACCESS_STATUS), default: 'ACTIVE', index: true },
  validFrom: { type: Date, default: null },
  validUntil: { type: Date, default: null }, // null = standing access
  assignedByEmployeeId: { type: Schema.Types.ObjectId, required: true },
  assignmentReason: { type: String },
  revokedAt: { type: Date },
  revokedByEmployeeId: { type: Schema.Types.ObjectId },
  revocationReason: { type: String },
}, { timestamps: true });

CafeOpsOperatorAccessSchema.index({ employeeId: 1, cafeId: 1, status: 1 });

module.exports = mongoose.model('CafeOpsOperatorAccess', CafeOpsOperatorAccessSchema);
