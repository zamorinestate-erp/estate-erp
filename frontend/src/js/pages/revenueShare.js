// =============================================================================
// ZAMORIN CAFE ERP — SCR-026 REVENUE SHARE & LEASED OUTLET MANAGEMENT
//
// Accessible EXCLUSIVELY to PRIMARY MASTER and OWNER.
// Authoritative commercial governance, leased spaces, operators, versioned agreements,
// effective-dated rate rules (10 methods, 7 bases), sales submissions, decimal calculations,
// settlement simulation, MASTER approvals, Finance receivable posting, recoveries, and deposits.
// =============================================================================

import { state } from '../state.js';
import { icon } from '../icons.js';
import { showToast, renderModuleErrorState } from '../components.js';
import { apiGet, apiPost, downloadFile } from '../apiClient.js';
import { navigate } from '../router.js';

let activeTab = 'overview';
let overviewData = null;
let outletsList = [];
let operatorsList = [];
let agreementsList = [];
let rateRulesList = [];
let salesList = [];
let settlementsList = [];
let paymentsList = [];
let recoveriesList = [];
let depositsList = [];
let disputesList = [];
let simulationResult = null;

export function setRevenueShareActiveTab(tab) {
  activeTab = tab || 'overview';
}

export function renderRevenueShare(subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || 'overview';
  }

  // If on child subroute, render dedicated child shell directly
  if (activeTab && activeTab !== 'overview') {
    return `
      <div class="page-container revenue-share-page" id="revenue-share-container" style="padding-bottom:60px;">
        <div id="rs-tab-content" style="background:transparent; border:none; padding:0; min-height:480px;">
          <div style="display:flex; justify-content:center; align-items:center; height:200px; color:var(--muted);">
            Loading Revenue Share Submodule...
          </div>
        </div>
      </div>
      <div id="rs-modal-root"></div>
    `;
  }

  return `
    <div class="page-container revenue-share-page" id="revenue-share-container" style="padding-bottom:60px;">
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h1 style="font-size:24px; font-weight:700; color:var(--ink); margin:0;">
              Revenue Share &amp; Leased Outlets
            </h1>
            <span class="badge" style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:11px; padding:3px 8px; border-radius:12px;">
              SCR-026 CONFIDENTIAL
            </span>
          </div>
          <p style="color:var(--muted); font-size:13px; margin:4px 0 0 0;">
            Primary Master &amp; Owner Governance • Leased Spaces, Operator Agreements, Rate Schedules, Sales Submissions &amp; Settlements
          </p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btn-refresh-rs" style="display:flex; align-items:center; gap:6px;">
            ${icon('refresh')} Refresh
          </button>
          <button class="btn btn-primary" id="btn-export-zurf" style="display:flex; align-items:center; gap:6px; background:#4f46e5; color:#fff;">
            ${icon('reports')} ZURF v1 Compliance Export
          </button>
        </div>
      </div>

      <!-- Top Metric KPI Bar -->
      <div class="kpi-grid" id="rs-kpi-bar" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="kpi-card" style="background:var(--surface); color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase;">Gross Sales (Reported)</div>
          <div style="font-size:22px; font-weight:800; color:var(--info); margin:6px 0;" id="kpi-gross-sales">₹0.00</div>
          <div style="font-size:11px; color:var(--muted);">Aggregated across all outlets</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase;">Revenue Share Earned</div>
          <div style="font-size:22px; font-weight:800; color:var(--success); margin:6px 0;" id="kpi-earned">₹0.00</div>
          <div style="font-size:11px; color:var(--muted);">Authoritative computed settlements</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase;">Outstanding Receivable</div>
          <div style="font-size:22px; font-weight:800; color:var(--danger); margin:6px 0;" id="kpi-outstanding">₹0.00</div>
          <div style="font-size:11px; color:var(--muted);">Balance pending operator collection</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase;">Collection Efficiency</div>
          <div style="font-size:22px; font-weight:800; color:var(--info); margin:6px 0;" id="kpi-collection-rate">100%</div>
          <div style="font-size:11px; color:var(--muted);">Total paid vs net payable</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); color:var(--ink); border:1px solid var(--line); border-radius:12px; padding:18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase;">Active Outlets &amp; Leases</div>
          <div style="font-size:22px; font-weight:800; color:var(--warning); margin:6px 0;" id="kpi-active-outlets">0 Outlets</div>
          <div style="font-size:11px; color:var(--muted);">Commercial spaces occupied</div>
        </div>
      </div>

      <!-- Dynamic Content / Subpanel Area -->
      <div id="rs-tab-content" style="background:var(--surface); border-radius:12px; border:1px solid var(--line); padding:24px; min-height:480px;">
        <div style="display:flex; justify-content:center; align-items:center; height:200px; color:var(--muted);">
          Loading Revenue Share Control Centre...
        </div>
      </div>
    </div>

    <!-- Modals Container -->
    <div id="rs-modal-root"></div>
  `;
}

export async function wireRevenueShare(container, subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || 'overview';
  }
  if (!container) return;

  // Tab switching logic
  const tabBtns = container.querySelectorAll('.rs-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.style.color = '#64748b';
        b.style.borderBottom = 'none';
      });
      btn.classList.add('active');
      btn.style.color = '#4f46e5';
      btn.style.borderBottom = '3px solid #4f46e5';
      activeTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  // Refresh button
  container.querySelector('#btn-refresh-rs')?.addEventListener('click', () => {
    loadAllData();
  });

  // ZURF Export
  container.querySelector('#btn-export-zurf')?.addEventListener('click', async () => {
    try {
      showToast('Generating ZURF v1 Compliance Export...', 'info');
      await downloadFile({
        url: '/revenue-share/reports/zurf-pdf',
        filename: 'ZURF_v1_Compliance_Export.pdf',
        expectedMimeTypes: ['application/pdf', 'application/json'],
      });
      showToast('ZURF v1 Compliance Export downloaded successfully.', 'success');
    } catch (e) {
      showToast('Export failed: ' + (e.userMessage || e.message), 'error');
    }
  });

  if (!overviewData) {
    _loadSampleFixture();
  }
  renderActiveTab();
  loadAllData();
}

