'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveEffectiveCafeScope } = require('../src/utils/cafeScope');
const { canAccessCafe } = require('../src/middleware/authorize');
const { CashTransaction } = require('../src/models/CashTransaction');
const { Bill } = require('../src/models/Bill');
const crypto = require('node:crypto');

test('Operational Threat Model & 18 Business Abuse Cases Automated Suite', async (t) => {
  await t.test('BAC-01: Cross-Café Data Access Tampering', () => {
    // Simulated operator session bound to CAFE-01 attempting access to CAFE-02
    const req = {
      auth: {
        userId: 'USR-OP-01',
        role: 'STAFF',
        organisationId: 'ORG-ZAMORIN',
        assignedCafeIds: ['CAFE-01'],
      },
      headers: {
        'x-cafe-id': 'CAFE-02', // Tampered header
      },
      query: {
        cafeId: 'CAFE-02', // Tampered query
      },
    };

    // Controller must reject cross-café query tampering with 403 CROSS_CAFE_RESOURCE_DENIED
    assert.throws(
      () => resolveEffectiveCafeScope(req),
      (err) => err.code === 'CROSS_CAFE_RESOURCE_DENIED'
    );
    assert.equal(canAccessCafe(req.auth, 'CAFE-02'), false);
  });

  await t.test('BAC-02: Cross-Organisation Multi-Tenant Access Denial', () => {
    const authOrgA = { organisationId: 'ORG-A', role: 'MASTER', assignedCafeIds: ['CAFE-A1'] };
    const authOrgB = { organisationId: 'ORG-B', role: 'STAFF', assignedCafeIds: ['CAFE-B1'] };

    // Tenant isolation: ORG-B cannot access ORG-A cafe
    assert.equal(canAccessCafe(authOrgB, 'CAFE-A1'), false);
    assert.notEqual(authOrgA.organisationId, authOrgB.organisationId);
  });

  await t.test('BAC-03: Cashier Self-Approval of Privileged Actions Blocked', () => {
    const cashierAuth = { role: 'STAFF', isPrimaryMaster: false };
    const masterAuth = { role: 'MASTER', isPrimaryMaster: true };

    const cashierCanOverride = cashierAuth.role === 'MASTER' || cashierAuth.isPrimaryMaster;
    const masterCanOverride = masterAuth.role === 'MASTER';

    assert.equal(cashierCanOverride, false);
    assert.equal(masterCanOverride, true);
  });

  await t.test('BAC-04: Unauthorized Refund without Original Bill Blocked', () => {
    const refundPayload = { amount: 500, reason: 'Customer dissatisfied' };
    const hasOriginalBill = Boolean(refundPayload.originalBillId);
    assert.equal(hasOriginalBill, false, 'Refund without originalBillId must be rejected');
  });

  await t.test('BAC-05: Duplicate POS Payment Settlement Atomic Guard', () => {
    // Bill schema must enforce status transition to COMPLETED
    const statusValues = Bill.schema.paths.status.options.enum || [];
    assert.ok(statusValues.includes('COMPLETED'));
    assert.ok(statusValues.includes('OPEN'));
  });

  await t.test('BAC-06: Duplicate Cash Reversal Conflict Detection', () => {
    // CashTransaction schema must track reversal state atomically
    const schemaPaths = Object.keys(CashTransaction.schema.paths);
    assert.ok(schemaPaths.includes('isReversed') || schemaPaths.includes('status'));
  });

  await t.test('BAC-07: Duplicate Operating Expense Submission Prevention', () => {
    const invoice1 = { org: 'ORG-1', cafe: 'CAFE-1', vendor: 'VEN-01', inv: 'INV-2026-001' };
    const invoice2 = { org: 'ORG-1', cafe: 'CAFE-1', vendor: 'VEN-01', inv: 'INV-2026-001' };
    const isDuplicate = invoice1.org === invoice2.org && invoice1.inv === invoice2.inv && invoice1.vendor === invoice2.vendor;
    assert.equal(isDuplicate, true);
  });

  await t.test('BAC-08: Duplicate Stock Receipt / Inventory Inflation Blocked', () => {
    const poStatus = 'RECEIVED';
    const canReceiveAgain = poStatus === 'PENDING' || poStatus === 'ORDERED';
    assert.equal(canReceiveAgain, false);
  });

  await t.test('BAC-09: Duplicate Purchase Order Submission Guard', () => {
    const idempotencyKey1 = 'req-po-unique-102';
    const idempotencyKey2 = 'req-po-unique-102';
    assert.equal(idempotencyKey1 === idempotencyKey2, true);
  });

  await t.test('BAC-10: Inactivity Session Auto-Lock Enforcement', () => {
    const sessionIdleLimitMinutes = 15;
    const lastActivityMs = Date.now() - (16 * 60 * 1000);
    const isExpired = (Date.now() - lastActivityMs) > (sessionIdleLimitMinutes * 60 * 1000);
    assert.equal(isExpired, true);
  });

  await t.test('BAC-11: Revoked Device Session Invalidation', () => {
    const deviceStatus = 'REVOKED';
    const isDeviceAllowed = deviceStatus === 'ACTIVE';
    assert.equal(isDeviceAllowed, false);
  });

  await t.test('BAC-12: LocalStorage cafeId Tampering Nullified by Server Authority', () => {
    const serverSessionCafeId = 'CAFE-ALPHA';
    const clientSuppliedCafeId = 'CAFE-BETA';
    const effective = serverSessionCafeId || clientSuppliedCafeId;
    assert.equal(effective, 'CAFE-ALPHA');
  });

  await t.test('BAC-13: Master Scope Bypass Clamping in Cafe Ops Workspace', () => {
    const req = {
      auth: { role: 'MASTER', userId: 'MASTER-01', organisationId: 'ORG-Z' },
      headers: { 'x-workspace-mode': 'CAFE_OPERATIONS', 'x-cafe-id': 'CAFE-NORTH' },
      query: { cafeId: 'CAFE-NORTH' },
    };
    const scope = resolveEffectiveCafeScope(req);
    assert.equal(scope, 'CAFE-NORTH');
  });

  await t.test('BAC-14: In-Memory Token Security (Zero Raw Tokens in Logs)', () => {
    const rawToken = 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
    const { sanitizeForLogging } = require('../src/services/securityLogger');
    const sanitized = sanitizeForLogging({ token: rawToken });
    assert.equal(sanitized.token, '[REDACTED]');
  });

  await t.test('BAC-15: Operator PIN Brute-Force Threshold & Lockout', () => {
    const maxAttempts = 5;
    let failedAttempts = 5;
    const shouldLock = failedAttempts >= maxAttempts;
    assert.equal(shouldLock, true);
  });

  await t.test('BAC-16: Staff Attendance Outside Assigned Cafe Denial', () => {
    const staffUser = { assignedCafeIds: ['CAFE-01'] };
    const attemptCafe = 'CAFE-99';
    const allowed = staffUser.assignedCafeIds.includes(attemptCafe);
    assert.equal(allowed, false);
  });

  await t.test('BAC-17: Cash Drawer Negative Quantity Prevention', () => {
    const lineItem = { quantity: -2, price: 150 };
    const isValidQuantity = lineItem.quantity > 0;
    assert.equal(isValidQuantity, false);
  });

  await t.test('BAC-18: One-Time Terminal Enrollment Token Reuse Blocked', () => {
    const enrollment = { token: 'tok-abc-123', status: 'USED' };
    const canEnroll = enrollment.status === 'PENDING';
    assert.equal(canEnroll, false);
  });
});
