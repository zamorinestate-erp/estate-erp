// =============================================================================
// ZAMORIN CAFÉ ERP — APPLICATION-WIDE SUPPORTING FILE INTEGRATION
// BROWSER RUNTIME SUPPORTING FILE & RESOURCE HEALTH AUDIT
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3540;
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

const CANONICAL_REPRESENTATIVE_ROUTES = [
  // Primary Master routes & core modules
  { role: "master", route: "dashboard" },
  { role: "master", route: "pos" },
  { role: "master", route: "attendance" },
  { role: "master", route: "inventory" },
  { role: "master", route: "procurement" },
  { role: "master", route: "assets" },
  { role: "master", route: "quality" },
  { role: "master", route: "employees" },
  { role: "master", route: "payroll" },
  { role: "master", route: "bills" },
  { role: "master", route: "expenses" },
  { role: "master", route: "finance" },
  { role: "master", route: "passbook" },
  { role: "master", route: "ledger" },
  { role: "master", route: "customers" },
  { role: "master", route: "menu" },
  { role: "master", route: "vendors" },
  { role: "master", route: "revenue-share" },
  { role: "master", route: "reports" },
  { role: "master", route: "tasks" },
  { role: "master", route: "admin" },
  { role: "master", route: "cafe-ops-devices" },
  { role: "master", route: "settings" },

  // Owner routes
  { role: "owner", route: "dashboard" },
  { role: "owner", route: "performance" },
  { role: "owner", route: "finance" },
  { role: "owner", route: "ledger" },

  // Cafe Admin routes
  { role: "cafe_admin", route: "dashboard" },
  { role: "cafe_admin", route: "pos" },
  { role: "cafe_admin", route: "sales-cash" },
  { role: "cafe_admin", route: "attendance" },

  // Staff routes
  { role: "staff", route: "staff-home" },
  { role: "staff", route: "announcements" },
  { role: "staff", route: "staff-attendance" },
  { role: "staff", route: "staff-leave" }
];

async function runSupportingFilesBrowserAudit() {
  console.log('=============================================================================');
  console.log('   ZAMORIN CAFÉ ERP — BROWSER RUNTIME SUPPORTING FILE HEALTH AUDIT');
  console.log('=============================================================================\n');

  const server = await startServer();
  const tmpUserDataDir = path.join(FRONTEND_DIR, '../.tmp_chrome_support_audit');
  if (fs.existsSync(tmpUserDataDir)) fs.rmSync(tmpUserDataDir, { recursive: true, force: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpUserDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,900',
    'about:blank'
  ]);

  let cdp = null;
  try {
    await delay(1800);

    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await res.json();
        const pageTarget = list.find((t) => t.type === 'page');
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
          await cdp.ready;
          break;
        }
      } catch {
        await delay(300);
      }
    }
    assert.ok(cdp, 'Chrome CDP must be ready');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    let totalTested = 0;
    let passedCount = 0;
    let lastRole = '';
    const issues = [];

    for (const item of CANONICAL_REPRESENTATIVE_ROUTES) {
      totalTested++;
      const isRoleChange = item.role !== lastRole;
      lastRole = item.role;

      const url = `http://localhost:${HTTP_PORT}/?role=${item.role}#${item.route}`;
      await cdp.send('Page.navigate', { url });
      await delay(isRoleChange ? 2400 : 500);

      let checkResult = null;
      for (let r = 0; r < 6; r++) {
        try {
          checkResult = await cdp.eval(`
            (() => {
              const text = (document.body ? document.body.textContent : '') || '';
              const hasErrorState = !!document.querySelector('.module-error-card, .error-card, .alert-error');
              const hasStuckSpinner = !!document.querySelector('.spinner, .loading-spinner') && document.querySelectorAll('.card, table, tr, h1, h2, h3').length <= 1;
              const hasUnableToLoad = text.includes('Unable to Load') || text.includes('Failed to load') || text.includes('Error Loading') || text.includes('Network error');
              const mainEl = document.querySelector('#page-content') || document.querySelector('#main-content') || document.querySelector('#app') || document.querySelector('.staff-portal') || document.body;
              const len = (mainEl ? mainEl.textContent.trim().length : 0) || text.length;
              const hasBlankPage = len < 10;

              return {
                hasErrorState,
                hasStuckSpinner,
                hasUnableToLoad,
                hasBlankPage,
                title: document.querySelector('h1, h2, h3, .page-title')?.textContent.trim() || '',
                contentLength: len,
              };
            })()
          `);
        } catch (_) {}
        if (checkResult && !checkResult.hasBlankPage && checkResult.contentLength > 10) break;
        await delay(400);
      }

      const isClean = checkResult && !checkResult.hasErrorState && !checkResult.hasStuckSpinner && !checkResult.hasUnableToLoad && !checkResult.hasBlankPage && checkResult.contentLength > 10;

      if (isClean) {
        passedCount++;
        console.log(`✔ [PASS] ${item.role} -> #${item.route} (${checkResult.contentLength} chars)`);
      } else {
        console.error(`✖ [FAIL] ${item.role} -> #${item.route}`, checkResult);
        issues.push({ item, checkResult });
      }
    }

    console.log(`\n▶ Total Representative Modules Verified in Browser: ${totalTested}`);
    console.log(`▶ Passed: ${passedCount} / ${totalTested}`);
    console.log(`▶ Failed: ${issues.length}\n`);

    assert.strictEqual(issues.length, 0, 'RESOURCE_LOAD_FAILURES must equal 0');
    console.log('✅ BROWSER RUNTIME SUPPORTING FILE AUDIT PASSED — All routes load cleanly without errors.\n');

  } finally {
    if (cdp) {
      try { await cdp.send('Browser.close'); } catch {}
      cdp.close();
    }
    chromeProc.kill();
    server.close();
    await delay(300);
    if (fs.existsSync(tmpUserDataDir)) {
      try { fs.rmSync(tmpUserDataDir, { recursive: true, force: true }); } catch {}
    }
  }
}

runSupportingFilesBrowserAudit().catch(err => {
  console.error('\n❌ BROWSER RUNTIME AUDIT FAILED:');
  console.error(err);
  process.exit(1);
});
