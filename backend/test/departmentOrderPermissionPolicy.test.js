'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Department Order seed permissions match the approved role and scope policy', () => {
  const filePath = fs.existsSync('src/scripts/seedInitialData.js') ? 'src/scripts/seedInitialData.js' : path.resolve(__dirname, '../src/scripts/seedInitialData.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const expected = [
    ['MASTER', 'DEPARTMENT_ORDERS_READ', 'READ', 'ORGANISATION'],
    ['MASTER', 'DEPARTMENT_ORDERS_WRITE', 'WRITE', 'ORGANISATION'],
    ['OWNER', 'DEPARTMENT_ORDERS_READ', 'READ', 'ORGANISATION'],
    ['CAFE_ADMIN', 'DEPARTMENT_ORDERS_READ', 'READ', 'RECORD'],
    ['CAFE_ADMIN', 'DEPARTMENT_ORDERS_WRITE', 'WRITE', 'RECORD'],
  ];

  for (const [role, permissionCode, action, scope] of expected) {
    const pattern = new RegExp(
      `\\{\\s*role:\\s*'${role}',\\s*permissionCode:\\s*'${permissionCode}',\\s*module:\\s*'DEPARTMENT_ORDERS',\\s*resource:\\s*'DEPARTMENT_ORDER',\\s*action:\\s*'${action}',\\s*effect:\\s*'ALLOW',\\s*scope:\\s*'${scope}'`
    );
    assert.match(
      source,
      pattern,
      `${role} ${permissionCode} must be seeded with the approved Department Order policy`
    );
  }

  const codes = [
    ...source.matchAll(/permissionCode:\s*'DEPARTMENT_ORDERS_(?:READ|WRITE)'/g),
  ];
  assert.equal(codes.length, 5, 'exactly five Department Order permission seed rules are required');

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'STAFF',\s*permissionCode:\s*'DEPARTMENT_ORDERS_(?:READ|WRITE)'/,
    'STAFF must not receive Department Order permissions'
  );

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'OWNER',\s*permissionCode:\s*'DEPARTMENT_ORDERS_WRITE'/,
    'OWNER must not receive DEPARTMENT_ORDERS_WRITE'
  );
});
