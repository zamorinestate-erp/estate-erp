'use strict';
// Unified session lifecycle for BOTH the Operator-PIN path and the
// Master-account path — see ARCHITECTURE_DECISIONS.md section 2 for why
// this is one engine rather than two. Every function here is agnostic to
// sessionType except where a comment says otherwise.
const { getRepositories } = require('../repositories');
const { generateSessionCode, generateOpaqueToken, sha256Hex } = require('../utils/ids');
const sessionPolicy = require('../config/sessionPolicy');
const auditService = require('./auditService');
const { SESSION_END_REASON, SECURITY_EVENT_TYPE } = require('../utils/constants');

function inactivityDeadline(session) { return new Date(new Date(session.lastActivityAt).getTime() + sessionPolicy.INACTIVITY_LOCK_TIMEOUT_MINUTES * 60000); }
function overallDeadline(session) { return new Date(new Date(session.startedAt).getTime() + sessionPolicy.OVERALL_SESSION_LIFETIME_HOURS * 3600000); }

async function evaluateSessionLiveness(session, now = new Date()) {
  if (session.status === 'ENDED') return { expired: true, reason: 'ALREADY_ENDED' };
  if (now > overallDeadline(session)) return { expired: true, reason: SESSION_END_REASON.OVERALL_EXPIRY };
  if (session.status === 'ACTIVE' && now > inactivityDeadline(session)) {
    return { expired: false, shouldLock: true, reason: SESSION_END_REASON.INACTIVITY_EXPIRY };
  }
  return { expired: false, shouldLock: false, reason: null };
}

async function createSession({ sessionType, employeeId, organisationId, cafeId, deviceId, actorRole, authMethod, authenticationStrength, accessReason, mfaVerifiedAt }) {
  const repos = getRepositories();

  // One active human context per device, regardless of session type
  // (login spec Section 70 / master spec Section 38) — ending whatever is
  // currently on this device, of either type, before starting the new one.
  const existingOnDevice = await repos.sessions.findActiveByDevice(deviceId);
  if (existingOnDevice) {
    const reason = String(existingOnDevice.actorEmployeeId) === String(employeeId)
      ? SESSION_END_REASON.ABNORMAL_TERMINATION
      : SESSION_END_REASON.SWITCH_OPERATOR;
    await endSession({ sessionId: existingOnDevice.id, reason });
  }

  // Concurrent-session detection across OTHER devices (login spec Section 71
  // / master spec Section 111-113). Never allowed to widen cafe scope either
  // way — it's purely an audit signal unless DENY_CONCURRENT_SESSIONS is set.
  const elsewhere = await repos.sessions.findActiveByEmployeeExcludingDevice(employeeId, deviceId);
  if (elsewhere) {
    if (sessionPolicy.DENY_CONCURRENT_SESSIONS) {
      const err = new Error('CONCURRENT_SESSION_DENIED'); err.code = 'CONCURRENT_SESSION_DENIED'; throw err;
    }
    await auditService.record({
      eventType: SECURITY_EVENT_TYPE.CONCURRENT_SESSION_DETECTED,
      employeeId, cafeId, deviceId, organisationId, sessionType, actorRole,
      metadata: { otherDeviceId: elsewhere.deviceId, otherSessionId: elsewhere.id },
    });
  }

  const sessionToken = generateOpaqueToken();
  const now = new Date();
  const session = await repos.sessions.create({
    sessionCode: generateSessionCode(sessionType),
    sessionType,
    workspaceMode: 'CAFE_OPERATIONS',
    actorEmployeeId: employeeId,
    actorRole,
    organisationId,
    effectiveCafeId: cafeId, // always := device.cafeId, set once, immutable for the life of the session
    deviceId,
    authMethod,
    authenticationStrength,
    mfaVerifiedAt: mfaVerifiedAt || null,
    lastStrongAuthenticationAt: authenticationStrength === 'STRONG' ? now : null,
    accessReason: accessReason || null,
    status: 'ACTIVE',
    sessionTokenHash: sha256Hex(sessionToken),
    startedAt: now,
    lastActivityAt: now,
  });

  return { session, sessionToken };
}

// Handles the app-restart / crash case: if the same employee already has a
// live (not-yet-expired) session on this exact device, resume it with a
// freshly-rotated token rather than silently trusting old client state.
// Otherwise falls through to a normal createSession.
async function resumeOrCreateSession(params) {
  const repos = getRepositories();
  const existing = await repos.sessions.findActiveByDevice(params.deviceId);
  if (existing && String(existing.actorEmployeeId) === String(params.employeeId)) {
    const liveness = await evaluateSessionLiveness(existing);
    if (!liveness.expired) {
      const sessionToken = generateOpaqueToken();
      const updated = await repos.sessions.update(existing.id, {
        status: 'ACTIVE', sessionTokenHash: sha256Hex(sessionToken), lastActivityAt: new Date(),
      });
      await auditService.record({
        eventType: SECURITY_EVENT_TYPE.STALE_SESSION_RECOVERED, sessionId: existing.id,
        employeeId: params.employeeId, cafeId: params.cafeId, deviceId: params.deviceId, organisationId: params.organisationId,
      });
      return { session: updated, sessionToken, resumed: true };
    }
    await endSession({ sessionId: existing.id, reason: liveness.reason });
    await auditService.record({
      eventType: SECURITY_EVENT_TYPE.STALE_SESSION_TERMINATED, sessionId: existing.id,
      employeeId: params.employeeId, cafeId: params.cafeId, deviceId: params.deviceId, organisationId: params.organisationId,
      reasonCode: liveness.reason,
    });
  }
  const created = await createSession(params);
  return { ...created, resumed: false };
}

async function touchActivity(sessionId, now = new Date()) {
  const repos = getRepositories();
  return repos.sessions.update(sessionId, { lastActivityAt: now });
}

async function lockSession(sessionId) {
  const repos = getRepositories();
  return repos.sessions.update(sessionId, { status: 'LOCKED', lockedAt: new Date() });
}

async function unlockSession(sessionId) {
  const repos = getRepositories();
  const now = new Date();
  return repos.sessions.update(sessionId, { status: 'ACTIVE', lastReauthAt: now, lastStrongAuthenticationAt: now, lastActivityAt: now });
}

async function recordStepUp(sessionId) {
  const repos = getRepositories();
  const now = new Date();
  return repos.sessions.update(sessionId, { lastReauthAt: now, lastStrongAuthenticationAt: now });
}

async function endSession({ sessionId, reason, handoverNote }) {
  const repos = getRepositories();
  return repos.sessions.update(sessionId, {
    status: 'ENDED', endedAt: new Date(), endReason: reason,
    handoverNote: handoverNote !== undefined ? handoverNote : undefined,
  });
}

async function endAllActiveSessionsForDevice(deviceId, reason) {
  const repos = getRepositories();
  const existing = await repos.sessions.findActiveByDevice(deviceId);
  if (existing) await endSession({ sessionId: existing.id, reason });
  return existing || null;
}

async function endAllActiveSessionsForEmployee(employeeId, reason) {
  const repos = getRepositories();
  const sessions = await repos.sessions.findAllActiveByEmployee(employeeId);
  for (const s of sessions) await endSession({ sessionId: s.id, reason });
  return sessions;
}

module.exports = {
  createSession, resumeOrCreateSession, touchActivity, lockSession, unlockSession, recordStepUp,
  endSession, endAllActiveSessionsForDevice, endAllActiveSessionsForEmployee,
  evaluateSessionLiveness, inactivityDeadline, overallDeadline,
};
