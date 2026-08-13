'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Navigation-Router Consistency — Every navigation route maps to a valid router case', () => {
  const navPath = path.join(__dirname, '../../frontend/src/js/navigation.js');
  const routerPath = path.join(__dirname, '../../frontend/src/js/router.js');

  const navContent = fs.readFileSync(navPath, 'utf8');
  const routerContent = fs.readFileSync(routerPath, 'utf8');

  // Extract all routes from navigation.js
  const routeMatches = navContent.match(/route:\s*["']([^"']+)["']/g) || [];
  const navRoutes = new Set(routeMatches.map((m) => m.replace(/route:\s*["']([^"']+)["']/, '$1')));

  // Extract router cases from router.js
  const caseMatches = routerContent.match(/case\s+["']([^"']+)["']:/g) || [];
  const routerCases = new Set(caseMatches.map((m) => m.replace(/case\s+["']([^"']+)["']:/, '$1')));

  const missingCases = [];
  for (const route of navRoutes) {
    if (!routerCases.has(route)) {
      missingCases.push(route);
    }
  }

  assert.deepEqual(
    missingCases,
    [],
    `Found navigation routes missing corresponding router cases in router.js: ${JSON.stringify(missingCases)}`
  );
});
