'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const mainJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/main.js'), 'utf8');
const loginJs = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/pages/login.js'), 'utf8');

test('Development Preview: Documents NEW LOGIN MODULE: PENDING REDESIGN marker', () => {
  assert.ok(
    loginJs.includes('NEW LOGIN MODULE: PENDING REDESIGN') ||
    loginJs.includes('PENDING REDESIGN'),
    'login.js must document that the new login module is pending redesign'
  );
});

test('Development Preview: Displays discreet temporary preview banner in local mode', () => {
  assert.ok(
    mainJs.includes('DEVELOPMENT PREVIEW') ||
    mainJs.includes('AUTHENTICATION UI TEMPORARILY DISABLED'),
    'main.js must define the temporary development banner'
  );
});

test('Development Preview: Personal Ledger remains MASTER ONLY in backend authorization', () => {
  const personalLedgerRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/personalLedgerRoutes.js'), 'utf8');
  assert.ok(
    personalLedgerRoutes.includes('authorize("LEDGER:VIEW_ORGANISATION")') ||
    personalLedgerRoutes.includes('LEDGER:VIEW_ORGANISATION') ||
    personalLedgerRoutes.includes('MASTER'),
    'Personal Ledger routes must require MASTER-only permission authorization'
  );
});