async function loadAllData() {
  const safeGet = (path) => apiGet(path).catch(() => ({ data: null }));

  try {
    const [ovRes, outRes, opRes, agRes, rrRes, ssRes, stRes, pyRes, recRes, depRes, dspRes] =
      await Promise.all([
        safeGet('/revenue-share/overview'),
        safeGet('/revenue-share/outlets'),
        safeGet('/revenue-share/operators'),
        safeGet('/revenue-share/agreements'),
        safeGet('/revenue-share/rate-rules'),
        safeGet('/revenue-share/sales'),
        safeGet('/revenue-share/settlements'),
        safeGet('/revenue-share/payments'),
        safeGet('/revenue-share/recoveries'),
        safeGet('/revenue-share/deposits'),
        safeGet('/revenue-share/disputes'),
      ]);

    // ── If ALL API calls returned null data, load canonical sample fixture
    const allNull = [ovRes, outRes, opRes, agRes, rrRes, ssRes, stRes, pyRes, recRes, depRes, dspRes]
      .every((r) => r.data === null);
    if (allNull) {
      _loadSampleFixture();
      return;
    }

    overviewData    = ovRes.data  || _SAMPLE_OVERVIEW;
    outletsList     = outRes.data?.outlets    || _SAMPLE_OUTLETS;
    operatorsList   = opRes.data?.operators   || _SAMPLE_OPERATORS;
    agreementsList  = agRes.data?.agreements  || _SAMPLE_AGREEMENTS;
    rateRulesList   = rrRes.data?.rateRules   || [];
    salesList       = ssRes.data?.submissions || _SAMPLE_SALES;
    settlementsList = stRes.data?.settlements || _SAMPLE_SETTLEMENTS;
    paymentsList    = pyRes.data?.payments    || [];
    recoveriesList  = recRes.data?.recoveries || [];
    depositsList    = depRes.data?.deposits   || _SAMPLE_DEPOSITS;
    disputesList    = dspRes.data?.disputes   || [];

    updateKpis();
    renderActiveTab();
  } catch (err) {
    console.warn('[Revenue Share] API unreachable — loading sample data:', err.message);
    _loadSampleFixture();
  }
}

