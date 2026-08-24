const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'staticAudit.js');
const dangerous = [];

files.forEach(f => {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const hits = [];

  // Fixed large widths in inline styles (not inside comment blocks)
  const m1 = (c.match(/width\s*:\s*[5-9]\d{2}px|width\s*:\s*\d{4}px/g) || []);
  if (m1.length) hits.push('fixed-width: ' + m1.slice(0, 4).join(', '));

  // 100vw usage
  const m2 = (c.match(/100vw/g) || []);
  if (m2.length) hits.push('100vw-count: ' + m2.length);

  // overflow-x: hidden inline
  const m3 = (c.match(/overflow-x\s*:\s*['"]?hidden['"]?/g) || []);
  if (m3.length) hits.push('overflow-x-hidden: ' + m3.length);

  // min-width > 560px inline (risks outside table-wrap)
  const m4 = (c.match(/min-width\s*:\s*[6-9]\d{2}px|min-width\s*:\s*\d{4}px/g) || []);
  if (m4.length) hits.push('big-minwidth: ' + m4.slice(0, 4).join(', '));

  // white-space nowrap on flex row items without wrapping container
  const m5 = (c.match(/white-space\s*:\s*['"]?nowrap['"]?/g) || []);
  if (m5.length > 6) hits.push('many-nowrap: ' + m5.length);

  // display: inline-block with fixed large widths (can cause overflow)
  const m6 = (c.match(/display\s*:\s*['"]?inline-block['"]?/g) || []);
  if (m6.length > 4) hits.push('inline-block-count: ' + m6.length);

  if (hits.length) dangerous.push({ file: f, issues: hits });
});

console.log('\n=== ZAMORIN STATIC OVERFLOW AUDIT ===');
console.log('Files scanned:', files.length);
console.log('Files with issues:', dangerous.length);

if (dangerous.length === 0) {
  console.log('\n✅ CLEAN — No dangerous overflow patterns found in any page file.');
} else {
  dangerous.forEach(d => {
    console.log('\n⚠ ' + d.file);
    d.issues.forEach(i => console.log('   → ' + i));
  });
}

// Also scan CSS files
const cssDir = path.join(__dirname, '../../styles');
const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
const cssIssues = [];

cssFiles.forEach(f => {
  const c = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const hits = [];
  const m1 = (c.match(/overflow-x\s*:\s*hidden/g) || []);
  if (m1.length) hits.push('overflow-x-hidden: ' + m1.length + ' occurrences');
  const m2 = (c.match(/100vw/g) || []);
  if (m2.length) hits.push('100vw: ' + m2.length + ' occurrences');
  if (hits.length) cssIssues.push({ file: f, issues: hits });
});

console.log('\n=== CSS SCAN ===');
if (cssIssues.length === 0) {
  console.log('✅ CLEAN — No overflow masking in CSS files.');
} else {
  cssIssues.forEach(d => {
    console.log('⚠ ' + d.file);
    d.issues.forEach(i => console.log('   → ' + i));
  });
}
