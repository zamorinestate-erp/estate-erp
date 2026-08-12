'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const path = require('node:path');

test('POS void is MASTER and OWNER only', function () {
  const filePath = fs.existsSync('src/routes/billRoutes.js') ? 'src/routes/billRoutes.js' : path.resolve(__dirname, '../src/routes/billRoutes.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  const voidLine = lines.find(function (line) {
    return line.includes("authorize('POS_VOID'");
  });

  assert.ok(voidLine, 'Expected POS_VOID authorization route');
  assert.equal(voidLine.includes("'MASTER'"), true);
  assert.equal(voidLine.includes("'OWNER'"), true);
  assert.equal(voidLine.includes("'CAFE_ADMIN'"), false);
  assert.equal(voidLine.includes("'STAFF'"), false);
});
