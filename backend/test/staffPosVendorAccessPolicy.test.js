'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = require('node:path');

function authorizationLines(file) {
  const filePath = fs.existsSync(file) ? file : path.resolve(__dirname, '..', file.replace(/^backend\//, ''));
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes("authorize('"));
}

test('STAFF is excluded from POS and Vendor backend route authorization', () => {
  const billLines = authorizationLines('backend/src/routes/billRoutes.js');
  const vendorLines = authorizationLines('backend/src/routes/vendorRoutes.js');

  assert.ok(billLines.length > 0, 'Expected Bill authorization routes');
  assert.ok(vendorLines.length > 0, 'Expected Vendor authorization routes');

  for (const line of [...billLines, ...vendorLines]) {
    assert.equal(line.includes("'STAFF'"), false, line.trim());
  }
});
