#!/usr/bin/env node
// =============================================================================
// ZAMORIN CAFÉ ERP — NAVIGATION CONTROLS AUDIT SCRIPT
// scripts/audit_all_navigation_controls.mjs
// =============================================================================

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

async function auditNavigation() {
  console.log('='.repeat(70));
  console.log('AUDITING NAVIGATION ROUTE RECONCILIATION');
  console.log('='.repeat(70));

  const navContent = await readFile(join(ROOT, 'frontend', 'src', 'js', 'navigation.js'), 'utf8');
  const routerContent = await readFile(join(ROOT, 'frontend', 'src', 'js', 'router.js'), 'utf8');

  // Extract routes from navigation.js
  const navRouteMatches = [...navContent.matchAll(/route:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const uniqueNavRoutes = [...new Set(navRouteMatches)];

  // Extract case routes from router.js
  const routerCaseMatches = [...routerContent.matchAll(/case\s*['"]([^'"]+)['"]:/g)].map(m => m[1]);
  const uniqueRouterCases = [...new Set(routerCaseMatches)];

  console.log(`Routes declared in navigation.js: ${uniqueNavRoutes.length}`);
  console.log(`Cases handled in router.js:      ${uniqueRouterCases.length}`);

  let missingInRouter = 0;
  for (const r of uniqueNavRoutes) {
    const base = r.split('/')[0];
    const isHandled = uniqueRouterCases.includes(base) || base === 'settings';
    if (!isHandled) {
      console.error(`❌ Route declared in navigation.js has no handler in router.js: ${r}`);
      missingInRouter++;
    }
  }

  console.log('='.repeat(70));
  if (missingInRouter === 0) {
    console.log('NAVIGATION AUDIT: ✅ 100% ROUTE RECONCILIATION (ZERO DEAD NAVIGATION LINKS)');
  } else {
    console.error(`NAVIGATION AUDIT: ❌ FAILED (${missingInRouter} missing route handlers)`);
    process.exit(1);
  }
}

auditNavigation().catch(console.error);
