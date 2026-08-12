'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('OWNER has organisation-wide Approval scope while CAFE_ADMIN is assigned-cafe scoped', () => {
  const filePath = fs.existsSync('src/controllers/approvalController.js') ? 'src/controllers/approvalController.js' : path.resolve(__dirname, '../src/controllers/approvalController.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.equal(
    source.includes("if (!['MASTER', 'OWNER'].includes(request.auth.role)) {\n    filter.cafeId = { $in: request.auth.assignedCafeIds };\n  }"),
    true,
    'listApprovals must constrain CAFE_ADMIN to assigned cafes'
  );

  assert.equal(
    source.includes("if (request.auth.role === 'CAFE_ADMIN' && (!approval.cafeId || !request.auth.assignedCafeIds.includes(approval.cafeId))) {"),
    true,
    'CAFE_ADMIN must not decide approvals outside assigned cafes or organisation-level approvals'
  );
});
