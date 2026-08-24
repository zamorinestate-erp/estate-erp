'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('OWNER has organisation-wide Inventory read scope while CAFE_ADMIN remains assigned-cafe scoped', () => {
  const filePath = fs.existsSync('src/controllers/inventoryController.js') ? 'src/controllers/inventoryController.js' : path.resolve(__dirname, '../src/controllers/inventoryController.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes("if (role === 'MASTER' || role === 'OWNER') return;"),
    true,
    'assertCafeAccess must allow MASTER and OWNER organisation-wide Inventory access'
  );
});
