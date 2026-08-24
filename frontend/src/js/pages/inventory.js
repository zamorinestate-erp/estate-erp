// =============================================================================
// PAGE: Inventory & Raw Material Stock — SCR-011 Consolidated Multi-Café Hub
// Global Item Master • Per-Café Stock • Stock Ledger • Receipts • Put-Away • PAR
// Replenishment • Transfers • Lots • Expiry • FEFO • Reservations • Wastage • Counts
// Recall • Recipe Consumption • Valuation • Item 360 • Integrity • Audit
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { state } from "../state.js";
import { showToast, openModal, renderCafeContextStrip, renderChildHeader, renderModuleErrorState } from "../components.js";
import { navigate } from "../router.js";

let activeTab = "overview";
let liveOverview = null;
let selectedCafeFilter = "ALL";
let activeCategoryFilter = "ALL";
let searchQuery = "";
let showLowStockOnly = false;

export function setInventoryActiveTab(tab) {
  activeTab = tab || "overview";
}

function fmtInr(paisa) {
  if (!paisa) return "₹0.00";
  const r = (Number(paisa) / 100).toFixed(2);
  const parts = r.split(".");
  let intPart = parts[0];
  const decPart = parts[1];
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== "") lastThree = "," + lastThree;
  return "₹" + otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + "." + decPart;
}

export function renderInventory(subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  const isMaster = state.user?.role === "MASTER";
  const isCafeAdmin = state.user?.role === "CAFE_ADMIN";

  if (activeTab !== "overview") {
    return `
      <div class="page-enter inventory-page" style="padding-bottom: 60px;">
        <div id="inv-workspace-wrap">
          <div style="display:flex; justify-content:center; padding:40px;">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter inventory-page" style="padding-bottom: 60px;">
      <!-- Top Title Header for Overview -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; flex-wrap:wrap; gap:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h1 class="page-title" style="font-size:24px; font-weight:800; color:var(--ink); margin:0;">Inventory &amp; Raw Material Stock</h1>
            <span class="badge badge-accent" style="font-size:11px; padding:2px 8px; font-weight:700;">SCR-011 MULTI-CAFÉ LEDGER</span>
          </div>
          <p class="page-subtitle" style="font-size:13.5px; color:var(--muted); margin:4px 0 0;">Global item catalogue, per-café stock levels, replenishment PAR, batch lot FEFO, transfers, and food recall containment.</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="btn-refresh-inventory" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Sync Stock
          </button>
        </div>
      </div>

      <!-- Main Workspace Container -->
      <div id="inv-workspace-wrap">
        <div style="display:flex; justify-content:center; padding:40px;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;
}

export async function wireInventory(root, subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  const workspaceWrap = root.querySelector("#inv-workspace-wrap");
  const refreshBtn = root.querySelector("#btn-refresh-inventory");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      showToast("Synchronising inventory ledger...", "info");
      await loadInventoryOverview(workspaceWrap);
    });
  }

  renderCurrentWorkspace(workspaceWrap);
  loadInventoryOverview(workspaceWrap);
}

async function loadInventoryOverview(wrap) {
  try {
    const res = await apiGet("/inventory/overview");
    liveOverview = res || {};
    if (activeTab === "overview") {
      renderOverviewTab(wrap);
    }
  } catch (err) {
    console.warn("Inventory API offline, using dev preview overview:", err.message);
    liveOverview = {
      kpis: {
        totalValuationPaisa: 148500000,
        totalActiveSkus: 52,
        lowStockCount: 4,
        criticalStockCount: 0,
        pendingCountsApproval: 2,
        inTransitQuantity: 18,
        activeRecallsCount: 0
      },
      heatmap: []
    };
    if (activeTab === "overview") {
      renderOverviewTab(wrap);
    }
  }
}

function renderCurrentWorkspace(wrap) {
  if (!wrap) return;

  switch (activeTab) {
    case "stock-by-cafe": renderStockLevelsTab(wrap); break;
    case "global-items": renderGlobalItemsTab(wrap); break;
    case "replenishment": renderReplenishmentTab(wrap); break;
    case "receipts": renderReceiptsTab(wrap); break;
    case "movements": renderMovementsTab(wrap); break;
    case "lots-expiry": renderLotsExpiryTab(wrap); break;
    case "transfers": renderTransfersTab(wrap); break;
    case "reservations": renderReservationsTab(wrap); break;
    case "counts": renderCountsTab(wrap); break;
    case "wastage": renderWastageTab(wrap); break;
    case "consumption-variance": renderConsumptionVarianceTab(wrap); break;
    case "valuation": renderValuationTab(wrap); break;
    case "recalls": renderRecallsTab(wrap); break;
    case "integrity": renderIntegrityTab(wrap); break;
    default: renderOverviewTab(wrap);
  }
}

// ── 1. Overview Tab ──────────────────────────────────────────────────────────
function renderOverviewTab(wrap) {
  const kpis = liveOverview?.kpis || {
    totalValuationPaisa: 148500000,
    totalActiveSkus: 52,
    lowStockCount: 4,
    criticalStockCount: 0,
    pendingCountsApproval: 2,
    inTransitQuantity: 18,
    activeRecallsCount: 0,
  };
  const isCafeAdmin = state.user?.role === "CAFE_ADMIN";

  const invTiles = [
    { id: "stock-by-cafe", icon: "📦", title: "Stock Levels", subtitle: "Multi-café on-hand, reserved & available balances", badge: `${kpis.totalActiveSkus || 0} SKUs`, badgeType: "accent" },
    { id: "global-items", icon: "📋", title: "Global Item Master", subtitle: "Global item catalogue, UOM conversions & specs", badge: "Catalogue", badgeType: "" },
    { id: "replenishment", icon: "📊", title: "Replenishment & PAR", subtitle: "Safety buffers, PAR thresholds & auto-order triggers", badge: `${kpis.lowStockCount || 0} Low`, badgeType: kpis.lowStockCount > 0 ? "warning" : "success" },
    { id: "receipts", icon: "📥", title: "Receipts & Put-Away", subtitle: "Goods receipts from purchase orders & bin put-away", badge: "Live POs", badgeType: "" },
    { id: "movements", icon: "📜", title: "Stock Ledger", subtitle: "Double-entry transaction audit & ledger logs", badge: "Ledger", badgeType: "" },
    { id: "lots-expiry", icon: "⏳", title: "Lots & FEFO Expiry", subtitle: "Batch lot numbers, shelf life tracking & expiry alerts", badge: "FEFO", badgeType: "success" },
    { id: "transfers", icon: "🚚", title: "Inter-Café Transfers", subtitle: "Transfer orders, transit dispatch & branch receipts", badge: `${kpis.inTransitQuantity || 0} In-Transit`, badgeType: "" },
    { id: "reservations", icon: "🔒", title: "Reservations", subtitle: "Earmarked stock allocations & production hold", badge: "Active", badgeType: "" },
    { id: "counts", icon: "⚖️", title: "Cycle Counts", subtitle: "Stocktakes, blind audits & variance reconciliation", badge: `${kpis.pendingCountsApproval || 0} Pending`, badgeType: "" },
    { id: "wastage", icon: "🗑️", title: "Wastage & Adjustments", subtitle: "Spoilage logs, preparation loss & damage write-offs", badge: "Logged", badgeType: "" },
    { id: "consumption-variance", icon: "☕", title: "Recipe Variance", subtitle: "Theoretical POS depletion vs physical stock variance", badge: "COGS Mapped", badgeType: "success" },
    { id: "valuation", icon: "💰", title: "Valuation & Reports", subtitle: "Weighted average cost valuations & asset balance", badge: fmtInr(kpis.totalValuationPaisa), badgeType: "success" },
    ...(!isCafeAdmin ? [
      { id: "recalls", icon: "🛡️", title: "Recall & Traceability", subtitle: "Lot containment & food safety quarantine logs", badge: `${kpis.activeRecallsCount || 0} Recalls`, badgeType: kpis.activeRecallsCount > 0 ? "danger" : "success" },
      { id: "integrity", icon: "🔒", title: "Inventory Integrity", subtitle: "Invariant verification & negative stock guards", badge: "Zero Violations", badgeType: "success" },
    ] : []),
  ];

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Inventory &amp; Stock Workspaces</h3>
        <div class="module-tile-grid">
          ${invTiles.map((t) => `
            <button class="module-hub-tile" data-inv-hub-tile="${t.id}" type="button">
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
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Portfolio Valuation</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--color-accent-mint-bright); margin:4px 0;">${fmtInr(kpis.totalValuationPaisa)}</div>
          <div style="font-size:11.5px; color:var(--muted);">${kpis.totalActiveSkus || 0} Active Global SKUs</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Critical Stockouts</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:${kpis.criticalStockCount > 0 ? "var(--danger)" : "var(--ink)"}; margin:4px 0;">${kpis.criticalStockCount || 0}</div>
          <div style="font-size:11.5px; color:var(--muted);">Zero balance items</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Below Reorder (Low)</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--color-accent-gold-bright); margin:4px 0;">${kpis.lowStockCount || 0}</div>
          <div style="font-size:11.5px; color:var(--muted);">Replenishment required</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Stock In-Transit</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--ink); margin:4px 0;">${kpis.inTransitQuantity || 0} units</div>
          <div style="font-size:11.5px; color:var(--muted);">${kpis.activeTransfersCount || 0} transfers active</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Active Food Recalls</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:${kpis.activeRecallsCount > 0 ? "var(--danger)" : "var(--color-accent-mint-bright)"}; margin:4px 0;">${kpis.activeRecallsCount || 0}</div>
          <div style="font-size:11.5px; color:var(--muted);">Quarantined lots</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Stocktake Approvals</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--ink); margin:4px 0;">${kpis.pendingCountsApproval || 0}</div>
          <div style="font-size:11.5px; color:var(--muted);">Awaiting review</div>
        </div>
      </div>

      <!-- Needs Attention & Recent Activity Section -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
        <div class="card card-pad" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md, 12px);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:14px; font-weight:700; color:var(--ink); display:flex; align-items:center; gap:6px;">
              <span>⚡</span> Needs Attention
            </div>
            <span class="badge ${kpis.lowStockCount > 0 ? "badge-warning" : "badge-success"}" style="font-size:10.5px;">${kpis.lowStockCount || 0} ITEMS</span>
          </div>
          <div style="font-size:12.5px; color:var(--muted); line-height:1.5;">
            ${kpis.lowStockCount > 0
              ? `${kpis.lowStockCount} raw material items are below designated PAR buffer. Review automated reorder triggers in Replenishment.`
              : `All café raw materials and packaging buffers are at optimal stocking levels.`}
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-sm btn-ghost" data-goto-tab="replenishment" style="font-size:11.5px; font-weight:700; color:var(--accent); padding:0;">
              Open Replenishment &amp; PAR →
            </button>
          </div>
        </div>

        <div class="card card-pad" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md, 12px);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:14px; font-weight:700; color:var(--ink); display:flex; align-items:center; gap:6px;">
              <span>📜</span> Recent Inventory Activity
            </div>
            <span class="badge badge-accent" style="font-size:10.5px;">LEDGER LIVE</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; color:var(--ink);">
              <span>Goods Receipt Note GRN-2026-088</span>
              <span style="color:var(--muted);">Koramangala (ZC-0001)</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:var(--ink);">
              <span>Inter-Café Dispatch TR-0042</span>
              <span style="color:var(--muted);">Indiranagar (ZC-0002)</span>
            </div>
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-sm btn-ghost" data-goto-tab="movements" style="font-size:11.5px; font-weight:700; color:var(--accent); padding:0;">
              View Full Stock Ledger →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire Hub Tiles
  wrap.querySelectorAll("[data-inv-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate("inventory/" + btn.dataset.invHubTile);
    });
  });

  wrap.querySelectorAll("[data-goto-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate("inventory/" + btn.dataset.gotoTab);
    });
  });
}

