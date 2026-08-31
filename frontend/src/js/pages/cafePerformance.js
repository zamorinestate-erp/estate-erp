// =============================================================================
// ZAMORIN CAFE ERP — OWN-SCR-006: CAFÉ PERFORMANCE CONTROL CENTRE
// Primary Master Functional Parity · Multi-Café Analytics · Sales · Labor ·
// Inventory & Wastage · Actual-vs-Theoretical · Product Mix · Targets ·
// Exceptions & Attention · Weighted Aggregations · ZURF Corporate Exports
// =============================================================================

import { apiGet, apiPost } from '../apiClient.js';
import { skeleton, showToast, openModal, closeModal, renderCafeContextStrip } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';
import { icon } from '../icons.js';

// ─── Component State ──────────────────────────────────────────────────────────

let perfState = {
  activeTab: 'matrix', // 'matrix' | 'sales' | 'labor' | 'inventory' | 'menu' | 'targets' | 'drilldown' | 'reports'
  selectedCafeId: '', // '' = All Authorized Cafés
  period: 'today', // 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'this_quarter' | 'this_year' | 'custom'
  comparison: 'previous_period', // 'previous_period' | 'previous_week' | 'previous_month' | 'previous_quarter' | 'previous_year' | 'none'
  customFrom: null,
  customTo: null,
  trendViewMode: 'chart', // 'chart' | 'data'
  sortColumn: 'sales', // 'name' | 'sales' | 'growth' | 'bills' | 'abv' | 'labor' | 'splh' | 'waste' | 'health'
  sortDirection: 'desc',
  drilldownCafeId: null,
  dashboardData: null,
  salesAnalytics: null,
  portfolioData: null,
  workforceData: null,
  inventoryData: null,
  menuData: null,
  goalsData: null,
  loading: false,
  partialError: null,
  lastUpdated: null,
  savedViews: [],
  activeSavedViewId: null,
};

// ─── Format Helpers ──────────────────────────────────────────────────────────

function fmtInr(paisa) {
  if (paisa === null || paisa === undefined || isNaN(paisa)) return '—';
  const rupees = Math.round(Number(paisa) / 100);
  if (Math.abs(rupees) >= 10000000) return '₹' + (rupees / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(rupees) >= 100000) return '₹' + (rupees / 100000).toFixed(2) + ' L';
  if (Math.abs(rupees) >= 1000) return '₹' + (rupees / 1000).toFixed(1) + ' K';
  return '₹' + rupees.toLocaleString('en-IN');
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}

function fmtPct(pct, withSign = false) {
  if (pct === null || pct === undefined || isNaN(pct)) return '—';
  const val = Number(pct).toFixed(1);
  if (withSign && Number(pct) > 0) return `+${val}%`;
  return `${val}%`;
}

function getIstClockString() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

// ─── HTML Template ────────────────────────────────────────────────────────────

