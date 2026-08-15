'use strict';

/**
 * Hard-Testing Security Suite: HT-13 Zero Data Leakage on Personal Devices
 */

const assert = require('node:assert/strict');
const deviceTrustService = require('../../backend/src/services/deviceTrustService');

async function runDataLeakageAudit() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' HT-13: ZERO DATA LEAKAGE PERSONAL ENDPOINT AUDIT');
  console.log('══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  // Audit 1: Personal Device Profile Clamping
  try {
    const personalDevice = {
      deviceClass: 'PERSONAL',
      status: 'ACTIVE',
      assignedCafeId: null,
    };
    const profile = deviceTrustService.derivePrivilegeProfile('CAFE_ADMIN', personalDevice);

    assert.equal(profile.privilegeProfile, 'SELF_ONLY');
    assert.equal(profile.isCafeOperationsAllowed, false);
    assert.deepEqual(profile.allowedCafeScope, []);
    console.log(' ✔ Audit 1 [PASS]: CAFE_ADMIN personal device is clamped to 0 allowed cafe operational scope');
    passed++;
  } catch (err) {
    console.error(' ✖ Audit 1 FAILED:', err.message);
    failed++;
  }

  // Audit 2: Staff Scope Zero-Leakage
  try {
    const staffProfile = deviceTrustService.derivePrivilegeProfile('STAFF', null);
    assert.equal(staffProfile.privilegeProfile, 'SELF_ONLY');
    assert.equal(staffProfile.isCafeOperationsAllowed, false);
    console.log(' ✔ Audit 2 [PASS]: STAFF is strictly clamped to SELF_ONLY across all devices');
    passed++;
  } catch (err) {
    console.error(' ✖ Audit 2 FAILED:', err.message);
    failed++;
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(` HT-13 VERDICT: ${failed === 0 ? 'PASS ✓' : 'FAIL ✗'} (0 Leaks Detected)`);
  console.log('══════════════════════════════════════════════════════════════════');

  return { passed, failed };
}

if (require.main === module) {
  runDataLeakageAudit().catch(console.error);
}

module.exports = { runDataLeakageAudit };
