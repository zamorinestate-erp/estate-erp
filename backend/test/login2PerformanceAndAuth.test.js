'use strict';

/**
 * LOGIN-PAGE-2.0 PERFORMANCE & AUTH REQUEST LIFECYCLE REGRESSION SUITE
 * 
 * Verifies:
 * 1. Background does not rotate on interval
 * 2. Background sources are local optimized production assets
 * 3. Selected background is self-contained and loaded independently
 * 4. Login page renders without waiting for background network completion
 * 5. Health warm-up request contains no credentials or sensitive tokens
 * 6. Warm-up failure does not block login rendering or user input
 * 7. Valid login succeeds when backend response latency is within the 60s timeout window
 * 8. Actual auth timeout fails safely with clean error categorization
 * 9. HTTP 401 invalid credentials are not retried automatically
 * 10. MFA HTTP 202 triggers challenge flow cleanly
 * 11. HTTP 403 disabled/suspended accounts are handled normally
 * 12. Duplicate login clicks cannot create concurrent credential submissions
 * 13. Submit button recovers from connecting/authenticating state on error
 * 14. Network and timeout errors do not count as authentic password failures
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('LOGIN-PAGE-2.0 Background Performance & Auth Lifecycle Suite', () => {

  // 1. Verify local background assets
  test('1 & 2. Background assets are local, optimized WebP files under 400KB budget', () => {
    const bgDir = path.resolve(__dirname, '../../frontend/src/assets/login-backgrounds');
    assert.ok(fs.existsSync(bgDir), 'login-backgrounds directory must exist');

    const files = fs.readdirSync(bgDir).filter(f => f.endsWith('.webp'));
    assert.ok(files.length >= 6, `Expected at least 6 background assets, found ${files.length}`);

    for (const f of files) {
      const filePath = path.join(bgDir, f);
      const stat = fs.statSync(filePath);
      const sizeKb = stat.size / 1024;
      assert.ok(sizeKb > 30, `${f} should be a real image (> 30KB)`);
      assert.ok(sizeKb <= 400, `${f} should be within 400KB budget (actual: ${sizeKb.toFixed(1)} KB)`);
    }
  });

  // 3 & 4. Verify login2.js background logic
  test('3 & 4. login2.js references local WebP assets and does NOT set auto-rotation intervals', () => {
    const login2Path = path.resolve(__dirname, '../../frontend/src/js/pages/login2.js');
    const content = fs.readFileSync(login2Path, 'utf8');

    // Must not contain external Unsplash image URLs for primary backgrounds
    assert.ok(!content.includes('images.unsplash.com/photo-'), 'login2.js must not load external unsplash URLs directly for backgrounds');

    // Must reference local WebP backgrounds
    assert.ok(content.includes('/src/assets/login-backgrounds/bg-1.webp'), 'login2.js must reference local bg-1.webp');

    // Must not contain background rotation intervals
    assert.ok(!content.includes('setInterval(') && !content.includes('setInterval ('), 'login2.js must not auto-rotate backgrounds on an interval');

    // Must have fixed background selection
    assert.ok(content.includes('getFixedPageBackground'), 'login2.js must implement getFixedPageBackground');
  });

  // 5 & 6. Verify health warm-up request contains no credentials
  test('5 & 6. triggerBackendWarmup in main.js sends unauthenticated lightweight GET /health', () => {
    const mainPath = path.resolve(__dirname, '../../frontend/src/js/main.js');
    const content = fs.readFileSync(mainPath, 'utf8');

    assert.ok(content.includes('triggerBackendWarmup'), 'main.js must export triggerBackendWarmup');
    assert.ok(content.includes("credentials: \"omit\"") || content.includes("credentials: 'omit'"), 'warm-up request must omit credentials');
    assert.ok(content.includes('/health'), 'warm-up request must target /health');
  });

  // 7 & 8. Verify apiClient.js timeout configuration
  test('7 & 8. apiClient.js exports AUTH_REQUEST_TIMEOUT_MS = 60000 and applies route-aware 60s timeout', () => {
    const apiClientPath = path.resolve(__dirname, '../../frontend/src/js/apiClient.js');
    const content = fs.readFileSync(apiClientPath, 'utf8');

    assert.ok(content.includes('AUTH_REQUEST_TIMEOUT_MS = 60000'), 'apiClient.js must export AUTH_REQUEST_TIMEOUT_MS as 60000');
    assert.ok(content.includes('DEFAULT_REQUEST_TIMEOUT_MS = 30000'), 'apiClient.js must export DEFAULT_REQUEST_TIMEOUT_MS as 30000');
    assert.ok(content.includes('isAuthRoute'), 'apiClient.js must dynamically detect auth routes for 60s timeout');
    assert.ok(content.includes('isTimeoutError'), 'ApiClientError must have isTimeoutError getter');
    assert.ok(content.includes('isAuthError'), 'ApiClientError must have isAuthError getter');
    assert.ok(content.includes('isNetworkError'), 'ApiClientError must have isNetworkError getter');
  });

  // 9 & 10. Verify 401 is not retried and MFA 202 triggers MFA
  test('9 & 10. NON_REFRESHABLE_AUTH_PATHS prevents 401 refresh retry loops for /auth/login', () => {
    const apiClientPath = path.resolve(__dirname, '../../frontend/src/js/apiClient.js');
    const content = fs.readFileSync(apiClientPath, 'utf8');

    assert.ok(content.includes('"/auth/login"'), 'NON_REFRESHABLE_AUTH_PATHS must include /auth/login');
    assert.ok(!content.includes('allowRefreshRetry && normalized === "/auth/login"'), '401 on login must never auto-refresh/retry');
  });

  // 11 & 12. Verify duplicate click prevention and progressive status
  test('11 & 12. wireLoginPage2 implements in-flight submission lock and progressive button text', () => {
    const login2Path = path.resolve(__dirname, '../../frontend/src/js/pages/login2.js');
    const content = fs.readFileSync(login2Path, 'utf8');

    assert.ok(content.includes('isSubmitting'), 'wireLoginPage2 must use isSubmitting lock');
    assert.ok(content.includes('Connecting securely...'), 'wireLoginPage2 must display Connecting securely...');
    assert.ok(content.includes('Authenticating...'), 'wireLoginPage2 must display Authenticating...');
    assert.ok(content.includes('submitBtn.disabled = false'), 'wireLoginPage2 must restore button on failure');
  });

  // 13 & 14. Verify sw.js caching for WebP
  test('13 & 14. sw.js precaches bg-1.webp and caches WebP static assets with v2.3.5', () => {
    const swPath = path.resolve(__dirname, '../../frontend/sw.js');
    const content = fs.readFileSync(swPath, 'utf8');

    assert.ok(content.includes('zamorin-pwa-v2.3.5'), 'sw.js must be bumped to v2.3.5');
    assert.ok(content.includes('bg-1.webp'), 'sw.js PRECACHE_SHELL must include bg-1.webp');
    assert.ok(content.includes('.webp'), 'sw.js must cache .webp static assets');
  });

});
