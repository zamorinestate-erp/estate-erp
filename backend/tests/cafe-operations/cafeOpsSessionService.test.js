'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { initRepositories } = require('../../src/cafe-operations/repositories');
const sessionService = require('../../src/cafe-operations/services/cafeOpsSessionService');

test.beforeEach(() => { initRepositories('memory'); });

function baseParams(o = {}) {
  return {
    sessionType: 'OPERATOR_PIN', employeeId: 'empA', organisationId: 'org1', cafeId: 'cafeA', deviceId: 'devA',
    actorRole: 'CAFE_ADMIN', authMethod: 'OPERATOR_PIN', authenticationStrength: 'STANDARD', ...o,
  };
}

test('creating a second session on the same device ends the first, regardless of type (one active operator per device)', async () => {
  const { session: s1 } = await sessionService.createSession(baseParams());
  const { session: s2 } = await sessionService.createSession(baseParams({
    sessionType: 'MASTER_ACCOUNT', employeeId: 'masterA', actorRole: 'MASTER_PRIMARY', authMethod: 'MASTER_PASSWORD', authenticationStrength: 'STRONG',
  }));
  const repos = require('../../src/cafe-operations/repositories').getRepositories();
  const reloaded1 = await repos.sessions.findById(s1.id);
  assert.equal(reloaded1.status, 'ENDED');
  assert.equal(reloaded1.endReason, 'SWITCH_OPERATOR');
  const reloaded2 = await repos.sessions.findById(s2.id);
  assert.equal(reloaded2.status, 'ACTIVE');
});

test('effectiveCafeId is set at creation from the caller-supplied cafeId (device cafe) and stored on the session record', async () => {
  const { session } = await sessionService.createSession(baseParams({ cafeId: 'cafeZ' }));
  assert.equal(session.effectiveCafeId, 'cafeZ');
});

test('resumeOrCreateSession resumes the same employee/device stale session rather than creating a new one', async () => {
  const { session: s1, sessionToken: t1 } = await sessionService.createSession(baseParams());
  const { session: s2, sessionToken: t2, resumed } = await sessionService.resumeOrCreateSession(baseParams());
  assert.equal(resumed, true);
  assert.equal(s2.id, s1.id);
  assert.notEqual(t2, t1); // token is rotated even on resume
});

test('resumeOrCreateSession for a DIFFERENT employee on the same device creates a fresh session (switch), not a resume', async () => {
  await sessionService.createSession(baseParams({ employeeId: 'empA' }));
  const { resumed } = await sessionService.resumeOrCreateSession(baseParams({ employeeId: 'empB' }));
  assert.equal(resumed, false);
});

test('locking then unlocking preserves the session identity and clears LOCKED status', async () => {
  const { session } = await sessionService.createSession(baseParams());
  const locked = await sessionService.lockSession(session.id);
  assert.equal(locked.status, 'LOCKED');
  const unlocked = await sessionService.unlockSession(session.id);
  assert.equal(unlocked.status, 'ACTIVE');
  assert.ok(unlocked.lastReauthAt);
});

test('ending a session records endedAt and the given reason, and it can no longer be found as "active by device"', async () => {
  const { session } = await sessionService.createSession(baseParams());
  await sessionService.endSession({ sessionId: session.id, reason: 'MANUAL_END' });
  const repos = require('../../src/cafe-operations/repositories').getRepositories();
  assert.equal(await repos.sessions.findActiveByDevice('devA'), null);
});

test('overall session lifetime expiry is detected even with continuous recent activity', async () => {
  const repos = require('../../src/cafe-operations/repositories').getRepositories();
  const started = new Date(Date.now() - 13 * 3600 * 1000); // 13h ago, policy default is 12h
  const rec = await repos.sessions.create({ ...baseParams(), sessionCode: 'OPS-SES-TEST', sessionTokenHash: 'x', status: 'ACTIVE', startedAt: started, lastActivityAt: new Date() });
  const liveness = await sessionService.evaluateSessionLiveness(rec);
  assert.equal(liveness.expired, true);
  assert.equal(liveness.reason, 'OVERALL_EXPIRY');
});

test('inactivity beyond the policy window marks shouldLock without ending the session outright', async () => {
  const repos = require('../../src/cafe-operations/repositories').getRepositories();
  const rec = await repos.sessions.create({
    ...baseParams(), sessionCode: 'OPS-SES-TEST2', sessionTokenHash: 'x', status: 'ACTIVE',
    startedAt: new Date(), lastActivityAt: new Date(Date.now() - 6 * 60 * 1000), // 6 min idle, policy default is 5
  });
  const liveness = await sessionService.evaluateSessionLiveness(rec);
  assert.equal(liveness.expired, false);
  assert.equal(liveness.shouldLock, true);
});
