// =============================================================================
// ZAMORIN CAFE ERP — MAIN-THREAD LONG TASK AUDIT (>50ms)
// scripts/audit_long_tasks.mjs
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3537;
const CDP_PORT = 9297;

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
}

export async function runLongTaskAudit() {
  console.log('=============================================================================');
  console.log('ZAMORIN CAFÉ ERP — MAIN-THREAD LONG TASK AUDIT (>50ms)');
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

  const testUrl = `http://localhost:${HTTP_PORT}/?role=master#dashboard`;
  await cdp.send('Page.navigate', { url: testUrl });
  await delay(1200);

  // Install long task recorder
  await cdp.eval(`
    window.__longTasks = [];
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              window.__longTasks.push({
                name: entry.name,
                entryType: entry.entryType,
                startTime: Math.round(entry.startTime),
                duration: Math.round(entry.duration),
                attribution: entry.attribution ? entry.attribution.map(a => a.name || a.containerType) : [],
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        window.__longTaskObserver = observer;
      } catch (e) {
        console.warn('Long task observer error:', e);
      }
    }
  `);

  const interactionRoutes = [
    'inventory',
    'inventory/stock-levels',
    'reports',
    'reports/financial',
    'payroll',
    'finance',
    'passbook',
    'passbook/accounts',
    'customers',
    'vendors',
    'settings',
    'settings/appearance',
    'settings/security',
    'trash',
  ];

  const results = [];
  let totalLongTasks = 0;
  let maxLongTaskMs = 0;

  for (const route of interactionRoutes) {
    const beforeCount = await cdp.eval(`(window.__longTasks || []).length`);
    const t0 = performance.now();

    // Trigger in-page SPA navigation
    await cdp.eval(`
      (() => {
        if (typeof window.zamorinNavigate === 'function') {
          window.zamorinNavigate("${route}");
        } else {
          window.location.hash = "#${route}";
        }
      })()
    `);

    await delay(350);
    const duration = performance.now() - t0;

    const afterTasks = await cdp.eval(`(window.__longTasks || []).slice(${beforeCount})`);
    const count = (afterTasks || []).length;
    totalLongTasks += count;

    const routeMax = count > 0 ? Math.max(...afterTasks.map(t => t.duration)) : 0;
    if (routeMax > maxLongTaskMs) maxLongTaskMs = routeMax;

    const pass = count === 0;
    results.push({ route, duration: Math.round(duration), longTasks: afterTasks || [], pass });

    console.log(
      `[${pass ? 'PASS' : 'WARN'}] Route: #${route.padEnd(26)} | Nav Time: ${String(Math.round(duration)).padStart(4)}ms | Long Tasks (>50ms): ${count} ${count > 0 ? `(Max: ${routeMax}ms)` : ''}`
    );
    if (count > 0) {
      afterTasks.forEach(t => console.log(`       ⚠️ Long Task: ${t.duration}ms at ${t.startTime}ms`));
    }
  }

  console.log('\n=============================================================================');
  console.log(`TOTAL INTERACTION LONG TASKS (>50ms): ${totalLongTasks}`);
  console.log(`LONGEST TASK DURATION: ${maxLongTaskMs}ms`);
  console.log(`TARGET: 0 Avoidable Long Tasks (>50ms) during normal navigation`);
  console.log('=============================================================================\n');

  try {
    await cdp.send('Browser.close');
  } catch {}
  chrome.kill();
  server.close();

  return { totalLongTasks, maxLongTaskMs, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLongTaskAudit().catch(console.error);
}
