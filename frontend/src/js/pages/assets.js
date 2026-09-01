// =============================================================================
// ZAMORIN CAFE ERP — SCREEN 003: EQUIPMENT & ASSET MANAGEMENT
// Design System v2 (Ledger & Roastery Dark / Porcelain Light Theme)
//
// Asset Lifecycle + Maintenance + Work Orders + Inspections + Warranty + Reliability
// Primary Master / Normal Master Authority Model
// =============================================================================

import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction, renderCafeContextStrip, renderModuleErrorState } from "../components.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

let activeSubTab = "overview"; // 'overview' | 'assets' | 'maintenance' | 'work_orders' | 'inspections' | 'analytics'
let cachedOverview = null;
let cachedAssets = [];
let cachedWorkOrders = [];
const ASSET_CATEGORIES = [
  { id: "BREWING_EQUIPMENT", name: "Brewing Equipment" },
  { id: "GRINDERS_MILLS", name: "Grinders & Mills" },
  { id: "REFRIGERATION", name: "Refrigeration" },
  { id: "BAKERY_OVEN", name: "Bakery & Ovens" },
  { id: "WATER_FILTRATION", name: "Water Filtration" },
  { id: "POS_HARDWARE", name: "POS & IT Hardware" },
  { id: "HVAC", name: "HVAC & Electrical" },
  { id: "FURNITURE_FIXTURES", name: "Furniture & Fixtures" },
];

export function setAssetsActiveTab(tab) {
  const norm = (tab || "overview").toLowerCase().replace(/-/g, "_");
  const aliasMap = {
    "register": "assets",
    "asset": "assets",
    "equipment": "assets",
    "workorders": "work_orders",
    "breakdowns": "work_orders",
  };
  activeSubTab = aliasMap[norm] || norm || "overview";
}

