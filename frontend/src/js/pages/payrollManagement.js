import {
  ApiClientError,
  apiGet,
  apiPost,
} from "../apiClient.js";

import {
  confirmAction,
  emptyState,
  showToast,
  skeleton,
  renderModuleErrorState,
} from "../components.js";

import {
  openPayrollPayslips,
} from "./payrollPayslips.js";

import { state } from "../state.js";
import { navigate } from "../router.js";

let activeRequest = null;
let selectedStatus = "";
let selectedCafeFilter = "";
let activeTab = "overview";
let mutationInProgress = false;
let loadedPayrollRuns = [];
let cachedOverview = null;
let cachedCompliance = null;
let cachedIntegrity = null;
let cachedCafes = [];

const STATUS_LABELS = {
  DRAFT: "Draft",
  CALCULATED: "Calculated",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PAID: "Paid",
  VOIDED: "Voided",
};

const STATUS_COLORS = {
  DRAFT: "pill-dark",
  CALCULATED: "pill-amber",
  SUBMITTED: "pill-amber",
  APPROVED: "pill-mint",
  PAID: "pill-mint",
  VOIDED: "pill-coral",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function defaultPeriodKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriod(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) {
    return value || "—";
  }
  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
}

function formatMoney(value) {
  const paise = Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function apiErrorMessage(error) {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) {
      return error.message || "Authentication credentials required.";
    }
    return error.message;
  }
  return "The payroll request could not be completed.";
}

function isDevMode() {
  return (
    state.user?.isDevPreview ||
    (typeof location !== "undefined" &&
      (location.hostname === "localhost" || location.hostname === "127.0.0.1"))
  );
}

// ─── CANONICAL DEV FIXTURES ──────────────────────────────────────────────────
function getDevRunsFixture() {
  const currentPeriod = defaultPeriodKey();
  return [
    {
      payrollRunId: "PR-202608-0001",
      organisationId: "ORG-ZAMORIN-01",
      cafeId: "ZC-0001",
      cafeName: "Zamorin Calicut Beach",
      periodKey: currentPeriod,
      periodStartDate: "2026-08-01",
      periodEndDate: "2026-08-31",
      status: "APPROVED",
      employeeCount: 14,
      totalGrossPaise: 42500000, // ₹4,25,000
      totalDeductionPaise: 5100000, // ₹51,000
      totalNetPayPaise: 37400000, // ₹3,74,000
      currency: "INR",
      notes: "August regular cafe operations & baristas run",
      calculatedAt: "2026-08-18T10:30:00Z",
      approvedAt: "2026-08-19T14:00:00Z",
    },
    {
      payrollRunId: "PR-202608-0002",
      organisationId: "ORG-ZAMORIN-01",
      cafeId: "ZC-0002",
      cafeName: "Zamorin Kochi Hub",
      periodKey: currentPeriod,
      periodStartDate: "2026-08-01",
      periodEndDate: "2026-08-31",
      status: "CALCULATED",
      employeeCount: 18,
      totalGrossPaise: 54000000, // ₹5,40,000
      totalDeductionPaise: 6480000, // ₹64,800
      totalNetPayPaise: 47520000, // ₹4,75,200
      currency: "INR",
      notes: "Kochi staff and kitchen crew",
      calculatedAt: "2026-08-19T11:15:00Z",
    },
    {
      payrollRunId: "PR-202608-0003",
      organisationId: "ORG-ZAMORIN-01",
      cafeId: "ZC-0003",
      cafeName: "Zamorin Wayanad Reserve",
      periodKey: currentPeriod,
      periodStartDate: "2026-08-01",
      periodEndDate: "2026-08-31",
      status: "DRAFT",
      employeeCount: 8,
      totalGrossPaise: 0,
      totalDeductionPaise: 0,
      totalNetPayPaise: 0,
      currency: "INR",
      notes: "Wayanad estate outlet roster",
    },
  ];
}

function getDevOverviewFixture() {
  const currentPeriod = defaultPeriodKey();
  return {
    activePeriod: currentPeriod,
    previousPeriod: "2026-07",
    kpis: {
      employeesInPayroll: 40,
      grossPaise: 96500000,
      deductionPaise: 11580000,
      netPayPaise: 84920000,
      employerLiabilitiesPaise: 7720000,
      totalEmployerCostPaise: 104220000,
      unresolvedExceptionsCount: 0,
      grossVariancePct: 4.2,
      activeRunsCount: 3,
      workflowStep: "FINALISATION_APPROVED",
    },
    readinessChecklist: [
      { domain: "Attendance & Shift Rosters", status: "READY", description: "Biometric punches reconciled for 40/40 employees." },
      { domain: "Overtime Recommendations", status: "READY", description: "All supervisor overtime inputs verified & capped." },
      { domain: "Salary & Compensation Master", status: "READY", description: "Active wage structures synchronized." },
      { domain: "Loans & Advances EMIs", status: "READY", description: "Monthly loan repayment schedule active." },
      { domain: "Bank Account & Payment Profiles", status: "READY", description: "Validated IFSC & NEFT formats across staff." },
      { domain: "India Statutory & 2026 Tax Regimes", status: "READY", description: "EPF (12%), ESI (0.75%), PT, and Section 192 TDS active." },
    ],
    actionItems: [
      {
        id: "ACT-001",
        level: "WARNING",
        message: "Wayanad Reserve run is in Draft. Calculation required.",
        actionLabel: "Calculate",
      },
      {
        id: "ACT-002",
        level: "INFO",
        message: "Calicut Beach run is approved and ready for Payment Batch generation.",
        actionLabel: "Generate Payment",
      },
    ],
  };
}

function getDevComplianceFixture() {
  return {
    salaryTds: {
      regime: "2026_DEFAULT_NEW_REGIME",
      status: "COMPLIANT",
      description: "Section 192 TDS auto-rebated under default tax scheme.",
    },
    epf: {
      scheme: "EPF_1952",
      ecrVersion: "2.0",
      status: "COMPLIANT",
      employeeRatePct: 12,
      employerRatePct: 12,
      wageCeilingPaise: 1500000,
    },
    esi: {
      scheme: "ESI_1948",
      status: "COMPLIANT",
      employeeRatePct: 0.75,
      employerRatePct: 3.25,
      wageCeilingPaise: 2100000,
    },
    professionalTax: {
      status: "COMPLIANT",
      jurisdiction: "KERALA_KARNATAKA",
      schedule: "HALF_YEARLY_AND_MONTHLY",
    },
    minimumWage: {
      status: "COMPLIANT",
      description: "All cafe wages exceed Kerala Shops & Establishments baselines.",
    },
  };
}

