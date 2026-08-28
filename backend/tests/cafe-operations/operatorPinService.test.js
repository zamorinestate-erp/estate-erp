'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pinService = require('../../src/cafe-operations/services/operatorPinService');

test('weak/blocklisted PINs rejected', () => {
  assert.equal(pinService.isWeakPin('123456'), true);
  assert.equal(pinService.isWeakPin('000000'), true);
  assert.equal(pinService.isWeakPin('654321'), true);
  assert.equal(pinService.isWeakPin('111111'), true);
  assert.equal(pinService.isWeakPin('234567'), true); // sequential ascending
  assert.equal(pinService.isWeakPin('765432'), true); // sequential descending
});

test('reasonable PIN accepted', () => {
  assert.equal(pinService.isWeakPin('307924'), false);
});

test('hash + verify roundtrip', async () => {
  const hash = await pinService.hashPin('482913');
  assert.equal(await pinService.verifyPin('482913', hash), true);
  assert.equal(await pinService.verifyPin('999999', hash), false);
});

test('verify against a null hash does not throw and returns false (timing-normalisation path)', async () => {
  assert.equal(await pinService.verifyPin('482913', null), false);
});

test('lookup hash is deterministic and PIN-specific (organisation-wide, no cafe component)', () => {
  const a = pinService.computeLookupHash('482913');
  const b = pinService.computeLookupHash('482913');
  const c = pinService.computeLookupHash('482914');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('generateRandomPin never produces a weak PIN', () => {
  for (let i = 0; i < 50; i++) assert.equal(pinService.isWeakPin(pinService.generateRandomPin()), false);
});
