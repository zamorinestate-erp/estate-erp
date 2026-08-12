'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadSource(relPath) {
  const p = fs.existsSync(relPath) ? relPath : path.resolve(__dirname, '..', relPath.replace(/^backend\//, ''));
  return fs.readFileSync(p, 'utf8');
}

test('Procurement backend routes preserve the approved role matrix and exclude STAFF', () => {
  const source = loadSource('backend/src/routes/procurementRoutes.js');

  assert.equal(
    source.includes("authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] })"),
    true,
    'PROCUREMENT_READ must be MASTER, OWNER, and CAFE_ADMIN'
  );

  assert.equal(
    source.includes("authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] })"),
    true,
    'PROCUREMENT_APPROVE must be MASTER, OWNER, and CAFE_ADMIN'
  );

  assert.equal(
    source.includes("authorize('PROCUREMENT_RECEIVE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] })"),
    true,
    'PROCUREMENT_RECEIVE must be MASTER and CAFE_ADMIN only'
  );

  assert.equal(
    source.includes("'/orders/:purchaseOrderId/cancel'") &&
      source.includes("authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] })"),
    true,
    'OWNER must retain the explicit cancel-order exception'
  );

  assert.doesNotMatch(
    source,
    /PROCUREMENT_(?:READ|WRITE|APPROVE|RECEIVE)[\s\S]{0,120}?'STAFF'/,
    'STAFF must not receive Procurement backend route access'
  );
});

test('OWNER has organisation-wide Procurement read, approve, and cancel scope while CAFE_ADMIN remains assigned-cafe scoped', () => {
  const source = loadSource('backend/src/controllers/procurementController.js');

  assert.equal(
    source.includes("if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;"),
    true,
    'assertCafeAccess must allow MASTER and OWNER organisation-wide Procurement access'
  );

  assert.equal(
    source.includes("} else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {"),
    true,
    'listOrders must apply assignedCafeIds filtering only to non-MASTER/non-OWNER roles'
  );
});
