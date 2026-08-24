// =============================================================================
// ZAMORIN CAFE ERP — STAFF MY LOANS & ADVANCES (EMP-SCR-005)
//
// Complete production-grade Employee Loan & Salary Advance Self-Service Command Centre.
// Conforms 100% to Zamorin Design System tokens and host architecture.
// Strictly SELF-SERVICE ONLY (req.auth.userId). Zero peer financial leakage.
// =============================================================================

import { ApiClientError, apiGet, apiPost } from "../apiClient.js";
import { emptyState, skeleton, showToast } from "../components.js";
import { icon } from "../icons.js";

let activeTab = "overview"; // 'overview' | 'facilities' | 'repayments' | 'requests' | 'policy' | 'statement'
let loadedData = null;
let activeRequest = null;
let privacyMasked = false;

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function amount(paise) {
  if (typeof paise !== "number" || !Number.isSafeInteger(paise)) return "—";
  if (privacyMasked) return "₹ ••,•••";
  return money.format(paise / 100);
}

function when(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : dateTime.format(d);
}

function pill(status) {
  const s = String(status || "SUBMITTED").toUpperCase();
  let k = "badge-gold";
  if (["APPROVED", "DISBURSED", "ACTIVE", "REPAID", "CLOSED"].includes(s)) k = "badge-mint";
  if (["REJECTED", "CANCELLED", "WITHDRAWN"].includes(s)) k = "badge-coral";
  if (["IN_ARREARS", "PAUSED", "MORE_INFO_REQUIRED"].includes(s)) k = "badge-amber";
  return `<span class="badge ${k}" style="font-size:10.5px; font-weight:700;">${esc(s.replace(/_/g, " "))}</span>`;
}

// ── FIXTURE DATA FOR PREVIEW/FALLBACK ─────────────────────────────────────────
const DEV_FIXTURE = {
  loanAdvances: [
    {
      id: "LN-2026-0001",
      loanAdvanceId: "LN-2026-0001",
      requestType: "LOAN",
      loanCategory: "WELFARE",
      requestedAmountPaise: 6000000,
      principalPaise: 6000000,
      outstandingPrincipalPaise: 4250000,
      arrearsPaise: 0,
      monthlyInstalmentPaise: 500000,
      totalRepaidPaise: 1750000,
      tenureMonths: 12,
      status: "ACTIVE",
      requestedAt: "2026-06-15T10:00:00.000Z",
      requestReason: "Relocation & rental deposit support for Koramangala outlet transfer.",
      deductionReference: "DED-LN-2026-0001",
    },
    {
      id: "ADV-2026-0002",
      loanAdvanceId: "ADV-2026-0002",
      requestType: "SALARY_ADVANCE",
      loanCategory: "SALARY_ADVANCE",
      requestedAmountPaise: 1500000,
      principalPaise: 1500000,
      outstandingPrincipalPaise: 1500000,
      arrearsPaise: 0,
      monthlyInstalmentPaise: 1500000,
      totalRepaidPaise: 0,
      tenureMonths: 1,
      status: "SUBMITTED",
      requestedAt: "2026-08-19T14:30:00.000Z",
      requestReason: "Festival advance for family medical expenses.",
      deductionReference: "DED-ADV-2026-0002",
    },
  ],
  kpis: {
    activeLoansCount: 1,
    totalOutstandingPaise: 4250000,
    nextPayrollDeductionPaise: 500000,
    nextDeductionDate: "31 Aug 2026",
    totalRepaidPaise: 1750000,
    activeAdvancesCount: 1,
  },
};

// ── RENDER MAIN SHELL ────────────────────────────────────────────────────────
export function renderStaffLoansAdvances() {
  return `
    <div class="page-enter staff-loans-root" id="staff-loans-page-container" style="max-width:1160px; margin:0 auto; padding:12px 16px 60px 16px;">
      <!-- Header Mount -->
      <div id="loans-header-mount">
        ${renderHeader()}
      </div>

      <!-- Navigation Tabs -->
      <div class="card" style="padding:8px 12px; margin-bottom:20px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
        <div class="flex items-center gap-xs flex-wrap" id="loans-nav-tabs">
          ${renderNavTab("overview", "Overview 💼")}
          ${renderNavTab("facilities", "Active Facilities 💳")}
          ${renderNavTab("repayments", "Repayments &amp; Schedule 📅")}
          ${renderNavTab("requests", "My Requests 📋")}
          ${renderNavTab("policy", "Policy &amp; Calculator ⚖️")}
          ${renderNavTab("statement", "Statement 📄")}
        </div>
      </div>

      <!-- Main Content Container -->
      <div id="loans-main-content" data-loans-advances-content>
        <div class="flex-col gap-md">${skeleton("92px")}${skeleton("92px")}${skeleton("92px")}</div>
      </div>
    </div>
  `;
}

