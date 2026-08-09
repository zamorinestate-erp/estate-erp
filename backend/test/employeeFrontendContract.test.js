'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const nav = fs.readFileSync('frontend/src/js/navigation.js', 'utf8');
const router = fs.readFileSync('frontend/src/js/router.js', 'utf8');
const employees = fs.readFileSync('frontend/src/js/pages/employees.js', 'utf8');
const profilePath = 'frontend/src/js/pages/employeeProfile.js';

test('Stage 2 navigation exposes directory to MASTER and OWNER and My Profile to all roles', () => {
  assert.equal(nav.split('route: "employees"').length - 1, 2);
  assert.equal(nav.split('route: "employee-profile"').length - 1, 4);
  assert.equal(nav.split('label: "My Profile"').length - 1, 4);
});

test('Stage 2 router wires the canonical self-profile page', () => {
  assert.ok(fs.existsSync(profilePath));
  assert.ok(router.includes('./pages/employeeProfile.js'));
  assert.ok(router.includes('case "employee-profile"'));
  assert.ok(router.includes('renderEmployeeProfile()'));
  assert.ok(router.includes('wireEmployeeProfile(content)'));
});

test('Employees frontend is API-backed and contains no hard-coded employee dataset', () => {
  const profile = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : '';
  assert.ok(employees.includes('/employees/search?'));
  assert.ok(employees.includes('/employees/'));
  assert.ok(!employees.includes('const EMPLOYEES ='));
  assert.ok(profile.includes('/employees/me'));
});

test('Stage 2 frontend renders every optional profile section supplied by the backend', () => {
  const profile = fs.readFileSync(profilePath, 'utf8');
  for (const source of [employees, profile]) {
    assert.ok(source.includes('previousNames'));
    assert.ok(source.includes('address'));
    assert.ok(source.includes('emergencyContact'));
    assert.ok(source.includes('roleHistory'));
    assert.ok(source.includes('cafeAssignmentHistory'));
    assert.ok(source.includes('lifecycle'));
  }
});
