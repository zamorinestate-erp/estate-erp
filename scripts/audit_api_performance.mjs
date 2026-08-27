// =============================================================================
// ZAMORIN CAFE ERP — AUTOMATED API PERFORMANCE BENCHMARK
// scripts/audit_api_performance.mjs
// =============================================================================

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '../backend');
const API_BASE = 'http://127.0.0.1:4000/api/v1';

const REPRESENTATIVE_ENDPOINTS = [
  { name: 'Health Check', path: '/health', method: 'GET' },
  { name: 'Readiness Check', path: '/readiness', method: 'GET' },
  { name: 'Auth Profile (/auth/me)', path: '/auth/me', method: 'GET' },
  { name: 'Cafes List', path: '/cafes', method: 'GET' },
  { name: 'Dashboard Overview', path: '/dashboard/master-summary', method: 'GET' },
  { name: 'Inventory Items', path: '/inventory/items', method: 'GET' },
  { name: 'Inventory Valuation', path: '/inventory/valuation', method: 'GET' },
  { name: 'Procurement POs', path: '/procurement/purchase-orders', method: 'GET' },
  { name: 'Vendors Directory', path: '/vendors', method: 'GET' },
  { name: 'Customers Directory', path: '/customers', method: 'GET' },
  { name: 'Employee Directory', path: '/employees', method: 'GET' },
  { name: 'Payroll Runs', path: '/payroll/runs', method: 'GET' },
  { name: 'Bills List', path: '/bills', method: 'GET' },
  { name: 'Expenses List', path: '/expenses', method: 'GET' },
  { name: 'Finance Accounts', path: '/finance/accounts', method: 'GET' },
  { name: 'Personal Ledger', path: '/personal-ledger/summary', method: 'GET' },
  { name: 'Passbook Summary', path: '/passbook/summary', method: 'GET' },
  { name: 'Passbook Accounts', path: '/passbook/accounts', method: 'GET' },
  { name: 'Passbook Transactions', path: '/passbook/transactions?limit=25', method: 'GET' },
  { name: 'Reports Catalogue', path: '/reports/catalogue', method: 'GET' },
  { name: 'Revenue Share Agreements', path: '/revenue-share/agreements', method: 'GET' },
  { name: 'Settings Metadata', path: '/settings/system', method: 'GET' },
  { name: 'Notification Centre', path: '/notifications', method: 'GET' },
  { name: 'Trash Bin', path: '/trash', method: 'GET' },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendUp() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureBackend() {
  if (await isBackendUp()) {
    console.log('✅ Backend API is already running at', API_BASE);
    return null;
  }

  console.log('🚀 Starting local backend for API performance benchmarking...');
  const proc = spawn('node', ['src/server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: '4000', NODE_ENV: 'development' },
    stdio: 'ignore',
  });

  for (let i = 0; i < 30; i++) {
    await delay(500);
    if (await isBackendUp()) {
      console.log('✅ Backend API ready at', API_BASE);
      return proc;
    }
  }

  console.error('❌ Failed to start backend API server.');
  proc.kill();
  process.exit(1);
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export async function runApiBenchmark(iterations = 10) {
  console.log('=============================================================================');
  console.log(`ZAMORIN CAFÉ ERP — API PERFORMANCE BENCHMARK (${iterations} iterations per endpoint)`);
  console.log('=============================================================================\n');

  const backendProc = await ensureBackend();
  const results = [];

  const headers = {
    'Accept': 'application/json',
    'x-device-id': 'PERF-TEST-DEVICE-001',
    'x-user-id': 'MU-0001',
    'x-user-role': 'MASTER',
    'x-organisation-id': 'ZAMORIN',
  };

  for (const ep of REPRESENTATIVE_ENDPOINTS) {
    const latencies = [];
    let responseSizeBytes = 0;
    let statusCode = 200;
    let contentType = '';

    // Warm-up single request
    try {
      await fetch(`${API_BASE}${ep.path}`, { headers, signal: AbortSignal.timeout(3000) });
    } catch {}

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API_BASE}${ep.path}`, {
          method: ep.method,
          headers,
          signal: AbortSignal.timeout(5000),
        });
        const t1 = performance.now();
        latencies.push(t1 - t0);
        statusCode = res.status;
        contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        responseSizeBytes = Buffer.byteLength(text, 'utf8');
      } catch (err) {
        const t1 = performance.now();
        latencies.push(t1 - t0);
        statusCode = 500;
      }
      await delay(20);
    }

    const p50 = Math.round(percentile(latencies, 50) * 10) / 10;
    const p95 = Math.round(percentile(latencies, 95) * 10) / 10;
    const max = Math.round(Math.max(...latencies) * 10) / 10;

    const pass = p95 <= 500;
    results.push({
      name: ep.name,
      path: ep.path,
      statusCode,
      p50,
      p95,
      max,
      responseSizeBytes,
      status: pass ? 'PASS' : 'WARN',
    });

    console.log(
      `[${pass ? 'PASS' : 'WARN'}] ${ep.name.padEnd(28)} | ${ep.path.padEnd(35)} | p50: ${String(p50).padStart(5)}ms | p95: ${String(p95).padStart(5)}ms | Max: ${String(max).padStart(5)}ms | Size: ${String(responseSizeBytes).padStart(6)}B | Status: ${statusCode}`
    );
  }

  const allP50 = results.map(r => r.p50);
  const allP95 = results.map(r => r.p95);
  const overallP50 = Math.round(percentile(allP50, 50) * 10) / 10;
  const overallP95 = Math.round(percentile(allP95, 95) * 10) / 10;

  console.log('\n=============================================================================');
  console.log(`SUMMARY: p50 Overall: ${overallP50}ms | p95 Overall: ${overallP95}ms`);
  console.log(`Targets: p50 <= 200ms preferred, p95 <= 500ms preferred`);
  console.log('=============================================================================\n');

  if (backendProc) {
    backendProc.kill();
  }

  return { results, overallP50, overallP95 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runApiBenchmark().catch(console.error);
}
