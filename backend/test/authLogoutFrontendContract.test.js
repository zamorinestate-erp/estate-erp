'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/js/sessionManagement.js'), 'utf8');

test('frontend logout clears public app caches before reload', () => {
  assert.ok(source.includes('import { clearPublicAppCaches } from "./updateManager.js";'));
  assert.ok(source.includes('await apiPost("/auth/logout");\n          await clearPublicAppCaches();\n          window.location.reload();'));
});

test('frontend logout-all clears public app caches before reload', () => {
  assert.ok(source.includes('await apiPost("/auth/logout-all");\n      await clearPublicAppCaches();\n      window.location.reload();'));
});
