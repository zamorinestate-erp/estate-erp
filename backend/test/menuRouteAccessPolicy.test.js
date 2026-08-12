'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('STAFF is excluded from Menu Management backend read authorization', () => {
  const filePath = fs.existsSync('src/routes/menuRoutes.js') ? 'src/routes/menuRoutes.js' : path.resolve(__dirname, '../src/routes/menuRoutes.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes("authorize('MENU_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] })"),
    true,
    'MENU_READ must be MASTER, OWNER, and CAFE_ADMIN only'
  );

  assert.equal(
    source.includes("authorize('MENU_WRITE', { allowedRoles: ['MASTER'] })"),
    true,
    'MENU_WRITE must remain MASTER only'
  );

  assert.equal(
    source.includes("allowedRoles: ['MASTERs', 'OWNER', 'CAFE_ADMIN', 'STAFF']"),
    false
  );
});
