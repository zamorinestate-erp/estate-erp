'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadSource(relPath) {
  const p = fs.existsSync(relPath) ? relPath : path.resolve(__dirname, '..', relPath.replace(/^backend\//, ''));
  return fs.readFileSync(p, 'utf8');
}

test('Department Order backend routes exclude STAFF while preserving approved management access', () => {
  const source = loadSource('backend/src/routes/departmentOrderRoutes.js');

  assert.equal(
    source.includes("authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] })"),
    true,
    'DEPARTMENT_ORDERS_READ must be MASTER, OWNER, and CAFE_ADMIN only'
  );

  assert.equal(
    source.includes("authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] })"),
    true,
    'DEPARTMENT_ORDERS_WRITE must be MASTER and CAFE_ADMIN only'
  );

  assert.doesNotMatch(
    source,
    /DEPARTMENT_ORDERS_(?:READ|WRITE)[\s\S]{0,120}?'STAFF'/,
    'STAFF must not receive Department Order backend route access'
  );
});

test('OWNER has organisation-wide Department Order read scope while CAFE_ADMIN remains assigned-cafe scoped', () => {
  const source = loadSource('backend/src/controllers/departmentOrderController.js');

  assert.equal(
    source.includes("if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;"),
    true,
    'assertCafeAccess must allow MASTER and OWNER organisation-wide Department Order read access'
  );

  assert.equal(
    source.includes("} else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {"),
    true,
    'listDepartmentOrders must apply assignedCafeIds filtering only to non-MASTER/non-OWNER roles'
  );
});
