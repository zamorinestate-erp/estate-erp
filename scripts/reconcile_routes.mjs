import fs from 'fs';
import path from 'path';

const routerCode = fs.readFileSync('frontend/src/js/router.js', 'utf8');

// Top-level router definitions
const baseCases = [...routerCode.matchAll(/case\s+['"]([^'"]+)['"]:/g)].map(m => m[1]);
const uniqueBase = [...new Set(baseCases)];

// Settings subroutes (from router.js line 150-188)
const settingsSubMatch = routerCode.match(/const sectionMap = \{([\s\S]*?)\};/);
let settingsSubroutes = [];
if (settingsSubMatch) {
  const keys = [...settingsSubMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g)].map(m => m[1]);
  settingsSubroutes = [...new Set(keys)];
}

// Module tabs / sub-views across page files
const pagesDir = 'frontend/src/js/pages';
const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.js'));

const moduleBreakdown = {};
let totalSubViews = 0;

for (const file of pageFiles) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const tabs = new Set();
  
  // Pattern 1: data-tab="xxx"
  for (const m of content.matchAll(/data-tab=['"]([^'"]+)['"]/g)) tabs.add(m[1]);
  // Pattern 2: case "tab-name" or activeTab === "xxx"
  for (const m of content.matchAll(/(?:activeTab|subroute|currentTab|activeSection|currentView)\s*===?\s*['"]([^'"]+)['"]/g)) tabs.add(m[1]);
  
  if (tabs.size > 0) {
    moduleBreakdown[file] = [...tabs];
    totalSubViews += tabs.size;
  }
}

console.log('=== ROUTE & VIEW RECONCILIATION SUMMARY ===');
console.log('Top-Level Router Cases (base routes/aliases):', uniqueBase.length);
console.log('Settings Dedicated Subroutes:', settingsSubroutes.length);
console.log('Total Distinct Sub-views / Tabs across 46 Page Modules:', totalSubViews);
console.log('Total Calculated Runtime Destinations (Base + Settings Subroutes + Page Subviews):', uniqueBase.length + settingsSubroutes.length + totalSubViews);
console.log('\n--- Module Tabs Breakdown ---');
for (const [f, t] of Object.entries(moduleBreakdown)) {
  console.log(`${f} (${t.length} views): ${t.join(', ')}`);
}
