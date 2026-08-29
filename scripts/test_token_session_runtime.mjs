#!/usr/bin/env node
// =============================================================================
// ZAMORIN CAFE ERP — AUTHENTICATION TOKEN & SESSION SECURITY RUNTIME SUITE
// =============================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3526;
const CDP_PORT = 9288;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(FRONTEND_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(HTTP_PORT, () => resolve(server));
  });
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.runtimeExceptions = [];

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.runtimeExceptions.push(msg.params);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error') {
          this.consoleErrors.push(msg.params);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function runTests() {
  console.log("===============================================================================");
  console.log("ZAMORIN CAFÉ ERP — AUTH TOKEN & SESSION SECURITY RUNTIME TEST SUITE");
  console.log("===============================================================================\n");

  const server = await startServer();
  console.log(`[HTTP] Static file server running on http://127.0.0.1:${HTTP_PORT}`);

  const userDataDir = path.resolve(__dirname, '../.chrome_token_sec_profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-background-networking',
    `--user-data-dir=${userDataDir}`,
    `http://127.0.0.1:${HTTP_PORT}/index.html?role=master`,
  ]);

  await delay(1500);

  let versionData;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      versionData = await resp.json();
      break;
    } catch {
      await delay(500);
    }
  }

  if (!versionData) {
    throw new Error("Could not connect to Chrome remote debugging port.");
  }

  const listResp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const targets = await listResp.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  console.log("[CDP] Connected to Headless Chrome session.\n");

  const results = [];

  async function test(name, fn) {
    process.stdout.write(`  • ${name.padEnd(70, '.')}`);
    try {
      await fn();
      console.log(" PASS");
      results.push({ name, status: "PASS" });
    } catch (err) {
      console.log(` FAIL (${err.message})`);
      results.push({ name, status: "FAIL", error: err.message });
    }
  }

  // Group 1: Storage Sanitization & Zero Client Refresh Token Holding
  console.log("1. CREDENTIAL STORAGE HYGIENE & OWASP COMPLIANCE");
  await test("Access token is stored in memory ONLY (never in localStorage/sessionStorage)", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, getAccessToken, clearAccessToken } = await import('/src/js/apiClient.js');
      clearAccessToken();
      setAccessToken("test_access_jwt_token_123");
      const inMemory = getAccessToken();
      const inLocalStorage = globalThis.localStorage?.getItem("zamorin-access-token");
      const inSessionStorage = globalThis.sessionStorage?.getItem("zamorin-access-token");
      clearAccessToken();
      return { inMemory, inLocalStorage, inSessionStorage };
    })()`);
    if (res.inMemory !== "test_access_jwt_token_123") throw new Error(`Memory token mismatch: ${res.inMemory}`);
    if (res.inLocalStorage !== null) throw new Error(`Access token leaked into localStorage!`);
    if (res.inSessionStorage !== null) throw new Error(`Access token leaked into sessionStorage!`);
  });

  await test("Refresh token is NEVER held or returned to JavaScript (getRefreshToken() === null)", async () => {
    const res = await cdp.eval(`(async () => {
      const { setRefreshToken, getRefreshToken, clearRefreshToken } = await import('/src/js/apiClient.js');
      setRefreshToken("some_token");
      const token = getRefreshToken();
      const inLocalStorage = globalThis.localStorage?.getItem("zamorin-refresh-token");
      const inSessionStorage = globalThis.sessionStorage?.getItem("zamorin-refresh-token");
      clearRefreshToken();
      return { token, inLocalStorage, inSessionStorage };
    })()`);
    if (res.token !== null) throw new Error(`getRefreshToken returned non-null: ${res.token}`);
    if (res.inLocalStorage !== null) throw new Error(`Refresh token saved to localStorage!`);
    if (res.inSessionStorage !== null) throw new Error(`Refresh token saved to sessionStorage!`);
  });

  await test("clearAllAuthTokens() purges memory and cleans storage keys", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, clearAllAuthTokens, getAccessToken } = await import('/src/js/apiClient.js');
      setAccessToken("tok1");
      clearAllAuthTokens();
      return {
        tok: getAccessToken(),
        localAccess: globalThis.localStorage?.getItem("zamorin-access-token"),
        localRefresh: globalThis.localStorage?.getItem("zamorin-refresh-token"),
      };
    })()`);
    if (res.tok !== null || res.localAccess !== null || res.localRefresh !== null) {
      throw new Error(`clearAllAuthTokens did not clean all: ${JSON.stringify(res)}`);
    }
  });

  // Group 2: Header Attachment & Poison Prevention
  console.log("\n2. HEADER ATTACHMENT & POISON PREVENTION");
  await test("Authorization header is NOT set when access token is null/empty", async () => {
    const res = await cdp.eval(`(async () => {
      const { clearAccessToken, performRequest } = await import('/src/js/apiClient.js');
      clearAccessToken();
      let capturedHeaders = null;
      const originalFetch = window.fetch;
      window.fetch = async (url, init) => {
        capturedHeaders = init?.headers;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        await performRequest('/test-no-auth');
        return capturedHeaders;
      } finally {
        window.fetch = originalFetch;
      }
    })()`);
    if (res?.Authorization) throw new Error(`Authorization header was unexpectedly set: ${res.Authorization}`);
    if (!res?.['x-device-id']) throw new Error(`x-device-id header missing`);
  });

  await test("Authorization: Bearer <token> is attached cleanly when token is present", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, performRequest, clearAccessToken } = await import('/src/js/apiClient.js');
      setAccessToken("valid_sample_jwt_987");
      let capturedHeaders = null;
      const originalFetch = window.fetch;
      window.fetch = async (url, init) => {
        capturedHeaders = init?.headers;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        await performRequest('/test-with-auth');
        return capturedHeaders;
      } finally {
        window.fetch = originalFetch;
        clearAccessToken();
      }
    })()`);
    if (res?.Authorization !== "Bearer valid_sample_jwt_987") {
      throw new Error(`Authorization header mismatch: ${res?.Authorization}`);
    }
  });

  await test("Rejects toxic token values ('undefined', 'null', whitespace) — zero Bearer undefined", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, getAccessToken, clearAccessToken } = await import('/src/js/apiClient.js');
      setAccessToken("undefined");
      const v1 = getAccessToken();
      setAccessToken("null");
      const v2 = getAccessToken();
      setAccessToken("   ");
      const v3 = getAccessToken();
      clearAccessToken();
      return { v1, v2, v3 };
    })()`);
    if (res.v1 !== null) throw new Error(`'undefined' was saved as token`);
    if (res.v2 !== null) throw new Error(`'null' was saved as token`);
    if (res.v3 !== null) throw new Error(`whitespace was saved as token`);
  });

  await test("Preserves Authorization and x-device-id across custom header merges", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, performRequest, clearAccessToken } = await import('/src/js/apiClient.js');
      setAccessToken("merge_test_jwt");
      let capturedHeaders = null;
      const originalFetch = window.fetch;
      window.fetch = async (url, init) => {
        capturedHeaders = init?.headers;
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };
      try {
        await performRequest('/test-custom-headers', {
          headers: {
            'X-Custom-Report-Scope': 'ALL_CAFES',
            'X-Custom-Trace-Id': 'trace-1234',
          },
        });
        return capturedHeaders;
      } finally {
        window.fetch = originalFetch;
        clearAccessToken();
      }
    })()`);
    if (res?.Authorization !== "Bearer merge_test_jwt") throw new Error(`Authorization lost in merge: ${res?.Authorization}`);
    if (!res?.['x-device-id']) throw new Error(`x-device-id lost in merge`);
    if (res?.['X-Custom-Report-Scope'] !== "ALL_CAFES") throw new Error(`Custom header lost`);
  });

  // Group 3: Single-Flight Refresh with HttpOnly Cookies (No JS refresh token body)
  console.log("\n3. SINGLE-FLIGHT REFRESH & HTTPONLY COOKIE TRANSPORT");
  await test("Single-flight refresh executes /auth/refresh using cookies and updates access token", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, requestJson, clearAllAuthTokens } = await import('/src/js/apiClient.js');
      setAccessToken("stale_jwt");

      let refreshCalls = 0;
      let refreshRequestBody = null;
      let dataCalls = 0;
      const originalFetch = window.fetch;

      window.fetch = async (url, init) => {
        if (url.includes('/auth/refresh')) {
          refreshCalls++;
          refreshRequestBody = init?.body;
          await new Promise(r => setTimeout(r, 40));
          return new Response(JSON.stringify({
            success: true,
            data: {
              accessToken: "fresh_new_jwt_777",
              session: { sessionId: "SS-001" },
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        dataCalls++;
        const authHeader = init?.headers?.Authorization || init?.headers?.authorization;
        if (authHeader === 'Bearer stale_jwt') {
          return new Response(JSON.stringify({
            success: false,
            error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Token expired.' },
          }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          success: true,
          data: { result: 'success_with_token_' + authHeader },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };

      try {
        const [reqA, reqB, reqC] = await Promise.all([
          requestJson('GET', '/api/test-a', { bypassCache: true }),
          requestJson('GET', '/api/test-b', { bypassCache: true }),
          requestJson('GET', '/api/test-c', { bypassCache: true }),
        ]);

        return {
          refreshCalls,
          refreshRequestBody,
          dataCalls,
          reqA: reqA?.data?.result,
          reqB: reqB?.data?.result,
          reqC: reqC?.data?.result,
        };
      } finally {
        window.fetch = originalFetch;
        clearAllAuthTokens();
      }
    })()`);

    if (res.refreshCalls !== 1) {
      throw new Error(`Expected exactly 1 refresh call, got ${res.refreshCalls}`);
    }
    if (res.refreshRequestBody) {
      throw new Error(`Refresh request body should be empty/undefined for cookie transport: ${res.refreshRequestBody}`);
    }
    if (!res.reqA?.includes("fresh_new_jwt_777") || !res.reqB?.includes("fresh_new_jwt_777")) {
      throw new Error(`Requests did not resume with fresh token: ${JSON.stringify(res)}`);
    }
  });

  await test("Failed refresh transitions state to EXPIRED and cleans memory without loop", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, requestJson, getSessionState, SessionState, getAccessToken, clearAllAuthTokens } = await import('/src/js/apiClient.js');
      setAccessToken("invalid_jwt");

      let refreshAttempts = 0;
      const originalFetch = window.fetch;

      window.fetch = async (url, init) => {
        if (url.includes('/auth/refresh')) {
          refreshAttempts++;
          return new Response(JSON.stringify({
            success: false,
            error: { code: 'INVALID_REFRESH_SESSION', message: 'Session revoked.' },
          }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Token expired.' },
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      };

      let errorThrown = null;
      try {
        await requestJson('GET', '/api/test-fail', { bypassCache: true });
      } catch (err) {
        errorThrown = err;
      } finally {
        window.fetch = originalFetch;
      }

      const finalState = getSessionState();
      const remainingToken = getAccessToken();
      clearAllAuthTokens();

      return {
        refreshAttempts,
        errorThrownCode: errorThrown?.code,
        errorUserMsg: errorThrown?.userMessage,
        finalState,
        remainingToken,
      };
    })()`);

    if (res.refreshAttempts !== 1) throw new Error(`Refresh called ${res.refreshAttempts} times instead of 1`);
    if (res.finalState !== "EXPIRED") throw new Error(`SessionState not EXPIRED: ${res.finalState}`);
    if (res.remainingToken !== null) throw new Error(`Tokens not cleared after failed refresh`);
    if (!res.errorUserMsg?.includes("session could not be validated") && !res.errorUserMsg?.includes("sign in again")) {
      throw new Error(`Unexpected user error message: ${res.errorUserMsg}`);
    }
  });

  // Group 4: 401 vs 403 Distinct Separation
  console.log("\n4. 401 VS 403 STATUS SEPARATION");
  await test("HTTP 403 does NOT trigger /auth/refresh and does NOT expire session", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, setSessionState, SessionState, requestJson, getSessionState, clearAllAuthTokens } = await import('/src/js/apiClient.js');
      setSessionState(SessionState.AUTHENTICATED);
      setAccessToken("valid_user_jwt");

      let refreshTriggered = false;
      const originalFetch = window.fetch;

      window.fetch = async (url) => {
        if (url.includes('/auth/refresh')) {
          refreshTriggered = true;
        }
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Permission denied.' },
        }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      };

      let errorThrown = null;
      try {
        await requestJson('GET', '/api/admin-only-path', { bypassCache: true });
      } catch (err) {
        errorThrown = err;
      } finally {
        window.fetch = originalFetch;
        clearAllAuthTokens();
      }

      return {
        refreshTriggered,
        sessionState: getSessionState(),
        errorCode: errorThrown?.code,
        userMsg: errorThrown?.userMessage,
      };
    })()`);

    if (res.refreshTriggered) throw new Error(`403 incorrectly triggered /auth/refresh`);
    if (res.sessionState === "EXPIRED") throw new Error(`403 incorrectly changed session state to EXPIRED`);
    if (res.errorCode !== "PERMISSION_DENIED") throw new Error(`Expected PERMISSION_DENIED, got ${res.errorCode}`);
    if (!res.userMsg?.includes("permission")) throw new Error(`Unexpected user message: ${res.userMsg}`);
  });

  // Group 5: Multi-User Session Isolation
  console.log("\n5. MULTI-USER ISOLATION & LOGOUT CLEANUP");
  await test("User A session credentials do NOT survive User B login", async () => {
    const res = await cdp.eval(`(async () => {
      const { setAccessToken, getAccessToken, clearAllAuthTokens } = await import('/src/js/apiClient.js');
      // User A signs in
      setAccessToken("user_a_token_111");
      const userAToken = getAccessToken();

      // User A signs out
      clearAllAuthTokens();
      const loggedOutToken = getAccessToken();

      // User B signs in
      setAccessToken("user_b_token_222");
      const userBToken = getAccessToken();

      clearAllAuthTokens();

      return { userAToken, loggedOutToken, userBToken };
    })()`);

    if (res.userAToken !== "user_a_token_111") throw new Error(`User A token mismatch`);
    if (res.loggedOutToken !== null) throw new Error(`Logged out token not null: ${res.loggedOutToken}`);
    if (res.userBToken !== "user_b_token_222") throw new Error(`User B token mismatch`);
  });

  // Group 6: Error Message Normalization
  console.log("\n6. ERROR MESSAGE NORMALIZATION & PRIVACY");
  await test("mapErrorToUserMessage shields users from raw technical token terms", async () => {
    const res = await cdp.eval(`(async () => {
      const { mapErrorToUserMessage } = await import('/src/js/apiClient.js');
      const codes = [
        'AUTH_TOKEN_EXPIRED',
        'AUTH_TOKEN_INVALID',
        'AUTH_TOKEN_NOT_ACTIVE',
        'AUTH_SESSION_REVOKED',
        'INVALID_REFRESH_SESSION',
        'REFRESH_SESSION_REQUIRED',
        'AUTHENTICATION_REQUIRED',
        'AUTH_SESSION_INVALID',
      ];
      const rawMessages = [
        'jwt expired',
        'jwt malformed',
        'invalid signature',
        'JsonWebTokenError: jwt active',
        'TokenExpiredError: expired at 1700000',
        'Bearer undefined',
        'Bearer null',
      ];

      const mappedFromCodes = codes.map(c => mapErrorToUserMessage(c, 401, 'raw tech details'));
      const mappedFromRaw = rawMessages.map(m => mapErrorToUserMessage('GENERIC_AUTH_FAIL', 401, m));

      return { mappedFromCodes, mappedFromRaw };
    })()`);

    for (const msg of [...res.mappedFromCodes, ...res.mappedFromRaw]) {
      if (/jwt|TokenExpiredError|JsonWebTokenError|Bearer undefined|signature/i.test(msg)) {
        throw new Error(`Raw technical term leaked into user message: "${msg}"`);
      }
    }
  });

  // Cleanup
  cdp.close();
  chromeProc.kill('SIGTERM');
  server.close();

  console.log("\n===============================================================================");
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`SUMMARY: Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
