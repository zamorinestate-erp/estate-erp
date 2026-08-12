'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test(
  'POS seed permissions match the approved role and scope policy',
  () => {
    const rules = DEFAULT_PERMISSION_RULES.filter(
      (rule) =>
        rule.permissionCode === 'POS_READ' ||
        rule.permissionCode === 'POS_WRITE' ||
        rule.permissionCode === 'POS_VOID'
    );

    const keys = rules
      .map((rule) => `${rule.role}|${rule.permissionCode}|${rule.scope}`)
      .sort();

    assert.deepEqual(keys, [
      'CAFE_ADMIN|POS_READ|RECORD',
      'CAFE_ADMIN|POS_WRITE|ASSIGNED_CAFES',
      'MASTER|POS_READ|ORGANISATION',
      'MASTER|POS_VOID|ORGANISATION',
      'MASTER|POS_WRITE|ORGANISATION',
      'OWNER|POS_READ|ORGANISATION',
      'OWNER|POS_VOID|ORGANISATION',
    ]);

    for (const rule of rules) {
      assert.equal(rule.module, 'POS_BILLING');
      assert.equal(rule.resource, 'BILL');
      assert.equal(rule.effect, 'ALLOW');

      if (rule.permissionCode === 'POS_READ') {
        assert.equal(rule.action, 'READ');
      } else if (rule.permissionCode === 'POS_WRITE') {
        assert.equal(rule.action, 'WRITE');
      } else {
        assert.equal(rule.action, 'VOID');
        assert.equal(Boolean(rule.requiresReason), true);
      }
    }

    assert.equal(
      rules.some((rule) => rule.role === 'STAFF'),
      false
    );
  }
);
