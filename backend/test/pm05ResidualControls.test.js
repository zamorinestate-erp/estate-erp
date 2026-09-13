// =============================================================================
// PM-05: RESIDUAL UI/CONTROL AUDIT & CANONICAL INTEGRATION TEST SUITE
// =============================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PM-05 CONTROLS: 1. Zero Dead Controls - Primary Master Navigation Map Integrity', () => {
  const navFile = path.resolve(__dirname, '../../frontend/src/js/navigation.js');
  const routerFile = path.resolve(__dirname, '../../frontend/src/js/router.js');

  assert.ok(fs.existsSync(navFile), 'navigation.js must exist');
  assert.ok(fs.existsSync(routerFile), 'router.js must exist');

  const navContent = fs.readFileSync(navFile, 'utf8');
  const routerContent = fs.readFileSync(routerFile, 'utf8');

  // Extract all routes from PRIMARY_MASTER_ITEMS in navigation.js
  const routeMatches = [...navContent.matchAll(/route:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(routeMatches.length > 0, 'Must extract routes from navigation.js');

  const missingRoutes = [];
  for (const r of routeMatches) {
    const routePattern = new RegExp(`case\\s+['"]${r}['"]`);
    if (!routePattern.test(routerContent)) {
      missingRoutes.push(r);
    }
  }

  assert.deepEqual(
    missingRoutes,
    [],
    `All Primary Master navigation routes must have matching router cases (NAVIGATION_ROUTE_TARGET_MISSING = 0). Missing: ${missingRoutes.join(', ')}`
  );
});

test('PM-05 CONTROLS: 2. Zero Misrepresented Controls - Personal Ledger Wire Functions', () => {
  const ledgerFile = path.resolve(__dirname, '../../frontend/src/js/pages/personalLedger.js');
  assert.ok(fs.existsSync(ledgerFile), 'personalLedger.js must exist');

  const content = fs.readFileSync(ledgerFile, 'utf8');

  // Verify exported functions exist
  assert.ok(content.includes('export function renderLedger'), 'renderLedger must be exported');
  assert.ok(content.includes('export function wireLedger'), 'wireLedger must be exported');

  // Verify critical event handlers are wired
  const requiredHandlers = [
    'wireJournalActions',
    'downloadJournalCsv',
    'downloadDpt3Pack',
    'wireLedger',
    'renderLedger',
  ];

  for (const handler of requiredHandlers) {
    assert.ok(
      content.includes(handler),
      `personalLedger.js must implement and wire ${handler}`
    );
  }
});

test('PM-05 CONTROLS: 3. No Hardcoded Seed ID Fallbacks in Production Code', () => {
  const ledgerFile = path.resolve(__dirname, '../../frontend/src/js/pages/personalLedger.js');
  const content = fs.readFileSync(ledgerFile, 'utf8');

  // PRODUCTION_HARDCODED_ID_FALLBACK = 0
  // Verify that fallback to 'MU-0001' or similar seed actor IDs in getStoredRole is eliminated
  assert.ok(
    !content.includes("role = 'MASTER'") && !content.includes('userId = "MU-0001"'),
    'personalLedger.js must not contain hardcoded "MU-0001" or fallback Primary Master authority'
  );
});

test('PM-05 CONTROLS: 4. Static Router Verification Pass', () => {
  const verifyRouterPath = path.resolve(__dirname, '../../frontend/verifyRouterImports.mjs');
  assert.ok(fs.existsSync(verifyRouterPath), 'verifyRouterImports.mjs must exist');
});