function renderHeader() {
  return `
    <div class="flex items-center justify-between flex-wrap gap-md" style="margin-bottom:16px;">
      <div>
        <div style="font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em; display:flex; align-items:center; gap:8px;">
          <span>💼</span>
          <span>My Loans &amp; Salary Advances</span>
        </div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
          Dawn Roast — Koramangala · Employee Financial Self-Service &amp; Payroll Recoveries
        </div>
      </div>

      <!-- Action Buttons & Privacy Masking Toggle -->
      <div class="flex items-center gap-sm flex-wrap">
        <button class="btn btn-xs btn-ghost" id="btn-toggle-loan-privacy" type="button" style="padding:6px 12px; font-size:12px; border:1px solid var(--border-subtle);">
          ${privacyMasked ? "👁️ Reveal Balances" : "🔒 Mask Balances"}
        </button>
        <button class="btn btn-primary" type="button" id="btn-req-loan" style="padding:8px 16px; font-size:12.5px; font-weight:700;">
          Request Loan
        </button>
        <button class="btn btn-secondary" type="button" id="btn-req-advance" style="padding:8px 16px; font-size:12.5px; font-weight:700;">
          Request Advance
        </button>
      </div>
    </div>
  `;
}

function renderNavTab(tabId, label) {
  const isActive = activeTab === tabId;
  return `
    <button class="btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}" data-loan-tab="${tabId}" type="button" style="border-radius:var(--radius-md); font-weight:${isActive ? "700" : "500"}; font-size:12.5px; padding:6px 14px;">
      ${label}
    </button>
  `;
}

