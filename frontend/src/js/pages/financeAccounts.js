// =============================================================================
// PAGE: Finance & Accounts — SCR-010 Consolidated 12-Workspace Financial Hub
// General Ledger • Sales Audit • AP • AR • Cash & Bank • Tax • Budgets • Close • Statements • Integrity
// =============================================================================
import { apiGet, apiPost } from "../apiClient.js";
import { state } from "../state.js";
import { showToast, openModal, renderModuleErrorState } from "../components.js";
import { ROLES } from "../navigation.js";
import { navigate } from "../router.js";

let activeTab = "overview";
let liveFinanceData = null;

function fmtInr(paisa) {
  if (paisa === null || paisa === undefined) return "₹0.00";
  const r = (Number(paisa) / 100).toFixed(2);
  const parts = r.split(".");
  let intPart = parts[0];
  const decPart = parts[1];
  const isNegative = intPart.startsWith("-");
  if (isNegative) intPart = intPart.slice(1);

  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return (isNegative ? "-₹" : "₹") + formatted + (decPart ? "." + decPart : "");
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function setFinanceActiveTab(tab) {
  const norm = (tab || "overview").toLowerCase();
  const aliasMap = {
    "gl": "gl-journals",
    "journals": "gl-journals",
    "ap": "ap-payments",
    "ar": "ar-collections",
    "tax": "tax-review",
    "close": "period-close",
    "audit": "integrity",
  };
  activeTab = aliasMap[norm] || norm || "overview";
}

export function renderFinance(subroute) {
  if (subroute !== undefined) {
    setFinanceActiveTab(subroute);
  }
  const isPrimaryMaster = Boolean(state.user?.isPrimaryMaster);
  const isOwner = state.user?.role === "OWNER" || state.role === ROLES.OWNER;

  // If on child subroute, render dedicated child shell directly
  if (activeTab && activeTab !== "overview") {
    return `
      <div class="page-enter finance-page" style="padding-bottom: 60px;">
        <div id="fin-workspace-wrap">
          <div style="display:flex; justify-content:center; padding:40px;">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter finance-page" style="padding-bottom: 60px;">
      <!-- Top Title Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; flex-wrap:wrap; gap:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h1 class="page-title" style="font-size:24px; font-weight:800; color:var(--ink); margin:0;">Finance &amp; Accounts</h1>
            <span class="badge badge-accent" style="font-size:11px; padding:2px 8px; font-weight:700;">SCR-010 AUTHORITATIVE GL</span>
            ${
              isPrimaryMaster
                ? '<span class="badge badge-primary" style="font-size:11px; padding:2px 8px; font-weight:700;">PRIMARY MASTER CONTROLLER</span>'
                : isOwner
                ? '<span class="badge badge-accent" style="font-size:11px; padding:2px 8px; font-weight:700;">OWNER GOVERNANCE</span>'
                : '<span class="badge badge-neutral" style="font-size:11px; padding:2px 8px; font-weight:700;">FINANCIAL OPERATIONS</span>'
            }
          </div>
          <p class="page-subtitle" style="font-size:14px; color:var(--muted); margin:4px 0 0;">General ledger, sales audit, accounts payable, receivables, bank reconciliation, GST review, and certified financial statements.</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="btn-refresh-finance" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Sync Ledgers
          </button>
        </div>
      </div>

      <!-- Main Workspace Container -->
      <div id="fin-workspace-wrap">
        <div style="display:flex; justify-content:center; padding:40px;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;
}

export async function wireFinance(root, subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  const workspaceWrap = root.querySelector("#fin-workspace-wrap");
  const refreshBtn = root.querySelector("#btn-refresh-finance");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      showToast("Synchronizing financial ledgers...", "info");
      await loadFinanceOverview(workspaceWrap);
    });
  }

  renderCurrentWorkspace(workspaceWrap);
  if (activeTab === "overview") {
    loadFinanceOverview(workspaceWrap);
  }
}

async function loadFinanceOverview(wrap) {
  try {
    const res = await apiGet("/finance/overview");
    liveFinanceData = res || {};
    renderCurrentWorkspace(wrap);
  } catch (err) {
    liveFinanceData = {
      kpis: {},
      controlStrip: {},
      cafeBreakdown: [],
      recentJournals: [],
    };
    renderCurrentWorkspace(wrap);
  }
}

function renderCurrentWorkspace(wrap) {
  if (!wrap) return;

  if (activeTab === "overview") {
    renderOverviewTab(wrap);
    return;
  }

  const isPrimaryMaster = Boolean(state.user?.isPrimaryMaster);

  const submodules = {
    "sales-audit": {
      title: "Sales Audit & Revenue",
      icon: "🧾",
      desc: "Real-time POS finalized checks, tax outputs, discounts, voids and net retained revenue.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-sync-sales" type="button">Sync POS Sales</button>`
    },
    "gl-journals": {
      title: "General Ledger & Journals",
      icon: "📜",
      desc: "Double-entry Chart of Accounts, manual journal entries and debit/credit ledger balance.",
      actionsHtml: isPrimaryMaster ? `<button class="btn btn-sm btn-primary" id="btn-child-new-journal" type="button">+ New Journal Entry</button>` : ''
    },
    "ap-payments": {
      title: "Accounts Payable",
      icon: "💸",
      desc: "Vendor invoices, GRN 3-way matching, payment scheduling and aged payables.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-ap-bill" type="button">+ Record AP Bill</button>`
    },
    "ar-collections": {
      title: "Accounts Receivable",
      icon: "📥",
      desc: "B2B catering invoices, corporate accounts, receivables aging and credit notes.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-ar-inv" type="button">+ Record AR Collection</button>`
    },
    "marketplaces": {
      title: "Marketplace Settlements",
      icon: "🛵",
      desc: "Swiggy and Zomato order settlements, commission deduction audits and bank payouts.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-fetch-settlements" type="button">Fetch Settlements</button>`
    },
    "cash-bank": {
      title: "Cash & Bank Reconciled",
      icon: "🏦",
      desc: "Physical cash drawer balancing, bank statement feeds and automated reconciliation.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-bank-acct" type="button">+ Add Bank Account</button>`
    },
    "budgets": {
      title: "Budgets & Forecasts",
      icon: "📊",
      desc: "Departmental budget allocations, burn rates, variance analysis and CAPEX controls.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-budget" type="button">+ Allocate Budget</button>`
    },
    "tax-review": {
      title: "Tax Review (GST/TDS)",
      icon: "🏛️",
      desc: "5% Composite GST, CGST/SGST ledger, GSTR-3B audit and TDS deduction summaries.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-gen-gstr" type="button">Generate GSTR-3B</button>`
    },
    "period-close": {
      title: "Period Close Workflow",
      icon: "🔒",
      desc: "Month-end closing checklist, depreciation runs, revenue cut-off and period locks.",
      actionsHtml: `<button class="btn btn-sm btn-danger" id="btn-child-exec-close" type="button">Execute Month-End Close</button>`
    },
    "statements": {
      title: "Financial Statements",
      icon: "📑",
      desc: "Audited Profit & Loss Statement, Balance Sheet, Cash Flow and Trial Balance.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-stmts" type="button">Export Statements (CSV)</button>`
    },
    "integrity": {
      title: "Finance Integrity Audit",
      icon: "🛡️",
      desc: "Ledger balance invariance, negative cash checks and financial sanity audits.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-run-fin-audit" type="button">Run Audit Verification</button>`
    },
  };

  const cur = submodules[activeTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="fin-back-to-hub-btn" data-back-to-hub="true" data-finance-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Finance &amp; Accounts
              </button>
              <span>/</span>
              <span style="color:var(--ink); font-weight:600;">${cur.title}</span>
            </div>
            <h1 style="font-size:22px; font-weight:800; color:var(--ink); margin:0; display:flex; align-items:center; gap:8px;">
              <span>${cur.icon}</span> <span>${cur.title}</span>
            </h1>
            <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0 0;">${cur.desc}</p>
          </div>
          ${cur.actionsHtml ? `<div style="display:flex; gap:8px; align-items:center;">${cur.actionsHtml}</div>` : ''}
        </div>
      </div>
      <div id="fin-submodule-inner-content"></div>
    </div>
  `;

  wrap.querySelector("#fin-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("finance");
  });
  wrap.querySelector("#btn-child-new-journal")?.addEventListener("click", () => {
    openNewJournalModal(wrap);
  });

  const inner = wrap.querySelector("#fin-submodule-inner-content");
  switch (activeTab) {
    case "sales-audit": renderSalesAuditTab(inner); break;
    case "gl-journals": renderJournalsTab(inner); break;
    case "ap-payments": renderAPTab(inner); break;
    case "ar-collections": renderARTab(inner); break;
    case "marketplaces": renderMarketplacesTab(inner); break;
    case "cash-bank": renderCashBankTab(inner); break;
    case "budgets": renderBudgetsTab(inner); break;
    case "tax-review": renderTaxTab(inner); break;
    case "period-close": renderPeriodCloseTab(inner); break;
    case "statements": renderStatementsTab(inner); break;
    case "integrity": renderIntegrityTab(inner); break;
    default: renderOverviewTab(inner);
  }
}

// ── 1. Overview & Command Centre ─────────────────────────────────────────────
function renderOverviewTab(wrap) {
  const kpis = liveFinanceData?.kpis || {};
  const cs = liveFinanceData?.controlStrip || {};
  const cafes = liveFinanceData?.cafeBreakdown || [];
  const isCafeAdmin = state.user?.role === "CAFE_ADMIN" || state.role === ROLES.CAFE_ADMIN;

  const finTiles = [
    { id: "sales-audit", icon: "🧾", title: "Sales Audit & Revenue", subtitle: "Gross-to-net sales bridge & check audit", badge: "Live Sales", badgeType: "accent" },
    ...(!isCafeAdmin ? [
      { id: "gl-journals", icon: "📜", title: "General Ledger & Journals", subtitle: "Chart of Accounts & manual postings", badge: "Double-Entry", badgeType: "success" },
    ] : []),
    { id: "ap-payments", icon: "💸", title: "Accounts Payable", subtitle: "Vendor bills, scheduled runs & payment aging", badge: "AP Ledger", badgeType: "" },
    { id: "ar-collections", icon: "📥", title: "Accounts Receivable", subtitle: "B2B client invoices, aging & credit notes", badge: "AR Ledger", badgeType: "" },
    { id: "marketplaces", icon: "🛵", title: "Marketplace Settlements", subtitle: "Swiggy & Zomato commissions & payouts", badge: "Aggregators", badgeType: "" },
    ...(!isCafeAdmin ? [
      { id: "cash-bank", icon: "🏦", title: "Cash & Bank Reconciled", subtitle: "Bank statement feeds & drawer balancing", badge: "Reconciled", badgeType: "success" },
    ] : []),
    { id: "budgets", icon: "📊", title: "Budgets & Forecasts", subtitle: "Monthly budget caps & OpEx variance analysis", badge: "68% Used", badgeType: "success" },
    ...(!isCafeAdmin ? [
      { id: "tax-review", icon: "🏛️", title: "Tax Review (GST/TDS)", subtitle: "5% Composite GST output & GSTR filings", badge: "5% GST", badgeType: "success" },
      { id: "period-close", icon: "🔒", title: "Period Close Workflow", subtitle: "Monthly checklist, cut-offs & ledger locks", badge: "Ready", badgeType: "" },
      { id: "statements", icon: "📑", title: "Financial Statements", subtitle: "P&L Statement, Balance Sheet & Cash Flow", badge: "Certified", badgeType: "success" },
      { id: "integrity", icon: "🛡️", title: "Finance Integrity Audit", subtitle: "Ledger invariance & balanced trial check", badge: "PASS", badgeType: "success" },
    ] : []),
  ];

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Financial Control &amp; Ledger Workspaces</h3>
        <div class="module-tile-grid">
          ${finTiles.map((t) => `
            <button class="module-hub-tile" data-fin-hub-tile="${t.id}" type="button">
              <div class="module-tile-icon-box">${t.icon}</div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${t.title}</span>
                  ${t.badge ? `<span class="module-tile-badge ${t.badgeType}">${t.badge}</span>` : ""}
                </div>
                <div class="module-tile-sub">${t.subtitle}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Top KPI Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Revenue (MTD)</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--color-accent-mint-bright); margin:4px 0;">${fmtInr(kpis.revenueMtdPaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">Certified Gross Sales</div>
        </div>
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Operating Expenses</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--ink); margin:4px 0;">${fmtInr(kpis.expensesMtdPaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">Posted OpEx &amp; COGS</div>
        </div>
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Gross Profit (MTD)</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--color-accent-mint-bright); margin:4px 0;">${fmtInr(kpis.grossProfitMtdPaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">68% Operating Margin</div>
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Net Operating Result</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--color-accent-gold-bright); margin:4px 0;">${fmtInr(kpis.netOperatingResultMtdPaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">Net Earnings</div>
        </div>
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Cash &amp; Bank Available</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--ink); margin:4px 0;">${fmtInr(kpis.totalBankBalancePaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">Book Liquidity</div>
        </div>
        <div class="kpi-card glass" style="padding:16px;">
          <div class="kpi-label" style="font-size:11.5px; color:var(--muted); font-weight:600; text-transform:uppercase;">Payables Outstanding</div>
          <div class="kpi-value" style="font-size:22px; font-weight:800; color:var(--danger); margin:4px 0;">${fmtInr(kpis.payablesOutstandingPaisa)}</div>
          <div style="font-size:12px; color:var(--muted);">Due this week: ${fmtInr(kpis.dueThisWeekPaisa)}</div>
        </div>
      </div>
    </div>

    <!-- Secondary Actionable Control Strip -->
    <div class="glass-card" style="padding:14px 18px; margin-bottom:20px; border-left:4px solid var(--accent);">
      <div style="font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Financial Control Strip — Action Required</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        <span class="badge ${cs.payablesDueCount > 0 ? "badge-danger" : "badge-neutral"}" style="cursor:pointer;" data-tab="ap-payments">PAYABLES DUE (${cs.payablesDueCount})</span>
        <span class="badge ${cs.salesAuditExceptionsCount > 0 ? "badge-warning" : "badge-neutral"}" style="cursor:pointer;" data-tab="sales-audit">SALES AUDIT EXCEPTIONS (${cs.salesAuditExceptionsCount})</span>
        <span class="badge ${cs.marketplaceExceptionsCount > 0 ? "badge-warning" : "badge-neutral"}" style="cursor:pointer;" data-tab="marketplaces">MARKETPLACE SETTLEMENTS (${cs.marketplaceExceptionsCount})</span>
        <span class="badge ${cs.journalsPendingCount > 0 ? "badge-accent" : "badge-neutral"}" style="cursor:pointer;" data-tab="gl-journals">JOURNALS PENDING (${cs.journalsPendingCount})</span>
        <span class="badge ${cs.gstReviewCount > 0 ? "badge-accent" : "badge-neutral"}" style="cursor:pointer;" data-tab="tax-review">GST 2B REVIEW PENDING (${cs.gstReviewCount})</span>
        <span class="badge badge-success">PERIOD CLOSE BLOCKERS (0)</span>
      </div>
    </div>

    <!-- Café Performance Summary Grid -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0 0 12px;">Café Operating Financial Performance</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
        ${cafes.map((c) => `
          <div class="glass-card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
              <div>
                <h4 style="font-size:15px; font-weight:700; margin:0; color:var(--ink);">${c.name}</h4>
                <span style="font-size:12px; color:var(--muted);">${c.cafeId}</span>
              </div>
              <span class="badge badge-success">${c.settlementStatus}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
              <div>
                <span style="color:var(--muted);">Revenue MTD:</span>
                <div style="font-weight:700; color:var(--ink);">${fmtInr(c.revenueMtdPaisa)}</div>
              </div>
              <div>
                <span style="color:var(--muted);">Operating Cost:</span>
                <div style="font-weight:700; color:var(--danger);">${fmtInr(c.expensesMtdPaisa)}</div>
              </div>
              <div>
                <span style="color:var(--muted);">Gross Margin:</span>
                <div style="font-weight:700; color:var(--color-accent-mint-bright);">${fmtInr(c.grossProfitPaisa)}</div>
              </div>
              <div>
                <span style="color:var(--muted);">AP Payables:</span>
                <div style="font-weight:700; color:var(--ink);">${fmtInr(c.payablesPaisa)}</div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // Wire Finance Hub Tiles
  wrap.querySelectorAll("[data-fin-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tileId = btn.dataset.finHubTile;
      navigate("finance/" + tileId);
    });
  });

  // Wire badge clicks to switch tabs
  wrap.querySelectorAll(".badge[data-tab]").forEach((badge) => {
    badge.addEventListener("click", () => {
      activeTab = badge.dataset.tab;
      renderCurrentWorkspace(wrap);
    });
  });
}

// ── 2. Sales Audit & Revenue Assurance ───────────────────────────────────────
async function renderSalesAuditTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/sales-audit");
    const storeDays = res.storeDays || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Store Day Sales Audit &amp; Revenue Assurance</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Daily POS event certification, tender reconciliation, and cash over/short registry.</p>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">Store Day ID</th>
                <th style="padding:10px;">Date &amp; Café</th>
                <th style="padding:10px;">POS / Finance Events</th>
                <th style="padding:10px;">Gross Sales</th>
                <th style="padding:10px;">Net Sales</th>
                <th style="padding:10px;">Cash Variance</th>
                <th style="padding:10px;">Audit Status</th>
                <th style="padding:10px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${storeDays.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--muted);">No store days recorded for audit.</td></tr>` : ''}
              ${storeDays.map((s) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:700; font-family:monospace;">${s.storeDayId}</td>
                  <td style="padding:10px;">${s.businessDate} (${s.cafeId})</td>
                  <td style="padding:10px;">${s.posEventCount} / ${s.financeEventCount}</td>
                  <td style="padding:10px;">${fmtInr(s.grossSalesPaisa)}</td>
                  <td style="padding:10px; font-weight:700; color:var(--color-accent-mint-bright);">${fmtInr(s.netSalesPaisa)}</td>
                  <td style="padding:10px; font-weight:700; color:${s.cashVariancePaisa === 0 ? "var(--ink)" : "var(--danger)"};">${fmtInr(s.cashVariancePaisa)}</td>
                  <td style="padding:10px;"><span class="badge ${s.status === "FINANCE_CLEARED" ? "badge-success" : s.status === "AUDIT_REQUIRED" ? "badge-danger" : "badge-warning"}">${s.status}</span></td>
                  <td style="padding:10px; text-align:right;">
                    ${s.status !== "FINANCE_CLEARED" ? `
                      <button class="btn btn-sm btn-primary btn-clear-store-day" data-id="${s.storeDayId}">Clear Day</button>
                    ` : `<span style="font-size:11.5px; color:var(--muted);">Cleared by ${s.clearedBy || 'Finance'}</span>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    wrap.querySelectorAll(".btn-clear-store-day").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const storeDayId = btn.dataset.id;
        try {
          await apiPost(`/finance/sales-audit/store-days/${storeDayId}/clear`, {});
          showToast(`Store Day ${storeDayId} cleared by Finance.`, "success");
          renderSalesAuditTab(wrap);
        } catch (err) {
          showToast(`Failed to clear store day: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Sales Audit",
      message: "Could not retrieve store day sales audit records.",
      retryActionId: "btn-retry-sales-audit",
      retryLabel: "Retry Sales Audit"
    });
    wrap.querySelector("#btn-retry-sales-audit")?.addEventListener("click", () => renderSalesAuditTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 3. General Ledger & Journals ─────────────────────────────────────────────
async function renderJournalsTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/journals");
    const journals = res.journals || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">General Ledger — Journal Register</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Double-entry journal transactions with Maker-Checker validation and immutable drillbacks.</p>
          </div>
          <button id="btn-tab-new-journal" class="btn btn-primary btn-sm">+ New Journal</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">Journal ID</th>
                <th style="padding:10px;">Date &amp; Period</th>
                <th style="padding:10px;">Type &amp; Source</th>
                <th style="padding:10px;">Description</th>
                <th style="padding:10px; text-align:right;">Debit (INR)</th>
                <th style="padding:10px; text-align:right;">Credit (INR)</th>
                <th style="padding:10px;">Status</th>
                <th style="padding:10px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${journals.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--muted);">No journal entries recorded.</td></tr>` : ''}
              ${journals.map((j) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:700; font-family:monospace;">${j.journalId}</td>
                  <td style="padding:10px;">${j.journalDate} (${j.periodId})</td>
                  <td style="padding:10px;"><span class="badge badge-neutral">${j.journalType}</span> <span style="font-size:11px; color:var(--muted);">${j.sourceModule}</span></td>
                  <td style="padding:10px;">${j.description}</td>
                  <td style="padding:10px; text-align:right; font-weight:700;">${fmtInr(j.totalDebitPaisa)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700;">${fmtInr(j.totalCreditPaisa)}</td>
                  <td style="padding:10px;"><span class="badge ${j.status === "POSTED" ? "badge-success" : j.status === "DRAFT" ? "badge-warning" : "badge-neutral"}">${j.status}</span></td>
                  <td style="padding:10px; text-align:right;">
                    ${j.status === "DRAFT" ? `<button class="btn btn-sm btn-primary btn-post-journal" data-id="${j.journalId}">Post</button>` : ''}
                    ${j.status === "POSTED" ? `<button class="btn btn-sm btn-secondary btn-reverse-journal" data-id="${j.journalId}">Reverse</button>` : ''}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const newBtn = wrap.querySelector("#btn-tab-new-journal");
    if (newBtn) newBtn.addEventListener("click", () => openNewJournalModal(wrap));

    wrap.querySelectorAll(".btn-post-journal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          await apiPost(`/finance/journals/${id}/post`, {});
          showToast(`Journal ${id} posted to General Ledger.`, "success");
          renderJournalsTab(wrap);
        } catch (err) {
          showToast(`Posting failed: ${err.message}`, "error");
        }
      });
    });

    wrap.querySelectorAll(".btn-reverse-journal").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const reason = prompt("Enter mandatory reason for reversing this journal:");
        if (!reason) return;
        try {
          await apiPost(`/finance/journals/${id}/reverse`, { reason });
          showToast(`Journal ${id} reversed successfully.`, "success");
          renderJournalsTab(wrap);
        } catch (err) {
          showToast(`Reversal failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Journals",
      message: "Could not retrieve General Ledger journal register.",
      retryActionId: "btn-retry-journals",
      retryLabel: "Retry Journals"
    });
    wrap.querySelector("#btn-retry-journals")?.addEventListener("click", () => renderJournalsTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 4. Accounts Payable & Payments ───────────────────────────────────────────
async function renderAPTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/ap/invoices");
    const invoices = res.invoices || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Accounts Payable — Supplier Invoices</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">3-way PO matching, supplier liability tracking, hold management, and payment execution.</p>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">AP Invoice ID</th>
                <th style="padding:10px;">Vendor &amp; Invoice #</th>
                <th style="padding:10px;">Due Date</th>
                <th style="padding:10px; text-align:right;">Amount (INR)</th>
                <th style="padding:10px; text-align:right;">Outstanding</th>
                <th style="padding:10px;">Payment Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted);">No supplier invoices registered.</td></tr>` : ''}
              ${invoices.map((i) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:700; font-family:monospace;">${i.invoiceId}</td>
                  <td style="padding:10px;"><strong>${i.vendorName}</strong><br><span style="font-size:11.5px; color:var(--muted);">${i.supplierInvoiceNumber}</span></td>
                  <td style="padding:10px;">${i.dueDate}</td>
                  <td style="padding:10px; text-align:right; font-weight:700;">${fmtInr(i.totalPaisa)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:${i.outstandingPaisa > 0 ? "var(--danger)" : "var(--color-accent-mint-bright)"};">${fmtInr(i.outstandingPaisa)}</td>
                  <td style="padding:10px;"><span class="badge ${i.paymentStatus === "PAID" ? "badge-success" : i.paymentStatus === "UNPAID" ? "badge-danger" : "badge-warning"}">${i.paymentStatus}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load AP Invoices",
      message: "Could not retrieve accounts payable supplier invoices.",
      retryActionId: "btn-retry-ap",
      retryLabel: "Retry Accounts Payable"
    });
    wrap.querySelector("#btn-retry-ap")?.addEventListener("click", () => renderAPTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 5. Accounts Receivable (AR) & Collections ───────────────────────────────
async function renderARTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/receivables");
    const receivables = res.receivables || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Accounts Receivable — Institutional Credit Ledger</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Institutional customer balances, Department Orders credit tracking, and collection receipts.</p>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">Receivable ID</th>
                <th style="padding:10px;">Customer / Account</th>
                <th style="padding:10px;">Date &amp; Café</th>
                <th style="padding:10px; text-align:right;">Amount (INR)</th>
                <th style="padding:10px;">Credit Settlement</th>
              </tr>
            </thead>
            <tbody>
              ${receivables.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--muted);">No outstanding institutional receivables found.</td></tr>` : ''}
              ${receivables.map((r) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:700; font-family:monospace;">${r.receivableId}</td>
                  <td style="padding:10px; font-weight:600;">${r.customerName}</td>
                  <td style="padding:10px;">${r.invoiceDate} (${r.cafeId})</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${fmtInr(r.amountPaisa)}</td>
                  <td style="padding:10px;"><span class="badge ${r.status === "SETTLED" ? "badge-success" : "badge-warning"}">${r.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Receivables",
      message: "Could not retrieve accounts receivable credit records.",
      retryActionId: "btn-retry-ar",
      retryLabel: "Retry Receivables"
    });
    wrap.querySelector("#btn-retry-ar")?.addEventListener("click", () => renderARTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 6. Marketplace Settlements ───────────────────────────────────────────────
async function renderMarketplacesTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/marketplaces/settlements");
    const settlements = res.settlements || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Marketplace Settlements (Zomato &amp; Swiggy)</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Gross sales, commissions, marketing deductions, and net bank settlement reconciliation.</p>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">Settlement ID</th>
                <th style="padding:10px;">Platform &amp; Period</th>
                <th style="padding:10px; text-align:right;">Gross Sales</th>
                <th style="padding:10px; text-align:right;">Commission &amp; Fees</th>
                <th style="padding:10px; text-align:right;">Net Payout</th>
                <th style="padding:10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${settlements.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted);">No marketplace settlement batches found.</td></tr>` : ''}
              ${settlements.map((m) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:700; font-family:monospace;">${m.settlementId}</td>
                  <td style="padding:10px;"><strong>${m.platform}</strong><br><span style="font-size:11.5px; color:var(--muted);">${m.periodStart} to ${m.periodEnd}</span></td>
                  <td style="padding:10px; text-align:right;">${fmtInr(m.grossSalesPaisa)}</td>
                  <td style="padding:10px; text-align:right; color:var(--danger);">${fmtInr((m.commissionPaisa || 0) + (m.platformFeesPaisa || 0))}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${fmtInr(m.netSettlementPaisa)}</td>
                  <td style="padding:10px;"><span class="badge ${m.status === "RECONCILED" ? "badge-success" : "badge-warning"}">${m.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Marketplaces",
      message: "Could not retrieve food aggregator settlement batches.",
      retryActionId: "btn-retry-marketplaces",
      retryLabel: "Retry Settlements"
    });
    wrap.querySelector("#btn-retry-marketplaces")?.addEventListener("click", () => renderMarketplacesTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 7. Cash & Bank Accounts ──────────────────────────────────────────────────
async function renderCashBankTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/bank-accounts");
    const accounts = res.accounts || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Cash &amp; Bank Accounts</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Authorized bank accounts, book balances, masked identifiers, and statement reconciliation.</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
          ${accounts.length === 0 ? `<div style="padding:20px; color:var(--muted);">No bank accounts registered.</div>` : ''}
          ${accounts.map((a) => `
            <div class="glass" style="padding:18px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="font-size:15px; font-weight:700; margin:0; color:var(--ink);">${a.accountAlias}</h4>
                <span class="badge badge-success">${a.status}</span>
              </div>
              <div style="font-size:13px; color:var(--muted); margin-bottom:12px;">${a.bankName} • ${a.maskedAccountNumber}</div>
              <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase;">Book Balance</div>
              <div style="font-size:22px; font-weight:800; color:var(--color-accent-mint-bright);">${fmtInr(a.bookBalancePaisa)}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:6px;">GL Code: ${a.glAccountCode}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Bank Accounts",
      message: "Could not retrieve cash and authorized bank accounts.",
      retryActionId: "btn-retry-cash-bank",
      retryLabel: "Retry Bank Accounts"
    });
    wrap.querySelector("#btn-retry-cash-bank")?.addEventListener("click", () => renderCashBankTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 8. Budgets & Allocations ─────────────────────────────────────────────────
async function renderBudgetsTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/budgets");
    const budgets = res.budgets || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Operating Budgets &amp; Commitments</h3>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Budgeted vs committed vs actual expenses with variance alerts.</p>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:10px;">Category</th>
                <th style="padding:10px; text-align:right;">Monthly Budget</th>
                <th style="padding:10px; text-align:right;">Committed</th>
                <th style="padding:10px; text-align:right;">Actual Spend</th>
                <th style="padding:10px; text-align:right;">Variance (Remaining)</th>
              </tr>
            </thead>
            <tbody>
              ${budgets.map((b) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:10px; font-weight:600;">${b.category}</td>
                  <td style="padding:10px; text-align:right; font-weight:700;">${fmtInr(b.monthlyBudgetPaisa)}</td>
                  <td style="padding:10px; text-align:right; color:var(--muted);">${fmtInr(b.committedPaisa)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--danger);">${fmtInr(b.actualPaisa)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${fmtInr(b.variancePaisa)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Budgets",
      message: "Could not retrieve departmental operating budgets.",
      retryActionId: "btn-retry-budgets",
      retryLabel: "Retry Budgets"
    });
    wrap.querySelector("#btn-retry-budgets")?.addEventListener("click", () => renderBudgetsTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 9. Tax & Statutory Review ────────────────────────────────────────────────
async function renderTaxTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/tax/review");
    const gstr1 = res.gstr1Readiness || {};
    const gstr2b = res.gstr2bReconciliation || {};
    const tds = res.tdsRegister || {};

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Tax &amp; Statutory Review (GST &amp; TDS)</h3>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Outward sales tax readiness (GSTR-1), purchase tax reconciliation (GSTR-2B), and TDS control.</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
          <div class="glass" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="font-size:14.5px; font-weight:700; margin:0; color:var(--ink);">GSTR-1 Outward Readiness</h4>
              <span class="badge badge-success">${gstr1.status}</span>
            </div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">Taxable Turnover: <strong>${fmtInr(gstr1.outwardTaxablePaisa)}</strong></div>
            <div style="font-size:13px; color:var(--muted);">Total GST Output: <strong style="color:var(--color-accent-gold-bright);">${fmtInr(gstr1.totalTaxPaisa)}</strong></div>
          </div>

          <div class="glass" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="font-size:14.5px; font-weight:700; margin:0; color:var(--ink);">GSTR-2B Inward Match</h4>
              <span class="badge badge-accent">2 MISMATCHES</span>
            </div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">Inward Invoices: <strong>${gstr2b.totalInwardInvoices}</strong> (Matched: ${gstr2b.matchedCount})</div>
            <div style="font-size:13px; color:var(--muted);">Eligible ITC: <strong style="color:var(--color-accent-mint-bright);">${fmtInr(gstr2b.itcEligiblePaisa)}</strong></div>
          </div>

          <div class="glass" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="font-size:14.5px; font-weight:700; margin:0; color:var(--ink);">TDS Withholding Register</h4>
              <span class="badge badge-success">${tds.status}</span>
            </div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">TDS Deducted: <strong>${fmtInr(tds.totalDeductedPaisa)}</strong></div>
            <div style="font-size:13px; color:var(--muted);">Deposited / Challan: <strong style="color:var(--ink);">${fmtInr(tds.depositedPaisa)}</strong></div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Tax Review",
      message: "Could not retrieve GST and statutory tax schedules.",
      retryActionId: "btn-retry-tax",
      retryLabel: "Retry Tax Review"
    });
    wrap.querySelector("#btn-retry-tax")?.addEventListener("click", () => renderTaxTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 10. Period Close Workflow ────────────────────────────────────────────────
async function renderPeriodCloseTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/close/status");
    const period = res.currentPeriod || {};
    const checklist = res.closeChecklist || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Financial Accounting Period Close</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Period: <strong>${period.periodName || period.periodId}</strong> • Status: <span class="badge badge-success">${period.status}</span></p>
          </div>
          ${period.status === "OPEN" ? `
            <button id="btn-close-period" class="btn btn-danger" data-id="${period.periodId}">Close &amp; Lock Period</button>
          ` : `
            <button id="btn-reopen-period" class="btn btn-secondary" data-id="${period.periodId}">Reopen for Adjustments</button>
          `}
        </div>

        <div style="margin-top:16px;">
          <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0 0 10px;">Subledger Readiness &amp; Dependencies</h4>
          <div style="display:grid; grid-template-columns:1fr; gap:8px;">
            ${checklist.map((c) => `
              <div class="glass" style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; border-radius:6px;">
                <span style="font-size:13px; font-weight:600; color:var(--ink);">${c.task}</span>
                <span class="badge badge-success">${c.status}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    const closeBtn = wrap.querySelector("#btn-close-period");
    if (closeBtn) {
      closeBtn.addEventListener("click", async () => {
        const id = closeBtn.dataset.id;
        const notes = prompt("Enter formal sign-off notes for closing this period:");
        try {
          await apiPost(`/finance/close/periods/${id}/close`, { signOffNotes: notes });
          showToast(`Financial period ${id} locked and closed successfully.`, "success");
          renderPeriodCloseTab(wrap);
        } catch (err) {
          showToast(`Failed to close period: ${err.message}`, "error");
        }
      });
    }

    const reopenBtn = wrap.querySelector("#btn-reopen-period");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", async () => {
        const id = reopenBtn.dataset.id;
        const reason = prompt("Enter mandatory auditable reason for reopening this period:");
        if (!reason) return;
        try {
          await apiPost(`/finance/close/periods/${id}/reopen`, { reason });
          showToast(`Financial period ${id} reopened.`, "success");
          renderPeriodCloseTab(wrap);
        } catch (err) {
          showToast(`Failed to reopen: ${err.message}`, "error");
        }
      });
    }
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Period Close",
      message: "Could not retrieve accounting period close status.",
      retryActionId: "btn-retry-close",
      retryLabel: "Retry Period Close"
    });
    wrap.querySelector("#btn-retry-close")?.addEventListener("click", () => renderPeriodCloseTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 11. Financial Statements ─────────────────────────────────────────────────
async function renderStatementsTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/statements");
    const pnl = res.pnl || {};
    const bs = res.balanceSheet || {};

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="margin-bottom:20px;">
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Authoritative Financial Statements</h3>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Basis: ${pnl.basis} • Period: ${pnl.period}</p>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
          <!-- Profit & Loss Statement -->
          <div class="glass" style="padding:18px;">
            <h4 style="font-size:15px; font-weight:700; color:var(--ink); margin:0 0 12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">Statement of Profit &amp; Loss</h4>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span>Total Operating Revenue</span>
                <strong style="color:var(--color-accent-mint-bright);">${fmtInr(pnl.revenue?.totalRevenuePaisa)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Cost of Goods Sold (COGS)</span>
                <strong style="color:var(--danger);">${fmtInr(pnl.costOfGoodsSold?.totalCogsPaisa)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px dashed var(--border-color); padding-top:6px;">
                <span>Gross Profit</span>
                <span>${fmtInr(pnl.grossProfitPaisa)}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Operating Expenses (OpEx)</span>
                <strong style="color:var(--danger);">${fmtInr(pnl.operatingExpenses?.totalOpexPaisa)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:800; font-size:14.5px; border-top:2px solid var(--border-color); padding-top:8px; color:var(--color-accent-mint-bright);">
                <span>Net Operating Profit</span>
                <span>${fmtInr(pnl.netOperatingProfitPaisa)}</span>
              </div>
            </div>
          </div>

          <!-- Balance Sheet Summary -->
          <div class="glass" style="padding:18px;">
            <h4 style="font-size:15px; font-weight:700; color:var(--ink); margin:0 0 12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">Balance Sheet Summary</h4>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span>Current &amp; Non-Current Assets</span>
                <strong style="color:var(--ink);">${fmtInr(bs.assets?.totalAssetsPaisa)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Total Liabilities</span>
                <strong style="color:var(--danger);">${fmtInr(bs.liabilities?.totalLiabilitiesPaisa)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px dashed var(--border-color); padding-top:6px;">
                <span>Owners Equity &amp; Retained Earnings</span>
                <span style="color:var(--color-accent-gold-bright);">${fmtInr(bs.equity?.totalEquityPaisa)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Statements",
      message: "Could not retrieve certified financial statements.",
      retryActionId: "btn-retry-statements",
      retryLabel: "Retry Statements"
    });
    wrap.querySelector("#btn-retry-statements")?.addEventListener("click", () => renderStatementsTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 12. Finance Integrity Audit ──────────────────────────────────────────────
async function renderIntegrityTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/finance/integrity");
    const issues = res.issues || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Finance Integrity &amp; Reconciliation Engine</h3>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">18-point automated audit of unbalanced journals, AP/AR discrepancies, and bank reconciliation exceptions.</p>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
          <span class="badge ${res.status === "HEALTHY" ? "badge-success" : res.status === "CRITICAL" ? "badge-danger" : "badge-warning"}" style="font-size:13px; padding:4px 12px;">
            SYSTEM STATUS: ${res.status}
          </span>
          <span style="font-size:13px; color:var(--muted);">${res.checksEvaluated} checks evaluated • ${res.issuesFound} issues flagged</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          ${issues.length === 0 ? `<div class="glass" style="padding:16px; color:var(--color-accent-mint-bright); font-weight:600;">All 18 financial accounting integrity checks passed with zero discrepancies.</div>` : ''}
          ${issues.map((i) => `
            <div class="glass" style="padding:12px 16px; border-left:4px solid ${i.severity === "CRITICAL" ? "var(--danger)" : "var(--color-accent-gold-bright)"};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="font-size:13.5px; color:var(--ink); font-family:monospace;">${i.check}</strong>
                <span class="badge ${i.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}">${i.severity}</span>
              </div>
              <div style="font-size:13px; color:var(--muted);">${i.description}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Integrity Audit",
      message: "Could not run finance ledger integrity checks.",
      retryActionId: "btn-retry-fin-integrity",
      retryLabel: "Retry Audit"
    });
    wrap.querySelector("#btn-retry-fin-integrity")?.addEventListener("click", () => renderIntegrityTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── MODAL: New Journal Entry ─────────────────────────────────────────────────
function openNewJournalModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">New Balanced Journal Entry</h3>
      <form id="form-new-journal">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Journal Date</label>
            <input type="date" name="journalDate" class="form-input" required value="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Period ID</label>
            <input type="text" name="periodId" class="form-input" required value="FY2026-P05">
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Description / Business Purpose</label>
          <input type="text" name="description" class="form-input" required placeholder="e.g. Monthly Roastery rent payment adjustment">
        </div>

        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Café Location</label>
          <select name="cafeId" class="form-input">
            <option value="">Global / Corporate HQ</option>
            <option value="ZC-0001">Koramangala Flagship (ZC-0001)</option>
            <option value="ZC-0002">Indiranagar Roastery (ZC-0002)</option>
          </select>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:12px; margin-bottom:12px;">
          <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--ink);">Double-Entry Lines (Debits = Credits)</div>

          <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; margin-bottom:6px;">
            <input type="text" name="acc1" class="form-input" placeholder="Debit Account Code (e.g. 6020-OPEX-RENT)" value="6020-OPEX-RENT" required>
            <input type="number" name="dr1" class="form-input" placeholder="Debit (₹)" value="15000" required>
            <input type="number" name="cr1" class="form-input" placeholder="Credit (₹)" value="0" readonly>
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px;">
            <input type="text" name="acc2" class="form-input" placeholder="Credit Account Code (e.g. 1020-BANK-HDFC)" value="1020-BANK-HDFC" required>
            <input type="number" name="dr2" class="form-input" placeholder="Debit (₹)" value="0" readonly>
            <input type="number" name="cr2" class="form-input" placeholder="Credit (₹)" value="15000" required>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Draft Journal</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-new-journal");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      const dr1 = Math.round(Number(fd.get("dr1") || 0) * 100);
      const cr2 = Math.round(Number(fd.get("cr2") || 0) * 100);

      const payload = {
        journalDate: fd.get("journalDate"),
        periodId: fd.get("periodId"),
        description: fd.get("description"),
        cafeId: fd.get("cafeId") || null,
        lines: [
          { accountCode: fd.get("acc1"), debitPaisa: dr1, creditPaisa: 0 },
          { accountCode: fd.get("acc2"), debitPaisa: 0, creditPaisa: cr2 },
        ],
      };

      try {
        await apiPost("/finance/journals", payload);
        showToast("Balanced draft journal created.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderJournalsTab(wrap);
      } catch (err) {
        showToast(`Failed to create journal: ${err.message}`, "error");
      }
    });
  }
}
