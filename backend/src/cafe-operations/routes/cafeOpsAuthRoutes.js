'use strict';
const express = require('express');
const { getRepositories } = require('../repositories');
const pinService = require('../services/operatorPinService');
const operatorAuthz = require('../services/operatorAuthorizationService');
const masterAuthz = require('../services/masterAuthorizationService');
const sessionService = require('../services/cafeOpsSessionService');
const rateLimitService = require('../services/rateLimitService');
const auditService = require('../services/auditService');
const supportRefService = require('../services/supportReferenceService');
const masterAuthAdapterModule = require('../services/masterAuthAdapter');
const sessionPolicy = require('../config/sessionPolicy');
const { deviceContext } = require('../middleware/deviceContext');
const { cafeOpsSessionContext } = require('../middleware/cafeOpsSessionContext');
const { ok, fail, genericAuthFailure, masterAuthFailure, throttled } = require('../utils/responses');
const { SECURITY_EVENT_TYPE, ACTOR_ROLE, AUTH_METHOD, AUTH_STRENGTH, SESSION_END_REASON } = require('../utils/constants');

const router = express.Router();

function withSession(handler, opts) { return [cafeOpsSessionContext(opts), handler]; }

function publicSession(session) {
  return {
    sessionCode: session.sessionCode,
    sessionType: session.sessionType,
    actorRole: session.actorRole,
    status: session.status,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    lockedAt: session.lockedAt || null,
    accessReason: session.accessReason || null,
  };
}

// Master accounts aren't a local collection this module owns (see
// config/integrationRefs.js) — fall back to trusting the adapter's response
// when there's no local record to check, which is the expected shape for a
// real integration. The local `masters` store exists mainly so isActive /
// role-revocation scenarios are directly testable in this module.
async function resolveMasterRecord(employeeId, fallback) {
  const repos = getRepositories();
  try {
    const rec = await repos.masters.findById(employeeId);
    if (rec) return rec;
  } catch (e) { /* no local record configured — expected in real integration */ }
  return { id: employeeId, isActive: true, organisationId: fallback.organisationId, role: fallback.role };
}

// =====================================================================
// OPERATOR PIN PATH
// =====================================================================

router.post('/signin', deviceContext, async (req, res, next) => {
  try {
    const device = req.cafeOpsDevice;
    const { pin } = req.body || {};
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return fail(res, 400, 'INVALID_INPUT', 'Enter your 6-digit Operator PIN.');
    }

    const lockState = rateLimitService.isLocked(device.id, 'PIN');
    if (lockState.locked) {
      const ref = supportRefService.generate({ deviceId: device.id, reason: 'THROTTLED_PIN' });
      await auditService.record({ eventType: SECURITY_EVENT_TYPE.SIGNIN_THROTTLED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId, metadata: { path: 'PIN' } });
      return throttled(res, { retryAt: lockState.retryAt, supportReference: ref });
    }

    const repos = getRepositories();
    const lookupHash = pinService.computeLookupHash(pin);
    const credential = await repos.operatorCredentials.findByLookupHash(lookupHash);
    const employee = credential ? await repos.employees.findById(credential.employeeId) : null;
    const pinOk = credential ? await pinService.verifyPin(pin, credential.pinHash) : await pinService.verifyPin(pin, null);

    let operatorAccess = null;
    if (credential && pinOk) operatorAccess = await repos.operatorAccess.findActiveForEmployeeAndCafe(credential.employeeId, device.cafeId);

    const decision = operatorAuthz.evaluateOperatorAccess({ device, employee: pinOk ? employee : null, operatorAccess, now: new Date() });

    if (!pinOk || !decision.granted) {
      rateLimitService.recordFailure(device.id, 'PIN');
      const ref = supportRefService.generate({ deviceId: device.id, reason: pinOk ? decision.reason : 'INVALID_PIN' });
      await auditService.record({
        eventType: SECURITY_EVENT_TYPE.OPERATOR_SIGNIN_FAILED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId,
        employeeId: credential ? credential.employeeId : undefined, reasonCode: pinOk ? decision.reason : 'INVALID_PIN', metadata: { supportReference: ref },
      });
      return genericAuthFailure(res, { supportReference: ref });
    }

    rateLimitService.recordSuccess(device.id, 'PIN');
    const { session, sessionToken, resumed } = await sessionService.resumeOrCreateSession({
      sessionType: 'OPERATOR_PIN', employeeId: employee.id, organisationId: device.organisationId, cafeId: device.cafeId, deviceId: device.id,
      actorRole: ACTOR_ROLE.CAFE_ADMIN, authMethod: AUTH_METHOD.OPERATOR_PIN, authenticationStrength: AUTH_STRENGTH.STANDARD,
    });

    await auditService.record({
      eventType: SECURITY_EVENT_TYPE.OPERATOR_SIGNIN_SUCCESS, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId,
      employeeId: employee.id, sessionId: session.id, sessionType: 'OPERATOR_PIN', actorRole: ACTOR_ROLE.CAFE_ADMIN, outcome: resumed ? 'RESUMED' : 'CREATED',
    });

    return ok(res, {
      sessionToken, session: publicSession(session),
      operator: { employeeId: employee.id, employeeCode: employee.employeeCode, name: employee.name, cafeId: device.cafeId, cafeName: device.cafeDisplayName || null },
    });
  } catch (err) { next(err); }
});

