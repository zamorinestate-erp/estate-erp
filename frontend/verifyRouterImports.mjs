import fs from 'fs';
import path from 'path';

const routerContent = fs.readFileSync('src/js/router.js', 'utf8');
const lines = routerContent.split('\n');
const missing = [];

for (const line of lines) {
  if (line.trim().startsWith('import {')) {
    const importMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      const importPath = importMatch[2].split('?')[0];
      const targetFile = path.resolve('src/js', importPath);
      
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
} else {
  console.log('Total missing exports:', missing.length);
}
