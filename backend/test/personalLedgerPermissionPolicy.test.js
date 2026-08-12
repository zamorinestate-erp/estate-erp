'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_PERMISSION_RULES,
} = require('../src/scripts/seedInitialData');

test(
  'Personal Ledger seed permissions are MASTER and OWNER only',
  () => {
    const rules = DEFAULT_PERMISSION_RULES.filter(
      (rule) =>
        rule.permissionCode === 'PERSONAL_LEDGER_READ' ||
        rule.permissionCode === 'PERSONAL_LEDGER_WRITE'
    );

    assert.equal(rules.length, 4);

    const keys = rules
      .map((rule) => `${rule.role}|${rule.permissionCode}`)
      .sort();

    assert.deepEqual(keys, [
      'MASTER|PERSONAL_LEDGER_READ',
      'MASTER|PERSONAL_LEDGER_WRITE',
      'OWNER|PERSONAL_LEDGER_READ',
      'OWNER|PERSONAL_LEDGER_WRITE',
    ]);

    for (const rule of rules) {
      assert.equal(rule.module, 'PERSONAL_LEDGER');
      assert.equal(rule.resource, 'PERSONAL_LEDGER_ENTRY');
      assert.equal(rule.effect, 'ALLOW');
      assert.equal(rule.scope, 'ORGANISATION');
      assert.equal(Boolean(rule.requiresMfa), true);

      if (rule.permissionCode === 'PERSONAL_LEDGER_READ') {
        assert.equal(rule.action, 'READ');
        assert.equal(Boolean(rule.requiresReason), false);
      } else {
        assert.equal(rule.action, 'WRITE');
        assert.equal(Boolean(rule.requiresReason), true);
      }
    }

    assert.equal(
      rules.some((rule) =>
        ['CAFE_ADMIN', 'STAFF'].includes(rule.role)
      ),
      false
    );
  }
);