// =====================================================================
// MASTER ACCOUNT PATH — separate credential space, separate rate-limit
// scope, separate authorization function. Never touches the PIN tables.
// =====================================================================

router.post('/master-signin/credentials', deviceContext, async (req, res, next) => {
  try {
    const device = req.cafeOpsDevice;
    const { identifier, password, accessReason } = req.body || {};
    if (!identifier || !password) return fail(res, 400, 'INVALID_INPUT', 'Enter your Master account details.');
    if (sessionPolicy.MASTER_ACCESS_REASON_REQUIRED && !accessReason) {
      return fail(res, 400, 'ACCESS_REASON_REQUIRED', 'Select a reason for Master access to continue.');
    }

    const lockState = rateLimitService.isLocked(device.id, 'MASTER');
    if (lockState.locked) {
      const ref = supportRefService.generate({ deviceId: device.id, reason: 'THROTTLED_MASTER' });
      await auditService.record({ eventType: SECURITY_EVENT_TYPE.SIGNIN_THROTTLED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId, metadata: { path: 'MASTER' } });
      return throttled(res, { retryAt: lockState.retryAt, supportReference: ref });
    }

    const adapter = masterAuthAdapterModule.getMasterAuthAdapter();
    const result = await adapter.identify({ identifier, password });

    if (!result.ok) {
      rateLimitService.recordFailure(device.id, 'MASTER');
      const ref = supportRefService.generate({ deviceId: device.id, reason: 'MASTER_AUTH_FAILED' });
      await auditService.record({ eventType: SECURITY_EVENT_TYPE.MASTER_SIGNIN_FAILED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId, reasonCode: 'MASTER_AUTH_FAILED', metadata: { supportReference: ref } });
      return masterAuthFailure(res, { supportReference: ref });
    }

    if (result.requiresMfa) {
      return ok(res, { requiresMfa: true, mfaChallengeId: result.mfaChallengeId });
    }

    return finishMasterSignin(req, res, { ...result, accessReason });
  } catch (err) { next(err); }
});

router.post('/master-signin/mfa', deviceContext, async (req, res, next) => {
  try {
    const device = req.cafeOpsDevice;
    const { mfaChallengeId, code, accessReason } = req.body || {};
    if (!mfaChallengeId || !code) return fail(res, 400, 'INVALID_INPUT', 'Enter the verification code.');

    const lockState = rateLimitService.isLocked(device.id, 'MASTER');
    if (lockState.locked) return throttled(res, { retryAt: lockState.retryAt });

    const adapter = masterAuthAdapterModule.getMasterAuthAdapter();
    const result = await adapter.completeMfa({ mfaChallengeId, code });
    if (!result.ok) {
      rateLimitService.recordFailure(device.id, 'MASTER');
      await auditService.record({ eventType: SECURITY_EVENT_TYPE.MASTER_SIGNIN_FAILED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId, reasonCode: 'MFA_FAILED' });
      return masterAuthFailure(res);
    }
    return finishMasterSignin(req, res, { ...result, mfaVerifiedAt: new Date(), accessReason });
  } catch (err) { next(err); }
});

