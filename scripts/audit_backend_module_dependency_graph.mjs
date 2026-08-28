// =============================================================================
// ZAMORIN CAFÉ ERP — APPLICATION-WIDE SUPPORTING FILE INTEGRATION
// BACKEND MODULE DEPENDENCY GRAPH & CONTROLLER RESOLUTION AUDIT
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (entry.name.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function runBackendDependencyGraphAudit() {
  console.log('=============================================================================');
  console.log('   ZAMORIN CAFÉ ERP — BACKEND MODULE DEPENDENCY GRAPH AUDIT');
  console.log('=============================================================================\n');

  const routeFiles = getAllFiles(path.join(ROOT_DIR, 'backend/src/routes'));
  let totalChainsChecked = 0;
  let brokenChains = [];
  let undefinedHandlers = [];

  for (const routeFile of routeFiles) {
    if (path.basename(routeFile) === 'index.js') continue;
    const content = fs.readFileSync(routeFile, 'utf8');
    const relRoute = path.relative(ROOT_DIR, routeFile).replace(/\\/g, '/');

    // Extract imported controllers
    const controllerImports = [];
    const requireRegex = /(?:const|let|var)\s+(?:{([^}]+)}|([a-zA-Z0-9_$]+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const destructured = match[1];
      const defaultName = match[2];
      const reqPath = match[3];

      if (reqPath.includes('controller') || reqPath.includes('Controller')) {
        const resolvedPath = path.resolve(path.dirname(routeFile), reqPath) + (reqPath.endsWith('.js') ? '' : '.js');
        if (!fs.existsSync(resolvedPath)) {
          brokenChains.push({ route: relRoute, missingControllerPath: reqPath, resolvedPath });
          continue;
        }

        // Check controller exports
        const ctrlContent = fs.readFileSync(resolvedPath, 'utf8');
        if (destructured) {
          const names = destructured.split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
          for (const name of names) {
            totalChainsChecked++;
            if (!ctrlContent.includes(name)) {
              undefinedHandlers.push({ route: relRoute, controller: reqPath, handlerName: name });
            }
          }
        } else if (defaultName) {
          totalChainsChecked++;
          if (!ctrlContent.includes('module.exports')) {
            undefinedHandlers.push({ route: relRoute, controller: reqPath, handlerName: 'default' });
          }
        }
      }
    }
  }

  console.log(`▶ Total Backend Dependency Chains Audited: ${totalChainsChecked}`);
  console.log(`▶ Broken Controller Import Chains: ${brokenChains.length}`);
  console.log(`▶ Undefined Controller Export Handlers: ${undefinedHandlers.length}\n`);

  if (brokenChains.length > 0) {
    console.error('❌ Broken Controller Chains:');
    console.error(JSON.stringify(brokenChains, null, 2));
  }

  if (undefinedHandlers.length > 0) {
    console.error('❌ Undefined Controller Handlers:');
    console.error(JSON.stringify(undefinedHandlers, null, 2));
  }

  assert.strictEqual(brokenChains.length, 0, 'BROKEN_BACKEND_CHAINS must equal 0');
  assert.strictEqual(undefinedHandlers.length, 0, 'UNDEFINED_CONTROLLER_EXPORT must equal 0');

  console.log('✅ BACKEND DEPENDENCY GRAPH AUDIT PASSED — Zero broken chains, all route handlers resolve to controllers.\n');
}

runBackendDependencyGraphAudit().catch(err => {
  console.error('\n❌ BACKEND DEPENDENCY GRAPH AUDIT FAILED:');
  console.error(err);
  process.exit(1);
});
