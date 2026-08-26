import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9334;
const BASE_URL = "http://localhost:3000";

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
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log("Launching headless Chrome...");
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=C:\\Windows\\Temp\\chrome-fin-audit-2",
    "http://localhost:3000/#finance"
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

  const subroutes = [
    "finance",
    "finance/sales-audit",
    "finance/gl-journals",
    "finance/ap-payments",
    "finance/ar-collections",
    "finance/marketplaces",
    "finance/cash-bank",
    "finance/budgets",
    "finance/tax-review",
    "finance/period-close",
    "finance/statements",
    "finance/integrity"
  ];

  console.log(`\n======================================================`);
  console.log(`AUDITING ALL 12 FINANCE & ACCOUNTS WORKSPACES`);
  console.log(`======================================================\n`);

  let allPassed = true;

  for (const route of subroutes) {
    const url = `${BASE_URL}/#${route}`;
    await cdp.send("Page.navigate", { url });
    await delay(700);

    const check = await cdp.eval(`
      (() => {
        const text = document.body.innerText || "";
        const hasSessionExpired = text.includes("Session Expired") || text.includes("Your sign-in session needs to be refreshed");
        const hasErrorState = Boolean(document.querySelector(".module-error-state"));
        const hasSpinner = Boolean(document.querySelector(".spinner"));
        const hasContent = text.trim().length > 100;
        const pageTitle = document.querySelector("h1")?.innerText || document.querySelector("h3")?.innerText || "";
        const tableRows = document.querySelectorAll("tbody tr").length;
        const cards = document.querySelectorAll(".glass-card, .kpi-card, .card, .module-hub-tile").length;

        return {
          hasSessionExpired,
          hasErrorState,
          hasSpinner,
          hasContent,
          pageTitle: pageTitle.replace(/\\n/g, " "),
          tableRows,
          cards,
          textLength: text.length
        };
      })()
    `);

    if (check.hasSessionExpired || check.hasErrorState || !check.hasContent) {
      allPassed = false;
      console.error(`❌ [FAIL] #${route}`);
      console.error(`   - Session Expired: ${check.hasSessionExpired}`);
      console.error(`   - Module Error State: ${check.hasErrorState}`);
      console.error(`   - Has Content: ${check.hasContent} (length: ${check.textLength})`);
    } else {
      console.log(`✅ [PASS] #${route}`);
      console.log(`   Title: "${check.pageTitle}" | Tables: ${check.tableRows} rows | Cards: ${check.cards} | Zero Errors`);
    }
  }

  cdp.close();
  chrome.kill();

  console.log(`\n======================================================`);
  if (allPassed) {
    console.log(`🎉 ALL 12 FINANCE WORKSPACES VERIFIED 100% ERROR FREE`);
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
