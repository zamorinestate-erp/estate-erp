'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Customer backend routes exclude STAFF while preserving approved management access', () => {
  const filePath = fs.existsSync('src/routes/customerRoutes.js') ? 'src/routes/customerRoutes.js' : path.resolve(__dirname, '../src/routes/customerRoutes.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(
    source,
    /authorize\('CUSTOMERS_READ', \{ allowedRoles: \['MASTER', 'OWNER', 'CAFE_ADMIN'\] \}\)/,
    'CUSTOMERS_READ must be MASTER, OWNER, and CAFE_ADMIN only'
  );

  assert.match(
    source,
    /authorize\('CUSTOMERS_WRITE', \{ allowedRoles: \['MASTER', 'CAFE_ADMIN'\] \}\)/,
    'CUSTOMERS_WRITE must be MASTER and CAFE_ADMIN only'
  );

  assert.doesNotMatch(
    source,
    /CUSTOMERS_(?:READ|WRITE)[\s\S]{0,120}?'STAFF'/,
    'STAFF must not receive Customer backend route access'
  );
});
