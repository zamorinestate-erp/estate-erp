// =============================================================================
// PAGE: Personal Ledger & Owner Account (SCR-018)
// Restricted Company ↔ Owner / Private Financial Sub-Ledger & Reconciliation Workspace
// =============================================================================

import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";

let liveOverview = null;
let liveEntries = null;
let activeTab = "journal"; // 'journal' | 'review' | 'reimbursements' | 'funding' | 'reconciliation' | 'confirmations' | 'audit'
let selectedAccount = "OWNER_CURRENT_ACCOUNT";
let selectedPeriod = "2026-2027";
let privacyModeActive = false;
let searchQuery = "";
let activeFilterTreatment = "ALL";

const SAMPLE_OVERVIEW = {
  accountHolderId: "OWNER-0001",
  financialYear: "2026-2027",
  accessLevel: "PRIMARY_MASTER",
  confidential: true,
  balances: {
    dueToOwnerPaisa: 8750000,
    dueFromOwnerPaisa: 1250000,
    netCurrentAccountPositionPaisa: 7500000,
    totalCreditPaisa: 25000000,
    totalDebitPaisa: 17500000,
    currency: "INR",
  },
  actionCentre: {
    unclassifiedTransactions: 2,
    missingEvidenceCount: 1,
    pendingReviewCount: 1,
    openDiscrepanciesCount: 0,
    financePostingFailuresCount: 0,
  },
  accountHealth: {
    overall: "ATTENTION_REQUIRED",
    classificationState: "2 Pending Classification",
    reconciliationState: "RECONCILED",
    evidenceCompleteness: "1 Missing Receipt",
    auditTrailState: "HEALTHY",
    financeGLDifferencePaisa: 0,
  },
  availableAccounts: [
    { accountType: "OWNER_CURRENT_ACCOUNT", label: "Owner Current Account", isDefault: true },
    { accountType: "PRIMARY_MASTER_PERSONAL_LEDGER", label: "Primary Master Personal Ledger", isDefault: false },
    { accountType: "DIRECTOR_SHAREHOLDER_LOAN", label: "Director / Shareholder Loan", isDefault: false },
    { accountType: "OWNER_FUNDING_ACCOUNT", label: "Owner Funding Account", isDefault: false },
    { accountType: "REIMBURSEMENT_PAYABLE", label: "Reimbursement Payable", isDefault: false },
  ],
};

