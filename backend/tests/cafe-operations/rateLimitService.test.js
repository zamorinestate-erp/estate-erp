'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rl = require('../../src/cafe-operations/services/rateLimitService');

test('locks after max failed attempts and clears on success', () => {
  rl._reset();
  const deviceId = 'devX';
  for (let i = 0; i < 4; i++) rl.recordFailure(deviceId, 'PIN');
  assert.equal(rl.isLocked(deviceId, 'PIN').locked, false);
  rl.recordFailure(deviceId, 'PIN'); // 5th failure
  assert.equal(rl.isLocked(deviceId, 'PIN').locked, true);
  rl.recordSuccess(deviceId, 'PIN');
  assert.equal(rl.isLocked(deviceId, 'PIN').locked, false);
});

test('PIN and MASTER scopes on the same device are independent', () => {
  rl._reset();
  const deviceId = 'devY';
  for (let i = 0; i < 5; i++) rl.recordFailure(deviceId, 'PIN');
  assert.equal(rl.isLocked(deviceId, 'PIN').locked, true);
  assert.equal(rl.isLocked(deviceId, 'MASTER').locked, false);
});