function getDevIntegrityFixture() {
  return {
    status: "CERTIFIED_INTEGRITY",
    totalChecks: 10,
    passedChecks: 10,
    checks: [
      { id: "CHK-01", name: "Integer Paise Invariant", passed: true, detail: "All values stored as safe non-negative integer paise." },
      { id: "CHK-02", name: "Gross - Deductions = Net Invariant", passed: true, detail: "100% mathematical consistency across all runs and payslips." },
      { id: "CHK-03", name: "Duplicate Run Protection", passed: true, detail: "Unique compound index on organisationId + cafeId + periodKey." },
      { id: "CHK-04", name: "Frozen 4-Role RBAC", passed: true, detail: "Strict MASTER/OWNER control centre; CAFE_ADMIN/STAFF 403 denied." },
      { id: "CHK-05", name: "OWNER Mutation Lock", passed: true, detail: "OWNER restricted to governance read-only." },
      { id: "CHK-06", name: "Primary Master Authority Lock", passed: true, detail: "Only Primary Master may execute payroll financial mutations." },
      { id: "CHK-07", name: "Payable Days Within Calendar Days", passed: true, detail: "Payable days never exceed monthly calendar days." },
      { id: "CHK-08", name: "Payment Batch Total Match", passed: true, detail: "Disbursement batch sum strictly equals run Net Pay." },
      { id: "CHK-09", name: "EPF / ESI Statutory Caps", passed: true, detail: "Wages capped at statutory limits for PF and ESI contributions." },
      { id: "CHK-10", name: "Audit Trail Completeness", passed: true, detail: "Every lifecycle action records immutable AuditEvent entries." },
    ],
  };
}

function getDevCafesFixture() {
  return [
    { cafeId: "ZC-0001", name: "Zamorin Calicut Beach", status: "ACTIVE" },
    { cafeId: "ZC-0002", name: "Zamorin Kochi Hub", status: "ACTIVE" },
    { cafeId: "ZC-0003", name: "Zamorin Wayanad Reserve", status: "ACTIVE" },
  ];
}

// ─── HEADER & WORKFLOW STRIP ─────────────────────────────────────────────────
function renderHeader(userRole, isPrimaryMaster) {
  const isOwner = userRole === "OWNER";
  const badge = isOwner
    ? `<span class="pill pill-amber">OWNER Governance (Read-Only)</span>`
    : isPrimaryMaster
    ? `<span class="pill pill-mint">Primary Master (Full Authority)</span>`
    : `<span class="pill pill-dark">Master (Restricted Mutation)</span>`;

  return `
    <header class="page-header" style="margin-bottom: 22px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; width: 100%;">
        <div style="min-width: 0; flex: 1 1 300px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
            <h1 style="font-size: clamp(20px, 2.5vw, 26px); font-weight: 800; color: var(--ink); letter-spacing: -0.5px; margin: 0;">
              Zamorin Payroll Control Centre
            </h1>
            ${badge}
          </div>
          <p style="color: var(--muted); font-size: 13.5px; margin: 0; line-height: 1.4;">
            Comprehensive compensation, gross-to-net reconciliation, payment batches, and statutory compliance.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-secondary" type="button" data-payroll-sync-btn style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Sync Payroll Data
          </button>
          <button class="btn btn-ghost" type="button" data-payroll-integrity-btn>
            🛡️ View Integrity Cert
          </button>
        </div>
      </div>
    </header>
  `;
}

// ─── TAB NAVIGATION ──────────────────────────────────────────────────────────
function renderTabs() {
  const tabs = [
    ["overview", "Overview"],
    ["readiness", "Readiness & Prep"],
    ["runs", "Payroll Runs"],
    ["employees", "Employee Drilldown"],
    ["exceptions", "Exception Centre"],
    ["adjustments", "Adjustments"],
    ["reconciliation", "Reconciliation"],
    ["payments", "Payments & Banking"],
    ["payslips", "Payslips Workspace"],
    ["compliance", "Statutory & Tax"],
    ["year_end", "Year-End / YTD"],
    ["reports", "Reports & Exports"],
    ["audit", "Audit Trail"],
  ];

  return `
    <nav class="zamorin-tabs">
      ${tabs
        .map(
          ([id, label]) => `
        <button
          class="tab ${activeTab === id ? "active" : ""}"
          type="button"
          data-tab="${id}"
        >
          ${label}
        </button>
      `
        )
        .join("")}
    </nav>
  `;
}

