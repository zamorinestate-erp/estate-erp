'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { DEFAULT_PERMISSION_RULES } = require('../src/scripts/seedInitialData');

test('Route-Seed Consistency — Every authorize(code) has a matching seed rule', () => {
  const routesDir = path.join(__dirname, '../src/routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));

  const seededCodes = new Set(DEFAULT_PERMISSION_RULES.map((r) => r.permissionCode));

  const authorizeRegex = /authorize\(\s*['"]([A-Z0-9_:]+)['"]/g;
  const missingSeeds = [];

  for (const file of routeFiles) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    let match;
    while ((match = authorizeRegex.exec(content)) !== null) {
      const code = match[1];
      if (!seededCodes.has(code)) {
        missingSeeds.push({ file, code });
      }
    }
  }

  assert.deepEqual(
    missingSeeds,
    [],
    `Found backend routes using authorize() with permission codes missing from seedInitialData.js: ${JSON.stringify(
      missingSeeds
    )}`
  );
});
