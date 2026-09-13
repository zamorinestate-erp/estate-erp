'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const asvsMatrix = require('../src/config/asvsMatrix.json');
const { Bill } = require('../src/models/Bill');
const { sanitizeForLogging } = require('../src/services/securityLogger');
const { validateEnvironment } = require('../../scripts/validate_environment.mjs');

test('OWASP ASVS 5.0 Automated Compliance Suite', async (t) => {
  await t.test('1. ASVS Matrix Schema & Integrity', () => {
    assert.equal(asvsMatrix.standard, 'OWASP ASVS 5.0');
    assert.equal(asvsMatrix.verifiedControlsCount, 24);
    assert.equal(asvsMatrix.controls.length, 24);

    for (const ctrl of asvsMatrix.controls) {
      assert.ok(ctrl.id, 'Control must have an ID');
      assert.ok(ctrl.chapter, 'Control must have a chapter');
      assert.ok(ctrl.requirement, 'Control must have a requirement description');
      assert.ok(ctrl.enforcingCode, 'Control must map to enforcing code path');
      assert.equal(ctrl.status, 'VERIFIED_IN_CODE');
    }
  });

  await t.test('2. ASVS V8.1 Data Protection — Zero Raw Cardholder Data Storage', () => {
    const schemaPaths = Object.keys(Bill.schema.paths);
    const forbiddenFields = ['cardNumber', 'pan', 'cvv', 'cvc', 'trackData', 'cardholderPin'];

    for (const field of forbiddenFields) {
      assert.ok(
        !schemaPaths.includes(field),
        `Bill schema must not contain forbidden cardholder field: ${field}`
      );
    }

    const tenderMethods = Bill.schema.paths.paymentMethod?.options?.enum || [];
    assert.ok(tenderMethods.length > 0, 'Payment methods must be enumerated');
  });

  await t.test('3. ASVS V7.1 Logging Sanitisation — Deep Credential Redaction', () => {
    const sensitiveInput = {
      user: 'Cashier-1',
      password: 'PlainPassword99!',
      authorization: 'Bearer token123',
      sessionCookie: 'sid=abc',
      cvv: '999',
    };
    const sanitized = sanitizeForLogging(sensitiveInput);
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.authorization, '[REDACTED]');
    assert.equal(sanitized.sessionCookie, '[REDACTED]');
    assert.equal(sanitized.cvv, '[REDACTED]');
    assert.equal(sanitized.user, 'Cashier-1');
  });

  await t.test('4. ASVS V14.3 Configuration Validation — Safe Startup Check', () => {
    const envCheck = validateEnvironment({
      NODE_ENV: 'test',
      PORT: '4000',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
      JWT_ACCESS_SECRET: 'secure-test-jwt-secret-at-least-32-chars-long!',
    });

    assert.equal(envCheck.valid, true);
    assert.ok(envCheck.totalChecked >= 8);
  });

  await t.test('5. ASVS Enforcing Files Exist in Codebase', () => {
    const rootDir = path.resolve(__dirname, '../..');
    for (const ctrl of asvsMatrix.controls) {
      const fullPath = path.join(rootDir, ctrl.enforcingCode);
      assert.ok(
        fs.existsSync(fullPath),
        `Enforcing file for ${ctrl.id} must exist: ${ctrl.enforcingCode}`
      );
    }
  });
});