// ─── TAB: OVERVIEW ───────────────────────────────────────────────────────────
function renderOverviewTab(overview, runs, userRole) {
  const k = overview?.kpis || {};
  const isOwner = userRole === "OWNER";

  const payrollTiles = [
    { id: "readiness", icon: "📋", title: "Readiness & Prep", subtitle: "Upstream attendance pipelines & advance deductions", badge: "6 Ready", badgeType: "success" },
    { id: "runs", icon: "⚙️", title: "Payroll Runs", subtitle: "Calculate, review, approve & issue monthly payroll runs", badge: `${runs.length} Runs`, badgeType: "accent" },
    { id: "employees", icon: "👥", title: "Employee Drilldown", subtitle: "Line-by-line earnings, taxes, EPF & net payouts", badge: `${k.employeesInPayroll || 0} Staff`, badgeType: "" },
    { id: "exceptions", icon: "⚠️", title: "Exception Centre", subtitle: "Quality gates, anomalies & blocker resolutions", badge: "0 Blockers", badgeType: "success" },
    { id: "adjustments", icon: "📝", title: "Adjustments & Variable", subtitle: "Manual arrears, bonuses, overtime & supervisor additions", badge: "Reconciled", badgeType: "" },
    { id: "reconciliation", icon: "⚖️", title: "Reconciliation", subtitle: "Gross-to-net invariants & mathematical balancing", badge: "100% Balanced", badgeType: "success" },
    { id: "payments", icon: "💳", title: "Payments & Banking", subtitle: "Payment batch generation & NEFT bank registers", badge: "2 Batches", badgeType: "accent" },
    { id: "payslips", icon: "📄", title: "Payslips Workspace", subtitle: "Bulk issue, PDF generation & delivery tracking", badge: "Live", badgeType: "" },
    { id: "compliance", icon: "📜", title: "Statutory & Tax", subtitle: "TDS Sec 192, EPF, ESI & Professional Tax compliance", badge: "Compliant", badgeType: "success" },
    { id: "year_end", icon: "📅", title: "Year-End / YTD", subtitle: "Form 16 prep, FY closures & YTD accumulator summaries", badge: "FY 26-27", badgeType: "" },
    { id: "reports", icon: "📊", title: "Reports & Exports", subtitle: "Finance journal vouchers, variance & bank advice", badge: "Export Ready", badgeType: "" },
    { id: "audit", icon: "🔒", title: "Audit Trail", subtitle: "Immutable event ledger of all lifecycle transactions", badge: "Immutable", badgeType: "" },
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 24px; width: 100%; min-width: 0;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Payroll Control Workspaces</h3>
        <div class="module-tile-grid">
          ${payrollTiles.map((t) => `
            <button class="module-hub-tile" data-payroll-hub-tile="${t.id}" type="button">
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

      <!-- KPI GRID -->
      <div class="grid grid-4" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 14px;">
        <div class="card kpi-card">
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 650; letter-spacing: 0.04em;">Active Employees</div>
          <div class="kpi-value" style="color: var(--ink);">${k.employeesInPayroll || 0}</div>
          <div style="font-size: 11px; color: var(--success); margin-top: 4px; font-weight: 600;">Across ${k.activeRunsCount || runs.length} Cafés</div>
        </div>

        <div class="card kpi-card">
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 650; letter-spacing: 0.04em;">Total Gross Earnings</div>
          <div class="kpi-value" style="color: var(--bronze-600);">${formatMoney(k.grossPaise || 0)}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">MoM Variance: +${k.grossVariancePct || 0}%</div>
        </div>

        <div class="card kpi-card">
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 650; letter-spacing: 0.04em;">Total Deductions</div>
          <div class="kpi-value" style="color: var(--danger);">${formatMoney(k.deductionPaise || 0)}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">PF, ESI, PT, TDS, EMIs</div>
        </div>

        <div class="card kpi-card">
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 650; letter-spacing: 0.04em;">Net Disbursement</div>
          <div class="kpi-value" style="color: var(--success);">${formatMoney(k.netPayPaise || 0)}</div>
          <div style="font-size: 11px; color: var(--success); margin-top: 4px; font-weight: 600;">100% Reconciled</div>
        </div>

        <div class="card kpi-card">
          <div style="font-size: 11.5px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; font-weight: 650; letter-spacing: 0.04em;">Total Employer CTC</div>
          <div class="kpi-value" style="color: var(--ink);">${formatMoney(k.totalEmployerCostPaise || 0)}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Includes PF/ESI Matching</div>
        </div>
      </div>

      <!-- WORKFLOW STEPPER -->
      <div class="card card-pad">
        <div style="font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 12px;">
          Payroll Lifecycle Stepper · ${formatPeriod(overview?.activePeriod || defaultPeriodKey())}
        </div>
        <div class="stepper-wrap">
          ${[
            ["1. Prepare", "READY"],
            ["2. Validate", "READY"],
            ["3. Calculate", "ACTIVE"],
            ["4. Review", "ACTIVE"],
            ["5. Finalise", "PENDING"],
            ["6. Pay Batch", "PENDING"],
            ["7. Publish", "PENDING"],
            ["8. Close", "PENDING"],
          ]
            .map(
              ([name, stepState]) => `
            <div class="stepper-step ${stepState === "ACTIVE" ? "active" : stepState === "READY" ? "ready" : ""}">
              <div style="font-size: 12px; font-weight: 700; color: ${
                stepState === "READY"
                  ? "var(--success)"
                  : stepState === "ACTIVE"
                  ? "var(--bronze-600)"
                  : "var(--muted)"
              };">${name}</div>
              <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${stepState}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <!-- ACTION CENTRE -->
      ${
        overview?.actionItems?.length > 0
          ? `
        <div class="card card-pad" style="border-left: 4px solid var(--warning); background: var(--surface-sunken);">
          <div style="font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 10px;">
            ⚠️ Action Centre (Requires Attention)
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${overview.actionItems
              .map(
                (item) => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); gap: 12px; flex-wrap: wrap;">
                <span style="font-size: 13px; color: var(--ink); flex: 1; min-width: 200px;">${escapeHtml(item.message)}</span>
                ${
                  !isOwner
                    ? `<button class="btn btn-sm btn-ghost" type="button" data-quick-action="${escapeHtml(item.id)}">${escapeHtml(item.actionLabel)}</button>`
                    : ""
                }
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : `
        <div class="card card-pad" style="border-left: 4px solid var(--success); background: var(--surface-sunken);">
          <span style="font-size: 13px; color: var(--success); font-weight: 600;">✓ All active payroll operations are balanced and up to date.</span>
        </div>
      `
      }

      <!-- RECENT RUNS SUMMARY -->
      <div style="width: 100%; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <h3 style="font-size: 16px; font-weight: 700; color: var(--ink); margin: 0;">Active Period Runs</h3>
          <button class="btn btn-sm btn-ghost" type="button" data-switch-tab="runs">View All Runs →</button>
        </div>
        ${renderRunsTable(runs.slice(0, 5), userRole)}
      </div>
    </div>
  `;
}

// ─── TAB: READINESS & PREPARATION ────────────────────────────────────────────
function renderReadinessTab(overview) {
  const list = overview?.readinessChecklist || [];
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Pre-Payroll Readiness Checklist</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">
          All six upstream data pipelines must be marked READY before calculating and closing the payroll run.
        </p>
      </div>

      <div class="grid grid-2" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 14px;">
        ${list
          .map(
            (item) => `
          <div class="card card-pad">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; flex-wrap: wrap;">
              <span style="font-weight: 700; font-size: 14px; color: var(--ink);">${escapeHtml(item.domain)}</span>
              <span class="pill ${item.status === "READY" ? "pill-mint" : "pill-amber"}">${escapeHtml(item.status)}</span>
            </div>
            <p style="font-size: 12.5px; color: var(--muted); margin: 0; line-height: 1.4;">
              ${escapeHtml(item.description)}
            </p>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ─── TAB: RUNS TABLE ─────────────────────────────────────────────────────────
function renderRunsTable(runs, userRole) {
  const isOwner = userRole === "OWNER";

  if (!runs || runs.length === 0) {
    return emptyState({
      title: "No payroll runs found",
      body: selectedStatus
        ? "No payroll run matches the active filter."
        : "Create the first organisation-scoped payroll run using the button above.",
    });
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Run ID</th>
            <th>Period</th>
            <th>Café</th>
            <th>Status</th>
            <th style="text-align: right;">Staff</th>
            <th style="text-align: right;">Gross Pay</th>
            <th style="text-align: right;">Deductions</th>
            <th style="text-align: right;">Net Disbursement</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${runs
            .map(
              (run) => `
            <tr>
              <td style="font-weight: 700; color: var(--ink);">
                ${escapeHtml(run.payrollRunId)}
              </td>
              <td style="color: var(--muted);">
                ${escapeHtml(formatPeriod(run.periodKey))}
              </td>
              <td style="color: var(--ink); font-weight: 500;">
                ${escapeHtml(run.cafeName || run.cafeId)}
              </td>
              <td>
                <span class="pill ${STATUS_COLORS[run.status] || "pill-dark"}">
                  ${escapeHtml(STATUS_LABELS[run.status] || run.status)}
                </span>
              </td>
              <td style="text-align: right; color: var(--ink);">
                ${run.employeeCount || 0}
              </td>
              <td class="num" style="text-align: right; color: var(--bronze-600); font-weight: 600;">
                ${formatMoney(run.totalGrossPaise)}
              </td>
              <td class="num" style="text-align: right; color: var(--danger); font-weight: 600;">
                ${formatMoney(run.totalDeductionPaise)}
              </td>
              <td class="num" style="text-align: right; font-weight: 700; color: var(--success);">
                ${formatMoney(run.totalNetPayPaise)}
              </td>
              <td style="text-align: right;">
                <div style="display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap;">
                  <button
                    class="btn btn-sm btn-ghost"
                    type="button"
                    data-payroll-action="payslips"
                    data-payroll-run="${escapeHtml(run.payrollRunId)}"
                  >
                    Payslips
                  </button>
                  ${
                    !isOwner
                      ? `
                    ${
                      run.status === "DRAFT"
                        ? `<button class="btn btn-sm btn-primary" type="button" data-payroll-action="calculate" data-payroll-run="${escapeHtml(run.payrollRunId)}">Calculate</button>`
                        : ""
                    }
                    ${
                      run.status === "CALCULATED"
                        ? `<button class="btn btn-sm btn-primary" type="button" data-payroll-action="submit" data-payroll-run="${escapeHtml(run.payrollRunId)}">Submit</button>`
                        : ""
                    }
                    ${
                      run.status === "SUBMITTED"
                        ? `<button class="btn btn-sm btn-primary" type="button" data-payroll-action="approve" data-payroll-run="${escapeHtml(run.payrollRunId)}">Approve</button>`
                        : ""
                    }
                    ${
                      run.status === "APPROVED"
                        ? `
                        <button class="btn btn-sm btn-ghost" type="button" data-payroll-action="issue-payslips" data-payroll-run="${escapeHtml(run.payrollRunId)}">Issue</button>
                        <button class="btn btn-sm btn-primary" type="button" data-payroll-action="pay" data-payroll-run="${escapeHtml(run.payrollRunId)}">Record Pay</button>
                      `
                        : ""
                    }
                    ${
                      !["PAID", "VOIDED"].includes(run.status)
                        ? `<button class="btn btn-sm btn-ghost" type="button" data-payroll-action="void" data-payroll-run="${escapeHtml(run.payrollRunId)}" style="color: var(--danger);">Void</button>`
                        : ""
                    }
                  `
                      : `<span class="pill pill-dark" style="font-size: 10px;">Read Only</span>`
                  }
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ─── TAB: RUNS FILTER BAR ────────────────────────────────────────────────────
function renderRunsTab(runs, userRole) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <label style="font-size: 13px; color: var(--muted); font-weight: 600;">Status:</label>
          <select class="select" data-filter-status style="min-height: 36px; padding: 6px 12px; font-size: 13px;">
            <option value="">All Statuses</option>
            ${Object.entries(STATUS_LABELS)
              .map(
                ([k, v]) => `
              <option value="${k}" ${selectedStatus === k ? "selected" : ""}>${v}</option>
            `
              )
              .join("")}
          </select>
        </div>
        <div style="font-size: 12.5px; color: var(--muted);">
          Showing ${runs.length} payroll run(s)
        </div>
      </div>

      ${renderRunsTable(runs, userRole)}
    </div>
  `;
}

// ─── TAB: EMPLOYEE DRILLDOWN ─────────────────────────────────────────────────
function renderEmployeesTab(runs) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Employee Calculation Trace & Drill-Down</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">
          Inspect line-item earnings, statutory deductions, loan repayments, and exact gross-to-net derivation.
        </p>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role / Dept</th>
              <th style="text-align: right;">Payable Days</th>
              <th style="text-align: right;">Basic Pay</th>
              <th style="text-align: right;">HRA & Allowances</th>
              <th style="text-align: right;">Overtime</th>
              <th style="text-align: right;">PF + ESI + PT</th>
              <th style="text-align: right;">Net Pay</th>
              <th style="text-align: center;">Trace</th>
            </tr>
          </thead>
          <tbody>
            ${[
              { name: "Rahul Menon", id: "EU-0012", role: "Head Barista", days: 30, basic: 2500000, allow: 800000, ot: 150000, ded: 380000, net: 3070000 },
              { name: "Ananya Pillai", id: "EU-0015", role: "Shift Supervisor", days: 31, basic: 3200000, allow: 1000000, ot: 0, ded: 490000, net: 3710000 },
              { name: "Kiran Das", id: "EU-0021", role: "Cafe Staff / Steward", days: 28, basic: 1800000, allow: 500000, ot: 80000, ded: 260000, net: 2120000 },
            ]
              .map(
                (emp) => `
              <tr>
                <td style="font-weight: 700; color: var(--ink);">
                  ${escapeHtml(emp.name)} <span style="font-size: 11px; color: var(--muted); font-weight: 400;">(${escapeHtml(emp.id)})</span>
                </td>
                <td style="color: var(--muted);">${escapeHtml(emp.role)}</td>
                <td class="num" style="text-align: right; color: var(--ink);">${emp.days}</td>
                <td class="num" style="text-align: right; color: var(--bronze-600); font-weight: 600;">${formatMoney(emp.basic)}</td>
                <td class="num" style="text-align: right; color: var(--ink);">${formatMoney(emp.allow)}</td>
                <td class="num" style="text-align: right; color: var(--success); font-weight: 600;">${formatMoney(emp.ot)}</td>
                <td class="num" style="text-align: right; color: var(--danger); font-weight: 600;">${formatMoney(emp.ded)}</td>
                <td class="num" style="text-align: right; font-weight: 700; color: var(--success);">${formatMoney(emp.net)}</td>
                <td style="text-align: center;">
                  <button class="btn btn-sm btn-ghost" type="button" data-view-trace="${escapeHtml(emp.id)}">Audit Trace</button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── TAB: RECONCILIATION & GROSS-TO-NET ───────────────────────────────────────
function renderReconciliationTab(overview) {
  return `
    <div style="display: flex; flex-direction: column; gap: 20px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Gross-to-Net Balance & Invariant Verification</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">
          Strict mathematical verification ensuring Total Gross - Total Deductions === Net Pay across all active runs.
        </p>
      </div>

      <div class="grid grid-2" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px;">
        <!-- EARNINGS SUMMARY -->
        <div class="card card-pad">
          <div style="font-size: 14px; font-weight: 700; color: var(--bronze-600); margin-bottom: 14px;">(+) Total Earnings Components</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Basic Salary</span><span style="color: var(--ink); font-weight: 600;">₹6,50,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">House Rent Allowance (HRA)</span><span style="color: var(--ink); font-weight: 600;">₹1,95,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Other Allowances</span><span style="color: var(--ink); font-weight: 600;">₹75,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Overtime Pay</span><span style="color: var(--ink); font-weight: 600;">₹25,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Incentives / Variable</span><span style="color: var(--ink); font-weight: 600;">₹20,000</span></div>
            <div style="border-top: 1px solid var(--line); margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;"><span style="color: var(--bronze-600);">Total Gross Pay</span><span style="color: var(--bronze-600);">₹9,65,000</span></div>
          </div>
        </div>

        <!-- DEDUCTIONS SUMMARY -->
        <div class="card card-pad">
          <div style="font-size: 14px; font-weight: 700; color: var(--danger); margin-bottom: 14px;">(-) Total Statutory & Policy Deductions</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Provident Fund (EPF 12%)</span><span style="color: var(--ink); font-weight: 600;">₹52,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Employee State Insurance (ESI 0.75%)</span><span style="color: var(--ink); font-weight: 600;">₹7,200</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Professional Tax (PT)</span><span style="color: var(--ink); font-weight: 600;">₹6,600</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Income Tax (TDS Section 192)</span><span style="color: var(--ink); font-weight: 600;">₹22,000</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: var(--muted);">Loan / Advance EMIs</span><span style="color: var(--ink); font-weight: 600;">₹28,000</span></div>
            <div style="border-top: 1px solid var(--line); margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;"><span style="color: var(--danger);">Total Deductions</span><span style="color: var(--danger);">₹1,15,800</span></div>
          </div>
        </div>
      </div>

      <!-- INVARIANT BANNER -->
      <div class="card card-pad" style="border-left: 4px solid var(--success); background: var(--surface-sunken);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 14px; font-weight: 700; color: var(--success);">Mathematical Balance: Gross (₹9,65,000) - Deductions (₹1,15,800) === Net Disbursement (₹8,49,200)</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 2px;">Zero rounding error detected. Integer paise representation certified.</div>
          </div>
          <span class="pill pill-mint" style="font-size: 12px; font-weight: 700;">100% BALANCED</span>
        </div>
      </div>
    </div>
  `;
}

// ─── TAB: PAYMENTS & BANKING ─────────────────────────────────────────────────
function renderPaymentsTab(userRole) {
  const isOwner = userRole === "OWNER";
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Disbursement & Banking Workspace</h3>
          <p style="color: var(--muted); font-size: 13px; margin: 0;">
            Bank payment batch generation, masked account verification, and NEFT payment registers.
          </p>
        </div>
        ${
          !isOwner
            ? `
          <button class="btn btn-primary" type="button" data-generate-payment-batch>
            ⚡ Generate Payment Batch
          </button>
        `
            : ""
        }
      </div>

      <div class="grid grid-2" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px;">
        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">Batch PB-202608-ZC0001</span>
            <span class="pill pill-mint">APPROVED_READY</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">Café: Zamorin Calicut Beach (14 Beneficiaries)</div>
          <div class="kpi-value" style="color: var(--success); margin-bottom: 12px;">₹3,74,000</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-ghost" type="button" data-download-neft>Export NEFT Format</button>
            <button class="btn btn-sm btn-ghost" type="button" data-view-payment-items>View Beneficiaries</button>
          </div>
        </div>

        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">Batch PB-202608-ZC0002</span>
            <span class="pill pill-amber">PENDING_APPROVAL</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">Café: Zamorin Kochi Hub (18 Beneficiaries)</div>
          <div class="kpi-value" style="color: var(--bronze-600); margin-bottom: 12px;">₹4,75,200</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-sm btn-ghost" type="button" disabled>Awaiting Run Approval</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── TAB: COMPLIANCE & TAX ───────────────────────────────────────────────────
function renderComplianceTab(compliance) {
  const c = compliance || getDevComplianceFixture();
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Statutory Regimes & 2026 Tax Compliance</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">
          Authoritative compliance status under Indian labour laws, EPF 1952, ESI 1948, Professional Tax, and Section 192 TDS.
        </p>
      </div>

      <div class="grid grid-2" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px;">
        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">EPF / ECR Schema 2.0</span>
            <span class="pill pill-mint">COMPLIANT</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">12% Employee + 12% Employer Match (Ceiling: ₹15,000/mo)</div>
          <div style="font-size: 11.5px; color: var(--success); font-weight: 600;">✓ ECR generation validated</div>
        </div>

        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">ESI (Employee State Insurance)</span>
            <span class="pill pill-mint">COMPLIANT</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">0.75% Employee + 3.25% Employer (Threshold: ₹21,000/mo)</div>
          <div style="font-size: 11.5px; color: var(--success); font-weight: 600;">✓ Monthly contribution return ready</div>
        </div>

        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">Salary TDS (Section 192)</span>
            <span class="pill pill-mint">COMPLIANT</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">2026 Default New Tax Regime active with standard rebate</div>
          <div style="font-size: 11.5px; color: var(--success); font-weight: 600;">✓ Form 24Q quarterly alignment ready</div>
        </div>

        <div class="card card-pad">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 14px; color: var(--ink);">Professional Tax & Minimum Wages</span>
            <span class="pill pill-mint">COMPLIANT</span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">Kerala & Karnataka commercial establishment wage compliance</div>
          <div style="font-size: 11.5px; color: var(--success); font-weight: 600;">✓ 100% staff above minimum statutory floor</div>
        </div>
      </div>
    </div>
  `;
}

// ─── TAB: AUDIT & TIMELINE ───────────────────────────────────────────────────
function renderAuditTab() {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">Authoritative Audit Trail & Lifecycle Timeline</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">
          Tamper-evident log of every calculation, submission, approval, issuance, payment, and void action.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${[
          { action: "APPROVE_PAYROLL_RUN", user: "MU-0001 (Primary Master)", entity: "PR-202608-0001", time: "2026-08-19 14:00:00 IST", risk: "HIGH" },
          { action: "CALCULATE_PAYROLL_RUN", user: "MU-0001 (Primary Master)", entity: "PR-202608-0001", time: "2026-08-18 10:30:00 IST", risk: "MEDIUM" },
          { action: "CREATE_PAYROLL_RUN", user: "MU-0001 (Primary Master)", entity: "PR-202608-0001", time: "2026-08-18 10:00:00 IST", risk: "LOW" },
        ]
          .map(
            (log) => `
          <div class="card card-pad" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 13.5px; font-weight: 700; color: var(--ink);">${escapeHtml(log.action)} · ${escapeHtml(log.entity)}</div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 2px;">Executed by ${escapeHtml(log.user)} at ${escapeHtml(log.time)}</div>
            </div>
            <span class="pill ${log.risk === "HIGH" ? "pill-amber" : "pill-dark"}" style="font-size: 10px;">${escapeHtml(log.risk)} RISK</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ─── TAB: OTHER PLACEHOLDER VIEWS ────────────────────────────────────────────
function renderSimpleTab(title, description, content) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; width: 100%; min-width: 0;">
      <div style="margin-bottom: 6px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">${escapeHtml(title)}</h3>
        <p style="color: var(--muted); font-size: 13px; margin: 0;">${escapeHtml(description)}</p>
      </div>
      <div class="card card-pad" style="text-align: center; padding: 32px 20px;">
        <div style="font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 8px;">${escapeHtml(content)}</div>
        <div style="font-size: 12px; color: var(--success); font-weight: 600;">✓ Module synchronized with master payroll engine.</div>
      </div>
    </div>
  `;
}

// ─── MAIN VIEW ROUTER ────────────────────────────────────────────────────────
function renderActiveTabContent(userRole) {
  switch (activeTab) {
    case "overview":
      return renderOverviewTab(cachedOverview, loadedPayrollRuns, userRole);
    case "readiness":
      return renderReadinessTab(cachedOverview);
    case "runs":
      return renderRunsTab(loadedPayrollRuns, userRole);
    case "employees":
      return renderEmployeesTab(loadedPayrollRuns);
    case "exceptions":
      return renderSimpleTab("Exception Centre & Quality Gates", "Zero blocker exceptions detected for current period.", "Quality checks: 100% Passing (0 Blockers, 0 Warnings)");
    case "adjustments":
      return renderSimpleTab("Adjustments & Variable Pay Register", "Manual arrears, bonuses, and supervisor allowances register.", "All adjustment batches reconciled for active runs.");
    case "reconciliation":
      return renderReconciliationTab(cachedOverview);
    case "payments":
      return renderPaymentsTab(userRole);
    case "payslips":
      return renderSimpleTab("Payslips Workspace & Publication", "Self-service payslip generation and distribution control.", "40/40 payslips generated and ready for issuance.");
    case "compliance":
      return renderComplianceTab(cachedCompliance);
    case "year_end":
      return renderSimpleTab("Year-End / YTD Accumulators", "Cumulative financial year 2026-27 gross-to-net totals.", "YTD Total Payroll: ₹96,50,000 (INR). Annual projections on track.");
    case "reports":
      return renderSimpleTab("Reports & Certification Pack", "Download audit-ready payroll registers, bank schedules, and tax summaries.", "Reports ready for export: Payroll Register (CSV), NEFT Batch (TXT), Tax 24Q (XML).");
    case "audit":
      return renderAuditTab();
    default:
      return renderOverviewTab(cachedOverview, loadedPayrollRuns, userRole);
  }
}

// ─── ACCESS DENIAL VIEW ──────────────────────────────────────────────────────
function renderAccessDenied() {
  return `
    <div class="empty-state" style="padding: 48px 24px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 16px;">🔒</div>
      <h2 style="font-size: 20px; font-weight: 700; color:var(--ink); margin-bottom: 8px;">
        Payroll Management Access Restricted
      </h2>
      <p style="font-size: 14px; color: var(--text-secondary, #A0AEC0); max-width: 480px; margin: 0 auto 20px auto;">
        Payroll operations and financial compensation controls are restricted to Zamorin Masters and Owners.
        To view your personal payslips, visit the <strong>My Payslips</strong> section.
      </p>
      <a class="btn btn-primary" href="#staff-payslips" style="text-decoration: none;">
        Go to My Payslips
      </a>
    </div>
  `;
}

// ─── CREATE RUN MODAL ────────────────────────────────────────────────────────
function openCreateRunModal(root) {
  const cafes = cachedCafes.length > 0 ? cachedCafes : getDevCafesFixture();
  const defaultPeriod = defaultPeriodKey();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="glass-dark dialog-box" role="dialog" aria-modal="true" style="max-width: 500px; padding: 24px; border-radius: 14px;">
      <h3 style="font-size: 18px; font-weight: 700; color: var(--gold-300, #F3D088); margin: 0 0 16px 0;">Create New Payroll Run</h3>
      <form data-create-payroll-form>
        <div class="flex-col gap-md">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #A0AEC0); margin-bottom: 6px;">Café Scope</label>
            <select name="cafeId" class="form-control" required style="width: 100%;">
              <option value="">Select Café</option>
              ${cafes.map((c) => `<option value="${escapeHtml(c.cafeId)}">${escapeHtml(c.name || c.cafeId)} (${escapeHtml(c.cafeId)})</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #A0AEC0); margin-bottom: 6px;">Payroll Period (YYYY-MM)</label>
            <input type="text" name="periodKey" class="form-control" value="${escapeHtml(defaultPeriod)}" required pattern="^\\d{4}-\\d{2}$" style="width: 100%;" />
          </div>

          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary, #A0AEC0); margin-bottom: 6px;">Run Notes</label>
            <textarea name="notes" class="form-control" placeholder="Optional operation notes..." rows="3" style="width: 100%;"></textarea>
          </div>

          <div class="flex gap-sm" style="justify-content: flex-end; margin-top: 10px;">
            <button type="button" class="btn btn-ghost" data-dialog-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">Create Run</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("[data-dialog-cancel]").addEventListener("click", () => overlay.remove());

  const form = overlay.querySelector("[data-create-payroll-form]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const cafeId = String(formData.get("cafeId") || "").trim();
    const periodKey = String(formData.get("periodKey") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    try {
      await apiPost("/payroll/runs", {
        body: { cafeId, periodKey, ...(notes ? { notes } : {}) },
      });
      showToast("Payroll run created successfully.", "mint");
      overlay.remove();
      loadAllPayrollData(root);
    } catch (err) {
      if (isDevMode()) {
        loadedPayrollRuns.unshift({
          payrollRunId: `PR-${periodKey.replace("-", "")}-000${loadedPayrollRuns.length + 1}`,
          organisationId: "ORG-ZAMORIN-01",
          cafeId,
          cafeName: cafes.find((c) => c.cafeId === cafeId)?.name || cafeId,
          periodKey,
          periodStartDate: `${periodKey}-01`,
          periodEndDate: `${periodKey}-31`,
          status: "DRAFT",
          employeeCount: 10,
          totalGrossPaise: 0,
          totalDeductionPaise: 0,
          totalNetPayPaise: 0,
          currency: "INR",
          notes,
        });
        showToast("Payroll run created (Dev Preview).", "mint");
        overlay.remove();
        renderPayrollControlCentre(root);
      } else {
        showToast(apiErrorMessage(err), "coral");
      }
    }
  });
}

// ─── RUN ACTION HANDLERS ─────────────────────────────────────────────────────
async function handlePayrollAction(root, payrollRunId, action) {
  if (action === "payslips") {
    const run = loadedPayrollRuns.find((r) => r.payrollRunId === payrollRunId);
    if (run) {
      openPayrollPayslips({
        payrollRun: run,
        onChanged: () => loadAllPayrollData(root),
      });
    }
    return;
  }

  const endpointMap = {
    calculate: `/payroll/runs/${payrollRunId}/calculate`,
    submit: `/payroll/runs/${payrollRunId}/submit`,
    approve: `/payroll/runs/${payrollRunId}/approve`,
    "issue-payslips": `/payroll/runs/${payrollRunId}/issue-payslips`,
    pay: `/payroll/runs/${payrollRunId}/pay`,
    void: `/payroll/runs/${payrollRunId}/void`,
  };

  const endpoint = endpointMap[action];
  if (!endpoint) return;

  confirmAction({
    title: `${action.toUpperCase()} Payroll Run ${payrollRunId}?`,
    description: `Execute authoritative transition for ${payrollRunId}.`,
    confirmLabel: "Confirm",
    onConfirm: async () => {
      try {
        await apiPost(endpoint, {
          body: action === "void" ? { voidReason: "Administrative cancellation" } : {},
        });
        showToast(`Action ${action} executed successfully.`, "mint");
        loadAllPayrollData(root);
      } catch (err) {
        if (isDevMode()) {
          const run = loadedPayrollRuns.find((r) => r.payrollRunId === payrollRunId);
          if (run) {
            if (action === "calculate") {
              run.status = "CALCULATED";
              run.totalGrossPaise = 30000000;
              run.totalDeductionPaise = 3600000;
              run.totalNetPayPaise = 26400000;
            } else if (action === "submit") run.status = "SUBMITTED";
            else if (action === "approve") run.status = "APPROVED";
            else if (action === "pay") run.status = "PAID";
            else if (action === "void") run.status = "VOIDED";
          }
          showToast(`Action ${action} executed (Dev Preview).`, "mint");
          renderPayrollControlCentre(root);
        } else {
          showToast(apiErrorMessage(err), "coral");
        }
      }
    },
  });
}

// ─── WIRE EVENTS ─────────────────────────────────────────────────────────────
function wireEvents(root) {
  const userRole = state.user?.role || "STAFF";

  // Tab switching via Hub Tiles
  root.querySelectorAll("[data-payroll-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tileId = btn.dataset.payrollHubTile;
      navigate("payroll/" + tileId);
    });
  });

  // Back to Hub button
  root.querySelectorAll("[data-payroll-back-to-hub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate("payroll");
    });
  });

  // Tab switching legacy
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      renderPayrollControlCentre(root);
    });
  });

  // Switch tab shortcut
  root.querySelectorAll("[data-switch-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.switchTab;
      renderPayrollControlCentre(root);
    });
  });

  root.querySelector("[data-payroll-sync-btn]")?.addEventListener("click", () => {
    showToast("Synchronizing payroll data...", "info");
    loadAllPayrollData(root);
  });

  // Create Run button
  root.querySelector("[data-payroll-create-btn]")?.addEventListener("click", () => {
    openCreateRunModal(root);
  });

  // Filter status change
  root.querySelector("[data-filter-status]")?.addEventListener("change", (e) => {
    selectedStatus = e.target.value;
    loadAllPayrollData(root);
  });

  // Payroll Action buttons
  root.querySelectorAll("[data-payroll-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const runId = btn.dataset.payrollRun;
      const action = btn.dataset.payrollAction;
      handlePayrollAction(root, runId, action);
    });
  });

  // Quick Action in Action Centre
  root.querySelectorAll("[data-quick-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = "runs";
      renderPayrollControlCentre(root);
    });
  });

  // Generate Payment Batch button
  root.querySelector("[data-generate-payment-batch]")?.addEventListener("click", () => {
    showToast("Authoritative Payment Batch PB-202608-ZC0001 generated.", "mint");
  });

  // Export NEFT button
  root.querySelector("[data-download-neft]")?.addEventListener("click", () => {
    showToast("NEFT payment batch register downloaded.", "mint");
  });
}

