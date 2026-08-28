// =============================================================================
// ZAMORIN CAFÉ ERP — SUPPORTING FILES PROGRAMME
// 4 NEGATIVE CONTROLS VERIFICATION & INTEGRITY HARNESS
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('=============================================================================');
console.log('   ZAMORIN CAFÉ ERP — SUPPORTING FILES AUDIT NEGATIVE CONTROL SUITE');
console.log('=============================================================================\n');

const results = [];

// ─── 1. IMPORT GRAPH NEGATIVE CONTROL ─────────────────────────────────────────
console.log('▶ [TEST 1/4] Running Import Graph Audit Negative Control...');
const targetJsFile = path.join(ROOT_DIR, 'frontend/src/js/pages/dashboardMaster.js');
const origJsContent = fs.readFileSync(targetJsFile, 'utf8');

try {
  // Inject a synthetic broken import
  fs.writeFileSync(targetJsFile, `import nonExistentModule from './non_existent_module_xyz_123.js';\n` + origJsContent, 'utf8');

  let failedAsExpected = false;
  try {
    execSync('node scripts/audit_runtime_import_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    failedAsExpected = true;
    console.log(`  ✔ Correctly detected broken import. Exit code: ${err.status}`);
  }
  assert.ok(failedAsExpected, 'Import graph audit must fail on broken import');
  results.push({ name: 'Import Graph Negative Control', detected: true, exitCode: 1 });
} finally {
  fs.writeFileSync(targetJsFile, origJsContent, 'utf8');
}

// Verify restored clean pass
execSync('node scripts/audit_runtime_import_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
console.log('  ✔ Restored state passes 100% clean.\n');

// ─── 2. STATIC ASSET GRAPH NEGATIVE CONTROL ──────────────────────────────────
console.log('▶ [TEST 2/4] Running Static Asset Graph Audit Negative Control...');
const targetCssFile = path.join(ROOT_DIR, 'frontend/src/styles/components.css');
const origCssContent = fs.readFileSync(targetCssFile, 'utf8');

try {
  // Inject a synthetic broken asset url
  fs.writeFileSync(targetCssFile, `@import url("./missing_font_family_xyz.css");\n` + origCssContent, 'utf8');

  let failedAsExpected = false;
  try {
    execSync('node scripts/audit_static_asset_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    failedAsExpected = true;
    console.log(`  ✔ Correctly detected missing static asset. Exit code: ${err.status}`);
  }
  assert.ok(failedAsExpected, 'Static asset audit must fail on missing asset');
  results.push({ name: 'Static Asset Negative Control', detected: true, exitCode: 1 });
} finally {
  fs.writeFileSync(targetCssFile, origCssContent, 'utf8');
}

// Verify restored clean pass
execSync('node scripts/audit_static_asset_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
console.log('  ✔ Restored state passes 100% clean.\n');

// ─── 3. BACKEND DEPENDENCY GRAPH NEGATIVE CONTROL ─────────────────────────────
console.log('▶ [TEST 3/4] Running Backend Graph Audit Negative Control...');
const targetRouteFile = path.join(ROOT_DIR, 'backend/src/routes/authRoutes.js');
const origRouteContent = fs.readFileSync(targetRouteFile, 'utf8');

try {
  // Inject a synthetic broken controller path
  fs.writeFileSync(targetRouteFile, origRouteContent.replace("require('../controllers/authController')", "require('../controllers/nonExistentAuthController')"), 'utf8');

  let failedAsExpected = false;
  try {
    execSync('node scripts/audit_backend_module_dependency_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    failedAsExpected = true;
    console.log(`  ✔ Correctly detected broken backend handler. Exit code: ${err.status}`);
  }
  assert.ok(failedAsExpected, 'Backend graph audit must fail on undefined handler');
  results.push({ name: 'Backend Graph Negative Control', detected: true, exitCode: 1 });
} finally {
  fs.writeFileSync(targetRouteFile, origRouteContent, 'utf8');
}

// Verify restored clean pass
execSync('node scripts/audit_backend_module_dependency_graph.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
console.log('  ✔ Restored state passes 100% clean.\n');

// ─── 4. TEMPLATE DEPENDENCIES NEGATIVE CONTROL ────────────────────────────────
console.log('▶ [TEST 4/4] Running Template Dependencies Audit Negative Control...');
const targetTemplateFile = path.join(ROOT_DIR, 'backend/src/services/TemplateEngine.js');
const origTemplateContent = fs.readFileSync(targetTemplateFile, 'utf8');

try {
  // Inject a synthetic template failure by renaming a required template dependency
  fs.writeFileSync(targetTemplateFile, origTemplateContent.replace("SECURITY_ALERT:", "NON_EXISTENT_TEMPLATE:"), 'utf8');

  let failedAsExpected = false;
  try {
    execSync('node scripts/audit_template_dependencies.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (err) {
    failedAsExpected = true;
    console.log(`  ✔ Correctly detected missing template dependency. Exit code: ${err.status}`);
  }
  assert.ok(failedAsExpected, 'Template dependency audit must fail on missing template');
  results.push({ name: 'Template Audit Negative Control', detected: true, exitCode: 1 });
} finally {
  fs.writeFileSync(targetTemplateFile, origTemplateContent, 'utf8');
}

// Verify restored clean pass
execSync('node scripts/audit_template_dependencies.mjs', { cwd: ROOT_DIR, stdio: 'pipe' });
console.log('  ✔ Restored state passes 100% clean.\n');

console.log('=============================================================================');
console.log('ALL 4 NEGATIVE CONTROLS VERIFIED & CERTIFIED:');
results.forEach(r => console.log(`  ✔ ${r.name}: Defect Detected (Exit: ${r.exitCode}) -> Restored PASS`));
console.log('=============================================================================\n');
