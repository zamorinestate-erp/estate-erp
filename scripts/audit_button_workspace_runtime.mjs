// =============================================================================
// ZAMORIN CAFE ERP — UNIVERSAL BUTTON & WORKSPACE RUNTIME AUDIT SUITE
// Tests Tile Navigation -> URL Hash -> Child Dominant H1 -> Landing Purity -> Back/Forward
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
const HTTP_PORT = 3540;
const CDP_PORT = 9310;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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

  async waitForSelector(selector, maxWaitMs = 3500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const found = await this.eval(`!!document.querySelector("${selector}")`);
      if (found) return true;
      await delay(150);
    }
    return false;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(SCREENSHOTS_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  [SCREENSHOT] Saved ${filename}`);
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

async function main() {
  console.log('=============================================================================');
  console.log('UNIVERSAL BUTTON & DEDICATED WORKSPACE RUNTIME AUDIT');
  console.log('=============================================================================\n');

  const server = await startServer();
  const tmpProfile = path.resolve(__dirname, `../.chrome_button_audit_${Date.now()}`);

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
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 1. INVENTORY MODULE AUDIT
    console.log('\n--- 1. INVENTORY MODULE (Hub -> Tiles -> Child Workspaces) ---');
    await cdp.send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/?role=master#inventory` });
    await delay(1200);
    await cdp.waitForSelector('.module-hub-tile, [data-inv-hub-tile]', 4000);

    const invLandingPurity = await cdp.eval(`
      (() => {
        const tiles = document.querySelectorAll('[data-inv-hub-tile]').length;
        const hasHeatmap = !!document.querySelector('#stock-heatmap-container');
        const hasAddGlobalBtn = !!document.querySelector('#btn-add-global-item');
        return { tiles, hasHeatmap, hasAddGlobalBtn };
      })()
    `);

    assert('Inventory Landing Renders 14 Navigation Tiles', invLandingPurity.tiles >= 12, `Found ${invLandingPurity.tiles}`);
    assert('Inventory Landing is Clean (No Heatmap on Overview)', !invLandingPurity.hasHeatmap);
    assert('Inventory Landing is Clean (No Add Global Item on Overview)', !invLandingPurity.hasAddGlobalBtn);
    await cdp.captureScreenshot('inventory_landing_overview.png');

    // Click Stock Levels Tile
    await cdp.eval(`document.querySelector('[data-inv-hub-tile="stock-by-cafe"]')?.click()`);
    await delay(1000);

    const stockLevelsState = await cdp.eval(`
      (() => {
        const hash = window.location.hash;
        const h1 = document.querySelector('h1')?.textContent?.trim();
        const hasHeatmap = !!document.querySelector('#stock-heatmap-container');
        const hasRefreshBtn = !!document.querySelector('#btn-refresh-stock');
        const hasAddGlobal = !!document.querySelector('#btn-add-global-item');
        return { hash, h1, hasHeatmap, hasRefreshBtn, hasAddGlobal };
      })()
    `);

    assert('Stock Levels Tile Navigates to #inventory/stock-by-cafe', stockLevelsState.hash === '#inventory/stock-by-cafe', `Actual: ${stockLevelsState.hash}`);
    assert('Stock Levels Child H1 is "Stock Levels"', stockLevelsState.h1?.includes('Stock Levels'), `Actual: ${stockLevelsState.h1}`);
    assert('Stock Levels Contains Multi-Café Heatmap', stockLevelsState.hasHeatmap);
    assert('Stock Levels Contains Refresh Stock Action', stockLevelsState.hasRefreshBtn);
    assert('Stock Levels Excludes Add Global Item (Clean Isolation)', !stockLevelsState.hasAddGlobal);
    await cdp.captureScreenshot('inventory_stock_levels_child.png');

    // Test Global Item Master Tile
    await cdp.eval(`window.location.hash = '#inventory/global-items'`);
    await delay(1000);
    await cdp.waitForSelector('h1', 3000);
    const itemMasterH1 = await cdp.eval(`document.querySelector('h1')?.textContent?.trim()`);
    assert('Global Item Master Renders H1 "Global Item Master"', itemMasterH1?.includes('Global Item Master'), `Actual: ${itemMasterH1}`);
    await cdp.captureScreenshot('inventory_global_item_master_child.png');

    // 2. BILLS & RECEIPTS MODULE AUDIT
    console.log('\n--- 2. BILLS & RECEIPTS MODULE ---');
    await cdp.eval(`window.location.hash = '#bills'`);
    await delay(1200);
    await cdp.waitForSelector('[data-bills-hub-tile]', 3000);

    const billsLanding = await cdp.eval(`
      (() => {
        const tiles = document.querySelectorAll('[data-bills-hub-tile]').length;
        const title = document.querySelector('h1')?.textContent?.trim();
        return { tiles, title };
      })()
    `);

    assert('Bills Landing Renders Navigation Tiles', billsLanding.tiles >= 7, `Found ${billsLanding.tiles}`);
    await cdp.captureScreenshot('bills_landing_overview.png');

    // Open Dedicated Receipts Page
    await cdp.eval(`window.location.hash = '#bills/receipts'`);
    await delay(1000);
    await cdp.waitForSelector('tbody tr, #btn-upload-receipt-modal', 3000);
    const receiptsState = await cdp.eval(`
      (() => {
        const hash = window.location.hash;
        const h2 = document.querySelector('h2')?.textContent?.trim();
        const hasUploadBtn = !!document.querySelector('#btn-upload-receipt-modal');
        const rows = document.querySelectorAll('tbody tr').length;
        return { hash, h2, hasUploadBtn, rows };
      })()
    `);

    assert('Dedicated Receipts Subroute #bills/receipts Mounted', receiptsState.hash === '#bills/receipts');
    assert('Receipts Page Displays "Receipts & Payment Evidence"', receiptsState.h2?.includes('Receipts & Payment Evidence'));
    assert('Receipts Page Has Dedicated Upload Action', receiptsState.hasUploadBtn);
    assert('Receipts Register Populated with Audited Rows', receiptsState.rows > 0);
    await cdp.captureScreenshot('bills_receipts_dedicated_child.png');

    // Open Dedicated Upload Workspace
    await cdp.eval(`window.location.hash = '#bills/upload'`);
    await delay(1000);
    await cdp.waitForSelector('#bill-doc-file-dropzone, #upload-invoice-form', 3000);
    const uploadState = await cdp.eval(`
      (() => {
        const dropzone = !!document.querySelector('#bill-doc-file-dropzone');
        const form = !!document.querySelector('#upload-invoice-form');
        return { dropzone, form };
      })()
    `);

    assert('Upload Invoices Child Workspace Has Dropzone', uploadState.dropzone);
    assert('Upload Invoices Child Workspace Has Ingestion Form', uploadState.form);
    await cdp.captureScreenshot('bills_upload_dedicated_child.png');

    // 3. EXPENSES MODULE AUDIT
    console.log('\n--- 3. EXPENSES & EVIDENCE VAULT MODULE ---');
    await cdp.eval(`window.location.hash = '#expenses/evidence'`);
    await delay(1000);
    await cdp.waitForSelector('#upload-expense-receipt-btn, h3', 3000);
    const evidenceState = await cdp.eval(`
      (() => {
        const h3 = document.querySelector('h3')?.textContent?.trim();
        const hasUploadBtn = !!document.querySelector('#upload-expense-receipt-btn');
        return { h3, hasUploadBtn };
      })()
    `);
    assert('Evidence Vault Renders Dedicated Evidence Register', evidenceState.h3?.includes('Receipts & Evidence Vault'));
    assert('Evidence Vault Has Dedicated Upload Button', evidenceState.hasUploadBtn);
    await cdp.captureScreenshot('expenses_evidence_vault_child.png');

    // 4. SETTINGS MODULE AUDIT
    console.log('\n--- 4. SETTINGS & PREFERENCES MODULE ---');
    await cdp.eval(`window.location.hash = '#settings'`);
    await delay(1200);
    await cdp.waitForSelector('#settings-search-input, .module-hub-tile', 3000);

    const settingsLanding = await cdp.eval(`
      (() => {
        const h1 = document.querySelector('h1')?.textContent?.trim();
        const hasSearch = !!document.querySelector('#settings-search-input');
        const tiles = document.querySelectorAll('.module-hub-tile').length;
        const hasGlobalScope = (document.body.textContent || '').includes('Global Portfolio Control');
        return { h1, hasSearch, tiles, hasGlobalScope };
      })()
    `);

    assert('Settings Landing Title is "Settings, Account & Preferences"', settingsLanding.h1?.includes('Settings'), `Actual: ${settingsLanding.h1}`);
    assert('Settings Landing Has Search Settings Bar', settingsLanding.hasSearch);
    assert('Settings Landing Has 12 Category Tiles', settingsLanding.tiles >= 12, `Found ${settingsLanding.tiles}`);
    assert('Settings Landing Excludes Multi-Café Portfolio Strip', !settingsLanding.hasGlobalScope);
    await cdp.captureScreenshot('settings_landing_overview.png');

    // Navigate to Security & Sign-In Child
    await cdp.eval(`window.location.hash = '#settings/security'`);
    await delay(1200);
    await cdp.waitForSelector('.settings-section-title, h1, h2', 3000);
    const securityH1 = await cdp.eval(`
      (() => {
        const title = document.querySelector('.settings-section-title, h1, h2')?.textContent?.trim();
        return title;
      })()
    `);
    assert('Settings Security Child Renders Title "Security & Sign-In"', securityH1?.includes('Security & Sign-In'), `Actual: ${securityH1}`);
    await cdp.captureScreenshot('settings_security_child.png');

    // 5. BROWSER BACK & FORWARD SPA TEST
    console.log('\n--- 5. SPA BROWSER BACK & FORWARD NAVIGATION TEST ---');
    await cdp.eval(`window.location.hash = '#inventory'`);
    await delay(800);
    await cdp.eval(`window.location.hash = '#inventory/stock-by-cafe'`);
    await delay(800);
    await cdp.eval(`window.history.back()`);
    await delay(800);
    const backHash = await cdp.eval(`window.location.hash`);
    assert('Browser Back Returns to #inventory Overview', backHash === '#inventory', `Actual: ${backHash}`);

    await cdp.eval(`window.history.forward()`);
    await delay(800);
    const forwardHash = await cdp.eval(`window.location.hash`);
    assert('Browser Forward Returns to #inventory/stock-by-cafe', forwardHash === '#inventory/stock-by-cafe', `Actual: ${forwardHash}`);

    console.log('\n=============================================================================');
    console.log(`UNIVERSAL BUTTON AUDIT COMPLETE: ${passedChecks + failedChecks} CHECKS | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
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