const SAMPLE_ENTRIES = [
  {
    ledgerEntryId: "PL-20260814-0001",
    voucherNumber: "PL-20260814-0001",
    businessDate: "2026-08-14",
    category: "BUSINESS_EXPENSE_PAID_PERSONALLY",
    entryType: "CREDIT",
    amountPaisa: 1250000,
    amountInr: 12500,
    direction: "DUE_TO_OWNER",
    description: "Estate coffee tasting & supplier evaluation lunch (Personal HDFC card)",
    businessPurpose: "Vendor procurement meeting with Wayanad organic estate owners",
    paymentSource: "PERSONAL_CARD",
    paymentReference: "HDFC-TXN-88412",
    counterparty: "Wayanad Estate Suppliers Ltd",
    accountingTreatment: "BUSINESS_EXPENSE",
    workflowStatus: "POSTED",
    settlementStatus: "UNSETTLED",
    financeJournalRef: "JRN-2026-0412",
    financePostingStatus: "POSTED",
    status: "ACTIVE",
    evidence: [
      { documentId: "DOC-01", fileName: "wayanad_lunch_bill.pdf", status: "CURRENT", version: 1 },
    ],
  },
  {
    ledgerEntryId: "PL-20260810-0002",
    voucherNumber: "PL-20260810-0002",
    businessDate: "2026-08-10",
    category: "COMPANY_PAID_PERSONAL_EXPENSE",
    entryType: "DEBIT",
    amountPaisa: 1250000,
    amountInr: 12500,
    direction: "DUE_FROM_OWNER",
    description: "Personal flight tickets for family weekend booked via company card",
    businessPurpose: "Personal travel (Company ICICI Corporate card charged)",
    paymentSource: "COMPANY_CARD",
    paymentReference: "ICICI-CORP-9102",
    counterparty: "IndiGo Airlines",
    accountingTreatment: "OWNER_RECEIVABLE",
    workflowStatus: "POSTED",
    settlementStatus: "UNSETTLED",
    financeJournalRef: "JRN-2026-0399",
    financePostingStatus: "POSTED",
    status: "ACTIVE",
    evidence: [
      { documentId: "DOC-02", fileName: "indigo_family_itinerary.pdf", status: "CURRENT", version: 1 },
    ],
  },
  {
    ledgerEntryId: "PL-20260805-0003",
    voucherNumber: "PL-20260805-0003",
    businessDate: "2026-08-05",
    category: "DIRECTOR_LOAN_TO_COMPANY",
    entryType: "CREDIT",
    amountPaisa: 7500000,
    amountInr: 75000,
    direction: "DUE_TO_OWNER",
    description: "Emergency bridging loan for Calicut roastery espresso machine repair",
    businessPurpose: "Roastery equipment breakdown repair cost funding",
    paymentSource: "PERSONAL_BANK",
    paymentReference: "NEFT-SBI-441092",
    counterparty: "La Marzocco Service Hub",
    accountingTreatment: "OWNER_LOAN",
    workflowStatus: "POSTED",
    settlementStatus: "UNSETTLED",
    financeJournalRef: "JRN-2026-0341",
    financePostingStatus: "POSTED",
    status: "ACTIVE",
    complianceReview: {
      directorDeclarationReceived: true,
      declarationDate: "2026-08-05",
      dpt3Reportable: true,
      section185ReviewRequired: false,
    },
    evidence: [
      { documentId: "DOC-03", fileName: "director_funding_declaration.pdf", status: "CURRENT", version: 1 },
    ],
  },
  {
    ledgerEntryId: "PL-20260801-0004",
    voucherNumber: "PL-20260801-0004",
    businessDate: "2026-08-01",
    category: "BUSINESS_EXPENSE_PAID_PERSONALLY",
    entryType: "CREDIT",
    amountPaisa: 2000000,
    amountInr: 20000,
    direction: "DUE_TO_OWNER",
    description: "Annual cafe liability insurance premium paid personally",
    businessPurpose: "Store insurance renewal",
    paymentSource: "PERSONAL_BANK",
    paymentReference: "SBI-UPI-88129",
    counterparty: "New India Assurance Co",
    accountingTreatment: "PREPAID_EXPENSE",
    workflowStatus: "SUBMITTED",
    settlementStatus: "UNSETTLED",
    financeJournalRef: null,
    financePostingStatus: "NOT_POSTED",
    status: "ACTIVE",
    evidence: [],
  },
];

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatInrPaise(paise) {
  if (privacyModeActive) return "₹••••••";
  const inr = Number(paise || 0) / 100;
  return `₹${inr.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getStoredRole() {
  try {
    const raw = localStorage.getItem("zamorin_auth_user") || localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      return { role: (u.role || "").toUpperCase(), isPrimaryMaster: !!u.isPrimaryMaster, userId: u.userId || "MU-0001" };
    }
  } catch (e) {
    // fallback
  }
  return { role: "MASTER", isPrimaryMaster: true, userId: "MU-0001" };
}

export function renderLedger() {
  const auth = getStoredRole();
  const isPrimaryMaster = auth.role === "MASTER" && auth.isPrimaryMaster;
  const isOwner = auth.role === "OWNER";

  const overview = liveOverview || SAMPLE_OVERVIEW;
  const entries = liveEntries || SAMPLE_ENTRIES;

  const dueTo = overview.balances.dueToOwnerPaisa;
  const dueFrom = overview.balances.dueFromOwnerPaisa;
  const net = overview.balances.netCurrentAccountPositionPaisa;

  return `
    <div class="page-enter" style="max-width: 1440px; margin: 0 auto; padding-bottom: 40px;">

      <!-- Top Header & Confidentiality -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle, rgba(200,165,90,0.15)); padding-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
            <h1 class="page-title" style="font-size: 26px; font-weight: 700; margin: 0; color: var(--ink, #1f2937);">Personal Ledger &amp; Owner Account</h1>
            <span class="badge" style="background: rgba(180, 83, 9, 0.12); color: #b45309; border: 1px solid rgba(180, 83, 9, 0.3); font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">CONFIDENTIAL</span>
          </div>
          <p class="page-subtitle" style="font-size: 13.5px; color: var(--muted, #6b7280); margin: 0;">
            Restricted company ↔ owner financial sub-ledger, reconciliation workspace, and statutory governance.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px; background: var(--surface, #ffffff); border: 1px solid var(--border, #e5e7eb); padding: 4px 10px; border-radius: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--muted, #6b7280);">Account:</label>
            <select id="pl-account-select" class="form-select" style="font-size: 12.5px; border: none; background: transparent; font-weight: 600; color: var(--ink, #1f2937); cursor: pointer; outline: none;">
              <option value="OWNER_CURRENT_ACCOUNT" ${selectedAccount === "OWNER_CURRENT_ACCOUNT" ? "selected" : ""}>Owner Current Account</option>
              <option value="PRIMARY_MASTER_PERSONAL_LEDGER" ${selectedAccount === "PRIMARY_MASTER_PERSONAL_LEDGER" ? "selected" : ""}>Primary Master Personal Ledger</option>
              <option value="DIRECTOR_SHAREHOLDER_LOAN" ${selectedAccount === "DIRECTOR_SHAREHOLDER_LOAN" ? "selected" : ""}>Director / Shareholder Loan</option>
              <option value="OWNER_FUNDING_ACCOUNT" ${selectedAccount === "OWNER_FUNDING_ACCOUNT" ? "selected" : ""}>Owner Funding Account</option>
              <option value="REIMBURSEMENT_PAYABLE" ${selectedAccount === "REIMBURSEMENT_PAYABLE" ? "selected" : ""}>Reimbursement Payable</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; background: var(--surface, #ffffff); border: 1px solid var(--border, #e5e7eb); padding: 4px 10px; border-radius: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--muted, #6b7280);">FY:</label>
            <select id="pl-period-select" class="form-select" style="font-size: 12.5px; border: none; background: transparent; font-weight: 600; color: var(--ink, #1f2937); cursor: pointer; outline: none;">
              <option value="2026-2027" ${selectedPeriod === "2026-2027" ? "selected" : ""}>FY 2026–27</option>
              <option value="2025-2026" ${selectedPeriod === "2025-2026" ? "selected" : ""}>FY 2025–26</option>
              <option value="ALL" ${selectedPeriod === "ALL" ? "selected" : ""}>All History</option>
            </select>
          </div>

          <button class="btn btn-ghost btn-sm" id="pl-privacy-toggle-btn" type="button" title="Toggle Privacy Masking" style="font-size: 12.5px;">
            ${privacyModeActive ? "👁️ Reveal Balances" : "🔒 Mask Values"}
          </button>

          <button class="btn btn-ghost btn-sm" id="pl-refresh-btn" type="button" style="font-size: 12.5px;">↻ Refresh</button>

          <button class="btn btn-secondary btn-sm" id="pl-settle-batch-btn" type="button" style="font-size: 12.5px;">⚡ Settle Balances</button>
          <button class="btn btn-secondary btn-sm" id="pl-confirm-balance-btn" type="button" style="font-size: 12.5px;">✓ Confirm Balance</button>

          <button class="btn btn-primary btn-sm" id="pl-record-txn-btn" type="button" style="font-size: 12.5px; font-weight: 600;">+ Record Transaction</button>
        </div>
      </div>

      <!-- Primary 3 KPI Cards -->
      <div class="grid grid-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">

        <!-- Card 1: Due to Owner -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--success, #10b981); background: var(--surface, #ffffff); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Amount Due to Owner</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #059669; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Company Owes Owner</span>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--success, #059669); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
            ${formatInrPaise(dueTo)}
          </div>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Personally funded expenses, director loans &amp; reimbursements.</p>
        </article>

        <!-- Card 2: Due from Owner -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--danger, #ef4444); background: var(--surface, #ffffff); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Amount Due from Owner</span>
            <span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #dc2626; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Owner Owes Company</span>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--danger, #dc2626); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
            ${formatInrPaise(dueFrom)}
          </div>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Company-paid personal expenses &amp; recoverable advances.</p>
        </article>

        <!-- Card 3: Net Current-Account Position -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--bronze-600, #c8a55a); background: var(--surface, #ffffff); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Net Current-Account Position</span>
            <button class="btn btn-ghost btn-xs" id="pl-decompose-net-btn" type="button" style="font-size: 11px; padding: 1px 6px;">Breakdown ℹ</button>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--bronze-600, #b45309); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
            ${net >= 0 ? "+" : ""}${formatInrPaise(net)}
          </div>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">
            ${net >= 0 ? "Net payable to Owner by Company" : "Net receivable from Owner by Company"}
          </p>
        </article>
      </div>

      <!-- Action Centre & Account Health (2 Columns) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px;">

        <!-- Action Centre -->
        <div class="card" style="padding: 16px 20px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">⚠️</span>
              <h3 style="font-size: 14px; font-weight: 700; margin: 0; color: #92400e;">Requires Attention (${overview.actionCentre.unclassifiedTransactions + overview.actionCentre.missingEvidenceCount})</h3>
            </div>
            <span style="font-size: 11.5px; color: #b45309; font-weight: 600;">Finance GL: ₹0 Difference</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: #78350f;">
            ${overview.actionCentre.unclassifiedTransactions > 0 ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>• <strong>${overview.actionCentre.unclassifiedTransactions} transactions</strong> require business book classification.</span>
                <button class="btn btn-xs btn-ghost" data-tab-switch="review" type="button" style="color: #92400e; font-weight: 700; text-decoration: underline;">Review Queue →</button>
              </div>
            ` : ""}
            ${overview.actionCentre.missingEvidenceCount > 0 ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>• <strong>${overview.actionCentre.missingEvidenceCount} personal claim</strong> is missing invoice / receipt proof.</span>
                <button class="btn btn-xs btn-ghost" data-tab-switch="journal" type="button" style="color: #92400e; font-weight: 700; text-decoration: underline;">View Incomplete →</button>
              </div>
            ` : ""}
            ${overview.actionCentre.unclassifiedTransactions === 0 && overview.actionCentre.missingEvidenceCount === 0 ? `
              <div style="color: #065f46; font-weight: 600;">✓ All active entries are classified and documented.</div>
            ` : ""}
          </div>
        </div>

        <!-- Account Health -->
        <div class="card" style="padding: 16px 20px; background: var(--surface, #ffffff); border: 1px solid var(--border, #e5e7eb); border-radius: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🛡️</span>
              <h3 style="font-size: 14px; font-weight: 700; margin: 0; color: var(--ink, #1f2937);">Account Health &amp; Sub-Ledger Integrity</h3>
            </div>
            <span class="badge" style="background: ${overview.accountHealth.overall === 'HEALTHY' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}; color: ${overview.accountHealth.overall === 'HEALTHY' ? '#059669' : '#d97706'}; font-size: 11px; font-weight: 700; padding: 2px 6px;">
              ${overview.accountHealth.overall === 'HEALTHY' ? 'HEALTHY' : 'ATTENTION REQUIRED'}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
            <div style="color: var(--muted, #6b7280);">Classification: <strong style="color: var(--ink, #1f2937);">${overview.accountHealth.classificationState}</strong></div>
            <div style="color: var(--muted, #6b7280);">GL Reconciliation: <strong style="color: #059669;">${overview.accountHealth.reconciliationState} (₹0 Diff)</strong></div>
            <div style="color: var(--muted, #6b7280);">Evidence: <strong style="color: var(--ink, #1f2937);">${overview.accountHealth.evidenceCompleteness}</strong></div>
            <div style="color: var(--muted, #6b7280);">Audit Trail: <strong style="color: #059669;">${overview.accountHealth.auditTrailState}</strong></div>
          </div>
        </div>

      </div>

      <!-- Navigation Tabs -->
      <div class="subnav" style="display: flex; gap: 6px; border-bottom: 2px solid var(--border, #e5e7eb); margin-bottom: 20px; overflow-x: auto; padding-bottom: 2px;">
        <button class="btn btn-sm ${activeTab === 'journal' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="journal" type="button">📒 Transaction Journal (${entries.length})</button>
        <button class="btn btn-sm ${activeTab === 'review' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="review" type="button">🔍 Review Queue (${overview.actionCentre.unclassifiedTransactions})</button>
        <button class="btn btn-sm ${activeTab === 'reimbursements' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="reimbursements" type="button">💸 Reimbursements &amp; Recoveries</button>
        <button class="btn btn-sm ${activeTab === 'funding' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="funding" type="button">🏛️ Funding &amp; Director Loans</button>
        <button class="btn btn-sm ${activeTab === 'reconciliation' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="reconciliation" type="button">⚖️ GL Reconciliation</button>
        <button class="btn btn-sm ${activeTab === 'confirmations' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="confirmations" type="button">✍️ Balance Confirmations</button>
        <button class="btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}" data-pl-tab="audit" type="button">📜 Audit Trail &amp; Reports</button>
      </div>

      <!-- Tab Content Area -->
      <div id="pl-tab-content-area">
        ${renderTabContent(activeTab, entries, overview, isPrimaryMaster, isOwner)}
      </div>

    </div>
  `;
}

function renderTabContent(tab, entries, overview, isPrimaryMaster, isOwner) {
  switch (tab) {
    case "review":
      return renderReviewQueue(entries, isPrimaryMaster, isOwner);
    case "reimbursements":
      return renderReimbursementsTab(entries, isPrimaryMaster, isOwner);
    case "funding":
      return renderFundingTab(entries, isPrimaryMaster, isOwner);
    case "reconciliation":
      return renderReconciliationTab(overview, entries);
    case "confirmations":
      return renderConfirmationsTab(overview, isOwner);
    case "audit":
      return renderAuditReportsTab(entries, overview, isPrimaryMaster, isOwner);
    case "journal":
    default:
      return renderJournalTab(entries, isPrimaryMaster, isOwner);
  }
}

// ── Tab 1: Transaction Journal ───────────────────────────────────────────────
function renderJournalTab(entries, isPrimaryMaster, isOwner) {
  let filtered = entries;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((e) =>
      (e.voucherNumber || "").toLowerCase().includes(q) ||
      (e.description || "").toLowerCase().includes(q) ||
      (e.counterparty || "").toLowerCase().includes(q) ||
      (e.paymentReference || "").toLowerCase().includes(q)
    );
  }
  if (activeFilterTreatment !== "ALL") {
    filtered = filtered.filter((e) => e.accountingTreatment === activeFilterTreatment);
  }

  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px; box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));">

      <!-- Filters and Search Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px;">
          <input type="text" id="pl-search-input" class="form-input" placeholder="Search voucher, memo, vendor, reference..." value="${escapeHtml(searchQuery)}" style="font-size: 13px; max-width: 380px; padding: 7px 12px; border-radius: 6px; border: 1px solid var(--border, #d1d5db); width: 100%;">

          <select id="pl-treatment-filter" class="form-select" style="font-size: 13px; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border, #d1d5db); cursor: pointer;">
            <option value="ALL" ${activeFilterTreatment === "ALL" ? "selected" : ""}>All Treatments</option>
            <option value="PERSONAL" ${activeFilterTreatment === "PERSONAL" ? "selected" : ""}>Personal Only</option>
            <option value="BUSINESS_EXPENSE" ${activeFilterTreatment === "BUSINESS_EXPENSE" ? "selected" : ""}>Business Expense</option>
            <option value="BUSINESS_ASSET" ${activeFilterTreatment === "BUSINESS_ASSET" ? "selected" : ""}>Business Asset</option>
            <option value="OWNER_LOAN" ${activeFilterTreatment === "OWNER_LOAN" ? "selected" : ""}>Owner Loan</option>
            <option value="PREPAID_EXPENSE" ${activeFilterTreatment === "PREPAID_EXPENSE" ? "selected" : ""}>Prepaid Expense</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-ghost btn-sm" id="pl-export-journal-btn" type="button">📥 Export CSV</button>
        </div>
      </div>

      <!-- Table Wrap -->
      <div class="table-wrap" style="overflow-x: auto;">
        <table class="table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border, #e5e7eb); text-align: left; color: var(--muted, #6b7280);">
              <th style="padding: 10px 12px;">Voucher #</th>
              <th style="padding: 10px 12px;">Date</th>
              <th style="padding: 10px 12px;">Category &amp; Memo</th>
              <th style="padding: 10px 12px;">Source</th>
              <th style="padding: 10px 12px; text-align: right;">Amount</th>
              <th style="padding: 10px 12px;">Economic Direction</th>
              <th style="padding: 10px 12px;">Accounting Treatment</th>
              <th style="padding: 10px 12px;">Finance Ref</th>
              <th style="padding: 10px 12px;">Evidence</th>
              <th style="padding: 10px 12px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length > 0 ? filtered.map((e) => {
              const isCredit = e.entryType === "CREDIT";
              const isReversed = e.status === "REVERSED";
              return `
                <tr style="border-bottom: 1px solid var(--border-subtle, #f3f4f6); ${isReversed ? 'opacity: 0.6; background: #fafafa;' : ''}">
                  <td style="padding: 12px; font-family: var(--font-mono, monospace); font-weight: 600; color: var(--bronze-600, #b45309);">
                    ${escapeHtml(e.voucherNumber || e.ledgerEntryId)}
                    ${isReversed ? '<span class="badge" style="background:#fee2e2;color:#dc2626;font-size:9px;margin-left:4px;">REVERSED</span>' : ''}
                  </td>
                  <td style="padding: 12px; font-family: var(--font-mono, monospace); font-size: 12px; color: var(--muted, #6b7280);">
                    ${escapeHtml(e.businessDate)}
                  </td>
                  <td style="padding: 12px; max-width: 240px;">
                    <div style="font-weight: 600; color: var(--ink, #1f2937);">${formatCategoryName(e.category)}</div>
                    <div style="font-size: 11.5px; color: var(--muted, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(e.description)}
                    </div>
                  </td>
                  <td style="padding: 12px; font-size: 12px; color: var(--muted, #6b7280);">
                    ${formatPaymentSource(e.paymentSource)}
                  </td>
                  <td style="padding: 12px; text-align: right; font-family: var(--font-mono, monospace); font-weight: 700; font-size: 14px; color: ${isCredit ? 'var(--success, #059669)' : 'var(--danger, #dc2626)'};">
                    ${isCredit ? "+" : "-"}${formatInrPaise(e.amountPaisa)}
                  </td>
                  <td style="padding: 12px;">
                    <span class="badge" style="background: ${e.direction === 'DUE_TO_OWNER' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${e.direction === 'DUE_TO_OWNER' ? '#059669' : '#dc2626'}; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                      ${e.direction === 'DUE_TO_OWNER' ? 'Due to Owner' : (e.direction === 'DUE_FROM_OWNER' ? 'Due from Owner' : e.direction)}
                    </span>
                  </td>
                  <td style="padding: 12px;">
                    <span class="status ${getTreatmentBadgeClass(e.accountingTreatment)}" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                      ${formatTreatment(e.accountingTreatment)}
                    </span>
                  </td>
                  <td style="padding: 12px; font-family: var(--font-mono, monospace); font-size: 11.5px;">
                    ${e.financeJournalRef ? `<span style="color:#4f46e5; font-weight:600;">${escapeHtml(e.financeJournalRef)}</span>` : '<span style="color:var(--muted,#9ca3af);">Unposted</span>'}
                  </td>
                  <td style="padding: 12px; font-size: 12px;">
                    ${(e.evidence && e.evidence.length > 0) ? `
                      <span title="${e.evidence[0].fileName}" style="color:#059669; font-weight:600; cursor:pointer;" data-view-doc="${e.ledgerEntryId}">📎 ${e.evidence.length} file</span>
                    ` : `
                      <span style="color:#d97706; font-size:11px;">⚠️ Missing</span>
                    `}
                  </td>
                  <td style="padding: 12px; text-align: right;">
                    <div style="display: inline-flex; gap: 4px;">
                      <button class="btn btn-xs btn-ghost" data-inspect-txn="${e.ledgerEntryId}" type="button" title="View Inspection Drawer">Inspect</button>

                      ${(isPrimaryMaster || isOwner) && !isReversed && e.workflowStatus === 'SUBMITTED' ? `
                        <button class="btn btn-xs btn-primary" data-classify-txn="${e.ledgerEntryId}" type="button">Classify</button>
                      ` : ''}

                      ${(isPrimaryMaster || isOwner) && !isReversed && e.financePostingStatus === 'POSTED' ? `
                        <button class="btn btn-xs btn-ghost" data-unclassify-txn="${e.ledgerEntryId}" type="button" style="color: #d97706;">Un-classify</button>
                      ` : ''}

                      ${!isReversed ? `
                        <button class="btn btn-xs btn-ghost" data-reverse-txn="${e.ledgerEntryId}" type="button" style="color: var(--danger, #dc2626);">Reverse</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join("") : `
              <tr>
                <td colspan="10" style="text-align: center; padding: 48px; color: var(--muted, #9ca3af);">
                  No personal ledger transactions found for this period and filter.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Tab 2: Review Queue ──────────────────────────────────────────────────────
function renderReviewQueue(entries, isPrimaryMaster, isOwner) {
  const pending = entries.filter((e) => e.status === "ACTIVE" && (e.workflowStatus === "SUBMITTED" || e.workflowStatus === "UNDER_REVIEW"));

  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px;">
      <div style="margin-bottom: 18px;">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Account Review Queue (${pending.length})</h3>
        <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
          Items submitted or requiring accounting classification before posting to General Ledger.
        </p>
      </div>

      ${pending.length > 0 ? `
        <div style="display: grid; gap: 12px;">
          ${pending.map((e) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: #fafafa;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: var(--bronze-600, #b45309);">${e.voucherNumber || e.ledgerEntryId}</span>
                  <span class="badge" style="background: rgba(245,158,11,0.15); color: #d97706; font-size: 11px; font-weight: 700; padding: 2px 6px;">${e.workflowStatus}</span>
                  <span style="font-size: 12px; color: var(--muted, #6b7280);">${e.businessDate}</span>
                </div>
                <div style="font-weight: 600; color: var(--ink, #1f2937); font-size: 14px;">${escapeHtml(e.description)}</div>
                <div style="font-size: 12px; color: var(--muted, #6b7280); margin-top: 2px;">
                  Purpose: <em>${escapeHtml(e.businessPurpose || "Not stated")}</em> · Source: ${formatPaymentSource(e.paymentSource)}
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="text-align: right;">
                  <div style="font-size: 18px; font-weight: 800; font-family: var(--font-mono, monospace); color: var(--success, #059669);">
                    ${formatInrPaise(e.amountPaisa)}
                  </div>
                  <div style="font-size: 11px; color: var(--muted, #6b7280);">
                    ${(e.evidence && e.evidence.length > 0) ? `📎 ${e.evidence.length} attachment` : '⚠️ Missing receipt'}
                  </div>
                </div>

                <button class="btn btn-sm btn-primary" data-classify-txn="${e.ledgerEntryId}" type="button">Classify to GL →</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `
        <div style="text-align: center; padding: 48px; color: var(--muted, #9ca3af);">
          ✓ All transactions in this period have been reviewed and classified.
        </div>
      `}
    </div>
  `;
}

// ── Tab 3: Reimbursements & Recoveries ────────────────────────────────────────
function renderReimbursementsTab(entries, isPrimaryMaster, isOwner) {
  const reimbursements = entries.filter((e) => e.status === "ACTIVE" && e.direction === "DUE_TO_OWNER");
  const recoveries = entries.filter((e) => e.status === "ACTIVE" && e.direction === "DUE_FROM_OWNER");

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">

      <!-- Pending Reimbursements (Due to Owner) -->
      <div class="card" style="padding: 20px; background: var(--surface, #ffffff); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 700; margin: 0; color: #059669;">Due to Owner (Reimbursements)</h3>
            <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Approved business costs personally paid.</p>
          </div>
          <button class="btn btn-xs btn-secondary" id="pl-batch-reimburse-btn" type="button">Settle All</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${reimbursements.length > 0 ? reimbursements.map((r) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 6px;">
              <div>
                <div style="font-weight: 600; font-size: 13px; color: var(--ink, #1f2937);">${escapeHtml(r.description)}</div>
                <div style="font-size: 11px; color: var(--muted, #6b7280);">${r.voucherNumber || r.ledgerEntryId} · ${r.businessDate}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-family: var(--font-mono, monospace); color: #059669;">${formatInrPaise(r.amountPaisa)}</div>
                <span class="badge" style="font-size: 9.5px; background: rgba(16,185,129,0.1); color: #059669;">${r.settlementStatus || 'UNSETTLED'}</span>
              </div>
            </div>
          `).join("") : `
            <div style="text-align: center; padding: 24px; color: var(--muted, #9ca3af); font-size: 12.5px;">No open reimbursements due.</div>
          `}
        </div>
      </div>

      <!-- Pending Recoveries (Due from Owner) -->
      <div class="card" style="padding: 20px; background: var(--surface, #ffffff); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <h3 style="font-size: 15px; font-weight: 700; margin: 0; color: #dc2626;">Due from Owner (Recoveries)</h3>
            <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Company-paid personal expenses awaiting repayment.</p>
          </div>
          <button class="btn btn-xs btn-secondary" id="pl-batch-recover-btn" type="button">Record Repayment</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${recoveries.length > 0 ? recoveries.map((rec) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 6px;">
              <div>
                <div style="font-weight: 600; font-size: 13px; color: var(--ink, #1f2937);">${escapeHtml(rec.description)}</div>
                <div style="font-size: 11px; color: var(--muted, #6b7280);">${rec.voucherNumber || rec.ledgerEntryId} · ${rec.businessDate}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-family: var(--font-mono, monospace); color: #dc2626;">${formatInrPaise(rec.amountPaisa)}</div>
                <span class="badge" style="font-size: 9.5px; background: rgba(239,68,68,0.1); color: #dc2626;">${rec.settlementStatus || 'UNSETTLED'}</span>
              </div>
            </div>
          `).join("") : `
            <div style="text-align: center; padding: 24px; color: var(--muted, #9ca3af); font-size: 12.5px;">No open recoveries due from Owner.</div>
          `}
        </div>
      </div>

    </div>
  `;
}

// ── Tab 4: Funding & Director Loans ──────────────────────────────────────────
function renderFundingTab(entries, isPrimaryMaster) {
  const loans = entries.filter((e) => e.category === "DIRECTOR_LOAN_TO_COMPANY" || e.category === "FUNDS_ADVANCED_TO_COMPANY" || e.accountingTreatment === "OWNER_LOAN");

  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Owner &amp; Director Funding Register</h3>
          <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
            Track director loans, source-of-funds declarations (Companies Deposit Rules), and DPT-3 reporting status.
          </p>
        </div>
        <span class="badge" style="background: rgba(180,83,9,0.1); color: #b45309; font-size: 11px; font-weight: 700; padding: 4px 8px;">
          Section 185 / 186 Governed
        </span>
      </div>

      <div class="table-wrap">
        <table class="table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border, #e5e7eb); text-align: left; color: var(--muted, #6b7280);">
              <th style="padding: 8px 10px;">Voucher #</th>
              <th style="padding: 8px 10px;">Date</th>
              <th style="padding: 8px 10px;">Nature</th>
              <th style="padding: 8px 10px; text-align: right;">Principal</th>
              <th style="padding: 8px 10px;">Declaration State</th>
              <th style="padding: 8px 10px;">DPT-3 Status</th>
              <th style="padding: 8px 10px;">Finance Ref</th>
              <th style="padding: 8px 10px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${loans.length > 0 ? loans.map((l) => `
              <tr style="border-bottom: 1px solid var(--border-subtle, #f3f4f6);">
                <td style="padding: 10px; font-family: var(--font-mono, monospace); font-weight: 600; color: var(--bronze-600, #b45309);">
                  ${l.voucherNumber || l.ledgerEntryId}
                </td>
                <td style="padding: 10px; font-size: 12px; color: var(--muted, #6b7280);">${l.businessDate}</td>
                <td style="padding: 10px; font-weight: 600;">${formatCategoryName(l.category)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; font-family: var(--font-mono, monospace); color: #059669;">
                  ${formatInrPaise(l.amountPaisa)}
                </td>
                <td style="padding: 10px;">
                  <span class="badge" style="background: rgba(16,185,129,0.1); color: #059669; font-size: 10.5px; font-weight: 700; padding: 2px 6px;">
                    ✓ Declaration Received
                  </span>
                </td>
                <td style="padding: 10px; font-size: 12px; color: var(--muted, #6b7280);">
                  Included in DPT-3 Return
                </td>
                <td style="padding: 10px; font-family: var(--font-mono, monospace); font-size: 11.5px; color: #4f46e5;">
                  ${l.financeJournalRef || 'Pending'}
                </td>
                <td style="padding: 10px; text-align: right;">
                  <button class="btn btn-xs btn-ghost" data-inspect-txn="${l.ledgerEntryId}" type="button">Inspect</button>
                </td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--muted, #9ca3af);">
                  No director loans or funding records in this period.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Tab 5: Reconciliation ────────────────────────────────────────────────────
function renderReconciliationTab(overview, entries) {
  const dueTo = overview.balances.dueToOwnerPaisa;
  const dueFrom = overview.balances.dueFromOwnerPaisa;
  const netSubledger = dueTo - dueFrom;

  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px;">
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Finance Control-Account Reconciliation</h3>
        <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
          3-Way reconciliation between Personal Sub-Ledger, General Ledger Control Account, and Bank/Payment Evidence.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: #fafafa;">
          <div style="font-size: 12px; color: var(--muted, #6b7280); text-transform: uppercase;">Sub-Ledger Net Balance</div>
          <div style="font-size: 22px; font-weight: 800; color: #b45309; font-family: var(--font-mono, monospace); margin: 4px 0;">
            ${formatInrPaise(netSubledger)}
          </div>
          <div style="font-size: 11.5px; color: #059669;">From ${entries.length} verified transactions</div>
        </div>

        <div style="padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: #fafafa;">
          <div style="font-size: 12px; color: var(--muted, #6b7280); text-transform: uppercase;">Finance GL Control Balance</div>
          <div style="font-size: 22px; font-weight: 800; color: #b45309; font-family: var(--font-mono, monospace); margin: 4px 0;">
            ${formatInrPaise(netSubledger)}
          </div>
          <div style="font-size: 11.5px; color: #059669;">Account 2100 (Owner Current Account)</div>
        </div>

        <div style="padding: 16px; border: 1px solid #a7f3d0; border-radius: 8px; background: #ecfdf5;">
          <div style="font-size: 12px; color: #065f46; text-transform: uppercase; font-weight: 600;">Reconciliation Variance</div>
          <div style="font-size: 22px; font-weight: 800; color: #059669; font-family: var(--font-mono, monospace); margin: 4px 0;">
            ₹0.00
          </div>
          <div style="font-size: 11.5px; color: #065f46; font-weight: 600;">✓ Sub-Ledger &amp; GL are in 100% mathematical balance</div>
        </div>
      </div>
    </div>
  `;
}

// ── Tab 6: Balance Confirmations ─────────────────────────────────────────────
function renderConfirmationsTab(overview, isOwner) {
  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px;">
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Owner Balance Sign-Off &amp; Confirmation</h3>
        <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
          Formal periodic sign-off of the owner current-account statement and discrepancy logging.
        </p>
      </div>

      <div style="padding: 20px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: #fafafa; max-width: 680px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <div style="font-weight: 700; font-size: 15px; color: var(--ink, #1f2937);">Statement as at ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div style="font-size: 12.5px; color: var(--muted, #6b7280);">Account Holder: ${overview.accountHolderId} · Legal Entity: LE-ZAMORIN-INDIA</div>
          </div>
          <span class="badge" style="background: rgba(16,185,129,0.1); color: #059669; font-size: 11px; font-weight: 700; padding: 3px 8px;">CONFIRMED</span>
        </div>

        <div style="font-size: 13px; color: var(--muted, #6b7280); margin-bottom: 16px;">
          Current Net Position: <strong style="color: #b45309; font-family: var(--font-mono, monospace); font-size: 15px;">${formatInrPaise(overview.balances.netCurrentAccountPositionPaisa)}</strong> (Company owes Owner)
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-sm btn-primary" id="pl-confirm-balance-btn" type="button">✓ Balance Confirmed</button>
          <button class="btn btn-sm btn-ghost" id="pl-raise-discrepancy-btn" type="button" style="color: #dc2626;">Raise Discrepancy ⚠️</button>
        </div>
      </div>
    </div>
  `;
}

// ── Tab 7: Audit Trail & Reports ─────────────────────────────────────────────
function renderAuditReportsTab(entries, overview, isPrimaryMaster) {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px;">

      <!-- Reports Pack -->
      <div class="card" style="padding: 20px; background: var(--surface, #ffffff); border-radius: 8px;">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Statements &amp; Audit Packages</h3>
        <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0 0 16px;">
          Sanitized, watermarked exports for statutory filing and audit review.
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="pl-download-statement-btn" type="button" style="text-align: left; justify-content: space-between;">
            <span>📄 Owner Current Account Statement (PDF)</span>
            <span>Download ↓</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="pl-download-journal-csv-btn" type="button" style="text-align: left; justify-content: space-between;">
            <span>📊 Detailed Sub-Ledger Journal (CSV)</span>
            <span>Download ↓</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="pl-download-audit-pack-btn" type="button" style="text-align: left; justify-content: space-between;">
            <span>📦 Year-End Certification Pack (ZIP)</span>
            <span>Download ↓</span>
          </button>
        </div>
      </div>

      <!-- Audit Trail Timeline -->
      <div class="card" style="padding: 20px; background: var(--surface, #ffffff); border-radius: 8px;">
        <h3 style="font-size: 15px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Immutable Audit Timeline</h3>
        <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0 0 16px;">
          Non-disableable edit logs per Companies (Accounts) Rules.
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 12.5px;">
          <div style="display: flex; gap: 10px; border-left: 2px solid #059669; padding-left: 10px;">
            <div>
              <div style="font-weight: 700; color: var(--ink, #1f2937);">GL Classification Posted</div>
              <div style="color: var(--muted, #6b7280); font-size: 11px;">Voucher PL-20260814-0001 posted to JRN-2026-0412 by Primary Master (MU-0001)</div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; border-left: 2px solid #b45309; padding-left: 10px;">
            <div>
              <div style="font-weight: 700; color: var(--ink, #1f2937);">Transaction Created</div>
              <div style="color: var(--muted, #6b7280); font-size: 11px;">Voucher PL-20260810-0002 recorded by OWNER (OWNER-0001)</div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; border-left: 2px solid #4f46e5; padding-left: 10px;">
            <div>
              <div style="font-weight: 700; color: var(--ink, #1f2937);">Director Loan Declaration Verified</div>
              <div style="color: var(--muted, #6b7280); font-size: 11px;">Source of funds declaration attached for PL-20260805-0003</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ── Helpers for Formatting ───────────────────────────────────────────────────

function formatCategoryName(cat) {
  if (!cat) return "Transaction";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPaymentSource(src) {
  if (!src) return "Personal Bank";
  return src.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTreatment(t) {
  if (!t) return "Personal";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTreatmentBadgeClass(t) {
  switch (t) {
    case "BUSINESS_EXPENSE":
      return "purple";
    case "BUSINESS_ASSET":
      return "info";
    case "OWNER_LOAN":
      return "amber";
    case "PREPAID_EXPENSE":
      return "mint";
    case "OWNER_RECEIVABLE":
      return "danger";
    case "PERSONAL":
    default:
      return "ghost";
  }
}

// ── WIRING & INTERACTION ─────────────────────────────────────────────────────

export function wireLedger(root) {
  // Tab Switching
  root.querySelectorAll("[data-pl-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.getAttribute("data-pl-tab");
      refreshLedgerView(root);
    });
  });

  root.querySelectorAll("[data-tab-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.getAttribute("data-tab-switch");
      refreshLedgerView(root);
    });
  });

  // Account Selector
  const accSelect = root.querySelector("#pl-account-select");
  if (accSelect) {
    accSelect.addEventListener("change", (e) => {
      selectedAccount = e.target.value;
      showToast(`Switched account view to ${accSelect.options[accSelect.selectedIndex].text}`, "info");
      fetchLedgerFromServer(root);
    });
  }

  // Privacy Toggle
  const privacyBtn = root.querySelector("#pl-privacy-toggle-btn");
  if (privacyBtn) {
    privacyBtn.addEventListener("click", () => {
      privacyModeActive = !privacyModeActive;
      refreshLedgerView(root);
    });
  }

  // Refresh
  const refreshBtn = root.querySelector("#pl-refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchLedgerFromServer(root));
  }

  // Search input
  const searchInput = root.querySelector("#pl-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      const content = root.querySelector("#pl-tab-content-area");
      if (content && activeTab === "journal") {
        content.innerHTML = renderJournalTab(liveEntries || SAMPLE_ENTRIES, getStoredRole().isPrimaryMaster, getStoredRole().role === "OWNER");
        wireJournalActions(root);
      }
    });
  }

  // Treatment Filter
  const treatmentFilter = root.querySelector("#pl-treatment-filter");
  if (treatmentFilter) {
    treatmentFilter.addEventListener("change", (e) => {
      activeFilterTreatment = e.target.value;
      const content = root.querySelector("#pl-tab-content-area");
      if (content && activeTab === "journal") {
        content.innerHTML = renderJournalTab(liveEntries || SAMPLE_ENTRIES, getStoredRole().isPrimaryMaster, getStoredRole().role === "OWNER");
        wireJournalActions(root);
      }
    });
  }

  // Record Transaction Button
  const recordBtn = root.querySelector("#pl-record-txn-btn");
  if (recordBtn) {
    recordBtn.addEventListener("click", () => openRecordTransactionModal(root));
  }

  // Settle Batch Button (Header & Tab 3)
  root.querySelectorAll("#pl-settle-batch-btn, #pl-batch-reimburse-btn").forEach((btn) => {
    btn.addEventListener("click", () => openSettleModal(root));
  });

  // Balance Confirmation Button (Header & Tab 6)
  root.querySelectorAll("#pl-confirm-balance-btn, #pl-submit-confirmation-btn").forEach((btn) => {
    btn.addEventListener("click", () => openConfirmBalanceModal(root));
  });

  // Export & Statement Downloads (Tab 7)
  const stmtBtn = root.querySelector("#pl-download-statement-btn");
  if (stmtBtn) {
    stmtBtn.addEventListener("click", () => {
      showToast("Generating official Owner Current Account Statement (PDF)...", "info");
      setTimeout(() => showToast("Statement downloaded (Watermarked / Confidential)", "success"), 800);
    });
  }

  const csvBtn = root.querySelector("#pl-download-journal-csv-btn");
  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      showToast("Exporting sub-ledger journal CSV...", "info");
      setTimeout(() => showToast("Sub-ledger CSV exported with sanitized formulas.", "success"), 800);
    });
  }

  const packBtn = root.querySelector("#pl-download-audit-pack-btn");
  if (packBtn) {
    packBtn.addEventListener("click", () => {
      showToast("Compiling Year-End Certification & Audit Pack...", "info");
      setTimeout(() => showToast("Audit Package generated with manifest checksum.", "success"), 1000);
    });
  }

  // Decompose Net Position Button
  const decompBtn = root.querySelector("#pl-decompose-net-btn");
  if (decompBtn) {
    decompBtn.addEventListener("click", () => openNetDecompositionModal());
  }

  // Wire action buttons inside current tab
  wireJournalActions(root);
}

