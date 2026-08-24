/**
 * ZAMORIN RESPONSIVE TRIAGE SCRIPT
 * Distinguishes dangerous bare "width: Xpx" on page-level elements
 * from acceptable "max-width: Xpx" on modals/drawers/popovers.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'pages');
const cssDir = path.join(__dirname, 'styles');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'staticAudit.js');

const report = { critical: [], advisory: [], cssIssues: [] };

files.forEach(f => {
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = c.split('\n');
  const critical = [];
  const advisory = [];

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const trimmed = line.trim();

    // Skip pure comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    // 100vw — always dangerous on page-level containers
    if (/100vw/.test(line)) {
      // Check if it's inside a modal/popover definition
      const isModal = /modal|popover|drawer|overlay|toast|width\s*:\s*min\s*\(/.test(line);
      if (!isModal) {
        critical.push({ ln, type: '100vw-on-page-element', snippet: trimmed.slice(0, 100) });
      } else {
        advisory.push({ ln, type: '100vw-in-min()-safe', snippet: trimmed.slice(0, 100) });
      }
    }

    // overflow-x: hidden inline
    if (/overflow-x\s*:\s*['"]?hidden['"]?/.test(line)) {
      // Check if it's on a scroller container (table-wrap, tab-bar etc.) — those are allowed
      const isSafeContainer = /table-wrap|data-table|stepper|tab-strip|overflow-container|scrollable/.test(line);
      if (!isSafeContainer) {
        critical.push({ ln, type: 'overflow-x-hidden-masking', snippet: trimmed.slice(0, 100) });
      }
    }

    // Bare style="width: XXXpx" on containers (not inside a width:min() or max-width)
    // This catches patterns like: style="...width:800px..." that set page-level widths
    const bareWidthMatch = line.match(/(?<![max-|min-])width\s*:\s*(\d+)px(?!\s*[,)])/g);
    if (bareWidthMatch) {
      bareWidthMatch.forEach(m => {
        const px = parseInt(m.replace(/\D/g, ''));
        // Only flag if width > 560px and it appears to be a container style (not max-width, not min-width)
        if (px > 560) {
          // Check context — is this inside a modal card, modal-window, or modal-body? Those are OK.
          const isModalContext = /modal|drawer|popover|toast|overlay|panel/.test(line.toLowerCase());
          // Is it a max-width (safe) or min-width (acceptable inside table-wrap)?
          const isMax = /max-width/.test(line.slice(0, line.indexOf(m) + m.length + 5));
          const isMin = /min-width/.test(line.slice(0, line.indexOf(m) + m.length + 5));
          
          if (isMax) {
            // max-width on a modal — generally fine
            advisory.push({ ln, type: 'max-width-' + px + 'px-ok-if-modal', snippet: trimmed.slice(0, 100) });
          } else if (!isMin && !isModalContext && px > 600) {
            critical.push({ ln, type: 'bare-width-' + px + 'px-PAGE-LEVEL', snippet: trimmed.slice(0, 100) });
          } else if (!isMin && isModalContext) {
            advisory.push({ ln, type: 'modal-width-' + px + 'px-advisory', snippet: trimmed.slice(0, 100) });
          }
        }
      });
    }
  });

  if (critical.length > 0) report.critical.push({ file: f, issues: critical });
  if (advisory.length > 0) report.advisory.push({ file: f, issues: advisory });
});

// CSS scan
const cssFiles = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter(f => f.endsWith('.css')) : [];
cssFiles.forEach(f => {
  const c = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const hits = [];
  (c.match(/overflow-x\s*:\s*hidden/g) || []).forEach(m => {
    // Check if it's on a scroller container
    hits.push('overflow-x:hidden found — review context');
  });
  (c.match(/100vw/g) || []).forEach(() => {
    hits.push('100vw found — verify it uses min() wrapper');
  });
  if (hits.length) report.cssIssues.push({ file: f, hits });
});

// OUTPUT
console.log('\n=== ZAMORIN RESPONSIVE TRIAGE REPORT ===\n');
console.log('CRITICAL ISSUES (must fix — genuine overflow sources):');
if (report.critical.length === 0) {
  console.log('  ✅ NONE');
} else {
  report.critical.forEach(r => {
    console.log('\n  📄 ' + r.file);
    r.issues.forEach(i => console.log('     L' + i.ln + ' [' + i.type + ']: ' + i.snippet));
  });
}

console.log('\nADVISORY (likely safe — confirm context):');
if (report.advisory.length === 0) {
  console.log('  ✅ NONE');
} else {
  report.advisory.forEach(r => {
    console.log('\n  📄 ' + r.file + ' (' + r.issues.length + ' items)');
  });
}

console.log('\nCSS ISSUES:');
if (report.cssIssues.length === 0) {
  console.log('  ✅ NONE');
} else {
  report.cssIssues.forEach(r => {
    console.log('\n  📄 ' + r.file);
    r.hits.forEach(h => console.log('     → ' + h));
  });
}

console.log('\n=== END TRIAGE ===');
