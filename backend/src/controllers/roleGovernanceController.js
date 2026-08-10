'use strict';

const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const {
  normalizeIdentifier,
  loadActor,
  loadTarget,
  actorIsPrimaryMaster,
  assertNotPrimaryMasterTarget,
  assertPrimaryMasterAuthority,
  assertRoleIsNotNoOp,
  rejectProtectedFields,
  validateProposedRole,
  assertExpectedState,
  calculateRoleImpactPreview,
  buildRoleHistoryEntry,
  buildUserSnapshot,
  revokeTargetSessions,
  auditGovernanceSuccess,
  auditGovernanceDenied,
} = require('../services/userGovernanceService');

// ─── Role-impact preview ──────────────────────────────────────────────────────

const previewRoleChange = asyncHandler(async (request, response) => {
  const actorDocument = await loadActor(request);

  // Only MASTER may reach this endpoint (already enforced by middleware),
  // but the Primary Master authority check is an explicit governance rule.
  assertPrimaryMasterAuthority(
    actorDocument,
    'preview or execute a MASTER-level role change'
  );

  const targetUserId = normalizeIdentifier(request.params.userId);
  const target = await loadTarget(request, targetUserId);

  // Cannot preview a change to the Primary Master
  await assertNotPrimaryMasterTarget(target, 'role cannot be changed', { request, actorDocument });

  const proposedRole = normalizeIdentifier(
    request.body?.proposedRole || request.body?.role || ''
  );

  if (!proposedRole) {
    throw new ApiError(
      400,
      'PROPOSED_ROLE_REQUIRED',
      'A proposed role is required for the role-impact preview.'
    );
  }

  validateProposedRole(proposedRole);
  assertRoleIsNotNoOp(target.role, proposedRole);

  const preview = await calculateRoleImpactPreview({
    request,
    actorDocument,
    target,
    proposedRole,
  });

  // Audit preview as a sensitive read
  try {
    await auditGovernanceSuccess({
      request,
      action: 'USER_ROLE_CHANGE_PREVIEWED',
      target,
      before: { role: target.role },
      after: { proposedRole },
      reason: `Role impact preview requested for ${targetUserId}`,
      riskClassification: 'HIGH',
      metadata: { preview: { currentRole: target.role, proposedRole } },
    });
  } catch (_err) {
    // Non-fatal
  }

  return response.status(200).json({
    success: true,
    data: preview,
    correlationId: request.correlationId || null,
  });
});

// ─── Role execution ───────────────────────────────────────────────────────────

const executeRoleChange = asyncHandler(async (request, response) => {
  const body = request.body || {};

  // 1. Explicit confirmation gate
  if (body.confirmed !== true) {
    throw new ApiError(
      400,
      'ROLE_CHANGE_CONFIRMATION_REQUIRED',
      'Set confirmed: true to execute the role change after reviewing the preview.'
    );
  }

  // 2. Proposed role
  const proposedRole = normalizeIdentifier(
    body.proposedRole || body.role || ''
  );

  if (!proposedRole) {
    throw new ApiError(
      400,
      'PROPOSED_ROLE_REQUIRED',
      'A proposed role is required.'
    );
  }

  validateProposedRole(proposedRole);

  // 3. Reload actor (freshly from DB, not from token claim alone)
  const actorDocument = await loadActor(request);

  assertPrimaryMasterAuthority(
    actorDocument,
    'grant or revoke the MASTER role'
  );

  // 4. Reload target inside actor's organisation
  const targetUserId = normalizeIdentifier(request.params.userId);
  const target = await loadTarget(request, targetUserId);

  // 5. Primary Master protection — cannot change Primary Master's role
  await assertNotPrimaryMasterTarget(target, 'role cannot be changed', { request, actorDocument });

  // 6. No-op check
  assertRoleIsNotNoOp(target.role, proposedRole);

  // 7. Stale-state validation — reject if target has changed since preview
  assertExpectedState(target, {
    expectedCurrentRole: normalizeIdentifier(body.expectedCurrentRole || ''),
    expectedSessionVersion:
      typeof body.expectedSessionVersion === 'number'
        ? body.expectedSessionVersion
        : undefined,
    expectedPermissionsVersion:
      typeof body.expectedPermissionsVersion === 'number'
        ? body.expectedPermissionsVersion
        : undefined,
  });

  // 8. Reason (middleware enforces it, but read it for history)
  const reason =
    typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!reason) {
    throw new ApiError(
      400,
      'REASON_REQUIRED',
      'A reason is required for this role change.'
    );
  }

  // 9. Capture before state
  const beforeSnapshot = buildUserSnapshot(target);

  // 10. Append role history entry
  const historyEntry = buildRoleHistoryEntry({
    fromRole: target.role,
    toRole: proposedRole,
    request,
    reason,
  });

  target.roleHistory.push(historyEntry);

  // 11. Change the role
  target.role = proposedRole;

  // 12. Increment versions
  target.sessionVersion += 1;
  target.permissionsVersion += 1;
  target.updatedBy = request.auth.userId;

  // 13. Save
  await target.save();

  // 14. Capture after state
  const afterSnapshot = buildUserSnapshot(target);

  // 15. Revoke target sessions
  let revokedCount = 0;

  try {
    revokedCount = await revokeTargetSessions({
      request,
      target,
      reason: 'ROLE_CHANGED',
    });
  } catch (_err) {
    // Session revocation failure is non-fatal after save
  }

  // 16. Audit
  await auditGovernanceSuccess({
    request,
    action: 'USER_ROLE_CHANGED',
    target,
    before: beforeSnapshot,
    after: afterSnapshot,
    reason,
    riskClassification: 'CRITICAL',
    metadata: {
      fromRole: beforeSnapshot.role,
      toRole: proposedRole,
      revokedSessionCount: revokedCount,
    },
  });

  return response.status(200).json({
    success: true,
    message: `User role changed from ${beforeSnapshot.role} to ${proposedRole} successfully.`,
    data: {
      user: target,
      fromRole: beforeSnapshot.role,
      toRole: proposedRole,
      revokedSessionCount: revokedCount,
    },
    correlationId: request.correlationId || null,
  });
});

// ─── Protected-field check for general update ─────────────────────────────────

const checkProtectedFields = asyncHandler(async (request, response, next) => {
  rejectProtectedFields(request.body);
  return next();
});

module.exports = {
  previewRoleChange,
  executeRoleChange,
  checkProtectedFields,
};
