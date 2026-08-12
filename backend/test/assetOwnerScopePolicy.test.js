'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('OWNER has organisation-wide Asset read scope while CAFE_ADMIN remains assigned-cafe scoped', () => {
  const filePath = fs.existsSync('src/controllers/assetController.js') ? 'src/controllers/assetController.js' : path.resolve(__dirname, '../src/controllers/assetController.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes("if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;"),
    true,
    'assertCafeAccess must allow MASTER and OWNER organisation-wide Asset read access'
  );

  assert.equal(
    source.includes("} else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {"),
    true,
    'listAssets must apply assignedCafeIds filtering only to non-MASTER/non-OWNER roles'
  );
});
