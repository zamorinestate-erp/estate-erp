import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../frontend/src/js');

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const jsFiles = getAllJsFiles(frontendDir);
console.log(`Found ${jsFiles.length} JS files in frontend/src/js`);

const issues = [];

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(frontendDir, file);

  // 1. Extract all button IDs from template strings
  const buttonIdMatches = [...content.matchAll(/<button[^>]*id=["']([^"']+)["'][^>]*>/gi)];
  for (const m of buttonIdMatches) {
    const fullTag = m[0];
    const id = m[1];

    // Check if ID has inline onclick
    if (/onclick\s*=/i.test(fullTag)) continue;

    // Check if ID is queried in the file (or imported)
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const idRegex = new RegExp(`['"\`#]${escapeRegExp(id)}['"\`]`, 'g');
    const queries = [...content.matchAll(idRegex)];
    
    // If the only occurrence of the id is the template definition
    if (queries.length <= 1) {
      // Check if it's referenced in other files
      let foundInOther = false;
      for (const otherFile of jsFiles) {
        if (otherFile === file) continue;
        const otherContent = fs.readFileSync(otherFile, 'utf8');
        if (otherContent.includes(id)) {
          foundInOther = true;
          break;
        }
      }
      if (!foundInOther) {
        issues.push({
          file: relPath,
          type: 'BUTTON_ID_NEVER_WIRED',
          id,
          tag: fullTag.trim().replace(/\s+/g, ' ')
        });
      }
    }
  }

  // 2. Extract button classes that look like action buttons (.btn-*, .*-btn)
  const btnClassMatches = [...content.matchAll(/<button[^>]*class=["']([^"']+)["'][^>]*>/gi)];
  for (const m of btnClassMatches) {
    const fullTag = m[0];
    const classes = m[1].split(/\s+/);
    if (/onclick\s*=/i.test(fullTag)) continue;
    if (/id=["']/i.test(fullTag)) continue; // Handled by ID check
    if (/data-tab\s*=/i.test(fullTag)) continue; // Handled by tab switcher
    if (/data-nav-target\s*=/i.test(fullTag)) continue; // Handled by nav
    if (/data-route\s*=/i.test(fullTag)) continue; // Handled by router
    if (/data-step\s*=/i.test(fullTag)) continue; // Handled by step wizard
    if (/type=["']submit["']/i.test(fullTag)) continue; // Form submit

    // Specific action classes
    const actionClasses = classes.filter(c => 
      !['btn', 'btn-sm', 'btn-xs', 'btn-lg', 'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-danger', 'btn-warning', 'btn-outline', 'btn-icon', 'tab-btn', 'active'].includes(c)
    );

    for (const ac of actionClasses) {
      function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      const classRegex = new RegExp(`['"\`.]${escapeRegExp(ac)}['"\`]`, 'g');
      const matches = [...content.matchAll(classRegex)];
      if (matches.length <= 1) {
        let foundInOther = false;
        for (const otherFile of jsFiles) {
          if (otherFile === file) continue;
          const otherContent = fs.readFileSync(otherFile, 'utf8');
          if (otherContent.includes(ac)) {
            foundInOther = true;
            break;
          }
        }
        if (!foundInOther) {
          issues.push({
            file: relPath,
            type: 'BUTTON_CLASS_NEVER_WIRED',
            actionClass: ac,
            tag: fullTag.trim().replace(/\s+/g, ' ')
          });
        }
      }
    }
  }
}

console.log(`\nFound ${issues.length} potential unwired controls across frontend:\n`);
console.log(JSON.stringify(issues, null, 2));

fs.writeFileSync(path.resolve(__dirname, '../scratch/unwired_scan_results.json'), JSON.stringify(issues, null, 2));