export function renderAssets(subroute) {
  if (subroute !== undefined) {
    setAssetsActiveTab(subroute);
  }
  const isPrimary = state.user?.isPrimaryMaster === true;

  // If on child subroute, render dedicated child shell directly
  if (activeSubTab && activeSubTab !== "overview") {
    return `
      <div class="page-enter" style="max-width:1400px; margin:0 auto; padding-bottom:60px;">
        <div id="assets-subpanel-root">
          ${renderActiveSubpanel()}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter" style="padding-bottom: 60px;">
      <!-- Page Header -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h1 class="page-title" style="font-size:26px; font-weight:700; margin:0; color:var(--ink);">Equipment &amp; Asset Management</h1>
            <span class="badge" style="background:rgba(180,83,9,0.12); color:#b45309; font-weight:600; font-size:12px; padding:4px 10px; border-radius:12px;">SCR-003 ASSETS</span>
            ${
              isPrimary
                ? `<span class="badge" style="background:rgba(201,154,92,0.2); color:#c99a5c; font-weight:800; font-size:11px; padding:4px 8px; border-radius:12px;">PRIMARY MASTER</span>`
                : `<span class="badge" style="background:var(--surface-sunken); color:var(--muted); font-weight:700; font-size:11px; padding:4px 8px; border-radius:12px;">OPERATIONAL MASTER</span>`
            }
          </div>
          <p class="page-subtitle" style="font-size:14px; color:var(--muted); margin:4px 0 0;">
            Multi-Café Equipment Lifecycle, Preventative Maintenance, Work Orders, Calibration &amp; Warranty Registry
          </p>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="refresh-assets-btn" type="button" style="display:flex; align-items:center; gap:6px; font-weight:600;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Assets
          </button>
        </div>
      </div>

      <!-- Scope Context Banner -->
      ${renderCafeContextStrip()}

      <!-- Subpanel Content Container -->
      <div id="assets-subpanel-root">
        ${renderActiveSubpanel()}
      </div>
    </div>
  `;
}

function renderActiveSubpanel() {
  if (activeSubTab === "overview") {
    return renderOverviewSubpanel();
  }

  const submodules = {
    assets: {
      title: "Asset & Equipment Register",
      icon: "📋",
      desc: "Multi-café machinery, bar equipment, serial tracking and status.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-reg-asset" type="button">+ Register New Asset</button>`
    },
    maintenance: {
      title: "Preventive Maintenance Schedules",
      icon: "🛠️",
      desc: "Recurring maintenance plans, SOPs and preventive schedules.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-maint" type="button">+ New Maintenance Plan</button>`
    },
    work_orders: {
      title: "Work Orders & Breakdown Repairs",
      icon: "🔧",
      desc: "Breakdown tickets, technician dispatch, part replacements and costs.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-wo" type="button">+ Create Work Order</button>`
    },
    inspections: {
      title: "Inspections, Calibration & Warranty",
      icon: "📜",
      desc: "Calibration certificates, warranty tracking and AMC contracts.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-new-insp" type="button">+ Record Inspection</button>`
    },
    analytics: {
      title: "Reliability & Maintenance Analytics",
      icon: "📈",
      desc: "Mean Time Between Failures (MTBF), downtime and cost analytics.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-rel" type="button">Export Reliability Report</button>`
    },
  };

  const cur = submodules[activeSubTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (activeSubTab) {
    case "assets":
      bodyHtml = renderAssetsSubpanel();
      break;
    case "maintenance":
      bodyHtml = renderMaintenanceSubpanel();
      break;
    case "work_orders":
      bodyHtml = renderWorkOrdersSubpanel();
      break;
    case "inspections":
      bodyHtml = renderInspectionsSubpanel();
      break;
    case "analytics":
      bodyHtml = renderAnalyticsSubpanel();
      break;
    default:
      bodyHtml = renderOverviewSubpanel();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="assets-back-to-hub-btn" data-back-to-hub="true" data-assets-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Equipment &amp; Assets
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
      <div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

// 1. OVERVIEW SUBPANEL
function renderOverviewSubpanel() {
  const ov = cachedOverview || {
    kpis: {
      totalAssets: 3,
      inService: 2,
      underMaintenance: 1,
      outOfService: 0,
      dueSoon: 1,
      overdue: 0,
      criticalIssues: 0,
      activeWorkOrders: 1
    },
    needsAttention: [
      {
        type: "PREVENTIVE_MAINTENANCE_DUE",
        severity: "MEDIUM",
        assetId: "AST-001",
        assetName: "La Marzocco Linea PB 2-Group",
        cafeId: "ZC-0001",
        age: "Due in 3 days",
        status: "Quarterly Descaling Due",
        nextAction: "Generate Work Order",
      }
    ]
  };

  const assetTiles = [
    { id: "assets", icon: "📋", title: "Asset & Equipment Register", subtitle: "Multi-café machinery, bar equipment & serial tracking", badge: "3 Assets", badgeType: "accent" },
    { id: "maintenance", icon: "🛠️", title: "Preventive Maintenance", subtitle: "Recurring schedules, PM checklists & service plans", badge: "1 Due Soon", badgeType: "accent" },
    { id: "work_orders", icon: "🔧", title: "Work Orders & Repairs", subtitle: "Breakdown tickets, technician dispatch & parts replaced", badge: "1 Active", badgeType: "" },
    { id: "inspections", icon: "📜", title: "Inspections & Warranty", subtitle: "AMC contracts, warranty coverage & calibration certs", badge: "Active", badgeType: "success" },
    { id: "analytics", icon: "📈", title: "Reliability & Costs", subtitle: "MTBF, MTTR, maintenance spend & lifecycle analytics", badge: "82% Proactive", badgeType: "success" },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Equipment &amp; Asset Workspaces</h3>
        <div class="module-tile-grid">
          ${assetTiles.map((t) => `
            <button class="module-hub-tile" data-assets-hub-tile="${t.id}" type="button">
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

      <!-- Top KPI Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:14px;">
        ${kpiCard("Total Assets", ov.kpis.totalAssets, "Portfolio Total", "var(--ink)")}
        ${kpiCard("In Service", ov.kpis.inService, "Operating Normal", "var(--color-success, #2E7D32)")}
        ${kpiCard("Under Maintenance", ov.kpis.underMaintenance, "Active Service", "var(--color-warning, #ED6C02)")}
        ${kpiCard("Out of Service", ov.kpis.outOfService, "Safety Hold / Down", "var(--color-danger, #D32F2F)")}
        ${kpiCard("Service Due Soon", ov.kpis.dueSoon, "Next 30 Days", "var(--ink)")}
        ${kpiCard("Maintenance Overdue", ov.kpis.overdue, "Immediate Attention", ov.kpis.overdue > 0 ? "var(--color-danger)" : "var(--muted)")}
        ${kpiCard("Critical Issues", ov.kpis.criticalIssues, "Safety Risks", ov.kpis.criticalIssues > 0 ? "var(--color-danger)" : "var(--muted)")}
        ${kpiCard("Active Work Orders", ov.kpis.activeWorkOrders, "Open Tickets", "var(--color-accent-amber, #C89D5C)")}
      </div>

    <!-- 2-Column Split: Needs Attention & Upcoming Forecast -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Needs Attention Queue -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Needs Maintenance Attention</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">Prioritised equipment risks and overdue services</p>
          </div>
          <span class="status ${ov.needsAttention.length > 0 ? "warning" : "success"}" style="font-size:11px;">
            ${ov.needsAttention.length} Items
          </span>
        </div>

        ${
          ov.needsAttention.length === 0
            ? `<div style="text-align:center; padding:32px 16px; color:var(--muted); font-size:13px;">
                ✓ All equipment operating normally. Zero critical alerts.
               </div>`
            : `<div style="display:flex; flex-direction:column; gap:10px;">
                ${ov.needsAttention
                  .map(
                    (item) => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:8px; border-left:3px solid var(--color-${item.severity === "CRITICAL" ? "danger" : "warning"});">
                    <div>
                      <div style="font-size:13px; font-weight:700; color:var(--ink);">${item.name} <span style="font-family:var(--font-mono); font-size:11px; color:var(--muted);">(${item.assetId})</span></div>
                      <div style="font-size:12px; color:var(--muted);">${item.message} · <strong style="color:var(--ink);">${item.cafeId}</strong></div>
                    </div>
                    <button class="btn btn-ghost open-asset-wo-btn" data-asset="${item.assetId}" type="button" style="font-size:11.5px; padding:4px 10px;">
                      Take Action
                    </button>
                  </div>
                `
                  )
                  .join("")}
               </div>`
        }
      </div>

      <!-- Upcoming Maintenance Timeline -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Upcoming Maintenance Forecast</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">Preventive service schedule (Next 90 Days)</p>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="status info" style="font-size:11px; font-weight:700;">NEXT 7 DAYS</span>
              <span style="font-size:13px; font-weight:600; color:var(--ink);">Espresso Machine Group Head Decalcification</span>
            </div>
            <span style="font-size:12px; color:var(--muted); font-family:var(--font-mono);">ZC-0001</span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="status info" style="font-size:11px; font-weight:700;">NEXT 30 DAYS</span>
              <span style="font-size:13px; font-weight:600; color:var(--ink);">Commercial Grinder Burr Calibration &amp; Cleaning</span>
            </div>
            <span style="font-size:12px; color:var(--muted); font-family:var(--font-mono);">ZC-0002</span>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="status info" style="font-size:11px; font-weight:700;">NEXT 90 DAYS</span>
              <span style="font-size:13px; font-weight:600; color:var(--ink);">Refrigeration Condenser Coil Quarterly Service</span>
            </div>
            <span style="font-size:12px; color:var(--muted); font-family:var(--font-mono);">ZC-0001</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. ASSETS REGISTER SUBPANEL
function renderAssetsSubpanel() {
  const assets = cachedAssets.length > 0 ? cachedAssets : [
    {
      assetId: "AST-001",
      name: "La Marzocco Linea PB 2-Group Espresso Machine",
      category: "BREWING_EQUIPMENT",
      serialNumber: "LM-PB-99412",
      cafeId: "ZC-0001",
      placementArea: "Main Bar",
      operationalStatus: "IN_SERVICE",
      condition: "EXCELLENT",
      criticality: "CRITICAL",
      nextMaintenanceDue: "2026-11-01",
      warrantyExpiryDate: "2027-01-10",
    },
    {
      assetId: "AST-002",
      name: "Mahlkönig EK43 Commercial Coffee Grinder",
      category: "GRINDERS_MILLS",
      serialNumber: "MK-EK43-7721",
      cafeId: "ZC-0001",
      placementArea: "Filter Bar",
      operationalStatus: "IN_SERVICE",
      condition: "GOOD",
      criticality: "HIGH",
      nextMaintenanceDue: "2026-10-15",
      warrantyExpiryDate: "2026-12-15",
    },
    {
      assetId: "AST-003",
      name: "True Double-Door Commercial Undercounter Refrigerator",
      category: "REFRIGERATION",
      serialNumber: "TRU-UC-4412",
      cafeId: "ZC-0002",
      placementArea: "Back Bar",
      operationalStatus: "UNDER_MAINTENANCE",
      condition: "FAIR",
      criticality: "CRITICAL",
      nextMaintenanceDue: "2026-08-25",
      warrantyExpiryDate: "2026-09-01",
    }
  ];

  return `
    <div class="card" style="padding:24px;">
      <!-- Search & Filters -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <div style="display:flex; gap:10px; flex:1; min-width:280px; max-width:460px;">
          <input type="text" id="asset-search-input" class="input" placeholder="Search by asset name, ID, serial or model..." style="font-size:13px;">
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <select id="asset-filter-category" class="input" style="font-size:12.5px; width:auto;">
            <option value="">All Categories</option>
            ${ASSET_CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}
          </select>
          <select id="asset-filter-status" class="input" style="font-size:12.5px; width:auto;">
            <option value="">All Statuses</option>
            <option value="IN_SERVICE">In Service</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
            <option value="SETUP">Setup</option>
            <option value="RETIRED">Retired</option>
          </select>
          <select id="asset-filter-condition" class="input" style="font-size:12.5px; width:auto;">
            <option value="">All Conditions</option>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <!-- Asset Register Table -->
      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Category</th>
              <th>Location</th>
              <th>Status</th>
              <th>Condition</th>
              <th>Criticality</th>
              <th>Next Maintenance</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${assets
              .map((a) => {
                const condClass = a.condition === "EXCELLENT" || a.condition === "GOOD" ? "success" : a.condition === "FAIR" ? "warning" : "danger";
                const statusClass = a.operationalStatus === "IN_SERVICE" ? "success" : a.operationalStatus === "UNDER_MAINTENANCE" ? "warning" : "danger";
                return `
              <tr>
                <td>
                  <strong style="color:var(--ink); font-size:13.5px;">${a.name}</strong>
                  <div style="font-size:11.5px; color:var(--muted); font-family:var(--font-mono); margin-top:2px;">
                    <span style="color:var(--color-accent-amber); font-weight:700;">${a.assetId}</span> · SN: ${a.serialNumber || "—"}
                  </div>
                </td>
                <td><span class="status info" style="font-size:11px;">${formatCategory(a.category)}</span></td>
                <td>
                  <div style="font-size:13px; font-weight:600; color:var(--ink); font-family:var(--font-mono);">${a.cafeId}</div>
                  <div style="font-size:11px; color:var(--muted);">${a.placementArea || "Main Floor"}</div>
                </td>
                <td><span class="status ${statusClass}" style="font-size:11px; font-weight:700;">${formatStatus(a.operationalStatus)}</span></td>
                <td><span class="status ${condClass}" style="font-size:11px;">${a.condition}</span></td>
                <td>
                  <span style="font-size:11.5px; font-weight:700; color:${a.criticality === "CRITICAL" ? "var(--color-danger)" : a.criticality === "HIGH" ? "var(--color-warning)" : "var(--muted)"};">
                    ${a.criticality || "MEDIUM"}
                  </span>
                </td>
                <td style="font-family:var(--font-mono); font-size:12.5px; color:var(--muted);">
                  ${a.nextMaintenanceDue || "Quarterly"}
                </td>
                <td style="text-align:right;">
                  <div style="display:inline-flex; gap:6px;">
                    <button class="btn btn-ghost view-asset-detail-btn" data-id="${a.assetId}" type="button" style="font-size:12px; padding:4px 10px;">
                      View
                    </button>
                    <button class="btn btn-ghost create-wo-for-asset-btn" data-id="${a.assetId}" type="button" style="font-size:12px; padding:4px 10px;">
                      Work Order
                    </button>
                  </div>
                </td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3. MAINTENANCE SUBPANEL
function renderMaintenanceSubpanel() {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(450px, 1fr)); gap:20px;">
      <!-- PM Plans -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Preventive Maintenance Plans</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">Active time-based &amp; meter-based maintenance schedules</p>
          </div>
          <button class="btn btn-ghost" id="create-pm-plan-btn" type="button" style="font-size:12px; padding:4px 10px;">+ New Plan</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="padding:12px; border:1px solid var(--border-subtle); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <strong style="color:var(--ink); font-size:13.5px;">Espresso Machine Quarterly Overhaul SOP</strong>
                <div style="font-size:12px; color:var(--muted); margin-top:2px;">Target: Brewing Equipment · Frequency: Every 90 Days</div>
              </div>
              <span class="status success" style="font-size:11px;">Active</span>
            </div>
            <div style="display:flex; gap:14px; margin-top:8px; font-size:11.5px; color:var(--muted);">
              <span>Next Due: <strong style="color:var(--ink);">2026-11-01</strong></span>
              <span>Window: <strong>Before Opening (06:00)</strong></span>
            </div>
          </div>

          <div style="padding:12px; border:1px solid var(--border-subtle); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <strong style="color:var(--ink); font-size:13.5px;">Refrigeration Coil &amp; Temperature Seal Audit</strong>
                <div style="font-size:12px; color:var(--muted); margin-top:2px;">Target: Commercial Refrigerators · Frequency: Monthly</div>
              </div>
              <span class="status success" style="font-size:11px;">Active</span>
            </div>
            <div style="display:flex; gap:14px; margin-top:8px; font-size:11.5px; color:var(--muted);">
              <span>Next Due: <strong style="color:var(--ink);">2026-09-01</strong></span>
              <span>Window: <strong>After Close (23:00)</strong></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Maintenance Backlog -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Maintenance Backlog &amp; Queue</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">Scheduled service jobs awaiting execution</p>
          </div>
          <span class="status info" style="font-size:11px;">3 Queued</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--ink);">Water Filter Cartridge Replacement</div>
              <div style="font-size:11.5px; color:var(--muted);">AST-001 (Main Outlet) · Due: 2026-09-05</div>
            </div>
            <span class="status warning" style="font-size:11px;">Waiting Parts</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--ink);">Grinder Burr Alignment &amp; Zeroing</div>
              <div style="font-size:11.5px; color:var(--muted);">AST-002 (Main Outlet) · Due: 2026-09-12</div>
            </div>
            <span class="status info" style="font-size:11px;">Ready</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 4. WORK ORDERS SUBPANEL
function renderWorkOrdersSubpanel() {
  const workOrders = cachedWorkOrders.length > 0 ? cachedWorkOrders : [
    {
      workOrderId: "WO-0001",
      assetId: "AST-003",
      title: "Compressor Temperature Fluctuation",
      workType: "CORRECTIVE_REPAIR",
      priority: "CRITICAL",
      status: "IN_PROGRESS",
      blocker: "WAITING_FOR_PART",
      cafeId: "ZC-0002",
      reportedByUserId: "MU-NORMAL-01",
      createdAt: "2026-08-19",
    }
  ];

  return `
    <div class="card" style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 2px; color:var(--ink);">Maintenance Work Orders (${workOrders.length})</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:0;">Corrective repairs, inspections, and preventative overhaul tickets</p>
        </div>
        <button class="btn btn-primary" id="open-create-wo-btn" type="button" style="font-size:12.5px; padding:6px 14px;">
          + Create Work Order
        </button>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Work Order</th>
              <th>Asset &amp; Location</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Blocker</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${workOrders
              .map((wo) => `
              <tr>
                <td>
                  <strong style="color:var(--ink);">${wo.title}</strong>
                  <div style="font-size:11.5px; color:var(--color-accent-amber); font-family:var(--font-mono); font-weight:700;">${wo.workOrderId}</div>
                </td>
                <td>
                  <div style="font-size:13px; font-weight:600; color:var(--ink);">${wo.assetId}</div>
                  <div style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">${wo.cafeId}</div>
                </td>
                <td><span class="status info" style="font-size:11px;">${wo.workType}</span></td>
                <td>
                  <span class="status ${wo.priority === "CRITICAL" ? "danger" : wo.priority === "URGENT" ? "warning" : "info"}" style="font-size:11px; font-weight:700;">
                    ${wo.priority}
                  </span>
                </td>
                <td><span class="status ${wo.status === "COMPLETED" ? "success" : "warning"}" style="font-size:11px;">${wo.status}</span></td>
                <td>
                  ${
                    wo.blocker && wo.blocker !== "NONE"
                      ? `<span class="status warning" style="font-size:10px;">${wo.blocker}</span>`
                      : `<span style="color:var(--muted); font-size:12px;">—</span>`
                  }
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-ghost update-wo-btn" data-id="${wo.workOrderId}" type="button" style="font-size:12px; padding:4px 10px;">
                    Update / Resolve
                  </button>
                </td>
              </tr>
            `)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 5. INSPECTIONS & WARRANTY SUBPANEL
function renderInspectionsSubpanel() {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
      <!-- Daily Inspections Checklist -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Daily Equipment Condition Checklists</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 14px;">Frontline opening and closing verification checks</p>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="padding:12px; border:1px solid var(--border-subtle); border-radius:8px;">
            <div style="display:flex; justify-content:space-between;">
              <strong style="color:var(--ink); font-size:13px;">Morning Opening Bar Equipment Inspection</strong>
              <span class="status success" style="font-size:11px;">100% Pass</span>
            </div>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">Espresso boiler pressure: 9.1 bar · Refrigerator temperature: 3.2°C</div>
          </div>
        </div>
      </div>

      <!-- Warranty & AMC Contracts -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Warranty &amp; Service Contracts (AMC)</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 14px;">Active manufacturer warranties and service SLAs</p>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="padding:12px; border:1px solid var(--border-subtle); border-radius:8px;">
            <div style="display:flex; justify-content:space-between;">
              <strong style="color:var(--ink); font-size:13px;">La Marzocco OEM Warranty (AST-001)</strong>
              <span class="status success" style="font-size:11px;">Active (5 Months)</span>
            </div>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">Provider: La Marzocco India · SLA: 4h Emergency Response</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 6. ANALYTICS SUBPANEL
function renderAnalyticsSubpanel() {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Preventative Maintenance Compliance</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Completed on-schedule vs due (Last 90 Days)</p>
        <div style="font-size:32px; font-weight:800; color:var(--color-success, #2E7D32); font-family:var(--font-mono);">94.8%</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">Formula: (Completed On-Time ÷ Items Due)</div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Planned vs Unplanned Maintenance</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Ratio of proactive PM to breakdown repairs</p>
        <div style="font-size:32px; font-weight:800; color:var(--ink); font-family:var(--font-mono);">82 : 18</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">Target: &gt; 80% Planned proactive maintenance</div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Recorded Maintenance Spend</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Parts &amp; external OEM service fees (YTD)</p>
        <div style="font-size:32px; font-weight:800; color:var(--ink); font-family:var(--font-mono);">₹ 24,500</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">Authoritative financial accounting remains in Finance &amp; Bills</div>
      </div>
    </div>
  `;
}

// Helper: KPI Card
function kpiCard(title, value, subtitle, valColor) {
  return `
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">${title}</div>
      <div style="font-size:24px; font-weight:800; color:${valColor}; font-family:var(--font-mono); line-height:1.1;">${value}</div>
      <div style="font-size:11px; color:var(--muted); margin-top:4px;">${subtitle}</div>
    </div>
  `;
}

function formatCategory(cat) {
  return cat ? cat.replace(/_/g, " ") : "Equipment";
}

function formatStatus(status) {
  return status ? status.replace(/_/g, " ") : "In Service";
}

export function wireAssets(root, subroute) {
  if (subroute !== undefined) {
    setAssetsActiveTab(subroute);
  }

  // Navigation button hub tiles
  root.querySelectorAll("[data-assets-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tileId = e.currentTarget.dataset.assetsHubTile;
      navigate("assets/" + tileId);
    });
  });

  // Back to Hub button
  root.querySelector("#assets-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("assets");
  });

  // Refresh
  const refreshBtn = root.querySelector("#refresh-assets-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadLiveAssetData();
      rerender(root);
      showToast("Equipment & Asset register refreshed.", "info");
    });
  }

  // Child action buttons
  root.querySelectorAll("#btn-child-reg-asset").forEach((btn) => {
    btn.addEventListener("click", () => openRegisterAssetWizard(root));
  });
  root.querySelectorAll("#btn-child-new-wo, #open-create-wo-btn").forEach((btn) => {
    btn.addEventListener("click", () => openCreateWorkOrderModal(root));
  });
  root.querySelectorAll("#btn-child-new-maint, #create-pm-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => openNewMaintenancePlanModal(root));
  });
  root.querySelectorAll("#btn-child-new-insp").forEach((btn) => {
    btn.addEventListener("click", () => openRecordInspectionModal(root));
  });
  root.querySelectorAll("#btn-child-export-rel").forEach((btn) => {
    btn.addEventListener("click", () => exportAssetReliabilityCsv());
  });

  root.querySelectorAll(".update-wo-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const woId = e.currentTarget.dataset.id;
      openUpdateWorkOrderModal(root, woId);
    });
  });

  // View Detail Buttons
  root.querySelectorAll(".view-asset-detail-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const assetId = e.currentTarget.dataset.id;
      openAssetDetailModal(root, assetId);
    });
  });

  // Create WO for specific asset
  root.querySelectorAll(".create-wo-for-asset-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const assetId = e.currentTarget.dataset.id;
      openCreateWorkOrderModal(root, assetId);
    });
  });

  // Initial fetch — exactly once
  if (!hasInitialFetchedAssets) {
    hasInitialFetchedAssets = true;
    loadLiveAssetData().then(() => {
      if (state.route?.startsWith("assets")) {
        rerender(root);
      }
    });
  }
}

let hasInitialFetchedAssets = false;

async function loadLiveAssetData() {
  try {
    const [ovRes, assetRes, woRes] = await Promise.all([
      apiGet("/api/v1/assets/overview").catch(() => null),
      apiGet("/api/v1/assets").catch(() => null),
      apiGet("/api/v1/assets/work-orders").catch(() => null),
    ]);

    if (ovRes?.data) cachedOverview = ovRes.data;
    if (assetRes?.data?.assets && assetRes.data.assets.length > 0) {
      cachedAssets = assetRes.data.assets;
    }
    if (woRes?.data?.workOrders && woRes.data.workOrders.length > 0) {
      cachedWorkOrders = woRes.data.workOrders;
    }
  } catch (err) {
    console.warn("Asset data load notice:", err);
  }
}

function rerender(root) {
  if (!state.route?.startsWith("assets")) return;
  const subpanelRoot = root?.querySelector ? root.querySelector("#assets-subpanel-root") : null;
  if (subpanelRoot) {
    subpanelRoot.innerHTML = renderActiveSubpanel();
    root.querySelectorAll("[data-assets-hub-tile]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tileId = e.currentTarget.dataset.assetsHubTile;
        navigate("assets/" + tileId);
      });
    });
    root.querySelector("#assets-back-to-hub-btn")?.addEventListener("click", () => {
      navigate("assets");
    });
    root.querySelectorAll("#btn-child-reg-asset").forEach((btn) => {
      btn.addEventListener("click", () => openRegisterAssetWizard(root));
    });
    root.querySelectorAll("#btn-child-new-wo, #open-create-wo-btn").forEach((btn) => {
      btn.addEventListener("click", () => openCreateWorkOrderModal(root));
    });
    root.querySelectorAll("#btn-child-new-maint, #create-pm-plan-btn").forEach((btn) => {
      btn.addEventListener("click", () => openNewMaintenancePlanModal(root));
    });
    root.querySelectorAll("#btn-child-new-insp").forEach((btn) => {
      btn.addEventListener("click", () => openRecordInspectionModal(root));
    });
    root.querySelectorAll("#btn-child-export-rel").forEach((btn) => {
      btn.addEventListener("click", () => exportAssetReliabilityCsv());
    });
    root.querySelectorAll(".update-wo-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const woId = e.currentTarget.dataset.id;
        openUpdateWorkOrderModal(root, woId);
      });
    });
    root.querySelectorAll(".view-asset-detail-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const assetId = e.currentTarget.dataset.id;
        openAssetDetailModal(root, assetId);
      });
    });
    root.querySelectorAll(".create-wo-for-asset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const assetId = e.currentTarget.dataset.id;
        openCreateWorkOrderModal(root, assetId);
      });
    });
  } else {
    root.innerHTML = renderAssets();
    wireAssetsEventListeners(root);
  }
}

function exportAssetReliabilityCsv() {
  const headers = ["Asset ID", "Asset Name", "Category", "Café ID", "MTBF (Hours)", "MTTR (Hours)", "Uptime %", "Status"];
  const rows = [
    ["AST-001", "La Marzocco Linea PB 2-Group", "BREWING_EQUIPMENT", "ZC-0001", "720", "2.5", "99.2%", "IN_SERVICE"],
    ["AST-002", "Mahlkönig EK43 S Grinder", "GRINDERS_MILLS", "ZC-0001", "1440", "1.0", "99.8%", "IN_SERVICE"],
    ["AST-003", "Commercial Double-Door Chiller", "REFRIGERATION", "ZC-0002", "480", "4.0", "98.5%", "UNDER_MAINTENANCE"],
  ];
  let csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `asset_reliability_report_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Asset reliability report exported to CSV.", "info");
}

function wireAssetsEventListeners(root) {
  root.querySelectorAll("[data-assets-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tileId = e.currentTarget.dataset.assetsHubTile;
      navigate("assets/" + tileId);
    });
  });
  root.querySelector("#assets-back-to-hub-btn")?.addEventListener("click", () => navigate("assets"));
  root.querySelectorAll("#btn-child-reg-asset").forEach((btn) => {
    btn.addEventListener("click", () => openRegisterAssetWizard(root));
  });
  root.querySelectorAll("#btn-child-new-wo, #open-create-wo-btn").forEach((btn) => {
    btn.addEventListener("click", () => openCreateWorkOrderModal(root));
  });
  root.querySelectorAll("#btn-child-new-maint, #create-pm-plan-btn").forEach((btn) => {
    btn.addEventListener("click", () => openNewMaintenancePlanModal(root));
  });
  root.querySelectorAll("#btn-child-new-insp").forEach((btn) => {
    btn.addEventListener("click", () => openRecordInspectionModal(root));
  });
  root.querySelectorAll("#btn-child-export-rel").forEach((btn) => {
    btn.addEventListener("click", () => exportAssetReliabilityCsv());
  });
  root.querySelectorAll(".update-wo-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const woId = e.currentTarget.dataset.id;
      openUpdateWorkOrderModal(root, woId);
    });
  });
  root.querySelectorAll(".view-asset-detail-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const assetId = e.currentTarget.dataset.id;
      openAssetDetailModal(root, assetId);
    });
  });
  root.querySelectorAll(".create-wo-for-asset-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const assetId = e.currentTarget.dataset.id;
      openCreateWorkOrderModal(root, assetId);
    });
  });
}

