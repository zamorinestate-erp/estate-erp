'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Customer seed permissions match the approved organisation-wide registry policy', () => {
  const filePath = fs.existsSync('src/scripts/seedInitialData.js') ? 'src/scripts/seedInitialData.js' : path.resolve(__dirname, '../src/scripts/seedInitialData.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const expected = [
    ['MASTER', 'CUSTOMERS_READ', 'READ', 'ORGANISATION'],
    ['MASTER', 'CUSTOMERS_WRITE', 'WRITE', 'ORGANISATION'],
    ['OWNER', 'CUSTOMERS_READ', 'READ', 'ORGANISATION'],
    ['CAFE_ADMIN', 'CUSTOMERS_READ', 'READ', 'RECORD'],
    ['CAFE_ADMIN', 'CUSTOMERS_WRITE', 'WRITE', 'RECORD'],
  ];

  for (const [role, permissionCode, action, scope] of expected) {
    const pattern = new RegExp(
      `\\{\\s*role:\\s*'${role}',\\s*permissionCode:\\s*'${permissionCode}',\\s*module:\\s*'CUSTOMERS',\\s*resource:\\s*'CUSTOMER',\\s*action:\\s*'${action}',\\s*effect:\\s*'ALLOW',\\s*scope:\\s*'${scope}'`
    );
    assert.match(
      source,
      pattern,
      `${role} ${permissionCode} must be seeded with the approved Customer policy`
    );
  }

  const customerPermissionCodes = [
    ...source.matchAll(/permissionCode:\s*'CUSTOMERS_(?:READ|WRITE)'/g),
  ];
  assert.equal(
    customerPermissionCodes.length,
    5,
    'exactly five Customer permission seed rules are required'
  );

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'STAFF',\s*permissionCode:\s*'CUSTOMERS_(?:READ|WRITE)'/,
    'STAFF must not receive Customer permissions'
  );

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'OWNER',\s*permissionCode:\s*'CUSTOMERS_WRITE'/,
    'OWNER must not receive CUSTOMERS_WRITE'
  );
});
