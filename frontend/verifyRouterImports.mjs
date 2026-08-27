import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerFile = path.resolve(__dirname, 'src/js/router.js');
const routerContent = fs.readFileSync(routerFile, 'utf8');
const lines = routerContent.split('\n');
const missing = [];

for (const line of lines) {
  if (line.trim().startsWith('import {')) {
    const importMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      const importPath = importMatch[2].split('?')[0];
      const targetFile = path.resolve(__dirname, 'src/js', importPath);
      
      if (!fs.existsSync(targetFile)) {
        console.error('File not found:', targetFile);
        missing.push({ file: targetFile, names: namedImports });
        continue;
      }
      
      const targetContent = fs.readFileSync(targetFile, 'utf8');
      for (const name of namedImports) {
        const regex = new RegExp(`export\\s+(async\\s+)?(function|const|let|var|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`);
        if (!regex.test(targetContent)) {
          console.error(`Missing export: "${name}" in ${importPath}`);
          missing.push({ file: importPath, name });
        }
      }
    }
  }
}

if (missing.length === 0) {
  console.log('ALL ROUTER IMPORTS EXIST AND ARE EXPORTED CORRECTLY!');
  process.exit(0);
} else {
  console.log('Total missing exports:', missing.length);
  process.exit(1);
}
