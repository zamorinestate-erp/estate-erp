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

test('Loans/Advances self-service navigation is exposed for all four employee roles', () => {
  assert.equal(
    (navigationSource.match(/route: "staff-loans-advances"/g) || []).length,
    4
  );
  assert.equal(
    (navigationSource.match(/label: "My Loans & Advances"/g) || []).length,
    4
  );
});

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

test('Loans/Advances page remains authenticated self-service and read-only', () => {
  assert.ok(
    pageSource.includes('apiGet("/loan-advances/me?limit=24"')
  );
  assert.ok(
    pageSource.includes('export function renderStaffLoansAdvances()')
  );
  assert.ok(
    pageSource.includes('export function wireStaffLoansAdvances(root)')
  );
  assert.equal(
    /api(Post|Patch|Put|Delete)/.test(pageSource),
    false
  );
});