// ── 2. Stock Levels by Café ──────────────────────────────────────────────────
async function renderStockLevelsTab(wrap) {
  const isMaster = state.user?.role === "MASTER";
  const cafeId = selectedCafeFilter === "ALL" ? "ZC-0001" : selectedCafeFilter;
  const kpis = liveOverview?.kpis || {};

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Stock Levels",
        childSubtitle: "Per-café on-hand, reserved and available quantities across authorised storage locations.",
        icon: "📦",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-refresh-stock" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Stock
          </button>
        `,
      })}

      <!-- Summary KPI Strip -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Active SKUs</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--ink); margin:4px 0;">${kpis.totalActiveSkus || 52}</div>
          <div style="font-size:11.5px; color:var(--muted);">Global catalogue items</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Low Stock</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--color-accent-gold-bright); margin:4px 0;">${kpis.lowStockCount || 4}</div>
          <div style="font-size:11.5px; color:var(--muted);">Below PAR threshold</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Critical Stockouts</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:${kpis.criticalStockCount > 0 ? "var(--danger)" : "var(--ink)"}; margin:4px 0;">${kpis.criticalStockCount || 0}</div>
          <div style="font-size:11.5px; color:var(--muted);">Zero balance bins</div>
        </div>
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Portfolio Stock Value</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--color-accent-mint-bright); margin:4px 0;">${fmtInr(kpis.totalValuationPaisa || 148500000)}</div>
          <div style="font-size:11.5px; color:var(--muted);">Weighted average cost</div>
        </div>
      </div>

      <!-- Filter/Search Toolbar & Content Card -->
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Café Physical Stock Ledger &amp; Levels</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Café: <strong>${cafeId}</strong> • Real-time ledger balances. Click row for Item 360.</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select id="sel-cafe-stock" class="form-input" style="width:170px; padding:5px 8px; font-size:12.5px;">
              <option value="ZC-0001" ${cafeId === "ZC-0001" ? "selected" : ""}>Koramangala (ZC-0001)</option>
              <option value="ZC-0002" ${cafeId === "ZC-0002" ? "selected" : ""}>Indiranagar (ZC-0002)</option>
            </select>
            <select id="sel-cat-filter" class="form-input" style="width:160px; padding:5px 8px; font-size:12.5px;">
              <option value="ALL">All Categories</option>
              <option value="COFFEE_BEANS" ${activeCategoryFilter === "COFFEE_BEANS" ? "selected" : ""}>Coffee &amp; Raw Beans</option>
              <option value="DAIRY_FRESH" ${activeCategoryFilter === "DAIRY_FRESH" ? "selected" : ""}>Dairy &amp; Fresh</option>
              <option value="SYRUPS_FLAVOURS" ${activeCategoryFilter === "SYRUPS_FLAVOURS" ? "selected" : ""}>Syrups &amp; Flavours</option>
              <option value="PACKAGING_CONSUMABLES" ${activeCategoryFilter === "PACKAGING_CONSUMABLES" ? "selected" : ""}>Packaging &amp; Consumables</option>
            </select>
            <input type="text" id="inp-search-stock" class="form-input" placeholder="Search SKU / Name..." value="${searchQuery}" style="width:160px; padding:5px 8px; font-size:12.5px;">
            <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--ink); cursor:pointer;">
              <input type="checkbox" id="chk-low-stock" ${showLowStockOnly ? "checked" : ""}> Low Stock Only
            </label>
            <button id="btn-quick-adjust" class="btn btn-sm btn-secondary">+ Record Movement</button>
            <button id="btn-internal-move" class="btn btn-sm btn-outline">Internal Move / PAR</button>
          </div>
        </div>

        <div id="stock-levels-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- Multi-Café Stock Availability Heatmap (Moved from Overview) -->
      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:12px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Multi-Café Stock Availability Heatmap</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Unified global catalogue showing per-café physical on-hand quantities across all branches. Click any row for Item 360.</p>
        </div>
        <div id="stock-heatmap-container">
          <!-- Heatmap table -->
        </div>
      </div>
    </div>
  `;

  // Back button and toolbar listeners
  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-refresh-stock")?.addEventListener("click", () => renderStockLevelsTab(wrap));
  wrap.querySelector("#sel-cafe-stock")?.addEventListener("change", (e) => { selectedCafeFilter = e.target.value; renderStockLevelsTab(wrap); });
  wrap.querySelector("#sel-cat-filter")?.addEventListener("change", (e) => { activeCategoryFilter = e.target.value; renderStockLevelsTab(wrap); });
  wrap.querySelector("#inp-search-stock")?.addEventListener("input", (e) => { searchQuery = e.target.value; renderStockLevelsTab(wrap); });
  wrap.querySelector("#chk-low-stock")?.addEventListener("change", (e) => { showLowStockOnly = e.target.checked; renderStockLevelsTab(wrap); });
  wrap.querySelector("#btn-quick-adjust")?.addEventListener("click", () => openRecordMovementModal(wrap, cafeId));
  wrap.querySelector("#btn-internal-move")?.addEventListener("click", () => openInternalLocationMoveModal(wrap, cafeId));

  await loadStockLevelsData(wrap, cafeId);
}

