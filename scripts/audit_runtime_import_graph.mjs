// =============================================================================
// ZAMORIN CAFÉ ERP — APPLICATION-WIDE SUPPORTING FILE INTEGRATION
// RUNTIME IMPORT GRAPH & MODULE RESOLUTION AUDIT
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'frontend/src/js'),
  path.join(ROOT_DIR, 'frontend/cafe-operations/js'),
  path.join(ROOT_DIR, 'backend/src')
];

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyCaseSensitivity(filePath) {
  const parts = path.relative(ROOT_DIR, filePath).split(path.sep);
  let curr = ROOT_DIR;
  for (const part of parts) {
    if (!part || part === '.') continue;
    const entries = fs.readdirSync(curr);
    if (!entries.includes(part)) {
      return false; // Case mismatch or file does not exist exactly
    }
    curr = path.join(curr, part);
  }
  return true;
}

function extractImports(filePath, content) {
  const imports = [];
  
  // 1. Static ESM imports: import ... from '...'; or import '...';
  const esmRegex = /(?:import\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"])|(?:export\s+[\w*\s{},$]+\s+from\s+['"]([^'"]+)['"])/g;
  let match;
  while ((match = esmRegex.exec(content)) !== null) {
    const specifier = match[1] || match[2];
    if (specifier) imports.push({ specifier, type: 'static_esm' });
  }

  // 2. Dynamic imports: import('...')
  const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.push({ specifier: match[1], type: 'dynamic_esm' });
  }

  // 3. CommonJS require: require('...')
  const cjsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsRegex.exec(content)) !== null) {
    imports.push({ specifier: match[1], type: 'cjs' });
  }

  return imports;
}

async function runImportGraphAudit() {
  console.log('=============================================================================');
  console.log('   ZAMORIN CAFÉ ERP — RUNTIME IMPORT GRAPH & MODULE RESOLUTION AUDIT');
  console.log('=============================================================================\n');

  let totalFilesScanned = 0;
  let totalImportsFound = 0;
  let brokenImports = [];
  let caseMismatches = [];
  let scratchReferences = [];
  let absoluteDevPathReferences = [];

  const files = SCAN_DIRS.flatMap(d => getAllJsFiles(d));
  totalFilesScanned = files.length;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    const relFile = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    // Check for raw dev / machine absolute paths
    const devPathRegex = /['"`](?:[A-Za-z]:[\\\/][a-zA-Z0-9_\-\. ]+[\\\/]|file:\/\/\/)/;
    if (devPathRegex.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (devPathRegex.test(line) && !line.includes('CHROME_PATH') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          absoluteDevPathReferences.push({ file: relFile, line: idx + 1, snippet: line.trim() });
        }
      });
    }

    // Check for scratch / brain archive imports
    if (/scratch\/|login_pkg|\.gemini\/antigravity-ide\/brain/.test(content)) {
      scratchReferences.push({ file: relFile });
    }

    const imports = extractImports(file, content);
    totalImportsFound += imports.length;

    for (const imp of imports) {
      const spec = imp.specifier;
      
      // Ignore npm packages and Node builtins
      if (!spec.startsWith('.') && !spec.startsWith('/')) {
        continue;
      }

      let resolvedTarget = null;
      if (spec.startsWith('/')) {
        // Frontend root-relative import e.g. '/src/js/pages/login.js'
        resolvedTarget = path.join(ROOT_DIR, 'frontend', spec.replace(/^\//, ''));
      } else {
        // Relative import
        resolvedTarget = path.resolve(dir, spec);
      }

      // Check with extensions if omitted
      let actualPath = resolvedTarget;
      if (!fs.existsSync(actualPath)) {
        if (fs.existsSync(actualPath + '.js')) {
          actualPath = actualPath + '.js';
        } else if (fs.existsSync(actualPath + '.mjs')) {
          actualPath = actualPath + '.mjs';
        } else if (fs.existsSync(path.join(actualPath, 'index.js'))) {
          actualPath = path.join(actualPath, 'index.js');
        } else {
          brokenImports.push({ file: relFile, specifier: spec, resolvedTarget });
          continue;
        }
      }

      // Verify case sensitivity
      if (!verifyCaseSensitivity(actualPath)) {
        caseMismatches.push({ file: relFile, specifier: spec, actualPath });
      }
    }
  }

  console.log(`▶ Total Runtime JS Files Scanned: ${totalFilesScanned}`);
  console.log(`▶ Total Imports / Requires Analyzed: ${totalImportsFound}`);
  console.log(`▶ Broken Imports Found: ${brokenImports.length}`);
  console.log(`▶ Case Mismatch Imports Found: ${caseMismatches.length}`);
  console.log(`▶ Scratch / Archive References: ${scratchReferences.length}`);
  console.log(`▶ Absolute Dev Machine Path Invocations: ${absoluteDevPathReferences.length}\n`);

  if (brokenImports.length > 0) {
    console.error('❌ Broken Imports Detected:');
    console.error(JSON.stringify(brokenImports, null, 2));
  }

  if (caseMismatches.length > 0) {
    console.error('❌ Case Mismatches Detected:');
    console.error(JSON.stringify(caseMismatches, null, 2));
  }

  assert.strictEqual(brokenImports.length, 0, 'BROKEN_IMPORTS must equal 0');
  assert.strictEqual(caseMismatches.length, 0, 'CASE_MISMATCH_IMPORTS must equal 0');
  assert.strictEqual(scratchReferences.length, 0, 'RUNTIME_REFERENCE_TO_SOURCE_ARCHIVE must equal 0');
  assert.strictEqual(absoluteDevPathReferences.length, 0, 'PRODUCTION_RUNTIME_ABSOLUTE_DEV_PATHS must equal 0');

  console.log('✅ IMPORT GRAPH AUDIT PASSED — Zero broken imports, zero case mismatches, zero scratch dependencies.\n');
}

runImportGraphAudit().catch(err => {
  console.error('\n❌ IMPORT GRAPH AUDIT FAILED:');
  console.error(err);
  process.exit(1);
});