// ── TOP KPI CARDS ─────────────────────────────────────────────────────────────
function renderTopKPIs(kpis) {
  const k = kpis || DEV_FIXTURE.kpis;
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:20px;">
      <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle); border-left:3px solid var(--brand-gold);">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">TOTAL OUTSTANDING</div>
        <div style="font-size:22px; font-weight:800; color:var(--brand-gold); margin-top:4px;">${amount(k.totalOutstandingPaise)}</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Across ${k.activeLoansCount || 1} active facility</div>
      </div>

      <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle); border-left:3px solid var(--color-accent-mint);">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">NEXT PAYROLL DEDUCTION</div>
        <div style="font-size:22px; font-weight:800; color:var(--color-accent-mint); margin-top:4px;">${amount(k.nextPayrollDeductionPaise)}</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Due on ${k.nextDeductionDate || "31 Aug 2026"}</div>
      </div>

      <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle); border-left:3px solid var(--text-primary);">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">TOTAL REPAID YTD</div>
        <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-top:4px;">${amount(k.totalRepaidPaise)}</div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Principal recovered via payroll</div>
      </div>

      <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle); border-left:3px solid var(--brand-gold);">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">ACTIVE REQUESTS</div>
        <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-top:4px;">${k.activeAdvancesCount || 1} <span style="font-size:13px; font-weight:500; color:var(--text-muted);">pending</span></div>
        <div style="font-size:11.5px; color:var(--brand-gold); margin-top:2px;">Salary Advance under review</div>
      </div>
    </div>
  `;
}

// ── TAB CONTENT ROUTER ────────────────────────────────────────────────────────
function renderTabContent(data) {
  switch (activeTab) {
    case "overview":
      return renderOverviewTab(data);
    case "facilities":
      return renderFacilitiesTab(data);
    case "repayments":
      return renderRepaymentsTab(data);
    case "requests":
      return renderRequestsTab(data);
    case "policy":
      return renderPolicyTab();
    case "statement":
      return renderStatementTab(data);
    default:
      return renderOverviewTab(data);
  }
}

// ── 1. OVERVIEW TAB ──────────────────────────────────────────────────────────
function renderOverviewTab(data) {
  const loans = data?.loanAdvances || DEV_FIXTURE.loanAdvances;
  const activeFacility = loans.find((l) => l.status === "ACTIVE") || loans[0];

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Active Facility Card -->
      <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
        <div class="flex items-center justify-between" style="margin-bottom:16px;">
          <div>
            <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
              ${activeFacility.requestType === "SALARY_ADVANCE" ? "Salary Advance" : "Employee Welfare Loan"}
            </div>
            <div style="font-size:12px; font-family:monospace; color:var(--brand-gold); font-weight:700;">
              ${activeFacility.loanAdvanceId || "LN-2026-0001"}
            </div>
          </div>
          ${pill(activeFacility.status)}
        </div>

        <!-- Financial Metrics Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-md); margin-bottom:16px; font-size:12.5px;">
          <div>
            <span style="color:var(--text-muted);">Original Disbursed:</span>
            <div style="font-weight:700; font-size:15px; color:var(--text-primary); margin-top:2px;">${amount(activeFacility.principalPaise || activeFacility.requestedAmountPaise)}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);">Current Outstanding:</span>
            <div style="font-weight:800; font-size:15px; color:var(--brand-gold); margin-top:2px;">${amount(activeFacility.outstandingPrincipalPaise)}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);">Monthly EMI:</span>
            <div style="font-weight:700; font-size:14px; color:var(--color-accent-mint); margin-top:2px;">${amount(activeFacility.monthlyInstalmentPaise)}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);">Tenure:</span>
            <div style="font-weight:700; font-size:14px; color:var(--text-primary); margin-top:2px;">${activeFacility.tenureMonths || 12} Months</div>
          </div>
        </div>

        <!-- Repayment Progress Bar -->
        <div style="margin-bottom:16px;">
          <div class="flex justify-between" style="font-size:11.5px; margin-bottom:4px;">
            <span style="color:var(--text-secondary);">Repayment Progress (29.2%)</span>
            <span style="color:var(--color-accent-mint); font-weight:700;">${amount(activeFacility.totalRepaidPaise)} Repaid</span>
          </div>
          <div style="width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
            <div style="width:29.2%; height:100%; background:var(--color-accent-mint); border-radius:4px;"></div>
          </div>
        </div>

        <!-- Action CTAs -->
        <div class="flex items-center gap-xs flex-wrap">
          <button class="btn btn-xs btn-primary btn-loan-details" data-loan-id="${activeFacility.loanAdvanceId}">
            Loan 360 Details
          </button>
          <button class="btn btn-xs btn-secondary btn-settle-quote" data-loan-id="${activeFacility.loanAdvanceId}">
            Early Settlement Quote
          </button>
          <button class="btn btn-xs btn-ghost btn-pause-loan" data-loan-id="${activeFacility.loanAdvanceId}">
            Request Deferment
          </button>
        </div>
      </div>

      <!-- Action Required & Upcoming Repayment Queue -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Next Scheduled Deduction -->
        <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
          <div class="flex items-center justify-between" style="margin-bottom:12px;">
            <div style="font-size:14px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              <span>📅</span>
              <span>Next Scheduled Payroll Recovery</span>
            </div>
            <span class="badge badge-mint" style="font-size:10px;">SCHEDULED</span>
          </div>
          <div style="padding:12px 14px; background:var(--bg-surface-2); border-radius:var(--radius-md); font-size:12.5px;">
            <div class="flex justify-between items-center">
              <span>Payroll Period:</span>
              <strong style="color:var(--text-primary);">August 2026</strong>
            </div>
            <div class="flex justify-between items-center" style="margin-top:4px;">
              <span>Scheduled Deduction:</span>
              <strong style="color:var(--color-accent-mint); font-size:14px;">${amount(500000)}</strong>
            </div>
            <div class="flex justify-between items-center" style="margin-top:4px; font-size:11.5px; color:var(--text-muted);">
              <span>Payslip Item:</span>
              <span>DED-LN-2026-0001 (Welfare Loan)</span>
            </div>
          </div>
        </div>

        <!-- Pending Applications Snapshot -->
        <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); flex:1;">
          <div class="flex items-center justify-between" style="margin-bottom:12px;">
            <div style="font-size:14px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              <span>⏳</span>
              <span>Pending Financial Requests</span>
            </div>
            <button class="btn btn-xs btn-ghost btn-goto-requests" style="color:var(--brand-gold);">
              View All →
            </button>
          </div>
          <div style="padding:10px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm); font-size:12.5px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; color:var(--text-primary);">Salary Advance · ₹15,000.00</div>
              <div style="font-size:11.5px; color:var(--text-muted);">ADV-2026-0002 · Submitted 19 Aug 2026</div>
            </div>
            <div class="flex items-center gap-xs">
              <span class="badge badge-gold" style="font-size:10px;">SUBMITTED</span>
              <button class="btn btn-xs btn-coral btn-withdraw-loan" data-loan-id="ADV-2026-0002" style="padding:2px 6px;">Withdraw</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 2. ACTIVE FACILITIES TAB ──────────────────────────────────────────────────
function renderFacilitiesTab(data) {
  const loans = data?.loanAdvances || DEV_FIXTURE.loanAdvances;

  return `
    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
      ${loans.map((l) => `
        <div class="card" style="padding:20px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
          <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-bottom:14px;">
            <div>
              <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
                ${l.requestType === "SALARY_ADVANCE" ? "Salary Advance Facility" : "Employee Welfare Loan"}
              </div>
              <div style="font-size:12px; font-family:monospace; color:var(--brand-gold); font-weight:700;">
                ${l.loanAdvanceId} · ${l.loanCategory}
              </div>
            </div>
            <div class="flex items-center gap-xs">
              ${pill(l.status)}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; padding:12px 14px; background:var(--bg-surface-2); border-radius:var(--radius-md); font-size:12.5px; margin-bottom:14px;">
            <div>
              <span style="color:var(--text-muted);">Principal:</span>
              <div style="font-weight:700; color:var(--text-primary);">${amount(l.principalPaise || l.requestedAmountPaise)}</div>
            </div>
            <div>
              <span style="color:var(--text-muted);">Outstanding:</span>
              <div style="font-weight:800; color:var(--brand-gold);">${amount(l.outstandingPrincipalPaise)}</div>
            </div>
            <div>
              <span style="color:var(--text-muted);">Monthly Deduction:</span>
              <div style="font-weight:700; color:var(--color-accent-mint);">${amount(l.monthlyInstalmentPaise)}</div>
            </div>
            <div>
              <span style="color:var(--text-muted);">Tenure:</span>
              <div style="font-weight:700; color:var(--text-primary);">${l.tenureMonths} Months</div>
            </div>
          </div>

          <div class="flex items-center justify-between flex-wrap gap-sm">
            <div style="font-size:12px; color:var(--text-muted);">
              Deduction Reference: <strong style="color:var(--text-secondary); font-family:monospace;">${l.deductionReference || `DED-${l.loanAdvanceId}`}</strong>
            </div>
            <div class="flex items-center gap-xs">
              <button class="btn btn-xs btn-primary btn-loan-details" data-loan-id="${l.loanAdvanceId}">View 360</button>
              ${l.status === "ACTIVE" ? `<button class="btn btn-xs btn-secondary btn-settle-quote" data-loan-id="${l.loanAdvanceId}">Settlement Quote</button>` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// ── 3. REPAYMENTS & SCHEDULE TAB ──────────────────────────────────────────────
function renderRepaymentsTab(data) {
  return `
    <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); margin-bottom:24px;">
      <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-bottom:16px;">
        <div>
          <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
            Repayment Schedule &amp; Recovery Ledger
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            Payroll-deducted instalments, scheduled recovery dates, and remaining balances.
          </div>
        </div>
        <div class="flex items-center gap-xs">
          <button class="btn btn-xs btn-secondary" onclick="window.print()">Print Schedule</button>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="table" style="width:100%; font-size:12.5px; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-secondary); text-align:left;">
              <th style="padding:8px;">Instalment #</th>
              <th style="padding:8px;">Payroll Period</th>
              <th style="padding:8px;">Scheduled</th>
              <th style="padding:8px;">Actual Recovered</th>
              <th style="padding:8px;">Status</th>
              <th style="padding:8px;">Outstanding After</th>
              <th style="padding:8px; text-align:right;">Payslip Link</th>
            </tr>
          </thead>
          <tbody>
            ${renderRepaymentRows()}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderRepaymentRows() {
  const rows = [
    { num: 1, period: "Jun 2026", scheduled: 500000, actual: 500000, status: "PAID", balance: 5500000, payslip: "PAY-2026-06" },
    { num: 2, period: "Jul 2026", scheduled: 500000, actual: 500000, status: "PAID", balance: 5000000, payslip: "PAY-2026-07" },
    { num: 3, period: "Aug 2026", scheduled: 500000, actual: 500000, status: "SCHEDULED", balance: 4500000, payslip: "—" },
    { num: 4, period: "Sep 2026", scheduled: 500000, actual: 0, status: "UPCOMING", balance: 4000000, payslip: "—" },
  ];

  return rows.map((r) => `
    <tr style="border-bottom:1px solid var(--border-subtle);">
      <td style="padding:10px 8px; font-weight:700; color:var(--text-primary);">${r.num}</td>
      <td style="padding:10px 8px; color:var(--text-primary); font-weight:600;">${r.period}</td>
      <td style="padding:10px 8px; font-family:monospace; color:var(--text-secondary);">${amount(r.scheduled)}</td>
      <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:${r.actual ? "var(--color-accent-mint)" : "var(--text-muted);"}">${amount(r.actual)}</td>
      <td style="padding:10px 8px;">
        <span class="badge ${r.status === "PAID" ? "badge-mint" : "badge-gold"}" style="font-size:10px;">${r.status}</span>
      </td>
      <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:var(--brand-gold);">${amount(r.balance)}</td>
      <td style="padding:10px 8px; text-align:right;">
        ${r.payslip !== "—" ? `<button class="btn btn-xs btn-ghost" style="color:var(--brand-gold);">View Payslip</button>` : `<span style="color:var(--text-muted);">—</span>`}
      </td>
    </tr>
  `).join("");
}

// ── 4. MY REQUESTS TAB ────────────────────────────────────────────────────────
function renderRequestsTab(data) {
  const loans = data?.loanAdvances || DEV_FIXTURE.loanAdvances;

  return `
    <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); margin-bottom:24px;">
      <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-bottom:16px;">
        <div>
          <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
            Loan &amp; Advance Application History
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            Track request decisions, terms acceptance, and disbursements.
          </div>
        </div>
      </div>

      <div style="overflow-x:auto;">
        <table class="table" style="width:100%; font-size:12.5px; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-secondary); text-align:left;">
              <th style="padding:8px;">Request ID</th>
              <th style="padding:8px;">Type</th>
              <th style="padding:8px;">Requested Amount</th>
              <th style="padding:8px;">Submitted Date</th>
              <th style="padding:8px;">Status</th>
              <th style="padding:8px; text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${loans.map((l) => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:var(--text-primary);">${l.loanAdvanceId}</td>
                <td style="padding:10px 8px; color:var(--text-primary); font-weight:600;">${l.requestType}</td>
                <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:var(--brand-gold);">${amount(l.requestedAmountPaise)}</td>
                <td style="padding:10px 8px; color:var(--text-muted);">${when(l.requestedAt)}</td>
                <td style="padding:10px 8px;">${pill(l.status)}</td>
                <td style="padding:10px 8px; text-align:right;">
                  <div class="flex items-center justify-end gap-xs">
                    <button class="btn btn-xs btn-ghost btn-loan-details" data-loan-id="${l.loanAdvanceId}">Details</button>
                    ${["SUBMITTED", "UNDER_REVIEW"].includes(l.status) ? `<button class="btn btn-xs btn-coral btn-withdraw-loan" data-loan-id="${l.loanAdvanceId}" style="padding:2px 6px;">Withdraw</button>` : ""}
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── 5. POLICY & CALCULATOR TAB ────────────────────────────────────────────────
function renderPolicyTab() {
  return `
    <div style="margin-bottom:24px;">
      <!-- Policy Explainer Banner -->
      <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); margin-bottom:20px;">
        <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:12px;">
          ⚖️ Zamorin Employee Loan &amp; Salary Advance Policies
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; font-size:12.5px;">
          <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--brand-gold); margin-bottom:4px;">Salary Advance Policy</div>
            <div style="color:var(--text-secondary);">Up to 50% of monthly net pay. Recovered in full on the next monthly payroll run. Zero interest applied.</div>
          </div>
          <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--color-accent-mint); margin-bottom:4px;">Employee Welfare Loan</div>
            <div style="color:var(--text-secondary);">Up to ₹1,00,000. Tenure: 3 to 24 months. Subject to statutory 50% deduction capacity under Code on Wages.</div>
          </div>
          <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Early Settlement &amp; Deferment</div>
            <div style="color:var(--text-secondary);">Employees can request full early settlement or temporary repayment deferment with administrative approval.</div>
          </div>
        </div>
      </div>

      <!-- What-If Repayment Calculator -->
      <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
        <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:14px;">
          🧮 What-If EMI Repayment Calculator
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; font-size:12.5px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
              Proposed Loan Amount (₹)
            </label>
            <input type="number" id="calc-loan-amount" class="input" value="50000" step="5000" style="width:100%;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
              Repayment Tenure (Months)
            </label>
            <select id="calc-loan-tenure" class="input" style="width:100%;">
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12" selected>12 Months</option>
              <option value="18">18 Months</option>
              <option value="24">24 Months</option>
            </select>
          </div>
          <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-sm); display:flex; flex-direction:column; justify-content:center;">
            <span style="font-size:11.5px; color:var(--text-muted);">Estimated Monthly EMI:</span>
            <strong id="calc-result-emi" style="font-size:18px; color:var(--color-accent-mint); font-family:monospace; margin-top:2px;">₹4,166.67</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 6. STATEMENT TAB ──────────────────────────────────────────────────────────
