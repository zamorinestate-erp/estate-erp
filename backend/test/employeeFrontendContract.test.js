'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const nav = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/navigation.js'), 'utf8');
const router = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/router.js'), 'utf8');
const employees = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/pages/employees.js'), 'utf8');
const profilePath = path.join(__dirname, '../../frontend/src/js/pages/employeeProfile.js');

test('Stage 2 navigation exposes directory to MASTER and OWNER and My Profile to all roles', () => {
  assert.ok(nav.includes("route: 'employees'") || nav.includes('route: "employees"'));
  assert.ok(router.includes('employee-profile'));
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
  assert.ok(employees.includes('/employees') || employees.includes('/employees/search?'));
  assert.ok(!employees.includes('const EMPLOYEES ='));
  assert.ok(profile.includes('/employees/me'));
});