async function loadStockLevelsData(wrap, cafeId) {
  const tableWrap = wrap.querySelector("#stock-levels-table-container");
  const heatmapWrap = wrap.querySelector("#stock-heatmap-container");
  if (!tableWrap) return;

  try {
    const res = await apiGet(`/inventory/cafes/${cafeId}/stock`);
    let stockList = res?.stock || [];

    if (activeCategoryFilter !== "ALL") {
      stockList = stockList.filter((s) => s.category === activeCategoryFilter);
    }
    if (showLowStockOnly) {
      stockList = stockList.filter((s) => s.currentStock <= s.reorderLevel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      stockList = stockList.filter((s) => s.name?.toLowerCase().includes(q) || s.sku?.toLowerCase().includes(q));
    }

    tableWrap.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">SKU / Item</th>
              <th style="padding:8px 10px;">Category</th>
              <th style="padding:8px 10px; text-align:right;">Physical On Hand</th>
              <th style="padding:8px 10px; text-align:right;">Available</th>
              <th style="padding:8px 10px; text-align:right;">Min / PAR / Max</th>
              <th style="padding:8px 10px;">Primary Location</th>
              <th style="padding:8px 10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${stockList.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No matching inventory items stocked.</td></tr>` : ''}
            ${stockList.map((s) => `
              <tr class="clickable-row btn-drill-item360" data-id="${s.itemId}" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px;">
                  <strong style="color:var(--ink);">${s.name}</strong><br>
                  <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${s.sku}</span>
                </td>
                <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${s.category}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:800; font-size:13.5px; color:var(--ink);">${s.currentStock} ${s.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${s.availableStock} ${s.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-size:12px; color:var(--muted);">${s.reorderLevel} / ${s.parLevel || '—'} / ${s.maxLevel || '—'}</td>
                <td style="padding:8px 10px; font-size:12px;">${s.primaryLocation}</td>
                <td style="padding:8px 10px;"><span class="badge ${s.status === "LOW" ? "badge-danger" : "badge-success"}">${s.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    // Render Heatmap in Stock Levels
    const heatmap = liveOverview?.heatmap || [
      { itemId: "ITEM-1001", sku: "SKU-BEANS-01", name: "Single Origin Arabica Beans", baseUnit: "KG", cafes: [{ cafeId: "ZC-0001", onHand: 45, min: 20 }, { cafeId: "ZC-0002", onHand: 38, min: 20 }] },
      { itemId: "ITEM-1002", sku: "SKU-MILK-01", name: "Farm Fresh Whole Milk 1L", baseUnit: "LTR", cafes: [{ cafeId: "ZC-0001", onHand: 60, min: 30 }, { cafeId: "ZC-0002", onHand: 12, min: 25 }] },
      { itemId: "ITEM-1003", sku: "SKU-SYRUP-01", name: "Vanilla Bean Artisan Syrup 750ml", baseUnit: "BTL", cafes: [{ cafeId: "ZC-0001", onHand: 14, min: 5 }, { cafeId: "ZC-0002", onHand: 8, min: 5 }] },
      { itemId: "ITEM-1004", sku: "SKU-CUP-01", name: "Kraft 12oz Hot Cups (50pk)", baseUnit: "SLV", cafes: [{ cafeId: "ZC-0001", onHand: 25, min: 10 }, { cafeId: "ZC-0002", onHand: 2, min: 10 }] },
    ];

    if (heatmapWrap) {
      heatmapWrap.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">SKU &amp; Item Name</th>
                <th style="padding:8px 10px;">UOM</th>
                <th style="padding:8px 10px; text-align:center;">Koramangala (ZC-0001)</th>
                <th style="padding:8px 10px; text-align:center;">Indiranagar (ZC-0002)</th>
                <th style="padding:8px 10px; text-align:right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${heatmap.map((h) => {
                const c1 = h.cafes?.[0];
                const c2 = h.cafes?.[1];
                return `
                  <tr class="clickable-row btn-drill-item360" data-id="${h.itemId}" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:8px 10px;">
                      <strong style="color:var(--ink);">${h.name}</strong><br>
                      <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${h.sku}</span>
                    </td>
                    <td style="padding:8px 10px; text-transform:uppercase; font-size:12px;">${h.baseUnit}</td>
                    <td style="padding:8px 10px; text-align:center; font-weight:700; color:${(c1?.onHand || 0) <= (c1?.min || 0) ? "var(--danger)" : "var(--color-accent-mint-bright)"};">
                      ${c1?.onHand || 0} ${h.baseUnit}
                    </td>
                    <td style="padding:8px 10px; text-align:center; font-weight:700; color:${(c2?.onHand || 0) <= (c2?.min || 0) ? "var(--danger)" : "var(--color-accent-mint-bright)"};">
                      ${c2?.onHand || 0} ${h.baseUnit}
                    </td>
                    <td style="padding:8px 10px; text-align:right;">
                      <span class="badge ${((c1?.onHand || 0) <= (c1?.min || 0) || (c2?.onHand || 0) <= (c2?.min || 0)) ? "badge-warning" : "badge-success"}">
                        ${((c1?.onHand || 0) <= (c1?.min || 0) || (c2?.onHand || 0) <= (c2?.min || 0)) ? "LOW STOCK" : "OPTIMAL"}
                      </span>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    wireItem360Clicks(wrap);
  } catch (err) {
    console.warn("Stock Levels API request failed:", err);
    tableWrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Stock Levels",
      message: "The café stock ledger could not be retrieved from the server.",
      retryActionId: "btn-retry-stock-data",
      retryLabel: "Retry Loading Stock",
    });
    tableWrap.querySelector("#btn-retry-stock-data")?.addEventListener("click", () => loadStockLevelsData(wrap, cafeId));
    tableWrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 3. Global Item Master ────────────────────────────────────────────────────
async function renderGlobalItemsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Global Item Master",
        childSubtitle: "Global item catalogue, UOM conversions, storage specs, allergens and yields.",
        icon: "📋",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-tab-new-item" class="btn btn-primary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            + Add Global Item
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Global Inventory Item Catalogue</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Unified item master automatically provisioned across all cafés. Click row for Item 360.</p>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="inp-search-global" class="form-input" placeholder="Search SKU / Name..." value="${searchQuery}" style="width:180px; padding:5px 8px; font-size:12.5px;">
          </div>
        </div>

        <div id="global-items-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-tab-new-item")?.addEventListener("click", () => openAddGlobalItemModal(wrap));
  wrap.querySelector("#inp-search-global")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    loadGlobalItemsData(wrap);
  });

  await loadGlobalItemsData(wrap);
}

const DEFAULT_GLOBAL_ITEMS = [
  { itemId: "ITEM-1001", sku: "SKU-BEANS-01", name: "Single Origin Arabica Beans", category: "Coffee Beans", baseUnit: "KG", criticality: "CRITICAL", lotControl: true, shelfLifeDays: 90, unitCostPaisa: 85000, status: "ACTIVE" },
  { itemId: "ITEM-1002", sku: "SKU-MILK-01", name: "Farm Fresh Whole Milk 1L", category: "Dairy & Milks", baseUnit: "LTR", criticality: "CRITICAL", lotControl: true, shelfLifeDays: 5, unitCostPaisa: 6500, status: "ACTIVE" },
  { itemId: "ITEM-1003", sku: "SKU-OAT-01", name: "Barista Edition Oat Milk 1L", category: "Dairy & Milks", baseUnit: "LTR", criticality: "STANDARD", lotControl: true, shelfLifeDays: 180, unitCostPaisa: 24000, status: "ACTIVE" },
  { itemId: "ITEM-1004", sku: "SKU-SYRUP-01", name: "Vanilla Bean Artisan Syrup 750ml", category: "Syrups & Flavours", baseUnit: "BTL", criticality: "STANDARD", lotControl: true, shelfLifeDays: 365, unitCostPaisa: 68000, status: "ACTIVE" },
  { itemId: "ITEM-1005", sku: "SKU-CUP-01", name: "Kraft 12oz Hot Cups (50pk)", category: "Packaging", baseUnit: "SLV", criticality: "STANDARD", lotControl: false, shelfLifeDays: 730, unitCostPaisa: 32000, status: "ACTIVE" },
  { itemId: "ITEM-1006", sku: "SKU-MATCHA-01", name: "Uji Ceremonial Matcha Powder 500g", category: "Teas & Powders", baseUnit: "TIN", criticality: "STANDARD", lotControl: true, shelfLifeDays: 180, unitCostPaisa: 220000, status: "ACTIVE" },
];

async function loadGlobalItemsData(wrap) {
  const container = wrap.querySelector("#global-items-table-container");
  if (!container) return;

  let items = [];
  try {
    const res = await apiGet("/inventory/items");
    items = res?.items || DEFAULT_GLOBAL_ITEMS;
  } catch (err) {
    console.warn("Global items API offline, using fallback catalogue:", err);
    items = DEFAULT_GLOBAL_ITEMS;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    items = items.filter((i) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
            <th style="padding:8px 10px;">SKU</th>
            <th style="padding:8px 10px;">Item Name</th>
            <th style="padding:8px 10px;">Category</th>
            <th style="padding:8px 10px;">Base UOM</th>
            <th style="padding:8px 10px;">Criticality</th>
            <th style="padding:8px 10px;">Lot / Expiry</th>
            <th style="padding:8px 10px;">Unit Cost</th>
            <th style="padding:8px 10px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--muted);">No global items match search.</td></tr>` : ''}
          ${items.map((i) => `
            <tr class="clickable-row btn-drill-item360" data-id="${i.itemId}" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
              <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--color-accent-gold-bright);">${i.sku}</td>
              <td style="padding:8px 10px; font-weight:600; color:var(--ink);">${i.name}</td>
              <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${i.category}</td>
              <td style="padding:8px 10px; text-transform:uppercase; font-size:12px;">${i.baseUnit}</td>
              <td style="padding:8px 10px;"><span class="badge ${i.criticality === "CRITICAL" ? "badge-danger" : "badge-neutral"}">${i.criticality}</span></td>
              <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${i.lotControl ? 'Lot Tracked' : 'No Lot'} • ${i.shelfLifeDays}D Shelf</td>
              <td style="padding:8px 10px; font-weight:700;">${fmtInr(i.unitCostPaisa)}</td>
              <td style="padding:8px 10px;"><span class="badge ${i.status === "ACTIVE" ? "badge-success" : "badge-warning"}">${i.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  wireItem360Clicks(wrap);
}

// ── 4. Replenishment & PAR ───────────────────────────────────────────────────
async function renderReplenishmentTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Replenishment & PAR",
        childSubtitle: "Safety buffers, lead times, min/max thresholds and automated purchase triggers.",
        icon: "📊",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-refresh-replenishment" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Recalculate PAR
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Replenishment Recommendations &amp; PAR Control</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Automatic stockout calculations considering min thresholds, open POs, and in-transit transfers.</p>
        </div>

        <div id="replenishment-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-refresh-replenishment")?.addEventListener("click", () => renderReplenishmentTab(wrap));

  await loadReplenishmentData(wrap);
}

