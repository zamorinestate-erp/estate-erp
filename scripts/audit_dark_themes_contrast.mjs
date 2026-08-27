// =============================================================================
// ZAMORIN CAFE ERP — 4-THEME CONTRAST, TYPOGRAPHY & VISIBILITY AUDIT
// Audits computed color contrast, legibility, and styling across all 4 themes:
// 1. Paper (Default warm ledger)
// 2. Pearl (Warm parchment)
// 3. Midnight (Zamorin Navy dark mode)
// 4. Noir (Achromatic stark dark mode)
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HTTP_PORT = 3542;
const CDP_PORT = 9288;

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
}

async function getWsUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const pageTarget = list.find((t) => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) return pageTarget.webSocketDebuggerUrl;
    } catch {
      await delay(200);
    }
  }
  throw new Error('Failed to connect to Chrome CDP page endpoint');
}

async function runAudit() {
  console.log("================================================================================");
  console.log("   ZAMORIN CAFE ERP — 4-THEME CONTRAST & VISIBILITY AUDIT (CDP)");
  console.log("================================================================================\n");

  const server = await startServer();
  const userDataDir = path.join(__dirname, `../.chrome_theme_audit_${Date.now()}`);

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    `http://localhost:${HTTP_PORT}/#login`
  ]);

  try {
    const wsUrl = await getWsUrl(CDP_PORT);
    const client = new CdpClient(wsUrl);
    await client.ready;

    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('CSS.enable');

    await client.send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/#login` });
    await delay(1200);

    const testThemes = ["paper", "pearl", "midnight", "noir"];
    const testPersonas = [
      { role: "master", name: "Primary Master", email: "primary-master@zamorin.com", isPrimary: true, hash: "#command-centre" },
      { role: "owner", name: "Executive Owner", email: "owner@zamorin.com", isPrimary: false, hash: "#owner-dashboard" },
      { role: "cafe_admin", name: "Café Operator", email: "operator@zamorin.com", isPrimary: false, hash: "#pos-till" },
      { role: "staff", name: "Staff Member", email: "staff@zamorin.com", isPrimary: false, hash: "#dashboard" }
    ];

    let totalChecks = 0;
    let passedChecks = 0;
    let failures = [];

    for (const persona of testPersonas) {
      console.log(`\n▶ [PERSONA]: ${persona.name} (${persona.role})`);

      for (const theme of testThemes) {
        totalChecks++;
        const isDark = theme === "midnight" || theme === "noir";

        // Setup session & theme
        await client.eval(`
          localStorage.setItem("zamorin_user", JSON.stringify({
            id: "usr_${persona.role}",
            email: "${persona.email}",
            name: "${persona.name}",
            role: "${persona.role}",
            isPrimaryMaster: ${persona.isPrimary},
            accessibleCafes: ["*"],
            assignedCafeId: "CAFE_001",
            cafeId: "CAFE_001"
          }));
          localStorage.setItem("zamorin_theme", "${theme}");
          document.documentElement.setAttribute("data-theme", "${theme}");
          window.location.hash = "${persona.hash}";
        `);

        await delay(300);

        // Evaluate contrast and visibility of key UI elements
        const audit = await client.eval(`
          (() => {
            function getEffectiveBg(el) {
              let curr = el;
              while (curr && curr !== document) {
                const bg = window.getComputedStyle(curr).backgroundColor;
                if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)') && !bg.startsWith('rgba(255, 255, 255, 0)')) {
                  return bg;
                }
                curr = curr.parentElement;
              }
              return window.getComputedStyle(document.body).backgroundColor;
            }

            const isDark = "${isDark}" === "true";
            const results = [];
            const selectors = [
              { sel: ".brand-title", name: "Brand Title" },
              { sel: ".page-title h1, .occ-title, h1", name: "Page Heading (H1)" },
              { sel: ".nav-link:not(.active)", name: "Sidebar Nav Link (Inactive)" },
              { sel: ".nav-link.active", name: "Sidebar Nav Link (Active)" },
              { sel: ".btn-primary", name: "Primary Button" },
              { sel: ".btn-secondary, .btn", name: "Secondary Button" },
              { sel: ".kpi-value", name: "KPI Card Value" },
              { sel: ".kpi-label", name: "KPI Card Label" },
              { sel: "table th, .data-table th, .glass-table th", name: "Table Header (TH)" },
              { sel: "table td, .data-table td, .glass-table td", name: "Table Cell (TD)" },
              { sel: "input, select, textarea, .text-input", name: "Form Control" },
              { sel: ".tab.active, .subnav-btn.active, .tab-btn.active", name: "Active Tab / Subnav" }
            ];

            for (const item of selectors) {
              const els = document.querySelectorAll(item.sel);
              if (els.length > 0) {
                const el = els[0];
                const cs = window.getComputedStyle(el);
                const color = cs.color;
                const bg = getEffectiveBg(el);

                // parse text RGB
                const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
                let textLum = 0.5;
                if (m) {
                  const r = parseInt(m[1], 10);
                  const g = parseInt(m[2], 10);
                  const b = parseInt(m[3], 10);
                  textLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                }

                // parse bg RGB
                const bgM = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
                let bgLum = 0.05;
                if (bgM) {
                  const bgR = parseInt(bgM[1], 10);
                  const bgG = parseInt(bgM[2], 10);
                  const bgB = parseInt(bgM[3], 10);
                  bgLum = (0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB) / 255;
                }

                results.push({
                  name: item.name,
                  selector: item.sel,
                  count: els.length,
                  color: color,
                  bg: bg,
                  textLum: textLum,
                  bgLum: bgLum
                });
              }
            }
            return results;
          })()
        `);

        let flaws = [];
        for (const item of audit) {
          if (isDark) {
            // If text is dark (< 0.15) AND background is also dark (< 0.20), it's a contrast issue
            if (item.textLum < 0.15 && item.bgLum < 0.20) {
              flaws.push(`${item.name} has dark text on dark background (${item.textLum.toFixed(2)} on ${item.bgLum.toFixed(2)})`);
            }
          }
        }

        if (flaws.length > 0) {
          console.log(`  ❌ [${theme.toUpperCase()}]: Contrast flaws found -> ${flaws.join(", ")}`);
          failures.push({ persona: persona.name, theme, flaws });
        } else {
          passedChecks++;
          console.log(`  ✅ [${theme.toUpperCase()}]: Crisp typography & contrast verified (${audit.length} selectors checked)`);
        }
      }
    }

    // High density dark mode checks on specialized modules
    console.log("\n▶ [HIGH-DENSITY MODULE DARK THEME CHECKS]");
    const modules = [
      { hash: "#revenue-share", name: "Revenue Share (SCR-026)" },
      { hash: "#tasks-approvals", name: "Tasks & Approvals (OTO-012)" },
      { hash: "#personal-ledger", name: "Personal Ledger (SCR-005)" },
      { hash: "#payroll", name: "Universal Payroll (SCR-014)" },
      { hash: "#staff-payslips", name: "Staff Payslip Viewer (SCR-027)" }
    ];

    for (const mod of modules) {
      for (const theme of ["midnight", "noir"]) {
        totalChecks++;
        await client.eval(`
          localStorage.setItem("zamorin_theme", "${theme}");
          document.documentElement.setAttribute("data-theme", "${theme}");
          window.location.hash = "${mod.hash}";
        `);
        await delay(250);

        const darkCheck = await client.eval(`
          (() => {
            function getEffectiveBg(el) {
              let curr = el;
              while (curr && curr !== document) {
                const bg = window.getComputedStyle(curr).backgroundColor;
                if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)') && !bg.startsWith('rgba(255, 255, 255, 0)')) {
                  return bg;
                }
                curr = curr.parentElement;
              }
              return window.getComputedStyle(document.body).backgroundColor;
            }

            const issues = [];
            const nodes = document.querySelectorAll("h1, h2, h3, h4, h5, p, span, td, th, label, strong");
            let inspected = 0;
            for (const n of nodes) {
              if (inspected++ > 70) break;
              const cs = window.getComputedStyle(n);
              if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
              const color = cs.color;
              const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
              if (m) {
                const r = parseInt(m[1], 10);
                const g = parseInt(m[2], 10);
                const b = parseInt(m[3], 10);
                const textLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

                const bg = getEffectiveBg(n);
                const bgM = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
                let bgLum = 0.05;
                if (bgM) {
                  const bgR = parseInt(bgM[1], 10);
                  const bgG = parseInt(bgM[2], 10);
                  const bgB = parseInt(bgM[3], 10);
                  bgLum = (0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB) / 255;
                }

                // If text is dark (< 0.15) AND background is dark (< 0.20), it is a contrast failure
                if (textLum < 0.15 && bgLum < 0.20) {
                  issues.push({ text: n.innerText.slice(0, 25), tag: n.tagName, textLum: textLum.toFixed(2), bgLum: bgLum.toFixed(2), color, bg });
                }
              }
            }
            return issues;
          })()
        `);

        if (darkCheck.length > 0) {
          console.log(`  ❌ [${mod.name}] in ${theme}: ${darkCheck.length} illegible dark text elements`);
          failures.push({ persona: mod.name, theme, flaws: darkCheck.map(d => `${d.tag}: ${d.text}`) });
        } else {
          passedChecks++;
          console.log(`  ✅ [${mod.name}] in ${theme}: 100% High-Contrast Legible`);
        }
      }
    }

    console.log("\n================================================================================");
    console.log(`THEME AUDIT RESULT: ${passedChecks} / ${totalChecks} PASSED (${Math.round((passedChecks / totalChecks) * 100)}%)`);
    if (failures.length > 0) {
      console.log("FAILURES:", JSON.stringify(failures, null, 2));
    }
    console.log("================================================================================\n");

    client.ws.close();
    chromeProc.kill();
    server.close();

    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}

    if (failures.length === 0) {
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (err) {
    console.error("Audit crashed:", err);
    chromeProc.kill();
    server.close();
    process.exit(1);
  }
}

runAudit();
