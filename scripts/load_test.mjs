#!/usr/bin/env node
/**
 * Zamorin Café ERP — Executable Lightweight Load & Concurrency Benchmark Runner
 *
 * Runs non-destructive, configurable concurrent HTTP benchmark routines
 * against safe read and health endpoints in non-production test environments.
 */

import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

const targetBaseUrl = process.env.TARGET_URL || 'http://127.0.0.1:4000';
const concurrency = Number.parseInt(process.env.USERS || '5', 10);
const durationSeconds = Number.parseInt(process.env.DURATION_SEC || '3', 10);

const SAFE_SCENARIOS = [
  { name: 'Process Health Probe', path: '/health' },
  { name: 'Readiness Dependency Probe', path: '/readiness' },
  { name: 'API v1 Canonical Health', path: '/api/v1/health' },
];

function requestSingle(urlStr) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(
      url,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Zamorin-LoadRunner/1.0' },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const latency = performance.now() - t0;
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            latency,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        ok: false,
        error: err.message,
        latency: performance.now() - t0,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        error: 'TIMEOUT',
        latency: performance.now() - t0,
      });
    });
  });
}

export async function runLoadBenchmark({
  baseUrl = targetBaseUrl,
  users = concurrency,
  durationSec = durationSeconds,
} = {}) {
  const deadline = Date.now() + durationSec * 1000;
  const latencies = [];
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const scenario = SAFE_SCENARIOS[totalRequests % SAFE_SCENARIOS.length];
      totalRequests++;
      const result = await requestSingle(`${baseUrl}${scenario.path}`);
      latencies.push(result.latency);
      if (result.ok) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < users; i++) {
    workers.push(worker());
  }

  const startTime = Date.now();
  await Promise.all(workers);
  const actualDurationMs = Date.now() - startTime;
  const actualDurationSec = actualDurationMs / 1000;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const rps = actualDurationSec > 0 ? Math.round(totalRequests / actualDurationSec) : 0;

  return {
    timestamp: new Date().toISOString(),
    targetUrl: baseUrl,
    concurrency: users,
    targetDurationSec: durationSec,
    actualDurationSec: Number(actualDurationSec.toFixed(2)),
    totalRequests,
    successfulRequests,
    failedRequests,
    requestsPerSecond: rps,
    latencyMs: {
      min: Number(min.toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      max: Number(max.toFixed(2)),
    },
    scenariosTested: SAFE_SCENARIOS.map((s) => s.path),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[LOAD_TEST] Starting load benchmark:`);
  console.log(`  Target:       ${targetBaseUrl}`);
  console.log(`  Concurrency:  ${concurrency} virtual workers`);
  console.log(`  Duration:     ${durationSeconds} seconds\n`);

  runLoadBenchmark()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log(`\n[LOAD_TEST COMPLETE] Executed ${result.totalRequests} requests (${result.requestsPerSecond} req/sec).`);
    })
    .catch((err) => {
      console.error('[LOAD_TEST ERROR]', err);
      process.exit(1);
    });
}
