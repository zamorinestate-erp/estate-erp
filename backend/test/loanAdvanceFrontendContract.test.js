'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readFrontend(relativePath) {
  return fs.readFileSync(
    path.join(__dirname, '../../frontend/src/js', relativePath),
    'utf8'
  );
}

const navigationSource = readFrontend('navigation.js');
const routerSource = readFrontend('router.js');
const pageSource = readFrontend('pages/staffLoansAdvances.js');

test('Loans/Advances self-service route is wired to the canonical page', () => {
  assert.ok(
    routerSource.includes('./pages/staffLoansAdvances.js')
  );
  assert.ok(
    routerSource.includes('case "staff-loans-advances":')
  );
  assert.ok(
    routerSource.includes('renderStaffLoansAdvances()')
  );
  assert.ok(
    routerSource.includes('wireStaffLoansAdvances(content)')
  );
});

test('Loans/Advances page is authenticated self-service', () => {
  assert.ok(
    pageSource.includes('apiGet("/loan-advances/me')
  );
  assert.ok(
    pageSource.includes('export function renderStaffLoansAdvances()')
  );
  assert.ok(
    pageSource.includes('export function wireStaffLoansAdvances(root)')
  );
});
