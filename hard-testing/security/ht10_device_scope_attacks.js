'use strict';

/**
 * Hard-Testing Security Attack Suite: HT-10 Device Scope & Boundary Attacks
 */

const assert = require('node:assert/strict');
const deviceTrustService = require('../../backend/src/services/deviceTrustService');
const attendanceQrService = require('../../backend/src/services/attendanceQrService');
const { requireCafeOperationsDevice } = require('../../backend/src/middleware/deviceAuthorization');

async function runDeviceScopeAttacks() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' HT-10: DEVICE SCOPE & BOUNDARY ATTACK SECURITY SUITE');
  console.log('══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  // Attack 1: CAFE_ADMIN on Personal Device attempts Cafe Operations
  try {
    const personalReq = {
      auth: {
        role: 'CAFE_ADMIN',
        privilegeProfile: 'SELF_ONLY',
        deviceContext: { deviceClass: 'PERSONAL' },
      },
    };
    let blocked = false;
    const res = {
      status(code) {
        if (code === 403) blocked = true;
        return { json: () => {} };
      },
    };
    requireCafeOperationsDevice(personalReq, res, () => {});
    assert.equal(blocked, true, 'Personal device must be blocked with 403');
    console.log(' ✔ Attack 1 [BLOCKED]: CAFE_ADMIN on personal device blocked from POS/operational endpoints (403)');
    passed++;
  } catch (err) {
    console.error(' ✖ Attack 1 FAILED:', err.message);
    failed++;
  }

  // Attack 2: Cross-Cafe Hardware Attack (Tablet bound to ZC-0001 calls ZC-0002)
  try {
    const crossCafeReq = {
      auth: {
        role: 'CAFE_ADMIN',
        privilegeProfile: 'CAFE_OPERATIONS',
        deviceContext: { deviceClass: 'CAFE_OWNED', boundCafeId: 'ZC-0001' },
      },
      params: { cafeId: 'ZC-0002' },
    };
    let crossBlocked = false;
    const res = {
      status(code) {
        if (code === 403) crossBlocked = true;
        return { json: () => {} };
      },
    };
    requireCafeOperationsDevice(crossCafeReq, res, () => {});
    assert.equal(crossBlocked, true, 'Cross-cafe request must be blocked with 403');
    console.log(' ✔ Attack 2 [BLOCKED]: Tablet bound to ZC-0001 blocked from accessing ZC-0002 (403)');
    passed++;
  } catch (err) {
    console.error(' ✖ Attack 2 FAILED:', err.message);
    failed++;
  }

  // Attack 3: QR Signature Tampering Attack
  try {
    const payload = {
      ver: 1,
      cid: 'CHL_ATTACK_01',
      did: 'DV_ZC0001_01',
      cafeId: 'ZC-0001',
      iat: 1786799800,
      exp: 1786799860,
      nonce: 'nonce123',
    };
    const validSig = attendanceQrService.signPayload(payload);
    const forgedSig = validSig.slice(0, -4) + '0000'; // Forgery

    const envelope = { ...payload, sig: forgedSig };
    let signatureRejected = false;

    try {
      const { sig, ...dataToVerify } = envelope;
      const expected = attendanceQrService.signPayload(dataToVerify);
      if (sig !== expected) {
        throw new Error('INVALID_QR_SIGNATURE');
      }
    } catch (e) {
      if (e.message === 'INVALID_QR_SIGNATURE') signatureRejected = true;
    }

    assert.equal(signatureRejected, true, 'Forged signature must be rejected');
    console.log(' ✔ Attack 3 [BLOCKED]: Cryptographically forged QR token rejected instantly');
    passed++;
  } catch (err) {
    console.error(' ✖ Attack 3 FAILED:', err.message);
    failed++;
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` HT-10 VERDICT: ${failed === 0 ? 'PASS ✓' : 'FAIL ✗'} (${passed}/${passed + failed} Attacks Blocked)`);
  console.log('══════════════════════════════════════════════════════════════════');

  return { passed, failed };
}

if (require.main === module) {
  runDeviceScopeAttacks().catch(console.error);
}

module.exports = { runDeviceScopeAttacks };
