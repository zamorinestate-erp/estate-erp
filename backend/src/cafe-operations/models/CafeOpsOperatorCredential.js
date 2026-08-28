'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Operator PIN credential. One per employee. Deliberately separate from
// whatever the real Employee/User schema looks like, so this module never
// has to write to a collection it doesn't own.
const CafeOpsOperatorCredentialSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
  organisationId: { type: Schema.Types.ObjectId, required: true, index: true },
  // bcrypt hash — the authoritative, slow verification (protects against
  // offline brute force of the DB at rest for a low-entropy 6-digit PIN).
  pinHash: { type: String, required: true, select: false },
  // Fast HMAC-SHA256(pepper, pin) index used ONLY to find the single
  // candidate credential in O(1) before the slow bcrypt confirms it — see
  // operatorPinService.js. Never used as the actual authorization decision
  // on its own.
  pinLookupHash: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ['ACTIVE', 'DISABLED', 'COMPROMISED'], default: 'ACTIVE' },
  issuedAt: { type: Date, default: Date.now },
  lastResetAt: { type: Date },
  lastChangedByEmployeeId: { type: Schema.Types.ObjectId },
}, { timestamps: true });

module.exports = mongoose.model('CafeOpsOperatorCredential', CafeOpsOperatorCredentialSchema);