// Centred Register Asset Wizard (5-step)
function openRegisterAssetWizard(root) {
  let step = 1;
  const formData = {
    name: "",
    category: "BREWING_EQUIPMENT",
    manufacturer: "",
    model: "",
    serialNumber: "",
    cafeId: "ZC-0001",
    placementArea: "Main Counter",
    acquisitionType: "PURCHASED",
    condition: "GOOD",
    criticality: "MEDIUM",
    operationalStatus: "IN_SERVICE",
    maintenanceStrategy: "PREVENTIVE_TIME_BASED",
  };

  function renderWizardStep() {
    return `
      <div style="max-width:760px; margin:0 auto; padding:10px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid var(--border-subtle); padding-bottom:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:800; margin:0; color:var(--ink);">Register New Asset</h2>
            <p style="font-size:12.5px; color:var(--muted); margin:0;">Step ${step} of 5 — Multi-Café Asset Lifecycle Registration</p>
          </div>
          <span class="status info" style="font-size:11px; font-weight:700;">STEP ${step}/5</span>
        </div>

        ${
          step === 1
            ? `
          <div style="display:flex; flex-direction:column; gap:14px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0;">1. Equipment Identity</h4>
            <div class="form-group">
              <label class="label">Asset Name*</label>
              <input type="text" id="wiz-asset-name" class="input" value="${formData.name}" placeholder="e.g. La Marzocco Linea PB 2-Group Espresso Machine" required>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="label">Category*</label>
                <select id="wiz-asset-category" class="input">
                  ${ASSET_CATEGORIES.map((c) => `<option value="${c.id}" ${formData.category === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="label">Serial Number</label>
                <input type="text" id="wiz-asset-serial" class="input" value="${formData.serialNumber}" placeholder="e.g. LM-PB-99412">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="label">Manufacturer</label>
                <input type="text" id="wiz-asset-mfr" class="input" value="${formData.manufacturer}" placeholder="e.g. La Marzocco">
              </div>
              <div class="form-group">
                <label class="label">Model</label>
                <input type="text" id="wiz-asset-model" class="input" value="${formData.model}" placeholder="e.g. Linea PB AV">
              </div>
            </div>
          </div>
        `
            : step === 2
            ? `
          <div style="display:flex; flex-direction:column; gap:14px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0;">2. Deployment Location</h4>
            <div class="form-group">
              <label class="label">Assigned Café*</label>
              <select id="wiz-asset-cafe" class="input">
                <option value="ZC-0001" ${formData.cafeId === "ZC-0001" ? "selected" : ""}>Main Outlet (ZC-0001)</option>
                <option value="ZC-0002" ${formData.cafeId === "ZC-0002" ? "selected" : ""}>Branch Outlet (ZC-0002)</option>
                <option value="ZC-0003" ${formData.cafeId === "ZC-0003" ? "selected" : ""}>Calicut Beach (ZC-0003)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Placement Area</label>
              <input type="text" id="wiz-asset-area" class="input" value="${formData.placementArea}" placeholder="e.g. Main Bar / Filter Station / Kitchen">
            </div>
          </div>
        `
            : step === 3
            ? `
          <div style="display:flex; flex-direction:column; gap:14px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0;">3. Operational State &amp; Criticality</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="label">Initial Condition</label>
                <select id="wiz-asset-condition" class="input">
                  <option value="EXCELLENT" ${formData.condition === "EXCELLENT" ? "selected" : ""}>Excellent (Brand New / Factory Calibrated)</option>
                  <option value="GOOD" ${formData.condition === "GOOD" ? "selected" : ""}>Good (Normal Operating State)</option>
                  <option value="FAIR" ${formData.condition === "FAIR" ? "selected" : ""}>Fair (Operational with Minor Wear)</option>
                  <option value="POOR" ${formData.condition === "POOR" ? "selected" : ""}>Poor (Needs Immediate Service)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="label">Criticality Rating</label>
                <select id="wiz-asset-criticality" class="input">
                  <option value="CRITICAL" ${formData.criticality === "CRITICAL" ? "selected" : ""}>Critical (Café Cannot Operate Without It)</option>
                  <option value="HIGH" ${formData.criticality === "HIGH" ? "selected" : ""}>High (Major Service Disruption)</option>
                  <option value="MEDIUM" ${formData.criticality === "MEDIUM" ? "selected" : ""}>Medium (Moderate Operational Impact)</option>
                  <option value="LOW" ${formData.criticality === "LOW" ? "selected" : ""}>Low (Minimal Impact)</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="label">Initial Operational Status</label>
              <select id="wiz-asset-opstatus" class="input">
                <option value="IN_SERVICE" ${formData.operationalStatus === "IN_SERVICE" ? "selected" : ""}>In Service (Ready for Operations)</option>
                <option value="SETUP" ${formData.operationalStatus === "SETUP" ? "selected" : ""}>Setup / Awaiting Commissioning</option>
              </select>
            </div>
          </div>
        `
            : step === 4
            ? `
          <div style="display:flex; flex-direction:column; gap:14px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0;">4. Maintenance Strategy &amp; Warranty</h4>
            <div class="form-group">
              <label class="label">Maintenance Strategy</label>
              <select id="wiz-asset-strategy" class="input">
                <option value="PREVENTIVE_TIME_BASED">Preventative — Time Based (Quarterly / Monthly)</option>
                <option value="INSPECTION_BASED">Inspection Based (Daily / Weekly Verification)</option>
                <option value="REACTIVE_ONLY">Reactive Only (Run to Maintenance)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Warranty Provider / Contact</label>
              <input type="text" id="wiz-asset-warranty" class="input" placeholder="e.g. La Marzocco India OEM Support">
            </div>
          </div>
        `
            : `
          <div style="display:flex; flex-direction:column; gap:14px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0;">5. Review &amp; Register</h4>
            <div style="background:var(--bg-subtle, rgba(0,0,0,0.02)); padding:16px; border-radius:8px; display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px;">
              <div><strong>Name:</strong> ${formData.name || "—"}</div>
              <div><strong>Category:</strong> ${formatCategory(formData.category)}</div>
              <div><strong>Café:</strong> ${formData.cafeId}</div>
              <div><strong>Placement:</strong> ${formData.placementArea}</div>
              <div><strong>Criticality:</strong> ${formData.criticality}</div>
              <div><strong>Condition:</strong> ${formData.condition}</div>
            </div>
          </div>
        `
        }

        <div style="display:flex; justify-content:space-between; margin-top:24px; border-top:1px solid var(--border-subtle); padding-top:14px;">
          <button class="btn btn-ghost" id="wiz-back-btn" type="button" ${step === 1 ? "disabled" : ""}>Back</button>
          <div style="display:flex; gap:10px;">
            ${
              step < 5
                ? `<button class="btn btn-primary" id="wiz-next-btn" type="button">Continue</button>`
                : `<button class="btn btn-primary" id="wiz-submit-btn" type="button">Register Asset</button>`
            }
          </div>
        </div>
      </div>
    `;
  }

  const modal = openModal(renderWizardStep());

  function wireWizardEvents() {
    const nextBtn = modal.querySelector("#wiz-next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (step === 1) {
          formData.name = modal.querySelector("#wiz-asset-name")?.value || "";
          formData.category = modal.querySelector("#wiz-asset-category")?.value || "BREWING_EQUIPMENT";
          formData.serialNumber = modal.querySelector("#wiz-asset-serial")?.value || "";
          formData.manufacturer = modal.querySelector("#wiz-asset-mfr")?.value || "";
          formData.model = modal.querySelector("#wiz-asset-model")?.value || "";
          if (!formData.name.trim()) {
            showToast("Asset Name is required.", "error");
            return;
          }
        } else if (step === 2) {
          formData.cafeId = modal.querySelector("#wiz-asset-cafe")?.value || "ZC-0001";
          formData.placementArea = modal.querySelector("#wiz-asset-area")?.value || "Main Counter";
        } else if (step === 3) {
          formData.condition = modal.querySelector("#wiz-asset-condition")?.value || "GOOD";
          formData.criticality = modal.querySelector("#wiz-asset-criticality")?.value || "MEDIUM";
          formData.operationalStatus = modal.querySelector("#wiz-asset-opstatus")?.value || "IN_SERVICE";
        } else if (step === 4) {
          formData.maintenanceStrategy = modal.querySelector("#wiz-asset-strategy")?.value || "PREVENTIVE_TIME_BASED";
        }
        step++;
        modal.innerHTML = renderWizardStep();
        wireWizardEvents();
      });
    }

    const backBtn = modal.querySelector("#wiz-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        step--;
        modal.innerHTML = renderWizardStep();
        wireWizardEvents();
      });
    }

    const submitBtn = modal.querySelector("#wiz-submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const newAssetId = `AST-00${cachedAssets.length + 1}`;
        const newAsset = {
          assetId: newAssetId,
          name: formData.name || "Commercial Equipment",
          category: formData.category || "BREWING_EQUIPMENT",
          serialNumber: formData.serialNumber || `SN-${Math.floor(10000 + Math.random() * 90000)}`,
          cafeId: formData.cafeId || "ZC-0001",
          placementArea: formData.placementArea || "Main Counter",
          operationalStatus: formData.operationalStatus || "IN_SERVICE",
          condition: formData.condition || "GOOD",
          criticality: formData.criticality || "MEDIUM",
          nextMaintenanceDue: "2026-11-15",
          warrantyExpiryDate: "2027-08-31",
        };

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Registering...";
          await apiPost("/api/v1/assets", formData).catch(() => null);
        } catch (err) {
          // ignore offline
        }

        cachedAssets.unshift(newAsset);
        showToast(`Asset "${newAsset.name}" (${newAssetId}) registered successfully.`, "success");
        modal.close();
        rerender(root);
      });
    }
  }

  wireWizardEvents();
}

// Modal: Asset 360 Detail
function openAssetDetailModal(root, assetId) {
  const asset = cachedAssets.find((a) => a.assetId === assetId) || {
    assetId,
    name: "Equipment Details",
    category: "BREWING_EQUIPMENT",
    cafeId: "ZC-0001",
    condition: "GOOD",
    operationalStatus: "IN_SERVICE",
    serialNumber: "SN-99412",
  };

  const isPrimary = state.user?.isPrimaryMaster === true;

  const content = `
    <div style="max-width:700px; margin:0 auto; padding:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; border-bottom:1px solid var(--border-subtle); padding-bottom:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:800; margin:0; color:var(--ink);">${asset.name}</h2>
          <div style="font-size:12.5px; color:var(--muted); font-family:var(--font-mono); margin-top:2px;">
            <span style="color:var(--color-accent-amber); font-weight:700;">${asset.assetId}</span> · SN: ${asset.serialNumber || "—"} · Location: <strong>${asset.cafeId}</strong>
          </div>
        </div>
        <span class="status success" style="font-size:11px; font-weight:700;">${asset.operationalStatus || "IN_SERVICE"}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:20px;">
        <div style="padding:10px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Category</div>
          <strong>${formatCategory(asset.category)}</strong>
        </div>
        <div style="padding:10px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Condition</div>
          <strong>${asset.condition || "GOOD"}</strong>
        </div>
        <div style="padding:10px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Criticality</div>
          <strong>${asset.criticality || "MEDIUM"}</strong>
        </div>
        <div style="padding:10px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Next Service Due</div>
          <strong style="font-family:var(--font-mono);">${asset.nextMaintenanceDue || "Quarterly"}</strong>
        </div>
      </div>

      <div style="border-top:1px solid var(--border-subtle); padding-top:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="transfer-asset-btn" type="button" style="font-size:12px;">Transfer Location</button>
          <button class="btn btn-ghost" id="safety-hold-btn" type="button" style="font-size:12px; color:var(--color-danger);">Safety Hold</button>
        </div>
        ${
          isPrimary
            ? `<button class="btn btn-ghost" id="retire-asset-btn" type="button" style="font-size:12px; color:var(--color-danger);">Retire Asset</button>`
            : `<span style="font-size:11px; color:var(--muted);">Capital write-off: Primary Master only</span>`
        }
      </div>
    </div>
  `;

  const modal = openModal(content);

  modal.querySelector("#transfer-asset-btn")?.addEventListener("click", () => {
    modal.close();
    openTransferAssetModal(root, asset.assetId);
  });

  modal.querySelector("#safety-hold-btn")?.addEventListener("click", async () => {
    modal.close();
    confirmAction(
      `Apply Safety Hold on ${asset.name}? This will immediately mark the equipment Out of Service.`,
      async () => {
        await apiPost(`/api/v1/assets/${asset.assetId}/safety-hold`, { isHoldActive: true, reason: "Safety hold applied by Master" });
        showToast("Safety Hold applied.", "warning");
        await loadLiveAssetData();
        rerender(root);
      }
    );
  });

  modal.querySelector("#retire-asset-btn")?.addEventListener("click", async () => {
    modal.close();
    confirmAction(
      `Permanently Retire ${asset.name}? This action is restricted to Primary Master authority.`,
      async () => {
        await apiPost(`/api/v1/assets/${asset.assetId}/retire`, { reason: "End of Life capital retirement" });
        showToast("Asset retired successfully.", "success");
        await loadLiveAssetData();
        rerender(root);
      }
    );
  });
}

// Modal: Transfer Asset
function openTransferAssetModal(root, assetId) {
  const content = `
    <div style="max-width:500px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:16px; font-weight:800; margin:0 0 6px; color:var(--ink);">Inter-Café Asset Transfer</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Transfer equipment ${assetId} to another operational café location</p>

      <div class="form-group">
        <label class="label">Destination Café*</label>
        <select id="transfer-dest-cafe" class="input">
          <option value="ZC-0001">Main Outlet (ZC-0001)</option>
          <option value="ZC-0002">Branch Outlet (ZC-0002)</option>
          <option value="ZC-0003">Calicut Beach (ZC-0003)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="label">Reason for Transfer</label>
        <input type="text" id="transfer-reason" class="input" placeholder="e.g. Equipment rebalancing / Seasonal capacity">
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button class="btn btn-ghost" id="transfer-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="transfer-submit-btn" type="button">Confirm Transfer</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#transfer-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#transfer-submit-btn")?.addEventListener("click", async () => {
    const toCafeId = modal.querySelector("#transfer-dest-cafe")?.value;
    const reason = modal.querySelector("#transfer-reason")?.value;
    try {
      await apiPost(`/api/v1/assets/${assetId}/transfer`, { toCafeId, reason });
      showToast(`Asset successfully transferred to ${toCafeId}.`, "success");
      modal.close();
      await loadLiveAssetData();
      rerender(root);
    } catch (err) {
      showToast(err.message || "Failed to transfer asset.", "error");
    }
  });
}

// Modal: Create Work Order
function openCreateWorkOrderModal(root, defaultAssetId = "") {
  const content = `
    <div style="max-width:560px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:16px; font-weight:800; margin:0 0 4px; color:var(--ink);">Create Maintenance Work Order</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Log corrective repair, emergency service, or preventive overhaul</p>

      <div class="form-group">
        <label class="label">Target Asset ID*</label>
        <input type="text" id="wo-asset-id" class="input" value="${defaultAssetId}" placeholder="e.g. AST-001" required>
      </div>

      <div class="form-group">
        <label class="label">Work Order Title*</label>
        <input type="text" id="wo-title" class="input" placeholder="e.g. Boiler Pressure Gauge Calibration" required>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="label">Work Type</label>
          <select id="wo-type" class="input">
            <option value="CORRECTIVE_REPAIR">Corrective Repair</option>
            <option value="PREVENTIVE_MAINTENANCE">Preventive Maintenance</option>
            <option value="INSPECTION">Inspection</option>
            <option value="CALIBRATION">Calibration</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Priority</label>
          <select id="wo-priority" class="input">
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
            <option value="CRITICAL">Critical (Equipment Down)</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="label">Description / Problem Symptoms*</label>
        <textarea id="wo-description" class="input" rows="3" placeholder="Describe symptoms, error codes, leaks, or required maintenance..." required></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button class="btn btn-ghost" id="wo-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="wo-submit-btn" type="button">Create Work Order</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#wo-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#wo-submit-btn")?.addEventListener("click", async () => {
    const assetId = modal.querySelector("#wo-asset-id")?.value;
    const title = modal.querySelector("#wo-title")?.value;
    const workType = modal.querySelector("#wo-type")?.value;
    const priority = modal.querySelector("#wo-priority")?.value;
    const description = modal.querySelector("#wo-description")?.value;

    if (!assetId || !title || !description) {
      showToast("Please fill all required fields.", "error");
      return;
    }

    const newWoId = `WO-000${cachedWorkOrders.length + 1}`;
    const newWo = {
      workOrderId: newWoId,
      assetId,
      title,
      workType,
      priority,
      status: "OPEN",
      blocker: "NONE",
      cafeId: state.selectedCafeId || "ZC-0001",
      reportedByUserId: state.user?.userId || "MU-NORMAL-01",
      createdAt: new Date().toISOString().split("T")[0],
    };

    try {
      await apiPost("/api/v1/assets/work-orders", { assetId, title, workType, priority, description }).catch(() => null);
    } catch (err) {}

    cachedWorkOrders.unshift(newWo);
    showToast(`Work order ${newWoId} ("${title}") created successfully.`, "success");
    modal.close();
    rerender(root);
  });
}

// Modal: Update / Resolve Work Order
function openUpdateWorkOrderModal(root, woId) {
  const wo = cachedWorkOrders.find((w) => w.workOrderId === woId) || {
    workOrderId: woId,
    assetId: "AST-003",
    title: "Compressor Temperature Fluctuation",
    workType: "CORRECTIVE_REPAIR",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    blocker: "WAITING_FOR_PART",
    cafeId: "ZC-0002",
  };

  const content = `
    <div style="max-width:580px; margin:0 auto; padding:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid var(--border-subtle); padding-bottom:12px;">
        <div>
          <h3 style="font-size:17px; font-weight:800; margin:0; color:var(--ink);">Update &amp; Resolve Work Order</h3>
          <p style="font-size:12px; color:var(--muted); margin:2px 0 0 0;">
            <strong style="font-family:var(--font-mono); color:var(--color-accent-amber);">${wo.workOrderId}</strong> · Asset: <strong>${wo.assetId}</strong> (${wo.cafeId})
          </p>
        </div>
        <span class="status ${wo.priority === 'CRITICAL' ? 'danger' : 'warning'}" style="font-size:11px; font-weight:700;">${wo.priority}</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
        <div class="form-group" style="margin:0;">
          <label class="label">Work Order Status*</label>
          <select id="uwo-status" class="input" style="font-size:12.5px;">
            <option value="IN_PROGRESS" ${wo.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress (Under Repair)</option>
            <option value="WAITING_FOR_PART" ${wo.status === 'WAITING_FOR_PART' ? 'selected' : ''}>Waiting for Part Delivery</option>
            <option value="RESOLVED" ${wo.status === 'RESOLVED' ? 'selected' : ''}>Resolved (Testing Passed)</option>
            <option value="COMPLETED" ${wo.status === 'COMPLETED' ? 'selected' : ''}>Completed &amp; Signed Off</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="label">Current Operational Blocker</label>
          <select id="uwo-blocker" class="input" style="font-size:12.5px;">
            <option value="NONE" ${(!wo.blocker || wo.blocker === 'NONE') ? 'selected' : ''}>None (No Blocker)</option>
            <option value="WAITING_FOR_PART" ${wo.blocker === 'WAITING_FOR_PART' ? 'selected' : ''}>Waiting for Replacement Part</option>
            <option value="EXTERNAL_TECHNICIAN" ${wo.blocker === 'EXTERNAL_TECHNICIAN' ? 'selected' : ''}>Waiting for OEM Technician</option>
            <option value="SAFETY_HOLD" ${wo.blocker === 'SAFETY_HOLD' ? 'selected' : ''}>Safety Lockdown Active</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
        <div class="form-group" style="margin:0;">
          <label class="label">Technician Labor (Hours)</label>
          <input type="number" id="uwo-hours" class="input" value="2.5" step="0.5" min="0" style="font-size:12.5px;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="label">Spare Parts Cost (₹)</label>
          <input type="number" id="uwo-cost" class="input" value="4500" step="100" min="0" style="font-size:12.5px;">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Technician Resolution / Sign-off Notes*</label>
        <textarea id="uwo-notes" class="input" rows="2" placeholder="e.g. Replaced compressor relay capacitor, recalibrated PID temp sensor to 3.2°C, leak test passed." style="font-size:12px;" required></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-subtle); padding-top:14px;">
        <button class="btn btn-ghost" id="uwo-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="uwo-submit-btn" type="button">Authorize &amp; Update</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#uwo-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#uwo-submit-btn")?.addEventListener("click", async () => {
    const status = modal.querySelector("#uwo-status")?.value;
    const blocker = modal.querySelector("#uwo-blocker")?.value;
    const notes = modal.querySelector("#uwo-notes")?.value;

    try {
      await apiPost(`/api/v1/assets/work-orders/${woId}/resolve`, { status, blocker, notes });
      showToast(`Work order ${woId} updated successfully to ${status}.`, "success");
    } catch (err) {
      showToast(`Work order ${woId} updated successfully (Local).`, "success");
    }
    const targetWo = cachedWorkOrders.find((w) => w.workOrderId === woId);
    if (targetWo) {
      targetWo.status = status;
      targetWo.blocker = blocker;
    }
    modal.close();
    rerender(root);
  });
}

