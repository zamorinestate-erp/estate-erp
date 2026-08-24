import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, openModal, confirmAction, renderCafeContextStrip, renderFileUploadZone, wireFileUploadZone, openUniversalDocumentModal } from "../components.js";
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { navigate } from "../router.js";

let activeSubpanel = 'overview';
let activeFilter = 'ALL';
let expenseSearchQuery = '';
let expenseData = null;

const SUBPANELS = [
  { id: 'overview', label: 'Overview & Control', icon: '📊' },
  { id: 'ledger', label: 'Expense Ledger', icon: '📑' },
  { id: 'approvals', label: 'Approvals Workbench', icon: '⚖️' },
  { id: 'requests', label: 'Spend Authorisations', icon: '📝' },
  { id: 'evidence', label: 'Receipts & Evidence', icon: '🧾' },
  { id: 'cards', label: 'Corporate Cards & Advances', icon: '💳' },
  { id: 'policies', label: 'Policies & Categories', icon: '📜' },
  { id: 'integrity', label: 'Integrity & Handoff', icon: '🛡️' },
];

export function setExpensesActiveTab(tab) {
  activeSubpanel = tab || 'overview';
}

export function renderExpenses(subroute) {
  if (subroute !== undefined) {
    activeSubpanel = subroute || 'overview';
  }
  const isMaster = state.role === ROLES.MASTER;
  const isCafeAdmin = state.role === ROLES.CAFE_ADMIN;

  return `
    <div class="page-enter" style="padding-bottom: 40px;">
      <!-- Page Header -->
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--gold);background:rgba(212,160,23,0.12);padding:2px 8px;border-radius:4px;">SCR-009</span>
            <span style="font-size:12px;color:var(--muted);">Authoritative Expense Control &amp; Pre-Spend Layer</span>
          </div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Expense Management &amp; Approvals</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Manage operating expenses, receipt evidence, pre-spend authorisations, corporate card matching, and Finance handoffs.</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost" id="refresh-expenses-btn" type="button">🔄 Refresh</button>
          <button class="btn btn-primary" id="record-expense-btn" type="button">+ Record New Expense</button>
        </div>
      </div>

      <!-- Scope Context Banner -->
      ${renderCafeContextStrip()}

      <!-- Main Workspace Container -->
      <div id="expense-workspace-content">
        ${renderActiveSubpanel()}
      </div>
    </div>
  `;
}

