'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = require('node:path');

test('Procurement seed permissions match the approved role and scope policy', () => {
  const filePath = fs.existsSync('src/scripts/seedInitialData.js') ? 'src/scripts/seedInitialData.js' : path.resolve(__dirname, '../src/scripts/seedInitialData.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const expected = [
    ['MASTER', 'PROCUREMENT_READ', 'READ', 'ORGANISATION'],
    ['MASTER', 'PROCUREMENT_WRITE', 'WRITE', 'ORGANISATION'],
    ['MASTER', 'PROCUREMENT_APPROVE', 'APPROVE', 'ORGANISATION'],
    ['MASTER', 'PROCUREMENT_RECEIVE', 'RECEIVE', 'ORGANISATION'],
    ['OWNER', 'PROCUREMENT_READ', 'READ', 'ORGANISATION'],
    ['OWNER', 'PROCUREMENT_WRITE', 'WRITE', 'ORGANISATION'],
    ['OWNER', 'PROCUREMENT_APPROVE', 'APPROVE', 'ORGANISATION'],
    ['CAFE_ADMIN', 'PROCUREMENT_READ', 'READ', 'RECORD'],
    ['CAFE_ADMIN', 'PROCUREMENT_WRITE', 'WRITE', 'RECORD'],
    ['CAFE_ADMIN', 'PROCUREMENT_APPROVE', 'APPROVE', 'RECORD'],
    ['CAFE_ADMIN', 'PROCUREMENT_RECEIVE', 'RECEIVE', 'RECORD'],
  ];

  for (const [role, permissionCode, action, scope] of expected) {
    const pattern = new RegExp(
      `\\\{\\s*role:\\s*'${role}',\\s*permissionCode:\\s*'${permissionCode}',\\s+module:\\s*'PROCUREMENT',\\s*resource:\\s*'PURCHASE_ORDER',\\s+action:\\s*'${action}',\\s+effect:\\s*'ALLOW',\\s*scope:\\s*'${scope}'`
    );

    assert.match(
      source,
      pattern,
      `${role} ${permissionCode} must be seeded with the approved Procurement policy`
    );
  }

  const codes = [
    ...source.matchAll(/permissionCode:\s*'PROCUREMENT_(?:READ|WRITE|APPROVE|RECEIVE)'/g),
  ];

  assert.equal(codes.length, 11, 'exactly eleven Procurement permission seed rules are required');

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'STAFF',\s*permissionCode:\s*'PROCUREMENT_(?:READ|WRITE|APPROVE|RECEIVE)'/,
    'STAFF must not receive Procurement permissions'
  );
});
