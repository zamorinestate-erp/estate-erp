'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Asset seed permissions match the approved role and scope policy', () => {
  const filePath = fs.existsSync('src/scripts/seedInitialData.js') ? 'src/scripts/seedInitialData.js' : path.resolve(__dirname, '../src/scripts/seedInitialData.js');
  const source = fs.readFileSync(filePath, 'utf8');

  const expected = [
    ['MASTER', 'ASSETS_READ', 'READ', 'ORGANISATION'],
    ['MASTER', 'ASSETS_WRITE', 'WRITE', 'ORGANISATION'],
    ['OWNER', 'ASSETS_READ', 'READ', 'ORGANISATION'],
    ['CAFE_ADMIN', 'ASSETS_READ', 'READ', 'RECORD'],
    ['CAFE_ADMIN', 'ASSETS_WRITE', 'WRITE', 'ASSIGNED_CAFES'],
  ];

  for (const [role, permissionCode, action, scope] of expected) {
    const pattern = new RegExp(
      `role:\\s*'${role}'[\\s\\S]{0,500}?permissionCode:\\s*'${permissionCode}'[\\s\\S]{0,900}?module:\\s*'ASSETS'[\\s\\S]{0,300}?resource:\\s*'ASSET'[\\s\\S]{0,300}?action:\\s*'${action}'[\\s\\S]{0,300}?effect:\\s*'ALLOW'[\\s\\S]{0,300}?scope:\\s*'${scope}'`
    );
    assert.match(
      source,
      pattern,
      `${role} ${permissionCode} must be seeded with the approved Asset policy`
    );
  }

  const assetPermissionCodes = [
    ...source.matchAll(/permissionCode:\s*'ASSETS_(?:READ|WRITE)'/g),
  ];
  assert.equal(
    assetPermissionCodes.length,
    5,
    'exactly five Asset permission seed rules are required'
  );

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'STAFF',\s*permissionCode:\s*'ASSETS_(?:READ|WRITE)'/,
    'STAFF must not receive Asset permissions'
  );

  assert.doesNotMatch(
    source,
    /\{\s*role:\s*'OWNER',\s*permissionCode:\s*'ASSETS_WRITE'/,
    'OWNER must not receive ASSETS_WRITE'
  );
});