function renderActiveSubpanel() {
  if (activeSubpanel === 'overview') {
    return renderOverviewSubpanel();
  }

  const submodules = {
    ledger: { title: 'Operational Expense Ledger', icon: '📑', desc: 'Voucher line items, cost center tags, payment modes and fiscal periods.' },
    approvals: { title: 'Expense Approvals Workbench', icon: '⚖️', desc: 'Multi-level managerial approvals, budget checks and rejection reasons.' },
    requests: { title: 'Pre-Spend Authorisations & PRs', icon: '📝', desc: 'Advance purchase approvals, budget holds and pre-spend authorizations.' },
    evidence: { title: 'Receipts & Proof Evidence Vault', icon: '🧾', desc: 'Tax invoice scans, fuel slips, physical bills and audit attachments.' },
    cards: { title: 'Corporate Cards & Cash Advances', icon: '💳', desc: 'Float disbursements, corporate credit card reconciliation and settlement.' },
    policies: { title: 'Expense Policies & Categories', icon: '📜', desc: 'Spending caps, per-diem rules, category limits and tax compliance.' },
    integrity: { title: 'Ledger Integrity & Finance Handoff', icon: '🛡️', desc: 'Duplicate detection, unlinked voucher checks and Accounts Payable export.' },
  };

  const cur = submodules[activeSubpanel] || { title: 'Submodule', icon: '📁', desc: '' };

  let bodyHtml = '';
  switch (activeSubpanel) {
    case 'ledger': bodyHtml = renderLedgerSubpanel(); break;
    case 'approvals': bodyHtml = renderApprovalsSubpanel(); break;
    case 'requests': bodyHtml = renderRequestsSubpanel(); break;
    case 'evidence': bodyHtml = renderEvidenceSubpanel(); break;
    case 'cards': bodyHtml = renderCardsSubpanel(); break;
    case 'policies': bodyHtml = renderPoliciesSubpanel(); break;
    case 'integrity': bodyHtml = renderIntegritySubpanel(); break;
    default: bodyHtml = renderOverviewSubpanel();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md, 10px);">
        <div style="display:flex; align-items:center; gap:12px;">
          <button class="btn btn-sm btn-ghost" id="exp-back-to-hub-btn" type="button" style="font-weight:700; display:inline-flex; align-items:center; gap:6px;">
            ← Back to Expense Hub
          </button>
          <div style="border-left:1px solid var(--line); padding-left:12px;">
            <h2 style="font-size:16px; font-weight:700; color:var(--ink); margin:0; display:flex; align-items:center; gap:8px;">
              <span>${cur.icon}</span> <span>${cur.title}</span>
            </h2>
            <p style="font-size:12px; color:var(--muted); margin:2px 0 0;">${cur.desc}</p>
          </div>
        </div>
      </div>
      <div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderOverviewSubpanel() {
  const isCafeOps = state.role === ROLES.CAFE_ADMIN;
  const user = state.auth?.user || state.user || {};
  const cafeName = user.primaryCafeName || "Koramangala Flagship";
  const cafeId = user.primaryCafeId || "ZC-0001";

  const expTiles = [
    { id: 'ledger', icon: '📑', title: 'Expense Ledger', subtitle: 'Operational expense lines, cost centers & vouchers', badge: 'Ledger', badgeType: 'accent' },
    { id: 'approvals', icon: '⚖️', title: 'Approvals Workbench', subtitle: 'Managerial reviews, budget limits & sign-offs', badge: isCafeOps ? '1 Pending' : '4 Pending', badgeType: 'warning' },
    { id: 'requests', icon: '📝', title: 'Spend Authorisations', subtitle: 'Pre-spend requisitions, advances & authorizations', badge: 'Authorised', badgeType: '' },
    { id: 'evidence', icon: '🧾', title: 'Receipts & Evidence', subtitle: 'Tax invoice attachments, fuel bills & audit receipts', badge: isCafeOps ? '1 Missing' : '2 Missing', badgeType: 'warning' },
    { id: 'cards', icon: '💳', title: 'Corporate Cards', subtitle: 'Card feeds, advance settlements & float balancing', badge: 'Settled', badgeType: 'success' },
    { id: 'policies', icon: '📜', title: 'Policies & Categories', subtitle: 'Spend caps, categories, tax rules & compliance', badge: 'Enforced', badgeType: 'success' },
    { id: 'integrity', icon: '🛡️', title: 'Integrity & Handoff', subtitle: 'Accounts Payable handoff & validation status', badge: 'PASS', badgeType: 'success' },
  ];

  return `
    <div style="display:flex;flex-direction:column;gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Expense &amp; Spend Management Workspaces</h3>
        <div class="module-tile-grid">
          ${expTiles.map((t) => `
            <button class="module-hub-tile" data-exp-hub-tile="${t.id}" type="button">
              <div class="module-tile-icon-box">${t.icon}</div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${t.title}</span>
                  ${t.badge ? `<span class="module-tile-badge ${t.badgeType}">${t.badge}</span>` : ''}
                </div>
                <div class="module-tile-sub">${t.subtitle}</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Primary KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        <article class="card kpi-card" style="padding:18px;border-radius:8px;background:var(--card-bg);border:1px solid var(--border);">
          <div class="kpi-label" style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;">Expenses This Month</div>
          <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--ink);margin:6px 0;">${isCafeOps ? '₹68,450' : '₹1,42,850'}</div>
          <div class="kpi-trend" style="font-size:12px;color:var(--success);font-weight:600;">${isCafeOps ? 'This Outlet (' + cafeId + ')' : 'Across All Cafés'}</div>
        </article>

        <article class="card kpi-card" style="padding:18px;border-radius:8px;background:var(--card-bg);border:1px solid var(--border);">
          <div class="kpi-label" style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;">Approved Expenses</div>
          <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--ink);margin:6px 0;">${isCafeOps ? '₹52,000' : '₹1,26,400'}</div>
          <div class="kpi-trend" style="font-size:12px;color:var(--muted);">Validated by Master</div>
        </article>

        <article class="card kpi-card" style="padding:18px;border-radius:8px;background:var(--card-bg);border:1px solid var(--border);">
          <div class="kpi-label" style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;">Pending Approval</div>
          <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--warning);margin:6px 0;">${isCafeOps ? '1 Voucher' : '4 Vouchers'}</div>
          <div class="kpi-trend" style="font-size:12px;color:var(--warning);font-weight:600;">${isCafeOps ? '₹16,450 Action Required' : '₹16,450 Action Required'}</div>
        </article>

        <article class="card kpi-card" style="padding:18px;border-radius:8px;background:var(--card-bg);border:1px solid var(--border);">
          <div class="kpi-label" style="font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;">Awaiting Finance Handoff</div>
          <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--ink);margin:6px 0;">${isCafeOps ? '1 Voucher' : '3 Vouchers'}</div>
          <div class="kpi-trend" style="font-size:12px;color:var(--muted);">Approved &amp; Queued</div>
        </article>
      </div>

      <!-- Actionable Secondary Control Strip -->
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;">
        <h3 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--ink);text-transform:uppercase;letter-spacing:0.5px;">Actionable Control Strip</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          <span class="badge" style="background:#fff3cd;color:#856404;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">Receipts Missing: ${isCafeOps ? '1' : '2'}</span>
          <span class="badge" style="background:#e8f4fd;color:#0c5460;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">Unmatched Cards: ${isCafeOps ? '0' : '1'}</span>
          <span class="badge" style="background:#f8d7da;color:#721c24;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">Non-PO Emergency: ${isCafeOps ? '1' : '1'}</span>
          <span class="badge" style="background:#d4edda;color:#155724;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;">Integrity Status: PASS</span>
        </div>
      </div>

      <!-- Café Breakdown / Operational Summary -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin:0 0 8px;font-size:15px;color:var(--ink);font-weight:700;">☕ ${cafeName} (${cafeId})</h4>
          <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Month Spend: <strong style="color:var(--ink);">₹68,450</strong></div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Approved: <strong style="color:var(--ink);">₹52,000</strong> | Pending: <strong style="color:var(--warning);">₹16,450</strong></div>
          <div style="font-size:12px;color:var(--success);margin-top:8px;">Budget Consumption: 68%</div>
        </div>

        ${!isCafeOps ? `
          <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;">
            <h4 style="margin:0 0 8px;font-size:15px;color:var(--ink);font-weight:700;">☕ Indiranagar (ZC-0002)</h4>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Month Spend: <strong style="color:var(--ink);">₹44,200</strong></div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Approved: <strong style="color:var(--ink);">₹44,200</strong> | Pending: <strong style="color:var(--ink);">₹0</strong></div>
            <div style="font-size:12px;color:var(--success);margin-top:8px;">Budget Consumption: 55%</div>
          </div>

          <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;">
            <h4 style="margin:0 0 8px;font-size:15px;color:var(--ink);font-weight:700;">☕ Calicut Beach (ZC-0003)</h4>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Month Spend: <strong style="color:var(--ink);">₹30,200</strong></div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:4px;">Approved: <strong style="color:var(--ink);">₹30,200</strong> | Pending: <strong style="color:var(--ink);">₹0</strong></div>
            <div style="font-size:12px;color:var(--success);margin-top:8px;">Budget Consumption: 48%</div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderLedgerSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:400px;">
          <input type="text" id="expense-search-input" class="form-control" placeholder="Search by Voucher, Payee, Category, Invoice..." style="padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--border);width:100%;">
        </div>
        <div style="display:flex;gap:8px;">
          <select id="expense-status-filter" class="form-control" style="padding:8px 12px;font-size:13px;border-radius:6px;border:1px solid var(--border);">
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid / Settled</option>
          </select>
        </div>
      </div>

      <!-- Ledger Table -->
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--muted);font-size:12px;text-transform:uppercase;">
              <th style="padding:10px 8px;">Voucher #</th>
              <th style="padding:10px 8px;">Expense Category &amp; Payee</th>
              <th style="padding:10px 8px;">Café</th>
              <th style="padding:10px 8px;">Date</th>
              <th style="padding:10px 8px;">Payment Source</th>
              <th style="padding:10px 8px;text-align:right;">Amount</th>
              <th style="padding:10px 8px;text-align:center;">Status</th>
              <th style="padding:10px 8px;text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px 8px;font-weight:700;color:var(--navy);">EX-20260814-0089</td>
              <td style="padding:12px 8px;">
                <div style="font-weight:600;color:var(--ink);">Coffee &amp; Raw Ingredients</div>
                <div style="font-size:12px;color:var(--muted);">Blue Tokai Coffee Roasters (Inv #BT-9921)</div>
              </td>
              <td style="padding:12px 8px;">Koramangala</td>
              <td style="padding:12px 8px;">2026-08-14</td>
              <td style="padding:12px 8px;"><span class="badge" style="background:#e8f4fd;color:#0c5460;padding:2px 8px;border-radius:4px;">Bank UPI</span></td>
              <td style="padding:12px 8px;text-align:right;font-weight:700;color:var(--ink);">₹14,500.00</td>
              <td style="padding:12px 8px;text-align:center;"><span class="badge" style="background:#d4edda;color:#155724;padding:4px 8px;border-radius:4px;font-weight:600;">APPROVED</span></td>
              <td style="padding:12px 8px;text-align:center;">
                <button class="btn btn-sm btn-ghost view-expense-btn" data-id="EX-20260814-0089">View 360</button>
              </td>
            </tr>

            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px 8px;font-weight:700;color:var(--navy);">EX-20260815-0090</td>
              <td style="padding:12px 8px;">
                <div style="font-weight:600;color:var(--ink);">Dairy &amp; Fresh Milk</div>
                <div style="font-size:12px;color:var(--muted);">Nandini Milk Dairy Depot</div>
              </td>
              <td style="padding:12px 8px;">Koramangala</td>
              <td style="padding:12px 8px;">2026-08-15</td>
              <td style="padding:12px 8px;"><span class="badge" style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:4px;">Petty Cash</span></td>
              <td style="padding:12px 8px;text-align:right;font-weight:700;color:var(--ink);">₹3,200.00</td>
              <td style="padding:12px 8px;text-align:center;"><span class="badge" style="background:#fff3cd;color:#856404;padding:4px 8px;border-radius:4px;font-weight:600;">SUBMITTED</span></td>
              <td style="padding:12px 8px;text-align:center;">
                <button class="btn btn-sm btn-ghost view-expense-btn" data-id="EX-20260815-0090">View 360</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderApprovalsSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Approvals Workbench (Side-by-Side Review)</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">Review voucher metadata, verify attached invoice files, check policy compliance, and enforce segregation of duties.</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--navy);">Voucher Detail: EX-20260815-0090</h4>
          <div style="font-size:13px;display:flex;flex-direction:column;gap:8px;">
            <div><strong>Payee:</strong> Nandini Milk Dairy Depot</div>
            <div><strong>Amount:</strong> ₹3,200.00 (Cash Outflow)</div>
            <div><strong>Café:</strong> Koramangala (ZC-0001)</div>
            <div><strong>Policy Check:</strong> <span style="color:var(--success);font-weight:600;">COMPLIANT (Under ₹5,000 threshold)</span></div>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="btn btn-primary" style="flex:1;">✅ Approve</button>
            <button class="btn btn-ghost" style="flex:1;">↩️ Return</button>
            <button class="btn btn-danger" style="flex:1;">❌ Reject</button>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;background:rgba(0,0,0,0.02);display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-size:40px;margin-bottom:8px;">🧾</span>
          <div style="font-weight:600;font-size:13px;color:var(--ink);">Receipt Preview</div>
          <div style="font-size:12px;color:var(--muted);">Receipt_Nandini_0815.pdf (SHA256 Verified)</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:12px;">Open Full Evidence</button>
        </div>
      </div>
    </div>
  `;
}

function renderRequestsSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:16px;font-weight:700;margin:0;color:var(--ink);">Pre-Spend Authorisations</h3>
        <button class="btn btn-primary btn-sm" id="create-request-btn">+ New Spend Request</button>
      </div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">Pre-authorise non-Procurement expenditures before committing company funds.</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
        <thead>
          <tr style="border-bottom:2px solid var(--border);color:var(--muted);font-size:12px;text-transform:uppercase;">
            <th style="padding:10px 8px;">Request ID</th>
            <th style="padding:10px 8px;">Purpose &amp; Department</th>
            <th style="padding:10px 8px;">Requester</th>
            <th style="padding:10px 8px;text-align:right;">Estimated</th>
            <th style="padding:10px 8px;text-align:right;">Actual Spent</th>
            <th style="padding:10px 8px;text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px 8px;font-weight:700;color:var(--navy);">REQ-2026-0041</td>
            <td style="padding:12px 8px;">Quarterly Barista Cupping Workshop (Training)</td>
            <td style="padding:12px 8px;">Priya Nair</td>
            <td style="padding:12px 8px;text-align:right;font-weight:700;">₹12,000.00</td>
            <td style="padding:12px 8px;text-align:right;color:var(--muted);">₹0.00</td>
            <td style="padding:12px 8px;text-align:center;"><span class="badge" style="background:#d4edda;color:#155724;padding:4px 8px;border-radius:4px;font-weight:600;">APPROVED</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderEvidenceSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="font-size:16px;font-weight:700;margin:0 0 4px;color:var(--ink);">Receipts &amp; Evidence Vault</h3>
          <p style="font-size:13px;color:var(--muted);margin:0;">Cryptographically hashed receipt files, tax invoices, and formal expense proofs.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="upload-expense-receipt-btn" type="button" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
          <span>📤 Upload Receipt / Invoice Evidence</span>
        </button>
      </div>

      <div style="padding:14px;background:rgba(212,160,23,0.08);border:1px solid rgba(212,160,23,0.3);border-radius:8px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:12.5px;color:var(--ink);">
          <strong>🛡️ Missing Receipt Declaration Protocol:</strong> Expenses submitted without proof require formal justification and Primary Master waiver before settlement.
        </div>
        <span class="badge" style="background:#d4edda;color:#155724;font-weight:600;">100% Verified Evidence</span>
      </div>

      <div class="table-wrap" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--muted);font-size:11.5px;text-transform:uppercase;background:var(--surface-sunken);">
              <th style="padding:10px 8px;">Voucher Ref</th>
              <th style="padding:10px 8px;">Payee / Vendor</th>
              <th style="padding:10px 8px;">Category</th>
              <th style="padding:10px 8px;text-align:right;">Amount</th>
              <th style="padding:10px 8px;text-align:center;">Attached File</th>
              <th style="padding:10px 8px;text-align:center;">Evidence State</th>
              <th style="padding:10px 8px;text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:10px 8px;font-weight:700;color:var(--ink);">EX-20260814-0089</td>
              <td style="padding:10px 8px;">Blue Tokai Coffee Roasters</td>
              <td style="padding:10px 8px;">Coffee &amp; Raw Ingredients</td>
              <td style="padding:10px 8px;text-align:right;font-weight:700;font-family:var(--font-mono);">₹14,500.00</td>
              <td style="padding:10px 8px;text-align:center;">
                <span style="color:var(--brand-gold, #c89d5c);font-weight:600;">📄 BlueTokai_Inv_9921.pdf</span>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <span class="badge" style="background:#d4edda;color:#155724;padding:3px 8px;border-radius:4px;font-weight:600;">VERIFIED (SHA-256)</span>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <button class="btn btn-xs btn-ghost view-expense-receipt-btn" data-file="BlueTokai_Inv_9921.pdf" type="button">👁️ View</button>
              </td>
            </tr>
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:10px 8px;font-weight:700;color:var(--ink);">EX-20260815-0090</td>
              <td style="padding:10px 8px;">Nandini Milk Dairy Depot</td>
              <td style="padding:10px 8px;">Dairy &amp; Fresh Milk</td>
              <td style="padding:10px 8px;text-align:right;font-weight:700;font-family:var(--font-mono);">₹3,200.00</td>
              <td style="padding:10px 8px;text-align:center;">
                <span style="color:var(--brand-gold, #c89d5c);font-weight:600;">📄 Nandini_Milk_Receipt.jpg</span>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <span class="badge" style="background:#d4edda;color:#155724;padding:3px 8px;border-radius:4px;font-weight:600;">VERIFIED (SHA-256)</span>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <button class="btn btn-xs btn-ghost view-expense-receipt-btn" data-file="Nandini_Milk_Receipt.jpg" type="button">👁️ View</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCardsSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Corporate Cards &amp; Operational Advances</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">Reconcile masked card transactions (•••• 4821) and track business advance liquidations.</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--navy);">💳 Corporate Card Feeds</h4>
          <div style="font-size:13px;color:var(--muted);">All company cards matched and verified against vouchers.</div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--navy);">💰 Operational Cash Advances</h4>
          <div style="font-size:13px;color:var(--muted);">Track temporary operational advances and returned balances.</div>
        </div>
      </div>
    </div>
  `;
}

function renderPoliciesSubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Expense Policies &amp; Rule Simulator</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">Versioned expense policies, receipt thresholds, and non-PO exception rules.</p>
    </div>
  `;
}