async function finishMasterSignin(req, res, { employeeId, organisationId, role, mfaVerifiedAt, accessReason }) {
  const device = req.cafeOpsDevice;
  const master = await resolveMasterRecord(employeeId, { organisationId, role });
  const decision = masterAuthz.evaluateMasterCafeOperationsAccess({ device, master, now: new Date() });

  if (!decision.granted) {
    rateLimitService.recordFailure(device.id, 'MASTER');
    const ref = supportRefService.generate({ deviceId: device.id, reason: decision.reason });
    await auditService.record({
      eventType: SECURITY_EVENT_TYPE.MASTER_SIGNIN_FAILED, deviceId: device.id, cafeId: device.cafeId, organisationId: device.organisationId,
      employeeId, reasonCode: decision.reason, metadata: { supportReference: ref },
    });
    return masterAuthFailure(res, { supportReference: ref });
  }

  rateLimitService.recordSuccess(device.id, 'MASTER');
  const { session, sessionToken, resumed } = await sessionService.resumeOrCreateSession({
    sessionType: 'MASTER_ACCOUNT', employeeId, organisationId: master.organisationId, cafeId: device.cafeId, deviceId: device.id,
    actorRole: master.role,
    authMethod: mfaVerifiedAt ? AUTH_METHOD.MASTER_PASSWORD_MFA : AUTH_METHOD.MASTER_PASSWORD,
    authenticationStrength: AUTH_STRENGTH.STRONG,
    accessReason, mfaVerifiedAt,
  });

  await auditService.record({
    eventType: SECURITY_EVENT_TYPE.MASTER_SIGNIN_SUCCESS, deviceId: device.id, cafeId: device.cafeId, organisationId: master.organisationId,
    employeeId, sessionId: session.id, sessionType: 'MASTER_ACCOUNT', actorRole: master.role, outcome: resumed ? 'RESUMED' : 'CREATED',
  });

  return ok(res, {
    sessionToken, session: publicSession(session),
    operator: { employeeId, role: master.role, cafeId: device.cafeId, cafeName: device.cafeDisplayName || null },
  });
}

// =====================================================================
// SHARED SESSION LIFECYCLE
// =====================================================================

router.get('/session', deviceContext, ...withSession(async (req, res) => {
  return ok(res, { session: publicSession(req.cafeOpsSession) });
}, { allowLocked: true }));

router.post('/lock', deviceContext, ...withSession(async (req, res) => {
  const updated = await sessionService.lockSession(req.cafeOpsSession.id);
  await auditService.record({ eventType: SECURITY_EVENT_TYPE.SESSION_LOCKED, deviceId: req.cafeOpsDevice.id, employeeId: req.cafeOpsSession.actorEmployeeId, sessionId: req.cafeOpsSession.id, sessionType: req.cafeOpsSession.sessionType });
  return ok(res, { session: publicSession(updated) });
}));

