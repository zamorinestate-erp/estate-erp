// =============================================================================
// ZAMORIN CAFÉ ERP — APPLICATION-WIDE SUPPORTING FILE INTEGRATION
// ORPHAN RUNTIME FILE & UNREFERENCED MODULE AUDIT
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
  path.join(ROOT_DIR, 'backend/src'),
  path.join(ROOT_DIR, 'backend/test'),
  path.join(ROOT_DIR, 'scripts')
];

function getAllJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function runOrphanAudit() {
  console.log('=============================================================================');
  console.log('   ZAMORIN CAFÉ ERP — ORPHAN RUNTIME FILE & MODULE AUDIT');
  console.log('=============================================================================\n');

  const allFiles = SCAN_DIRS.flatMap(d => getAllJsFiles(d));
  
  // Build a combined corpus of all code content to do fast substring checks
  const corpus = [];
  for (const f of allFiles) {
    corpus.push({
      file: f,
      content: fs.readFileSync(f, 'utf8')
    });
  }

  const backendRoutes = getAllJsFiles(path.join(ROOT_DIR, 'backend/src/routes'));
  const backendControllers = getAllJsFiles(path.join(ROOT_DIR, 'backend/src/controllers'));
  const backendModels = getAllJsFiles(path.join(ROOT_DIR, 'backend/src/models'));
  const frontendPages = getAllJsFiles(path.join(ROOT_DIR, 'frontend/src/js/pages'));

  const routesIndexContent = fs.readFileSync(path.join(ROOT_DIR, 'backend/src/routes/index.js'), 'utf8');
  const serverContent = fs.readFileSync(path.join(ROOT_DIR, 'backend/src/server.js'), 'utf8');

  const unmountedRoutes = [];

  // 1. Audit Backend Routes: every route in backend/src/routes must be mounted in index.js or server.js
  for (const routeFile of backendRoutes) {
    const baseName = path.basename(routeFile, '.js');
    const fileName = path.basename(routeFile);
    if (fileName === 'index.js') continue; // Index aggregator itself
    
    let isMounted = routesIndexContent.includes(fileName) || routesIndexContent.includes(baseName) ||
                    serverContent.includes(fileName) || serverContent.includes(baseName);
    
    if (!isMounted) {
      for (const item of corpus) {
        if (item.file !== routeFile && item.file.includes('backend/src/routes') && (item.content.includes(fileName) || item.content.includes(baseName))) {
          isMounted = true;
          break;
        }
      }
    }

    if (!isMounted) {
      unmountedRoutes.push(path.relative(ROOT_DIR, routeFile).replace(/\\/g, '/'));
    }
  }

  // 2. Audit Controllers: every controller must be imported by at least one route or service or test
  const unreferencedControllers = [];
  for (const ctrlFile of backendControllers) {
    const baseName = path.basename(ctrlFile, '.js');
    const fileName = path.basename(ctrlFile);
    let refFound = false;

    for (const item of corpus) {
      if (item.file !== ctrlFile && (item.content.includes(fileName) || item.content.includes(baseName))) {
        refFound = true;
        break;
      }
    }
    if (!refFound) {
      unreferencedControllers.push(path.relative(ROOT_DIR, ctrlFile).replace(/\\/g, '/'));
    }
  }

  // 3. Audit Frontend Pages: every page must be imported in router.js, navigation.js, main.js, or another module
  const unmountedPages = [];
  const routerContent = fs.readFileSync(path.join(ROOT_DIR, 'frontend/src/js/router.js'), 'utf8');
  for (const pageFile of frontendPages) {
    const baseName = path.basename(pageFile, '.js');
    const fileName = path.basename(pageFile);
    let pageMounted = routerContent.includes(fileName) || routerContent.includes(baseName);

    if (!pageMounted) {
      for (const item of corpus) {
        const itemNorm = item.file.replace(/\\/g, '/');
        const pageNorm = pageFile.replace(/\\/g, '/');
        if (itemNorm !== pageNorm && (itemNorm.includes('frontend/src/js') || itemNorm.includes('scripts/audit_login') || itemNorm.includes('frontend/index.html')) && (item.content.includes(fileName) || item.content.includes(baseName))) {
          pageMounted = true;
          break;
        }
      }
    }
    if (!pageMounted) {
      unmountedPages.push(path.relative(ROOT_DIR, pageFile).replace(/\\/g, '/'));
    }
  }

  console.log(`▶ Backend Routes Audited: ${backendRoutes.length} (Unmounted: ${unmountedRoutes.length})`);
  console.log(`▶ Backend Controllers Audited: ${backendControllers.length} (Unreferenced: ${unreferencedControllers.length})`);
  console.log(`▶ Backend Models Audited: ${backendModels.length}`);
  console.log(`▶ Frontend Pages Audited: ${frontendPages.length} (Unmounted: ${unmountedPages.length})\n`);

  if (unmountedRoutes.length > 0) {
    console.error('❌ Unmounted Backend Routes:');
    console.error(JSON.stringify(unmountedRoutes, null, 2));
  }

  if (unreferencedControllers.length > 0) {
    console.error('❌ Unreferenced Controllers:');
    console.error(JSON.stringify(unreferencedControllers, null, 2));
  }

  if (unmountedPages.length > 0) {
    console.error('❌ Unmounted Frontend Pages:');
    console.error(JSON.stringify(unmountedPages, null, 2));
  }

  assert.strictEqual(unmountedRoutes.length, 0, 'UNINTENTIONALLY_UNMOUNTED_ROUTES must equal 0');
  assert.strictEqual(unreferencedControllers.length, 0, 'UNREFERENCED_CONTROLLERS must equal 0');
  assert.strictEqual(unmountedPages.length, 0, 'UNMOUNTED_PAGES must equal 0');

  console.log('✅ ORPHAN & UNMOUNTED MODULE AUDIT PASSED — Zero orphan routes, controllers, or frontend pages.\n');
}

runOrphanAudit().catch(err => {
  console.error('\n❌ ORPHAN AUDIT FAILED:');
  console.error(err);
  process.exit(1);
});
