// =============================================================================
// ZAMORIN CAFE ERP — DUPLICATE READS & CONCURRENT REQUEST AUDIT
// scripts/audit_duplicate_reads.mjs
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const BACKEND_DIR = path.resolve(__dirname, '../backend');
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
    this.networkRequests = [];

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
      } else if (msg.method === 'Network.requestWillBeSent') {
        this.networkRequests.push({
          requestId: msg.params.requestId,
          url: msg.params.request.url,
          method: msg.params.request.method,
          timestamp: msg.params.timestamp,
          wallTime: msg.params.wallTime,
          type: msg.params.type,
        });
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

export async function runDuplicateReadsAudit() {
  console.log('=============================================================================');
  console.log('ZAMORIN CAFÉ ERP — DUPLICATE READS & CONCURRENT REQUEST AUDIT');
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
  await cdp.send('Network.enable');
  await cdp.send('Runtime.enable');

  const journeys = [
    { role: 'master', route: 'dashboard' },
    { role: 'master', route: 'inventory' },
    { role: 'master', route: 'inventory/stock-levels' },
    { role: 'master', route: 'reports' },
    { role: 'master', route: 'passbook' },
    { role: 'master', route: 'settings' },
    { role: 'owner', route: 'dashboard' },
    { role: 'owner', route: 'ledger' },
    { role: 'admin', route: 'dashboard' },
    { role: 'admin', route: 'pos' },
    { role: 'staff', route: 'staff-home' },
  ];

  const auditReport = [];
  let totalDuplicates = 0;

  for (const j of journeys) {
    const startIndex = cdp.networkRequests.length;
    const url = `http://localhost:${HTTP_PORT}/?role=${j.role}#${j.route}`;

    await cdp.send('Page.navigate', { url });
    await delay(1200);

    const stepRequests = cdp.networkRequests.slice(startIndex).filter(r => r.url.includes('/api/v1/'));
    const getRequests = stepRequests.filter(r => r.method === 'GET');

    // Check for duplicate GET urls within this step
    const urlCounts = {};
    for (const req of getRequests) {
      const cleanUrl = req.url.split('?')[0];
      urlCounts[cleanUrl] = (urlCounts[cleanUrl] || 0) + 1;
    }

    const duplicates = Object.entries(urlCounts).filter(([_, count]) => count > 1);
    const stepDuplicateCount = duplicates.reduce((sum, [_, count]) => sum + (count - 1), 0);
    totalDuplicates += stepDuplicateCount;

    auditReport.push({
      role: j.role,
      route: j.route,
      totalApiRequests: stepRequests.length,
      getRequests: getRequests.length,
      duplicateCount: stepDuplicateCount,
      duplicates: duplicates.map(([u, c]) => ({ url: u, count: c })),
    });

    const status = stepDuplicateCount === 0 ? 'PASS' : 'WARN';
    console.log(
      `[${status}] Persona: ${j.role.padEnd(8)} | Route: #${j.route.padEnd(25)} | API Calls: ${String(stepRequests.length).padStart(3)} | Duplicate GETs: ${stepDuplicateCount}`
    );
    if (duplicates.length > 0) {
      duplicates.forEach(([u, c]) => console.log(`       ⚠️ Duplicate URL: ${u} (Count: ${c})`));
    }
  }

  console.log('\n=============================================================================');
  console.log(`TOTAL AVOIDABLE DUPLICATE READS ACROSS JOURNEYS: ${totalDuplicates}`);
  console.log(`TARGET: 0 Avoidable Duplicate Reads`);
  console.log('=============================================================================\n');

  try {
    await cdp.send('Browser.close');
  } catch {}
  chrome.kill();
  server.close();

  return { totalDuplicates, auditReport };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDuplicateReadsAudit().catch(console.error);
}