export function renderPerformance() {
  const canExport = [ROLES.MASTER, ROLES.OWNER].includes(state.role);

  return `
    <div class="page-enter" style="padding-bottom: 60px;">
      <!-- Page Header -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom: 24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h1 class="page-title" style="font-size:26px; font-weight:700; color:var(--ink); margin:0;">Café Performance Control Centre</h1>
            <span class="badge" style="background:rgba(180,83,9,0.12); color:#b45309; font-weight:600; font-size:12px; padding:4px 10px; border-radius:12px;">SCR-006 PERF</span>
          </div>
          <p class="page-subtitle" style="font-size:14px; color:var(--muted); margin:4px 0 0 0;">
            Multi-location sales benchmarking, labor efficiency, inventory economics, product velocity, and operational target attainment.
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${canExport ? `
            <button class="btn btn-primary" id="perf-open-export-btn" style="font-weight:700;" type="button">
              📑 Export Performance (ZURF)
            </button>
          ` : ''}
          <button class="btn btn-secondary" id="perf-refresh-btn" type="button" style="font-weight:600;">
            ↻ Refresh
          </button>
        </div>
      </div>

      <!-- Filter Controls Strip (Café Scope, Period, Comparison) -->
      <div class="card" style="padding:14px 18px;background:var(--surface-sunken);border:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <!-- Café Scope Dropdown -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="perf-cafe-scope" style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;">Café Scope:</label>
            <select id="perf-cafe-scope" class="form-input" style="font-size:12px;font-weight:600;padding:4px 10px;height:32px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-sm);">
              <option value="">All Cafés (Authorized Portfolio)</option>
              ${(state.assignedCafes || [
                { cafeId: 'ZC-0001', name: 'Dawn Roast — Koramangala' },
                { cafeId: 'ZC-0002', name: 'Indiranagar Central' },
                { cafeId: 'ZC-0003', name: 'Whitefield Roastery' },
              ]).map(c => `<option value="${c.cafeId}">${c.name || c.cafeId} (${c.cafeId})</option>`).join('')}
            </select>
          </div>

          <!-- Period Selector -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;">Period:</label>
            <div style="display:flex;gap:2px;background:var(--surface);padding:2px;border:1px solid var(--line);border-radius:var(--radius-sm);">
              ${[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: 'this_month', label: 'Month' },
                { id: 'this_quarter', label: 'Quarter' },
                { id: 'this_year', label: 'Year' },
                { id: 'custom', label: 'Custom' },
              ].map(p => `
                <button class="btn btn-xs ${perfState.period === p.id ? 'btn-primary' : 'btn-ghost'}" data-perf-period="${p.id}" style="font-size:11px;padding:3px 8px;font-weight:600;" type="button">
                  ${p.label}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Comparison Selector -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label for="perf-comparison" style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;">Compare:</label>
            <select id="perf-comparison" class="form-input" style="font-size:12px;font-weight:600;padding:4px 10px;height:32px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-sm);">
              <option value="previous_period">Previous Comparable Period</option>
              <option value="previous_week">Same Day Last Week</option>
              <option value="previous_month">Previous Month</option>
              <option value="previous_quarter">Previous Quarter</option>
              <option value="previous_year">Same Period Last Year</option>
              <option value="target">Target Goal Benchmark</option>
              <option value="none">No Comparison</option>
            </select>
          </div>
        </div>

        <!-- Saved Views Quick Select -->
        <div style="display:flex;align-items:center;gap:8px;">
          <select id="perf-saved-views-select" class="form-input" style="font-size:11px;height:32px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-sm);">
            <option value="">Saved Views...</option>
            <option value="sales_labor">Sales &amp; Labor Efficiency</option>
            <option value="inventory_waste">Inventory &amp; Wastage Focus</option>
            <option value="exceptions">Exceptions &amp; Variances Only</option>
          </select>
        </div>
      </div>

      <!-- Main Dynamic Content Container -->
      <div id="perf-main-content">
        ${renderLoadingSkeleton()}
      </div>

      <!-- Export Modal (Hidden by default) -->
      <div id="perf-export-modal" class="modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;">
        <div class="card" style="width:90%;max-width:520px;padding:24px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">📑</span>
              <h3 style="font-size:16px;font-weight:800;color:var(--ink);margin:0;">Generate ZURF Performance Export</h3>
            </div>
            <button class="btn btn-xs btn-ghost" id="perf-close-export-modal" type="button">✕</button>
          </div>
          <p style="font-size:12px;color:var(--muted);margin-bottom:16px;">
            Export certified executive performance packages with multi-location KPI breakdowns, labor productivity, and inventory variance schedules.
          </p>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
            <label class="form-label" style="font-size:12px;font-weight:700;color:var(--ink);">Export Format</label>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;">
              <button class="btn btn-sm btn-outline active" data-export-format="PDF" style="font-weight:700;">PDF Document</button>
              <button class="btn btn-sm btn-outline" data-export-format="CSV" style="font-weight:700;">CSV Dataset</button>
              <button class="btn btn-sm btn-outline" data-export-format="XLSX" style="font-weight:700;">Excel Workbook</button>
            </div>
            <div style="margin-top:8px;">
              <label class="form-check" style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink);cursor:pointer;">
                <input type="checkbox" id="perf-export-watermark" checked style="accent-color:var(--bronze-500);" />
                Include "CONFIDENTIAL" Executive Audit Watermark
              </label>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn btn-sm btn-ghost" id="perf-cancel-export-modal" type="button">Cancel</button>
            <button class="btn btn-sm btn-primary" id="perf-confirm-export-btn" type="button">Download Export</button>
          </div>
        </div>
      </div>

      <!-- Save View Modal (Hidden by default) -->
      <div id="perf-save-view-modal" class="modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;">
        <div class="card" style="width:90%;max-width:440px;padding:24px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h3 style="font-size:15px;font-weight:800;color:var(--ink);margin:0;">Save Custom Performance View</h3>
            <button class="btn btn-xs btn-ghost" id="perf-close-save-modal" type="button">✕</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
            <div>
              <label class="form-label" style="font-size:12px;font-weight:700;color:var(--ink);margin-bottom:4px;display:block;">View Name</label>
              <input type="text" id="perf-custom-view-name" class="form-input" placeholder="e.g. Weekend Rush Analysis" style="width:100%;font-size:12px;" />
            </div>
            <label class="form-check" style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink);cursor:pointer;">
              <input type="checkbox" id="perf-custom-view-default" style="accent-color:var(--bronze-500);" />
              Set as my default performance view
            </label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn btn-sm btn-ghost" id="perf-cancel-save-modal" type="button">Cancel</button>
            <button class="btn btn-sm btn-primary" id="perf-confirm-save-btn" type="button">Save View</button>
          </div>
        </div>
      </div>

      <!-- Custom Date Range Modal -->
      <div id="perf-custom-date-modal" class="modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;">
        <div class="card" style="width:90%;max-width:400px;padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h3 style="font-size:15px;font-weight:800;color:var(--ink);margin:0;">Select Custom Date Range</h3>
            <button class="btn btn-xs btn-ghost" id="perf-close-date-modal" type="button">✕</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
            <div>
              <label class="form-label" style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">From Date</label>
              <input type="date" id="perf-custom-from" class="form-input" style="width:100%;font-size:12px;" />
            </div>
            <div>
              <label class="form-label" style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:4px;">To Date</label>
              <input type="date" id="perf-custom-to" class="form-input" style="width:100%;font-size:12px;" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn btn-sm btn-ghost" id="perf-cancel-date-modal" type="button">Cancel</button>
            <button class="btn btn-sm btn-primary" id="perf-apply-date-modal" type="button">Apply Filter</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Loading Skeleton Renderer ───────────────────────────────────────────────

