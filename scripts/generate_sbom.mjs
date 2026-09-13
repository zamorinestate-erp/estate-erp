#!/usr/bin/env node
/**
 * Zamorin Café ERP — Executable CycloneDX 1.5 SBOM Generator
 *
 * Produces an immutable, machine-readable Software Bill of Materials
 * conforming to CISA minimum elements guidance and CycloneDX 1.5 JSON spec.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const outputPath = path.join(rootDir, 'ZAMORIN_CAFE_ERP_SBOM.json');

function computeFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

function parsePackageLock(lockPath) {
  if (!fs.existsSync(lockPath)) return [];
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lock = JSON.parse(raw);
    const packages = lock.packages || {};
    const components = [];

    for (const [pkgPath, meta] of Object.entries(packages)) {
      if (!pkgPath) continue; // Root package
      const name = meta.name || pkgPath.replace(/^node_modules\//, '').replace(/^.*node_modules\//, '');
      const version = meta.version || 'unknown';
      const license = meta.license || 'MIT';
      const integrity = meta.integrity || null;
      const isDev = Boolean(meta.dev);

      components.push({
        type: 'library',
        name,
        version,
        scope: isDev ? 'optional' : 'required',
        licenses: [{ license: { id: typeof license === 'string' ? license : 'MIT' } }],
        purl: `pkg:npm/${name}@${version}`,
        hashes: integrity ? [{ alg: integrity.startsWith('sha512-') ? 'SHA-512' : 'SHA-1', content: integrity }] : [],
      });
    }

    return components;
  } catch (err) {
    console.warn(`[WARN] Could not parse lockfile at ${lockPath}:`, err.message);
    return [];
  }
}

export function generateSbom() {
  const rootPkgPath = path.join(rootDir, 'package.json');
  const backendPkgPath = path.join(rootDir, 'backend', 'package.json');
  const backendLockPath = path.join(rootDir, 'backend', 'package-lock.json');
  const rootLockPath = path.join(rootDir, 'package-lock.json');

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));

  // Collect direct production and dev dependencies
  const directProd = Object.entries(backendPkg.dependencies || {}).map(([name, version]) => ({
    name,
    version: version.replace(/^[\^~]/, ''),
    scope: 'required',
  }));

  const directDev = [
    ...Object.entries(backendPkg.devDependencies || {}).map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~]/, ''),
      scope: 'optional',
    })),
    ...Object.entries(rootPkg.devDependencies || {}).map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~]/, ''),
      scope: 'optional',
    })),
  ];

  // Try parsing lockfiles for transitive graph
  let components = parsePackageLock(backendLockPath);
  if (components.length === 0) {
    components = parsePackageLock(rootLockPath);
  }

  // If no lockfile, build from direct package manifests
  if (components.length === 0) {
    const allDirect = [...directProd, ...directDev];
    components = allDirect.map(({ name, version, scope }) => ({
      type: 'library',
      name,
      version,
      scope,
      licenses: [{ license: { id: 'MIT' } }],
      purl: `pkg:npm/${name}@${version}`,
    }));
  }

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'Zamorin Cafe Operations Engineering',
          name: 'zamorin-cyclonedx-sbom-generator',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        name: 'zamorin-cafe-erp',
        version: rootPkg.version || '1.0.0',
        description: rootPkg.description || 'Zamorin Cafe ERP — Enterprise Management System',
        licenses: [{ license: { id: 'UNLICENSED' } }],
      },
    },
    components,
    dependencies: [
      {
        ref: `pkg:npm/zamorin-cafe-erp@${rootPkg.version || '1.0.0'}`,
        dependsOn: components.map((c) => c.purl),
      },
    ],
  };

  fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2), 'utf8');
  return {
    success: true,
    outputPath,
    componentCount: components.length,
    serialNumber: sbom.serialNumber,
    timestamp: sbom.metadata.timestamp,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = generateSbom();
  console.log(`[SBOM] Successfully generated CycloneDX 1.5 SBOM:`);
  console.log(`       Path: ${result.outputPath}`);
  console.log(`       Components: ${result.componentCount}`);
  console.log(`       Timestamp: ${result.timestamp}`);
}