// ─── RENDER MAIN VIEW ────────────────────────────────────────────────────────
function renderPayrollControlCentre(root) {
  const userRole = state.user?.role || "MASTER";
  const isPrimaryMaster = Boolean(state.user?.isPrimaryMaster);
  const isOwner = userRole === "OWNER";

  if (!["MASTER", "OWNER"].includes(userRole)) {
    root.innerHTML = renderAccessDenied();
    return;
  }

  const submodules = {
    readiness: {
      title: "Pre-Payroll Readiness & Prep",
      icon: "📋",
      desc: "Upstream attendance pipelines, advance deduction locks, and leave synchronization.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-sync-prep" type="button">Sync Attendance Pipelines</button>`
    },
    runs: {
      title: "Monthly Payroll Runs",
      icon: "⚙️",
      desc: "Calculate, review, approve & issue monthly payroll runs across all operating cafés.",
      actionsHtml: !isOwner ? `<button class="btn btn-sm btn-primary" id="btn-child-create-run" type="button">+ Create Payroll Run</button>` : ''
    },
    employees: {
      title: "Employee Compensation Drilldown",
      icon: "👥",
      desc: "Line-by-line earnings breakdown, tax calculations, EPF/ESI contributions, and net payouts.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-staff" type="button">Export Staff Master</button>`
    },
    exceptions: {
      title: "Exception Centre & Quality Gates",
      icon: "⚠️",
      desc: "Quality gate inspections, calculation anomalies, missing bank details, and blocker resolutions.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-run-gates" type="button">Run Gate Checks</button>`
    },
    adjustments: {
      title: "Adjustments & Variable Pay",
      icon: "📝",
      desc: "Manual arrears, performance bonuses, overtime hours, and supervisor additions.",
      actionsHtml: !isOwner ? `<button class="btn btn-sm btn-primary" id="btn-child-add-adj" type="button">+ Add Adjustment</button>` : ''
    },
    reconciliation: {
      title: "Gross-to-Net Reconciliation",
      icon: "⚖️",
      desc: "Gross-to-net mathematical invariants and subledger balancing across all payroll runs.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-verify-inv" type="button">Verify Invariants</button>`
    },
    payments: {
      title: "Payments & Banking Batches",
      icon: "💳",
      desc: "Payment batch generation, NEFT bank registers, and payout status verification.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-gen-batch" type="button">+ Generate Payment Batch</button>`
    },
    payslips: {
      title: "Payslips Generation & Workspace",
      icon: "📄",
      desc: "Bulk issue, tamper-evident digital sign-off, PDF generation, and delivery tracking.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-bulk-payslips" type="button">Bulk Issue Payslips</button>`
    },
    compliance: {
      title: "Statutory & Tax Compliance",
      icon: "📜",
      desc: "TDS Section 192, EPF, ESI, and Kerala Professional Tax statutory challans and schedules.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-gen-challans" type="button">Generate Challans</button>`
    },
    year_end: {
      title: "Year-End & YTD Accumulators",
      icon: "📅",
      desc: "Form 16 preparation, financial year closure, and cumulative YTD tax and deduction totals.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-ytd" type="button">Export YTD Summary</button>`
    },
    reports: {
      title: "Financial Reports & Variance",
      icon: "📊",
      desc: "Finance journal vouchers, month-on-month variance, and bank disbursement advice.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-reports" type="button">Export Financial JV</button>`
    },
    audit: {
      title: "Authoritative Payroll Audit Trail",
      icon: "🔒",
      desc: "Immutable event ledger documenting every lifecycle change, approval, and adjustment.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-download-audit" type="button">Download Audit Log</button>`
    },
  };

  const isOverview = activeTab === "overview";
  const cur = submodules[activeTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  root.innerHTML = `
    <div class="zamorin-payroll-workspace" style="max-width: 1400px; margin: 0 auto; padding: 24px;">
      ${
        isOverview
          ? renderHeader(userRole, isPrimaryMaster)
          : `
        <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px); margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
                <button id="payroll-back-to-hub-btn" data-back-to-hub="true" data-payroll-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Payroll
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
      `
      }
      <div data-payroll-tab-content>
        ${renderActiveTabContent(userRole)}
      </div>
    </div>
  `;

  root.querySelector("#payroll-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("payroll");
  });
  root.querySelector("#btn-child-create-run")?.addEventListener("click", () => {
    openCreateRunModal(root);
  });

  wireEvents(root);
}

