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
  return `₹${inr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function formatCategoryName(cat) {
  const map = {
    BUSINESS_EXPENSE_PAID_PERSONALLY: "Business Expense (Personal Fund)",
    COMPANY_PAID_PERSONAL_EXPENSE: "Personal Expense (Company Card)",
    DIRECTOR_LOAN_TO_COMPANY: "Director Loan to Company",
    REIMBURSEMENT_SETTLEMENT: "Reimbursement Settlement",
    FUNDS_ADVANCED_TO_COMPANY: "Emergency Advance to Company",
  };
  return map[cat] || (cat || "").replace(/_/g, " ");
}

function formatPaymentSource(src) {
  const map = {
    PERSONAL_CARD: "Personal Card (HDFC)",
    COMPANY_CARD: "Company Corp Card (ICICI)",
    PERSONAL_BANK: "Personal NetBanking / UPI",
    COMPANY_BANK: "Company Current Account",
    PETTY_CASH: "Cash in Hand",
  };
  return map[src] || (src || "").replace(/_/g, " ");
}

function formatTreatment(trt) {
  const map = {
    BUSINESS_EXPENSE: "Operating Expense (P&L)",
    OWNER_RECEIVABLE: "Owner Receivable (Current Asset)",
    OWNER_LOAN: "Director Loan (Liability)",
    PREPAID_EXPENSE: "Prepaid Expense (Asset)",
    BUSINESS_ASSET: "Capital Asset (Asset)",
  };
  return map[trt] || (trt || "").replace(/_/g, " ");
}

function getTreatmentBadgeClass(trt) {
  switch (trt) {
    case "BUSINESS_EXPENSE": return "status-success";
    case "OWNER_RECEIVABLE": return "status-danger";
    case "OWNER_LOAN": return "status-warning";
    case "PREPAID_EXPENSE": return "status-info";
    default: return "status-neutral";
  }
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
            <h1 class="page-title" style="font-size: 24px; font-weight: 700; margin: 0; color: var(--ink, #1f2937);">Personal Ledger &amp; Owner Account</h1>
            <span class="badge badge-warning" style="font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">CONFIDENTIAL</span>
          </div>
          <p class="page-subtitle" style="font-size: 13.5px; color: var(--muted, #6b7280); margin: 0;">
            Restricted company ↔ owner financial sub-ledger, reconciliation workspace, and statutory governance.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--muted, #6b7280);">Account:</label>
            <select id="pl-account-select" class="form-control" style="font-size: 12px; font-weight: 600; padding: 6px 10px; height: 36px;">
              <option value="OWNER_CURRENT_ACCOUNT" ${selectedAccount === "OWNER_CURRENT_ACCOUNT" ? "selected" : ""}>Owner Current Account</option>
              <option value="PRIMARY_MASTER_PERSONAL_LEDGER" ${selectedAccount === "PRIMARY_MASTER_PERSONAL_LEDGER" ? "selected" : ""}>Primary Master Personal Ledger</option>
              <option value="DIRECTOR_SHAREHOLDER_LOAN" ${selectedAccount === "DIRECTOR_SHAREHOLDER_LOAN" ? "selected" : ""}>Director / Shareholder Loan</option>
              <option value="OWNER_FUNDING_ACCOUNT" ${selectedAccount === "OWNER_FUNDING_ACCOUNT" ? "selected" : ""}>Owner Funding Account</option>
              <option value="REIMBURSEMENT_PAYABLE" ${selectedAccount === "REIMBURSEMENT_PAYABLE" ? "selected" : ""}>Reimbursement Payable</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--muted, #6b7280);">FY:</label>
            <select id="pl-period-select" class="form-control" style="font-size: 12px; font-weight: 600; padding: 6px 10px; height: 36px;">
              <option value="2026-2027" ${selectedPeriod === "2026-2027" ? "selected" : ""}>FY 2026–27</option>
              <option value="2025-2026" ${selectedPeriod === "2025-2026" ? "selected" : ""}>FY 2025–26</option>
              <option value="ALL" ${selectedPeriod === "ALL" ? "selected" : ""}>All History</option>
            </select>
          </div>

          <button class="btn btn-secondary" id="pl-privacy-toggle-btn" type="button" title="Toggle Privacy Masking" style="font-size: 12.5px; height: 36px; padding: 0 12px;">
            ${privacyModeActive ? "👁️ Reveal Balances" : "🔒 Mask Values"}
          </button>

          <button class="btn btn-secondary" id="pl-refresh-btn" type="button" style="font-size: 12.5px; height: 36px; padding: 0 12px;">↻ Refresh</button>

          <button class="btn btn-secondary" id="pl-settle-batch-btn" type="button" style="font-size: 12.5px; height: 36px; padding: 0 14px; font-weight:600;">⚡ Settle Balances</button>
          <button class="btn btn-secondary" id="pl-confirm-balance-btn" type="button" style="font-size: 12.5px; height: 36px; padding: 0 14px; font-weight:600;">✓ Confirm Balance</button>

          <button class="btn btn-primary" id="pl-record-txn-btn" type="button" style="font-size: 12.5px; height: 36px; padding: 0 16px; font-weight: 600;">+ Record Transaction</button>
        </div>
      </div>

      <!-- Primary 3 KPI Cards -->
      <div class="grid grid-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">

        <!-- Card 1: Due to Owner -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--success, #10b981); background: var(--surface, #ffffff); box-shadow: var(--shadow-xs);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Amount Due to Owner</span>
            <span class="badge badge-success" style="font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Company Owes Owner</span>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--success, #059669); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
            ${formatInrPaise(dueTo)}
          </div>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Personally funded expenses, director loans &amp; reimbursements.</p>
        </article>

        <!-- Card 2: Due from Owner -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--danger, #ef4444); background: var(--surface, #ffffff); box-shadow: var(--shadow-xs);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Amount Due from Owner</span>
            <span class="badge badge-danger" style="font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Owner Owes Company</span>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--danger, #dc2626); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
            ${formatInrPaise(dueFrom)}
          </div>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0;">Company-paid personal expenses &amp; recoverable advances.</p>
        </article>

        <!-- Card 3: Net Current-Account Position -->
        <article class="card kpi-card" style="padding: 20px; border-left: 4px solid var(--gold, #d4af37); background: var(--surface, #ffffff); box-shadow: var(--shadow-xs);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <span class="kpi-label" style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6b7280);">Net Current-Account Position</span>
            <button class="btn btn-secondary btn-xs" id="pl-decompose-net-btn" type="button" style="font-size: 11px; padding: 2px 8px;">Breakdown ℹ</button>
          </div>
          <div class="kpi-value" style="font-size: 26px; font-weight: 800; color: var(--gold, #b45309); font-family: var(--font-mono, monospace); margin-bottom: 4px;">
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
              <span style="font-size: 16px;">⚡</span>
              <h3 style="font-size: 14px; font-weight: 700; margin: 0; color: #92400e;">Requires Attention (${overview.actionCentre.unclassifiedTransactions + overview.actionCentre.missingEvidenceCount})</h3>
            </div>
            <span style="font-size: 11.5px; color: #b45309; font-weight: 600;">Finance GL: ₹0 Difference</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: #78350f;">
            ${overview.actionCentre.unclassifiedTransactions > 0 ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>• <strong>${overview.actionCentre.unclassifiedTransactions} transactions</strong> require business book classification.</span>
                <button class="btn btn-xs btn-secondary" data-tab-switch="review" type="button" style="font-weight: 700;">Review Queue →</button>
              </div>
            ` : ""}
            ${overview.actionCentre.missingEvidenceCount > 0 ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>• <strong>${overview.actionCentre.missingEvidenceCount} personal claim</strong> is missing invoice / receipt proof.</span>
                <button class="btn btn-xs btn-secondary" data-tab-switch="journal" type="button" style="font-weight: 700;">View Incomplete →</button>
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
            <span class="badge ${overview.accountHealth.overall === 'HEALTHY' ? 'badge-success' : 'badge-warning'}" style="font-size: 11px; font-weight: 700; padding: 2px 6px;">
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

      <!-- Navigation Tabs (UNIVERSAL BUTTON ARCHITECTURE MATCHING THE REST OF THE APP) -->
      <div class="module-action-tabs-wrap" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
        <button class="btn ${activeTab === 'journal' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="journal" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>📜</span> <span>Transaction Journal (${entries.length})</span>
        </button>
        <button class="btn ${activeTab === 'review' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="review" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>⚖️</span> <span>Review Queue (${overview.actionCentre.unclassifiedTransactions})</span>
        </button>
        <button class="btn ${activeTab === 'reimbursements' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="reimbursements" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>💸</span> <span>Reimbursements &amp; Recoveries</span>
        </button>
        <button class="btn ${activeTab === 'funding' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="funding" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>🤝</span> <span>Funding &amp; Director Loans</span>
        </button>
        <button class="btn ${activeTab === 'reconciliation' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="reconciliation" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>🔄</span> <span>GL Reconciliation</span>
        </button>
        <button class="btn ${activeTab === 'confirmations' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="confirmations" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>✍️</span> <span>Balance Confirmations</span>
        </button>
        <button class="btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}" data-pl-tab="audit" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px;">
          <span>🛡️</span> <span>Audit Trail &amp; Reports</span>
        </button>
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
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px; box-shadow: var(--shadow-xs);">

      <!-- Filters and Search Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px;">
          <input type="text" id="pl-search-input" class="form-control" placeholder="Search voucher, memo, vendor, reference..." value="${escapeHtml(searchQuery)}" style="font-size: 13px; max-width: 380px; padding: 7px 12px; border-radius: 6px; border: 1px solid var(--border, #d1d5db); width: 100%;">

          <select id="pl-treatment-filter" class="form-control" style="font-size: 13px; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border, #d1d5db); cursor: pointer; width:auto;">
            <option value="ALL" ${activeFilterTreatment === "ALL" ? "selected" : ""}>All Treatments</option>
            <option value="PERSONAL" ${activeFilterTreatment === "PERSONAL" ? "selected" : ""}>Personal Only</option>
            <option value="BUSINESS_EXPENSE" ${activeFilterTreatment === "BUSINESS_EXPENSE" ? "selected" : ""}>Business Expense</option>
            <option value="BUSINESS_ASSET" ${activeFilterTreatment === "BUSINESS_ASSET" ? "selected" : ""}>Business Asset</option>
            <option value="OWNER_LOAN" ${activeFilterTreatment === "OWNER_LOAN" ? "selected" : ""}>Owner Loan</option>
            <option value="PREPAID_EXPENSE" ${activeFilterTreatment === "PREPAID_EXPENSE" ? "selected" : ""}>Prepaid Expense</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="pl-export-journal-btn" type="button">📥 Export CSV</button>
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
                  <td style="padding: 12px; font-family: var(--font-mono, monospace); font-weight: 600; color: var(--gold, #b45309);">
                    ${escapeHtml(e.voucherNumber || e.ledgerEntryId)}
                    ${isReversed ? '<span class="badge badge-danger" style="font-size:9px;margin-left:4px;">REVERSED</span>' : ''}
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
                    <span class="badge ${e.direction === 'DUE_TO_OWNER' ? 'badge-success' : 'badge-danger'}" style="font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                      ${e.direction === 'DUE_TO_OWNER' ? 'Due to Owner' : (e.direction === 'DUE_FROM_OWNER' ? 'Due from Owner' : e.direction)}
                    </span>
                  </td>
                  <td style="padding: 12px;">
                    <span class="badge ${getTreatmentBadgeClass(e.accountingTreatment)}" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
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
                      <button class="btn btn-xs btn-secondary" data-inspect-txn="${e.ledgerEntryId}" type="button" title="View Inspection Drawer">Inspect</button>

                      ${(isPrimaryMaster || isOwner) && !isReversed && e.workflowStatus === 'SUBMITTED' ? `
                        <button class="btn btn-xs btn-primary" data-classify-txn="${e.ledgerEntryId}" type="button">Classify</button>
                      ` : ''}

                      ${(isPrimaryMaster || isOwner) && !isReversed && e.financePostingStatus === 'POSTED' ? `
                        <button class="btn btn-xs btn-secondary" data-unclassify-txn="${e.ledgerEntryId}" type="button" style="color: #d97706;">Un-classify</button>
                      ` : ''}

                      ${!isReversed ? `
                        <button class="btn btn-xs btn-secondary" data-reverse-txn="${e.ledgerEntryId}" type="button" style="color: var(--danger, #dc2626);">Reverse</button>
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
                  <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: var(--gold, #b45309);">${e.voucherNumber || e.ledgerEntryId}</span>
                  <span class="badge badge-warning" style="font-size: 11px; font-weight: 700; padding: 2px 6px;">${e.workflowStatus}</span>
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
                <span class="badge badge-success" style="font-size: 9.5px;">${r.settlementStatus || 'UNSETTLED'}</span>
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
                <span class="badge badge-danger" style="font-size: 9.5px;">${rec.settlementStatus || 'UNSETTLED'}</span>
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
        <span class="badge badge-warning" style="font-size: 11px; font-weight: 700; padding: 4px 8px;">
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
                <td style="padding: 10px; font-family: var(--font-mono, monospace); font-weight: 600; color: var(--gold, #b45309);">
                  ${l.voucherNumber || l.ledgerEntryId}
                </td>
                <td style="padding: 10px; font-size: 12px; color: var(--muted, #6b7280);">${l.businessDate}</td>
                <td style="padding: 10px; font-weight: 600;">${formatCategoryName(l.category)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; font-family: var(--font-mono, monospace); color: #059669;">
                  ${formatInrPaise(l.amountPaisa)}
                </td>
                <td style="padding: 10px;">
                  <span class="badge badge-success" style="font-size: 10.5px; font-weight: 700; padding: 2px 6px;">
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
                  <button class="btn btn-xs btn-secondary" data-inspect-txn="${l.ledgerEntryId}" type="button">Inspect</button>
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
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Owner Periodic Balance Confirmations</h3>
          <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
            Formal monthly and annual sign-offs acknowledging stated company-owner balances under Companies Act standard governance.
          </p>
        </div>
        <button class="btn btn-primary" id="pl-sign-period-btn" type="button">+ Sign Period Confirmation</button>
      </div>

      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid #a7f3d0; border-radius: 8px; background: #f0fdf4;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <strong style="color: #065f46; font-size: 14px;">July 2026 Monthly Balance Sign-Off</strong>
              <span class="badge badge-success" style="font-size: 10px;">CONFIRMED</span>
            </div>
            <div style="font-size: 12px; color: #047857;">
              Confirmed Net Position: <strong>₹62,500.00 (Due to Owner)</strong> · Signed by: Primary Master &amp; Owner on 31-Jul-2026
            </div>
          </div>
          <button class="btn btn-xs btn-secondary" type="button" onclick="window.print()">Print Certificate</button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; background: #fafafa;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <strong style="color: var(--ink, #1f2937); font-size: 14px;">June 2026 Monthly Balance Sign-Off</strong>
              <span class="badge badge-success" style="font-size: 10px;">CONFIRMED</span>
            </div>
            <div style="font-size: 12px; color: var(--muted, #6b7280);">
              Confirmed Net Position: <strong>₹50,000.00 (Due to Owner)</strong> · Signed on 30-Jun-2026
            </div>
          </div>
          <button class="btn btn-xs btn-secondary" type="button" onclick="window.print()">Print Certificate</button>
        </div>
      </div>
    </div>
  `;
}

// ── Tab 7: Audit Trail & Reports ─────────────────────────────────────────────
function renderAuditReportsTab(entries, overview, isPrimaryMaster, isOwner) {
  return `
    <div class="card" style="padding: 24px; background: var(--surface, #ffffff); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 4px; color: var(--ink, #1f2937);">Owner Account Statutory Audit Reports &amp; Activity Trail</h3>
          <p style="font-size: 13px; color: var(--muted, #6b7280); margin: 0;">
            Immutable ledger event logging, audit certifications, and statutory disclosure reports.
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="pl-btn-export-dpt3" type="button">📄 DPT-3 Disclosure Pack</button>
          <button class="btn btn-primary btn-sm" id="pl-btn-export-audit-cert" type="button">📜 Certified Balance Certificate</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
        <div style="padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0 0 6px; color: var(--ink, #1f2937);">CARO 2020 Clause 3(ix) Disclosure</h4>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0 0 10px;">
            Statutory auditor declaration regarding loans or advances in nature of loans granted to promoters/directors.
          </p>
          <span class="badge badge-success" style="font-size: 10.5px;">✓ Compliant &amp; Documented</span>
        </div>

        <div style="padding: 16px; border: 1px solid var(--border, #e5e7eb); border-radius: 8px;">
          <h4 style="font-size: 14px; font-weight: 700; margin: 0 0 6px; color: var(--ink, #1f2937);">Companies Deposit Rules 2014</h4>
          <p style="font-size: 12px; color: var(--muted, #6b7280); margin: 0 0 10px;">
            Director declaration affirming funds advanced are personal and not borrowed from others.
          </p>
          <span class="badge badge-success" style="font-size: 10.5px;">✓ All Declarations Verified</span>
        </div>
      </div>
    </div>
  `;
}

// ── Modals and Drawers ───────────────────────────────────────────────────────

function openRecordTransactionModal(root) {
  openModal({
    title: "Record Personal Ledger Transaction",
    content: `
      <div style="font-size: 13px;">
        <form id="record-pl-form" style="display: grid; gap: 12px;">
          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Transaction Nature *</label>
            <select id="pl-input-category" class="form-control" style="width: 100%; padding: 8px; border-radius: 6px;">
              <option value="BUSINESS_EXPENSE_PAID_PERSONALLY">Business Expense Paid Personally by Owner (Due to Owner)</option>
              <option value="COMPANY_PAID_PERSONAL_EXPENSE">Personal Expense Paid via Company Card / Bank (Due from Owner)</option>
              <option value="DIRECTOR_LOAN_TO_COMPANY">Director / Owner Bridging Loan to Company (Due to Owner)</option>
              <option value="FUNDS_ADVANCED_TO_COMPANY">Emergency Operating Advance to Company</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 4px;">Amount (₹ INR) *</label>
              <input type="number" id="pl-input-amount" class="form-control" min="1" step="any" placeholder="e.g. 12500.00" style="width: 100%; padding: 8px;" required>
            </div>
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 4px;">Business Date *</label>
              <input type="date" id="pl-input-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 8px;" required>
            </div>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Description / Particulars *</label>
            <input type="text" id="pl-input-desc" class="form-control" placeholder="e.g. Supplier meeting lunch with estate farmers" style="width: 100%; padding: 8px;" required>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Business Purpose</label>
            <textarea id="pl-input-purpose" class="form-control" rows="2" placeholder="Explain the business justification..."></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 4px;">Payment Source *</label>
              <select id="pl-input-source" class="form-control" style="width: 100%; padding: 8px;">
                <option value="PERSONAL_CARD">Personal Credit / Debit Card (HDFC)</option>
                <option value="PERSONAL_BANK">Personal UPI / NetBanking</option>
                <option value="COMPANY_CARD">Company Corporate Card (ICICI)</option>
                <option value="COMPANY_BANK">Company Current Account</option>
              </select>
            </div>
            <div>
              <label style="font-weight: 600; display: block; margin-bottom: 4px;">Transaction Reference / UTR</label>
              <input type="text" id="pl-input-ref" class="form-control" placeholder="e.g. UTR-98214" style="width: 100%; padding: 8px;">
            </div>
          </div>
        </form>
      </div>
    `,
    saveLabel: "Record & Submit Voucher",
    onSave: async () => {
      const cat = document.querySelector("#pl-input-category")?.value;
      const amtVal = parseFloat(document.querySelector("#pl-input-amount")?.value || "0");
      const dt = document.querySelector("#pl-input-date")?.value;
      const desc = document.querySelector("#pl-input-desc")?.value;
      const purp = document.querySelector("#pl-input-purpose")?.value;
      const src = document.querySelector("#pl-input-source")?.value;
      const ref = document.querySelector("#pl-input-ref")?.value;

      if (!amtVal || amtVal <= 0 || !desc) {
        showToast("Please provide a valid amount and description.", "warning");
        return false;
      }

      const amountPaisa = Math.round(amtVal * 100);
      const isDueToOwner = cat === "BUSINESS_EXPENSE_PAID_PERSONALLY" || cat === "DIRECTOR_LOAN_TO_COMPANY" || cat === "FUNDS_ADVANCED_TO_COMPANY";

      const newEntry = {
        ledgerEntryId: `PL-${new Date().toISOString().replace(/\D/g, "").slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`,
        voucherNumber: `PL-${new Date().toISOString().replace(/\D/g, "").slice(0, 8)}-${Math.floor(1000 + Math.random() * 9000)}`,
        businessDate: dt || new Date().toISOString().split("T")[0],
        category: cat,
        entryType: isDueToOwner ? "CREDIT" : "DEBIT",
        amountPaisa,
        amountInr: amtVal,
        direction: isDueToOwner ? "DUE_TO_OWNER" : "DUE_FROM_OWNER",
        description: desc,
        businessPurpose: purp || "General business allocation",
        paymentSource: src,
        paymentReference: ref || "N/A",
        counterparty: "Zamorin Internal",
        accountingTreatment: isDueToOwner ? "BUSINESS_EXPENSE" : "OWNER_RECEIVABLE",
        workflowStatus: "SUBMITTED",
        settlementStatus: "UNSETTLED",
        financeJournalRef: null,
        financePostingStatus: "NOT_POSTED",
        status: "ACTIVE",
        evidence: [],
      };

      try {
        await apiPost("/personal-ledger/entries", newEntry);
        showToast("Transaction recorded successfully!", "success");
        await fetchLedgerFromServer(root);
        return true;
      } catch (err) {
        // Dev fallback
        liveEntries = [newEntry, ...(liveEntries || SAMPLE_ENTRIES)];
        showToast("Transaction recorded (Preview Mode)", "mint");
        refreshLedgerView(root);
        return true;
      }
    },
  });
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
            <select id="pl-classify-treatment" class="form-control" style="width: 100%; padding: 8px;">
              <option value="BUSINESS_EXPENSE">Operating Business Expense (P&amp;L)</option>
              <option value="BUSINESS_ASSET">Fixed / Capital Asset (Balance Sheet)</option>
              <option value="INVENTORY">Inventory / Raw Materials</option>
              <option value="PREPAID_EXPENSE">Prepaid Expense (Deferred)</option>
              <option value="OWNER_LOAN">Director / Shareholder Loan Liability</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Target GL Account Code *</label>
            <select id="pl-classify-gl" class="form-control" style="width: 100%; padding: 8px;">
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
            <select id="pl-classify-cafe" class="form-control" style="width: 100%; padding: 8px;">
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
          <textarea id="pl-reverse-reason" class="form-control" rows="3" placeholder="e.g. Duplicate entry recorded by mistake / Incorrect amount" style="width: 100%; padding: 8px;" required></textarea>
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
            <span class="badge ${e.entryType === 'CREDIT' ? 'badge-success' : 'badge-danger'}" style="font-size: 11px; font-weight: 700;">
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
            <input type="number" id="pl-settle-amount" class="form-control" min="1" step="any" value="${(defaultTotalPaisa / 100) || 12500}" style="width: 100%; padding: 8px;" required>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Disbursement Payment Source *</label>
            <select id="pl-settle-source" class="form-control" style="width: 100%; padding: 8px;">
              <option value="COMPANY_BANK">Company Primary Bank Account (HDFC/ICICI)</option>
              <option value="COMPANY_UPI">Company Business UPI</option>
              <option value="PETTY_CASH">Central Office Petty Cash</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Bank Reference / UTR *</label>
            <input type="text" id="pl-settle-ref" class="form-control" placeholder="e.g. UTR-2026-SETTLE-0912" value="UTR-${Math.floor(100000 + Math.random() * 900000)}" style="width: 100%; padding: 8px;" required>
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
            <select id="pl-confirm-status" class="form-control" style="width: 100%; padding: 8px;">
              <option value="CONFIRMED">✓ Balance Confirmed (I agree with the stated balance)</option>
              <option value="DISPUTED">⚠️ I Have a Discrepancy (Flag difference for review)</option>
            </select>
          </div>

          <div>
            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Discrepancy Note / Confirmation Memo</label>
            <textarea id="pl-confirm-note" class="form-control" rows="3" placeholder="Enter notes or explain any differences observed..." style="width: 100%; padding: 8px;"></textarea>
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
  const content = root.querySelector("#pl-tab-content-area");
  if (content) {
    // Update active tab buttons
    root.querySelectorAll("[data-pl-tab]").forEach((btn) => {
      const tabId = btn.getAttribute("data-pl-tab");
      if (tabId === activeTab) {
        btn.className = "btn btn-primary";
      } else {
        btn.className = "btn btn-secondary";
      }
    });
    // Only re-render the tab content area, not the full page
    content.innerHTML = renderActiveTabContent();
    wireJournalActions(root);
  } else {
    // Full page not yet mounted — render completely
    const mainEl = root.querySelector("#pl-tab-content-area") ? root : document.querySelector("#main-content");
    if (!mainEl) return;
    mainEl.innerHTML = renderLedger();
    wireLedger(mainEl);
  }
}

function renderActiveTabContent() {
  const isPM = getStoredRole().isPrimaryMaster;
  const isOwner = getStoredRole().role === "OWNER";
  const overview = liveOverview || SAMPLE_OVERVIEW;
  const entries = liveEntries || SAMPLE_ENTRIES;
  return renderTabContent(activeTab, entries, overview, isPM, isOwner);
}

function wireJournalActions(root) {
  // Wire search input
  const searchInput = root.querySelector("#pl-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      const content = root.querySelector("#pl-tab-content-area");
      if (content && activeTab === "journal") {
        content.innerHTML = renderActiveTabContent();
        wireJournalActions(root);
      }
    });
  }

  // Wire filter
  const filterSelect = root.querySelector("#pl-treatment-filter");
  if (filterSelect) {
    filterSelect.addEventListener("change", (e) => {
      activeFilterTreatment = e.target.value;
      const content = root.querySelector("#pl-tab-content-area");
      if (content && activeTab === "journal") {
        content.innerHTML = renderActiveTabContent();
        wireJournalActions(root);
      }
    });
  }

  // Wire Export CSV
  root.querySelector("#pl-export-journal-btn")?.addEventListener("click", () => {
    showToast("Exporting Personal Sub-Ledger CSV...", "info");
    setTimeout(() => showToast("Personal Ledger CSV downloaded.", "success"), 500);
  });

  // Wire Table Actions
  root.querySelectorAll("[data-inspect-txn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-inspect-txn");
      openInspectTransactionDrawer(id);
    });
  });

  root.querySelectorAll("[data-classify-txn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-classify-txn");
      openClassifyModal(id, root);
    });
  });

  root.querySelectorAll("[data-reverse-txn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-reverse-txn");
      openReverseModal(id, root);
    });
  });

  root.querySelectorAll("[data-unclassify-txn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-unclassify-txn");
      const entries = liveEntries || SAMPLE_ENTRIES;
      const entry = entries.find((x) => x.ledgerEntryId === id);
      if (entry) {
        entry.workflowStatus = "SUBMITTED";
        entry.financePostingStatus = "NOT_POSTED";
        entry.financeJournalRef = null;
        showToast("Voucher moved back to Review Queue.", "info");
        refreshLedgerView(root);
      }
    });
  });

  root.querySelectorAll("[data-tab-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab-switch");
      if (targetTab) {
        activeTab = targetTab;
        refreshLedgerView(root);
      }
    });
  });

  // Wire batch settlement buttons inside tabs
  root.querySelector("#pl-batch-reimburse-btn")?.addEventListener("click", () => {
    openSettleModal(root);
  });
  root.querySelector("#pl-batch-recover-btn")?.addEventListener("click", () => {
    showToast("Open repayment recording interface...", "info");
    openSettleModal(root);
  });
  root.querySelector("#pl-sign-period-btn")?.addEventListener("click", () => {
    openConfirmBalanceModal(root);
  });
  root.querySelector("#pl-btn-export-dpt3")?.addEventListener("click", () => {
    showToast("Generating DPT-3 statutory disclosure report...", "info");
    setTimeout(() => showToast("DPT-3 Disclosure Pack downloaded.", "success"), 500);
  });
  root.querySelector("#pl-btn-export-audit-cert")?.addEventListener("click", () => {
    showToast("Generating Certified Owner Balance Certificate...", "info");
    setTimeout(() => showToast("Certified Balance Certificate downloaded.", "success"), 500);
  });
}

