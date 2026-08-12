'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test('Vendor seed permissions match the approved role and scope policy', () => {
  const rules = DEFAULT_PERMISSION_RULES.filter(
    (rule) =>
      rule.permissionCode === 'VENDORS_READ' ||
      rule.permissionCode === 'VENDORS_WRITE'
  );

  const keys = rules
    .map((rule) => `${rule.role}|${rule.permissionCode}|${rule.scope}`)
    .sort();

  assert.deepEqual(keys, [
    'CAFE_ADMIN|VENDORS_READ|RECORD',
    'MASTER|VENDORS_READ|ORGANISATION',
    'MASTER|VENDORS_WRITE|ORGANISATION',
    'OWNER|VENDORS_READ|ORGANISATION',
  ]);

  for (const rule of rules) {
    assert.equal(rule.module, 'VENDORS');
    assert.equal(rule.resource, 'VENDOR');
    assert.equal(rule.effect, 'ALLOW');

    if (rule.permissionCode === 'VENDORS_READ') {
      assert.equal(rule.action, 'READ');
    } else {
      assert.equal(rule.action, 'WRITE');
      assert.equal(Boolean(rule.requiresAuditEvent), true);
    }
  }

  assert.equal(
    rules.some((rule) => rule.role === 'STAFF'),
    false
  );

  assert.equal(
    rules.some(
      (rule) =>
        rule.role === 'CAFE_ADMIN' &&
        rule.permissionCode === 'VENDORS_WRITE'
    ),
    false
  );
});
