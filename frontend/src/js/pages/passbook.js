// =============================================================================
// ZAMORIN CAFE ERP — PASSBOOK & MULTI-CAFÉ TREASURY CONTROL SYSTEM
// PRIMARY MASTER + OWNER ONLY · ENTERPRISE UNIVERSAL BUTTON ARCHITECTURE
// =============================================================================

import { state } from "../state.js";
import { icon } from "../icons.js";
import { apiGet, apiPost } from "../apiClient.js";
import { showToast, setButtonBusy } from "../components.js";

// ─── State Management ────────────────────────────────────────────────────────
let passbookData = null;
let currentScope = 'ALL'; // 'ALL' or specific cafeId
let currentAccountId = 'ALL';
let currentPeriod = 'THIS_MONTH';
let currentFiscalYear = 'FY 2026-27';
let activeChildRoute = 'overview'; // 'overview', 'accounts', 'transactions', 'transfers', 'reconciliation', etc.
let selectedTransaction = null;
let selectedAccount = null;

// ─── Formatters ──────────────────────────────────────────────────────────────
export function formatPaisa(paisa) {
  if (paisa === undefined || paisa === null || isNaN(paisa)) return '₹0.00';
  const rupees = paisa / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRupees(rupees) {
  if (rupees === undefined || rupees === null || isNaN(rupees)) return '₹0.00';
  return '₹' + Number(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── API Client ──────────────────────────────────────────────────────────────
async function fetchPassbookOverview() {
  try {
    const payload = await apiGet(`/passbook/overview?cafeId=${currentScope}&period=${currentPeriod}`);
    if (payload?.data) {
      passbookData = payload.data;
      return passbookData;
    }
  } catch (err) {
    console.warn('Failed to load passbook live data:', err);
  }
  return null;
}

// ─── Main Render Function ────────────────────────────────────────────────────
export function renderPassbook() {
  // Parse subroute from window.location.hash
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  activeChildRoute = parts[1] || 'overview';
  const paramId = parts[2] || null;

  return `
    <div class="passbook-module" style="padding: 24px; max-width: 1440px; margin: 0 auto;">
      <!-- TOP CONTROL BAR -->
      ${renderTopControlBar()}

      <!-- SUB-VIEW CONTAINER -->
      <div id="passbook-child-content" style="margin-top: 24px;">
        ${renderChildWorkspace(activeChildRoute, paramId)}
      </div>

      <!-- MODALS CONTAINER -->
      <div id="passbook-modal-container"></div>
    </div>
  `;
}

// ─── Top Control Bar ─────────────────────────────────────────────────────────
function renderTopControlBar() {
  return `
    <div class="card" style="padding: 16px 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; border-left: 4px solid var(--gold, #d4af37);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(212, 175, 55, 0.12); display: flex; align-items: center; justify-content: center; color: var(--gold, #d4af37);">
          ${icon('ledger')}
        </div>
        <div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--ink);">Passbook & Treasury Control</div>
          <div style="font-size: 0.8rem; color: var(--muted); display: flex; align-items: center; gap: 8px;">
            <span class="badge" style="background: rgba(212, 175, 55, 0.15); color: var(--gold, #d4af37); font-size: 0.7rem; font-weight: 600;">PRIMARY MASTER & OWNER</span>
            <span>·</span>
            <span>Multi-Café Cash & Bank Book</span>
          </div>
        </div>
      </div>

      <!-- Context Selectors -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <label style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase;">Scope:</label>
          <select id="pbk-scope-select" class="form-control" style="padding: 6px 12px; font-size: 0.85rem; height: 36px; border-radius: 8px;">
            <option value="ALL" ${currentScope === 'ALL' ? 'selected' : ''}>All Cafés (Global Portfolio)</option>
            <option value="CF-INDIRANAGAR" ${currentScope === 'CF-INDIRANAGAR' ? 'selected' : ''}>Indiranagar Café</option>
            <option value="CF-KORAMANGALA" ${currentScope === 'CF-KORAMANGALA' ? 'selected' : ''}>Koramangala Café</option>
          </select>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <label style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase;">Period:</label>
          <select id="pbk-period-select" class="form-control" style="padding: 6px 12px; font-size: 0.85rem; height: 36px; border-radius: 8px;">
            <option value="TODAY" ${currentPeriod === 'TODAY' ? 'selected' : ''}>Today</option>
            <option value="THIS_MONTH" ${currentPeriod === 'THIS_MONTH' ? 'selected' : ''}>This Month (Aug 2026)</option>
            <option value="LAST_MONTH" ${currentPeriod === 'LAST_MONTH' ? 'selected' : ''}>Last Month</option>
            <option value="FY_2026_27" ${currentPeriod === 'FY_2026_27' ? 'selected' : ''}>FY 2026–27</option>
          </select>
        </div>

        <button id="pbk-refresh-btn" class="btn btn-secondary" style="height: 36px; padding: 0 12px; display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
          ${icon('refresh')} <span>Refresh</span>
        </button>

        <a href="#passbook/adjustments" class="btn btn-primary" style="height: 36px; padding: 0 14px; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; text-decoration: none;">
          ${icon('tasks')} <span>Direct Adjustment</span>
        </a>
      </div>
    </div>
  `;
}

// ─── Child Workspace Router ──────────────────────────────────────────────────
function renderChildWorkspace(route, paramId) {
  switch (route) {
    case 'accounts':
      return paramId ? renderAccount360(paramId) : renderAccountsDirectory();
    case 'mapping':
      return renderCafeMapping();
    case 'transactions':
      return paramId ? renderTransaction360(paramId) : renderTransactionLog();
    case 'daybook':
      return renderDayBook();
    case 'income-expenses':
      return renderIncomeExpenses();
    case 'transfers':
    case 'inter-cafe-transfers':
      return renderTransfersWorkspace();
    case 'reconciliation':
      return renderReconciliationCentre();
    case 'statement-imports':
    case 'statements':
      return renderStatementImports();
    case 'unallocated':
      return renderUnallocatedWorkspace();
    case 'adjustments':
      return renderDirectAdjustments();
    case 'confirmations':
      return renderBalanceConfirmations();
    case 'cash-verification':
      return renderCashVerification();
    case 'cash-deposits':
      return renderCashDeposits();
    case 'petty-cash':
      return renderPettyCash();
    case 'reserved-funds':
    case 'reservations':
      return renderReservedFunds();
    case 'period-close':
      return renderPeriodClose();
    case 'integrity':
      return renderIntegrityCentre();
    case 'data-quality':
    case 'attention':
      return renderAttentionCentre();
    case 'documents':
      return renderDocumentVault();
    case 'exports':
      return renderCorporateExports();
    case 'analytics':
      return renderAnalyticsView();
    case 'cafe-comparison':
      return renderCafeComparison();
    case 'liquidity':
    case 'liquidity-runway':
      return renderLiquidityRunway();
    case 'audit':
      return renderAuditTrail();
    default:
      return renderControlCentreHome();
  }
}

// ─── 0. CONTROL CENTRE LANDING HOME ──────────────────────────────────────────
function renderControlCentreHome() {
  const kpis = passbookData?.kpis || {
    totalBookBalancePaisa: 393000000,
    totalExternalIncomePaisa: 45000000,
    totalExternalExpensePaisa: 10500000,
    netExternalCashFlowPaisa: 34500000,
    totalReservedPaisa: 62000000,
    freeBalancePaisa: 331000000,
    unreconciledDifferencePaisa: -150000,
    activeAccountsCount: 5,
    accountsNeedingReconciliation: 1,
  };

  const cafes = passbookData?.cafePositions || [
    { cafeId: 'CF-INDIRANAGAR', cafeName: 'Indiranagar Café', accountCount: 2, bookBalancePaisa: 65500000, reservedPaisa: 12000000, freeBalancePaisa: 53500000, reconciliationStatus: 'NEEDS_RECONCILIATION' },
    { cafeId: 'CF-KORAMANGALA', cafeName: 'Koramangala Café', accountCount: 2, bookBalancePaisa: 43000000, reservedPaisa: 0, freeBalancePaisa: 43000000, reconciliationStatus: 'RECONCILED' },
  ];

  return `
    <!-- CONSOLIDATED KPIS -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
      <div class="card" style="padding: 16px; border-top: 3px solid var(--gold, #d4af37);">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">TOTAL ERP BOOK BALANCE</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: var(--ink); margin-top: 6px;">${formatPaisa(kpis.totalBookBalancePaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Across ${kpis.activeAccountsCount || 5} active accounts</div>
      </div>

      <div class="card" style="padding: 16px; border-top: 3px solid #10b981;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">EXTERNAL INCOME (INFLOW)</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: #10b981; margin-top: 6px;">+${formatPaisa(kpis.totalExternalIncomePaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Net verified revenue</div>
      </div>

      <div class="card" style="padding: 16px; border-top: 3px solid #ef4444;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">EXTERNAL EXPENSE (OUTFLOW)</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: #ef4444; margin-top: 6px;">-${formatPaisa(kpis.totalExternalExpensePaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Operational & procurement costs</div>
      </div>

      <div class="card" style="padding: 16px; border-top: 3px solid #3b82f6;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">NET CASH FLOW</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: #3b82f6; margin-top: 6px;">+${formatPaisa(kpis.netExternalCashFlowPaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Income minus Expense</div>
      </div>

      <div class="card" style="padding: 16px; border-top: 3px solid #8b5cf6;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">RESERVED / COMMITTED</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: #8b5cf6; margin-top: 6px;">${formatPaisa(kpis.totalReservedPaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Payroll, tax & suppliers earmarks</div>
      </div>

      <div class="card" style="padding: 16px; border-top: 3px solid #06b6d4;">
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--muted); text-transform: uppercase;">FREE / AVAILABLE BALANCE</div>
        <div style="font-size: 1.45rem; font-weight: 800; color: #06b6d4; margin-top: 6px;">${formatPaisa(kpis.freeBalancePaisa)}</div>
        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">Book Balance - Reserved</div>
      </div>
    </div>

    <!-- 6 GROUPED UNIVERSAL WORKSPACE BUTTONS -->
    <div style="margin-top: 28px;">
      <div style="font-size: 0.95rem; font-weight: 700; color: var(--ink); margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
        <span>Treasury Operations & Workspaces</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
        <!-- Group 1: Accounts & Structure -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--gold, #d4af37); text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('passbook')} <span>1. Accounts & Structure</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/accounts" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Accounts Directory</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">All Bank &amp; Cash Books</span>
            </a>
            <a href="#passbook/mapping" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Café Mapping</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Tenders &amp; Defaults</span>
            </a>
            <a href="#passbook/payment-mapping" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Payment Simulator</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Tender Routing Rules</span>
            </a>
            <a href="#passbook/migration" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Opening &amp; Migration</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Historical Roll-in</span>
            </a>
          </div>
        </div>

        <!-- Group 2: Transactions & Transfers -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #10b981; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('bills')} <span>2. Transactions & Transfers</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/transactions" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Transaction Log</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Digital Passbook</span>
            </a>
            <a href="#passbook/daybook" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Day Book</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Daily Vouchers</span>
            </a>
            <a href="#passbook/transfers" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Account Transfers</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Internal Treasury</span>
            </a>
            <a href="#passbook/inter-cafe-transfers" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Inter-Café Transfers</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Cross-Café Funding</span>
            </a>
          </div>
        </div>

        <!-- Group 3: Reconciliation & Statements -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('tasks')} <span>3. Reconciliation & Statements</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/reconciliation" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Reconciliation Centre</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Matching &amp; Variances</span>
            </a>
            <a href="#passbook/statements" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Statement Imports</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">CSV / XLSX / PDF</span>
            </a>
            <a href="#passbook/adjustments" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Balance Adjustments</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Direct Owner Fix</span>
            </a>
            <a href="#passbook/confirmations" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Confirmations</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Period Sign-Off</span>
            </a>
          </div>
        </div>

        <!-- Group 4: Treasury Control & Cash Ops -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #8b5cf6; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('finance')} <span>4. Control & Cash Ops</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/cash-verification" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Cash Verification</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Denomination Count</span>
            </a>
            <a href="#passbook/petty-cash" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Petty Cash Imprest</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Replenishment Flow</span>
            </a>
            <a href="#passbook/reservations" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Reserved Funds</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Earmarks &amp; Commitments</span>
            </a>
            <a href="#passbook/integrity" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Integrity Centre</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Invariants &amp; Parity</span>
            </a>
          </div>
        </div>

        <!-- Group 5: Evidence & Corporate Exports -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #ec4899; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('reports')} <span>5. Evidence & Exports</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/documents" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Document Vault</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Receipts &amp; Slips</span>
            </a>
            <a href="#passbook/exports" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">ZURF Exports</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">PDF / CSV Statements</span>
            </a>
            <a href="#passbook/unallocated" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Unallocated Queue</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Multi-Café Split</span>
            </a>
            <a href="#passbook/period-close" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Period Close</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Carry Forward Lock</span>
            </a>
          </div>
        </div>

        <!-- Group 6: Intelligence & Governance -->
        <div class="card" style="padding: 18px;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #06b6d4; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${icon('barChart')} <span>6. Intelligence & Governance</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="#passbook/analytics" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Cash Flow Analytics</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Trends &amp; Outflows</span>
            </a>
            <a href="#passbook/cafe-comparison" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Café Benchmark</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Side-by-Side Matrix</span>
            </a>
            <a href="#passbook/liquidity" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Liquidity Runway</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Days of Buffer</span>
            </a>
            <a href="#passbook/audit" class="pbk-subtile-btn" style="display: flex; flex-direction: column; justify-content: center; padding: 10px 12px; font-size: 0.84rem; text-decoration: none; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); color: var(--ink); min-width: 0; box-shadow: var(--shadow-xs); transition: all var(--motion-fast) var(--ease); white-space: normal; line-height: 1.3;">
              <strong style="font-size: 0.82rem; color: var(--ink); display: block; margin-bottom: 2px;">Immutable Audit</strong>
              <span style="font-size: 0.72rem; color: var(--muted); display: block;">Non-Disableable Trail</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- MULTI-CAFÉ FINANCIAL POSITIONS TABLE -->
    <div class="card" style="margin-top: 28px; padding: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--ink);">Multi-Café Financial Positions</div>
        <a href="#passbook/cafe-comparison" style="font-size: 0.8rem; color: var(--gold, #d4af37); text-decoration: none; font-weight: 600;">View Detailed Benchmark →</a>
      </div>

      <div style="overflow-x: auto;">
        <table class="table" style="width: 100%; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              <th style="text-align: left; padding: 10px 8px;">CAFÉ LOCATION</th>
              <th style="text-align: center; padding: 10px 8px;">ACCOUNTS</th>
              <th style="text-align: right; padding: 10px 8px;">ERP BOOK BALANCE</th>
              <th style="text-align: right; padding: 10px 8px;">RESERVED FUNDS</th>
              <th style="text-align: right; padding: 10px 8px;">FREE LIQUIDITY</th>
              <th style="text-align: center; padding: 10px 8px;">RECON STATUS</th>
              <th style="text-align: right; padding: 10px 8px;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${cafes.map((c) => `
              <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px 8px; font-weight: 600;">${c.cafeName}</td>
                <td style="padding: 12px 8px; text-align: center;"><span class="badge">${c.accountCount} Accounts</span></td>
                <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: var(--ink);">${formatPaisa(c.bookBalancePaisa)}</td>
                <td style="padding: 12px 8px; text-align: right; color: #8b5cf6;">${formatPaisa(c.reservedPaisa)}</td>
                <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #06b6d4;">${formatPaisa(c.freeBalancePaisa)}</td>
                <td style="padding: 12px 8px; text-align: center;">
                  <span class="badge" style="background: ${c.reconciliationStatus === 'RECONCILED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${c.reconciliationStatus === 'RECONCILED' ? '#10b981' : '#f59e0b'};">
                    ${c.reconciliationStatus}
                  </span>
                </td>
                <td style="padding: 12px 8px; text-align: right;">
                  <a href="#passbook/accounts?cafeId=${c.cafeId}" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; text-decoration: none;">View Accounts</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── 1. ACCOUNTS DIRECTORY ───────────────────────────────────────────────────
function renderAccountsDirectory() {
  const accounts = passbookData?.accounts || [];

  return `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <a href="#passbook" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Control Centre</a>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">Treasury Accounts Directory</h2>
        </div>
        <button id="pbk-open-create-acc-modal" class="btn btn-primary" style="display: flex; align-items: center; gap: 6px;">
          ${icon('plus')} <span>Create Treasury Account</span>
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
        ${accounts.map((acc) => `
          <div class="card" style="padding: 18px; border-top: 3px solid ${acc.accountType === 'BANK_OPERATING' ? 'var(--gold, #d4af37)' : acc.accountType === 'CASH_IN_HAND' ? '#10b981' : '#8b5cf6'};">
            <div style="display: flex; align-items: start; justify-content: space-between;">
              <div>
                <span class="badge" style="font-size: 0.7rem; margin-bottom: 6px;">${acc.accountType}</span>
                <div style="font-size: 1rem; font-weight: 700; color: var(--ink);">${acc.accountName}</div>
                <div style="font-size: 0.75rem; color: var(--muted);">${acc.institutionName || 'In-House'} · ${acc.maskedAccountNumber}</div>
              </div>
            </div>

            <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 8px;">
              <div>
                <div style="font-size: 0.7rem; color: var(--muted); font-weight: 600;">BOOK BALANCE</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: var(--ink);">${formatPaisa(acc.bookBalancePaisa)}</div>
              </div>
              <div>
                <div style="font-size: 0.7rem; color: var(--muted); font-weight: 600;">FREE BALANCE</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #06b6d4;">${formatPaisa(acc.freeBalancePaisa)}</div>
              </div>
            </div>

            <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--muted);">
              <span>Last Recon: ${acc.lastReconciledDate || 'Pending'}</span>
              <a href="#passbook/accounts/${acc.accountId}" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none;">Account 360 →</a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── 2. ACCOUNT 360 ──────────────────────────────────────────────────────────
function renderAccount360(accountId) {
  const account = passbookData?.accounts?.find((a) => a.accountId === accountId) || {
    accountId,
    accountName: 'HDFC Bank — Main Treasury Current Account',
    maskedAccountNumber: '••••4821',
    institutionName: 'HDFC Bank Ltd.',
    bookBalancePaisa: 284500000,
    verifiedStatementBalancePaisa: 284500000,
    reservedPaisa: 50000000,
    freeBalancePaisa: 234500000,
    scopeType: 'ORGANISATION_GLOBAL',
    status: 'ACTIVE',
  };

  return `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <a href="#passbook/accounts" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Accounts Directory</a>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">${account.accountName}</h2>
          <div style="font-size: 0.8rem; color: var(--muted);">${account.institutionName} · ${account.maskedAccountNumber} · <span class="badge">${account.scopeType}</span></div>
        </div>
        <div style="display: flex; gap: 8px;">
          <a href="#passbook/adjustments?accountId=${account.accountId}" class="btn btn-secondary" style="font-size: 0.85rem; text-decoration: none;">Direct Adjustment</a>
          <a href="/api/v1/passbook/export/pdf?accountId=${account.accountId}" target="_blank" class="btn btn-primary" style="font-size: 0.85rem; text-decoration: none;">Export ZURF Statement</a>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="card" style="padding: 14px;">
          <div style="font-size: 0.7rem; color: var(--muted); font-weight: 700;">ERP BOOK BALANCE</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--ink); margin-top: 4px;">${formatPaisa(account.bookBalancePaisa)}</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 0.7rem; color: var(--muted); font-weight: 700;">VERIFIED STATEMENT</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #10b981; margin-top: 4px;">${formatPaisa(account.verifiedStatementBalancePaisa)}</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 0.7rem; color: var(--muted); font-weight: 700;">RESERVED FUNDS</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #8b5cf6; margin-top: 4px;">${formatPaisa(account.reservedPaisa)}</div>
        </div>
        <div class="card" style="padding: 14px;">
          <div style="font-size: 0.7rem; color: var(--muted); font-weight: 700;">FREE LIQUIDITY</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #06b6d4; margin-top: 4px;">${formatPaisa(account.freeBalancePaisa)}</div>
        </div>
      </div>

      <div class="card" style="padding: 18px;">
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--ink); margin-bottom: 12px;">Recent Account Transactions</div>
        <p style="font-size: 0.85rem; color: var(--muted);">View authoritative chronological postings with running balances.</p>
        <a href="#passbook/transactions?accountId=${account.accountId}" class="btn btn-secondary" style="display: inline-block; margin-top: 8px; font-size: 0.8rem; text-decoration: none;">Open Transaction Log for this Account →</a>
      </div>
    </div>
  `;
}

// ─── 3. TRANSACTIONS LOG ─────────────────────────────────────────────────────
function renderTransactionLog() {
  const transactions = passbookData?.recentActivity || [
    { transactionId: 'PBK-202608-0002', postingDate: '2026-08-05', narration: 'Consolidated POS Card Settlement for July W4', type: 'EXTERNAL_INCOME', direction: 'CREDIT', amountPaisa: 45000000, runningBalancePaisa: 295000000, externalReference: 'UTR-PINELABS-98124' },
    { transactionId: 'PBK-202608-0003', postingDate: '2026-08-10', narration: 'Speciality Green Bean Procurement Batch #489', type: 'EXTERNAL_EXPENSE', direction: 'DEBIT', amountPaisa: 10500000, runningBalancePaisa: 284500000, externalReference: 'RTGS-BT-20260810-09' },
  ];

  return `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <a href="#passbook" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Control Centre</a>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">Digital Passbook & Transaction Log</h2>
        </div>
        <button id="pbk-open-post-txn-modal" class="btn btn-primary" style="display: flex; align-items: center; gap: 6px;">
          ${icon('plus')} <span>Post Manual Entry</span>
        </button>
      </div>

      <div class="card" style="padding: 16px;">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border);">
                <th style="text-align: left; padding: 8px;">DATE</th>
                <th style="text-align: left; padding: 8px;">TXN ID</th>
                <th style="text-align: left; padding: 8px;">PARTICULARS</th>
                <th style="text-align: left; padding: 8px;">REF / UTR</th>
                <th style="text-align: right; padding: 8px;">DEBIT</th>
                <th style="text-align: right; padding: 8px;">CREDIT</th>
                <th style="text-align: right; padding: 8px;">RUNNING BALANCE</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map((t) => `
                <tr style="border-bottom: 1px solid var(--border);">
                  <td style="padding: 10px 8px;">${t.postingDate}</td>
                  <td style="padding: 10px 8px; font-weight: 600;">${t.transactionId}</td>
                  <td style="padding: 10px 8px;">${t.narration}</td>
                  <td style="padding: 10px 8px; color: var(--muted);">${t.externalReference || '—'}</td>
                  <td style="padding: 10px 8px; text-align: right; color: #ef4444; font-weight: 600;">${t.direction === 'DEBIT' ? formatPaisa(t.amountPaisa) : '—'}</td>
                  <td style="padding: 10px 8px; text-align: right; color: #10b981; font-weight: 600;">${t.direction === 'CREDIT' ? formatPaisa(t.amountPaisa) : '—'}</td>
                  <td style="padding: 10px 8px; text-align: right; font-weight: 700; color: var(--ink);">${formatPaisa(t.runningBalancePaisa)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ─── 4. DIRECT ADJUSTMENTS WORKSPACE ─────────────────────────────────────────
function renderDirectAdjustments() {
  const accounts = passbookData?.accounts || [];

  return `
    <div style="max-width: 720px; margin: 0 auto;">
      <div style="margin-bottom: 16px;">
        <a href="#passbook" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Control Centre</a>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">Direct Balance Adjustment</h2>
        <p style="font-size: 0.85rem; color: var(--muted);">Direct balance corrections execute immediately under Primary Master / Owner authority without maker-checker delays, creating an immutable audit transaction.</p>
      </div>

      <div class="card" style="padding: 24px; border-left: 4px solid var(--gold, #d4af37);">
        <form id="pbk-direct-adjustment-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--ink); margin-bottom: 6px;">Select Treasury Account *</label>
            <select id="adj-account-id" class="form-control" style="width: 100%; padding: 8px 12px; font-size: 0.9rem;" required>
              ${accounts.map((a) => `<option value="${a.accountId}">${a.accountName} (Current: ${formatPaisa(a.bookBalancePaisa)})</option>`).join('')}
            </select>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--ink); margin-bottom: 6px;">New Target Book Balance (₹) *</label>
            <input type="number" step="0.01" id="adj-new-balance" class="form-control" style="width: 100%; padding: 8px 12px; font-size: 0.9rem;" placeholder="e.g. 2845000.00" required />
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--ink); margin-bottom: 6px;">Mandatory Justification Reason *</label>
            <textarea id="adj-reason" class="form-control" style="width: 100%; padding: 8px 12px; font-size: 0.85rem; height: 80px;" placeholder="Explain reason for adjustment (e.g. Bank statement fee alignment or physical vault count correction)" required></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 600;">
            Execute Direct Balance Adjustment
          </button>
        </form>
      </div>
    </div>
  `;
}

// ─── 5. RECONCILIATION CENTRE ────────────────────────────────────────────────
function renderReconciliationCentre() {
  return `
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div>
          <a href="#passbook" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Control Centre</a>
          <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">Reconciliation Centre</h2>
        </div>
        <a href="#passbook/statements" class="btn btn-primary" style="text-decoration: none; font-size: 0.85rem;">Upload Statement File</a>
      </div>

      <div class="card" style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="padding: 14px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 700;">ERP BOOK BALANCE</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--ink); margin-top: 4px;">₹28,45,000.00</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 700;">LAST VERIFIED STATEMENT</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #10b981; margin-top: 4px;">₹28,45,000.00</div>
          </div>
          <div style="padding: 14px; background: rgba(0,0,0,0.02); border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--muted); font-weight: 700;">RECONCILIATION VARIANCE</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #10b981; margin-top: 4px;">₹0.00 (Balanced)</div>
          </div>
        </div>

        <p style="font-size: 0.85rem; color: var(--muted);">All active ledger items match uploaded statement row fingerprints with 100% confidence.</p>
      </div>
    </div>
  `;
}

// ─── 6. CASH & PHYSICAL VERIFICATION ─────────────────────────────────────────
function renderCashVerification() {
  return `
    <div style="max-width: 680px; margin: 0 auto;">
      <div style="margin-bottom: 16px;">
        <a href="#passbook" style="font-size: 0.8rem; color: var(--muted); text-decoration: none;">← Back to Control Centre</a>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-top: 4px;">Physical Cash & Denomination Verification</h2>
        <p style="font-size: 0.85rem; color: var(--muted);">Count physical INR bank notes to verify vault cash against ERP cash book balances.</p>
      </div>

      <div class="card" style="padding: 20px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹500 Notes</label><input type="number" id="denom-500" class="form-control" placeholder="Count" min="0" value="0" /></div>
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹200 Notes</label><input type="number" id="denom-200" class="form-control" placeholder="Count" min="0" value="0" /></div>
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹100 Notes</label><input type="number" id="denom-100" class="form-control" placeholder="Count" min="0" value="0" /></div>
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹50 Notes</label><input type="number" id="denom-50" class="form-control" placeholder="Count" min="0" value="0" /></div>
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹20 Notes</label><input type="number" id="denom-20" class="form-control" placeholder="Count" min="0" value="0" /></div>
          <div><label style="font-size: 0.8rem; font-weight: 600;">₹10 / Coins (₹)</label><input type="number" id="denom-coins" class="form-control" placeholder="Amount" min="0" value="0" /></div>
        </div>

        <div style="margin-top: 18px; padding: 14px; background: rgba(0,0,0,0.03); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.9rem;">Total Physical Count:</span>
          <span id="denom-total-display" style="font-size: 1.25rem; font-weight: 800; color: #10b981;">₹0.00</span>
        </div>
      </div>
    </div>
  `;
}

// ─── STUB RENDERERS FOR OTHER WORKSPACES ─────────────────────────────────────
function renderCafeMapping() { return `<div class="card" style="padding:20px;"><h3>Café Tender & Account Mappings</h3><p style="color:var(--muted); font-size:0.85rem;">Temporal effective-dated payment channel assignments.</p></div>`; }
function renderDayBook() { return `<div class="card" style="padding:20px;"><h3>Daily Day Book & Position</h3><p style="color:var(--muted); font-size:0.85rem;">Chronological daily transactions.</p></div>`; }
function renderIncomeExpenses() { return `<div class="card" style="padding:20px;"><h3>Income & Expenses Summary</h3><p style="color:var(--muted); font-size:0.85rem;">External revenue vs operating disbursements.</p></div>`; }
function renderTransfersWorkspace() { return `<div class="card" style="padding:20px;"><h3>Treasury Transfers (Internal & Inter-Café)</h3><p style="color:var(--muted); font-size:0.85rem;">Atomic two-leg transfer manager.</p></div>`; }
function renderStatementImports() { return `<div class="card" style="padding:20px;"><h3>Statement Imports (CSV / XLSX / PDF)</h3><p style="color:var(--muted); font-size:0.85rem;">Manual bank statement importer with SHA-256 deduplication.</p></div>`; }
function renderUnallocatedWorkspace() { return `<div class="card" style="padding:20px;"><h3>Unallocated Transactions</h3><p style="color:var(--muted); font-size:0.85rem;">Shared multi-café transactions awaiting economic allocation.</p></div>`; }
function renderBalanceConfirmations() { return `<div class="card" style="padding:20px;"><h3>Period Balance Confirmations</h3><p style="color:var(--muted); font-size:0.85rem;">Formal sign-off schedules.</p></div>`; }
function renderCashDeposits() { return `<div class="card" style="padding:20px;"><h3>Undeposited Cash & Bank Deposits</h3><p style="color:var(--muted); font-size:0.85rem;">Track in-transit physical cash deposit batches.</p></div>`; }
function renderPettyCash() { return `<div class="card" style="padding:20px;"><h3>Petty Cash Imprest & Replenishment</h3><p style="color:var(--muted); font-size:0.85rem;">Monitor float limits and compute replenishment transfers.</p></div>`; }
function renderReservedFunds() { return `<div class="card" style="padding:20px;"><h3>Reserved & Committed Funds</h3><p style="color:var(--muted); font-size:0.85rem;">Manage payroll, tax, and supplier earmarks.</p></div>`; }
function renderPeriodClose() { return `<div class="card" style="padding:20px;"><h3>Period Close & Carry Forward</h3><p style="color:var(--muted); font-size:0.85rem;">Month-end lock with continuity checks.</p></div>`; }
function renderIntegrityCentre() { return `<div class="card" style="padding:20px;"><h3>Account Integrity Centre</h3><p style="color:var(--muted); font-size:0.85rem;">Invariant engine status: 100% Healthy.</p></div>`; }
function renderAttentionCentre() { return `<div class="card" style="padding:20px;"><h3>Attention Centre & Anomaly Radar</h3><p style="color:var(--muted); font-size:0.85rem;">Exception scanner for missing evidence and large adjustments.</p></div>`; }
function renderDocumentVault() { return `<div class="card" style="padding:20px;"><h3>Receipts & Document Vault</h3><p style="color:var(--muted); font-size:0.85rem;">Secure attachment gallery.</p></div>`; }
function renderCorporateExports() { return `<div class="card" style="padding:20px;"><h3>Statements & Corporate ZURF Exports</h3><p style="color:var(--muted); font-size:0.85rem;">Branded corporate PDF reports.</p></div>`; }
function renderAnalyticsView() { return `<div class="card" style="padding:20px;"><h3>Treasury Cash Flow Analytics</h3><p style="color:var(--muted); font-size:0.85rem;">Visual liquidity intelligence and trend forecasting.</p></div>`; }
function renderCafeComparison() { return `<div class="card" style="padding:20px;"><h3>Café Comparison Matrix</h3><p style="color:var(--muted); font-size:0.85rem;">Cross-location performance comparison.</p></div>`; }
function renderLiquidityRunway() { return `<div class="card" style="padding:20px;"><h3>Liquidity Runway & Forecast</h3><p style="color:var(--muted); font-size:0.85rem;">Buffer estimation and cash runway days.</p></div>`; }
function renderAuditTrail() { return `<div class="card" style="padding:20px;"><h3>Immutable Audit & Activity Trail</h3><p style="color:var(--muted); font-size:0.85rem;">Non-disableable activity ledger.</p></div>`; }
function renderTransaction360(id) { return `<div class="card" style="padding:20px;"><h3>Transaction 360 — ${id}</h3></div>`; }

// ─── Wiring Function ─────────────────────────────────────────────────────────
export async function wirePassbook() {
  await fetchPassbookOverview();

  // Helper: re-render the entire passbook page content and re-wire
  async function reRender() {
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.innerHTML = renderPassbook();
      await wirePassbook();
    }
  }

  // Scope Selector
  const scopeSelect = document.getElementById('pbk-scope-select');
  if (scopeSelect) {
    scopeSelect.addEventListener('change', async (e) => {
      currentScope = e.target.value;
      await fetchPassbookOverview();
      await reRender();
    });
  }

  // Refresh Button
  const refreshBtn = document.getElementById('pbk-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await fetchPassbookOverview();
      await reRender();
    });
  }

  // Direct Adjustment Form
  const adjForm = document.getElementById('pbk-direct-adjustment-form');
  if (adjForm) {
    adjForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = adjForm.querySelector('button[type="submit"]');
      const accId = document.getElementById('adj-account-id').value;
      const newBal = document.getElementById('adj-new-balance').value;
      const reason = document.getElementById('adj-reason').value;

      setButtonBusy(submitBtn, true, 'Applying Adjustment...');
      try {
        await apiPost(`/passbook/accounts/${accId}/adjust-balance`, {
          body: { newBalance: newBal, reason }
        });
        showToast('Direct balance adjustment applied successfully.', 'mint');
        window.location.hash = '#passbook/accounts';
      } catch (err) {
        showToast(err.userMessage || err.message || 'Could not apply adjustment.', 'coral');
      } finally {
        setButtonBusy(submitBtn, false);
      }
    });
  }

  // Denomination Live Calc
  const denomInputs = ['denom-500', 'denom-200', 'denom-100', 'denom-50', 'denom-20', 'denom-coins'];
  denomInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        const d500 = Number(document.getElementById('denom-500')?.value || 0) * 500;
        const d200 = Number(document.getElementById('denom-200')?.value || 0) * 200;
        const d100 = Number(document.getElementById('denom-100')?.value || 0) * 100;
        const d50 = Number(document.getElementById('denom-50')?.value || 0) * 50;
        const d20 = Number(document.getElementById('denom-20')?.value || 0) * 20;
        const coins = Number(document.getElementById('denom-coins')?.value || 0);
        const total = d500 + d200 + d100 + d50 + d20 + coins;
        const display = document.getElementById('denom-total-display');
        if (display) display.textContent = formatRupees(total);
      });
    }
  });
}
