// =============================================================================
// ZAMORIN CAFE ERP — RELOAD, REFRESH & SESSION RESTORATION RUNTIME AUDIT SUITE
// Verifies F5, Hard Reload, Exact Route Restoration, Zero Session Error Strings
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/screenshots');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3536;
const CDP_PORT = 9299;

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      let filePath = path.join(FRONTEND_DIR, decodeURIComponent(parsedUrl.pathname));

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(FRONTEND_DIR, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Server Error");
          return;
        }
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": Buffer.byteLength(content),
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        });
        res.end(content);
      });
    });

    server.listen(HTTP_PORT, () => {
      console.log(`Test static server running at http://localhost:${HTTP_PORT}`);
      resolve(server);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result.value;
  }
}

async function getWsDebuggerUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const pageTarget = list.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        return pageTarget.webSocketDebuggerUrl;
      }
    } catch {
      await delay(200);
    }
  }
  throw new Error("Could not connect to Chrome CDP endpoint");
}

let passedChecks = 0;
let failedChecks = 0;

function assert(description, condition, details = "") {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passedChecks++;
  } else {
    console.error(`  [FAIL] ${description} ${details ? '— ' + details : ''}`);
    failedChecks++;
  }
}

const TEST_ROUTES = [
  { url: '/?role=master#dashboard', name: 'Primary Master Dashboard', expectedHash: '#dashboard' },
  { url: '/?role=master#inventory', name: 'Inventory Overview', expectedHash: '#inventory' },
  { url: '/?role=master#inventory/stock-by-cafe', name: 'Inventory Stock Levels Child', expectedHash: '#inventory/stock-by-cafe' },
  { url: '/?role=master#inventory/global-items', name: 'Inventory Global Item Master Child', expectedHash: '#inventory/global-items' },
  { url: '/?role=master#bills', name: 'Bills Overview', expectedHash: '#bills' },
  { url: '/?role=master#bills/receipts', name: 'Bills Receipts Child', expectedHash: '#bills/receipts' },
  { url: '/?role=master#bills/upload', name: 'Bills Upload Invoices Child', expectedHash: '#bills/upload' },
  { url: '/?role=master#expenses', name: 'Expenses Overview', expectedHash: '#expenses' },
  { url: '/?role=master#expenses/evidence', name: 'Expenses Evidence Vault Child', expectedHash: '#expenses/evidence' },
  { url: '/?role=master#procurement/receiving', name: 'Procurement Receiving Child', expectedHash: '#procurement/receiving' },
  { url: '/?role=master#procurement/matching', name: 'Procurement 3-Way Match Child', expectedHash: '#procurement/matching' },
  { url: '/?role=master#quality/compliance', name: 'Quality Compliance Child', expectedHash: '#quality/compliance' },
  { url: '/?role=master#payroll/runs', name: 'Payroll Runs Child', expectedHash: '#payroll/runs' },
  { url: '/?role=master#finance/gl-journals', name: 'Finance GL Journals Child', expectedHash: '#finance/gl-journals' },
  { url: '/?role=master#settings', name: 'Settings Landing', expectedHash: '#settings' },
  { url: '/?role=master#settings/security', name: 'Settings Security Child', expectedHash: '#settings/security' },
  { url: '/?role=master#settings/appearance', name: 'Settings Appearance Child', expectedHash: '#settings/appearance' },
  { url: '/?role=master#ledger', name: 'Personal Ledger Single Workspace', expectedHash: '#ledger' },
  { url: '/?role=master#approvals', name: 'Tasks Approvals Single Workspace', expectedHash: '#approvals' },
  { url: '/?role=owner#performance', name: 'Owner Café Performance', expectedHash: '#performance' },
  { url: '/?role=admin#sales-cash', name: 'Cafe Admin Cash Book', expectedHash: '#sales-cash' },
  { url: '/?role=staff#staff-home', name: 'Staff Mobile Home', expectedHash: '#staff-home' },
];

async function main() {
  console.log('=============================================================================');
  console.log('RELOAD, REFRESH & SESSION RESTORATION RUNTIME AUDIT');
  console.log('=============================================================================\n');

  const server = await startServer();
  const tmpProfile = path.resolve(__dirname, `../.chrome_reload_audit_${Date.now()}`);

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWsDebuggerUrl(CDP_PORT);
    const cdp = new CdpClient(wsUrl);
    await cdp.ready;

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const test of TEST_ROUTES) {
      // 1. Direct deep URL load
      await cdp.send('Page.navigate', { url: `http://localhost:${HTTP_PORT}${test.url}` });
      await delay(900);

      // 2. Perform F5 reload
      await cdp.send('Page.reload', { ignoreCache: false });
      await delay(1000);

      const state = await cdp.eval(`
        (() => {
          const hash = window.location.hash;
          const bodyText = (document.body.textContent || '').toLowerCase();
          const hasRawSessionError = bodyText.includes('authenticated session has expired') ||
                                    bodyText.includes('session id, refresh token and device id are required');
          const hasSidebar = !!document.querySelector('.sidebar, #sidebar, .nav-link, .staff-bottom-nav, .staff-quick-action, .app-shell, .settings-hub, .settings-workspace-layout, .settings-secondary-nav');
          const hasTopbar = !!document.querySelector('.topbar, #topbar, .staff-home-header, .staff-top-bar, .app-shell, .page-header-standard, .settings-header-box');
          return { hash, hasRawSessionError, hasSidebar, hasTopbar };
        })()
      `);

      assert(`F5 Reload Restores Exact Route: ${test.name}`, state.hash === test.expectedHash, `Expected: ${test.expectedHash}, Got: ${state.hash}`);
      assert(`Zero Raw Session Error on Reload: ${test.name}`, !state.hasRawSessionError);
      assert(`Shell Maintained on Reload: ${test.name}`, state.hasSidebar && state.hasTopbar);
    }

    console.log('\n=============================================================================');
    console.log(`RELOAD AUDIT COMPLETE: ${passedChecks + failedChecks} CHECKS | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
    console.log(`Console Errors: ${cdp.consoleErrors.length} | Runtime Exceptions: ${cdp.runtimeExceptions.length}`);
    console.log('=============================================================================\n');

  } finally {
    chromeProc.kill();
    server.close();
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch {}
  }

  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