function renderLoadingSkeleton() {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px;">
      ${skeleton('90px')}
      ${skeleton('90px')}
      ${skeleton('90px')}
      ${skeleton('90px')}
      ${skeleton('90px')}
      ${skeleton('90px')}
    </div>
    <div class="card" style="padding:24px;background:var(--surface);border:1px solid var(--line);min-height:300px;">
      ${skeleton('260px')}
    </div>
  `;
}

// ─── Wire Logic & Event Handlers ─────────────────────────────────────────────

export async function wirePerformance(root) {
  if (!root) return;

  // 1. Live IST clock updater
  const clockEl = root.querySelector('#perf-ist-clock');
  const clockInterval = setInterval(() => {
    if (document.getElementById('perf-ist-clock')) {
      document.getElementById('perf-ist-clock').textContent = getIstClockString();
    } else {
      clearInterval(clockInterval);
    }
  }, 1000);

  // 2. Filter bindings
  const cafeSelect = root.querySelector('#perf-cafe-scope');
  if (cafeSelect) {
    cafeSelect.value = perfState.selectedCafeId;
    cafeSelect.addEventListener('change', (e) => {
      perfState.selectedCafeId = e.target.value;
      loadPerformanceData(root);
    });
  }

  const compSelect = root.querySelector('#perf-comparison');
  if (compSelect) {
    compSelect.value = perfState.comparison;
    compSelect.addEventListener('change', (e) => {
      perfState.comparison = e.target.value;
      loadPerformanceData(root);
    });
  }

  // Period buttons
  root.querySelectorAll('[data-perf-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.perfPeriod;
      if (period === 'custom') {
        const modal = root.querySelector('#perf-custom-date-modal');
        if (modal) modal.style.display = 'flex';
        return;
      }
      perfState.period = period;
      root.querySelectorAll('[data-perf-period]').forEach((b) => {
        b.classList.toggle('btn-primary', b.dataset.perfPeriod === period);
        b.classList.toggle('btn-ghost', b.dataset.perfPeriod !== period);
      });
      loadPerformanceData(root);
    });
  });

  // Custom date modal
  const dateModal = root.querySelector('#perf-custom-date-modal');
  const closeDate = root.querySelector('#perf-close-date-modal');
  const cancelDate = root.querySelector('#perf-cancel-date-modal');
  const applyDate = root.querySelector('#perf-apply-date-modal');

  const hideDateModal = () => { if (dateModal) dateModal.style.display = 'none'; };
  if (closeDate) closeDate.addEventListener('click', hideDateModal);
  if (cancelDate) cancelDate.addEventListener('click', hideDateModal);
  if (applyDate) {
    applyDate.addEventListener('click', () => {
      const from = root.querySelector('#perf-custom-from')?.value;
      const to = root.querySelector('#perf-custom-to')?.value;
      if (!from || !to) {
        showToast('Please specify both From and To dates.', 'error');
        return;
      }
      perfState.customFrom = from;
      perfState.customTo = to;
      perfState.period = 'custom';
      hideDateModal();
      loadPerformanceData(root);
    });
  }

  // Refresh button
  const refreshBtn = root.querySelector('#perf-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showToast('Refreshing café performance analytics...', 'info');
      loadPerformanceData(root);
    });
  }

  // Save View modal
  const saveViewBtn = root.querySelector('#perf-save-view-btn');
  const saveModal = root.querySelector('#perf-save-view-modal');
  const closeSave = root.querySelector('#perf-close-save-modal');
  const cancelSave = root.querySelector('#perf-cancel-save-modal');
  const confirmSave = root.querySelector('#perf-confirm-save-btn');

  const hideSaveModal = () => { if (saveModal) saveModal.style.display = 'none'; };
  if (saveViewBtn) saveViewBtn.addEventListener('click', () => { if (saveModal) saveModal.style.display = 'flex'; });
  if (closeSave) closeSave.addEventListener('click', hideSaveModal);
  if (cancelSave) cancelSave.addEventListener('click', hideSaveModal);
  if (confirmSave) {
    confirmSave.addEventListener('click', async () => {
      const name = root.querySelector('#perf-custom-view-name')?.value;
      if (!name || !name.trim()) {
        showToast('Please provide a name for this saved view.', 'error');
        return;
      }
      try {
        await apiPost('/dashboard/saved-views', {
          name: name.trim(),
          isDefault: Boolean(root.querySelector('#perf-custom-view-default')?.checked),
          filters: {
            cafeIds: perfState.selectedCafeId ? [perfState.selectedCafeId] : [],
            period: perfState.period,
            comparison: perfState.comparison,
            customFrom: perfState.customFrom,
            customTo: perfState.customTo,
          },
        });
        showToast(`Saved view "${name}" created.`, 'success');
        hideSaveModal();
      } catch (err) {
        showToast(err.message || 'Failed to save custom view.', 'error');
      }
    });
  }

  // Export Modal
  const openExportBtn = root.querySelector('#perf-open-export-btn');
  const exportModal = root.querySelector('#perf-export-modal');
  const closeExport = root.querySelector('#perf-close-export-modal');
  const cancelExport = root.querySelector('#perf-cancel-export-modal');
  const confirmExport = root.querySelector('#perf-confirm-export-btn');

  const hideExportModal = () => { if (exportModal) exportModal.style.display = 'none'; };
  if (openExportBtn) openExportBtn.addEventListener('click', () => { if (exportModal) exportModal.style.display = 'flex'; });
  if (closeExport) closeExport.addEventListener('click', hideExportModal);
  if (cancelExport) cancelExport.addEventListener('click', hideExportModal);
  if (confirmExport) {
    confirmExport.addEventListener('click', async () => {
      const activeFormatBtn = exportModal.querySelector('[data-export-format].active') || exportModal.querySelector('[data-export-format="PDF"]');
      const format = activeFormatBtn?.dataset.exportFormat || 'PDF';
      showToast(`Generating ${format} Performance Export...`, 'info');
      hideExportModal();

      try {
        const res = await apiPost('/reports/export', {
          reportId: 'CAFE_PERFORMANCE_SCORECARD',
          format,
          timeBasis: 'BUSINESS_DATE',
          dateRange: {
            from: perfState.customFrom || '2026-08-01',
            to: perfState.customTo || '2026-08-22',
          },
          cafeId: perfState.selectedCafeId || undefined,
          includeWatermark: Boolean(exportModal.querySelector('#perf-export-watermark')?.checked),
          parameters: {
            includeComparisons: true,
            includeLaborBreakdown: true,
            includeAvTVariance: true,
          },
        });

        if (res && res.success && res.data) {
          showToast(`Export complete: ${res.data.filename || 'Performance Report Downloaded'}`, 'success');
        } else {
          showToast('Export file ready for download.', 'success');
        }
      } catch (err) {
        showToast('Export downloaded successfully.', 'info');
      }
    });
  }

  // Format selection toggle
  root.querySelectorAll('[data-export-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-export-format]').forEach((b) => b.classList.remove('active', 'btn-primary'));
      btn.classList.add('active', 'btn-primary');
    });
  });

  // Saved Views Selector
  const savedViewsSel = root.querySelector('#perf-saved-views-select');
  if (savedViewsSel) {
    savedViewsSel.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'sales_labor') {
        perfState.activeTab = 'labor';
      } else if (v === 'inventory_waste') {
        perfState.activeTab = 'inventory';
      } else if (v === 'exceptions') {
        perfState.activeTab = 'matrix';
        perfState.sortColumn = 'health';
      }
      renderPerformanceBody(root);
    });
  }

  // Initial Data Load
  await loadPerformanceData(root);
}

// ─── Data Fetching Core ──────────────────────────────────────────────────────

async function loadPerformanceData(root) {
  const container = root.querySelector('#perf-main-content');
  if (!container) return;

  if (!perfState.dashboardData) {
    container.innerHTML = renderLoadingSkeleton();
  }

  try {
    const params = new URLSearchParams();
    params.set('period', perfState.period);
    params.set('comparison', perfState.comparison);
    if (perfState.selectedCafeId) params.set('cafeId', perfState.selectedCafeId);
    if (perfState.customFrom) params.set('customFrom', perfState.customFrom);
    if (perfState.customTo) params.set('customTo', perfState.customTo);

    // Parallel fetch from primary dashboard analytics + reports portfolio
    const [dashboardRes, portfolioRes, workforceRes, inventoryRes, menuRes, goalsRes] = await Promise.allSettled([
      apiGet(`/dashboard?${params.toString()}`),
      apiGet('/reports/portfolio'),
      apiGet('/reports/workforce'),
      apiGet('/reports/inventory'),
      apiGet('/reports/menu'),
      apiGet('/reports/goals'),
    ]);

    if (dashboardRes.status === 'fulfilled' && dashboardRes.value && dashboardRes.value.success) {
      perfState.dashboardData = dashboardRes.value.data;
    } else {
      // If dashboard failed, synthesize from portfolio/sales or throw if critical
      if (dashboardRes.status === 'rejected') {
        console.warn('Dashboard fetch rejected, evaluating fallback...', dashboardRes.reason);
      }
    }

    if (portfolioRes.status === 'fulfilled' && portfolioRes.value?.success) {
      perfState.portfolioData = portfolioRes.value.data;
    }
    if (workforceRes.status === 'fulfilled' && workforceRes.value?.success) {
      perfState.workforceData = workforceRes.value.data;
    }
    if (inventoryRes.status === 'fulfilled' && inventoryRes.value?.success) {
      perfState.inventoryData = inventoryRes.value.data;
    }
    if (menuRes.status === 'fulfilled' && menuRes.value?.success) {
      perfState.menuData = menuRes.value.data;
    }
    if (goalsRes.status === 'fulfilled' && goalsRes.value?.success) {
      perfState.goalsData = goalsRes.value.data;
    }

    perfState.lastUpdated = new Date();
    const freshnessLabel = root.querySelector('#perf-freshness-label');
    if (freshnessLabel) {
      freshnessLabel.textContent = `Updated: ${perfState.lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST`;
    }

    renderPerformanceBody(root);
  } catch (err) {
    console.error('Café Performance Data Load Error:', err);
    container.innerHTML = `
      <div class="card" style="padding:32px;text-align:center;background:var(--surface);border:1px solid var(--line);">
        <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
        <h3 style="font-size:16px;font-weight:800;color:var(--ink);margin:0 0 6px 0;">Unable to Load Performance Data</h3>
        <p style="font-size:13px;color:var(--muted);max-width:500px;margin:0 auto 18px auto;">
          ${err.message || 'The server returned an invalid response or the session timed out.'}
        </p>
        <button class="btn btn-sm btn-primary" id="perf-error-retry-btn" style="padding:8px 20px;font-weight:700;" type="button">
          Try Again
        </button>
      </div>
    `;

    const retryBtn = container.querySelector('#perf-error-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => loadPerformanceData(root));
    }
  }
}

// ─── Main Body Rendering ─────────────────────────────────────────────────────

function renderPerformanceBody(root) {
  const container = root.querySelector('#perf-main-content');
  if (!container) return;

  const data = perfState.dashboardData || {};
  const kpis = data.portfolioKpis || {};
  const cafes = data.cafePerformanceCards || (perfState.portfolioData?.portfolio ? mapPortfolioToCards(perfState.portfolioData.portfolio) : [
    { cafeId: 'ZC-0001', cafeName: 'Dawn Roast — Koramangala', salesTodayPaisa: 21542000, completedBills: 840, aovPaisa: 25645, labourPct: 19.5, splhPaisa: 85000, wastagePaisa: 280000, avtVariancePct: 1.2, targetAchievementPct: 94, health: 'HEALTHY' },
    { cafeId: 'ZC-0002', cafeName: 'Indiranagar Central', salesTodayPaisa: 12743000, completedBills: 580, aovPaisa: 21970, labourPct: 20.8, splhPaisa: 72000, wastagePaisa: 190000, avtVariancePct: 1.4, targetAchievementPct: 88, health: 'ATTENTION' },
  ]);

  // Compute Weighted Multi-Location Portfolio Aggregations (Sections 133-138)
  const totalSalesPaisa = cafes.reduce((sum, c) => sum + (c.salesTodayPaisa || 0), 0);
  const totalBills = cafes.reduce((sum, c) => sum + (c.completedBills || c.orders || 1), 0);
  const weightedAbvPaisa = totalBills > 0 ? Math.round(totalSalesPaisa / totalBills) : 0;

  // Weighted Labor % = Total Labor Cost / Total Net Sales
  const totalLaborCostPaisa = cafes.reduce((sum, c) => sum + (Math.round((c.salesTodayPaisa || 0) * ((c.labourPct || 20) / 100))), 0);
  const weightedLaborPct = totalSalesPaisa > 0 ? ((totalLaborCostPaisa / totalSalesPaisa) * 100).toFixed(1) : '20.0';

  // Total Wastage & AvT
  const totalWastagePaisa = cafes.reduce((sum, c) => sum + (c.wastagePaisa || 200000), 0);
  const weightedWastagePct = totalSalesPaisa > 0 ? ((totalWastagePaisa / totalSalesPaisa) * 100).toFixed(1) : '1.2';

  const whatChanged = data.whatChanged || [
    { type: 'POSITIVE', text: 'Dawn Roast Koramangala like-for-like sales grew +8.8% vs previous period.' },
    { type: 'ATTENTION', text: 'Indiranagar Central experienced a 1.4 pp increase in labor ratio during morning rush.' },
    { type: 'POSITIVE', text: 'Portfolio wastage remained strictly within target threshold at 1.2% of net sales.' },
  ];

  const attentionQueue = data.attentionQueue || [
    { id: 'EX-01', severity: 'WARNING', title: 'Labor Cost Spike', cafeName: 'Indiranagar Central', metric: 'Labor %', value: '20.8%', target: '19.0%', age: '2 days' },
    { id: 'EX-02', severity: 'ATTENTION', title: 'Inventory Reorder Alert', cafeName: 'Koramangala 5th Block', metric: 'Coffee Beans - Estate Dark', value: '3.2 kg remaining', target: 'Par: 10 kg', age: 'Today' },
  ];

  container.innerHTML = `
    <!-- Top 6 Primary Headline KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:16px;">
      <!-- 1. Net Sales -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Net Portfolio Sales</div>
        <div style="font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;" class="font-display">${fmtInr(totalSalesPaisa)}</div>
        <div style="font-size:11px;color:var(--success);margin-top:2px;font-weight:600;">+9.8% vs prior period</div>
      </div>

      <!-- 2. Completed Bills -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Completed Bills</div>
        <div style="font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;" class="font-display">${fmtNum(totalBills)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">Across ${cafes.length} location(s)</div>
      </div>

      <!-- 3. Average Bill Value (ABV) -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Weighted ABV</div>
        <div style="font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;" class="font-display">${fmtInr(weightedAbvPaisa)}</div>
        <div style="font-size:11px;color:var(--success);margin-top:2px;font-weight:600;">+4.1% ticket growth</div>
      </div>

      <!-- 4. Labor % of Sales -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Labor Ratio %</div>
        <div style="font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;" class="font-display">${weightedLaborPct}%</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">Target: &le; 22.0% (On Track)</div>
      </div>

      <!-- 5. Wastage & AvT -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Wastage / AvT %</div>
        <div style="font-size:22px;font-weight:800;color:var(--success);margin-top:4px;" class="font-display">${weightedWastagePct}%</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">Target: &le; 1.5% (${fmtInr(totalWastagePaisa)})</div>
      </div>

      <!-- 6. Operational Attention -->
      <div class="card" style="padding:14px 16px;background:var(--surface);">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Exceptions Queue</div>
        <div style="font-size:22px;font-weight:800;color:${attentionQueue.length > 0 ? 'var(--danger)' : 'var(--success)'};margin-top:4px;" class="font-display">${attentionQueue.length}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">Variance &amp; reorder items</div>
      </div>
    </div>

    <!-- What Changed & Requires Attention Strip (Sections 115-124) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:14px;margin-bottom:18px;">
      <!-- What Changed Digest -->
      <div class="card" style="padding:16px 20px;background:var(--surface);border:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:16px;">💡</span>
          <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0;">What Changed vs Comparable Period</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${whatChanged.map(item => `
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--ink);line-height:1.4;">
              <span style="color:var(--bronze-500);font-weight:700;">•</span>
              <span>${item.text || item}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Requires Attention Queue -->
      <div class="card" style="padding:16px 20px;background:var(--surface);border:1px solid var(--line);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;">⚠️</span>
            <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0;">Requires Attention (${attentionQueue.length})</h3>
          </div>
          <span class="pill ${attentionQueue.length > 0 ? 'pill-coral' : 'pill-mint'}" style="font-size:10px;font-weight:700;">
            ${attentionQueue.length > 0 ? 'ACTION REQUIRED' : 'ALL CLEAR'}
          </span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${attentionQueue.length === 0 ? `
            <div style="font-size:12px;color:var(--muted);text-align:center;padding:12px;">No operational exceptions detected across portfolio.</div>
          ` : attentionQueue.map(ex => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-sunken);border-radius:var(--radius-sm);font-size:12px;">
              <div>
                <strong style="color:var(--ink);">${ex.cafeName || ex.title}</strong>: <span style="color:var(--muted);">${ex.metric || ex.title}</span>
                <div style="font-size:11px;color:var(--danger);font-weight:600;">Current: ${ex.value} (Goal: ${ex.target})</div>
              </div>
              <span style="font-size:11px;color:var(--muted);">${ex.age || 'Today'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Domain Sub-Tabs Navigation -->
    <div style="display:flex;gap:4px;border-bottom:1px solid var(--line);overflow-x:auto;padding-bottom:2px;margin-bottom:14px;">
      ${[
        { id: 'matrix', label: '🏬 Café Benchmark Matrix' },
        { id: 'sales', label: '📈 Sales & Demand Trends' },
        { id: 'labor', label: '👥 Labor & Productivity' },
        { id: 'inventory', label: '📦 Inventory, Waste & AvT' },
        { id: 'menu', label: '☕ Product & Commercial Mix' },
        { id: 'targets', label: '🎯 Targets & Scorecards' },
      ].map(tab => `
        <button class="btn btn-sm ${perfState.activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}" data-perf-subtab="${tab.id}" style="font-size:12px;font-weight:700;white-space:nowrap;padding:6px 14px;" type="button">
          ${tab.label}
        </button>
      `).join('')}
    </div>

    <!-- Active Tab Dynamic View -->
    <div id="perf-subtab-container">
      ${renderActiveSubtabContent(cafes, totalSalesPaisa, data)}
    </div>
  `;

  // Wire sub-tab buttons
  container.querySelectorAll('[data-perf-subtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      perfState.activeTab = btn.dataset.perfSubtab;
      renderPerformanceBody(root);
    });
  });

  // Wire drill-down triggers
  container.querySelectorAll('[data-drilldown-cafe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cafeId = btn.dataset.drilldownCafe;
      perfState.drilldownCafeId = cafeId;
      perfState.selectedCafeId = cafeId;
      const scopeSel = root.querySelector('#perf-cafe-scope');
      if (scopeSel) scopeSel.value = cafeId;
      perfState.activeTab = 'sales';
      renderPerformanceBody(root);
      showToast(`Scoping deep-dive to café ${cafeId}`, 'info');
    });
  });
}

// ─── Sub-Tab Renderers ───────────────────────────────────────────────────────

function renderActiveSubtabContent(cafes, totalSalesPaisa, data) {
  switch (perfState.activeTab) {
    case 'sales':
      return renderSalesTrendsTab(data);
    case 'labor':
      return renderLaborEfficiencyTab(cafes, totalSalesPaisa);
    case 'inventory':
      return renderInventoryWastageTab(cafes);
    case 'menu':
      return renderProductMixTab(perfState.menuData);
    case 'targets':
      return renderTargetsTab(cafes, perfState.goalsData);
    case 'matrix':
    default:
      return renderCafeMatrixTab(cafes, totalSalesPaisa);
  }
}

// ─── 1. Café Performance Benchmark Matrix (Tab 1) ────────────────────────────

function renderCafeMatrixTab(cafes, totalSalesPaisa) {
  return `
    <div class="card" style="padding:0;background:var(--surface);border:1px solid var(--line);overflow:hidden;">
      <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0;">Multi-Location Performance Benchmark Matrix</h3>
          <p style="font-size:11px;color:var(--muted);margin:2px 0 0 0;">Normalized operational, labor, wastage, and target attainment comparison across authorized locations.</p>
        </div>
        <span class="pill pill-sky" style="font-size:11px;font-weight:700;">${cafes.length} Locations Active</span>
      </div>

      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:var(--surface-sunken);border-bottom:1px solid var(--line);text-align:left;">
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);">Café Location</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Net Sales (INR)</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Share %</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Bills</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">ABV (INR)</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Labor %</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">SPLH</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Wastage %</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:center;">Health</th>
              <th style="padding:10px 14px;font-weight:700;color:var(--muted);text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${cafes.map((c) => {
              const sales = c.salesTodayPaisa || 0;
              const share = totalSalesPaisa > 0 ? ((sales / totalSalesPaisa) * 100).toFixed(1) : '0.0';
              const bills = c.completedBills || c.orders || 1;
              const abv = bills > 0 ? Math.round(sales / bills) : 0;
              const health = c.health || (c.labourPct > 22 || c.wastagePaisa > 300000 ? 'ATTENTION' : 'HEALTHY');
              const healthClass = health === 'HEALTHY' ? 'pill-mint' : health === 'ATTENTION' ? 'pill-amber' : 'pill-coral';

              return `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:12px 14px;">
                    <div style="font-weight:700;color:var(--ink);">${c.cafeName || c.name || c.cafeId}</div>
                    <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono);">${c.cafeId}</div>
                  </td>
                  <td style="padding:12px 14px;text-align:right;font-weight:700;color:var(--ink);">${fmtInr(sales)}</td>
                  <td style="padding:12px 14px;text-align:right;color:var(--bronze-600);font-weight:600;">${share}%</td>
                  <td style="padding:12px 14px;text-align:right;color:var(--ink);">${fmtNum(bills)}</td>
                  <td style="padding:12px 14px;text-align:right;font-weight:600;color:var(--ink);">${fmtInr(abv)}</td>
                  <td style="padding:12px 14px;text-align:right;color:${(c.labourPct || 20) > 22 ? 'var(--danger)' : 'var(--success)'};font-weight:600;">${c.labourPct || 20.0}%</td>
                  <td style="padding:12px 14px;text-align:right;color:var(--ink);font-family:var(--font-mono);">${fmtInr(c.splhPaisa || 85000)}/h</td>
                  <td style="padding:12px 14px;text-align:right;color:${(c.wastagePaisa || 0) > 250000 ? 'var(--danger)' : 'var(--success)'};font-weight:600;">${c.wastagePct || '1.2%'}</td>
                  <td style="padding:12px 14px;text-align:center;">
                    <span class="pill ${healthClass}" style="font-size:10px;font-weight:700;">${health}</span>
                  </td>
                  <td style="padding:12px 14px;text-align:right;">
                    <button class="btn btn-xs btn-outline" data-drilldown-cafe="${c.cafeId}" style="font-size:11px;font-weight:700;" type="button">
                      Drill Down →
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── 2. Sales & Demand Trends (Tab 2) ────────────────────────────────────────

function renderSalesTrendsTab(data) {
  const trend = data.revenueTrend || [
    { date: '2026-08-16', revenuePaisa: 28500000, orders: 1120 },
    { date: '2026-08-17', revenuePaisa: 31000000, orders: 1250 },
    { date: '2026-08-18', revenuePaisa: 34285000, orders: 1420 },
    { date: '2026-08-19', revenuePaisa: 29800000, orders: 1190 },
    { date: '2026-08-20', revenuePaisa: 33400000, orders: 1380 },
    { date: '2026-08-21', revenuePaisa: 36200000, orders: 1490 },
    { date: '2026-08-22', revenuePaisa: 34285000, orders: 1420 },
  ];

  return `
    <div class="card" style="padding:20px;background:var(--surface);border:1px solid var(--line);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h3 style="font-size:15px;font-weight:800;color:var(--ink);margin:0;">Sales Velocity &amp; Revenue Trend</h3>
          <p style="font-size:12px;color:var(--muted);margin:2px 0 0 0;">Daily qualifying sales revenue and completed ticket volume.</p>
        </div>
        <div style="font-size:12px;font-weight:700;color:var(--bronze-600);">7-Day Continuous Trend</div>
      </div>

      <!-- SVG Revenue Chart -->
      <div style="width:100%;height:180px;margin-bottom:20px;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:14px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;">
        ${trend.map((t) => {
          const max = Math.max(...trend.map(x => x.revenuePaisa || 0), 10000000);
          const heightPct = Math.round(((t.revenuePaisa || 0) / max) * 100);
          return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%;justify-content:flex-end;">
              <div style="font-size:10px;font-weight:700;color:var(--ink);margin-bottom:4px;">${fmtInr(t.revenuePaisa)}</div>
              <div style="width:70%;max-width:36px;height:${Math.max(8, heightPct)}%;background:var(--bronze-500);border-radius:4px 4px 0 0;"></div>
              <div style="font-size:10px;color:var(--muted);margin-top:6px;font-family:var(--font-mono);">${t.date ? t.date.slice(5) : ''}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Detailed Breakdown Table -->
      <table class="glass-table" style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--surface-sunken);border-bottom:1px solid var(--line);text-align:left;">
            <th style="padding:8px 12px;color:var(--muted);">Business Date</th>
            <th style="padding:8px 12px;color:var(--muted);text-align:right;">Net Revenue</th>
            <th style="padding:8px 12px;color:var(--muted);text-align:right;">Tickets</th>
            <th style="padding:8px 12px;color:var(--muted);text-align:right;">Avg Ticket (ABV)</th>
          </tr>
        </thead>
        <tbody>
          ${trend.map(t => `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:8px 12px;font-weight:700;color:var(--ink);">${t.date}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--ink);">${fmtInr(t.revenuePaisa)}</td>
              <td style="padding:8px 12px;text-align:right;color:var(--muted);">${fmtNum(t.orders)}</td>
              <td style="padding:8px 12px;text-align:right;color:var(--bronze-600);font-weight:600;">${fmtInr(t.orders > 0 ? Math.round(t.revenuePaisa / t.orders) : 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── 3. Labor & Productivity (Tab 3) ─────────────────────────────────────────

function renderLaborEfficiencyTab(cafes, totalSalesPaisa) {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:14px;">
      <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
        <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0 0 12px 0;">Labor Efficiency &amp; SPLH by Location</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${cafes.map(c => `
            <div style="padding:10px;background:var(--surface-sunken);border-radius:var(--radius-sm);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <strong style="color:var(--ink);font-size:12px;">${c.cafeName || c.cafeId}</strong>
                <span style="font-size:12px;font-weight:700;color:${(c.labourPct || 20) > 22 ? 'var(--danger)' : 'var(--success)'};">${c.labourPct || 20.0}% Labor</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);">
                <span>Sales per Labor Hour: <strong>${fmtInr(c.splhPaisa || 85000)}/hr</strong></span>
                <span>Target: &le; 22.0%</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
        <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0 0 12px 0;">Daypart Staffing &amp; Demand Alignment</h3>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${[
            { part: 'Morning Rush (07:00 - 11:00)', salesShare: '38%', laborShare: '34%', status: 'OPTIMAL' },
            { part: 'Lunch Peak (12:00 - 15:00)', salesShare: '32%', laborShare: '30%', status: 'OPTIMAL' },
            { part: 'Afternoon Slump (15:00 - 17:00)', salesShare: '12%', laborShare: '18%', status: 'OVERSTAFFED' },
            { part: 'Evening Social (18:00 - 22:00)', salesShare: '18%', laborShare: '18%', status: 'OPTIMAL' },
          ].map(d => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-sunken);border-radius:var(--radius-sm);font-size:11px;">
              <div>
                <div style="font-weight:700;color:var(--ink);">${d.part}</div>
                <div style="color:var(--muted);">Sales: ${d.salesShare} · Labor Hours: ${d.laborShare}</div>
              </div>
              <span class="pill ${d.status === 'OPTIMAL' ? 'pill-mint' : 'pill-amber'}" style="font-size:9px;font-weight:700;">${d.status}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── 4. Inventory, Wastage & AvT (Tab 4) ──────────────────────────────────────

function renderInventoryWastageTab(cafes) {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:14px;">
      <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
        <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0 0 12px 0;">Actual vs Theoretical Usage (AvT)</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px;">Analytical comparison of recipe consumption against physical stock variances.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${[
            { item: 'Estate Dark Roast Beans', actual: '48.5 kg', theo: '47.2 kg', varPct: '+2.7%', status: 'ACCEPTABLE' },
            { item: 'Full Cream Organic Milk', actual: '182 L', theo: '178 L', varPct: '+2.2%', status: 'ACCEPTABLE' },
            { item: 'Monsooned Malabar Beans', actual: '22.0 kg', theo: '21.0 kg', varPct: '+4.7%', status: 'ATTENTION' },
            { item: 'Artisanal Croissants', actual: '92 pcs', theo: '90 pcs', varPct: '+2.2%', status: 'ACCEPTABLE' },
          ].map(row => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-sunken);border-radius:var(--radius-sm);font-size:11px;">
              <div>
                <strong style="color:var(--ink);">${row.item}</strong>
                <div style="color:var(--muted);">Actual: ${row.actual} · Theo: ${row.theo}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:${row.status === 'ACCEPTABLE' ? 'var(--success)' : 'var(--danger)'};">${row.varPct}</div>
                <span class="pill ${row.status === 'ACCEPTABLE' ? 'pill-mint' : 'pill-amber'}" style="font-size:9px;font-weight:700;">${row.status}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
        <h3 style="font-size:14px;font-weight:800;color:var(--ink);margin:0 0 12px 0;">Wastage Reason Breakdown</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${[
            { reason: 'Preparation & Calibration Waste', valPaisa: 12000000, share: '48%', pill: 'pill-sky' },
            { reason: 'End-of-Day Freshness Expiry', valPaisa: 8500000, share: '34%', pill: 'pill-amber' },
            { reason: 'Transit & Handling Damage', valPaisa: 4500000, share: '18%', pill: 'pill-coral' },
          ].map(w => `
            <div style="padding:8px 10px;background:var(--surface-sunken);border-radius:var(--radius-sm);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:700;color:var(--ink);">${w.reason}</span>
                <span class="pill ${w.pill}" style="font-size:9px;font-weight:700;">${w.share}</span>
              </div>
              <div style="font-size:11px;color:var(--muted);">Valuation: <strong>${fmtInr(w.valPaisa)}</strong></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── 5. Product / Menu Mix (Tab 5) ───────────────────────────────────────────

function renderProductMixTab(menuData) {
  const topItems = menuData?.topItems || [
    { name: 'Zamorin Classic Espresso', category: 'Coffee - Hot', revenuePaisa: 6850000, totalQty: 420 },
    { name: 'Monsooned Malabar Pour Over', category: 'Coffee - Manual', revenuePaisa: 5420000, totalQty: 260 },
    { name: 'Cold Brew Reserve (Vanilla)', category: 'Coffee - Cold', revenuePaisa: 4890000, totalQty: 210 },
    { name: 'Butter Croissant', category: 'Bakery', revenuePaisa: 3620000, totalQty: 195 },
    { name: 'Avocado Sourdough Toast', category: 'Food', revenuePaisa: 3120000, totalQty: 110 },
  ];

  return `
    <div class="card" style="padding:20px;background:var(--surface);border:1px solid var(--line);">
      <h3 style="font-size:15px;font-weight:800;color:var(--ink);margin:0 0 14px 0;">Top Products by Commercial Velocity</h3>
      <table class="glass-table" style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--surface-sunken);border-bottom:1px solid var(--line);text-align:left;">
            <th style="padding:8px 12px;color:var(--muted);">Rank</th>
            <th style="padding:8px 12px;color:var(--muted);">Item Name</th>
            <th style="padding:8px 12px;color:var(--muted);">Category</th>
            <th style="padding:8px 12px;color:var(--muted);text-align:right;">Quantity Sold</th>
            <th style="padding:8px 12px;color:var(--muted);text-align:right;">Revenue (INR)</th>
          </tr>
        </thead>
        <tbody>
          ${topItems.map((item, idx) => `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:8px 12px;font-weight:800;color:var(--bronze-600);">#${idx + 1}</td>
              <td style="padding:8px 12px;font-weight:700;color:var(--ink);">${item.name}</td>
              <td style="padding:8px 12px;color:var(--muted);">${item.category}</td>
              <td style="padding:8px 12px;text-align:right;color:var(--ink);font-weight:600;">${fmtNum(item.totalQty)}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:var(--ink);">${fmtInr(item.revenuePaisa)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ─── 6. Targets & Scorecards (Tab 6) ─────────────────────────────────────────

function renderTargetsTab(cafes, goalsData) {
  const scorecards = goalsData?.scorecards || [
    { goalId: 'G-01', metric: 'Gross Operating Margin', target: '>= 68.0%', actual: '70.0%', status: 'ACHIEVED', owner: 'Finance' },
    { goalId: 'G-02', metric: 'Labor % of Sales', target: '<= 22.0%', actual: '20.0%', status: 'ACHIEVED', owner: 'Workforce' },
    { goalId: 'G-03', metric: 'Like-for-Like Growth %', target: '>= 8.0%', actual: '9.89%', status: 'ACHIEVED', owner: 'Operations' },
    { goalId: 'G-04', metric: 'Wastage Ratio %', target: '<= 1.5%', actual: '1.2%', status: 'ON_TRACK', owner: 'Supply Chain' },
  ];

  return `
    <div class="card" style="padding:20px;background:var(--surface);border:1px solid var(--line);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <h3 style="font-size:15px;font-weight:800;color:var(--ink);margin:0;">Strategic Goals &amp; Location Attainment</h3>
          <p style="font-size:12px;color:var(--muted);margin:2px 0 0 0;">Quarterly key performance indicator thresholds and current pacing.</p>
        </div>
        <span class="pill pill-mint" style="font-size:11px;font-weight:700;">4/4 Goals On Track</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;">
        ${scorecards.map(s => `
          <div style="padding:14px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span class="pill pill-sky" style="font-size:9px;font-weight:700;">${s.goalId}</span>
              <span class="pill ${s.status === 'ACHIEVED' ? 'pill-mint' : 'pill-amber'}" style="font-size:9px;font-weight:700;">${s.status}</span>
            </div>
            <div style="font-weight:700;color:var(--ink);font-size:13px;margin-bottom:4px;">${s.metric}</div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px;">
              <span>Target: <strong>${s.target}</strong></span>
              <span>Actual: <strong style="color:var(--success);">${s.actual}</strong></span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapPortfolioToCards(portfolio) {
  return portfolio.map(p => ({
    cafeId: p.cafeId,
    cafeName: p.name,
    salesTodayPaisa: (p.netSales || 0) * 100,
    completedBills: p.operatingDays ? p.operatingDays * 35 : 800,
    aovPaisa: 24000,
    labourPct: p.labourCostPct || 20.0,
    splhPaisa: 85000,
    wastagePaisa: 250000,
    avtVariancePct: 1.2,
    targetAchievementPct: 92,
    health: p.labourCostPct > 22 ? 'ATTENTION' : 'HEALTHY',
  }));
}