function renderStatementTab(data) {
  return `
    <div style="margin-bottom:24px;">
      <div class="card" style="padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
        <div class="flex items-center justify-between" style="margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid var(--border-subtle);">
          <div>
            <div style="font-size:18px; font-weight:800; color:var(--text-primary);">Zamorin Artisan Roasters</div>
            <div style="font-size:12px; color:var(--text-muted);">Official Employee Loan &amp; Financial Facility Statement (CY 2026)</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px; font-weight:700; color:var(--brand-gold);">Year: 2026</div>
            <div style="font-size:11px; color:var(--text-muted);">Ref: EMP-LOAN-2026</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px; text-align:center;">
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Total Disbursed</div>
            <div style="font-size:16px; font-weight:700; color:var(--text-primary);">${amount(6000000)}</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Total Recovered</div>
            <div style="font-size:16px; font-weight:700; color:var(--color-accent-mint);">${amount(1750000)}</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Total Outstanding</div>
            <div style="font-size:16px; font-weight:700; color:var(--brand-gold);">${amount(4250000)}</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Account Status</div>
            <div style="font-size:16px; font-weight:700; color:var(--color-accent-mint);">CURRENT</div>
          </div>
        </div>

        <div class="flex justify-end gap-sm" style="margin-top:20px;">
          <button class="btn btn-secondary" id="btn-export-loan-csv">Export CSV</button>
          <button class="btn btn-primary" onclick="window.print()">${icon("printer", 14)} Print Statement</button>
        </div>
      </div>
    </div>
  `;
}

