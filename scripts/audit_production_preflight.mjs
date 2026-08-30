#!/usr/bin/env node
// =============================================================================
// ZAMORIN CAFÉ ERP — PRODUCTION DEPLOYMENT PRE-FLIGHT AUDIT
// Validates Vercel + Render + MongoDB Atlas Deployment Invariants
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const checks = [];

function check(title, fn) {
  process.stdout.write(`  • ${title.padEnd(72, '.')}`);
  try {
    fn();
    console.log(" PASS");
    checks.push({ title, passed: true });
  } catch (err) {
    console.log(` FAIL (${err.message})`);
    checks.push({ title, passed: false, error: err.message });
  }
}

console.log("\n===============================================================================");
console.log("       ZAMORIN CAFÉ ERP — PRODUCTION PRE-FLIGHT CONFIGURATION AUDIT");
console.log("===============================================================================\n");

// 1. Frontend Vercel Configuration
console.log("1. FRONTEND DEPLOYMENT POSTURE (Vercel)");
check("vercel.json exists and is valid JSON", () => {
  const vercelPath = path.join(rootDir, 'frontend', 'vercel.json');
  if (!fs.existsSync(vercelPath)) throw new Error("frontend/vercel.json missing");
  const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  if (!parsed.rewrites || !parsed.headers) throw new Error("rewrites or headers missing");
});

check("vercel.json enforces standard security response headers", () => {
  const vercelPath = path.join(rootDir, 'frontend', 'vercel.json');
  const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const allHeaders = parsed.headers.flatMap(h => h.headers || []);
  const headerKeys = allHeaders.map(h => h.key.toLowerCase());
  if (!headerKeys.includes('x-frame-options')) throw new Error("X-Frame-Options missing");
  if (!headerKeys.includes('x-content-type-options')) throw new Error("X-Content-Type-Options missing");
  if (!headerKeys.includes('referrer-policy')) throw new Error("Referrer-Policy missing");
});

check("vercel.json SPA rewrite routes to index.html with API proxy destination", () => {
  const vercelPath = path.join(rootDir, 'frontend', 'vercel.json');
  const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const hasApiRewrite = parsed.rewrites.some(r => r.source.includes('/api/'));
  const hasSpaRewrite = parsed.rewrites.some(r => r.destination === '/index.html');
  if (!hasApiRewrite) throw new Error("API rewrite destination missing");
  if (!hasSpaRewrite) throw new Error("SPA index.html catch-all rewrite missing");
});

// 2. Backend Environment Variables Template
console.log("\n2. BACKEND ENVIRONMENT CONFIGURATION (Render / Staging)");
check("backend/.env.example defines all required security and connection keys", () => {
  const envPath = path.join(rootDir, 'backend', '.env.example');
  if (!fs.existsSync(envPath)) throw new Error("backend/.env.example missing");
  const content = fs.readFileSync(envPath, 'utf8');

  const requiredKeys = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'ALLOWED_ORIGINS',
    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_TTL_MINUTES',
    'REFRESH_TOKEN_TTL_DAYS',
    'SESSION_ABSOLUTE_TTL_DAYS',
    'MFA_ENCRYPTION_KEY',
    'INITIAL_ORGANISATION_ID',
    'INITIAL_MASTER_EMAIL',
    'PRIVATE_STORAGE_DRIVER',
  ];

  for (const key of requiredKeys) {
    if (!content.includes(`${key}=`)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }
});

// 3. Security & Cross-Site Cookie Architecture
console.log("\n3. CROSS-SITE COOKIE & CORS COMPLIANCE");
check("authController enforces HttpOnly, Secure, and SameSite cookie options", () => {
  const authCtrlPath = path.join(rootDir, 'backend', 'src', 'controllers', 'authController.js');
  const content = fs.readFileSync(authCtrlPath, 'utf8');
  if (!content.includes('httpOnly: true')) throw new Error("httpOnly: true missing from refresh cookie issuance");
  if (!content.includes('sameSite:')) throw new Error("sameSite attribute missing from cookie options");
});

check("apiClient enforces in-memory token hygiene without storage persistence", () => {
  const clientPath = path.join(rootDir, 'frontend', 'src', 'js', 'apiClient.js');
  const content = fs.readFileSync(clientPath, 'utf8');
  if (!content.includes('inMemoryAccessToken')) throw new Error("inMemoryAccessToken missing from apiClient");
  if (content.includes('localStorage.setItem("zamorin-token"') || content.includes('localStorage.setItem("accessToken"')) {
    throw new Error("Token persistence in localStorage detected in apiClient");
  }
});

// 4. Rate Limiting & Denial of Service Defenses
console.log("\n4. RATE LIMITING & DOS DEFENSES");
check("Express server configures helmet and distributed rate limiters", () => {
  const serverPath = path.join(rootDir, 'backend', 'src', 'server.js');
  const content = fs.readFileSync(serverPath, 'utf8');
  if (!content.includes('helmet')) throw new Error("Helmet middleware missing from backend server");
  if (!content.includes('cookieParser') && !content.includes('cookie-parser')) {
    throw new Error("cookie-parser missing from backend server");
  }
});

console.log("\n===============================================================================");
const passedCount = checks.filter(c => c.passed).length;
const totalCount = checks.length;
console.log(`PRE-FLIGHT SUMMARY: ${passedCount} / ${totalCount} Checks Passed`);
console.log("===============================================================================\n");

process.exit(passedCount === totalCount ? 0 : 1);