async function loadReplenishmentData(wrap) {
  const container = wrap.querySelector("#replenishment-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/replenishment/recommendations");
    const recs = res?.recommendations || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Item &amp; SKU</th>
              <th style="padding:8px 10px;">Café</th>
              <th style="padding:8px 10px; text-align:right;">Current Stock</th>
              <th style="padding:8px 10px; text-align:right;">Min / Target PAR</th>
              <th style="padding:8px 10px; text-align:right;">In-Transit</th>
              <th style="padding:8px 10px; text-align:right;">Suggested Order</th>
              <th style="padding:8px 10px;">Recommended Source</th>
            </tr>
          </thead>
          <tbody>
            ${recs.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--color-accent-mint-bright);">All café inventory levels are optimal. Zero replenishment needed.</td></tr>` : ''}
            ${recs.map((r) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px;"><strong>${r.name}</strong><br><span style="font-size:11.5px; font-family:monospace; color:var(--muted);">${r.sku}</span></td>
                <td style="padding:8px 10px;">${r.cafeId}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--danger);">${r.currentStock} ${r.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-size:12px; color:var(--muted);">${r.min} / ${r.par}</td>
                <td style="padding:8px 10px; text-align:right; color:var(--muted);">${r.inTransit}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:800; font-size:13.5px; color:var(--color-accent-mint-bright);">${r.suggestedQty} ${r.baseUnit}</td>
                <td style="padding:8px 10px;"><span class="badge badge-accent">${r.suggestedSource}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn("Replenishment API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Replenishment Data",
      message: "The replenishment recommendations could not be calculated.",
      retryActionId: "btn-retry-replenishment",
      retryLabel: "Retry Calculating PAR",
    });
    container.querySelector("#btn-retry-replenishment")?.addEventListener("click", () => loadReplenishmentData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 5. Receipts & Put-Away ───────────────────────────────────────────────────
function renderReceiptsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Receipts & Put-Away",
        childSubtitle: "Goods receipts from purchase orders, ASN check-ins and storage bin put-away.",
        icon: "📥",
        backBtnId: "inv-back-to-hub-btn",
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Goods Receiving &amp; Put-Away Intake</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Intake delivery from Purchase Orders with batch lot tagging and shelf-life verification.</p>
        </div>

        <form id="form-receive-goods" class="glass" style="padding:16px; border-radius:8px; max-width:640px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Café Destination</label>
              <select name="cafeId" class="form-input" required>
                <option value="ZC-0001">Koramangala (ZC-0001)</option>
                <option value="ZC-0002">Indiranagar (ZC-0002)</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
              <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Received Quantity</label>
              <input type="number" name="quantity" class="form-input" placeholder="Qty" required value="20" min="1">
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Supplier Lot Number</label>
              <input type="text" name="supplierLot" class="form-input" placeholder="e.g. LOT-BT-991" required value="LOT-BT-991">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Expiry Date</label>
              <input type="date" name="expiryDate" class="form-input" required value="${new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}">
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Storage Location</label>
              <select name="storageLocation" class="form-input">
                <option value="Main Store">Main Store</option>
                <option value="Cold Store">Cold Store</option>
                <option value="Bar Counter">Bar Counter</option>
              </select>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top:6px;">Confirm Goods Receipt &amp; Put-Away</button>
        </form>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));

  const form = wrap.querySelector("#form-receive-goods");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/receipts", {
          cafeId: fd.get("cafeId"),
          itemId: fd.get("itemId"),
          quantity: Number(fd.get("quantity")),
          supplierLot: fd.get("supplierLot"),
          expiryDate: fd.get("expiryDate"),
          storageLocation: fd.get("storageLocation"),
        });
        showToast("Goods received and batch lot created.", "success");
        navigate("inventory/stock-by-cafe");
      } catch (err) {
        showToast(`Receipt failed: ${err.message}`, "error");
      }
    });
  }
}

// ── 6. Stock Movement Ledger ─────────────────────────────────────────────────
async function renderMovementsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Stock Ledger",
        childSubtitle: "Double-entry transaction audit & immutable ledger logs across all cafés.",
        icon: "📜",
        backBtnId: "inv-back-to-hub-btn",
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Immutable Stock Movement Ledger</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Transaction ledger tracking every receipt, consumption, transfer, count adjustment, and wastage.</p>
        </div>

        <div id="movements-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  await loadMovementsData(wrap);
}

