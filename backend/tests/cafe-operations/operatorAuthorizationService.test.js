'use strict';
// Direct implementation of the login spec's Section 121 security matrix,
// against the pure decision function.
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateOperatorAccess } = require('../../src/cafe-operations/services/operatorAuthorizationService');
const { DEVICE_STATUS } = require('../../src/cafe-operations/utils/constants');

const device = (o = {}) => ({ id: 'dev1', cafeId: 'cafeA', organisationId: 'org1', lifecycleStatus: DEVICE_STATUS.ACTIVE, ...o });
const employee = (o = {}) => ({ id: 'emp1', isActive: true, ...o });
const access = (o = {}) => ({ employeeId: 'emp1', cafeId: 'cafeA', status: 'ACTIVE', validFrom: null, validUntil: null, ...o });

test('correct operator + ACTIVE trusted device + matching cafe => PASS', () => {
  assert.equal(evaluateOperatorAccess({ device: device(), employee: employee(), operatorAccess: access() }).granted, true);
});

test('Cafe A operator + Cafe B device => DENIED (CAFE_MISMATCH)', () => {
  const r = evaluateOperatorAccess({ device: device({ cafeId: 'cafeB' }), employee: employee(), operatorAccess: access({ cafeId: 'cafeA' }) });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'CAFE_MISMATCH');
});

test('STAFF (no Operator Access grant) + trusted cafe device => NO ELEVATION', () => {
  const r = evaluateOperatorAccess({ device: device(), employee: employee(), operatorAccess: null });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'ACCESS_MISSING');
});

test('inactive employee => DENIED', () => {
  const r = evaluateOperatorAccess({ device: device(), employee: employee({ isActive: false }), operatorAccess: access() });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'EMPLOYEE_INACTIVE');
});

test('expired temporary access => DENIED', () => {
  const r = evaluateOperatorAccess({ device: device(), employee: employee(), operatorAccess: access({ validUntil: new Date('2020-01-01') }), now: new Date('2026-08-22') });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'ACCESS_EXPIRED');
});

test('not-yet-valid temporary access => DENIED', () => {
  const r = evaluateOperatorAccess({ device: device(), employee: employee(), operatorAccess: access({ validFrom: new Date('2099-01-01') }), now: new Date('2026-08-22') });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'ACCESS_EXPIRED');
});

test('revoked Operator Access during active session (re-evaluated) => DENIED', () => {
  const r = evaluateOperatorAccess({ device: device(), employee: employee(), operatorAccess: access({ status: 'REVOKED' }) });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'ACCESS_REVOKED');
});

for (const status of ['REVOKED', 'LOST', 'RETIRED', 'REPLACED']) {
  test(`device ${status} => DENIED`, () => {
    const r = evaluateOperatorAccess({ device: device({ lifecycleStatus: status }), employee: employee(), operatorAccess: access() });
    assert.equal(r.granted, false);
    assert.equal(r.reason, 'DEVICE_NOT_ACTIVE');
  });
}

test('device not found => DENIED', () => {
  const r = evaluateOperatorAccess({ device: null, employee: employee(), operatorAccess: access() });
  assert.equal(r.granted, false);
  assert.equal(r.reason, 'DEVICE_NOT_FOUND');
});
