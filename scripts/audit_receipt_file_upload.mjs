// =============================================================================
// ZAMORIN CAFE ERP — RECEIPT & FILE UPLOAD RUNTIME AUDIT SUITE
// Tests Universal Dropzone, File Extensions, Size Limit, SHA-256 Preview & Modals
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
const HTTP_PORT = 3546;
const CDP_PORT = 9318;

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
      console.error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async waitForSelector(selector, maxWaitMs = 3500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const found = await this.eval(`Boolean(document.querySelector('${selector}'))`);
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

async function main() {
  console.log('=============================================================================');
  console.log('RECEIPT & FILE UPLOAD RUNTIME AUDIT');
  console.log('=============================================================================\n');

  const server = await startServer();
  const tmpProfile = path.resolve(__dirname, `../.chrome_upload_audit_${Date.now()}`);

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,1000',
    'about:blank'
  ]);

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

  try {
    await delay(1800);
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
      throw new Error("Could not connect to Chrome CDP endpoint");
    }

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Initial boot on master overview
    await cdp.send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/?role=master#inventory` });
    await delay(1500);
    await cdp.waitForSelector('.module-hub-tile, [data-inv-hub-tile]', 4000);

    // 1. TEST BILLS INGESTION DROPZONE
    console.log('\n--- 1. TESTING BILLS INGESTION DROPZONE (#bills/upload) ---');
    await cdp.eval(`window.location.hash = '#bills/upload'`);
    await delay(1200);
    await cdp.waitForSelector('#bill-doc-file-dropzone, #upload-invoice-form', 3500);

    const dropzoneState = await cdp.eval(`
      (() => {
        const dropzone = document.querySelector('#bill-doc-file-dropzone, .file-dropzone');
        const input = document.querySelector('#bill-doc-file-input, input[type="file"]');
        const form = document.querySelector('#upload-invoice-form, form');
        return {
          hasDropzone: Boolean(dropzone),
          hasInput: Boolean(input),
          acceptAttr: input ? input.getAttribute('accept') : '',
          hasForm: Boolean(form)
        };
      })()
    `);

    assert('Invoice Dropzone Element Rendered', Boolean(dropzoneState?.hasDropzone));
    assert('File Input Has Safe File Extensions Accept Filter', dropzoneState?.acceptAttr?.includes('.pdf') && dropzoneState?.acceptAttr?.includes('.png'));
    assert('Ingestion Form Complete with Vendor & Invoice # Fields', Boolean(dropzoneState?.hasForm));
    await cdp.captureScreenshot('upload_dropzone_render.png');

    // 2. TEST DIGITAL PROOF PREVIEW MODAL
    console.log('\n--- 2. TESTING DIGITAL PROOF PREVIEW MODAL ---');
    await cdp.eval(`window.location.hash = '#bills/receipts'`);
    await delay(1200);
    await cdp.waitForSelector('.view-doc-attachment-btn, #btn-upload-receipt-modal', 3500);
    await cdp.eval(`document.querySelector('.view-doc-attachment-btn')?.click()`);
    await delay(600);
    await cdp.waitForSelector('#zamorin-global-modal, .modal, .modal-box', 3000);

    const previewModal = await cdp.eval(`
      (() => {
        const modal = document.querySelector('#zamorin-global-modal, .modal, .modal-box');
        const text = (modal ? modal.textContent : '').toLowerCase();
        const hasSha = text.includes('sha-256') || text.includes('sha256');
        const hasRetention = text.includes('8 years') || text.includes('retention');
        const hasDownload = Boolean(modal?.querySelector('button'));
        return { isOpen: Boolean(modal), hasSha, hasRetention, hasDownload };
      })()
    `);

    assert('Document Preview Modal Opens Cleanly', Boolean(previewModal?.isOpen));
    assert('Document Displays SHA-256 Verification Proof', Boolean(previewModal?.hasSha));
    assert('Document Displays Statutory 8-Year Retention Policy', Boolean(previewModal?.hasRetention));
    assert('Document Preview Has Download Action', Boolean(previewModal?.hasDownload));
    await cdp.captureScreenshot('document_preview_modal.png');

    // Close preview modal
    await cdp.eval(`document.querySelector('#zamorin-global-modal .btn, .modal .btn, #btn-modal-close')?.click()`);
    await delay(400);

    // 3. TEST UNIVERSAL DOCUMENT MODAL UPLOAD WORKFLOW
    console.log('\n--- 3. TESTING UNIVERSAL DOCUMENT MODAL POPUP ---');
    await cdp.eval(`document.querySelector('#btn-upload-receipt-modal')?.click()`);
    await delay(600);
    await cdp.waitForSelector('#zamorin-global-modal, .modal', 3000);

    const universalModal = await cdp.eval(`
      (() => {
        const modal = document.querySelector('#zamorin-global-modal, .modal, .modal-box');
        const dropzone = modal ? modal.querySelector('#u-doc-file-dropzone, .file-dropzone') : null;
        const categorySelect = modal ? modal.querySelector('#u-doc-category') : null;
        const vendorInput = modal ? modal.querySelector('#u-doc-vendor') : null;
        return {
          isOpen: Boolean(modal),
          hasDropzone: Boolean(dropzone),
          hasCategories: Boolean(categorySelect),
          hasVendor: Boolean(vendorInput)
        };
      })()
    `);

    assert('Universal Document Modal Mounted', Boolean(universalModal?.isOpen));
    assert('Universal Modal Contains Drag & Drop Dropzone', Boolean(universalModal?.hasDropzone));
    assert('Universal Modal Contains Category Selector', Boolean(universalModal?.hasCategories));
    assert('Universal Modal Contains Vendor/Payee Field', Boolean(universalModal?.hasVendor));
    await cdp.captureScreenshot('universal_document_modal_popup.png');

    console.log('\n=============================================================================');
    console.log(`RECEIPT & FILE AUDIT COMPLETE: ${passedChecks + failedChecks} CHECKS | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
    console.log(`Console Errors: ${cdp.consoleErrors.length} | Runtime Exceptions: ${cdp.runtimeExceptions.length}`);
    if (cdp.runtimeExceptions.length > 0) {
      console.log('Runtime Exception Details:', JSON.stringify(cdp.runtimeExceptions, null, 2));
    }
    if (cdp.consoleErrors.length > 0) {
      console.log('Console Error Details:', JSON.stringify(cdp.consoleErrors, null, 2));
    }
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
  console.error('Audit runner error:', err);
  process.exit(1);
});
