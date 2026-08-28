// =============================================================================
// ZAMORIN CAFÉ ERP — APPLICATION-WIDE SUPPORTING FILE INTEGRATION
// STATIC ASSET GRAPH & CSS DEPENDENCY AUDIT
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'frontend'),
  path.join(ROOT_DIR, 'backend/src')
];

function getAllFiles(dir, exts, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, exts, fileList);
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function runStaticAssetGraphAudit() {
  console.log('=============================================================================');
  console.log('   ZAMORIN CAFÉ ERP — STATIC ASSET & CSS DEPENDENCY GRAPH AUDIT');
  console.log('=============================================================================\n');

  const cssFiles = getAllFiles(path.join(ROOT_DIR, 'frontend'), ['.css']);
  const jsFiles = getAllFiles(path.join(ROOT_DIR, 'frontend'), ['.js', '.mjs', '.html']);
  
  let totalAssetsChecked = 0;
  let missingAssets = [];
  let brokenCssImports = [];
  let brokenUrlReferences = [];

  // 1. Audit CSS @import and url(...) references
  for (const cssFile of cssFiles) {
    const content = fs.readFileSync(cssFile, 'utf8');
    const dir = path.dirname(cssFile);
    const relFile = path.relative(ROOT_DIR, cssFile).replace(/\\/g, '/');

    // Check @import
    const importRegex = /@import\s+(?:url\(['"]?([^'"\)]+)['"]?\)|['"]([^'"]+)['"])/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const target = match[1] || match[2];
      totalAssetsChecked++;
      if (target.startsWith('http://') || target.startsWith('https://')) {
        // External stylesheet (e.g. Google Fonts)
        continue;
      }
      const resolved = path.resolve(dir, target);
      if (!fs.existsSync(resolved)) {
        brokenCssImports.push({ file: relFile, target, resolved });
      }
    }

    // Check url(...)
    const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
    while ((match = urlRegex.exec(content)) !== null) {
      const target = match[1];
      if (target.startsWith('data:') || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) {
        continue;
      }
      totalAssetsChecked++;
      let resolved;
      if (target.startsWith('/')) {
        resolved = path.join(ROOT_DIR, 'frontend', target.replace(/^\//, ''));
      } else {
        resolved = path.resolve(dir, target);
      }
      // Strip query parameters or hash
      const cleanPath = resolved.split('?')[0].split('#')[0];
      if (!fs.existsSync(cleanPath)) {
        brokenUrlReferences.push({ file: relFile, target, cleanPath });
      }
    }
  }

  // 2. Audit JS asset references (images, icons, svgs, logos)
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(jsFile, 'utf8');
    const dir = path.dirname(jsFile);
    const relFile = path.relative(ROOT_DIR, jsFile).replace(/\\/g, '/');

    const assetRegex = /['"`](\/(?:assets|images|icons|img|static|fonts)\/[a-zA-Z0-9_\-\.\/]+\.(?:png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css))['"`]/g;
    let match;
    while ((match = assetRegex.exec(content)) !== null) {
      const target = match[1];
      totalAssetsChecked++;
      const resolved = path.join(ROOT_DIR, 'frontend', target.replace(/^\//, ''));
      if (!fs.existsSync(resolved)) {
        missingAssets.push({ file: relFile, target, resolved });
      }
    }
  }

  console.log(`▶ Total CSS Files Audited: ${cssFiles.length}`);
  console.log(`▶ Total Frontend Source Files Audited: ${jsFiles.length}`);
  console.log(`▶ Total Asset References Checked: ${totalAssetsChecked}`);
  console.log(`▶ Broken CSS @imports: ${brokenCssImports.length}`);
  console.log(`▶ Broken CSS url(...) references: ${brokenUrlReferences.length}`);
  console.log(`▶ Missing Static Assets: ${missingAssets.length}\n`);

  if (brokenCssImports.length > 0) {
    console.error('❌ Broken CSS Imports:');
    console.error(JSON.stringify(brokenCssImports, null, 2));
  }

  if (brokenUrlReferences.length > 0) {
    console.error('❌ Broken CSS URLs:');
    console.error(JSON.stringify(brokenUrlReferences, null, 2));
  }

  if (missingAssets.length > 0) {
    console.error('❌ Missing Static Assets:');
    console.error(JSON.stringify(missingAssets, null, 2));
  }

  assert.strictEqual(brokenCssImports.length, 0, 'BROKEN_CSS_IMPORTS must equal 0');
  assert.strictEqual(brokenUrlReferences.length, 0, 'BROKEN_CSS_URLS must equal 0');
  assert.strictEqual(missingAssets.length, 0, 'MISSING_STATIC_ASSETS must equal 0');

  console.log('✅ STATIC ASSET GRAPH AUDIT PASSED — Zero broken CSS imports, zero missing images/fonts/icons.\n');
}

runStaticAssetGraphAudit().catch(err => {
  console.error('\n❌ STATIC ASSET GRAPH AUDIT FAILED:');
  console.error(err);
  process.exit(1);
});
