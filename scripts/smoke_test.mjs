#!/usr/bin/env node
/**
 * Zamorin Café ERP — Executable Post-Deployment / Non-Production Smoke Tester
 *
 * Runs automated non-destructive health, readiness, header, and probe verification
 * against a designated non-production environment.
 */

import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

const targetBaseUrl = process.env.TARGET_URL || 'http://127.0.0.1:4000';

function makeRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Zamorin-Smoke-Tester/1.0',
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch (_) {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed || body,
            rawBody: body,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Connection timed out after 5000ms: ${urlStr}`));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

export async function runSmokeTests(baseUrl = targetBaseUrl) {
  const checks = [];

  // Check 1: GET /health
  try {
    const t0 = Date.now();
    const res = await makeRequest(`${baseUrl}/health`);
    const duration = Date.now() - t0;
    const isOk = res.statusCode === 200 && (res.body?.status === 'ok' || res.body?.success === true);
    const hasCorrelation = Boolean(res.headers['x-correlation-id']);

    checks.push({
      name: 'Root Process Health (/health)',
      passed: isOk,
      statusCode: res.statusCode,
      durationMs: duration,
      hasCorrelationHeader: hasCorrelation,
      details: isOk ? 'Process responsive' : 'Unexpected status or payload',
    });
  } catch (err) {
    checks.push({
      name: 'Root Process Health (/health)',
      passed: false,
      error: err.message,
      details: 'Failed to connect to endpoint',
    });
  }

  // Check 2: GET /readiness
  try {
    const t0 = Date.now();
    const res = await makeRequest(`${baseUrl}/readiness`);
    const duration = Date.now() - t0;
    const isReadyOrPlanned503 = res.statusCode === 200 || res.statusCode === 503;
    const hasCorrelation = Boolean(res.headers['x-correlation-id']);

    checks.push({
      name: 'Operation-Critical Readiness (/readiness)',
      passed: isReadyOrPlanned503,
      statusCode: res.statusCode,
      durationMs: duration,
      hasCorrelationHeader: hasCorrelation,
      status: res.body?.status || 'unknown',
      details: `Returned HTTP ${res.statusCode} (${res.body?.status || 'unparsed'})`,
    });
  } catch (err) {
    checks.push({
      name: 'Operation-Critical Readiness (/readiness)',
      passed: false,
      error: err.message,
      details: 'Failed to connect to endpoint',
    });
  }

  // Check 3: GET /api/v1/health
  try {
    const t0 = Date.now();
    const res = await makeRequest(`${baseUrl}/api/v1/health`);
    const duration = Date.now() - t0;
    const isOk = res.statusCode === 200;

    checks.push({
      name: 'API v1 Canonical Health (/api/v1/health)',
      passed: isOk,
      statusCode: res.statusCode,
      durationMs: duration,
      details: isOk ? 'API v1 healthy' : 'Unexpected status',
    });
  } catch (err) {
    checks.push({
      name: 'API v1 Canonical Health (/api/v1/health)',
      passed: false,
      error: err.message,
      details: 'Failed to connect to endpoint',
    });
  }

  // Check 4: Correlation ID reflection with custom header
  try {
    const customCorrelationId = `smoke-test-${Date.now()}`;
    const res = await makeRequest(`${baseUrl}/health`, {
      headers: { 'x-correlation-id': customCorrelationId },
    });
    const headerEchoed = res.headers['x-correlation-id'] === customCorrelationId;

    checks.push({
      name: 'X-Correlation-ID Header Passthrough & Reflection',
      passed: headerEchoed,
      details: headerEchoed ? 'Correlation ID preserved end-to-end' : 'Header not reflected',
    });
  } catch (err) {
    checks.push({
      name: 'X-Correlation-ID Header Passthrough & Reflection',
      passed: false,
      error: err.message,
      details: 'Request failed',
    });
  }

  const allPassed = checks.every((c) => c.passed);
  return {
    timestamp: new Date().toISOString(),
    targetUrl: baseUrl,
    allPassed,
    checks,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`[SMOKE_TEST] Initiating smoke verification against: ${targetBaseUrl}`);
  runSmokeTests()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.allPassed) {
        console.warn('\n[SMOKE WARNING] One or more checks did not pass (ensure test server is running).');
      } else {
        console.log('\n[SMOKE SUCCESS] All endpoint checks verified successfully.');
      }
    })
    .catch((err) => {
      console.error('[SMOKE ERROR]', err);
      process.exit(1);
    });
}
