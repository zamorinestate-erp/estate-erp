'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test('Menu seed permissions match the approved role and scope policy', () => {
  const rules = DEFAULT_PERMISSION_RULES.filter(
    (rule) =>
      rule.permissionCode === 'MENU_READ' ||
      rule.permissionCode === 'MENU_WRITE'
  );

  const keys = rules
    .map((rule) => `${rule.role}|${rule.permissionCode}|${rule.scope}`)
    .sort();

  assert.deepEqual(keys, [
    'CAFE_ADMIN|MENU_READ|ASSIGNED_CAFES',
    'CAFE_ADMIN|MENU_WRITE|ASSIGNED_CAFES',
    'MASTER|MENU_READ|ORGANISATION',
    'MASTER|MENU_WRITE|ORGANISATION',
    'OWNER|MENU_READ|ORGANISATION',
  ]);

  for (const rule of rules) {
    assert.equal(rule.module, 'MENU');
    assert.equal(rule.resource, 'MENU_ITEM');
    assert.equal(rule.effect, 'ALLOW');

    if (rule.permissionCode === 'MENU_READ') {
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
        rule.role !== 'MASTER' &&
        rule.role !== 'CAFE_ADMIN' &&
        rule.permissionCode === 'MENU_WRITE'
    ),
    false
  );
});
