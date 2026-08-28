'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { SESSION_TYPE, WORKSPACE_MODE, ACTOR_ROLE, AUTH_METHOD, AUTH_STRENGTH, SESSION_STATUS } = require('../utils/constants');

// One unified session record for BOTH the Operator-PIN path and the
// Master-account path. See ARCHITECTURE_DECISIONS.md section 2 for why this
// is one table with a discriminator rather than two parallel ones — the
// lifecycle (lock/unlock/switch/end/expire/audit) is identical either way;
// only how the session was established, and what it's allowed to imply
// about the actor's role, differs.
const CafeOpsSessionSchema = new Schema({
  sessionCode: { type: String, required: true, unique: true },
  sessionType: { type: String, enum: Object.values(SESSION_TYPE), required: true, index: true },
  workspaceMode: { type: String, enum: Object.values(WORKSPACE_MODE), default: WORKSPACE_MODE.CAFE_OPERATIONS },

  actorEmployeeId: { type: Schema.Types.ObjectId, required: true, index: true },
  actorRole: { type: String, enum: Object.values(ACTOR_ROLE), required: true },

  organisationId: { type: Schema.Types.ObjectId, required: true },
  // Always = device.cafeId at the moment the session was created. For the
  // Master path this is a workspace-boundary assignment, not a permission
  // grant being looked up — see ARCHITECTURE_DECISIONS.md section 3.
  effectiveCafeId: { type: Schema.Types.ObjectId, required: true, index: true },
  deviceId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'CafeOpsDevice' },

  authMethod: { type: String, enum: Object.values(AUTH_METHOD), required: true },
  authenticationStrength: { type: String, enum: Object.values(AUTH_STRENGTH), required: true },
  mfaVerifiedAt: { type: Date },
  lastStrongAuthenticationAt: { type: Date },
  accessReason: { type: String }, // Master-path only, optional per policy

  status: { type: String, enum: Object.values(SESSION_STATUS), default: 'ACTIVE', index: true },
  sessionTokenHash: { type: String, select: false, required: true },

  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  lockedAt: { type: Date },
  lastReauthAt: { type: Date },
  endedAt: { type: Date },
  endReason: { type: String },
  handoverNote: { type: String },
}, { timestamps: true });

CafeOpsSessionSchema.index({ deviceId: 1, status: 1 });
CafeOpsSessionSchema.index({ actorEmployeeId: 1, status: 1 });
CafeOpsSessionSchema.index({ effectiveCafeId: 1, startedAt: -1 });

module.exports = mongoose.model('CafeOpsSession', CafeOpsSessionSchema);