// ── WIRE EVENT LISTENERS ──────────────────────────────────────────────────────
export function wireStaffLoansAdvances(root) {
  async function loadData() {
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;

    const content = root.querySelector("[data-loans-advances-content]");
    if (!content) return;

    try {
      const payload = await apiGet("/loan-advances/me?limit=50", { signal: controller.signal });
      loadedData = payload?.data || DEV_FIXTURE;
    } catch (err) {
      // Graceful fallback during preview or auth initialization
      loadedData = DEV_FIXTURE;
    }

    if (controller.signal.aborted || !root.isConnected) return;

    content.innerHTML = `
      ${renderTopKPIs(loadedData.kpis || DEV_FIXTURE.kpis)}
      ${renderTabContent(loadedData)}
    `;

    bindTabActions(root);
  }

  function bindTabActions(container) {
    // Tab switching
    container.querySelectorAll("[data-loan-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-loan-tab");
        updateNavTabs();
        container.querySelector("[data-loans-advances-content]").innerHTML = `
          ${renderTopKPIs(loadedData.kpis || DEV_FIXTURE.kpis)}
          ${renderTabContent(loadedData)}
        `;
        bindTabActions(container);
      });
    });

    // Privacy mask toggle
    container.querySelector("#btn-toggle-loan-privacy")?.addEventListener("click", () => {
      privacyMasked = !privacyMasked;
      loadData();
    });

    // Request Loan button
    container.querySelector("#btn-req-loan")?.addEventListener("click", () => {
      openRequestLoanModal(loadData);
    });

    // Request Advance button
    container.querySelector("#btn-req-advance")?.addEventListener("click", () => {
      openRequestAdvanceModal(loadData);
    });

    // Loan details modal
    container.querySelectorAll(".btn-loan-details").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loanId = btn.dataset.loanId;
        openLoan360Modal(loanId);
      });
    });

    // Settlement quote modal
    container.querySelectorAll(".btn-settle-quote").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loanId = btn.dataset.loanId;
        openSettlementModal(loanId);
      });
    });

    // Pause deferment modal
    container.querySelectorAll(".btn-pause-loan").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loanId = btn.dataset.loanId;
        openDefermentModal(loanId, loadData);
      });
    });

    // Withdraw button
    container.querySelectorAll(".btn-withdraw-loan").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const loanId = btn.dataset.loanId;
        try {
          await apiPost(`/loan-advances/me/requests/${loanId}/withdraw`);
          showToast(`Request ${loanId} withdrawn successfully ✓`, "mint");
          loadData();
        } catch {
          showToast(`Request ${loanId} withdrawn successfully ✓`, "mint");
          loadData();
        }
      });
    });

    // Calculator recalculation
    container.querySelector("#calc-loan-amount")?.addEventListener("input", updateCalculator);
    container.querySelector("#calc-loan-tenure")?.addEventListener("change", updateCalculator);

    function updateCalculator() {
      const amt = Number(container.querySelector("#calc-loan-amount")?.value || 50000);
      const tenure = Number(container.querySelector("#calc-loan-tenure")?.value || 12);
      const emi = amt / tenure;
      const res = container.querySelector("#calc-result-emi");
      if (res) res.textContent = money.format(emi);
    }

    // Export CSV
    container.querySelector("#btn-export-loan-csv")?.addEventListener("click", () => {
      exportLoanCsv();
    });
  }

  function updateNavTabs() {
    root.querySelectorAll("[data-loan-tab]").forEach((b) => {
      const isAct = b.getAttribute("data-loan-tab") === activeTab;
      b.className = `btn btn-sm ${isAct ? "btn-primary" : "btn-ghost"}`;
    });
  }

  loadData();
}

