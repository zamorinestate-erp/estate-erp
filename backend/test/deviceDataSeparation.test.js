'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const deviceTrustService = require('../src/services/deviceTrustService');
const { requireCafeOperationsDevice, requireSelfProfile } = require('../src/middleware/deviceAuthorization');

test('Device Data Separation & Privilege Profile Derivation', async (t) => {
  await t.test('MASTER gets ORGANISATION_GOVERNANCE regardless of device', () => {
    const profile = deviceTrustService.derivePrivilegeProfile('MASTER', null);
    assert.equal(profile.privilegeProfile, 'ORGANISATION_GOVERNANCE');
    assert.equal(profile.isCafeOperationsAllowed, true);
    assert.deepEqual(profile.allowedCafeScope, ['*']);
  });

  await t.test('OWNER gets STRATEGIC_EXECUTIVE_READ regardless of device', () => {
    const profile = deviceTrustService.derivePrivilegeProfile('OWNER', null);
    assert.equal(profile.privilegeProfile, 'STRATEGIC_EXECUTIVE_READ');
    assert.equal(profile.isCafeOperationsAllowed, false);
    assert.deepEqual(profile.allowedCafeScope, ['*']);
  });

  await t.test('STAFF is clamped to SELF_ONLY regardless of device', () => {
    const profile = deviceTrustService.derivePrivilegeProfile('STAFF', {
      deviceClass: 'CAFE_OWNED',
      status: 'ACTIVE',
      assignedCafeId: 'ZC-0001',
    });
    assert.equal(profile.privilegeProfile, 'SELF_ONLY');
    assert.equal(profile.isCafeOperationsAllowed, false);
  });

  await t.test('CAFE_ADMIN on PERSONAL device is clamped to SELF_ONLY', () => {
    const personalDevice = {
      deviceClass: 'PERSONAL',
      status: 'ACTIVE',
      assignedCafeId: null,
    };
    const profile = deviceTrustService.derivePrivilegeProfile('CAFE_ADMIN', personalDevice);
    assert.equal(profile.privilegeProfile, 'SELF_ONLY');
    assert.equal(profile.isCafeOperationsAllowed, false);
    assert.deepEqual(profile.allowedCafeScope, []);
  });

  await t.test('CAFE_ADMIN without registered device is clamped to SELF_ONLY', () => {
    const profile = deviceTrustService.derivePrivilegeProfile('CAFE_ADMIN', null);
    assert.equal(profile.privilegeProfile, 'SELF_ONLY');
    assert.equal(profile.isCafeOperationsAllowed, false);
  });

  await t.test('CAFE_ADMIN on ACTIVE CAFE_OWNED device gets CAFE_OPERATIONS for bound cafe', () => {
    const cafeDevice = {
      deviceClass: 'CAFE_OWNED',
      status: 'ACTIVE',
      assignedCafeId: 'ZC-0001',
    };
    const profile = deviceTrustService.derivePrivilegeProfile('CAFE_ADMIN', cafeDevice);
    assert.equal(profile.privilegeProfile, 'CAFE_OPERATIONS');
    assert.equal(profile.isCafeOperationsAllowed, true);
    assert.deepEqual(profile.allowedCafeScope, ['ZC-0001']);
    assert.equal(profile.boundCafeId, 'ZC-0001');
  });

  await t.test('CAFE_ADMIN on REVOKED CAFE_OWNED device is clamped to SELF_ONLY', () => {
    const revokedDevice = {
      deviceClass: 'CAFE_OWNED',
      status: 'REVOKED',
      assignedCafeId: 'ZC-0001',
    };
    const profile = deviceTrustService.derivePrivilegeProfile('CAFE_ADMIN', revokedDevice);
    assert.equal(profile.privilegeProfile, 'SELF_ONLY');
    assert.equal(profile.isCafeOperationsAllowed, false);
  });
});

test('Device Authorization Middleware Guards', async (t) => {
  await t.test('requireCafeOperationsDevice blocks CAFE_ADMIN on personal device', () => {
    const req = {
      auth: {
        role: 'CAFE_ADMIN',
        privilegeProfile: 'SELF_ONLY',
        deviceContext: { deviceClass: 'PERSONAL' },
      },
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) {
        statusSent = s;
        return {
          json(j) {
            jsonSent = j;
          },
        };
      },
    };
    let nextCalled = false;

    requireCafeOperationsDevice(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusSent, 403);
    assert.equal(jsonSent.error, 'DEVICE_SCOPE_DENIED');
  });

  await t.test('requireCafeOperationsDevice allows CAFE_ADMIN on active bound cafe device', () => {
    const req = {
      auth: {
        role: 'CAFE_ADMIN',
        privilegeProfile: 'CAFE_OPERATIONS',
        deviceContext: { deviceClass: 'CAFE_OWNED', boundCafeId: 'ZC-0001' },
      },
      params: { cafeId: 'ZC-0001' },
    };
    const res = {};
    let nextCalled = false;

    requireCafeOperationsDevice(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  await t.test('requireCafeOperationsDevice blocks cross-cafe access on cafe device', () => {
    const req = {
      auth: {
        role: 'CAFE_ADMIN',
        privilegeProfile: 'CAFE_OPERATIONS',
        deviceContext: { deviceClass: 'CAFE_OWNED', boundCafeId: 'ZC-0001' },
      },
      params: { cafeId: 'ZC-0002' },
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(s) {
        statusSent = s;
        return {
          json(j) {
            jsonSent = j;
          },
        };
      },
    };
    let nextCalled = false;

    requireCafeOperationsDevice(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(statusSent, 403);
    assert.equal(jsonSent.error, 'CROSS_CAFE_DEVICE_SCOPE_DENIED');
  });
});
