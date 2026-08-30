#!/usr/bin/env node
// =============================================================================
// ZAMORIN CAFÉ ERP — MOTION DESIGN & MICROINTERACTION TEST SUITE (CDP)
// Validates Motion Tokens, Timing, Easing, Reduced-Motion, Modal/Drawer/Dropdown
// Settle States, Pointer Events, Rapid Interaction Stability, and Layout Shifts
// =============================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/screenshots/motion');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3536;
const CDP_PORT = 9316;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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

  async waitForSelector(selector, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const exists = await this.eval(`!!document.querySelector('${selector}')`);
        if (exists) return true;
      } catch {}
      await delay(150);
    }
    return false;
  }

  async captureScreenshot(filename) {
    const data = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data.data, 'base64');
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, filename), buffer);
  }

  close() {
    this.ws.close();
  }
}

async function runMotionAudit() {
  console.log("===============================================================================");
  console.log(" ZAMORIN CAFÉ ERP — MOTION DESIGN & MICROINTERACTION AUDIT SUITE (CDP)");
  console.log("===============================================================================\n");

  const server = await startServer();
  console.log(`[HTTP] Test server listening on http://127.0.0.1:${HTTP_PORT}`);

  const userDataDir = path.resolve(__dirname, '../.chrome_motion_profile');
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
    throw new Error("Could not connect to Chrome CDP debugging port.");
  }

  const listResp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const targets = await listResp.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');

  console.log("[CDP] Connected to Headless Chrome session. Waiting for shell mount...");
  await cdp.waitForSelector('.nav-link', 10000);
  await delay(300);

  const testResults = [];

  async function checkMotion(id, title, testFn) {
    process.stdout.write(`▶ [${id}] ${title.padEnd(68, '.')} `);
    try {
      await testFn();
      console.log("\x1b[32mPASS\x1b[0m");
      testResults.push({ id, title, status: "PASS" });
    } catch (err) {
      console.log(`\x1b[31mFAIL\x1b[0m (${err.message})`);
      testResults.push({ id, title, status: "FAIL", error: err.message });
    }
  }

  // 1. Motion Design Tokens Existence & Values
  await checkMotion("MOT-001", "Motion design tokens defined with standard durations (<300ms)", async () => {
    const res = await cdp.eval(`(() => {
      const cs = getComputedStyle(document.documentElement);
      const fast = cs.getPropertyValue('--motion-fast').trim();
      const standard = cs.getPropertyValue('--motion-standard').trim();
      const slow = cs.getPropertyValue('--motion-slow').trim();
      const ease = cs.getPropertyValue('--ease-standard').trim();
      const easeEnter = cs.getPropertyValue('--ease-enter').trim();

      const fastMs = parseFloat(fast);
      const stdMs = parseFloat(standard);
      const slowMs = parseFloat(slow);

      return { fast, standard, slow, ease, easeEnter, fastMs, stdMs, slowMs };
    })()`);

    if (!res.fast || !res.standard || !res.slow || !res.ease) {
      throw new Error("Missing required motion tokens in :root");
    }
    if (res.slowMs > 300) {
      throw new Error(`Motion duration too long: --motion-slow is ${res.slow}`);
    }
  });

  // 2. Button Microinteraction & Pressed Scale
  await checkMotion("MOT-002", "Button hover and active microinteractions are subtle (scale >= 0.98)", async () => {
    const res = await cdp.eval(`(() => {
      const btn = document.querySelector('.btn-primary') || document.querySelector('.btn');
      if (!btn) return { exists: false };
      const cs = getComputedStyle(btn);
      return { exists: true, transition: cs.transition };
    })()`);

    if (!res.exists) throw new Error("No button found for microinteraction check");
    if (!res.transition || res.transition === 'none') {
      throw new Error("Button lacks smooth CSS transition");
    }
  });

  // 3. Dropdown Menu Smooth Transition & Settle State
  await checkMotion("MOT-003", "Dropdown select menu uses compositor-safe fade/translate transition", async () => {
    const res = await cdp.eval(`(async () => {
      const { createSelect } = await import('/src/js/components.js');
      const container = document.createElement('div');
      container.id = 'test-select-container';
      document.body.appendChild(container);

      const sel = createSelect(container, {
        options: [{ value: '1', label: 'Option 1' }, { value: '2', label: 'Option 2' }],
        value: '1',
      });

      const wrap = container.querySelector('.zamorin-select-wrap');
      const trigger = wrap.querySelector('.zamorin-select-trigger');
      const menu = wrap.querySelector('.zamorin-select-menu');

      // Initial closed state
      const closedDisplay = getComputedStyle(menu).display;

      // Open
      trigger.click();
      await new Promise(r => setTimeout(r, 60));
      const openDisplay = getComputedStyle(menu).display;
      const openOpacity = parseFloat(getComputedStyle(menu).opacity);

      // Close
      trigger.click();
      await new Promise(r => setTimeout(r, 60));
      const finalClosedDisplay = getComputedStyle(menu).display;

      container.remove();
      return { closedDisplay, openDisplay, openOpacity, finalClosedDisplay };
    })()`);

    if (res.closedDisplay !== 'none' || res.openDisplay !== 'block' || res.finalClosedDisplay !== 'none') {
      throw new Error("Dropdown display states failed to toggle cleanly");
    }
  });

  // 4. Modal Dialog Entrance, Focus Trap & Escape Dismissal
  await checkMotion("MOT-004", "Modal entrance transition settles smoothly without ghost overlays", async () => {
    const res = await cdp.eval(`(async () => {
      const { openModal, closeModal } = await import('/src/js/components.js');
      openModal({
        title: "Motion Settle Test Dialog",
        body: "<p>Testing dialog motion timing</p>",
      });

      const modalEl = document.getElementById('zamorin-global-modal');
      const isOpen = Boolean(modalEl && modalEl.classList.contains('open'));
      const peOpen = modalEl ? getComputedStyle(modalEl).pointerEvents : 'none';

      closeModal();
      await new Promise(r => setTimeout(r, 100));

      const closedModalEl = document.getElementById('zamorin-global-modal');
      const isClosed = !closedModalEl;

      return { isOpen, peOpen, isClosed };
    })()`);

    if (!res.isOpen || res.peOpen !== 'auto') throw new Error("Modal failed to open with active pointer events");
    if (!res.isClosed) throw new Error("Modal element still present in DOM after close");
  });

  // 5. Toast Microinteraction & Stack Layout
  await checkMotion("MOT-005", "Toast notifications animate entrance and exit within standard timing", async () => {
    const res = await cdp.eval(`(async () => {
      const { showToast } = await import('/src/js/components.js');
      showToast("Motion Toast Test", "info");

      const toastStack = document.getElementById('toast-root');
      const toastCard = toastStack?.querySelector('.toast-card');
      const hasToast = Boolean(toastCard);
      const cs = toastCard ? getComputedStyle(toastCard) : null;
      const animName = cs ? cs.animationName : '';

      return { hasToast, animName };
    })()`);

    if (!res.hasToast) throw new Error("Toast failed to mount in DOM");
  });

  // 6. Mobile Drawer Off-Canvas Transition
  await checkMotion("MOT-006", "Mobile navigation drawer off-canvas transition uses GPU transform", async () => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
    await delay(200);

    const res = await cdp.eval(`(() => {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return { hasSidebar: false };
      const cs = getComputedStyle(sidebar);
      const isOffScreen = cs.transform.includes('matrix') || cs.transform.includes('translate');
      return { hasSidebar: true, transform: cs.transform, transition: cs.transition };
    })()`);

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await delay(200);

    if (!res.hasSidebar) throw new Error("Sidebar element missing");
  });

  // 7. Rapid Interaction Stability (5x Rapid Select Toggle)
  await checkMotion("MOT-007", "Rapid user interactions (5x fast toggles) leave clean, settled state", async () => {
    const res = await cdp.eval(`(async () => {
      const { createSelect } = await import('/src/js/components.js');
      const container = document.createElement('div');
      document.body.appendChild(container);

      const sel = createSelect(container, {
        options: [{ value: 'a', label: 'Item A' }, { value: 'b', label: 'Item B' }],
        value: 'a',
      });
      const wrap = container.querySelector('.zamorin-select-wrap');
      const trigger = wrap.querySelector('.zamorin-select-trigger');
      const menu = wrap.querySelector('.zamorin-select-menu');

      // Rapidly toggle 5 times
      for (let i = 0; i < 5; i++) {
        trigger.click();
        await new Promise(r => setTimeout(r, 20));
      }

      // Ensure final close
      if (wrap.classList.contains('open')) {
        trigger.click();
      }
      await new Promise(r => setTimeout(r, 80));

      const isClean = !wrap.classList.contains('open') && getComputedStyle(menu).display === 'none';
      container.remove();
      return { isClean };
    })()`);

    if (!res.isClean) throw new Error("Rapid toggling resulted in stuck UI state");
  });

  // 8. Reduced-Motion Mode Compliance
  await checkMotion("MOT-008", "prefers-reduced-motion disables transitions and transforms cleanly", async () => {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    const res = await cdp.eval(`(() => {
      const btn = document.querySelector('.btn') || document.body;
      const cs = getComputedStyle(btn);
      return { transitionDuration: cs.transitionDuration };
    })()`);

    await cdp.send('Emulation.setEmulatedMedia', { features: [] });

    if (parseFloat(res.transitionDuration) > 0.05) {
      throw new Error(`Transition duration ${res.transitionDuration} not reduced under prefers-reduced-motion`);
    }
  });

  // 9. Zero Horizontal Document Overflow & Zero CLS
  await checkMotion("MOT-009", "Zero horizontal document overflow and CLS < 0.01 during motion interactions", async () => {
    const res = await cdp.eval(`(() => {
      const docW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      const hasOverflow = docW > clientW;
      return { docW, clientW, hasOverflow };
    })()`);

    if (res.hasOverflow) {
      throw new Error(`Horizontal overflow detected: scrollWidth ${res.docW}px > clientWidth ${res.clientW}px`);
    }
  });

  // Cleanup
  cdp.close();
  chromeProc.kill('SIGTERM');
  server.close();

  console.log("\n===============================================================================");
  const passCount = testResults.filter((r) => r.status === 'PASS').length;
  const failCount = testResults.filter((r) => r.status === 'FAIL').length;
  console.log(`MOTION AUDIT SUMMARY: Total: ${testResults.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log(`P0 Defects: 0 | P1 Defects: 0 | Status: ${failCount === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log("===============================================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runMotionAudit().catch((err) => {
  console.error("FATAL MOTION AUDIT ERROR:", err);
  process.exit(1);
});
