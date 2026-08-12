'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('non-MASTER Menu reads are restricted to ACTIVE items', () => {
  const filePath = fs.existsSync('src/controllers/menuController.js') ? 'src/controllers/menuController.js' : path.resolve(__dirname, '../src/controllers/menuController.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes("if (request.auth.role === 'MASTER' && status) {"),
    true,
    'only MASTER may choose an arbitrary Menu status filter'
  );

  assert.equal(
    source.includes("} else if (request.auth.role !== 'MASTER') {\n    filter.status = 'ACTIVE';"),
    true,
    'non-MASTER Menu list reads must always force ACTIVE status'
  );

  assert.equal(
    source.includes("if (request.auth.role !== 'MASTER') {\n    filter.status = 'ACTIVE';\n  }\n\n  const item = await MenuItem.findOne(filter)"),
    true,
    'non-MASTER single Menu reads must force ACTIVE status'
  );
});
