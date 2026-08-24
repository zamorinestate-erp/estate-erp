'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SCR-015: My Payslips frontend file and contracts exist and are intact', () => {
  const staffPayslipsPath = path.resolve(__dirname, '../../frontend/src/js/pages/staffPayslips.js');
  assert.ok(fs.existsSync(staffPayslipsPath), 'staffPayslips.js must exist');

  const content = fs.readFileSync(staffPayslipsPath, 'utf8');
  assert.ok(content.includes('renderStaffPayslips'), 'Must export renderStaffPayslips');
  assert.ok(content.includes('wireStaffPayslips'), 'Must export wireStaffPayslips');
  assert.ok(content.includes('renderPrintablePayslip'), 'Must include statutory printable renderer');
  assert.ok(content.includes('Form V'), 'Must include Form V statutory compliance');
});
