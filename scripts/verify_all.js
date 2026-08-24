import fs from 'fs';
import path from 'path';
import vm from 'vm';

let totalFiles = 0;
let errors = 0;

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      checkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      totalFiles++;
      const code = fs.readFileSync(fullPath, 'utf8');
      try {
        new vm.SourceTextModule(code);
      } catch (err) {
        // Fallback check
        try {
          new vm.Script(code);
        } catch (scriptErr) {
          if (!scriptErr.message.includes('Cannot use import statement outside a module') &&
              !scriptErr.message.includes('Unexpected token \'export\'')) {
            console.error(`Syntax error in ${fullPath}:`, scriptErr.message);
            errors++;
          }
        }
      }
    }
  }
}

checkDir('./frontend/src');
checkDir('./backend/src');

console.log(`Verified ${totalFiles} JS files. Errors: ${errors}`);
if (errors > 0) {
  process.exit(1);
}