router.post('/unlock', deviceContext, ...withSession(async (req, res) => {
  const device = req.cafeOpsDevice;
  const session = req.cafeOpsSession;
  const repos = getRepositories();
  const scope = session.sessionType === 'MASTER_ACCOUNT' ? 'MASTER' : 'PIN';

  const lockState = rateLimitService.isLocked(device.id, scope);
  if (lockState.locked) return throttled(res, { retryAt: lockState.retryAt });

  let unlockOk = false;
  if (session.sessionType === 'OPERATOR_PIN') {
    const { pin } = req.body || {};
    const credential = await repos.operatorCredentials.findByEmployeeId(session.actorEmployeeId);
    unlockOk = credential ? await pinService.verifyPin(pin, credential.pinHash) : await pinService.verifyPin(pin, null);
    if (unlockOk) {
      const employee = await repos.employees.findById(session.actorEmployeeId);
      const operatorAccess = await repos.operatorAccess.findActiveForEmployeeAndCafe(session.actorEmployeeId, device.cafeId);
      unlockOk = operatorAuthz.evaluateOperatorAccess({ device, employee, operatorAccess }).granted;
    }
  } else {
    const { password, mfaCode } = req.body || {};
    const adapter = masterAuthAdapterModule.getMasterAuthAdapter();
    const result = await adapter.reauth({ employeeId: session.actorEmployeeId, password, mfaCode });
    unlockOk = result.ok;
    if (unlockOk) {
      const master = await resolveMasterRecord(session.actorEmployeeId, { organisationId: result.organisationId, role: result.role });
      unlockOk = masterAuthz.evaluateMasterCafeOperationsAccess({ device, master }).granted;
    }
  }

  if (!unlockOk) {
    rateLimitService.recordFailure(device.id, scope);
    await auditService.record({ eventType: SECURITY_EVENT_TYPE.SESSION_REAUTH_FAILED, deviceId: device.id, employeeId: session.actorEmployeeId, sessionId: session.id, sessionType: session.sessionType });
    return scope === 'MASTER' ? masterAuthFailure(res) : genericAuthFailure(res);
  }

  rateLimitService.recordSuccess(device.id, scope);
  const updated = await sessionService.unlockSession(session.id);
  await auditService.record({ eventType: SECURITY_EVENT_TYPE.SESSION_UNLOCKED, deviceId: device.id, employeeId: session.actorEmployeeId, sessionId: session.id, sessionType: session.sessionType });
  return ok(res, { session: publicSession(updated) });
}, { allowLocked: true }));

router.post('/confirm', deviceContext, ...withSession(async (req, res) => {
  const device = req.cafeOpsDevice;
  const session = req.cafeOpsSession;
  const repos = getRepositories();
  let confirmOk = false;

  if (session.sessionType === 'OPERATOR_PIN') {
    const { pin } = req.body || {};
    const credential = await repos.operatorCredentials.findByEmployeeId(session.actorEmployeeId);
    confirmOk = credential ? await pinService.verifyPin(pin, credential.pinHash) : await pinService.verifyPin(pin, null);
  } else {
    const { password, mfaCode } = req.body || {};
    const adapter = masterAuthAdapterModule.getMasterAuthAdapter();
    confirmOk = (await adapter.reauth({ employeeId: session.actorEmployeeId, password, mfaCode })).ok;
  }

  if (!confirmOk) {
    await auditService.record({ eventType: SECURITY_EVENT_TYPE.STEP_UP_FAILED, deviceId: device.id, employeeId: session.actorEmployeeId, sessionId: session.id, sessionType: session.sessionType });
    return session.sessionType === 'MASTER_ACCOUNT' ? masterAuthFailure(res) : genericAuthFailure(res);
  }
  await sessionService.recordStepUp(session.id);
  await auditService.record({ eventType: SECURITY_EVENT_TYPE.STEP_UP_CONFIRMED, deviceId: device.id, employeeId: session.actorEmployeeId, sessionId: session.id, sessionType: session.sessionType });
  return ok(res, { confirmedAt: new Date().toISOString() });
}));

router.post('/end', deviceContext, ...withSession(async (req, res) => {
  const { handoverNote, forSwitch } = req.body || {};
  const reason = forSwitch ? SESSION_END_REASON.SWITCH_OPERATOR : SESSION_END_REASON.MANUAL_END;
  await sessionService.endSession({ sessionId: req.cafeOpsSession.id, reason, handoverNote });
  await auditService.record({
    eventType: forSwitch ? SECURITY_EVENT_TYPE.SESSION_SWITCHED : SECURITY_EVENT_TYPE.SESSION_ENDED,
    deviceId: req.cafeOpsDevice.id, employeeId: req.cafeOpsSession.actorEmployeeId,
    sessionId: req.cafeOpsSession.id, sessionType: req.cafeOpsSession.sessionType, reasonCode: reason,
  });
  return ok(res, { nextScreen: forSwitch ? 'OPERATOR_SIGN_IN' : 'ATTENDANCE_KIOSK' });
}, { allowLocked: true }));

router.post('/heartbeat', deviceContext, ...withSession(async (req, res) => {
  await sessionService.touchActivity(req.cafeOpsSession.id);
  return ok(res, {});
}));

module.exports = router;