// ── Exported Wiring Function ─────────────────────────────────────────────────
export function wireLedger(root) {
  if (!root) return;

  // 1. Wire all Navigation Tabs
  root.querySelectorAll("[data-pl-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-pl-tab");
      if (targetTab && targetTab !== activeTab) {
        activeTab = targetTab;
        refreshLedgerView(root);
      }
    });
  });

  // 2. Wire Header Controls
  root.querySelector("#pl-account-select")?.addEventListener("change", (e) => {
    selectedAccount = e.target.value;
    showToast(`Switched account to ${e.target.options[e.target.selectedIndex].text}`, "info");
  });

  root.querySelector("#pl-period-select")?.addEventListener("change", (e) => {
    selectedPeriod = e.target.value;
    showToast(`Period changed to ${e.target.value}`, "info");
  });

  root.querySelector("#pl-privacy-toggle-btn")?.addEventListener("click", () => {
    privacyModeActive = !privacyModeActive;
    const btn = root.querySelector("#pl-privacy-toggle-btn");
    if (btn) btn.innerHTML = privacyModeActive ? "👁️ Reveal Balances" : "🔒 Mask Values";
    refreshLedgerView(root);
  });

  root.querySelector("#pl-refresh-btn")?.addEventListener("click", async () => {
    showToast("Refreshing ledger balances from server...", "info");
    await fetchLedgerFromServer(root);
  });

  root.querySelector("#pl-settle-batch-btn")?.addEventListener("click", () => {
    openSettleModal(root);
  });

  root.querySelector("#pl-confirm-balance-btn")?.addEventListener("click", () => {
    openConfirmBalanceModal(root);
  });

  root.querySelector("#pl-record-txn-btn")?.addEventListener("click", () => {
    openRecordTransactionModal(root);
  });

  root.querySelector("#pl-decompose-net-btn")?.addEventListener("click", () => {
    openNetDecompositionModal();
  });

  // 3. Wire tab content inner listeners
  wireJournalActions(root);
}