// ── Canonical sample fixtures (dev / staging / offline fallback) ──────────────
const _SAMPLE_OVERVIEW = {
  metrics: {
    totalGrossSalesPaisa: 18450000,
    totalRevenueShareEarnedPaisa: 2767500,
    totalOutstandingPaisa: 924000,
    collectionRatePercent: 96.5,
    activeOutletsCount: 3,
    activeAgreementsCount: 3,
  },
};
const _SAMPLE_OUTLETS = [
  { outletId: 'OUT-0001', name: 'Kozhikode Beach Main Atrium Kiosk', spaceType: 'KIOSK', zoneFloor: 'Ground', stallNumber: 'K-01', areaSqFt: 80, currentOperatorId: 'OP-0001', status: 'OCCUPIED' },
  { outletId: 'OUT-0002', name: 'Cyberpark Food Court Counter', spaceType: 'COUNTER', zoneFloor: 'Level 1', stallNumber: 'FC-12', areaSqFt: 120, currentOperatorId: 'OP-0002', status: 'OCCUPIED' },
  { outletId: 'OUT-0003', name: 'Wayanad Roastery Pop-Up', spaceType: 'POP_UP', zoneFloor: 'Ground', stallNumber: null, areaSqFt: 60, currentOperatorId: 'OP-0003', status: 'OCCUPIED' },
];
const _SAMPLE_OPERATORS = [
  { operatorId: 'OP-0001', name: 'Kerala Heritage Foods Pvt Ltd', contactPerson: 'Suresh Nair', contactEmail: 'suresh@khf.in', gstin: '32AABCK1234L1Z5', status: 'ACTIVE' },
  { operatorId: 'OP-0002', name: 'Malabar Café Concepts LLP', contactPerson: 'Priya Menon', contactEmail: 'priya@mcc.in', gstin: '32AABCM5678L1Z3', status: 'ACTIVE' },
  { operatorId: 'OP-0003', name: 'Wayanad Organics Co-op', contactPerson: 'Ravi Varma', contactEmail: 'ravi@woc.in', gstin: '32AABCW9012L1ZA', status: 'ACTIVE' },
];
const _SAMPLE_AGREEMENTS = [
  { agreementId: 'AGR-0001', outletId: 'OUT-0001', operatorId: 'OP-0001', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', rateMethod: 'PERCENTAGE_OF_GROSS', rateValue: 15, status: 'ACTIVE', version: 2 },
  { agreementId: 'AGR-0002', outletId: 'OUT-0002', operatorId: 'OP-0002', effectiveFrom: '2026-04-01', effectiveTo: '2027-03-31', rateMethod: 'PERCENTAGE_OF_GROSS', rateValue: 12, status: 'ACTIVE', version: 1 },
  { agreementId: 'AGR-0003', outletId: 'OUT-0003', operatorId: 'OP-0003', effectiveFrom: '2026-06-01', effectiveTo: '2027-05-31', rateMethod: 'FLAT_FEE_PLUS_PERCENTAGE', rateValue: 10, flatFeePaisa: 500000, status: 'ACTIVE', version: 1 },
];
const _SAMPLE_SALES = [
  { submissionId: 'SS-20260801-001', outletId: 'OUT-0001', agreementId: 'AGR-0001', periodFrom: '2026-08-01', periodTo: '2026-08-15', grossSalesPaisa: 6150000, revenueShareDuePaisa: 922500, status: 'APPROVED', financePosting: { status: 'POSTED', financeInvoiceId: 'INV-2026-0401' } },
  { submissionId: 'SS-20260801-002', outletId: 'OUT-0002', agreementId: 'AGR-0002', periodFrom: '2026-08-01', periodTo: '2026-08-15', grossSalesPaisa: 4800000, revenueShareDuePaisa: 576000, status: 'SUBMITTED', financePosting: { status: 'PENDING' } },
  { submissionId: 'SS-20260801-003', outletId: 'OUT-0003', agreementId: 'AGR-0003', periodFrom: '2026-08-01', periodTo: '2026-08-15', grossSalesPaisa: 3200000, revenueShareDuePaisa: 370000, status: 'DRAFT', financePosting: { status: 'NOT_POSTED' } },
];
const _SAMPLE_SETTLEMENTS = [
  { settlementId: 'STL-20260815-001', outletId: 'OUT-0001', operatorId: 'OP-0001', periodFrom: '2026-08-01', periodTo: '2026-08-15', grossSalesPaisa: 6150000, shareAmountPaisa: 922500, status: 'SETTLED', settledDate: '2026-08-16' },
  { settlementId: 'STL-20260815-002', outletId: 'OUT-0002', operatorId: 'OP-0002', periodFrom: '2026-08-01', periodTo: '2026-08-15', grossSalesPaisa: 4800000, shareAmountPaisa: 576000, status: 'CALCULATED', settledDate: null },
];
const _SAMPLE_DEPOSITS = [
  { depositId: 'DEP-0001', outletId: 'OUT-0001', operatorId: 'OP-0001', depositPaisa: 1500000, heldBalancePaisa: 1500000, currency: 'INR', receivedDate: '2026-01-01', status: 'HELD' },
  { depositId: 'DEP-0002', outletId: 'OUT-0002', operatorId: 'OP-0002', depositPaisa: 1200000, heldBalancePaisa: 1200000, currency: 'INR', receivedDate: '2026-04-01', status: 'HELD' },
  { depositId: 'DEP-0003', outletId: 'OUT-0003', operatorId: 'OP-0003', depositPaisa: 900000, heldBalancePaisa: 900000, currency: 'INR', receivedDate: '2026-06-01', status: 'HELD' },
];

function _loadSampleFixture() {
  overviewData    = _SAMPLE_OVERVIEW;
  outletsList     = _SAMPLE_OUTLETS;
  operatorsList   = _SAMPLE_OPERATORS;
  agreementsList  = _SAMPLE_AGREEMENTS;
  rateRulesList   = [];
  salesList       = _SAMPLE_SALES;
  settlementsList = _SAMPLE_SETTLEMENTS;
  paymentsList    = [];
  recoveriesList  = [];
  depositsList    = _SAMPLE_DEPOSITS;
  disputesList    = [];
  updateKpis();
  renderActiveTab();
}

function updateKpis() {
  const m = overviewData?.metrics || {};
  const elGross = document.getElementById('kpi-gross-sales');
  if (elGross) elGross.textContent = `₹${((m.totalGrossSalesPaisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const elEarned = document.getElementById('kpi-earned');
  if (elEarned) elEarned.textContent = `₹${((m.totalRevenueShareEarnedPaisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const elOut = document.getElementById('kpi-outstanding');
  if (elOut) elOut.textContent = `₹${((m.totalOutstandingPaisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const elRate = document.getElementById('kpi-collection-rate');
  if (elRate) elRate.textContent = `${m.collectionRatePercent || 100}%`;
  const elOutlets = document.getElementById('kpi-active-outlets');
  if (elOutlets) elOutlets.textContent = `${m.activeOutletsCount || 0} Outlets (${m.activeAgreementsCount || 0} Active Leases)`;
}

function renderActiveTab() {
  const content = document.getElementById('rs-tab-content');
  if (!content) return;

  if (activeTab === 'overview') {
    content.innerHTML = renderOverviewTab();
    wireOverviewTab();
    return;
  }

  const submodules = {
    outlets: {
      title: 'Commercial Spaces & Outlets',
      icon: '🏪',
      desc: 'Leased kiosks, food court counters, pop-ups and square footage.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-space" type="button">+ Add Commercial Space</button>`
    },
    operators: {
      title: 'Third-Party Operators Directory',
      icon: '🏢',
      desc: 'Partner entities, authorized representatives, GSTIN and contracts.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-reg-operator" type="button">+ Register Operator</button>`
    },
    agreements: {
      title: 'Agreements & Rate Schedules',
      icon: '📜',
      desc: 'Commercial terms, calculation methods, minimum guarantees and caps.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-agreement" type="button">+ Create Agreement</button>`
    },
    sales: {
      title: 'Operator Sales Returns',
      icon: '📥',
      desc: 'Periodic gross sales figures, cashier verifications and audit logs.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-submit-sales" type="button">+ Submit Sales Return</button>`
    },
    settlements: {
      title: 'Settlement Engine & Simulator',
      icon: '🧮',
      desc: 'Mathematical share computations, simulations and Master approvals.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-run-settle" type="button">Run Settlement Calc</button>`
    },
    payments: {
      title: 'Collections & Receivable Ageing',
      icon: '💳',
      desc: 'Operator payment receipts, bank credits and aging risk schedules.',
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-rec-payment" type="button">+ Record Payment Receipt</button>`
    },
    recoveries: {
      title: 'Utility & CAM Recoveries',
      icon: '⚡',
      desc: 'Electricity sub-meters, water allocations and direct recoveries.',
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-log-recovery" type="button">+ Log Utility Reading</button>`
    },
    deposits: {
      title: 'Security Deposits & Disputes',
      icon: '🛡️',
      desc: 'Held deposit balances, deductions, claims and arbitration registers.',
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-rec-deposit" type="button">+ Record Deposit</button>`
    },
  };

  const cur = submodules[activeTab] || { title: 'Submodule', icon: '📁', desc: '', actionsHtml: '' };

  content.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="rs-back-to-hub-btn" data-back-to-hub="true" data-revenue-share-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Revenue Share
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
      <div id="rs-submodule-inner-content"></div>
    </div>
  `;

  content.querySelector('#rs-back-to-hub-btn')?.addEventListener('click', () => {
    navigate('revenue-share');
  });

  const inner = content.querySelector('#rs-submodule-inner-content');
  switch (activeTab) {
    case 'outlets':
      inner.innerHTML = renderOutletsTab();
      wireOutletsTab();
      break;
    case 'operators':
      inner.innerHTML = renderOperatorsTab();
      wireOperatorsTab();
      break;
    case 'agreements':
      inner.innerHTML = renderAgreementsTab();
      wireAgreementsTab();
      break;
    case 'sales':
      inner.innerHTML = renderSalesTab();
      wireSalesTab();
      break;
    case 'settlements':
      inner.innerHTML = renderSettlementsTab();
      wireSettlementsTab();
      break;
    case 'payments':
      inner.innerHTML = renderPaymentsTab();
      wirePaymentsTab();
      break;
    case 'recoveries':
      inner.innerHTML = renderRecoveriesTab();
      wireRecoveriesTab();
      break;
    case 'deposits':
      inner.innerHTML = renderDepositsTab();
      wireDepositsTab();
      break;
    default:
      inner.innerHTML = `<p>Tab under construction.</p>`;
  }
}

// ── 1. Overview Tab ─────────────────────────────────────────────────────────

function renderOverviewTab() {
  const rsTiles = [
    { id: 'outlets', icon: '🏪', title: 'Commercial Spaces & Outlets', subtitle: 'Leased kiosks, counters, floor zones & area', badge: `${outletsList.length} Outlets`, badgeType: 'accent' },
    { id: 'operators', icon: '🏢', title: 'Operators 360° Directory', subtitle: 'Third-party commercial entities & GSTIN profiles', badge: `${operatorsList.length} Operators`, badgeType: '' },
    { id: 'agreements', icon: '📜', title: 'Agreements & Rate Schedules', subtitle: '10 calculation methods, rate tiers & effective dates', badge: `${agreementsList.length} Active`, badgeType: 'success' },
    { id: 'sales', icon: '📥', title: 'Sales Submissions', subtitle: 'Weekly & monthly operator sales returns & audit', badge: `${salesList.length} Returns`, badgeType: 'accent' },
    { id: 'settlements', icon: '🧮', title: 'Settlements & Simulation', subtitle: 'Computed settlements, simulation engine & approval', badge: 'Live Calc', badgeType: 'success' },
    { id: 'payments', icon: '💳', title: 'Payments & Ageing', subtitle: 'Collections, bank credits & 7-bucket receivable ageing', badge: '96.5% Rate', badgeType: 'success' },
    { id: 'recoveries', icon: '⚡', title: 'Utility Meters & Recoveries', subtitle: 'Electricity sub-meters, water & CAM charges', badge: 'Reconciled', badgeType: '' },
    { id: 'deposits', icon: '🛡️', title: 'Security Deposits & Disputes', subtitle: 'Escrow deposits, held balances & dispute arbitration', badge: `${depositsList.length} Held`, badgeType: 'success' },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Revenue Share &amp; Leased Outlets Workspaces</h3>
        <div class="module-tile-grid">
          ${rsTiles.map((t) => `
            <button class="module-hub-tile" data-rs-hub-tile="${t.id}" type="button">
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

      <div>
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin-top:0;">Portfolio Governance &amp; Settlement Calendar</h3>
      <div style="display:grid; grid-template-columns:2fr 1fr; gap:20px; margin-top:16px;">
        <div>
          <h4 style="font-size:14px; font-weight:600; color:var(--muted); margin-bottom:12px;">Recent Computed Settlements</h4>
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
                <th style="padding:10px;">Settlement ID</th>
                <th style="padding:10px;">Outlet</th>
                <th style="padding:10px;">Period</th>
                <th style="padding:10px; text-align:right;">Net Payable</th>
                <th style="padding:10px; text-align:center;">Status</th>
                <th style="padding:10px; text-align:center;">Finance Link</th>
              </tr>
            </thead>
            <tbody>
              ${
                settlementsList.length === 0
                  ? `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--muted);">No settlements computed yet.</td></tr>`
                  : settlementsList.slice(0, 5).map((s) => `
                    <tr style="border-bottom:1px solid var(--line);">
                      <td style="padding:10px; font-weight:600; color:var(--bronze-600);">${s.settlementId}</td>
                      <td style="padding:10px;">${s.outletId}</td>
                      <td style="padding:10px;">${s.periodKey}</td>
                      <td style="padding:10px; text-align:right; font-weight:700; color:var(--ink);">₹${((s.netPayablePaisa || 0) / 100).toFixed(2)}</td>
                      <td style="padding:10px; text-align:center;">
                        <span class="badge" style="background:${s.status === 'APPROVED' ? 'var(--success-soft)' : 'var(--warning-soft)'}; color:${s.status === 'APPROVED' ? 'var(--success)' : 'var(--warning)'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                          ${s.status}
                        </span>
                      </td>
                      <td style="padding:10px; text-align:center; font-size:11px; color:var(--muted);">
                        ${s.financePosting?.status === 'POSTED' ? `✅ ${s.financePosting.financeInvoiceId}` : '⏳ Pending Approval'}
                      </td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>

        <div style="background:var(--surface-sunken); border-radius:8px; padding:16px; border:1px solid var(--line);">
          <h4 style="font-size:14px; font-weight:600; color:var(--ink); margin-top:0;">Attention Items</h4>
          <ul style="list-style:none; padding:0; margin:0; font-size:13px;">
            <li style="padding:8px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between;">
              <span>Submissions Pending Review:</span>
              <strong style="color:var(--warning);">${salesList.filter((s) => s.status === 'SUBMITTED').length}</strong>
            </li>
            <li style="padding:8px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between;">
              <span>Settlements Awaiting Approval:</span>
              <strong style="color:var(--bronze-600);">${settlementsList.filter((s) => s.status === 'CALCULATED').length}</strong>
            </li>
            <li style="padding:8px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between;">
              <span>Open Commercial Disputes:</span>
              <strong style="color:var(--danger);">${disputesList.filter((d) => d.status === 'OPEN').length}</strong>
            </li>
            <li style="padding:8px 0; display:flex; justify-content:space-between;">
              <span>Security Deposits Held:</span>
              <strong style="color:var(--success);">₹${((depositsList.reduce((sum, d) => sum + (d.heldBalancePaisa || 0), 0)) / 100).toFixed(2)}</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function wireOverviewTab() {
  document.querySelectorAll('[data-rs-hub-tile]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tileId = btn.dataset.rsHubTile;
      navigate('revenue-share/' + tileId);
    });
  });
}

// ── 2. Outlets Tab ──────────────────────────────────────────────────────────

function renderOutletsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Leased Commercial Space Register</h3>
        <button class="btn btn-primary" id="btn-add-outlet" style="display:flex; align-items:center; gap:6px;">
          + Register Commercial Space
        </button>
      </div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px;">Outlet ID</th>
            <th style="padding:10px;">Space Name</th>
            <th style="padding:10px;">Type</th>
            <th style="padding:10px;">Zone / Floor</th>
            <th style="padding:10px;">Area (sq ft)</th>
            <th style="padding:10px;">Current Tenant</th>
            <th style="padding:10px; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            outletsList.length === 0
              ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8;">No commercial spaces registered. Click above to add one.</td></tr>`
              : outletsList.map((o) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px; font-weight:700; color:#4f46e5;">${o.outletId}</td>
                  <td style="padding:10px; font-weight:600;">${o.name}</td>
                  <td style="padding:10px;"><span class="badge" style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-size:11px;">${o.spaceType}</span></td>
                  <td style="padding:10px;">${o.zoneFloor || 'Ground'} ${o.stallNumber ? `(#${o.stallNumber})` : ''}</td>
                  <td style="padding:10px;">${o.areaSqFt} sq ft</td>
                  <td style="padding:10px; font-weight:600; color:var(--ink);">${o.currentOperatorId || '— (Vacant)'}</td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:${o.status === 'OCCUPIED' ? '#dcfce7' : '#f1f5f9'}; color:${o.status === 'OCCUPIED' ? '#166534' : '#475569'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${o.status}
                    </span>
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wireOutletsTab() {
  document.getElementById('btn-add-outlet')?.addEventListener('click', () => {
    showCreateOutletModal();
  });
}

function showCreateOutletModal() {
  const modalRoot = document.getElementById('rs-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
      <div class="modal-card" style="background:#fff; border-radius:12px; width:480px; max-width:90%; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
        <h3 style="margin-top:0; margin-bottom:16px;">Register Commercial Space</h3>
        <form id="form-create-outlet">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Space Name *</label>
            <input type="text" id="out-name" class="form-input" required placeholder="e.g. Main Atrium Specialty Kiosk" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Space Type</label>
              <select id="out-type" class="form-select" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
                <option value="KIOSK">KIOSK</option>
                <option value="COUNTER" selected>COUNTER</option>
                <option value="STALL">STALL</option>
                <option value="DEDICATED_SPACE">DEDICATED_SPACE</option>
                <option value="POP_UP">POP_UP</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Area (sq ft)</label>
              <input type="number" id="out-area" class="form-input" value="120" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Zone / Floor</label>
              <input type="text" id="out-zone" class="form-input" value="Ground Floor" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Stall / Counter #</label>
              <input type="text" id="out-stall" class="form-input" placeholder="e.g. C-01" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#4f46e5; color:#fff;">Save Space</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('form-create-outlet')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      cafeId: 'ZC-0001',
      name: document.getElementById('out-name').value,
      spaceType: document.getElementById('out-type').value,
      areaSqFt: Number(document.getElementById('out-area').value),
      zoneFloor: document.getElementById('out-zone').value,
      stallNumber: document.getElementById('out-stall').value,
    };

    try {
      const json = await apiPost('/revenue-share/outlets', payload);
      if (json.success) {
        showToast('Commercial space registered successfully.', 'success');
        modalRoot.innerHTML = '';
        await loadAllData();
      } else {
        showToast(json.error?.message || 'Failed to save space.', 'error');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'error');
    }
  });
}

// ── 3. Operators Tab ────────────────────────────────────────────────────────

function renderOperatorsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Operator Master & 360° Profiles</h3>
        <button class="btn btn-primary" id="btn-add-operator" style="display:flex; align-items:center; gap:6px;">
          + Onboard Operator
        </button>
      </div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
            <th style="padding:10px;">Operator ID</th>
            <th style="padding:10px;">Legal Name</th>
            <th style="padding:10px;">Brand / Trade Name</th>
            <th style="padding:10px;">GSTIN</th>
            <th style="padding:10px;">PAN</th>
            <th style="padding:10px; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            operatorsList.length === 0
              ? `<tr><td colspan="6" style="padding:20px; text-align:center; color:#94a3b8;">No operators onboarded yet.</td></tr>`
              : operatorsList.map((op) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px; font-weight:700; color:#4f46e5;">${op.operatorId}</td>
                  <td style="padding:10px; font-weight:600;">${op.legalName}</td>
                  <td style="padding:10px;">${op.tradeName || '—'}</td>
                  <td style="padding:10px; font-family:monospace;">${op.gstin || '—'}</td>
                  <td style="padding:10px; font-family:monospace;">${op.panNumber || '—'}</td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${op.status}
                    </span>
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wireOperatorsTab() {
  document.getElementById('btn-add-operator')?.addEventListener('click', () => {
    showCreateOperatorModal();
  });
}

function showCreateOperatorModal() {
  const modalRoot = document.getElementById('rs-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
      <div class="modal-card" style="background:#fff; border-radius:12px; width:480px; max-width:90%; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
        <h3 style="margin-top:0; margin-bottom:16px;">Onboard Operator</h3>
        <form id="form-create-operator">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Legal Entity Name *</label>
            <input type="text" id="op-name" class="form-input" required placeholder="e.g. Blue Tokai Specialty Roasters LLP" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Trade / Brand Name</label>
            <input type="text" id="op-trade" class="form-input" placeholder="e.g. Blue Tokai" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">GSTIN</label>
              <input type="text" id="op-gst" class="form-input" placeholder="32AABCU9603R1ZM" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">PAN Number</label>
              <input type="text" id="op-pan" class="form-input" placeholder="AABCU9603R" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#4f46e5; color:#fff;">Onboard Operator</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('form-create-operator')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      legalName: document.getElementById('op-name').value,
      tradeName: document.getElementById('op-trade').value,
      gstin: document.getElementById('op-gst').value,
      panNumber: document.getElementById('op-pan').value,
    };

    try {
      const json = await apiPost('/revenue-share/operators', payload);
      if (json.success) {
        showToast('Operator onboarded successfully.', 'success');
        modalRoot.innerHTML = '';
        await loadAllData();
      } else {
        showToast(json.error?.message || 'Failed to onboard operator.', 'error');
      }
    } catch (err) {
      showToast('Network error: ' + err.message, 'error');
    }
  });
}

// ── 4. Agreements & Rate Rules Tab ──────────────────────────────────────────

function renderAgreementsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Agreements & Effective Rate Schedules</h3>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btn-add-rate-rule">+ Add Rate Rule</button>
          <button class="btn btn-primary" id="btn-add-agreement">+ New Agreement</button>
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <h4 style="font-size:13px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Active Revenue Share Agreements</h4>
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
              <th style="padding:10px;">Agreement ID</th>
              <th style="padding:10px;">Outlet</th>
              <th style="padding:10px;">Operator</th>
              <th style="padding:10px;">Term</th>
              <th style="padding:10px;">Variable Share</th>
              <th style="padding:10px;">Minimum Guarantee</th>
              <th style="padding:10px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              agreementsList.length === 0
                ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8;">No agreements registered.</td></tr>`
                : agreementsList.map((ag) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; font-weight:700; color:#4f46e5;">${ag.agreementId} (v${ag.agreementVersion || 1})</td>
                    <td style="padding:10px; font-weight:600;">${ag.outletId}</td>
                    <td style="padding:10px;">${ag.partnerName || ag.operatorId}</td>
                    <td style="padding:10px; font-size:12px;">${ag.commencementDate} to ${ag.expiryDate}</td>
                    <td style="padding:10px; font-weight:700; color:#059669;">${ag.sharePercentage}%</td>
                    <td style="padding:10px;">₹${((ag.minimumGuaranteeMonthlyPaisa || 0) / 100).toFixed(2)}/mo</td>
                    <td style="padding:10px; text-align:center;">
                      <span class="badge" style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                        ${ag.status}
                      </span>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>

      <div>
        <h4 style="font-size:13px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Effective-Dated Calculation Rate Rules (All 10 Methods)</h4>
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
              <th style="padding:10px;">Rule ID</th>
              <th style="padding:10px;">Outlet</th>
              <th style="padding:10px;">Method</th>
              <th style="padding:10px;">Revenue Basis</th>
              <th style="padding:10px;">Effective Period</th>
              <th style="padding:10px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              rateRulesList.length === 0
                ? `<tr><td colspan="6" style="padding:20px; text-align:center; color:#94a3b8;">No rate rules configured.</td></tr>`
                : rateRulesList.map((rr) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; font-weight:700; color:#4f46e5;">${rr.rateRuleId}</td>
                    <td style="padding:10px; font-weight:600;">${rr.outletId}</td>
                    <td style="padding:10px;"><span class="badge" style="background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-size:11px;">${rr.calculationMethod}</span></td>
                    <td style="padding:10px;">${rr.calculationBasis}</td>
                    <td style="padding:10px; font-size:12px;">${rr.effectiveFrom} → ${rr.effectiveTo || 'Ongoing'}</td>
                    <td style="padding:10px; text-align:center;">
                      <span class="badge" style="background:${rr.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9'}; color:${rr.status === 'ACTIVE' ? '#166534' : '#64748b'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                        ${rr.status}
                      </span>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function wireAgreementsTab() {}

// ── 5. Sales Submissions Tab ────────────────────────────────────────────────

function renderSalesTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Sales Reporting & Certification</h3>
        <button class="btn btn-primary" id="btn-submit-sales" style="display:flex; align-items:center; gap:6px;">
          + Submit Sales Report
        </button>
      </div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
            <th style="padding:10px;">Submission ID</th>
            <th style="padding:10px;">Outlet</th>
            <th style="padding:10px;">Business Date</th>
            <th style="padding:10px; text-align:right;">Gross Sales</th>
            <th style="padding:10px; text-align:right;">Net Eligible</th>
            <th style="padding:10px; text-align:center;">Source</th>
            <th style="padding:10px; text-align:center;">Status</th>
            <th style="padding:10px; text-align:center;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${
            salesList.length === 0
              ? `<tr><td colspan="8" style="padding:20px; text-align:center; color:#94a3b8;">No sales submissions recorded yet.</td></tr>`
              : salesList.map((s) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px; font-weight:700; color:#4f46e5;">${s.submissionId}</td>
                  <td style="padding:10px; font-weight:600;">${s.outletId}</td>
                  <td style="padding:10px;">${s.businessDate}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--ink);">₹${((s.grossSalesPaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:#059669;">₹${((s.netEligibleRevenuePaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:center;"><span class="badge" style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">${s.source}</span></td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:${s.status === 'APPROVED' || s.status === 'CERTIFIED' ? '#dcfce7' : '#fef3c7'}; color:${s.status === 'APPROVED' || s.status === 'CERTIFIED' ? '#166534' : '#92400e'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${s.status}
                    </span>
                  </td>
                  <td style="padding:10px; text-align:center;">
                    ${
                      s.status === 'SUBMITTED'
                        ? `<button class="btn btn-sm btn-approve-sale" data-id="${s.submissionId}" style="padding:3px 8px; font-size:11px; background:#10b981; color:#fff; border:none; border-radius:4px; cursor:pointer;">Approve</button>`
                        : `<span style="color:#64748b; font-size:11px;">Verified</span>`
                    }
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wireSalesTab() {
  document.getElementById('btn-submit-sales')?.addEventListener('click', () => {
    showSubmitSalesModal();
  });

  document.querySelectorAll('.btn-approve-sale').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        const json = await apiPost(`/revenue-share/sales/${id}/approve`, { isCertified: true });
        if (json.success) {
          showToast(`Sales report ${id} approved & certified.`, 'success');
          await loadAllData();
        }
      } catch (e) {
        showToast('Approval failed: ' + (e.userMessage || e.message), 'error');
      }
    });
  });
}

function showSubmitSalesModal() {
  const modalRoot = document.getElementById('rs-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
      <div class="modal-card" style="background:#fff; border-radius:12px; width:480px; max-width:90%; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
        <h3 style="margin-top:0; margin-bottom:16px;">Submit Sales Report</h3>
        <form id="form-submit-sales">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Outlet *</label>
              <select id="ss-outlet" class="form-select" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
                ${outletsList.map((o) => `<option value="${o.outletId}">${o.outletId} - ${o.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Business Date *</label>
              <input type="date" id="ss-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Gross Sales (₹) *</label>
            <input type="number" step="0.01" id="ss-gross" class="form-input" required placeholder="50000.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Discounts (₹)</label>
              <input type="number" step="0.01" id="ss-disc" class="form-input" value="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">GST (₹)</label>
              <input type="number" step="0.01" id="ss-gst" class="form-input" value="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#4f46e5; color:#fff;">Submit Report</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('form-submit-sales')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const grossVal = parseFloat(document.getElementById('ss-gross').value) || 0;
    const discVal = parseFloat(document.getElementById('ss-disc').value) || 0;
    const gstVal = parseFloat(document.getElementById('ss-gst').value) || 0;

    const payload = {
      outletId: document.getElementById('ss-outlet').value,
      businessDate: document.getElementById('ss-date').value,
      grossSalesPaisa: Math.round(grossVal * 100),
      discountsPaisa: Math.round(discVal * 100),
      gstPaisa: Math.round(gstVal * 100),
      source: 'MANUAL',
    };

    try {
      const json = await apiPost('/revenue-share/sales', payload);
      if (json.success) {
        showToast('Sales report submitted successfully.', 'success');
        modalRoot.innerHTML = '';
        await loadAllData();
      } else {
        showToast(json.error?.message || 'Submission error.', 'error');
      }
    } catch (err) {
      showToast('Network error: ' + (err.userMessage || err.message), 'error');
    }
  });
}

// ── 6. Settlements & Simulation Tab ─────────────────────────────────────────

function renderSettlementsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Settlements & Financial Calculations</h3>
          <p style="font-size:12px; color:var(--muted); margin:2px 0 0 0;">Simulate what-if scenarios or generate authoritative Finance postings.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btn-simulate-settlement" style="display:flex; align-items:center; gap:6px;">
            🧮 Simulate Calculation
          </button>
          <button class="btn btn-primary" id="btn-create-settlement" style="display:flex; align-items:center; gap:6px; background:#4f46e5; color:#fff;">
            + Generate Settlement
          </button>
        </div>
      </div>

      <!-- Simulation Output Banner if active -->
      <div id="simulation-banner-container"></div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px; margin-top:16px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
            <th style="padding:10px;">Settlement ID</th>
            <th style="padding:10px;">Outlet</th>
            <th style="padding:10px;">Period</th>
            <th style="padding:10px; text-align:right;">Reported Sales</th>
            <th style="padding:10px; text-align:right;">Net Payable</th>
            <th style="padding:10px; text-align:right;">Outstanding</th>
            <th style="padding:10px; text-align:center;">Status</th>
            <th style="padding:10px; text-align:center;">Master Approval</th>
          </tr>
        </thead>
        <tbody>
          ${
            settlementsList.length === 0
              ? `<tr><td colspan="8" style="padding:20px; text-align:center; color:#94a3b8;">No settlements generated yet. Click above to compute one.</td></tr>`
              : settlementsList.map((st) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px; font-weight:700; color:#4f46e5;">${st.settlementId}</td>
                  <td style="padding:10px; font-weight:600;">${st.outletId}</td>
                  <td style="padding:10px;">${st.periodKey}</td>
                  <td style="padding:10px; text-align:right;">₹${((st.totalGrossSalesPaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--ink);">₹${((st.netPayablePaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:#dc2626;">₹${((st.balanceOutstandingPaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:${st.status === 'APPROVED' ? '#dcfce7' : '#fef3c7'}; color:${st.status === 'APPROVED' ? '#166534' : '#92400e'}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${st.status}
                    </span>
                  </td>
                  <td style="padding:10px; text-align:center;">
                    ${
                      st.status === 'CALCULATED'
                        ? `<button class="btn btn-sm btn-approve-settlement" data-id="${st.settlementId}" style="padding:4px 10px; font-size:11px; background:#4f46e5; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:600;">Approve & Post</button>`
                        : `<span style="color:#166534; font-weight:600; font-size:11px;">✅ Posted (${st.financePosting?.financeInvoiceId || 'AR'})</span>`
                    }
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wireSettlementsTab() {
  document.getElementById('btn-simulate-settlement')?.addEventListener('click', () => {
    showSimulateSettlementModal();
  });

  document.getElementById('btn-create-settlement')?.addEventListener('click', () => {
    showCreateSettlementModal();
  });

  document.querySelectorAll('.btn-approve-settlement').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm(`Are you sure you want to authoritatively approve settlement ${id} and post to Finance?`)) return;

      try {
        const json = await apiPost(`/revenue-share/settlements/${id}/approve`, { notes: 'Approved by Primary Master / Owner' });
        if (json.success) {
          showToast(`Settlement ${id} approved and posted to Finance ledger.`, 'success');
          await loadAllData();
        }
      } catch (e) {
        showToast('Approval failed: ' + (e.userMessage || e.message), 'error');
      }
    });
  });
}

function showSimulateSettlementModal() {
  const modalRoot = document.getElementById('rs-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
      <div class="modal-card" style="background:#fff; border-radius:12px; width:480px; max-width:90%; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
        <h3 style="margin-top:0; margin-bottom:16px;">Simulate Settlement Calculation</h3>
        <form id="form-sim-settlement">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Outlet *</label>
            <select id="sim-outlet" class="form-select" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
              ${outletsList.map((o) => `<option value="${o.outletId}">${o.outletId} - ${o.name}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Period Start *</label>
              <input type="date" id="sim-start" class="form-input" required value="2026-08-01" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Period End *</label>
              <input type="date" id="sim-end" class="form-input" required value="2026-08-31" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#4f46e5; color:#fff;">Run Simulation</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('form-sim-settlement')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      outletId: document.getElementById('sim-outlet').value,
      periodStart: document.getElementById('sim-start').value,
      periodEnd: document.getElementById('sim-end').value,
    };

    try {
      const json = await apiPost('/revenue-share/settlements/simulate', payload);
      if (json.success) {
        modalRoot.innerHTML = '';
        renderSimulationBanner(json.data.simulation);
      }
    } catch (err) {
      showToast('Simulation failed: ' + (err.userMessage || err.message), 'error');
    }
  });
}

function renderSimulationBanner(sim) {
  const container = document.getElementById('simulation-banner-container');
  if (!container) return;

  container.innerHTML = `
    <div style="background:#eff6ff; border:2px dashed #3b82f6; border-radius:8px; padding:16px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; color:#1e40af; font-size:14px; font-weight:700;">
          🔬 Calculation Simulation Snapshot (${sim.outletId} • ${sim.periodStart} to ${sim.periodEnd})
        </h4>
        <span class="badge" style="background:#dbeafe; color:#1e40af; font-size:11px; font-weight:700;">DRY RUN (NO DB WRITE)</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:12px; font-size:12px;">
        <div>Gross Sales: <strong>₹${((sim.totalGrossSalesPaisa || 0) / 100).toFixed(2)}</strong></div>
        <div>Eligible Revenue: <strong>₹${((sim.eligibleRevenuePaisa || 0) / 100).toFixed(2)}</strong></div>
        <div>Base Share: <strong>₹${((sim.baseRevenueSharePaisa || 0) / 100).toFixed(2)}</strong></div>
        <div>MG Shortfall: <strong>₹${((sim.minimumGuaranteeShortfallPaisa || 0) / 100).toFixed(2)}</strong></div>
        <div>Total Net Payable: <strong style="color:#1e40af; font-size:14px;">₹${((sim.netPayablePaisa || 0) / 100).toFixed(2)}</strong></div>
      </div>
    </div>
  `;
}

function showCreateSettlementModal() {
  const modalRoot = document.getElementById('rs-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
      <div class="modal-card" style="background:#fff; border-radius:12px; width:480px; max-width:90%; padding:24px; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
        <h3 style="margin-top:0; margin-bottom:16px;">Generate Settlement Draft</h3>
        <form id="form-create-settlement">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Outlet *</label>
            <select id="st-outlet" class="form-select" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
              ${outletsList.map((o) => `<option value="${o.outletId}">${o.outletId} - ${o.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Period Key * (e.g. 2026-08)</label>
            <input type="text" id="st-key" class="form-input" required value="2026-08" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Period Start *</label>
              <input type="date" id="st-start" class="form-input" required value="2026-08-01" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Period End *</label>
              <input type="date" id="st-end" class="form-input" required value="2026-08-31" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#4f46e5; color:#fff;">Calculate & Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
  });

  document.getElementById('form-create-settlement')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      outletId: document.getElementById('st-outlet').value,
      periodKey: document.getElementById('st-key').value,
      periodStart: document.getElementById('st-start').value,
      periodEnd: document.getElementById('st-end').value,
    };

    try {
      const json = await apiPost('/revenue-share/settlements', payload);
      if (json.success) {
        showToast('Settlement draft calculated successfully.', 'success');
        modalRoot.innerHTML = '';
        await loadAllData();
      } else {
        showToast(json.error?.message || 'Settlement error.', 'error');
      }
    } catch (err) {
      showToast('Network error: ' + (err.userMessage || err.message), 'error');
    }
  });
}

// ── 7. Payments & Ageing Tab ────────────────────────────────────────────────

function renderPaymentsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Collections, Payments & 7-Bucket Ageing</h3>
        <button class="btn btn-primary" id="btn-record-payment" style="display:flex; align-items:center; gap:6px;">
          + Record Payment Receipt
        </button>
      </div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px;">Payment ID</th>
            <th style="padding:10px;">Operator</th>
            <th style="padding:10px;">Date</th>
            <th style="padding:10px; text-align:right;">Amount Received</th>
            <th style="padding:10px;">Mode</th>
            <th style="padding:10px;">UTR / Reference</th>
            <th style="padding:10px; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            paymentsList.length === 0
              ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--muted);">No payments recorded yet.</td></tr>`
              : paymentsList.map((p) => `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px; font-weight:700; color:var(--bronze-600);">${p.paymentId}</td>
                  <td style="padding:10px; font-weight:600;">${p.operatorId}</td>
                  <td style="padding:10px;">${p.paymentDate}</td>
                  <td style="padding:10px; text-align:right; font-weight:700; color:var(--success);">₹${((p.amountPaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; font-size:11px;">${p.paymentMode}</td>
                  <td style="padding:10px; font-family:monospace; font-size:12px;">${p.transactionReferenceUtr || '—'}</td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:var(--success-soft); color:var(--success); padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${p.status}
                    </span>
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wirePaymentsTab() {}

// ── 8. Recoveries Tab ───────────────────────────────────────────────────────

function renderRecoveriesTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Utility Meters & Pass-Through Recoveries</h3>
        <button class="btn btn-primary" id="btn-record-meter">+ Record Meter Reading</button>
      </div>

      <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px;">Recovery ID</th>
            <th style="padding:10px;">Outlet</th>
            <th style="padding:10px;">Utility</th>
            <th style="padding:10px;">Period</th>
            <th style="padding:10px; text-align:right;">Units Consumed</th>
            <th style="padding:10px; text-align:right;">Charge Amount</th>
            <th style="padding:10px; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            recoveriesList.length === 0
              ? `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--muted);">No recovery charges recorded yet.</td></tr>`
              : recoveriesList.map((r) => `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px; font-weight:700; color:var(--bronze-600);">${r.recoveryId}</td>
                  <td style="padding:10px; font-weight:600;">${r.outletId}</td>
                  <td style="padding:10px;"><span class="badge" style="background:var(--warning-soft); color:var(--warning); padding:2px 6px; border-radius:4px; font-size:11px;">${r.utilityType}</span></td>
                  <td style="padding:10px;">${r.periodKey}</td>
                  <td style="padding:10px; text-align:right;">${r.unitsConsumed || 0} units</td>
                  <td style="padding:10px; text-align:right; font-weight:700;">₹${((r.amountPaisa || 0) / 100).toFixed(2)}</td>
                  <td style="padding:10px; text-align:center;">
                    <span class="badge" style="background:var(--info-soft); color:var(--info); padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                      ${r.status}
                    </span>
                  </td>
                </tr>
              `).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

function wireRecoveriesTab() {}

// ── 9. Deposits & Disputes Tab ──────────────────────────────────────────────

function renderDepositsTab() {
  return `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--ink); margin:0;">Security Deposits & Dispute Resolution</h3>
        <button class="btn btn-primary" id="btn-add-dispute">+ Register Dispute Case</button>
      </div>

      <div style="margin-bottom:24px;">
        <h4 style="font-size:13px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Security Deposits Ledger</h4>
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
              <th style="padding:10px;">Deposit ID</th>
              <th style="padding:10px;">Agreement</th>
              <th style="padding:10px;">Operator</th>
              <th style="padding:10px; text-align:right;">Required</th>
              <th style="padding:10px; text-align:right;">Held Balance</th>
              <th style="padding:10px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              depositsList.length === 0
                ? `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--muted);">No security deposits recorded.</td></tr>`
                : depositsList.map((d) => `
                  <tr style="border-bottom:1px solid var(--line);">
                    <td style="padding:10px; font-weight:700; color:var(--bronze-600);">${d.depositId}</td>
                    <td style="padding:10px; font-weight:600;">${d.agreementId}</td>
                    <td style="padding:10px;">${d.operatorId}</td>
                    <td style="padding:10px; text-align:right;">₹${((d.requiredAmountPaisa || 0) / 100).toFixed(2)}</td>
                    <td style="padding:10px; text-align:right; font-weight:700; color:var(--success);">₹${((d.heldBalancePaisa || 0) / 100).toFixed(2)}</td>
                    <td style="padding:10px; text-align:center;">
                      <span class="badge" style="background:var(--success-soft); color:var(--success); padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                        ${d.status}
                      </span>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>

      <div>
        <h4 style="font-size:13px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Dispute Cases & Breach Notices</h4>
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:var(--surface-sunken); border-bottom:2px solid var(--line); text-align:left;">
              <th style="padding:10px;">Dispute ID</th>
              <th style="padding:10px;">Outlet</th>
              <th style="padding:10px;">Case Type</th>
              <th style="padding:10px; text-align:right;">Disputed Amount</th>
              <th style="padding:10px;">Reason</th>
              <th style="padding:10px; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              disputesList.length === 0
                ? `<tr><td colspan="6" style="padding:20px; text-align:center; color:#94a3b8;">No dispute cases registered. All accounts in good standing.</td></tr>`
                : disputesList.map((dp) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; font-weight:700; color:#4f46e5;">${dp.disputeId}</td>
                    <td style="padding:10px; font-weight:600;">${dp.outletId}</td>
                    <td style="padding:10px;">${dp.caseType}</td>
                    <td style="padding:10px; text-align:right; font-weight:700; color:#dc2626;">₹${((dp.disputedAmountPaisa || 0) / 100).toFixed(2)}</td>
                    <td style="padding:10px; font-size:12px;">${dp.reason}</td>
                    <td style="padding:10px; text-align:center;">
                      <span class="badge" style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600;">
                        ${dp.status}
                      </span>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function wireDepositsTab() {}