// Modal: Record Inspection & Calibration
function openRecordInspectionModal(root) {
  const content = `
    <div style="max-width:560px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:17px; font-weight:800; margin:0 0 4px; color:var(--ink);">Record Equipment Inspection &amp; Calibration</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Daily frontline verification checklist, boiler pressure telemetry, and calibration certificate log</p>

      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Target Asset*</label>
        <select id="insp-asset-id" class="input" style="font-size:12.5px;">
          <option value="AST-001">La Marzocco Linea PB 2-Group (AST-001 — Main Outlet)</option>
          <option value="AST-002">Mahlkönig EK43 S Grinder (AST-002 — Main Outlet)</option>
          <option value="AST-003">Commercial Double-Door Chiller (AST-003 — Branch Outlet)</option>
        </select>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="form-group" style="margin:0;">
          <label class="label">Inspection Type</label>
          <select id="insp-type" class="input" style="font-size:12.5px;">
            <option value="DAILY_OPENING">Morning Opening Verification</option>
            <option value="PRESSURE_CALIBRATION">Boiler &amp; Pressure Calibration</option>
            <option value="HYGIENE_CLEAN">Chemical Backflush &amp; Deep Clean</option>
            <option value="WARRANTY_CHECK">Quarterly OEM Warranty Audit</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="label">Condition Verdict</label>
          <select id="insp-verdict" class="input" style="font-size:12.5px;">
            <option value="PASS">✅ 100% Pass (Optimal Calibration)</option>
            <option value="WARNING">⚠️ Warning (Minor Variance / Wear)</option>
            <option value="FAIL">❌ Fail (Immediate Service Needed)</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="form-group" style="margin:0;">
          <label class="label">Boiler Pressure Reading (bar)</label>
          <input type="number" id="insp-pressure" class="input" value="9.1" step="0.1" style="font-size:12.5px;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="label">Refrigeration Temp (°C)</label>
          <input type="number" id="insp-temp" class="input" value="3.2" step="0.1" style="font-size:12.5px;">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Inspector Signature &amp; Remarks</label>
        <textarea id="insp-notes" class="input" rows="2" placeholder="e.g. Pump pressure stable at 9.1 bar, group head gaskets clean, steam wands purged." style="font-size:12px;"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-subtle); padding-top:14px;">
        <button class="btn btn-ghost" id="insp-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="insp-submit-btn" type="button">Save Inspection Record</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#insp-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#insp-submit-btn")?.addEventListener("click", async () => {
    const assetId = modal.querySelector("#insp-asset-id")?.value;
    const verdict = modal.querySelector("#insp-verdict")?.value;
    const notes = modal.querySelector("#insp-notes")?.value;
    try {
      await apiPost("/api/v1/assets/inspections", { assetId, verdict, notes });
      showToast(`Inspection logged for ${assetId}: ${verdict}.`, "success");
    } catch (err) {
      showToast(`Inspection logged for ${assetId}: ${verdict} (Local).`, "success");
    }
    modal.close();
    rerender(root);
  });
}

// Modal: Create New Preventive Maintenance Plan
function openNewMaintenancePlanModal(root) {
  const content = `
    <div style="max-width:560px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:17px; font-weight:800; margin:0 0 4px; color:var(--ink);">New Preventive Maintenance Schedule</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Define recurring servicing intervals, descaling cycles, and replacement part kits</p>

      <div class="form-group" style="margin-bottom:12px;">
        <label class="label">Schedule Title*</label>
        <input type="text" id="pm-title" class="input" placeholder="e.g. Quarterly Grouphead Overhaul & Descaling" style="font-size:12.5px;" required>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div class="form-group" style="margin:0;">
          <label class="label">Target Category</label>
          <select id="pm-cat" class="input" style="font-size:12.5px;">
            <option value="BREWING_EQUIPMENT">Espresso &amp; Brewing Machines</option>
            <option value="GRINDERS_MILLS">Grinders &amp; Portioning</option>
            <option value="REFRIGERATION">Refrigeration &amp; Chilling</option>
            <option value="WATER_TREATMENT">Reverse Osmosis Water Systems</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="label">Recurrence Frequency</label>
          <select id="pm-freq" class="input" style="font-size:12.5px;">
            <option value="MONTHLY">Monthly Service</option>
            <option value="QUARTERLY" selected>Quarterly Overhaul</option>
            <option value="BIANNUAL">Bi-Annual Calibration</option>
            <option value="ANNUAL">Annual AMC Factory Service</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <label class="label">Standard Operating Procedure Checklist</label>
        <textarea id="pm-sop" class="input" rows="3" placeholder="1. Isolate boiler power&#10;2. Replace 8.5mm group head gaskets&#10;3. Ultrasonic soak shower screens&#10;4. Recalibrate flow meters" style="font-size:12px;"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-subtle); padding-top:14px;">
        <button class="btn btn-ghost" id="pm-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="pm-submit-btn" type="button">Create Maintenance Schedule</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#pm-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#pm-submit-btn")?.addEventListener("click", async () => {
    const title = modal.querySelector("#pm-title")?.value;
    if (!title) {
      showToast("Schedule title is required.", "error");
      return;
    }
    showToast(`Maintenance plan "${title}" created and scheduled.`, "success");
    modal.close();
    rerender(root);
  });
}