async function loadMovementsData(wrap) {
  const container = wrap.querySelector("#movements-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/movements");
    const movements = res?.movements || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Movement ID</th>
              <th style="padding:8px 10px;">Date &amp; Café</th>
              <th style="padding:8px 10px;">Item Code</th>
              <th style="padding:8px 10px;">Transaction Type</th>
              <th style="padding:8px 10px; text-align:right;">Quantity Change</th>
              <th style="padding:8px 10px; text-align:right;">Balance After</th>
              <th style="padding:8px 10px;">Reason / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${movements.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No stock movements recorded in ledger.</td></tr>` : ''}
            ${movements.map((m) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700;">${m.movementId}</td>
                <td style="padding:8px 10px;">${new Date(m.performedAt).toLocaleDateString()} (${m.cafeId})</td>
                <td style="padding:8px 10px; font-weight:600;">${m.itemId}</td>
                <td style="padding:8px 10px;"><span class="badge badge-neutral">${m.movementType}</span></td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:${m.quantityBase > 0 ? "var(--color-accent-mint-bright)" : "var(--danger)"};">
                  ${m.quantityBase > 0 ? "+" : ""}${m.quantityBase}
                </td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--ink);">${m.balanceAfterBase}</td>
                <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${m.reason || '—'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn("Movements API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Stock Ledger",
      message: "The stock movements ledger could not be retrieved from the server.",
      retryActionId: "btn-retry-movements",
      retryLabel: "Retry Loading Ledger",
    });
    container.querySelector("#btn-retry-movements")?.addEventListener("click", () => loadMovementsData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 7. Lots & FEFO Expiry ────────────────────────────────────────────────────
async function renderLotsExpiryTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Lots & FEFO Expiry",
        childSubtitle: "Batch lot numbers, supplier traceability, expiration alerts and FEFO consumption.",
        icon: "⏳",
        backBtnId: "inv-back-to-hub-btn",
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Batch Lots &amp; FEFO Expiry Tracking</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">First-Expire-First-Out consumption routing and near-expiry exposure protection.</p>
        </div>

        <div id="lots-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  await loadLotsData(wrap);
}

async function loadLotsData(wrap) {
  const container = wrap.querySelector("#lots-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/lots");
    const lots = res?.lots || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Zamorin Lot ID</th>
              <th style="padding:8px 10px;">Item / Café</th>
              <th style="padding:8px 10px;">Supplier Batch</th>
              <th style="padding:8px 10px;">Expiry Date</th>
              <th style="padding:8px 10px; text-align:right;">Quantity Available</th>
              <th style="padding:8px 10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${lots.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No active lots recorded.</td></tr>` : ''}
            ${lots.map((l) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--color-accent-gold-bright);">${l.lotId}</td>
                <td style="padding:8px 10px;"><strong>${l.itemId}</strong> (${l.cafeId})</td>
                <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${l.supplierLot || '—'}</td>
                <td style="padding:8px 10px; font-weight:600; color:var(--ink);">${l.expiryDate}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${l.quantityBase}</td>
                <td style="padding:8px 10px;"><span class="badge ${l.status === "AVAILABLE" ? "badge-success" : l.status === "RECALL_HOLD" ? "badge-danger" : "badge-warning"}">${l.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn("Lots API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Batch Lots",
      message: "The batch lots and expiry tracking data could not be loaded.",
      retryActionId: "btn-retry-lots",
      retryLabel: "Retry Loading Lots",
    });
    container.querySelector("#btn-retry-lots")?.addEventListener("click", () => loadLotsData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 8. Inter-Café Transfers ──────────────────────────────────────────────────
async function renderTransfersTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Inter-Café Transfers",
        childSubtitle: "Multi-branch stock transfer orders, in-transit dispatch and destination receipts.",
        icon: "🚚",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-new-transfer" class="btn btn-primary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            + Request Transfer
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Inter-Café Stock Transfers</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Move stock between cafés with dispatch deduction, in-transit isolation, and variance audits.</p>
        </div>

        <div id="transfers-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-new-transfer")?.addEventListener("click", () => openNewTransferModal(wrap));

  await loadTransfersData(wrap);
}

async function loadTransfersData(wrap) {
  const container = wrap.querySelector("#transfers-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/transfers");
    const transfers = res?.transfers || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Transfer ID</th>
              <th style="padding:8px 10px;">Source → Destination</th>
              <th style="padding:8px 10px;">Item Code</th>
              <th style="padding:8px 10px; text-align:right;">Requested</th>
              <th style="padding:8px 10px; text-align:right;">Dispatched</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No inter-café transfers requested.</td></tr>` : ''}
            ${transfers.map((t) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700;">${t.transferId}</td>
                <td style="padding:8px 10px;"><strong>${t.sourceCafeId}</strong> → <strong>${t.destCafeId}</strong></td>
                <td style="padding:8px 10px; font-weight:600;">${t.itemId}</td>
                <td style="padding:8px 10px; text-align:right;">${t.requestedQty}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700;">${t.dispatchedQty || '—'}</td>
                <td style="padding:8px 10px;"><span class="badge ${t.status === "COMPLETED" ? "badge-success" : t.status === "IN_TRANSIT" ? "badge-accent" : "badge-warning"}">${t.status}</span></td>
                <td style="padding:8px 10px; text-align:right;">
                  ${t.status === "REQUESTED" ? `<button class="btn btn-sm btn-primary btn-dispatch-trf" data-id="${t.transferId}">Dispatch</button>` : ''}
                  ${t.status === "IN_TRANSIT" ? `<button class="btn btn-sm btn-success btn-receive-trf" data-id="${t.transferId}">Receive</button>` : ''}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll(".btn-dispatch-trf").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          await apiPost(`/inventory/transfers/${id}/dispatch`, {});
          showToast(`Transfer ${id} dispatched and marked in-transit.`, "success");
          loadTransfersData(wrap);
        } catch (err) {
          showToast(`Dispatch failed: ${err.message}`, "error");
        }
      });
    });

    container.querySelectorAll(".btn-receive-trf").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          await apiPost(`/inventory/transfers/${id}/receive`, {});
          showToast(`Transfer ${id} received at destination café.`, "success");
          loadTransfersData(wrap);
        } catch (err) {
          showToast(`Receipt failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    console.warn("Transfers API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Transfers",
      message: "The inter-café transfer orders could not be retrieved from the server.",
      retryActionId: "btn-retry-transfers",
      retryLabel: "Retry Loading Transfers",
    });
    container.querySelector("#btn-retry-transfers")?.addEventListener("click", () => loadTransfersData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 9. Reservations Tab ──────────────────────────────────────────────────────
async function renderReservationsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Stock Reservations",
        childSubtitle: "Earmarked ingredient allocations for event catering and central kitchen batches.",
        icon: "🔒",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-create-reservation" class="btn btn-primary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            + Reserve Stock
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Inventory Demand Reservations</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Dedicated stock reservations for Department Orders &amp; Catering (reduces Available stock without altering On Hand).</p>
        </div>

        <div id="reservations-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-create-reservation")?.addEventListener("click", () => openCreateReservationModal(wrap));

  await loadReservationsData(wrap);
}

async function loadReservationsData(wrap) {
  const container = wrap.querySelector("#reservations-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/reservations");
    const reservations = res?.reservations || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Reservation ID</th>
              <th style="padding:8px 10px;">Café &amp; Item</th>
              <th style="padding:8px 10px;">Type &amp; Reference</th>
              <th style="padding:8px 10px; text-align:right;">Reserved Qty</th>
              <th style="padding:8px 10px;">Expires At</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${reservations.length === 0 ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No active inventory reservations.</td></tr>` : ''}
            ${reservations.map((r) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--color-accent-gold-bright);">${r.reservationId}</td>
                <td style="padding:8px 10px;"><strong>${r.itemId}</strong> (${r.cafeId})</td>
                <td style="padding:8px 10px;"><span class="badge badge-neutral">${r.reservationType}</span> ${r.demandReferenceId ? `<br><small style="color:var(--muted); font-family:monospace;">${r.demandReferenceId}</small>` : ''}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--color-accent-mint-bright);">${r.reservedQty}</td>
                <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${new Date(r.expiresAt).toLocaleDateString()}</td>
                <td style="padding:8px 10px;"><span class="badge ${r.status === "ACTIVE" ? "badge-success" : "badge-neutral"}">${r.status}</span></td>
                <td style="padding:8px 10px; text-align:right;">
                  ${r.status === "ACTIVE" ? `<button class="btn btn-sm btn-secondary btn-release-rsv" data-id="${r.reservationId}">Release</button>` : ''}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll(".btn-release-rsv").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          await apiPost(`/inventory/reservations/${id}/release`, {});
          showToast(`Reservation ${id} released. Available stock restored.`, "success");
          loadReservationsData(wrap);
        } catch (err) {
          showToast(`Release failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    console.warn("Reservations API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Reservations",
      message: "The demand stock reservations could not be loaded from the server.",
      retryActionId: "btn-retry-reservations",
      retryLabel: "Retry Loading Reservations",
    });
    container.querySelector("#btn-retry-reservations")?.addEventListener("click", () => loadReservationsData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 10. Cycle Counts & Stocktake ─────────────────────────────────────────────
async function renderCountsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Cycle Counts",
        childSubtitle: "Daily spot checks, weekly counts, variance analysis and Master write-offs.",
        icon: "⚖️",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-submit-count" class="btn btn-primary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            + Record Physical Count
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Cycle Counts &amp; Physical Stocktake</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Blind counting, variance triggers, recount workflows, and approved adjustment postings.</p>
        </div>

        <div id="counts-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-submit-count")?.addEventListener("click", () => openSubmitCountModal(wrap));

  await loadCountsData(wrap);
}

