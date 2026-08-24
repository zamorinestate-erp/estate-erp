'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SCR-016: Universal Profile Master frontend contract and integrity', (t) => {
  const profilePagePath = path.resolve(__dirname, '../../frontend/src/js/pages/employeeProfile.js');
  assert.ok(fs.existsSync(profilePagePath), 'employeeProfile.js must exist in frontend pages');

  const content = fs.readFileSync(profilePagePath, 'utf8');

  // Contract exports
  assert.ok(content.includes('export function renderEmployeeProfile'), 'must export renderEmployeeProfile');
  assert.ok(content.includes('export function wireEmployeeProfile'), 'must export wireEmployeeProfile');

  // Universal Role Support
  assert.ok(content.includes('rolePill'), 'must support role pill rendering');
  assert.ok(content.includes('MASTER'), 'must support MASTER role');
  assert.ok(content.includes('OWNER'), 'must support OWNER role');
  assert.ok(content.includes('CAFE_ADMIN'), 'must support CAFE_ADMIN role');
  assert.ok(content.includes('STAFF'), 'must support STAFF role');

  // Category Tabs
  assert.ok(content.includes('overview'), 'must support Overview tab');
  assert.ok(content.includes('personal'), 'must support Personal tab');
  assert.ok(content.includes('employment'), 'must support Employment tab');
  assert.ok(content.includes('pay'), 'must support Pay tab');
  assert.ok(content.includes('documents'), 'must support Documents tab');
  assert.ok(content.includes('skills'), 'must support Skills tab');
  assert.ok(content.includes('assets'), 'must support Assets tab');
  assert.ok(content.includes('security'), 'must support Security tab');
  assert.ok(content.includes('privacy'), 'must support Privacy tab');
  assert.ok(content.includes('requests'), 'must support Requests tab');
  assert.ok(content.includes('history'), 'must support History tab');
  assert.ok(content.includes('preferences'), 'must support Preferences tab');

  // Action Centre & Health
  assert.ok(content.includes('Action Centre'), 'must feature Action Centre');
  assert.ok(content.includes('PROFILE COMPLETENESS'), 'must feature profile completeness');

  // Modals & Governed Requests
  assert.ok(content.includes('renderEditModal'), 'must render direct self-edit modal');
  assert.ok(content.includes('renderReportInaccuracyModal'), 'must render governed change request modal');
  assert.ok(content.includes('renderDiagnosticsModal'), 'must render diagnostics modal');

  // Security & Sensitive Masking
  assert.ok(content.includes('bankAccountMasked'), 'must use masked bank account display');
  assert.ok(content.includes('SELF_ONLY'), 'must enforce CAFE_ADMIN personal device SELF_ONLY mode');
});
