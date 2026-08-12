'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test('Inventory seed permissions match the approved role and scope policy', () => {
  const rules = DEFAULT_PERMISSION_RULES.filter(
    (rule) =>
      rule.permissionCode === 'INVENTORY_READ' ||
      rule.permissionCode === 'INVENTORY_WRITE'
  );

  const keys = rules
    .map((rule) => `${rule.role}|${rule.permissionCode}|${rule.scope}`)
    .sort();

  assert.deepEqual(keys, [
    'CAFE_ADMIN|INVENTORY_READ|RECORD',
    'CAFE_ADMIN|INVENTORY_WRITE|ASSIGNED_CAFES',
    'MASTER|INVENTORY_READ|ORGANISATION',
    'MASTER|INVENTORY_WRITE|ORGANISATION',
    'OWNER|INVENTORY_READ|ORGANISATION',
  ]);

  for (const rule of rules) {
    assert.equal(rule.module, 'INVENTORY');
    assert.equal(rule.resource, 'INVENTORY');
    assert.equal(rule.effect, 'ALLOW');

    if (rule.permissionCode === 'INVENTORY_READ') {
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
        rule.role === 'OWNER' &&
        rule.permissionCode === 'INVENTORY_WRITE'
    ),
    false
  );
});