function renderIntegritySubpanel() {
  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:20px;">
      <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Expense Integrity Centre &amp; Finance Handoff</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 20px;">16-point automated integrity audit covering duplicates, unlinked POs, missing receipts, and Finance AP synchronisation.</p>

      <div style="padding:16px;border:1px solid #c3e6cb;background:#d4edda;border-radius:8px;">
        <strong style="color:#155724;">✅ System Integrity: HEALTHY</strong>
        <p style="margin:4px 0 0;font-size:13px;color:#155724;">All 16 deterministic checks evaluated across vouchers, card feeds, and operational advances with zero critical blockers.</p>
      </div>
    </div>
  `;
}

export function initExpenses() {
  document.addEventListener('click', (e) => {
    const subnavBtn = e.target.closest('.btn-subnav');
    if (subnavBtn) {
      activeSubpanel = subnavBtn.dataset.subpanel;
      const workspace = document.getElementById('expense-workspace-content');
      if (workspace) {
        workspace.innerHTML = renderActiveSubpanel();
      }
      document.querySelectorAll('.btn-subnav').forEach((b) => {
        const isActive = b.dataset.subpanel === activeSubpanel;
        b.style.background = isActive ? 'var(--navy)' : 'transparent';
        b.style.color = isActive ? '#ffffff' : 'var(--ink)';
        b.style.borderColor = isActive ? 'var(--navy)' : 'var(--border)';
      });
      return;
    }

    if (e.target.closest('#record-expense-btn')) {
      openRecordExpenseModal();
    }
  });
}

function openRecordExpenseModal() {
  openModal({
    title: 'Record New Expense Voucher',
    maxWidth: '560px',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;font-size:13px;">
        <div>
          ${renderFileUploadZone({
            id: 'modal-exp-receipt-file',
            label: 'Attach Bill / Receipt Proof',
            helpText: 'PDF, JPG, PNG (Max 10MB)',
          })}
        </div>

        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Café Location *</label>
          <select id="modal-exp-cafe" class="form-control" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;">
            <option value="ZC-0001">Koramangala (ZC-0001)</option>
            <option value="ZC-0002">Indiranagar (ZC-0002)</option>
            <option value="ZC-0003">Calicut Beach (ZC-0003)</option>
          </select>
        </div>

        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Expense Category *</label>
          <select id="modal-exp-cat" class="form-control" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;">
            <option value="COFFEE_RAW_MATERIALS">Coffee &amp; Raw Ingredients</option>
            <option value="DAIRY_FRESH_MILK">Dairy &amp; Fresh Milk</option>
            <option value="EQUIPMENT_MAINTENANCE">Equipment &amp; Maintenance</option>
            <option value="PACKAGING_DISPOSABLES">Packaging &amp; Disposables</option>
            <option value="UTILITIES">Utilities &amp; Power</option>
            <option value="STAFF_WELFARE">Staff Welfare &amp; Refreshments</option>
          </select>
        </div>

        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Payee / Vendor Name *</label>
          <input type="text" id="modal-exp-payee" class="form-control" placeholder="e.g. Blue Tokai Coffee Roasters" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-weight:600;display:block;margin-bottom:4px;">Amount (₹) *</label>
            <input type="number" id="modal-exp-amount" class="form-control" placeholder="0.00" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;">
          </div>
          <div>
            <label style="font-weight:600;display:block;margin-bottom:4px;">Payment Source *</label>
            <select id="modal-exp-source" class="form-control" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;">
              <option value="COMPANY_BANK_UPI">Company Bank UPI</option>
              <option value="PETTY_CASH">Petty Cash</option>
              <option value="CORPORATE_CARD">Corporate Card</option>
              <option value="EMPLOYEE_FUNDS">Employee Reimbursement</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-weight:600;display:block;margin-bottom:4px;">Business Purpose / Description *</label>
          <textarea id="modal-exp-desc" class="form-control" rows="3" placeholder="Explain the operational justification..." style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;"></textarea>
        </div>
      </div>
    `,
    primaryLabel: 'Submit for Approval',
    onPrimary: async () => {
      showToast('Expense recorded with attached proof and submitted for Master approval.', 'success');
    }
  });

  const modalEl = document.querySelector('#zamorin-global-modal');
  if (modalEl) {
    wireFileUploadZone(modalEl, { id: 'modal-exp-receipt-file' });
  }
}

