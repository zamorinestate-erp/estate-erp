import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3592;
const CDP_PORT = 9452;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        });
        res.end(content);
      });
    });

    server.listen(HTTP_PORT, () => {
      resolve(server);
    });
  });
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
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async waitForSelector(selector, maxWaitMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const found = await this.eval(`!!document.querySelector("${selector}")`);
      if (found) return true;
      await delay(150);
    }
    return false;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const server = await startServer();
  console.log(`Test server running on port ${HTTP_PORT}`);

  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=C:\\Windows\\Temp\\chrome-ledger-audit-${Date.now()}`,
    `http://localhost:${HTTP_PORT}/?role=master#ledger`
  ]);

  await delay(2000);

  const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error("No page target found");
  }

  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready;

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log(`\n======================================================`);
  console.log(`AUDITING PERSONAL LEDGER & PASSBOOK WORKSPACES`);
  console.log(`======================================================\n`);

  let allPassed = true;

  // 1. Audit #ledger and clicking through all 7 tab buttons
  console.log("1. Testing #ledger and tab switching...");
  await cdp.send("Page.navigate", { url: `http://localhost:${HTTP_PORT}/?role=master#ledger` });
  await cdp.waitForSelector('[data-pl-tab="journal"]', 5000);
  await delay(500);

  const tabs = ["journal", "review", "reimbursements", "funding", "reconciliation", "confirmations", "audit"];
  for (const tab of tabs) {
    const tabClickRes = await cdp.eval(`
      (() => {
        const btn = document.querySelector('[data-pl-tab="${tab}"]');
        if (!btn) return { found: false, body: document.body.innerText.slice(0, 100) };
        btn.click();
        const content = document.querySelector("#pl-tab-content-area")?.innerText || "";
        const isPrimary = btn.classList.contains("btn-primary");
        return {
          found: true,
          isPrimary,
          contentLength: content.length,
          snippet: content.slice(0, 60).replace(/\\n/g, " ")
        };
      })()
    `);

    if (!tabClickRes || !tabClickRes.found || tabClickRes.contentLength < 20 || !tabClickRes.isPrimary) {
      allPassed = false;
      console.error(`❌ [FAIL] #ledger tab: ${tab}`, tabClickRes);
    } else {
      console.log(`✅ [PASS] #ledger tab: ${tab} | Active button style: YES | Content: "${tabClickRes.snippet}..."`);
    }
    await delay(300);
  }

  // 2. Audit all Passbook subroutes
  const passbookSubroutes = [
    "passbook",
    "passbook/accounts",
    "passbook/mapping",
    "passbook/payment-mapping",
    "passbook/migration",
    "passbook/transactions",
    "passbook/daybook",
    "passbook/transfers",
    "passbook/inter-cafe-transfers",
    "passbook/reconciliation",
    "passbook/statements",
    "passbook/adjustments",
    "passbook/confirmations",
    "passbook/cash-verification",
    "passbook/petty-cash",
    "passbook/reservations",
    "passbook/period-close",
    "passbook/integrity",
    "passbook/documents",
    "passbook/exports",
    "passbook/unallocated",
    "passbook/analytics",
    "passbook/cafe-comparison",
    "passbook/liquidity",
    "passbook/audit"
  ];

  console.log("\n2. Testing Passbook subroutes...");
  for (const route of passbookSubroutes) {
    await cdp.send("Page.navigate", { url: `http://localhost:${HTTP_PORT}/?role=master#${route}` });
    await delay(700);

    const check = await cdp.eval(`
      (() => {
        const text = document.body.innerText || "";
        const h2 = document.querySelector("h2, h3")?.innerText || "";
        const tableRows = document.querySelectorAll("tbody tr").length;
        const cards = document.querySelectorAll(".card, .kpi-card").length;
        const buttons = document.querySelectorAll(".btn").length;
        const isStub = text.includes("Temporal effective-dated") && text.length < 200;

        return {
          h2: h2.replace(/\\n/g, " "),
          tableRows,
          cards,
          buttons,
          textLength: text.length,
          isStub
        };
      })()
    `);

    if (!check || check.textLength < 100 || check.isStub) {
      allPassed = false;
      console.error(`❌ [FAIL] #${route} (Stub or blank)`);
    } else {
      console.log(`✅ [PASS] #${route} | Title: "${check.h2}" | Cards: ${check.cards} | Buttons: ${check.buttons} | Rows: ${check.tableRows}`);
    }
  }

  cdp.close();
  chrome.kill();
  server.close();

  console.log(`\n======================================================`);
  if (allPassed) {
    console.log(`🎉 ALL PERSONAL LEDGER & PASSBOOK WORKSPACES VERIFIED 100% OPERATIONAL`);
  } else {
    console.log(`❌ SOME WORKSPACES FAILED AUDIT`);
  }
  console.log(`======================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