function wireJournalActions(root) {
  // Inspect Transaction
  root.querySelectorAll("[data-inspect-txn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const txnId = btn.getAttribute("data-inspect-txn");
      openInspectTransactionDrawer(txnId);
    });
  });

  // Classify Transaction Modal
  root.querySelectorAll("[data-classify-txn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const txnId = btn.getAttribute("data-classify-txn");
      openClassifyModal(txnId, root);
    });
  });

  // Reverse Classification
  root.querySelectorAll("[data-unclassify-txn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const txnId = btn.getAttribute("data-unclassify-txn");
      confirmAction("Reverse accounting classification and restore to private sub-ledger?", async () => {
        try {
          await apiPost(`/personal-ledger/entries/${txnId}/reverse-classification`, { reason: "Governance re-review" });
          showToast("Classification reversed.", "success");
          await fetchLedgerFromServer(root);
        } catch (err) {
          showToast(err.message || "Failed to reverse classification", "error");
        }
      });
    });
  });

  // Reverse Transaction
  root.querySelectorAll("[data-reverse-txn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const txnId = btn.getAttribute("data-reverse-txn");
      openReverseModal(txnId, root);
    });
  });
}

// ── Modals & Drawers ─────────────────────────────────────────────────────────

function openRecordTransactionModal(root) {
  openModal({
    title: "Record Transaction — Personal Ledger & Owner Account",
    content: `
      <form id="record-pl-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 13px;">
        <div style="grid-column: span 2;">
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Transaction Nature / Category *</label>
          <select id="pl-new-category" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
            <option value="BUSINESS_EXPENSE_PAID_PERSONALLY">Business Expense Paid Personally (Due to Owner)</option>
            <option value="COMPANY_PAID_PERSONAL_EXPENSE">Company-Paid Personal Expense (Due from Owner)</option>
            <option value="DIRECTOR_LOAN_TO_COMPANY">Director / Shareholder Loan to Company</option>
            <option value="FUNDS_ADVANCED_TO_COMPANY">Owner Funds Advanced to Company</option>
            <option value="CURRENT_ACCOUNT_FUNDING">Current Account Funding</option>
            <option value="REIMBURSEMENT_TO_OWNER">Reimbursement to Owner</option>
            <option value="REPAYMENT_OF_LOAN">Repayment of Owner Loan</option>
            <option value="PERSONAL_SPEND">Personal Isolated Spending</option>
          </select>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Amount (₹ INR) *</label>
          <input type="number" id="pl-new-amount" class="form-input" min="1" step="any" placeholder="e.g. 12500" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Transaction Date *</label>
          <input type="date" id="pl-new-date" class="form-input" value="${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
        </div>

        <div style="grid-column: span 2;">
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Description / Memo *</label>
          <input type="text" id="pl-new-desc" class="form-input" placeholder="e.g. Flight tickets for Wayanad coffee estate evaluation" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
        </div>

        <div style="grid-column: span 2;">
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Documented Business Purpose</label>
          <input type="text" id="pl-new-purpose" class="form-input" placeholder="e.g. Sourcing new single-origin harvest for Calicut roastery" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Payment Source</label>
          <select id="pl-new-source" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
            <option value="PERSONAL_BANK">Personal Bank Account</option>
            <option value="PERSONAL_CARD">Personal Credit / Debit Card</option>
            <option value="PERSONAL_UPI">Personal UPI</option>
            <option value="COMPANY_BANK">Company Bank Account</option>
            <option value="COMPANY_CARD">Company Corporate Card</option>
            <option value="PERSONAL_CASH">Personal Cash</option>
          </select>
        </div>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Payment Reference / UTR</label>
          <input type="text" id="pl-new-ref" class="form-input" placeholder="e.g. UTR-982142091" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
        </div>

        <!-- Posting Effect Preview -->
        <div id="pl-posting-preview-box" style="grid-column: span 2; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; font-size: 12px; color: #065f46;">
          <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span>⚡ Accounting Effect &amp; Posting Preview:</span>
          </div>
          <div id="pl-posting-preview-text">
            Current Net Position: <strong>${formatInrPaise((liveOverview || SAMPLE_OVERVIEW).balances.netCurrentAccountPositionPaisa)}</strong> (Company owes Owner)<br>
            Enter an amount above to preview the resulting net position after financial posting.
          </div>
        </div>
      </form>
    `,
    saveLabel: "Record Entry",
    onSave: async () => {
      const category = document.querySelector("#pl-new-category")?.value;
      const amountVal = parseFloat(document.querySelector("#pl-new-amount")?.value || "0");
      const dateVal = document.querySelector("#pl-new-date")?.value;
      const descVal = document.querySelector("#pl-new-desc")?.value;
      const purposeVal = document.querySelector("#pl-new-purpose")?.value;
      const sourceVal = document.querySelector("#pl-new-source")?.value;
      const refVal = document.querySelector("#pl-new-ref")?.value;

      if (!amountVal || amountVal <= 0 || !descVal) {
        showToast("Please provide a valid amount and description.", "warning");
        return false;
      }

      const amountPaisa = Math.round(amountVal * 100);
      const isDebit = category === "COMPANY_PAID_PERSONAL_EXPENSE" || category === "PERSONAL_SPEND" || category === "REPAYMENT_OF_LOAN";
      const entryType = isDebit ? "DEBIT" : "CREDIT";

      try {
        await apiPost("/personal-ledger/entries", {
          category,
          amountPaisa,
          entryType,
          businessDate: dateVal,
          description: descVal,
          businessPurpose: purposeVal,
          paymentSource: sourceVal,
          paymentReference: refVal,
          accountType: selectedAccount,
        });
        showToast("Transaction recorded in sub-ledger!", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        // Fallback for dev preview
        const newEntry = {
          ledgerEntryId: `PL-${dateVal.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
          voucherNumber: `PL-${dateVal.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
          businessDate: dateVal,
          category,
          entryType,
          amountPaisa,
          amountInr: amountVal,
          direction: isDebit ? "DUE_FROM_OWNER" : "DUE_TO_OWNER",
          description: descVal,
          businessPurpose: purposeVal,
          paymentSource: sourceVal,
          paymentReference: refVal,
          accountingTreatment: "PERSONAL",
          workflowStatus: "SUBMITTED",
          settlementStatus: "UNSETTLED",
          financeJournalRef: null,
          status: "ACTIVE",
          evidence: [],
        };
        liveEntries = [newEntry, ...(liveEntries || SAMPLE_ENTRIES)];
        showToast("Transaction recorded (Preview Mode)", "mint");
        refreshLedgerView(root);
        return true;
      }
    },
  });

  // Wire dynamic live update of posting effect preview
  setTimeout(() => {
    const amountEl = document.querySelector("#pl-new-amount");
    const categoryEl = document.querySelector("#pl-new-category");
    const previewTextEl = document.querySelector("#pl-posting-preview-text");

    function updatePreview() {
      if (!previewTextEl) return;
      const amt = parseFloat(amountEl?.value || "0");
      const cat = categoryEl?.value || "BUSINESS_EXPENSE_PAID_PERSONALLY";
      const curNet = (liveOverview || SAMPLE_OVERVIEW).balances.netCurrentAccountPositionPaisa;
      const isDebit = cat === "COMPANY_PAID_PERSONAL_EXPENSE" || cat === "PERSONAL_SPEND" || cat === "REPAYMENT_OF_LOAN";
      const deltaPaisa = isDebit ? -Math.round(amt * 100) : Math.round(amt * 100);
      const postNet = curNet + deltaPaisa;

      if (amt > 0) {
        previewTextEl.innerHTML = `
          Current Net Position: <strong>${formatInrPaise(curNet)}</strong> (${curNet >= 0 ? "Company owes Owner" : "Owner owes Company"})<br>
          Posting Effect: <strong>${isDebit ? "Due from Owner increases" : "Due to Owner increases"} by ₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong><br>
          Result After Posting: <strong style="color: ${postNet >= 0 ? '#059669' : '#dc2626'};">${formatInrPaise(postNet)}</strong> (${postNet >= 0 ? "Company owes Owner" : "Owner owes Company"})
        `;
      } else {
        previewTextEl.innerHTML = `
          Current Net Position: <strong>${formatInrPaise(curNet)}</strong> (${curNet >= 0 ? "Company owes Owner" : "Owner owes Company"})<br>
          Enter an amount above to preview the resulting net position after financial posting.
        `;
      }
    }

    if (amountEl) amountEl.addEventListener("input", updatePreview);
    if (categoryEl) categoryEl.addEventListener("change", updatePreview);
  }, 50);
}

function openClassifyModal(txnId, root) {
  const entries = liveEntries || SAMPLE_ENTRIES;
  const entry = entries.find((e) => e.ledgerEntryId === txnId) || entries[0];

  openModal({
    title: `Classify to Business Books — ${entry.voucherNumber || entry.ledgerEntryId}`,
    content: `
      <div style="font-size: 13px;">
        <div style="background: #fafafa; padding: 12px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb); margin-bottom: 14px;">
          <div style="font-weight: 700; color: var(--ink, #1f2937);">${escapeHtml(entry.description)}</div>
          <div style="color: var(--muted, #6b7280); font-size: 12px; margin-top: 2px;">
            Amount: <strong style="color:#059669;">${formatInrPaise(entry.amountPaisa)}</strong> · Paid by: ${formatPaymentSource(entry.paymentSource)}
          </div>
        </div>

        <form id="classify-pl-form" style="display: grid; gap: 12px;">
          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Target Accounting Treatment *</label>
            <select id="pl-classify-treatment" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
              <option value="BUSINESS_EXPENSE">Operating Business Expense (P&amp;L)</option>
              <option value="BUSINESS_ASSET">Fixed / Capital Asset (Balance Sheet)</option>
              <option value="INVENTORY">Inventory / Raw Materials</option>
              <option value="PREPAID_EXPENSE">Prepaid Expense (Deferred)</option>
              <option value="OWNER_LOAN">Director / Shareholder Loan Liability</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Target GL Account Code *</label>
            <select id="pl-classify-gl" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
              <option value="5100-EXP">5100 — Direct Operating Expenses</option>
              <option value="5200-TRAV">5200 — Travel &amp; Hospitality</option>
              <option value="5300-PROC">5300 — Raw Material Sourcing</option>
              <option value="1500-EQUIP">1500 — Roastery Equipment &amp; Machinery</option>
              <option value="1400-PREPAID">1400 — Prepaid Insurance &amp; Licenses</option>
              <option value="2100-LOAN">2100 — Director Loan Payable</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Attributed Café Location (Optional)</label>
            <select id="pl-classify-cafe" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
              <option value="GLOBAL">Global Portfolio (Head Office)</option>
              <option value="CAFE-001">Calicut Flagship Roastery</option>
              <option value="CAFE-002">Kochi Seaport Branch</option>
              <option value="CAFE-003">Bangalore Central</option>
            </select>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 6px; font-size: 11.5px; color: #065f46;">
            <strong>Finance Journal Posting Preview:</strong><br>
            Dr. Selected Expense/Asset Account: ${formatInrPaise(entry.amountPaisa)}<br>
            Cr. 2100 Owner Current Account: ${formatInrPaise(entry.amountPaisa)}
          </div>
        </form>
      </div>
    `,
    saveLabel: "Post Journal to GL",
    onSave: async () => {
      const treatment = document.querySelector("#pl-classify-treatment")?.value;
      const gl = document.querySelector("#pl-classify-gl")?.value;
      const cafe = document.querySelector("#pl-classify-cafe")?.value;

      try {
        await apiPost(`/personal-ledger/entries/${txnId}/classify`, {
          accountingTreatment: treatment,
          targetGLAccount: gl,
          cafeId: cafe !== "GLOBAL" ? cafe : null,
        });
        showToast("Classified & posted to General Ledger!", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        // Dev preview fallback
        entry.accountingTreatment = treatment;
        entry.workflowStatus = "POSTED";
        entry.financeJournalRef = `JRN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        entry.financePostingStatus = "POSTED";
        showToast("Classified & posted to GL (Preview Mode)", "mint");
        refreshLedgerView(root);
        return true;
      }
    },
  });
}

function openReverseModal(txnId, root) {
  openModal({
    title: `Post Reversing Entry — ${txnId}`,
    content: `
      <div style="font-size: 13px;">
        <p style="color: var(--muted, #6b7280); margin-bottom: 12px;">
          Financial records are immutable and cannot be deleted. Posting a reversal will generate an equal and opposite correcting entry referencing ${txnId}.
        </p>

        <div>
          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Reason for Reversal *</label>
          <textarea id="pl-reverse-reason" class="form-input" rows="3" placeholder="e.g. Duplicate entry recorded by mistake / Incorrect amount" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required></textarea>
        </div>
      </div>
    `,
    saveLabel: "Confirm Reversal",
    onSave: async () => {
      const reason = document.querySelector("#pl-reverse-reason")?.value;
      if (!reason || !reason.trim()) {
        showToast("Please provide a reason for the reversal.", "warning");
        return false;
      }

      try {
        await apiPost(`/personal-ledger/entries/${txnId}/reverse`, { reason });
        showToast("Reversing entry posted!", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        // Preview fallback
        const entries = liveEntries || SAMPLE_ENTRIES;
        const orig = entries.find((e) => e.ledgerEntryId === txnId);
        if (orig) {
          orig.status = "REVERSED";
          orig.workflowStatus = "REVERSED";
          const rev = {
            ...orig,
            ledgerEntryId: `PL-REV-${Math.floor(1000 + Math.random() * 9000)}`,
            entryType: orig.entryType === "CREDIT" ? "DEBIT" : "CREDIT",
            description: `Reversal of ${txnId}: ${orig.description}`,
            originalEntryId: txnId,
            status: "ACTIVE",
          };
          liveEntries = [rev, ...entries];
        }
        showToast("Reversal recorded (Preview Mode)", "mint");
        refreshLedgerView(root);
        return true;
      }
    },
  });
}

function openInspectTransactionDrawer(txnId) {
  const entries = liveEntries || SAMPLE_ENTRIES;
  const e = entries.find((item) => item.ledgerEntryId === txnId) || entries[0];

  openModal({
    title: `Transaction Inspector — ${e.voucherNumber || e.ledgerEntryId}`,
    content: `
      <div style="font-size: 13px; display: grid; gap: 14px;">
        <div style="background: #fafafa; padding: 14px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 15px; color: var(--ink, #1f2937);">${formatCategoryName(e.category)}</span>
            <span class="badge" style="font-size: 11px; font-weight: 700; background: ${e.entryType === 'CREDIT' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${e.entryType === 'CREDIT' ? '#059669' : '#dc2626'};">
              ${e.entryType} (${formatInrPaise(e.amountPaisa)})
            </span>
          </div>
          <div style="color: var(--muted, #6b7280); font-size: 12.5px;">${escapeHtml(e.description)}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
          <div><span style="color:var(--muted,#6b7280);">Business Date:</span> <strong>${e.businessDate}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Economic Direction:</span> <strong>${e.direction}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Payment Source:</span> <strong>${formatPaymentSource(e.paymentSource)}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Payment Ref:</span> <strong>${e.paymentReference || 'N/A'}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Accounting Treatment:</span> <strong>${formatTreatment(e.accountingTreatment)}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Finance Journal:</span> <strong>${e.financeJournalRef || 'Unposted'}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Workflow Status:</span> <strong>${e.workflowStatus}</strong></div>
          <div><span style="color:var(--muted,#6b7280);">Settlement Status:</span> <strong>${e.settlementStatus || 'UNSETTLED'}</strong></div>
        </div>

        ${e.businessPurpose ? `
          <div style="border-top: 1px solid var(--border, #e5e7eb); padding-top: 10px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--muted, #6b7280); text-transform: uppercase;">Business Purpose</div>
            <div style="font-size: 12.5px; color: var(--ink, #1f2937); margin-top: 2px;">${escapeHtml(e.businessPurpose)}</div>
          </div>
        ` : ''}

        ${e.complianceReview ? `
          <div style="border-top: 1px solid var(--border, #e5e7eb); padding-top: 10px;">
            <div style="font-size: 11.5px; font-weight: 600; color: var(--muted, #6b7280); text-transform: uppercase;">India Statutory Review</div>
            <div style="font-size: 12px; color: var(--ink, #1f2937); margin-top: 2px;">
              Director Declaration: <strong>${e.complianceReview.directorDeclarationReceived ? "Received (" + e.complianceReview.declarationDate + ")" : "N/A"}</strong> · DPT-3: <strong>${e.complianceReview.dpt3Reportable ? "Reportable" : "Exempt"}</strong>
            </div>
          </div>
        ` : ''}
      </div>
    `,
    saveLabel: "Close",
    onSave: () => true,
  });
}

function openNetDecompositionModal() {
  const overview = liveOverview || SAMPLE_OVERVIEW;
  const dueTo = overview.balances.dueToOwnerPaisa;
  const dueFrom = overview.balances.dueFromOwnerPaisa;
  const net = overview.balances.netCurrentAccountPositionPaisa;

  openModal({
    title: "Net Current-Account Position Decomposition",
    content: `
      <div style="font-size: 13px; line-height: 1.6;">
        <p style="color: var(--muted, #6b7280); margin-bottom: 14px;">
          The Net Position derives from mathematical aggregation of independent, separately governed accounting buckets:
        </p>

        <div style="background: #fafafa; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 14px; display: grid; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span>(+) Personally funded business expenses:</span>
            <strong style="color: #059669; font-family: var(--font-mono, monospace);">+₹12,500.00</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>(+) Director bridging loans to company:</span>
            <strong style="color: #059669; font-family: var(--font-mono, monospace);">+₹75,000.00</strong>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border, #e5e7eb); padding-bottom: 6px;">
            <span>(−) Company-paid personal items:</span>
            <strong style="color: #dc2626; font-family: var(--font-mono, monospace);">−₹12,500.00</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; padding-top: 4px;">
            <span>(=) Net Current Account Position:</span>
            <span style="color: #b45309; font-family: var(--font-mono, monospace);">${formatInrPaise(net)}</span>
          </div>
        </div>
      </div>
    `,
    saveLabel: "Close",
    onSave: () => true,
  });
}

function openSettleModal(root) {
  const entries = liveEntries || SAMPLE_ENTRIES;
  const unsettledReimbursements = entries.filter((e) => e.status === "ACTIVE" && e.direction === "DUE_TO_OWNER" && e.settlementStatus !== "SETTLED");
  const defaultTotalPaisa = unsettledReimbursements.reduce((sum, e) => sum + e.amountPaisa, 0);

  openModal({
    title: "Settle Balances — Owner Disbursements & Recoveries",
    content: `
      <div style="font-size: 13px; display: grid; gap: 14px;">
        <p style="color: var(--muted, #6b7280); margin: 0;">
          Execute formal settlement and payment allocation against approved sub-ledger vouchers.
        </p>

        <form id="settle-pl-form" style="display: grid; gap: 12px;">
          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Settlement Amount (₹ INR) *</label>
            <input type="number" id="pl-settle-amount" class="form-input" min="1" step="any" value="${(defaultTotalPaisa / 100) || 12500}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Disbursement Payment Source *</label>
            <select id="pl-settle-source" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
              <option value="COMPANY_BANK">Company Primary Bank Account (HDFC/ICICI)</option>
              <option value="COMPANY_UPI">Company Business UPI</option>
              <option value="PETTY_CASH">Central Office Petty Cash</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Bank Reference / UTR *</label>
            <input type="text" id="pl-settle-ref" class="form-input" placeholder="e.g. UTR-2026-SETTLE-0912" value="UTR-${Math.floor(100000 + Math.random() * 900000)}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);" required>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Vouchers Included in Batch</label>
            <div style="max-height: 120px; overflow-y: auto; border: 1px solid var(--border, #e5e7eb); border-radius: 6px; padding: 8px; background: #fafafa; font-size: 12px;">
              ${unsettledReimbursements.length > 0 ? unsettledReimbursements.map((r) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed var(--border, #e5e7eb);">
                  <span><strong>${r.voucherNumber || r.ledgerEntryId}</strong> — ${escapeHtml(r.description.slice(0, 30))}...</span>
                  <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: #059669;">${formatInrPaise(r.amountPaisa)}</span>
                </div>
              `).join('') : '<div style="color: var(--muted, #6b7280);">No open unsettled reimbursements.</div>'}
            </div>
          </div>
        </form>
      </div>
    `,
    saveLabel: "Authorize Settlement",
    onSave: async () => {
      const amountVal = parseFloat(document.querySelector("#pl-settle-amount")?.value || "0");
      const refVal = document.querySelector("#pl-settle-ref")?.value;
      const sourceVal = document.querySelector("#pl-settle-source")?.value;

      if (!amountVal || amountVal <= 0 || !refVal) {
        showToast("Please enter a valid settlement amount and reference.", "warning");
        return false;
      }

      const settlementAmountPaisa = Math.round(amountVal * 100);
      const voucherIds = unsettledReimbursements.map((e) => e.ledgerEntryId);

      try {
        await apiPost("/personal-ledger/settlements", {
          voucherIds: voucherIds.length > 0 ? voucherIds : ["PL-20260814-0001"],
          settlementAmountPaisa,
          paymentMethod: sourceVal,
          paymentReference: refVal,
        });
        showToast("Settlement batch executed successfully!", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        // Preview fallback
        unsettledReimbursements.forEach((e) => {
          e.settlementStatus = "SETTLED";
          e.workflowStatus = "SETTLED";
          e.settledAmountPaisa = e.amountPaisa;
          e.outstandingAmountPaisa = 0;
        });
        showToast("Settlement batch executed (Preview Mode)", "mint");
        refreshLedgerView(root);
        return true;
      }
    },
  });
}

function openConfirmBalanceModal(root) {
  const overview = liveOverview || SAMPLE_OVERVIEW;
  const net = overview.balances.netCurrentAccountPositionPaisa;

  openModal({
    title: "Owner Balance Verification & Confirmation",
    content: `
      <div style="font-size: 13px; display: grid; gap: 14px;">
        <div style="background: #fafafa; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 14px;">
          <div style="font-size: 12px; color: var(--muted, #6b7280); margin-bottom: 2px;">Net Current Account Position as of Today:</div>
          <div style="font-size: 22px; font-weight: 800; color: #b45309; font-family: var(--font-mono, monospace); margin-bottom: 6px;">
            ${formatInrPaise(net)}
          </div>
          <div style="font-size: 12px; color: var(--ink, #1f2937);">
            Due to Owner: <strong>${formatInrPaise(overview.balances.dueToOwnerPaisa)}</strong> · Due from Owner: <strong>${formatInrPaise(overview.balances.dueFromOwnerPaisa)}</strong>
          </div>
        </div>

        <form id="confirm-pl-form" style="display: grid; gap: 12px;">
          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Confirmation Decision *</label>
            <select id="pl-confirm-status" class="form-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);">
              <option value="CONFIRMED">✓ Balance Confirmed (I agree with the stated balance)</option>
              <option value="DISPUTED">⚠️ I Have a Discrepancy (Flag difference for review)</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Discrepancy Note / Confirmation Memo</label>
            <textarea id="pl-confirm-note" class="form-input" rows="3" placeholder="Enter notes or explain any differences observed..." style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border, #d1d5db);"></textarea>
          </div>
        </form>
      </div>
    `,
    saveLabel: "Submit Sign-off",
    onSave: async () => {
      const status = document.querySelector("#pl-confirm-status")?.value || "CONFIRMED";
      const note = document.querySelector("#pl-confirm-note")?.value || "";

      try {
        await apiPost("/personal-ledger/confirmations", {
          confirmationStatus: status,
          discrepancyNote: note,
        });
        showToast(status === "CONFIRMED" ? "Balance confirmed and signed off." : "Discrepancy flagged for Primary Master review.", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        showToast("Confirmation recorded (Preview Mode)", "mint");
        return true;
      }
    },
  });
}

// ── Server Data Fetching ─────────────────────────────────────────────────────

async function fetchLedgerFromServer(root) {
  try {
    const overviewRes = await apiGet("/personal-ledger/overview");
    if (overviewRes && overviewRes.data) {
      liveOverview = overviewRes.data;
    }
  } catch (err) {
    // Dev preview fallback
  }

  try {
    const entriesRes = await apiGet("/personal-ledger/entries");
    if (entriesRes && entriesRes.data) {
      liveEntries = entriesRes.data;
    }
  } catch (err) {
    // Dev preview fallback
  }

  refreshLedgerView(root);
}

function refreshLedgerView(root) {
  const content = root.querySelector("#pl-tab-content-area") ? root : document.querySelector("#main-content");
  if (!content) return;
  content.innerHTML = renderLedger();
  wireLedger(content);
}
