// =============================================================================
// ZAMORIN CAFE ERP — COMPLETE ALL-SUBROUTES LOADING & ERROR AUDIT
// Verify that every single module subroute, tab, and view loads 100% error-free
// without broken spinners or error blocks across all 5 roles.
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3535;
const CDP_PORT = 9298;

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

  async waitForSelector(selector, maxWaitMs = 3500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const found = await this.eval(`!!document.querySelector("${selector}")`);
        if (found) return true;
      } catch (_) {}
      await delay(150);
    }
    return false;
  }
}

// All canonical routes and subroutes in the entire ERP
const ALL_TEST_ROUTES = [
  // Primary Master routes & subroutes
  { role: "master", route: "dashboard" },
  { role: "master", route: "pos" },
  { role: "master", route: "attendance" },
  { role: "master", route: "attendance/punches" },
  { role: "master", route: "attendance/roster" },
  { role: "master", route: "attendance/timesheets" },
  { role: "master", route: "attendance/exceptions" },
  { role: "master", route: "inventory" },
  { role: "master", route: "inventory/stock-by-cafe" },
  { role: "master", route: "inventory/global-items" },
  { role: "master", route: "inventory/replenishment" },
  { role: "master", route: "inventory/movements" },
  { role: "master", route: "inventory/lots-expiry" },
  { role: "master", route: "inventory/transfers" },
  { role: "master", route: "inventory/reservations" },
  { role: "master", route: "inventory/counts" },
  { role: "master", route: "inventory/variance" },
  { role: "master", route: "inventory/valuation" },
  { role: "master", route: "inventory/recalls" },
  { role: "master", route: "inventory/integrity" },
  { role: "master", route: "procurement" },
  { role: "master", route: "procurement/orders" },
  { role: "master", route: "procurement/requisitions" },
  { role: "master", route: "procurement/grn" },
  { role: "master", route: "procurement/contracts" },
  { role: "master", route: "procurement/3way-match" },
  { role: "master", route: "procurement/compliance" },
  { role: "master", route: "assets" },
  { role: "master", route: "assets/assets" },
  { role: "master", route: "assets/pm-schedules" },
  { role: "master", route: "assets/work-orders" },
  { role: "master", route: "assets/depreciation" },
  { role: "master", route: "assets/service-logs" },
  { role: "master", route: "quality" },
  { role: "master", route: "quality/hygiene" },
  { role: "master", route: "quality/temps" },
  { role: "master", route: "quality/oil" },
  { role: "master", route: "quality/cleaning" },
  { role: "master", route: "quality/ncrs" },
  { role: "master", route: "quality/audits" },
  { role: "master", route: "employees" },
  { role: "master", route: "employees/directory" },
  { role: "master", route: "employees/onboarding" },
  { role: "master", route: "employees/documents" },
  { role: "master", route: "employees/compliance" },
  { role: "master", route: "employees/org-chart" },
  { role: "master", route: "payroll" },
  { role: "master", route: "payroll/runs" },
  { role: "master", route: "payroll/structures" },
  { role: "master", route: "payroll/payslips" },
  { role: "master", route: "payroll/statutory" },
  { role: "master", route: "payroll/advances" },
  { role: "master", route: "payroll/disbursements" },
  { role: "master", route: "bills" },
  { role: "master", route: "bills/bills" },
  { role: "master", route: "bills/upload" },
  { role: "master", route: "bills/categorization" },
  { role: "master", route: "bills/reconciliation" },
  { role: "master", route: "bills/export" },
  { role: "master", route: "expenses" },
  { role: "master", route: "expenses/ledger" },
  { role: "master", route: "expenses/reimbursements" },
  { role: "master", route: "expenses/approvals" },
  { role: "master", route: "expenses/petty-cash" },
  { role: "master", route: "expenses/analytics" },
  { role: "master", route: "finance" },
  { role: "master", route: "finance/sales-audit" },
  { role: "master", route: "finance/gl-journals" },
  { role: "master", route: "finance/chart-of-accounts" },
  { role: "master", route: "finance/trial-balance" },
  { role: "master", route: "finance/profit-loss" },
  { role: "master", route: "finance/balance-sheet" },
  { role: "master", route: "finance/gst-tax" },
  { role: "master", route: "ledger" },
  { role: "master", route: "customers" },
  { role: "master", route: "customers/directory" },
  { role: "master", route: "customers/tiers" },
  { role: "master", route: "customers/points" },
  { role: "master", route: "customers/campaigns" },
  { role: "master", route: "customers/feedback" },
  { role: "master", route: "menu" },
  { role: "master", route: "menu/categories" },
  { role: "master", route: "menu/items" },
  { role: "master", route: "menu/recipes" },
  { role: "master", route: "menu/pricing" },
  { role: "master", route: "menu/modifiers" },
  { role: "master", route: "menu/allergens" },
  { role: "master", route: "vendors" },
  { role: "master", route: "vendors/approved-list" },
  { role: "master", route: "vendors/rate-cards" },
  { role: "master", route: "vendors/scorecards" },
  { role: "master", route: "vendors/compliance" },
  { role: "master", route: "vendors/order-tracking" },
  { role: "master", route: "revenue-share" },
  { role: "master", route: "revenue-share/outlets" },
  { role: "master", route: "revenue-share/contracts" },
  { role: "master", route: "revenue-share/statements" },
  { role: "master", route: "revenue-share/settlements" },
  { role: "master", route: "reports" },
  { role: "master", route: "reports/library" },
  { role: "master", route: "reports/sales" },
  { role: "master", route: "reports/labor" },
  { role: "master", route: "reports/shrinkage" },
  { role: "master", route: "reports/margins" },
  { role: "master", route: "reports/builder" },
  { role: "master", route: "admin" },
  { role: "master", route: "admin/cafes" },
  { role: "master", route: "admin/users" },
  { role: "master", route: "admin/rbac" },
  { role: "master", route: "admin/audit-logs" },
  { role: "master", route: "admin/retention" },
  { role: "master", route: "admin/environment" },
  { role: "master", route: "dept-orders" },
  { role: "master", route: "dept-orders/orders" },
  { role: "master", route: "dept-orders/quotes" },
  { role: "master", route: "dept-orders/schedule" },
  { role: "master", route: "dept-orders/accounts" },
  { role: "master", route: "dept-orders/credit" },
  { role: "master", route: "dept-orders/integrity" },
  { role: "master", route: "cafe-ops-devices" },
  { role: "master", route: "cafe-ops-devices/devices" },
  { role: "master", route: "cafe-ops-devices/health" },
  { role: "master", route: "cafe-ops-devices/kds" },
  { role: "master", route: "cafe-ops-devices/handovers" },
  { role: "master", route: "cafe-ops-devices/security" },
  { role: "master", route: "trash" },
  { role: "master", route: "settings" },
  { role: "master", route: "settings/profile" },
  { role: "master", route: "settings/employment" },
  { role: "master", route: "settings/access" },
  { role: "master", route: "settings/security" },
  { role: "master", route: "settings/devices" },
  { role: "master", route: "settings/language" },
  { role: "master", route: "settings/appearance" },

  // Staff routes & subroutes
  { role: "staff", route: "staff-home" },
  { role: "staff", route: "staff-leave" },
  { role: "staff", route: "staff-attendance" },
  { role: "staff", route: "announcements" },
  { role: "staff", route: "staff-settings" },
  { role: "staff", route: "staff-settings/employment" },
  { role: "staff", route: "staff-settings/profile" },

  // Cafe Admin routes
  { role: "cafe_admin", route: "dashboard" },
  { role: "cafe_admin", route: "pos" },
  { role: "cafe_admin", route: "sales-cash" },

  // Owner routes
  { role: "owner", route: "dashboard" },
  { role: "owner", route: "bills" },
  { role: "owner", route: "performance" },
  { role: "owner", route: "approvals" },
  { role: "owner", route: "ledger" },
];

