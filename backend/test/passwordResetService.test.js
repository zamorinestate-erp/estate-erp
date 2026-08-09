'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const service = require('../src/services/passwordResetService');

test('generateResetCode returns exactly six digits', () => {
  for (let i = 0; i < 100; i += 1) {
    assert.match(service.generateResetCode(), /[0-9]{6}$/);
  }
});

test('hashResetValue is deterministic and purpose-bound', () => {
  const first = service.hashResetValue('123456', 'A:CODE');
  const second = service.hashResetValue('123456', 'A:CODE');
  const differentPurpose = service.hashResetValue('123456', 'B:CODE');
  assert.equal(first, second);
  assert.notEqual(first, differentPurpose);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('ACTIVE account is eligible for password reset', () => {
  assert.equal(service.isResetEligibleUser({ accountStatus: 'ACTIVE', archivedAt: null }), true);
});

test('temporary timed lock is eligible but administrative lock is not', () => {
  const now = new Date('2026-08-09T10:00:00.000Z');
  assert.equal(service.isResetEligibleUser({ accountStatus: 'LOCKED', lockedUntil: new Date('2026-08-09T10:10:00.000Z'), archivedAt: null }, now), true);
  assert.equal(service.isResetEligibleUser({ accountStatus: 'LOCKED', lockedUntil: null, archivedAt: null }, now), false);
});

test('suspended disabled pending and archived accounts are not reset eligible', () => {
  for (const accountStatus of ['SUSPENDED', 'DISABLED', 'PENDING_ACTIVATION', 'ARCHIVED']) {
    assert.equal(service.isResetEligibleUser({ accountStatus, archivedAt: accountStatus === 'ARCHIVED' ? new Date() : null }), false);
  }
});

test('verifyPasswordResetToken accepts only matching unexpired verified token', () => {
  const challengeId = 'PRC-20260809-0001';
  const token = 'test-reset-token';
  const challenge = {
    challengeId,
    status: 'VERIFIED',
    resetTokenHash: service.hashResetValue(token, challengeId + ':TOKEN'),
    resetTokenExpiresAt: new Date(Date.now() + 60000),
  };
  assert.equal(service.verifyPasswordResetToken(challenge, token), true);
  assert.equal(service.verifyPasswordResetToken(challenge, 'wrong-token'), false);
  assert.equal(service.verifyPasswordResetToken({ ...challenge, status: 'CONSUMED' }, token), false);
  assert.equal(service.verifyPasswordResetToken({ ...challenge, resetTokenExpiresAt: new Date(Date.now() - 1000) }, token), false);
});
