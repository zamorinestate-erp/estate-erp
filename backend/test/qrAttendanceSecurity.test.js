'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const attendanceQrService = require('../src/services/attendanceQrService');

test('QR Attendance Cryptographic Security & Payload Verification', async (t) => {
  await t.test('signPayload generates deterministic HMAC-SHA256 signature', () => {
    const payload = {
      ver: 1,
      cid: 'CHL_TEST_01',
      did: 'DV_TEST_01',
      cafeId: 'ZC-0001',
      iat: 1786799800,
      exp: 1786799860,
      nonce: 'nonce123',
    };

    const sig1 = attendanceQrService.signPayload(payload);
    const sig2 = attendanceQrService.signPayload(payload);

    assert.equal(typeof sig1, 'string');
    assert.equal(sig1.length, 64);
    assert.equal(sig1, sig2);
  });

  await t.test('tampered challenge payload is detected and rejected', () => {
    const originalPayload = {
      ver: 1,
      cid: 'CHL_TEST_01',
      did: 'DV_TEST_01',
      cafeId: 'ZC-0001',
      iat: 1786799800,
      exp: 1786799860,
      nonce: 'nonce123',
    };

    const validSig = attendanceQrService.signPayload(originalPayload);

    // Tamper with cafeId
    const tamperedPayload = {
      ...originalPayload,
      cafeId: 'ZC-0002', // Tampered
    };

    const recalculatedSig = attendanceQrService.signPayload(tamperedPayload);
    assert.notEqual(validSig, recalculatedSig);
  });

  await t.test('tampered expiration is detected and rejected', () => {
    const originalPayload = {
      ver: 1,
      cid: 'CHL_TEST_01',
      did: 'DV_TEST_01',
      cafeId: 'ZC-0001',
      iat: 1786799800,
      exp: 1786799860,
      nonce: 'nonce123',
    };

    const validSig = attendanceQrService.signPayload(originalPayload);

    // Tamper with exp (extend lifetime)
    const tamperedPayload = {
      ...originalPayload,
      exp: 1786799999, // Tampered
    };

    const recalculatedSig = attendanceQrService.signPayload(tamperedPayload);
    assert.notEqual(validSig, recalculatedSig);
  });
});