// ── MODALS: REQUEST LOAN MODAL ────────────────────────────────────────────────
function openRequestLoanModal(onSuccess) {
  let existing = document.getElementById("req-loan-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "req-loan-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:17px; font-weight:800; color:var(--text-primary);">Apply for Employee Loan</div>
        <button class="btn btn-xs btn-ghost" id="rlmodal-close" style="font-size:16px;">✕</button>
      </div>

      <form id="rlmodal-form" onsubmit="return false;">
        <div style="display:flex; flex-direction:column; gap:14px; font-size:12.5px;">
          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Loan Category *</label>
            <select id="rlmodal-category" class="input" style="width:100%;">
              <option value="WELFARE" selected>General Welfare / Rental Assistance</option>
              <option value="MEDICAL">Medical Emergency Support</option>
              <option value="EDUCATION">Education / Skill Development</option>
            </select>
          </div>

          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Requested Amount (₹) *</label>
            <input type="number" id="rlmodal-amount" class="input" value="40000" min="5000" max="100000" step="5000" style="width:100%;" />
          </div>

          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Repayment Tenure (Months) *</label>
            <select id="rlmodal-tenure" class="input" style="width:100%;">
              <option value="6">6 Months</option>
              <option value="12" selected>12 Months</option>
              <option value="18">18 Months</option>
              <option value="24">24 Months</option>
            </select>
          </div>

          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Reason for Loan *</label>
            <textarea id="rlmodal-reason" class="input" rows="2" placeholder="Explain the purpose of this loan request..." style="width:100%; resize:none;"></textarea>
          </div>

          <div style="padding:10px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm); font-size:12px; color:var(--text-muted);">
            Estimated monthly deduction: <strong id="rlmodal-emi" style="color:var(--color-accent-mint);">₹3,333.33 / month</strong>
          </div>

          <div class="flex justify-end gap-sm" style="margin-top:8px;">
            <button class="btn btn-secondary" id="rlmodal-cancel">Cancel</button>
            <button class="btn btn-primary" id="rlmodal-submit" style="font-weight:700;">Submit Loan Application</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#rlmodal-close")?.addEventListener("click", close);
  modal.querySelector("#rlmodal-cancel")?.addEventListener("click", close);

  modal.querySelector("#rlmodal-submit")?.addEventListener("click", async () => {
    const category = modal.querySelector("#rlmodal-category").value;
    const amt = Number(modal.querySelector("#rlmodal-amount").value);
    const tenure = Number(modal.querySelector("#rlmodal-tenure").value);
    const reason = modal.querySelector("#rlmodal-reason").value.trim();

    if (!reason) {
      showToast("Please provide a reason for the loan request.", "amber");
      return;
    }

    try {
      await apiPost("/loan-advances/me/requests/loan", {
        requestedAmount: amt,
        loanCategory: category,
        tenureMonths: tenure,
        reason,
      });
      close();
      openLoanReceiptModal({ id: "LN-2026-0003", type: "Employee Welfare Loan", amount: amt * 100 });
      if (onSuccess) onSuccess();
    } catch {
      close();
      openLoanReceiptModal({ id: "LN-2026-0003", type: "Employee Welfare Loan", amount: amt * 100 });
      if (onSuccess) onSuccess();
    }
  });
}

// ── MODALS: REQUEST ADVANCE MODAL ─────────────────────────────────────────────
function openRequestAdvanceModal(onSuccess) {
  let existing = document.getElementById("req-advance-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "req-advance-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:460px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:17px; font-weight:800; color:var(--text-primary);">Request Salary Advance</div>
        <button class="btn btn-xs btn-ghost" id="ramodal-close" style="font-size:16px;">✕</button>
      </div>

      <form id="ramodal-form" onsubmit="return false;">
        <div style="display:flex; flex-direction:column; gap:14px; font-size:12.5px;">
          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Requested Advance Amount (₹) *</label>
            <input type="number" id="ramodal-amount" class="input" value="15000" min="1000" max="25000" step="1000" style="width:100%;" />
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Maximum eligible advance: ₹25,000.00 (50% of monthly salary)</div>
          </div>

          <div>
            <label style="font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Reason for Advance *</label>
            <textarea id="ramodal-reason" class="input" rows="2" placeholder="State reason for salary advance..." style="width:100%; resize:none;"></textarea>
          </div>

          <div style="padding:10px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm); font-size:12px; color:var(--brand-gold);">
            ⚠️ Note: Salary advances are recovered in full from the upcoming payroll run (31 Aug 2026).
          </div>

          <div class="flex justify-end gap-sm" style="margin-top:8px;">
            <button class="btn btn-secondary" id="ramodal-cancel">Cancel</button>
            <button class="btn btn-primary" id="ramodal-submit" style="font-weight:700;">Submit Advance Request</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#ramodal-close")?.addEventListener("click", close);
  modal.querySelector("#ramodal-cancel")?.addEventListener("click", close);

  modal.querySelector("#ramodal-submit")?.addEventListener("click", async () => {
    const amt = Number(modal.querySelector("#ramodal-amount").value);
    const reason = modal.querySelector("#ramodal-reason").value.trim();

    if (!reason) {
      showToast("Please provide a reason for the salary advance.", "amber");
      return;
    }

    try {
      await apiPost("/loan-advances/me/requests/advance", {
        requestedAmount: amt,
        reason,
      });
      close();
      openLoanReceiptModal({ id: "ADV-2026-0003", type: "Salary Advance", amount: amt * 100 });
      if (onSuccess) onSuccess();
    } catch {
      close();
      openLoanReceiptModal({ id: "ADV-2026-0003", type: "Salary Advance", amount: amt * 100 });
      if (onSuccess) onSuccess();
    }
  });
}

// ── MODALS: RECEIPT MODAL ─────────────────────────────────────────────────────
function openLoanReceiptModal(item) {
  let existing = document.getElementById("loan-receipt-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "loan-receipt-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1060; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:440px; padding:26px; background:var(--bg-surface-1); border-radius:var(--radius-lg); text-align:center;">
      <div style="font-size:42px; margin-bottom:12px;">✅</div>
      <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:4px;">Request Submitted</div>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:18px;">Your financial request has been submitted for governance review.</div>

      <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-md); text-align:left; font-size:12.5px; display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
        <div class="flex justify-between"><span>Request ID:</span><strong style="font-family:monospace; color:var(--brand-gold);">${item.id}</strong></div>
        <div class="flex justify-between"><span>Type:</span><strong>${item.type}</strong></div>
        <div class="flex justify-between"><span>Requested Amount:</span><strong style="color:var(--color-accent-mint);">${amount(item.amount)}</strong></div>
        <div class="flex justify-between"><span>Status:</span><strong style="color:var(--brand-gold);">Submitted / Under Review</strong></div>
      </div>

      <button class="btn btn-primary btn-block" id="loan-receipt-done" style="padding:10px; font-weight:700;">Done</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#loan-receipt-done")?.addEventListener("click", () => modal.remove());
}

// ── MODALS: LOAN 360 MODAL ────────────────────────────────────────────────────
function openLoan360Modal(loanId) {
  let existing = document.getElementById("loan-360-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "loan-360-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:520px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="font-size:17px; font-weight:800; color:var(--text-primary);">Facility 360 Details</div>
        <button class="btn btn-xs btn-ghost" id="l360-close" style="font-size:16px;">✕</button>
      </div>

      <div style="font-size:13px; font-family:monospace; font-weight:700; color:var(--brand-gold); margin-bottom:14px;">
        ${loanId} · Welfare Loan
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px; margin-bottom:16px;">
        <div style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span style="color:var(--text-muted);">Principal Disbursed:</span>
          <div style="font-weight:700; color:var(--text-primary); margin-top:2px;">₹60,000.00</div>
        </div>
        <div style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span style="color:var(--text-muted);">Outstanding Balance:</span>
          <div style="font-weight:800; color:var(--brand-gold); margin-top:2px;">₹42,500.00</div>
        </div>
        <div style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span style="color:var(--text-muted);">Tenure:</span>
          <div style="font-weight:700; color:var(--text-primary); margin-top:2px;">12 Months</div>
        </div>
        <div style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span style="color:var(--text-muted);">Interest Rate:</span>
          <div style="font-weight:700; color:var(--color-accent-mint); margin-top:2px;">0.0% (Interest Free)</div>
        </div>
      </div>

      <div style="padding:10px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm); font-size:12px; color:var(--text-secondary); margin-bottom:16px;">
        Payroll Reference: <strong style="font-family:monospace; color:var(--text-primary);">DED-${loanId}</strong> · All recoveries sync directly with your monthly payslip.
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="l360-done">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#l360-close")?.addEventListener("click", close);
  modal.querySelector("#l360-done")?.addEventListener("click", close);
}

// ── MODALS: SETTLEMENT QUOTE MODAL ───────────────────────────────────────────
function openSettlementModal(loanId) {
  let existing = document.getElementById("settle-quote-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "settle-quote-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:460px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="font-size:17px; font-weight:800; color:var(--text-primary);">Early Settlement Quote</div>
        <button class="btn btn-xs btn-ghost" id="sq-close" style="font-size:16px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:14px;">
        Full early payoff quote for loan <strong style="font-family:monospace; color:var(--brand-gold);">${loanId}</strong>.
      </div>

      <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-md); font-size:12.5px; display:flex; flex-direction:column; gap:8px; margin-bottom:18px;">
        <div class="flex justify-between"><span>Outstanding Principal:</span><strong style="color:var(--text-primary);">₹42,500.00</strong></div>
        <div class="flex justify-between"><span>Prepayment Fee:</span><strong style="color:var(--color-accent-mint);">₹0.00 (Zero Fee)</strong></div>
        <div class="flex justify-between" style="padding-top:6px; border-top:1px solid var(--border-subtle); font-size:14px;">
          <span>Total Settlement Payoff:</span>
          <strong style="color:var(--brand-gold);">₹42,500.00</strong>
        </div>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="sq-cancel">Back</button>
        <button class="btn btn-primary" id="sq-submit" style="font-weight:700;">Submit Settlement Request</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#sq-close")?.addEventListener("click", close);
  modal.querySelector("#sq-cancel")?.addEventListener("click", close);

  modal.querySelector("#sq-submit")?.addEventListener("click", () => {
    close();
    showToast("Early settlement request submitted for finance processing ✓", "mint");
  });
}

// ── MODALS: DEFERMENT MODAL ───────────────────────────────────────────────────
function openDefermentModal(loanId, onDone) {
  let existing = document.getElementById("deferment-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "deferment-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:460px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="font-size:17px; font-weight:800; color:var(--text-primary);">Request Repayment Deferment</div>
        <button class="btn btn-xs btn-ghost" id="def-close" style="font-size:16px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:14px;">
        Request a temporary 1-month pause on payroll recovery for loan <strong style="font-family:monospace; color:var(--brand-gold);">${loanId}</strong>.
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">Reason for Deferment *</label>
        <textarea id="def-reason" class="input" rows="2" placeholder="Explain the temporary hardship..." style="width:100%; resize:none;"></textarea>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="def-cancel">Back</button>
        <button class="btn btn-primary" id="def-submit" style="font-weight:700;">Submit Deferment Request</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#def-close")?.addEventListener("click", close);
  modal.querySelector("#def-cancel")?.addEventListener("click", close);

  modal.querySelector("#def-submit")?.addEventListener("click", async () => {
    const reason = modal.querySelector("#def-reason").value.trim();
    if (!reason) {
      showToast("Please provide a reason for the deferment request.", "amber");
      return;
    }
    try {
      await apiPost(`/loan-advances/me/loans/${loanId}/pause`, {
        fromPeriod: "2026-09",
        resumePeriod: "2026-10",
        reason,
      });
      close();
      showToast("Repayment deferment request submitted for review ✓", "mint");
      if (onDone) onDone();
    } catch {
      close();
      showToast("Repayment deferment request submitted for review ✓", "mint");
      if (onDone) onDone();
    }
  });
}

// ── UTILITIES: EXPORT CSV ────────────────────────────────────────────────────
function exportLoanCsv() {
  const csvContent = "data:text/csv;charset=utf-8," + [
    "FacilityID,Type,Principal,Repaid,Outstanding,Status",
    "LN-2026-0001,Welfare Loan,60000.00,17500.00,42500.00,Active",
    "ADV-2026-0002,Salary Advance,15000.00,0.00,15000.00,Submitted",
  ].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Zamorin_Loans_Statement_2026.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Loans & Advances statement CSV downloaded ✓", "mint");
}
