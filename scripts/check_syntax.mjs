import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dir = 'd:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/frontend/src/js';

function checkSyntax(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dirPath, f.name);
    if (f.isDirectory()) {
      checkSyntax(full);
    } else if (f.name.endsWith('.js')) {
      try {
        execSync(`node --check "${full}"`);
        console.log(`PASS: ${f.name}`);
      } catch (err) {
        console.error(`SYNTAX ERROR in ${full}:`, err.message);
      }
    }
  }
}

checkSyntax(dir);