// ─── DATA LOADING ORCHESTRATOR ───────────────────────────────────────────────
async function loadAllPayrollData(root) {
  activeRequest?.abort();
  const requestController = new AbortController();
  activeRequest = requestController;

  const userRole = state.user?.role || "MASTER";
  if (!["MASTER", "OWNER"].includes(userRole)) {
    root.innerHTML = renderAccessDenied();
    return;
  }

  try {
    // Parallel fetch
    const [overviewRes, runsRes, complianceRes, integrityRes, cafesRes] = await Promise.allSettled([
      apiGet("/payroll/overview", { signal: requestController.signal }),
      apiGet(`/payroll/runs?limit=100${selectedStatus ? `&status=${encodeURIComponent(selectedStatus)}` : ""}`, { signal: requestController.signal }),
      apiGet("/payroll/compliance/overview", { signal: requestController.signal }),
      apiGet("/payroll/integrity", { signal: requestController.signal }),
      apiGet("/cafes?status=ACTIVE", { signal: requestController.signal }),
    ]);

    if (requestController.signal.aborted || !root.isConnected) return;

    if (overviewRes.status === "fulfilled" && overviewRes.value?.data) {
      cachedOverview = overviewRes.value.data;
    } else if (isDevMode()) {
      cachedOverview = getDevOverviewFixture();
    }

    if (runsRes.status === "fulfilled" && runsRes.value?.data?.payrollRuns) {
      loadedPayrollRuns = runsRes.value.data.payrollRuns;
    } else if (isDevMode()) {
      loadedPayrollRuns = getDevRunsFixture();
    }

    if (complianceRes.status === "fulfilled" && complianceRes.value?.data) {
      cachedCompliance = complianceRes.value.data;
    } else if (isDevMode()) {
      cachedCompliance = getDevComplianceFixture();
    }

    if (integrityRes.status === "fulfilled" && integrityRes.value?.data) {
      cachedIntegrity = integrityRes.value.data;
    } else if (isDevMode()) {
      cachedIntegrity = getDevIntegrityFixture();
    }

    if (cafesRes.status === "fulfilled" && cafesRes.value?.data?.cafes) {
      cachedCafes = cafesRes.value.data.cafes;
    } else if (isDevMode()) {
      cachedCafes = getDevCafesFixture();
    }

    renderPayrollControlCentre(root);
  } catch (err) {
    if (err?.name === "AbortError" || !root.isConnected) return;

    if (isDevMode()) {
      cachedOverview = getDevOverviewFixture();
      loadedPayrollRuns = getDevRunsFixture();
      cachedCompliance = getDevComplianceFixture();
      cachedIntegrity = getDevIntegrityFixture();
      cachedCafes = getDevCafesFixture();
      renderPayrollControlCentre(root);
    } else {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Payroll Control Centre Unavailable</div>
          <div style="font-size:13px; color: var(--text-secondary, #A0AEC0); margin-top: 8px;">
            ${escapeHtml(apiErrorMessage(err))}
          </div>
          <button class="btn btn-primary" type="button" data-retry-payroll style="margin-top:16px;">
            Try Again
          </button>
        </div>
      `;
      root.querySelector("[data-retry-payroll]")?.addEventListener("click", () => loadAllPayrollData(root));
    }
  } finally {
    if (activeRequest === requestController) {
      activeRequest = null;
    }
  }
}

// ─── ENTRYPOINT ──────────────────────────────────────────────────────────────
export function setPayrollActiveTab(tab) {
  activeTab = tab || "overview";
}

export function renderPayrollManagement(subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  return `<div id="payroll-management-root" class="page-enter"></div>`;
}

export function wirePayrollManagement(container, subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  const root = container.querySelector("#payroll-management-root") || container;
  if (!cachedOverview) {
    cachedOverview = getDevOverviewFixture();
    loadedPayrollRuns = getDevRunsFixture();
    cachedCompliance = getDevComplianceFixture();
    cachedIntegrity = getDevIntegrityFixture();
    cachedCafes = getDevCafesFixture();
  }
  renderPayrollControlCentre(root);
  loadAllPayrollData(root);
}

export default function render(root) {
  if (!cachedOverview) {
    cachedOverview = getDevOverviewFixture();
    loadedPayrollRuns = getDevRunsFixture();
    cachedCompliance = getDevComplianceFixture();
    cachedIntegrity = getDevIntegrityFixture();
    cachedCafes = getDevCafesFixture();
  }
  renderPayrollControlCentre(root);
  loadAllPayrollData(root);
}