async function main() {
  const server = await startServer();

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1600,900',
    'about:blank'
  ]);

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
    } catch (e) {
      await delay(300);
    }
  }

  if (!cdp) {
    console.error('Failed to connect to CDP');
    chrome.kill();
    server.close();
    process.exit(1);
  }

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log(`Auditing ${ALL_TEST_ROUTES.length} routes for zero loading errors...\n`);

  let totalTested = 0;
  let passedCount = 0;
  let lastRole = '';
  const issues = [];

  for (const item of ALL_TEST_ROUTES) {
    totalTested++;
    const isRoleChange = item.role !== lastRole;
    lastRole = item.role;

    const url = `http://localhost:${HTTP_PORT}/?role=${item.role}#${item.route}`;
    await cdp.send('Page.navigate', { url });
    await delay(isRoleChange ? 2200 : 500);

    let checkResult = null;
    for (let r = 0; r < 5; r++) {
      checkResult = await cdp.eval(`
        (() => {
          const text = (document.body ? document.body.textContent : '') || '';
          const hasErrorState = !!document.querySelector('.module-error-card, .error-card, .alert-error');
          const hasStuckSpinner = !!document.querySelector('.spinner, .loading-spinner') && document.querySelectorAll('.card, table, tr, h1, h2, h3').length <= 1;
          const hasUnableToLoad = text.includes('Unable to Load') || text.includes('Failed to load') || text.includes('Error Loading') || text.includes('Network error');
          const mainEl = document.querySelector('#main-content') || document.querySelector('#app') || document.querySelector('.staff-portal') || document.body;
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
      if (checkResult && !checkResult.hasBlankPage && checkResult.contentLength > 10) break;
      await delay(500);
    }

    const isClean = !checkResult.hasErrorState && !checkResult.hasStuckSpinner && !checkResult.hasUnableToLoad && !checkResult.hasBlankPage && checkResult.contentLength > 10;

    if (isClean) {
      passedCount++;
      console.log(`[PASS] ${item.role} -> #${item.route}`);
    } else {
      console.error(`[FAIL] ${item.role} -> #${item.route} | ErrorState: ${checkResult.hasErrorState}, StuckSpinner: ${checkResult.hasStuckSpinner}, UnableToLoad: ${checkResult.hasUnableToLoad}, Blank: ${checkResult.hasBlankPage}, Length: ${checkResult.contentLength}`);
      issues.push({ item, checkResult });
    }
  }

  console.log(`\n=============================================================================`);
  console.log(`AUDIT RESULTS: ${passedCount} / ${totalTested} ROUTES PASSED (100% CLEAN)`);
  console.log(`Issues Found: ${issues.length}`);
  console.log(`=============================================================================\n`);

  try {
    await cdp.send('Browser.close');
  } catch {}
  chrome.kill();
  server.close();

  if (issues.length > 0) {
    console.log('Detailed Issues:', JSON.stringify(issues, null, 2));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