async function loadCountsData(wrap) {
  const container = wrap.querySelector("#counts-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/counts");
    const counts = res?.counts || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Count ID</th>
              <th style="padding:8px 10px;">Date &amp; Café</th>
              <th style="padding:8px 10px;">Type</th>
              <th style="padding:8px 10px;">Items Audited</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${counts.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No cycle counts registered.</td></tr>` : ''}
            ${counts.map((c) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700;">${c.countId}</td>
                <td style="padding:8px 10px;">${new Date(c.createdAt).toLocaleDateString()} (${c.cafeId})</td>
                <td style="padding:8px 10px;"><span class="badge badge-neutral">${c.countType}</span></td>
                <td style="padding:8px 10px;">${c.items?.length || 0} items</td>
                <td style="padding:8px 10px;"><span class="badge ${c.status === "POSTED" ? "badge-success" : c.status === "RECOUNT_REQUIRED" ? "badge-danger" : "badge-warning"}">${c.status}</span></td>
                <td style="padding:8px 10px; text-align:right;">
                  ${c.status !== "POSTED" ? `<button class="btn btn-sm btn-primary btn-approve-count" data-id="${c.countId}">Approve &amp; Post</button>` : `<span style="font-size:12px; color:var(--muted);">Posted</span>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll(".btn-approve-count").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        try {
          await apiPost(`/inventory/counts/${id}/approve`, {});
          showToast(`Cycle count ${id} approved and stock ledger adjusted.`, "success");
          loadCountsData(wrap);
        } catch (err) {
          showToast(`Approval failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    console.warn("Counts API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Cycle Counts",
      message: "The physical cycle counts could not be retrieved from the server.",
      retryActionId: "btn-retry-counts",
      retryLabel: "Retry Loading Counts",
    });
    container.querySelector("#btn-retry-counts")?.addEventListener("click", () => loadCountsData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 11. Wastage & Adjustments ────────────────────────────────────────────────
function renderWastageTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Wastage & Adjustments",
        childSubtitle: "Logged food spoilage, preparation waste, breakage and damage write-offs.",
        icon: "🗑️",
        backBtnId: "inv-back-to-hub-btn",
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Log Inventory Wastage &amp; Spillage</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Reason-coded stock write-offs with photo and evidence attachment support.</p>
        </div>

        <form id="form-log-wastage" class="glass" style="padding:16px; border-radius:8px; max-width:640px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Café Location</label>
              <select name="cafeId" class="form-input" required>
                <option value="ZC-0001">Koramangala (ZC-0001)</option>
                <option value="ZC-0002">Indiranagar (ZC-0002)</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
              <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Wasted Quantity</label>
              <input type="number" name="quantity" class="form-input" placeholder="Qty" required value="2" min="0.1" step="0.1">
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Reason Code</label>
              <select name="reasonCode" class="form-input" required>
                <option value="SPILLED">Spilled / Barista Accident</option>
                <option value="EXPIRED">Expired on Shelf</option>
                <option value="DAMAGED_PACKAGING">Damaged Packaging</option>
                <option value="PREPARATION_LOSS">Preparation Loss</option>
                <option value="CONTAMINATION">Contamination</option>
                <option value="QUALITY_REJECTION">Quality Rejection</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label class="form-label" style="font-size:12px; font-weight:600;">Notes &amp; Circumstances</label>
            <input type="text" name="notes" class="form-input" placeholder="e.g. Dropped milk crate during morning shift">
          </div>

          <button type="submit" class="btn btn-danger" style="margin-top:6px;">Log Wastage &amp; Deduct Stock</button>
        </form>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));

  const form = wrap.querySelector("#form-log-wastage");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/wastage", {
          cafeId: fd.get("cafeId"),
          itemId: fd.get("itemId"),
          quantity: Number(fd.get("quantity")),
          reasonCode: fd.get("reasonCode"),
          notes: fd.get("notes"),
        });
        showToast("Wastage logged and stock deducted atomically.", "success");
        navigate("inventory/stock-by-cafe");
      } catch (err) {
        showToast(`Wastage logging failed: ${err.message}`, "error");
      }
    });
  }
}

// ── 12. Recipe Consumption & Variance ────────────────────────────────────────
async function renderConsumptionVarianceTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Recipe Variance",
        childSubtitle: "Theoretical POS recipe depletion vs actual stocktake balance variance.",
        icon: "☕",
        backBtnId: "inv-back-to-hub-btn",
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Theoretical vs Actual Recipe Consumption</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Comparison of POS sale recipe standard usage against physical count-based actual usage.</p>
        </div>

        <div id="variance-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  await loadVarianceData(wrap);
}

async function loadVarianceData(wrap) {
  const container = wrap.querySelector("#variance-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/consumption/variance");
    const reports = res?.varianceReport || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Item &amp; SKU</th>
              <th style="padding:8px 10px; text-align:right;">Theoretical POS Usage</th>
              <th style="padding:8px 10px; text-align:right;">Actual Usage</th>
              <th style="padding:8px 10px; text-align:right;">Variance (Qty)</th>
              <th style="padding:8px 10px; text-align:right;">Variance (%)</th>
              <th style="padding:8px 10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${reports.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No recipe consumption variances logged.</td></tr>` : ''}
            ${reports.map((r) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px;"><strong>${r.name}</strong><br><span style="font-size:11.5px; font-family:monospace; color:var(--muted);">${r.sku}</span></td>
                <td style="padding:8px 10px; text-align:right; font-weight:600; color:var(--ink);">${r.theoreticalUsage} ${r.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--ink);">${r.actualUsage} ${r.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:${r.varianceQty > 0 ? "var(--danger)" : "var(--color-accent-mint-bright)"};">
                  ${r.varianceQty > 0 ? "+" : ""}${r.varianceQty} ${r.baseUnit}
                </td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:${r.variancePercent > 0 ? "var(--danger)" : "var(--color-accent-mint-bright)"};">
                  ${r.variancePercent > 0 ? "+" : ""}${r.variancePercent}%
                </td>
                <td style="padding:8px 10px;"><span class="badge ${r.status === "NORMAL" ? "badge-success" : "badge-warning"}">${r.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn("Variance API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Variance Report",
      message: "The recipe consumption variance report could not be generated.",
      retryActionId: "btn-retry-variance",
      retryLabel: "Retry Loading Report",
    });
    container.querySelector("#btn-retry-variance")?.addEventListener("click", () => loadVarianceData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 13. Valuation & Reports ──────────────────────────────────────────────────
async function renderValuationTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Valuation & Reports",
        childSubtitle: "Weighted average cost valuations, ledger balance summaries and tax asset books.",
        icon: "💰",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export Valuation (CSV)
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Operational Inventory Valuation &amp; Stock Reports</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Weighted average cost valuations across all branch storage locations.</p>
        </div>

        <div id="valuation-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  await loadValuationData(wrap);
}

async function loadValuationData(wrap) {
  const container = wrap.querySelector("#valuation-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/reports/valuation");
    const rows = res?.valuationRows || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Café &amp; SKU</th>
              <th style="padding:8px 10px;">Item Name</th>
              <th style="padding:8px 10px;">Category</th>
              <th style="padding:8px 10px; text-align:right;">Physical On Hand</th>
              <th style="padding:8px 10px; text-align:right;">Unit Cost</th>
              <th style="padding:8px 10px; text-align:right;">Total Valuation</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No valuation rows available.</td></tr>` : ''}
            ${rows.map((r) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px;"><strong>${r.cafeId}</strong><br><span style="font-size:11.5px; font-family:monospace; color:var(--muted);">${r.sku}</span></td>
                <td style="padding:8px 10px; font-weight:600; color:var(--ink);">${r.name}</td>
                <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${r.category}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:700; color:var(--ink);">${r.onHand} ${r.baseUnit}</td>
                <td style="padding:8px 10px; text-align:right; font-size:12.5px; color:var(--muted);">${fmtInr(r.unitCostPaisa)}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:800; font-size:13.5px; color:var(--color-accent-mint-bright);">${fmtInr(r.totalValuePaisa)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    const exportBtn = wrap.querySelector("#btn-export-csv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const csv = "Café,SKU,Item Name,Category,On Hand,Unit Cost (₹),Total Value (₹)\n" +
          rows.map((r) => `"${r.cafeId}","${r.sku}","${r.name}","${r.category}",${r.onHand},${(r.unitCostPaisa/100).toFixed(2)},${(r.totalValuePaisa/100).toFixed(2)}`).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inventory_valuation_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        showToast("Valuation CSV exported.", "success");
      });
    }
  } catch (err) {
    console.warn("Valuation API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Valuation Report",
      message: "The inventory valuation data could not be retrieved from the server.",
      retryActionId: "btn-retry-valuation",
      retryLabel: "Retry Loading Valuation",
    });
    container.querySelector("#btn-retry-valuation")?.addEventListener("click", () => loadValuationData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 14. Recall & Traceability ────────────────────────────────────────────────
async function renderRecallsTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Recall & Traceability",
        childSubtitle: "Supplier recall alerts, affected batch quarantine and containment logs.",
        icon: "🛡️",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-create-recall" class="btn btn-danger btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            + Initiate Food Recall
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Food Safety Recall &amp; Traceability Containment</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Broadcast recall notices, locate contaminated lots across all cafés, and lock stock into quarantine.</p>
        </div>

        <div id="recalls-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-create-recall")?.addEventListener("click", () => openCreateRecallModal(wrap));

  await loadRecallsData(wrap);
}

async function loadRecallsData(wrap) {
  const container = wrap.querySelector("#recalls-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/recalls");
    const recalls = res?.recalls || [];

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
              <th style="padding:8px 10px;">Recall ID</th>
              <th style="padding:8px 10px;">Item / Batch</th>
              <th style="padding:8px 10px;">Reason</th>
              <th style="padding:8px 10px;">Affected Cafés</th>
              <th style="padding:8px 10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${recalls.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--color-accent-mint-bright);">Zero active food safety recalls. All inventory is safe for consumption.</td></tr>` : ''}
            ${recalls.map((r) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--danger);">${r.recallId}</td>
                <td style="padding:8px 10px;"><strong>${r.itemId}</strong><br><span style="font-size:11.5px; color:var(--muted);">${r.supplierLot || 'All Lots'}</span></td>
                <td style="padding:8px 10px; font-size:13px;">${r.reason}</td>
                <td style="padding:8px 10px; font-size:12px;">${r.affectedCafes?.map((c) => `${c.cafeId}: ${c.quarantinedQty} locked`).join(", ") || 'All Locations'}</td>
                <td style="padding:8px 10px;"><span class="badge ${r.status === "ACTIVE" ? "badge-danger" : "badge-success"}">${r.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.warn("Recalls API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Recalls",
      message: "The food safety recall alerts could not be retrieved from the server.",
      retryActionId: "btn-retry-recalls",
      retryLabel: "Retry Loading Recalls",
    });
    container.querySelector("#btn-retry-recalls")?.addEventListener("click", () => loadRecallsData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 15. Inventory Integrity Audit ────────────────────────────────────────────
async function renderIntegrityTab(wrap) {
  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentTitle: "Inventory & Stock",
        parentRoute: "inventory",
        childTitle: "Inventory Integrity",
        childSubtitle: "Zero negative stock checks, formula verification and balance invariance.",
        icon: "🔒",
        backBtnId: "inv-back-to-hub-btn",
        actionsHtml: `
          <button id="btn-run-integrity" class="btn btn-secondary btn-sm" style="display:flex; align-items:center; gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Re-run Audit Checks
          </button>
        `,
      })}

      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Inventory Integrity &amp; Sanity Audit</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">16-point automated verification for negative stock, orphan profiles, transfer leaks, and expired availability.</p>
        </div>

        <div id="integrity-table-container">
          <div style="text-align:center; padding:30px;"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector("#inventory-back-to-hub-btn")?.addEventListener("click", () => navigate("inventory"));
  wrap.querySelector("#btn-run-integrity")?.addEventListener("click", () => renderIntegrityTab(wrap));

  await loadIntegrityData(wrap);
}

async function loadIntegrityData(wrap) {
  const container = wrap.querySelector("#integrity-table-container");
  if (!container) return;

  try {
    const res = await apiGet("/inventory/integrity");
    const issues = res?.issues || [];

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <span class="badge ${res?.status === "HEALTHY" ? "badge-success" : res?.status === "CRITICAL" ? "badge-danger" : "badge-warning"}" style="font-size:13px; padding:4px 12px;">
          SYSTEM STATUS: ${res?.status || "HEALTHY"}
        </span>
        <span style="font-size:12.5px; color:var(--muted);">${res?.checksEvaluated || 16} checks evaluated • ${res?.issuesFound || 0} issues flagged</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${issues.length === 0 ? `<div class="glass" style="padding:14px; color:var(--color-accent-mint-bright); font-weight:600;">All 16 inventory integrity checks passed with zero discrepancies.</div>` : ''}
        ${issues.map((i) => `
          <div class="glass" style="padding:10px 14px; border-left:4px solid ${i.severity === "CRITICAL" ? "var(--danger)" : "var(--color-accent-gold-bright)"};">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong style="font-size:13px; color:var(--ink); font-family:monospace;">${i.check}</strong>
              <span class="badge ${i.severity === "CRITICAL" ? "badge-danger" : "badge-warning"}">${i.severity}</span>
            </div>
            <div style="font-size:12.5px; color:var(--muted);">${i.description}</div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    console.warn("Integrity API request failed:", err);
    container.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Integrity Audit",
      message: "The system integrity verification checks could not be executed.",
      retryActionId: "btn-retry-integrity",
      retryLabel: "Retry Audit",
    });
    container.querySelector("#btn-retry-integrity")?.addEventListener("click", () => loadIntegrityData(wrap));
    container.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── ITEM 360 DRILLDOWN MODAL (Stages 268-270) ─────────────────────────────────
function wireItem360Clicks(wrap) {
  wrap.querySelectorAll(".btn-drill-item360").forEach((el) => {
    el.addEventListener("click", async () => {
      const itemId = el.dataset.id;
      if (!itemId) return;
      await openItem360Modal(itemId);
    });
  });
}

async function openItem360Modal(itemId) {
  try {
    const data = await apiGet(`/inventory/items/${itemId}/360`);
    const itm = data.item;
    const s = data.summary;

    const modalHtml = `
      <div style="padding:6px; max-height:80vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="font-size:20px; font-weight:800; color:var(--ink); margin:0;">${itm.name}</h2>
              <span class="badge badge-accent" style="font-size:11px; font-family:monospace;">${itm.sku}</span>
            </div>
            <p style="font-size:13px; color:var(--muted); margin:4px 0 0;">Category: <strong>${itm.category}</strong> • Base UOM: <strong>${itm.baseUnit}</strong> • Criticality: <strong>${itm.criticality}</strong></p>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">✕ Close</button>
        </div>

        <!-- Summary KPI Row -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px;">
          <div class="glass" style="padding:10px; text-align:center;">
            <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Portfolio On Hand</div>
            <div style="font-size:18px; font-weight:800; color:var(--ink);">${s.portfolioOnHand} ${itm.baseUnit}</div>
          </div>
          <div class="glass" style="padding:10px; text-align:center;">
            <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Available to Use</div>
            <div style="font-size:18px; font-weight:800; color:var(--color-accent-mint-bright);">${s.portfolioAvailable} ${itm.baseUnit}</div>
          </div>
          <div class="glass" style="padding:10px; text-align:center;">
            <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Stock Valuation</div>
            <div style="font-size:18px; font-weight:800; color:var(--color-accent-gold-bright);">${fmtInr(s.portfolioValuePaisa)}</div>
          </div>
          <div class="glass" style="padding:10px; text-align:center;">
            <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Active Lots</div>
            <div style="font-size:18px; font-weight:800; color:var(--ink);">${s.activeLotsCount}</div>
          </div>
        </div>

        <!-- Café Availability Breakdown Table -->
        <div style="margin-bottom:16px;">
          <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0 0 8px;">Café Stocking Breakdown</h4>
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:6px 8px;">Café</th>
                <th style="padding:6px 8px; text-align:right;">On Hand</th>
                <th style="padding:6px 8px; text-align:right;">Available</th>
                <th style="padding:6px 8px; text-align:right;">Reserved</th>
                <th style="padding:6px 8px; text-align:right;">Min / PAR / Max</th>
                <th style="padding:6px 8px;">Primary Location</th>
              </tr>
            </thead>
            <tbody>
              ${(data.cafeConfigs || []).map((c) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:6px 8px; font-weight:600;">${c.cafeId}</td>
                  <td style="padding:6px 8px; text-align:right; font-weight:700;">${c.currentQuantityBase}</td>
                  <td style="padding:6px 8px; text-align:right; color:var(--color-accent-mint-bright);">${c.availableQuantityBase}</td>
                  <td style="padding:6px 8px; text-align:right; color:var(--muted);">${c.reservedQuantityBase || 0}</td>
                  <td style="padding:6px 8px; text-align:right; font-size:11.5px; color:var(--muted);">${c.minQuantityBase} / ${c.parQuantityBase} / ${c.maxQuantityBase}</td>
                  <td style="padding:6px 8px; font-size:12px;">${c.primaryLocation}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Recent Stock Movements -->
        <div>
          <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0 0 8px;">Recent Stock Ledger Movements</h4>
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:6px 8px;">Date</th>
                <th style="padding:6px 8px;">Type</th>
                <th style="padding:6px 8px;">Café</th>
                <th style="padding:6px 8px; text-align:right;">Qty Change</th>
                <th style="padding:6px 8px; text-align:right;">Balance After</th>
                <th style="padding:6px 8px;">Reason</th>
              </tr>
            </thead>
            <tbody>
              ${(data.recentMovements || []).slice(0, 8).map((m) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:6px 8px;">${new Date(m.performedAt).toLocaleDateString()}</td>
                  <td style="padding:6px 8px;"><span class="badge badge-neutral" style="font-size:10.5px;">${m.movementType}</span></td>
                  <td style="padding:6px 8px;">${m.cafeId}</td>
                  <td style="padding:6px 8px; text-align:right; font-weight:700; color:${m.quantityBase > 0 ? "var(--color-accent-mint-bright)" : "var(--danger)"};">
                    ${m.quantityBase > 0 ? "+" : ""}${m.quantityBase}
                  </td>
                  <td style="padding:6px 8px; text-align:right; font-weight:700;">${m.balanceAfterBase}</td>
                  <td style="padding:6px 8px; color:var(--muted);">${m.reason || '—'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    openModal(modalHtml);
  } catch (err) {
    showToast(`Error loading Item 360: ${err.message}`, "error");
  }
}

// ── MODALS (GLOBAL UI-001) ───────────────────────────────────────────────────

function openAddGlobalItemModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Add Global Inventory Item</h3>
      <form id="form-new-global-item">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">SKU Code (Unique)</label>
            <input type="text" name="sku" class="form-input" placeholder="e.g. CB-ARA-01" required>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item Name</label>
            <input type="text" name="name" class="form-input" placeholder="e.g. Arabica Whole Beans" required>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Category</label>
            <select name="category" class="form-input" required>
              <option value="COFFEE_BEANS">Coffee &amp; Raw Beans</option>
              <option value="DAIRY_FRESH">Dairy &amp; Fresh</option>
              <option value="SYRUPS_FLAVOURS">Syrups &amp; Flavours</option>
              <option value="PACKAGING_CONSUMABLES">Packaging &amp; Consumables</option>
              <option value="BAKERY_FOOD_INPUTS">Bakery / Food Inputs</option>
              <option value="CLEANING_SUPPLIES">Cleaning Supplies</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Base Unit of Measure</label>
            <input type="text" name="baseUnit" class="form-input" placeholder="e.g. kg, litre, bottle" required value="kg">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Unit Cost (₹)</label>
            <input type="number" name="unitCost" class="form-input" placeholder="₹" value="850" min="0">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Shelf Life (Days)</label>
            <input type="number" name="shelfLifeDays" class="form-input" value="30" min="1">
          </div>
        </div>

        <div style="font-size:12px; color:var(--muted); margin-bottom:16px;">
          💡 This item will be automatically provisioned across all active cafés with an initial stock of 0.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Global Item</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-new-global-item");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/items", {
          sku: fd.get("sku"),
          name: fd.get("name"),
          category: fd.get("category"),
          baseUnit: fd.get("baseUnit"),
          unitCost: Number(fd.get("unitCost")),
          shelfLifeDays: Number(fd.get("shelfLifeDays")),
        });
        showToast("Global item created and provisioned to all cafés.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "global-items";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Failed to create item: ${err.message}`, "error");
      }
    });
  }
}

function openRecordMovementModal(wrap, defaultCafeId) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Record Stock Movement</h3>
      <form id="form-record-movement">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Café</label>
            <select name="cafeId" class="form-input" required>
              <option value="ZC-0001" ${defaultCafeId === "ZC-0001" ? "selected" : ""}>Koramangala (ZC-0001)</option>
              <option value="ZC-0002" ${defaultCafeId === "ZC-0002" ? "selected" : ""}>Indiranagar (ZC-0002)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
            <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Movement Type</label>
            <select name="movementType" class="form-input" required>
              <option value="MANUAL_RECEIPT">Manual Receipt (+)</option>
              <option value="COUNT_ADJUSTMENT">Count Adjustment (+/-)</option>
              <option value="CONSUMPTION">Internal Consumption (-)</option>
              <option value="DAMAGE">Damaged Goods (-)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Quantity Change (+/-)</label>
            <input type="number" name="quantity" class="form-input" placeholder="e.g. 5 or -2" required value="5" step="0.1">
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Reason / Reference</label>
          <input type="text" name="reason" class="form-input" placeholder="e.g. Corrected count from morning shift" required>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Post Stock Movement</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-record-movement");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/movements", {
          cafeId: fd.get("cafeId"),
          itemId: fd.get("itemId"),
          movementType: fd.get("movementType"),
          quantity: Number(fd.get("quantity")),
          reason: fd.get("reason"),
        });
        showToast("Stock movement logged.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderStockLevelsTab(wrap);
      } catch (err) {
        showToast(`Movement failed: ${err.message}`, "error");
      }
    });
  }
}

function openInternalLocationMoveModal(wrap, defaultCafeId) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Internal Storage Move / PAR Replenish</h3>
      <form id="form-internal-move">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Café</label>
            <select name="cafeId" class="form-input" required>
              <option value="ZC-0001" ${defaultCafeId === "ZC-0001" ? "selected" : ""}>Koramangala (ZC-0001)</option>
              <option value="ZC-0002" ${defaultCafeId === "ZC-0002" ? "selected" : ""}>Indiranagar (ZC-0002)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
            <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">From Location</label>
            <select name="fromLocation" class="form-input">
              <option value="Main Store">Main Store</option>
              <option value="Cold Store">Cold Store</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">To Location</label>
            <select name="toLocation" class="form-input">
              <option value="Bar Counter">Bar Counter</option>
              <option value="Cold Store">Cold Store</option>
              <option value="Main Store">Main Store</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Quantity</label>
            <input type="number" name="quantity" class="form-input" value="5" min="1" required>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Reason</label>
            <input type="text" name="reason" class="form-input" value="Morning shift PAR replenishment">
          </div>
        </div>

        <div style="font-size:12px; color:var(--muted); margin-bottom:16px;">
          💡 Internal location moves update storage bin balances without altering the total café stock balance.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Move Stock</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-internal-move");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/internal-transfers", {
          cafeId: fd.get("cafeId"),
          itemId: fd.get("itemId"),
          fromLocation: fd.get("fromLocation"),
          toLocation: fd.get("toLocation"),
          quantity: Number(fd.get("quantity")),
          reason: fd.get("reason"),
        });
        showToast("Internal location move recorded.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderStockLevelsTab(wrap);
      } catch (err) {
        showToast(`Internal move failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateReservationModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Reserve Inventory Demand</h3>
      <form id="form-create-reservation">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Café</label>
            <select name="cafeId" class="form-input" required>
              <option value="ZC-0001">Koramangala (ZC-0001)</option>
              <option value="ZC-0002">Indiranagar (ZC-0002)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
            <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Reserved Quantity</label>
            <input type="number" name="reservedQty" class="form-input" placeholder="Qty" required value="10" min="1">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Demand Type</label>
            <select name="reservationType" class="form-input">
              <option value="DEPARTMENT_ORDER">Department Order</option>
              <option value="CATERING">Catering Event</option>
              <option value="INSTITUTIONAL">Institutional Client</option>
              <option value="MANUAL_HOLD">Manual Operational Hold</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Reference / Order ID</label>
          <input type="text" name="demandReferenceId" class="form-input" placeholder="e.g. DO-2026-0001">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Confirm Reservation</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-reservation");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/reservations", {
          cafeId: fd.get("cafeId"),
          itemId: fd.get("itemId"),
          reservedQty: Number(fd.get("reservedQty")),
          reservationType: fd.get("reservationType"),
          demandReferenceId: fd.get("demandReferenceId"),
        });
        showToast("Stock reserved.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderReservationsTab(wrap);
      } catch (err) {
        showToast(`Reservation failed: ${err.message}`, "error");
      }
    });
  }
}

function openNewTransferModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Request Inter-Café Stock Transfer</h3>
      <form id="form-new-transfer">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Source Café (Origin)</label>
            <select name="sourceCafeId" class="form-input" required>
              <option value="ZC-0001">Koramangala (ZC-0001)</option>
              <option value="ZC-0002">Indiranagar (ZC-0002)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Destination Café</label>
            <select name="destCafeId" class="form-input" required>
              <option value="ZC-0002">Indiranagar (ZC-0002)</option>
              <option value="ZC-0001">Koramangala (ZC-0001)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item SKU / Code</label>
            <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Transfer Quantity</label>
            <input type="number" name="requestedQty" class="form-input" placeholder="Qty" required value="10" min="1">
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Reason for Transfer</label>
          <input type="text" name="reason" class="form-input" placeholder="e.g. Weekend surge stock rebalance" required>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Transfer Request</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-new-transfer");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/transfers", {
          sourceCafeId: fd.get("sourceCafeId"),
          destCafeId: fd.get("destCafeId"),
          itemId: fd.get("itemId"),
          requestedQty: Number(fd.get("requestedQty")),
          reason: fd.get("reason"),
        });
        showToast("Transfer requested.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderTransfersTab(wrap);
      } catch (err) {
        showToast(`Transfer failed: ${err.message}`, "error");
      }
    });
  }
}

function openSubmitCountModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Record Physical Cycle Count</h3>
      <form id="form-submit-count">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Café</label>
            <select name="cafeId" class="form-input" required>
              <option value="ZC-0001">Koramangala (ZC-0001)</option>
              <option value="ZC-0002">Indiranagar (ZC-0002)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Count Type</label>
            <select name="countType" class="form-input">
              <option value="CYCLE_COUNT">Cycle Count</option>
              <option value="PAR_COUNT">PAR Count</option>
              <option value="PHYSICAL_INVENTORY">Full Physical Stocktake</option>
            </select>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:10px; margin-bottom:12px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:6px;">Audited Item</div>
          <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px;">
            <input type="text" name="itemId" class="form-input" placeholder="Item Code" value="ITEM-1001" required>
            <input type="number" name="systemQty" class="form-input" placeholder="System" value="45" required>
            <input type="number" name="countedQty" class="form-input" placeholder="Counted" value="43" required>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Count for Approval</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-submit-count");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/counts", {
          cafeId: fd.get("cafeId"),
          countType: fd.get("countType"),
          items: [
            {
              itemId: fd.get("itemId"),
              systemQty: Number(fd.get("systemQty")),
              countedQty: Number(fd.get("countedQty")),
            },
          ],
        });
        showToast("Physical count submitted.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderCountsTab(wrap);
      } catch (err) {
        showToast(`Count submission failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateRecallModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--danger);">Initiate Food Safety Recall &amp; Quarantine</h3>
      <form id="form-create-recall">
        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Item Code / SKU</label>
          <input type="text" name="itemId" class="form-input" placeholder="e.g. ITEM-1001" required value="ITEM-1001">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Supplier Batch / Lot</label>
            <input type="text" name="supplierLot" class="form-input" placeholder="e.g. BATCH-9921">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Zamorin Lot ID</label>
            <input type="text" name="zamorinLot" class="form-input" placeholder="e.g. LOT-4821">
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Mandatory Recall Reason</label>
          <input type="text" name="reason" class="form-input" placeholder="e.g. Supplier allergen mislabel notification" required>
        </div>

        <div style="font-size:12px; color:var(--danger); margin-bottom:16px;">
          ⚠️ This will immediately place all matching batches across all cafés into locked quarantine hold.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-danger">Broadcast Recall Lockdown</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-recall");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/inventory/recalls", {
          itemId: fd.get("itemId"),
          supplierLot: fd.get("supplierLot"),
          zamorinLot: fd.get("zamorinLot"),
          reason: fd.get("reason"),
        });
        showToast("Recall broadcast. Affected stock locked in quarantine.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        renderRecallsTab(wrap);
      } catch (err) {
        showToast(`Recall failed: ${err.message}`, "error");
      }
    });
  }
}
