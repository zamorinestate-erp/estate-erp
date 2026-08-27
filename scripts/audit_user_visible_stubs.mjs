#!/usr/bin/env node
// =============================================================================
// ZAMORIN CAFÉ ERP — USER VISIBLE STUB AUDIT SCRIPT
// scripts/audit_user_visible_stubs.mjs
// =============================================================================

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const FRONTEND_PAGES = join(ROOT, 'frontend', 'src', 'js', 'pages');
const FRONTEND_JS = join(ROOT, 'frontend', 'src', 'js');

const STUB_PATTERNS = [
  { id: 'STUB_TODO', pattern: /\/\/\s*TODO|\/\/\s*FIXME/i, desc: 'TODO or FIXME comment in UI code' },
  { id: 'STUB_PLACEHOLDER', pattern: /not implemented|coming soon|pending linking|under development/i, desc: 'Pending or unfinished implementation text' },
  { id: 'STUB_FAKE_ALERT', pattern: /onclick\s*=\s*['"]alert\(|window\.alert\(/i, desc: 'Browser alert popup placeholder' },
  { id: 'STUB_DISABLED_BTN', pattern: /<button[^>]+disabled[^>]+title=["'](?:Document download|Attachment not yet|coming soon)/i, desc: 'Disabled button placeholder' },
];

// Documented Governed Business Exceptions (Allowlist)
const GOVERNED_EXCEPTIONS = [
  'ACT-017', // Revenue Share Outlet Tier - BLOCKED_BUSINESS_DECISION
  'ACT-018', // Revenue Share Outlet Agreement - BLOCKED_BUSINESS_DECISION
  'NEW LOGIN MODULE: PENDING REDESIGN', // Intentional design freeze marker in login.js
];

async function getJsFiles(dir) {
  let files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) files.push(...await getJsFiles(full));
      else if (e.name.endsWith('.js')) files.push(full);
    }
  } catch (_) {}
  return files;
}

async function auditStubs() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        ZAMORIN CAFÉ ERP — USER VISIBLE STUB AUDIT                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const files = await getJsFiles(FRONTEND_JS);
  let unallowedStubs = 0;

  for (const f of files) {
    const content = await readFile(f, 'utf8');
    const lines = content.split('\n');
    const rel = relative(ROOT, f);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of STUB_PATTERNS) {
        if (p.pattern.test(line)) {
          const isGoverned = GOVERNED_EXCEPTIONS.some(g => line.includes(g) || content.includes(g));
          if (!isGoverned) {
            console.error(`❌ Stub Found [${p.id}] at ${rel}:${i + 1}`);
            console.error(`   Line: ${line.trim()}`);
            unallowedStubs++;
          }
        }
      }
    }
  }

  console.log(`Audited ${files.length} Frontend JavaScript Files.`);
  console.log(`Unallowed User-Facing Stubs Found: ${unallowedStubs}`);
  console.log('═'.repeat(72));

  if (unallowedStubs === 0) {
    console.log('✅ STUB AUDIT RESULT: PASS (USER_VISIBLE_IMPLEMENTATION_STUBS = 0)');
    process.exit(0);
  } else {
    console.error(`❌ STUB AUDIT RESULT: FAIL (${unallowedStubs} stubs remaining)`);
    process.exit(1);
  }
}

auditStubs().catch(console.error);
