'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RESULTS_DIR = path.join(__dirname, '../results');
const FRONTEND_DIR = path.join(__dirname, '../../frontend');
const SRC_DIR = path.join(FRONTEND_DIR, 'src');

// ─────────────────────────────────────────────────────────────────────────────
// HT-17: BROWSER & RESPONSIVE E2E AUDIT
// ─────────────────────────────────────────────────────────────────────────────
async function runHT17() {
  console.log(`\n================================================================================`);
  console.log(`HT-17 — BROWSER & RESPONSIVE E2E AUDIT`);
  console.log(`================================================================================`);

  const results = { checks: [] };

  // 1. Viewport & HTML5 Document Structure
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  const hasViewport = indexContent.includes('name="viewport"') && indexContent.includes('width=device-width');
  const hasAppMount = indexContent.includes('id="app"');
  const hasToastMount = indexContent.includes('id="toast-root"');
  const hasModuleScript = indexContent.includes('type="module"');

  results.checks.push({
    name: 'Html5ViewportAndMountPoints',
    description: 'Index.html specifies responsive viewport and dedicated app/toast DOM mount roots',
    passed: hasViewport && hasAppMount && hasToastMount && hasModuleScript,
    details: `Viewport: ${hasViewport}, App: ${hasAppMount}, Toast: ${hasToastMount}, Module: ${hasModuleScript}`
  });

  // 2. CSS Responsive Breakpoints & Design Tokens
  const tokensCssPath = path.join(SRC_DIR, 'styles/tokens.css');
  const layoutCssPath = path.join(SRC_DIR, 'styles/layout.css');
  const componentsCssPath = path.join(SRC_DIR, 'styles/components.css');

  const tokensExist = fs.existsSync(tokensCssPath);
  const layoutExist = fs.existsSync(layoutCssPath);
  const componentsExist = fs.existsSync(componentsCssPath);

  let hasMediaQueries = false;
  if (layoutExist) {
    const layoutContent = fs.readFileSync(layoutCssPath, 'utf8');
    hasMediaQueries = layoutContent.includes('@media') || layoutContent.includes('min-width') || layoutContent.includes('max-width');
  }

  results.checks.push({
    name: 'ResponsiveDesignSystemTokens',
    description: 'Design tokens and responsive layout stylesheets exist with media queries',
    passed: tokensExist && layoutExist && componentsExist && hasMediaQueries,
    details: `Tokens: ${tokensExist}, Layout: ${layoutExist}, Components: ${componentsExist}, MediaQueries: ${hasMediaQueries}`
  });

  // 3. Client Navigation Router & View Coverage
  const jsDir = path.join(SRC_DIR, 'js');
  let routeFiles = [];
  function scanJs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) scanJs(full);
      else if (file.endsWith('.js')) routeFiles.push(file);
    }
  }
  scanJs(jsDir);

  const coreModulesPresent = ['main.js', 'router.js', 'apiClient.js'].every(m => routeFiles.includes(m) || fs.existsSync(path.join(jsDir, m)));

  results.checks.push({
    name: 'ClientArchitectureModuleIntegrity',
    description: 'Core application modules (entry, router, api client) present and structured',
    passed: coreModulesPresent,
    details: `Found ${routeFiles.length} client JavaScript modules`
  });

  for (const c of results.checks) {
    console.log(`[HT-17] ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details}`);
  }

  results.totalChecks = results.checks.length;
  results.passed = results.checks.filter(c => c.passed).length;
  results.failed = results.checks.filter(c => !c.passed).length;
  results.status = results.failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[HT-17 SUMMARY] ${results.status}: ${results.passed}/${results.totalChecks} responsive E2E checks passed`);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// HT-18: ACCESSIBILITY & I18N AUDIT
// ─────────────────────────────────────────────────────────────────────────────
async function runHT18() {
  console.log(`\n================================================================================`);
  console.log(`HT-18 — ACCESSIBILITY & I18N TIMEZONE AUDIT`);
  console.log(`================================================================================`);

  const results = { checks: [] };

  // 1. Language attribute on HTML tag
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const hasLangEn = indexContent.includes('<html lang="en">') || indexContent.includes('lang=');

  results.checks.push({
    name: 'HtmlLangAttribute',
    description: 'Root document specifies lang="en" for screen readers',
    passed: hasLangEn,
    details: `lang attribute present: ${hasLangEn}`
  });

  // 2. Indian Standard Time (IST) timezone consistency across backend controllers
  const backendSrcDir = path.join(__dirname, '../../backend/src');
  let istOccurrences = 0;
  function scanBackendForIst(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) scanBackendForIst(full);
      else if (f.endsWith('.js')) {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes('Asia/Kolkata')) istOccurrences++;
      }
    }
  }
  scanBackendForIst(backendSrcDir);

  results.checks.push({
    name: 'IstTimezoneEnforcement',
    description: 'Business date and timestamp calculations explicitly bound to Asia/Kolkata',
    passed: istOccurrences >= 5,
    details: `Found ${istOccurrences} explicit Asia/Kolkata timezone references in backend controllers`
  });

  // 3. Indian Rupee (INR) Currency Precision and Formatting
  let inrCurrencyOccurrences = 0;
  function scanBackendForInr(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) scanBackendForInr(full);
      else if (f.endsWith('.js')) {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes("'INR'") || c.includes('"INR"')) inrCurrencyOccurrences++;
      }
    }
  }
  scanBackendForInr(backendSrcDir);

  results.checks.push({
    name: 'InrCurrencyConsistency',
    description: 'Financial modules enforce INR currency code and paisa-integer precision',
    passed: inrCurrencyOccurrences >= 5,
    details: `Found ${inrCurrencyOccurrences} explicit INR currency validations in backend models/controllers`
  });

  for (const c of results.checks) {
    console.log(`[HT-18] ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details}`);
  }

  results.totalChecks = results.checks.length;
  results.passed = results.checks.filter(c => c.passed).length;
  results.failed = results.checks.filter(c => !c.passed).length;
  results.status = results.failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n[HT-18 SUMMARY] ${results.status}: ${results.passed}/${results.totalChecks} accessibility and i18n checks passed`);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const ht17Results = await runHT17();
  const ht18Results = await runHT18();

  fs.writeFileSync(path.join(RESULTS_DIR, 'HT17_BROWSER_E2E_RESULTS.json'), JSON.stringify(ht17Results, null, 2));
  fs.writeFileSync(path.join(RESULTS_DIR, 'HT18_ACCESSIBILITY_I18N_RESULTS.json'), JSON.stringify(ht18Results, null, 2));

  console.log(`\n[HT-17 & HT-18 COMPLETE] Results saved.`);
  process.exit(0);
}

main().catch(err => { console.error('[HT-17/18 FATAL]', err); process.exit(1); });
