'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test('Approval seed permissions match the approved role and scope policy', () => {
  const rules = DEFAULT_PERMISSION_RULES.filter(
    (rule) =>
      rule.permissionCode === 'APPROVALS_READ' ||
      rule.permissionCode === 'APPROVALS_DECIDE'
  );

  const keys = rules
    .map((rule) => `${rule.role}|${rule.permissionCode}|${rule.scope}`)
    .sort();

  assert.deepEqual(keys, [
    'CAFE_ADMIN|APPROVALS_DECIDE|RECORD',
    'CAFE_ADMIN|APPROVALS_READ|RECORD',
    'MASTER|APPROVALS_DECIDE|ORGANISATION',
    'MASTER|APPROVALS_READ|ORGANISATION',
    'OWNER|APPROVALS_DECIDE|ORGANISATION',
    'OWNER|APPROVALS_READ|ORGANISATION',
  ]);

  for (const rule of rules) {
    assert.equal(rule.module, 'APPROVALS');
    assert.equal(rule.resource, 'APPROVAL');
    assert.equal(rule.effect, 'ALLOW');

    if (rule.permissionCode === 'APPROVALS_READ') {
      assert.equal(rule.action, 'READ');
    } else {
      assert.equal(rule.action, 'DECIDE');
      assert.equal(Boolean(rule.requiresAuditEvent), true);
    }
  }

  assert.equal(
    rules.some((rule) => rule.role === 'STAFF'),
    false
  );
});
