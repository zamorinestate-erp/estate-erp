// =============================================================================
// ZAMORIN CAFE ERP — FULL RELOAD & SPA INTEGRITY AUDIT
// scripts/audit_navigation_reload_performance.mjs
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3538;
const CDP_PORT = 9296;

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
    this.frameNavigations = [];

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
      } else if (msg.method === 'Page.frameNavigated') {
        this.frameNavigations.push(msg.params.frame);
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
}

export async function runNavigationReloadAudit() {
  console.log('=============================================================================');
  console.log('ZAMORIN CAFÉ ERP — ZERO FULL DOCUMENT RELOAD AUDIT');
  console.log('=============================================================================\n');

  const server = await startServer();
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1600,1000',
    'about:blank',
  ]);

  await delay(1500);

  let cdp = null;
  for (let i = 0; i < 20; i++) {
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
      await delay(200);
    }
  }

  if (!cdp) {
    console.error('Failed to connect to Chrome via CDP.');
    chrome.kill();
    server.close();
    process.exit(1);
  }

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const initUrl = `http://localhost:${HTTP_PORT}/?role=master#dashboard`;
  await cdp.send('Page.navigate', { url: initUrl });
  await delay(1500);

  // Set a sentinel on window to detect full page remount/refresh
  await cdp.eval(`window.__zamorinSpaSentinel = "PERSISTENT_SHELL_INITIALIZED_" + Date.now();`);

  const testNavigations = [
    'inventory',
    'inventory/stock-levels',
    'procurement',
    'reports',
    'finance',
    'payroll',
    'employees',
    'customers',
    'vendors',
    'passbook',
    'settings',
    'settings/appearance',
    'trash',
    'dashboard',
  ];

  let unintendedReloads = 0;

  for (const dest of testNavigations) {
    // Click or route via SPA
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('button[data-route="${dest}"]');
        if (btn) {
          btn.click();
        } else {
          window.location.hash = "#${dest}";
        }
      })()
    `);

    await delay(300);

    const sentinelVal = await cdp.eval(`window.__zamorinSpaSentinel`);
    const isSentinelIntact = typeof sentinelVal === 'string' && sentinelVal.startsWith('PERSISTENT_SHELL_INITIALIZED_');

    if (!isSentinelIntact) {
      unintendedReloads++;
      console.error(`❌ FULL DOCUMENT RELOAD DETECTED navigating to #${dest}`);
      await cdp.eval(`window.__zamorinSpaSentinel = "PERSISTENT_SHELL_INITIALIZED_" + Date.now();`);
    } else {
      console.log(`[PASS] SPA Navigation to #${dest.padEnd(25)} (Shell Maintained: 100%)`);
    }
  }

  console.log('\n=============================================================================');
  console.log(`TOTAL UNINTENDED DOCUMENT RELOADS: ${unintendedReloads}`);
  console.log(`TARGET: 0 Full Reloads on Internal Navigation`);
  console.log('=============================================================================\n');

  try {
    await cdp.send('Browser.close');
  } catch {}
  chrome.kill();
  server.close();

  return { unintendedReloads };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runNavigationReloadAudit().catch(console.error);
}