export function wireExpenses(container, subroute) {
  if (subroute !== undefined) {
    activeSubpanel = subroute || 'overview';
  }
  const root = container || document;

  // Expense Hub Tiles
  root.querySelectorAll('[data-exp-hub-tile]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tileId = e.currentTarget.dataset.expHubTile;
      navigate('expenses/' + tileId);
    });
  });

  // Back to Expense Hub Button
  root.querySelector('#exp-back-to-hub-btn')?.addEventListener('click', () => {
    navigate('expenses');
  });

  root.querySelectorAll('.btn-subnav').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      activeSubpanel = e.currentTarget.dataset.subpanel;
      const mainContent = document.getElementById('main-content') || document.getElementById('app');
      if (mainContent) {
        mainContent.innerHTML = renderExpenses();
        wireExpenses(mainContent);
      }
    });
  });

  root.querySelector('#record-expense-btn')?.addEventListener('click', () => {
    openRecordExpenseModal();
  });

  root.querySelector('#refresh-expenses-btn')?.addEventListener('click', () => {
    showToast('Expenses refreshed', 'info');
  });

  // Upload Expense Receipt Evidence Button
  root.querySelector('#upload-expense-receipt-btn')?.addEventListener('click', () => {
    openUniversalDocumentModal({
      title: 'Upload Expense Receipt / Evidence',
      subtitle: 'Upload payment receipt, bill voucher or delivery slip for audit compliance.',
      documentType: 'RECEIPT',
      allowedCategories: ['COFFEE_RAW_MATERIALS', 'DAIRY_FRESH_MILK', 'EQUIPMENT_MAINTENANCE', 'PACKAGING_DISPOSABLES', 'UTILITIES', 'STAFF_WELFARE'],
      onUploadSuccess: (docMeta) => {
        showToast(`Receipt for ${docMeta.vendor || 'Expense'} uploaded & secured in Evidence Vault!`, 'success');
      }
    });
  });

  // View Receipt Preview Button
  root.querySelectorAll('.view-expense-receipt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const file = btn.dataset.file;
      openModal({
        title: `Receipt Evidence Preview · ${file}`,
        maxWidth: '460px',
        body: `
          <div style="text-align:center;padding:16px 8px;">
            <div style="font-size:44px;margin-bottom:10px;">🧾</div>
            <h4 style="font-size:15px;font-weight:700;color:var(--ink);margin:0 0 6px;">${file}</h4>
            <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">Verified proof attached to expense voucher.</p>
            <div style="background:var(--surface-sunken);padding:10px 12px;border-radius:8px;font-size:11.5px;color:var(--ink);margin-bottom:16px;text-align:left;line-height:1.6;">
              <div>• <strong>Verification:</strong> Cryptographically verified (SHA-256)</div>
              <div>• <strong>Retention:</strong> Statutory 8 Years</div>
              <div>• <strong>Auditor Status:</strong> Accepted</div>
            </div>
            <button class="btn btn-primary" type="button" onclick="document.querySelector('#zamorin-global-modal')?.remove(); showToast('Receipt downloaded!', 'success');">
              📥 Download File
            </button>
          </div>
        `,
        showSave: false,
        cancelLabel: 'Close'
      });
    });
  });
}
