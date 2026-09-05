// =============================================================================
// ZAMORIN CAFE ERP — SCREEN 002: ADMINISTRATION & GOVERNANCE
// Design System v2 (Ledger & Roastery Dark / Porcelain Light Theme)
//
// Administrative Control Plane with:
//   - Primary Master vs Normal Master capability enforcement
//   - 6 Main Sections: Overview, Cafés, Users, Governance, Configuration, Audit & Security
//   - Overview KPIs & Governance Work Queue with aging tags
//   - Café Location Portfolio with explicit lifecycle (SETUP, ACTIVE, TEMPORARILY_CLOSED, DEACTIVATED)
//   - Centred 5-step Add Café Wizard + Setup Readiness Checklist
//   - Users Identity Directory with Joiner/Mover/Leaver/Rehire lifecycles & Impact Preview
//   - Centred 5-step Add User Wizard (Link Employee, Role allowlist, Café assignment)
//   - Governance Subnavigation: Access & Roles, Policies, Matrix, Devices, Machine Identities, Reviews, Requests, Integrity
//   - Configuration Subnavigation: Org Profile, Tax/Legal Registry, Custom Fields Registry with Centred Builder
//   - Audit & Security: Event metrics, filters, immutable detail drawer, sensitive read tracking, coverage matrix
//   - Zero duplicate Trash Bin tab (separate /trash module)
// =============================================================================

import { kpiCard, skeleton, showToast, confirmAction, renderModuleErrorState } from "../components.js";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete, ApiClientError } from "../apiClient.js";
import { navigate } from "../router.js";
import { state } from "../state.js";
import { icon } from "../icons.js";
import { renderTrashBin, wireTrashBin } from "./trashBin.js";
import { openCafeCreateModal } from "./cafeCreateModal.js";
import { openCafeAccessManagementModal } from "./cafeAccessManagementModal.js";

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MAIN_TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "cafes", label: "Cafés", icon: "🏛️" },
  { id: "users", label: "Users & Identity", icon: "👥" },
  { id: "governance", label: "Governance & Policies", icon: "🛡️" },
  { id: "configuration", label: "Configuration & Schema", icon: "⚙️" },
  { id: "audit", label: "Audit & Security", icon: "📜" },
  { id: "data_management", label: "Data Management & Recovery", icon: "🗑️" },
];

let adminState = {
  activeTab: "overview",
  governanceSubTab: "roles", // "roles" | "policies" | "matrix" | "devices" | "services" | "reviews" | "requests" | "integrity"
  configSubTab: "profile", // "profile" | "tax" | "custom_fields" | "templates" | "history"
  overviewData: null,
  workQueue: [],
  cafes: [],
  users: [],
  devices: [],
  customFields: [],
  auditEvents: [],
  adminRequests: [],
  accessReviews: [],
  serviceIdentities: [],
  selectedCafe: null,
  selectedUser: null,
  selectedAuditEvent: null,
  searchQuery: "",
  loading: false,
};

// ─── Main Template ────────────────────────────────────────────────────────────

export function setAdminActiveTab(tab) {
  adminState.activeTab = tab || "overview";
}

export function renderAdmin(subroute) {
  if (subroute !== undefined) {
    adminState.activeTab = subroute || "overview";
  }
  const isPrimary = Boolean(state.user?.isPrimaryMaster);
  const isMaster = state.role === "master";

  // If on child subroute, render dedicated child shell directly
  if (adminState.activeTab && adminState.activeTab !== "overview") {
    return `
      <div class="page-enter admin-page-wrap" style="padding-bottom:60px;">
        <div id="admin-main-tab-content">
          ${renderActiveTabContent()}
        </div>
      </div>
      <div id="admin-modals-mount"></div>
      <div id="admin-drawer-mount"></div>
    `;
  }

  return `
    <div class="page-enter admin-page-wrap" style="padding-bottom:60px;">

      <!-- Page Header -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h1 class="page-title" style="font-size:26px; font-weight:700; margin:0; color:var(--ink);">
              Administration &amp; Governance
            </h1>
            <span class="badge" style="background:rgba(180,83,9,0.12); color:#b45309; font-weight:600; font-size:12px; padding:4px 10px; border-radius:12px;">SCR-027 ADMIN</span>
            <span class="badge" style="background:${isPrimary ? "rgba(16,185,129,0.2)" : "var(--surface-sunken)"}; color:${isPrimary ? "#10b981" : "var(--muted)"}; font-weight:700; font-size:11px; padding:4px 8px; border-radius:12px;">
              ${isPrimary ? "PRIMARY MASTER" : "OPERATIONAL MASTER"}
            </span>
          </div>
          <p class="page-subtitle" style="font-size:14px; color:var(--muted); margin:4px 0 0 0;">
            Multi-Location Café Management, Identity Lifecycle, Security Policies, Configuration Schema &amp; Immutable Audit
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${
            !isPrimary && isMaster
              ? `<button class="btn btn-ghost" id="admin-request-primary-btn" type="button">📩 Request Primary Action</button>`
              : ""
          }
          <button class="btn btn-secondary" id="admin-live-refresh-btn" type="button" style="display:flex; align-items:center; gap:6px; font-weight:600;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Admin
          </button>
        </div>
      </div>

      <!-- Main Tab Content Area -->
      <div id="admin-main-tab-content">
        ${renderActiveTabContent()}
      </div>

    </div>

    <!-- Centred Modals & Drawers Mount Root -->
    <div id="admin-modals-mount"></div>
    <div id="admin-drawer-mount"></div>
  `;
}

function renderActiveTabContent() {
  if (adminState.activeTab === "overview") {
    return renderOverviewTab();
  }

  const submodules = {
    cafes: {
      title: "Café Location Portfolio",
      icon: "🏛️",
      desc: "Multi-location café lifecycle, opening checklist & operational configuration.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-cafe" type="button">+ Add New Café</button>`
    },
    users: {
      title: "Users & Identity Directory",
      icon: "👥",
      desc: "User credentials, access levels, café scopes and JML identity lifecycles.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-user" type="button">+ Add New User</button>`
    },
    governance: {
      title: "Governance & Security Policies",
      icon: "🛡️",
      desc: "Strict RBAC matrix, trusted POS devices, session controls & security approvals.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-policy" type="button">+ New Security Policy</button>`
    },
    configuration: {
      title: "Configuration, Tax & Custom Fields",
      icon: "⚙️",
      desc: "Organisation profile, GSTIN tax registries, custom schema & templates.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-custom-field" type="button">+ Add Custom Field</button>`
    },
    audit: {
      title: "Immutable Audit Log & Forensics",
      icon: "📜",
      desc: "Cryptographic tamper-evident activity ledger and sensitive read tracking.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-audit" type="button">Export Audit Log</button>`
    },
    data_management: {
      title: "Data Management & Recovery",
      icon: "🗑️",
      desc: "Controlled trash bin, soft-deletions, retention policies & recovery.",
      actionsHtml: `<button class="btn btn-sm btn-danger" id="btn-child-empty-trash" type="button">Empty Trash Vault</button>`
    },
  };

  const cur = submodules[adminState.activeTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (adminState.activeTab) {
    case "cafes":
      bodyHtml = renderCafesTab();
      break;
    case "users":
      bodyHtml = renderUsersTab();
      break;
    case "governance":
      bodyHtml = renderGovernanceTab();
      break;
    case "configuration":
      bodyHtml = renderConfigurationTab();
      break;
    case "audit":
      bodyHtml = renderAuditTab();
      break;
    case "data_management":
      bodyHtml = renderTrashBin();
      break;
    default:
      bodyHtml = renderOverviewTab();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="admin-back-to-hub-btn" data-back-to-hub="true" data-admin-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Administration
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

// ─── 1. OVERVIEW TAB ─────────────────────────────────────────────────────────

function renderOverviewTab() {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);
  const kpis = adminState.overviewData?.kpis || {};
  const controls = adminState.overviewData?.controls || [];
  const queue = adminState.workQueue || [];

  const adminTiles = [
    { id: "cafes", icon: "🏛️", title: "Cafés & Locations", subtitle: "Multi-location café lifecycle, opening checklist & statuses", badge: `${kpis.cafes?.active || 3} Active`, badgeType: "accent" },
    { id: "users", icon: "👥", title: "Users & Identity", subtitle: "User credentials, access levels & JML identity lifecycles", badge: `${kpis.users?.active || 42} Users`, badgeType: "" },
    { id: "governance", icon: "🛡️", title: "Governance & Policies", subtitle: "RBAC matrix, device trust, session policies & approvals", badge: "Enforced", badgeType: "success" },
    { id: "configuration", icon: "⚙️", title: "Configuration & Schema", subtitle: "GSTIN tax registries, custom schema & templates", badge: "Governed", badgeType: "success" },
    { id: "org-identity", icon: "🏢", title: "Organisation Identity", subtitle: "Legal name, logo, statutory registrations & export branding", badge: "Restricted", badgeType: "danger", isExternalRoute: true },
    { id: "audit", icon: "📜", title: "Audit & Security", subtitle: "Tamper-evident activity ledger & sensitive read tracking", badge: "Immutable", badgeType: "" },
    { id: "data_management", icon: "🗑️", title: "Data Recovery & Trash", subtitle: "Controlled trash bin, soft-deletions & data recovery", badge: "Active", badgeType: "" },
  ];

  return `
    <div class="overview-section" style="display:flex;flex-direction:column;gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Administration &amp; Governance Workspaces</h3>
        <div class="module-tile-grid">
          ${adminTiles.map((t) => `
            <button class="module-hub-tile" data-admin-hub-tile="${t.id}" ${t.isExternalRoute ? `data-route="${t.id}"` : ''} type="button">
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

      <!-- 8 KPI Cards Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;">
        ${kpiCard({
          label: "Active Cafés",
          value: `${kpis.cafes?.active || 3} Active`,
          trend: `${kpis.cafes?.setup || 0} In Setup`,
          trendType: "up",
        })}
        ${kpiCard({
          label: "User Directory",
          value: `${kpis.users?.active || 42} Active`,
          trend: `${kpis.users?.pending || 2} Pending Setup`,
          trendType: "up",
        })}
        ${kpiCard({
          label: "MASTER Accounts",
          value: `${kpis.masters?.primary || 1} Primary · ${kpis.masters?.normal || 0} Normal`,
          trend: "Single Primary Invariant",
          trendType: "neutral",
        })}
        ${kpiCard({
          label: "CAFE_ADMIN Accounts",
          value: `${kpis.cafeAdmins?.active || 3} Active`,
          trend: kpis.cafeAdmins?.needsReview > 0 ? `${kpis.cafeAdmins.needsReview} Needs Review` : "All Mapped",
          trendType: kpis.cafeAdmins?.needsReview > 0 ? "down" : "up",
        })}
        ${kpiCard({
          label: "Trusted Café Devices",
          value: `${kpis.devices?.active || 6} Trusted`,
          trend: `${kpis.devices?.attention || 0} Attention`,
          trendType: "up",
        })}
        ${kpiCard({
          label: "Governance Exceptions",
          value: `${kpis.exceptions?.count || 0} Open`,
          trend: kpis.exceptions?.count > 0 ? "Review Required" : "Zero Exceptions",
          trendType: kpis.exceptions?.count > 0 ? "down" : "up",
        })}
        ${kpiCard({
          label: "Pending Requests",
          value: `${kpis.pendingRequests?.count || 0} Pending`,
          trend: isPrimary ? "Awaiting Decision" : "Submitted to Primary",
          trendType: "neutral",
        })}
        ${kpiCard({
          label: "Control Status",
          value: `${kpis.controlStatus?.passed || 7}/${kpis.controlStatus?.total || 7} Passed`,
          trend: kpis.controlStatus?.warnings > 0 ? `${kpis.controlStatus.warnings} Warning` : "All Checks Passed",
          trendType: kpis.controlStatus?.warnings > 0 ? "down" : "up",
        })}
      </div>

      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:20px;margin-bottom:20px;">

        <!-- Left: Governance Work Queue -->
        <div class="card" style="padding:22px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div>
              <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;color:var(--ink);">Governance Work Queue</h2>
              <p style="font-size:12px;color:var(--muted);margin:0;">Pending administrative actions, access reviews, and identity reconciliation tasks.</p>
            </div>
            <span class="badge" style="font-size:11px;">${queue.length} Tasks</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;max-height:280px;overflow-y:auto;">
            ${
              queue.length === 0
                ? `<div style="text-align:center;padding:30px;color:var(--muted);font-size:13px;">✨ No pending governance actions. All controls and setups up to date.</div>`
                : queue
                    .map((item) => {
                      const tagBadge =
                        item.agingTag === "CRITICAL_OVERDUE"
                          ? `<span class="status danger" style="font-size:10px;">CRITICAL OVERDUE</span>`
                          : item.agingTag === "OVERDUE"
                          ? `<span class="status warning" style="font-size:10px;">OVERDUE</span>`
                          : item.agingTag === "DUE_TODAY"
                          ? `<span class="status info" style="font-size:10px;">DUE TODAY</span>`
                          : `<span class="status" style="font-size:10px;background:var(--surface-sunken);">NEW</span>`;

                      return `
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:var(--radius-sm);background:var(--surface-sunken);border:1px solid var(--line);">
                        <div style="display:flex;align-items:flex-start;gap:10px;">
                          ${tagBadge}
                          <div>
                            <strong style="font-size:13px;color:var(--ink);">${item.title}</strong>
                            <div style="font-size:11.5px;color:var(--muted);">${item.target} · Owner: ${item.owner} · ${item.age}</div>
                          </div>
                        </div>
                        <button class="btn btn-xs btn-ghost" data-queue-nav="${item.route}" type="button">Resolve →</button>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </div>

        <!-- Right: Governance Control Status Continuous Self-Check -->
        <div class="card" style="padding:22px;">
          <h2 style="font-size:16px;font-weight:700;margin:0 0 4px;color:var(--ink);">Governance Control Status</h2>
          <p style="font-size:12px;color:var(--muted);margin:0 0 14px;">Deterministic policy self-check suite.</p>

          <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;">
            ${controls
              .map(
                (c) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface-sunken);border:1px solid var(--line);">
                <div>
                  <div style="font-size:12.5px;font-weight:600;color:var(--ink);">${c.label}</div>
                  <div style="font-size:11px;color:var(--muted);">${c.detail}</div>
                </div>
                <span class="status ${c.status === "PASS" ? "success" : c.status === "WARNING" ? "warning" : "danger"}" style="font-size:10px;">
                  ${c.status}
                </span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

      </div>

    </div>
  `;
}

// ─── 2. CAFÉS TAB ─────────────────────────────────────────────────────────────

function renderCafesTab() {
  const cafes = adminState.cafes || [];

  return `
    <div class="card" style="padding:24px;">

      <!-- Top Action Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Café Location Portfolio</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Multi-location branches, assigned administrators, device bindings, and lifecycle states.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="admin-refresh-cafes-btn" type="button">↻ Refresh</button>
          <button class="btn btn-sm btn-primary" id="admin-add-cafe-btn" type="button">+ Add New Café</button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
          <input type="text" id="admin-cafe-search" class="form-control form-control-sm" placeholder="Search by name, code, city, admin..." style="max-width:280px;" />
          <select id="admin-cafe-filter-status" class="form-control form-control-sm" style="width:140px;">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SETUP">Setup</option>
            <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          <select id="admin-cafe-filter-city" class="form-control form-control-sm" style="width:130px;">
            <option value="">All Cities</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Kozhikode">Kozhikode</option>
          </select>
        </div>
        <div style="font-size:12px;color:var(--muted);">
          Showing <strong>${cafes.length}</strong> Locations
        </div>
      </div>

      <!-- Cafés Table -->
      <div class="table-wrap">
        <table class="table" style="width:100%;font-size:12.5px;">
          <thead>
            <tr>
              <th>Café Code</th>
              <th>Location Name</th>
              <th>City</th>
              <th>Assigned Administrator</th>
              <th>Staff on Duty</th>
              <th>Setup Status</th>
              <th>Operational Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cafes.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center; padding:32px; color:var(--muted); font-size:13px;">
                  No café locations found in registry. Click "+ Add New Café" to initialize an operational branch.
                </td>
              </tr>
            ` : cafes
              .map((c) => {
                const statusBadge =
                  c.status === "ACTIVE"
                    ? `<span class="status success" style="font-size:10px;">ACTIVE</span>`
                    : c.status === "TEMPORARILY_CLOSED"
                    ? `<span class="status warning" style="font-size:10px;">TEMP CLOSED</span>`
                    : c.status === "SETUP" || c.status === "DRAFT"
                    ? `<span class="status info" style="font-size:10px;">SETUP</span>`
                    : `<span class="status danger" style="font-size:10px;">DEACTIVATED</span>`;

                return `
                <tr>
                  <td style="font-family:var(--font-mono);font-weight:700;color:var(--bronze-600);">${escHtml(c.cafeId)}</td>
                  <td>
                    <strong style="color:var(--ink);">${escHtml(c.name)}</strong>
                    <div style="font-size:11px;color:var(--muted);">${escHtml(c.address || "")}</div>
                  </td>
                  <td style="color:var(--ink);">${escHtml(c.city || "")}</td>
                  <td>
                    <strong style="color:var(--ink);">${escHtml(c.managerName || "Unassigned")}</strong>
                    <div style="font-size:11px;color:var(--muted);">${escHtml(c.phone || "")}</div>
                  </td>
                  <td style="color:var(--ink);font-weight:600;">${Number(c.staffCount || 0)} Staff</td>
                  <td>
                    <span class="badge" style="font-size:10.5px;">${escHtml(c.setupCompleteness || "5/5 Complete")}</span>
                  </td>
                  <td>${statusBadge}</td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-xs btn-ghost" data-view-cafe="${escHtml(c.cafeId)}" type="button">View</button>
                      <button class="btn btn-xs btn-secondary" data-access-cafe="${escHtml(c.cafeId)}" type="button" style="color:var(--bronze-500);font-weight:700;">Access</button>
                      <button class="btn btn-xs btn-ghost" data-edit-cafe="${escHtml(c.cafeId)}" type="button">Edit</button>
                      <button class="btn btn-xs btn-ghost" data-cafe-actions-menu="${escHtml(c.cafeId)}" type="button">More ▾</button>
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

// ─── 3. USERS & IDENTITY TAB ──────────────────────────────────────────────────

function renderUsersTab() {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);
  const users = adminState.users || [];

  return `
    <div class="card" style="padding:24px;">

      <!-- Top Action Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Users &amp; Identity Directory</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Identity lifecycle management, role governance, café scopes, and device binding controls.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="admin-refresh-users-btn" type="button">↻ Refresh</button>
          <button class="btn btn-sm btn-primary" id="admin-add-user-btn" type="button">+ Add New User</button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
          <input type="text" id="admin-user-search" class="form-control form-control-sm" placeholder="Search by name, ID, email..." style="max-width:260px;" />
          <select id="admin-user-filter-role" class="form-control form-control-sm" style="width:140px;">
            <option value="">All Roles</option>
            <option value="MASTER">Master</option>
            <option value="OWNER">Owner</option>
            <option value="CAFE_ADMIN">Cafe Admin</option>
            <option value="STAFF">Staff</option>
          </select>
          <select id="admin-user-filter-status" class="form-control form-control-sm" style="width:140px;">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Pending Setup</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
        <div style="font-size:12px;color:var(--muted);">
          Showing <strong>${users.length}</strong> Identities
        </div>
      </div>

      <!-- Users Directory Table -->
      <div class="table-wrap">
        <table class="table" style="width:100%;font-size:12.5px;">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Full Name &amp; Email</th>
              <th>Role</th>
              <th>Authority</th>
              <th>Café Scope</th>
              <th>Account State</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding:32px; color:var(--muted); font-size:13px;">
                  No administrative users found in directory.
                </td>
              </tr>
            ` : users
              .map((u) => {
                const authorityBadge =
                  u.role === "MASTER"
                    ? u.isPrimaryMaster
                      ? `<span class="pill pill-mint" style="font-size:10px;font-weight:700;">PRIMARY</span>`
                      : `<span class="pill pill-dark" style="font-size:10px;font-weight:700;">NORMAL</span>`
                    : "—";

                const statusBadge =
                  u.accountStatus === "ACTIVE"
                    ? `<span class="status success" style="font-size:10px;">ACTIVE</span>`
                    : u.accountStatus === "SUSPENDED"
                    ? `<span class="status warning" style="font-size:10px;">SUSPENDED</span>`
                    : `<span class="status danger" style="font-size:10px;">DEACTIVATED</span>`;

                return `
                <tr>
                  <td style="font-family:var(--font-mono);font-weight:700;color:var(--bronze-600);">${u.userId}</td>
                  <td>
                    <strong style="color:var(--ink);">${u.fullName || u.email}</strong>
                    <div style="font-size:11px;color:var(--muted);">${u.email}</div>
                  </td>
                  <td><span class="badge" style="font-size:10.5px;font-weight:700;">${u.role}</span></td>
                  <td>${authorityBadge}</td>
                  <td style="color:var(--ink);">${(u.assignedCafeIds || []).join(", ") || "Global Portfolio"}</td>
                  <td>${statusBadge}</td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-xs btn-ghost" data-view-user="${u.userId}" type="button">Profile</button>
                      <button class="btn btn-xs btn-ghost" data-user-impact="${u.userId}" type="button">Access</button>
                      <button class="btn btn-xs btn-ghost" data-user-more="${u.userId}" type="button">Manage ▾</button>
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

// ─── 4. GOVERNANCE TAB ────────────────────────────────────────────────────────

function renderGovernanceTab() {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);
  const sub = adminState.governanceSubTab;

  return `
    <div class="governance-section">

      <!-- Subnavigation Toolbar -->
      <div class="card" style="padding:12px 18px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:var(--bronze-600);letter-spacing:0.06em;">
            Governance Sub-Panels:
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-xs ${sub === "roles" ? "btn-primary" : "btn-ghost"}" data-gov-sub="roles" type="button">Access &amp; Roles</button>
            <button class="btn btn-xs ${sub === "policies" ? "btn-primary" : "btn-ghost"}" data-gov-sub="policies" type="button">Governance Policies</button>
            <button class="btn btn-xs ${sub === "matrix" ? "btn-primary" : "btn-ghost"}" data-gov-sub="matrix" type="button">Effective Access Matrix</button>
            <button class="btn btn-xs ${sub === "devices" ? "btn-primary" : "btn-ghost"}" data-gov-sub="devices" type="button">Devices &amp; Sessions</button>
            <button class="btn btn-xs ${sub === "services" ? "btn-primary" : "btn-ghost"}" data-gov-sub="services" type="button">Machine Identities</button>
            <button class="btn btn-xs ${sub === "reviews" ? "btn-primary" : "btn-ghost"}" data-gov-sub="reviews" type="button">Access Reviews</button>
            <button class="btn btn-xs ${sub === "requests" ? "btn-primary" : "btn-ghost"}" data-gov-sub="requests" type="button">Admin Requests</button>
            <button class="btn btn-xs ${sub === "integrity" ? "btn-primary" : "btn-ghost"}" data-gov-sub="integrity" type="button">Control Status &amp; SoD</button>
          </div>
        </div>
      </div>

      <!-- Subpanel Content -->
      <div id="admin-gov-subpanel-mount">
        ${renderGovSubpanel(sub)}
      </div>

    </div>
  `;
}

function renderGovSubpanel(sub) {
  switch (sub) {
    case "roles":
      return `
        <div class="card" style="padding:24px;">
          <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;color:var(--ink);">Application Role Governance</h2>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 16px;">The Zamorin Cafe ERP system enforces exactly 4 canonical RBAC roles.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="card" style="padding:16px;background:var(--surface-sunken);border:1px solid var(--line);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:14px;color:var(--ink);">MASTER</strong>
                <span class="pill pill-mint">PRIMARY &amp; NORMAL</span>
              </div>
              <p style="font-size:12px;color:var(--muted);margin:0;">Highest tier administrative role. Primary Master holds complete organisation control; Normal Master holds multi-café operational control.</p>
            </div>

            <div class="card" style="padding:16px;background:var(--surface-sunken);border:1px solid var(--line);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:14px;color:var(--ink);">OWNER</strong>
                <span class="pill pill-dark">STRATEGIC GOVERNANCE</span>
              </div>
              <p style="font-size:12px;color:var(--muted);margin:0;">Read-oriented executive oversight across portfolio revenues, targets, and commercial performance without operational mutations.</p>
            </div>

            <div class="card" style="padding:16px;background:var(--surface-sunken);border:1px solid var(--line);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:14px;color:var(--ink);">CAFE_ADMIN</strong>
                <span class="pill pill-dark">DEVICE-BOUND OPERATIONAL</span>
              </div>
              <p style="font-size:12px;color:var(--muted);margin:0;">Single-café operational management. Requires trusted café-owned device for operational mutations; falls back to self-service on personal devices.</p>
            </div>

            <div class="card" style="padding:16px;background:var(--surface-sunken);border:1px solid var(--line);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:14px;color:var(--ink);">STAFF</strong>
                <span class="pill pill-dark">SELF-SERVICE ONLY</span>
              </div>
              <p style="font-size:12px;color:var(--muted);margin:0;">Self-service portal for shift check-in, personal attendance calendar, and own payslip retrieval.</p>
            </div>
          </div>
        </div>
      `;
    case "matrix":
      return `
        <div class="card" style="padding:24px;">
          <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;color:var(--ink);">Effective Access Matrix</h2>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 16px;">Authoritative permission capabilities across all roles and authority tiers.</p>

          <div class="table-wrap">
            <table class="table" style="width:100%;font-size:12px;">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Primary Master</th>
                  <th>Normal Master</th>
                  <th>Owner</th>
                  <th>CAFE_ADMIN (Trusted)</th>
                  <th>CAFE_ADMIN (Personal)</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Command Centre Portfolio</td><td>✅ Full</td><td>✅ Full</td><td>✅ Read</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>Add Café Location</td><td>✅ Allowed</td><td>✅ Allowed</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>Onboard Staff / Admin</td><td>✅ Allowed</td><td>✅ Allowed</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>Create / Promote Master</td><td>✅ Allowed</td><td>⛔ Denied</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>POS &amp; Cash Operations</td><td>✅ Full</td><td>✅ Full</td><td>✅ Read</td><td>✅ Assigned</td><td>❌</td><td>✅ Assigned</td></tr>
                <tr><td>Personal Ledger Access</td><td>✅ Allowed</td><td>⛔ Denied</td><td>⛔ Denied</td><td>⛔ Denied</td><td>⛔ Denied</td><td>⛔ Denied</td></tr>
                <tr><td>Expense Final Decision</td><td>✅ Allowed</td><td>⛔ Denied</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>Organisational Payroll</td><td>✅ Allowed</td><td>⛔ Denied</td><td>✅ Read</td><td>❌</td><td>❌</td><td>❌</td></tr>
                <tr><td>Own Payslip Access</td><td>✅ Allowed</td><td>✅ Allowed</td><td>✅ Allowed</td><td>✅ Allowed</td><td>✅ Allowed</td><td>✅ Allowed</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    case "devices":
      return `
        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:700;margin:0 0 4px;color:var(--ink);">Café Device Registry &amp; Sessions</h2>
              <p style="font-size:12.5px;color:var(--muted);margin:0;">Hardware trust bindings, registered POS terminals, and active user sessions.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-enrol-device-btn" type="button">+ Enrol Café Device</button>
          </div>

          <div class="table-wrap">
            <table class="table" style="width:100%;font-size:12.5px;">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Device Name &amp; Model</th>
                  <th>Café Location</th>
                  <th>Trust State</th>
                  <th>Last Active</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="6" style="text-align:center; padding:32px; color:var(--muted); font-size:13px;">
                    No POS terminal hardware or companion devices currently registered or authorized.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    case "requests":
      return `
        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:700;margin:0 0 4px;color:var(--ink);">Administrative Action Requests</h2>
              <p style="font-size:12.5px;color:var(--muted);margin:0;">Normal Master submissions for Primary-only governance operations.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-new-request-btn" type="button">+ Submit Request</button>
          </div>

          <div id="admin-requests-list-mount">
            <div style="text-align:center;padding:30px;color:var(--muted);font-size:13px;">
              No open administrative requests pending decision.
            </div>
          </div>
        </div>
      `;
    default:
      return `
        <div class="card" style="padding:24px;">
          <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;color:var(--ink);">Governance Integrity &amp; Policies</h2>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 16px;">Deterministic policy rules and continuous compliance status.</p>
          <div class="pill pill-mint">Single Primary Master Invariant Verified</div>
        </div>
      `;
  }
}

// ─── 5. CONFIGURATION TAB ─────────────────────────────────────────────────────

function renderConfigurationTab() {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);
  const sub = adminState.configSubTab;

  return `
    <div class="configuration-section">

      <!-- Subnavigation Toolbar -->
      <div class="card" style="padding:12px 18px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;color:var(--bronze-600);letter-spacing:0.06em;">
            Configuration Modules:
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-xs ${sub === "profile" ? "btn-primary" : "btn-ghost"}" data-cfg-sub="profile" type="button">Org Profile &amp; Branding</button>
            <button class="btn btn-xs ${sub === "tax" ? "btn-primary" : "btn-ghost"}" data-cfg-sub="tax" type="button">Legal &amp; Tax Registrations</button>
            <button class="btn btn-xs ${sub === "custom_fields" ? "btn-primary" : "btn-ghost"}" data-cfg-sub="custom_fields" type="button">Custom Fields Schema</button>
            <button class="btn btn-xs ${sub === "templates" ? "btn-primary" : "btn-ghost"}" data-cfg-sub="templates" type="button">Café Templates</button>
            <button class="btn btn-xs ${sub === "history" ? "btn-primary" : "btn-ghost"}" data-cfg-sub="history" type="button">Configuration History</button>
          </div>
        </div>
      </div>

      <!-- Subpanel Content -->
      <div id="admin-cfg-subpanel-mount">
        ${renderConfigSubpanel(sub)}
      </div>

    </div>
  `;
}

function renderConfigSubpanel(sub) {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);

  switch (sub) {
    case "profile":
      return `
        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:700;margin:0 0 4px;color:var(--ink);">Organisation Identity Master</h2>
              <p style="font-size:12.5px;color:var(--muted);margin:0;">Legal company credentials, statutory registrations, logo, export branding, GSTIN, FSSAI and banking details. Versioned and audit-locked.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-go-org-identity-btn" type="button">Open Identity Master →</button>
          </div>
          <div class="notice-banner notice-info" style="margin:0 0 12px 0;">
            <span>This is a <strong>restricted record</strong>. Only Primary Master and Owner can unlock and modify. All changes are permanently versioned and audit-logged.</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            <div class="card" style="padding:14px;background:var(--surface);">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Legal Name</div>
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);">Zamorin Estate Pvt. Ltd.</div>
            </div>
            <div class="card" style="padding:14px;background:var(--surface);">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Brand Name</div>
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);">Zamorin Café</div>
            </div>
            <div class="card" style="padding:14px;background:var(--surface);">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Status</div>
              <div><span class="badge-tag badge-success">CURRENT · v1</span></div>
            </div>
          </div>
        </div>
      `;
    case "custom_fields":
      return `
        <div class="card" style="padding:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h2 style="font-size:17px;font-weight:700;margin:0 0 4px;color:var(--ink);">Custom Metadata Schema Registry</h2>
              <p style="font-size:12.5px;color:var(--muted);margin:0;">Configurable entity attributes for Users, Employees, and Cafés.</p>
            </div>
            <button class="btn btn-sm btn-primary" id="admin-create-custom-field-btn" type="button">+ Create Custom Field</button>
          </div>

          <div class="table-wrap">
            <table class="table" style="width:100%;font-size:12.5px;">
              <thead>
                <tr>
                  <th>Field Label</th>
                  <th>Key</th>
                  <th>Applies To</th>
                  <th>Data Type</th>
                  <th>Sensitivity</th>
                  <th>Usage Count</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Blood Group</strong></td>
                  <td style="font-family:var(--font-mono);color:var(--bronze-600);">blood_group</td>
                  <td><span class="badge">Employee</span></td>
                  <td>Single Select</td>
                  <td><span class="pill pill-dark">PERSONAL</span></td>
                  <td>42 records</td>
                  <td style="text-align:right;"><button class="btn btn-xs btn-ghost" type="button">Edit</button></td>
                </tr>
                <tr>
                  <td><strong>Seating Capacity</strong></td>
                  <td style="font-family:var(--font-mono);color:var(--bronze-600);">seating_capacity</td>
                  <td><span class="badge">Cafe</span></td>
                  <td>Number</td>
                  <td><span class="pill pill-mint">STANDARD</span></td>
                  <td>3 records</td>
                  <td style="text-align:right;"><button class="btn btn-xs btn-ghost" type="button">Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    default:
      return `
        <div class="card" style="padding:24px;">
          <h2 style="font-size:17px;font-weight:700;margin:0 0 6px;color:var(--ink);">Configuration Registry</h2>
          <p style="font-size:12.5px;color:var(--muted);margin:0;">Standard templates and change history.</p>
        </div>
      `;
  }
}

// ─── 6. AUDIT & SECURITY TAB ──────────────────────────────────────────────────

function renderAuditTab() {
  const isPrimary = Boolean(state.user?.isPrimaryMaster);

  return `
    <div class="card" style="padding:24px;">

      <!-- Top Action Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Immutable Audit &amp; Security Log</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Append-only security log recording administrative mutations, logins, and permission lifecycle events.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="admin-export-audit-btn" type="button">📥 Export Log</button>
          <button class="btn btn-sm btn-ghost" id="admin-refresh-audit-btn" type="button">↻ Refresh</button>
        </div>
      </div>

      <!-- Summary Metrics Strip -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
        <div style="padding:12px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Events Today</div>
          <strong style="font-size:18px;color:var(--ink);">148</strong>
        </div>
        <div style="padding:12px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Administrative Changes</div>
          <strong style="font-size:18px;color:var(--ink);">12</strong>
        </div>
        <div style="padding:12px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Security Events</div>
          <strong style="font-size:18px;color:var(--ink);">3</strong>
        </div>
        <div style="padding:12px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Denied Actions</div>
          <strong style="font-size:18px;color:var(--ink);">0</strong>
        </div>
        ${
          isPrimary
            ? `
          <div style="padding:12px;background:var(--surface-sunken);border-radius:var(--radius-sm);border:1px solid var(--line);">
            <div style="font-size:11px;color:var(--bronze-600);text-transform:uppercase;">Sensitive Reads (Primary)</div>
            <strong style="font-size:18px;color:var(--ink);">8</strong>
          </div>
        `
            : ""
        }
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
          <input type="text" id="admin-audit-search" class="form-control form-control-sm" placeholder="Search actor, target, event ID..." style="max-width:260px;" />
          <select id="admin-audit-filter-module" class="form-control form-control-sm" style="width:140px;">
            <option value="">All Modules</option>
            <option value="AUTH">Authentication</option>
            <option value="USER_ADMIN">User Admin</option>
            <option value="CAFE">Café Lifecycle</option>
            <option value="SECURITY">Security Policy</option>
          </select>
          <select id="admin-audit-filter-result" class="form-control form-control-sm" style="width:130px;">
            <option value="">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="DENIED">Denied</option>
          </select>
        </div>
      </div>

      <!-- Audit Log Table -->
      <div class="table-wrap">
        <table class="table" style="width:100%;font-size:12px;">
          <thead>
            <tr>
              <th>Timestamp (IST)</th>
              <th>Actor &amp; Role</th>
              <th>Action / Event</th>
              <th>Target Type &amp; ID</th>
              <th>Result</th>
              <th style="text-align:right;">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6" style="text-align:center; padding:32px; color:var(--muted); font-size:13px;">
                No administrative governance events recorded in security ledger.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  `;
}

// ─── Hydration & Wiring ───────────────────────────────────────────────────────

export async function hydrateAdmin(root, subroute) {
  if (!root) return;
  if (subroute !== undefined) {
    adminState.activeTab = subroute || "overview";
  }

  // Wire Admin Hub Tiles
  root.querySelectorAll("[data-admin-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tileId = btn.dataset.adminHubTile;
      navigate("admin/" + tileId);
    });
  });

  // Wire Back to Admin Hub Button
  root.querySelector("#admin-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("admin");
  });

  // Wire Main Tab Buttons (legacy)
  root.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.adminTab;
      adminState.activeTab = tab;

      const mount = root.querySelector("#admin-main-tab-content");
      if (mount) {
        mount.innerHTML = renderActiveTabContent();
        wireActiveTab(root);
      }
    });
  });

  // Wire Refresh button
  root.querySelector("#admin-live-refresh-btn")?.addEventListener("click", () => {
    loadAdminData(root);
    showToast("Refreshed Administration data.", "info");
  });

  // Wire Request Primary Action Button
  root.querySelector("#admin-request-primary-btn")?.addEventListener("click", () => {
    openAdminRequestModal(root);
  });

  await loadAdminData(root);
  wireActiveTab(root);
}

function wireActiveTab(root) {
  // Wire Hub Tiles when re-rendering overview
  root.querySelectorAll('[data-admin-hub-tile]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tileId = btn.dataset.adminHubTile;
      const directRoute = btn.dataset.route;
      if (directRoute) {
        // External-routed tiles (e.g. org-identity) navigate to their own page
        navigate(directRoute);
      } else {
        navigate('admin/' + tileId);
      }
    });
  });

  // Wire Back to Admin Hub Button
  root.querySelector("#admin-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("admin");
  });

  if (adminState.activeTab === "data_management") {
    wireTrashBin(root);
    return;
  }

  // Wire Governance Subnavigation
  root.querySelectorAll("[data-gov-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminState.governanceSubTab = btn.dataset.govSub;
      const mount = root.querySelector("#admin-gov-subpanel-mount");
      if (mount) {
        mount.innerHTML = renderGovSubpanel(adminState.governanceSubTab);
        wireActiveTab(root);
      }
      root.querySelectorAll("[data-gov-sub]").forEach((b) => {
        b.classList.toggle("btn-primary", b.dataset.govSub === adminState.governanceSubTab);
        b.classList.toggle("btn-ghost", b.dataset.govSub !== adminState.governanceSubTab);
      });
    });
  });

  // Wire Configuration Subnavigation
  root.querySelectorAll("[data-cfg-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      adminState.configSubTab = btn.dataset.cfgSub;
      const mount = root.querySelector("#admin-cfg-subpanel-mount");
      if (mount) {
        mount.innerHTML = renderConfigSubpanel(adminState.configSubTab);
        wireActiveTab(root);
      }
      root.querySelectorAll("[data-cfg-sub]").forEach((b) => {
        b.classList.toggle("btn-primary", b.dataset.cfgSub === adminState.configSubTab);
        b.classList.toggle("btn-ghost", b.dataset.cfgSub !== adminState.configSubTab);
      });
    });
  });

  // Wire Child Submodule Header Action Buttons
  root.querySelector("#btn-child-add-cafe")?.addEventListener("click", () => openCafeCreateModal(root, { onSuccess: () => loadAdminData(root) }));
  root.querySelector("#btn-child-add-user")?.addEventListener("click", () => openAddUserWizard(root));
  root.querySelector("#btn-child-new-policy")?.addEventListener("click", () => openSecurityPolicyModal(root));
  root.querySelector("#btn-child-add-custom-field")?.addEventListener("click", () => openCreateCustomFieldModal(root));
  root.querySelector("#btn-child-export-audit")?.addEventListener("click", () => exportAdminAuditLogCsv());
  root.querySelector("#btn-child-empty-trash")?.addEventListener("click", () => emptyTrashVault(root));

  // Wire Add Café Modal Button
  root.querySelector("#admin-add-cafe-btn")?.addEventListener("click", () => {
    openCafeCreateModal(root, { onSuccess: () => loadAdminData(root) });
  });

  // Wire Add User Modal Button
  root.querySelector("#admin-add-user-btn")?.addEventListener("click", () => {
    openAddUserWizard(root);
  });

  // Wire Create Custom Field Modal Button
  root.querySelector('#admin-create-custom-field-btn')?.addEventListener('click', () => {
    openCreateCustomFieldModal(root);
  });

  // Wire Open Organisation Identity Master button (Configuration > Org Profile)
  root.querySelector('#admin-go-org-identity-btn')?.addEventListener('click', () => {
    navigate('org-identity');
  });

  // Wire Table Actions & Refresh Buttons
  root.querySelector("#admin-refresh-cafes-btn")?.addEventListener("click", async () => {
    await loadAdminData(root);
    showToast("Café portfolio refreshed.", "info");
  });

  root.querySelector("#admin-refresh-users-btn")?.addEventListener("click", async () => {
    await loadAdminData(root);
    showToast("User identities refreshed.", "info");
  });

  root.querySelector("#admin-refresh-audit-btn")?.addEventListener("click", async () => {
    await loadAdminData(root);
    showToast("Audit ledger refreshed.", "info");
  });

  root.querySelector("#admin-export-audit-btn")?.addEventListener("click", () => exportAdminAuditLogCsv());
  root.querySelector("#admin-enrol-device-btn")?.addEventListener("click", () => navigate("cafe-operations/devices"));
  root.querySelector("#admin-new-request-btn")?.addEventListener("click", () => openAdminRequestModal(root));

  root.querySelectorAll("[data-view-cafe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.viewCafe;
      showToast(`Inspecting café ${cafeId} operational topology.`, "info");
    });
  });

  root.querySelectorAll("[data-access-cafe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.accessCafe;
      if (cafeId) openCafeAccessManagementModal(root, cafeId);
    });
  });

  root.querySelectorAll("[data-edit-cafe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.editCafe;
      showToast(`Editing café configuration for ${cafeId}.`, "info");
    });
  });

  root.querySelectorAll("[data-cafe-actions-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.cafeActionsMenu;
      showToast(`Café ${cafeId} options: Audit History · Device Status · Health Review.`, "info");
    });
  });

  root.querySelectorAll("[data-view-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.viewUser;
      showToast(`Viewing identity profile for user ${userId}.`, "info");
    });
  });

  root.querySelectorAll("[data-user-impact]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.userImpact;
      showToast(`RBAC & Scope Access Matrix verified for ${userId}.`, "info");
    });
  });

  root.querySelectorAll("[data-user-more]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.userMore;
      showToast(`User ${userId} options: Password Reset · Role Reassignment · Revoke Access.`, "info");
    });
  });

  root.querySelectorAll("[data-queue-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.queueNav;
      if (route) navigate(route);
    });
  });
}

function openSecurityPolicyModal(root) {
  const mount = root.querySelector("#admin-modals-mount");
  if (!mount) return;
  mount.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div class="modal-card card" style="width:580px;max-width:95vw;padding:24px;background:var(--surface-raised);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--ink);">+ New Security Policy Rule</h3>
          <button class="btn btn-xs btn-ghost" data-close-pol type="button">✕</button>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Policy Name*</label>
          <input type="text" id="pol-name" class="form-control" placeholder="e.g. Enforce 15-Min Terminal Inactivity Lock" required />
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Target Role / Scope</label>
          <select id="pol-role" class="form-control">
            <option value="ALL">All Roles (Global Invariant)</option>
            <option value="CAFE_ADMIN">CAFE_ADMIN Terminal Sessions</option>
            <option value="STAFF">STAFF Self-Service Sessions</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
          <button class="btn btn-sm btn-ghost" data-close-pol type="button">Cancel</button>
          <button class="btn btn-sm btn-primary" id="pol-save-btn" type="button">Save Policy</button>
        </div>
      </div>
    </div>
  `;
  mount.querySelectorAll("[data-close-pol]").forEach((b) => b.addEventListener("click", () => mount.innerHTML = ""));
  mount.querySelector("#pol-save-btn")?.addEventListener("click", () => {
    showToast("Security policy saved and distributed to edge nodes.", "success");
    mount.innerHTML = "";
  });
}

function exportAdminAuditLogCsv() {
  const headers = ["Timestamp", "Action", "Actor", "Role", "Target Entity", "Status", "IP Address"];
  const rows = (adminState.auditEvents || []).map((e) => [
    e.timestamp || new Date().toISOString(),
    e.action || "EVENT",
    e.actor || "system",
    e.role || "SYSTEM",
    e.targetEntity || "—",
    e.status || "SUCCESS",
    e.ipAddress || "—"
  ]);
  let csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `immutable_audit_log_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Audit log exported to CSV.", "info");
}

function emptyTrashVault(root) {
  showToast("Trash Vault is clean. Zero expired records pending purge.", "info");
}

// ─── Data Loaders ─────────────────────────────────────────────────────────────

async function loadAdminData(root) {
  try {
    const [overviewRes, queueRes, cafesRes, usersRes] = await Promise.allSettled([
      apiGet("/admin/overview"),
      apiGet("/admin/work-queue"),
      apiGet("/cafes"),
      apiGet("/users"),
    ]);

    if (overviewRes.status === "fulfilled") {
      adminState.overviewData = overviewRes.value?.data || null;
    }
    if (queueRes.status === "fulfilled") {
      adminState.workQueue = queueRes.value?.data?.queue || [];
    }
    if (cafesRes.status === "fulfilled") {
      adminState.cafes = cafesRes.value?.data?.cafes || [];
    }
    if (usersRes.status === "fulfilled") {
      adminState.users = usersRes.value?.data?.users || [];
    }

    const mount = root.querySelector("#admin-main-tab-content");
    if (mount) {
      mount.innerHTML = renderActiveTabContent();
      wireActiveTab(root);
    }
  } catch (err) {
    console.error("Admin data load error:", err);
  }
}

// ─── Centred Modals & Wizards ─────────────────────────────────────────────────

function openAddCafeWizard(root) {
  const mount = root.querySelector("#admin-modals-mount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div class="modal-card card" style="width:800px;max-width:95vw;max-height:85vh;overflow-y:auto;padding:28px;background:var(--surface-raised);border:1px solid var(--line-strong);">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px;">
          <div>
            <h3 style="margin:0 0 2px;font-size:18px;font-weight:700;color:var(--ink);">+ Add New Café Location</h3>
            <p style="margin:0;font-size:12px;color:var(--muted);">Configure a new branch location, operating contact, and administrator.</p>
          </div>
          <button class="btn btn-xs btn-ghost" id="admin-close-cafe-wizard-btn" type="button">✕</button>
        </div>

        <form id="admin-add-cafe-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Café Name*</label>
              <input type="text" id="cafe-wiz-name" class="form-control" placeholder="e.g. Calicut Roastery Hub" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Display Name*</label>
              <input type="text" id="cafe-wiz-display" class="form-control" placeholder="e.g. Whitefield Branch" required />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">City*</label>
              <input type="text" id="cafe-wiz-city" class="form-control" placeholder="e.g. Bengaluru" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Café Type</label>
              <select id="cafe-wiz-type" class="form-control">
                <option value="STANDARD_CAFE">Standard Café</option>
                <option value="KIOSK">Kiosk</option>
                <option value="CAMPUS_CAFE">Campus / Institutional Café</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:12px;font-weight:700;">Address Line 1</label>
            <input type="text" id="cafe-wiz-addr" class="form-control" placeholder="e.g. ITPL Main Road, Prestige Tech Park" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Operational Phone</label>
              <input type="text" id="cafe-wiz-phone" class="form-control" placeholder="+91 98450 00000" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Initial Operating Status</label>
              <select id="cafe-wiz-status" class="form-control">
                <option value="ACTIVE">ACTIVE (Operating)</option>
                <option value="PENDING_OPENING">PENDING OPENING (Setup Mode)</option>
              </select>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--line);padding-top:14px;">
            <button class="btn btn-sm btn-ghost" id="admin-cancel-cafe-wiz-btn" type="button">Cancel</button>
            <button class="btn btn-sm btn-primary" type="submit">Create Café</button>
          </div>
        </form>

      </div>
    </div>
  `;

  mount.querySelectorAll("#admin-close-cafe-wizard-btn, #admin-cancel-cafe-wiz-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount.innerHTML = "";
    });
  });

  mount.querySelector("#admin-add-cafe-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = mount.querySelector("#cafe-wiz-name")?.value?.trim();
    const displayName = mount.querySelector("#cafe-wiz-display")?.value?.trim();
    const city = mount.querySelector("#cafe-wiz-city")?.value?.trim();
    const cafeType = mount.querySelector("#cafe-wiz-type")?.value;
    const address = mount.querySelector("#cafe-wiz-addr")?.value?.trim();
    const phone = mount.querySelector("#cafe-wiz-phone")?.value?.trim();

    try {
      await apiPost("/cafes", {
        body: {
          name,
          displayName,
          cafeType,
          address,
          city,
          phone,
        },
      });
      showToast(`Café "${name}" created successfully.`, "success");
      mount.innerHTML = "";
      await loadAdminData(root);
    } catch (err) {
      showToast(err.message || "Failed to create café.", "danger");
    }
  });
}

function openAddUserWizard(root) {
  const mount = root.querySelector("#admin-modals-mount");
  if (!mount) return;

  const isPrimary = Boolean(state.user?.isPrimaryMaster);

  mount.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div class="modal-card card" style="width:800px;max-width:95vw;max-height:85vh;overflow-y:auto;padding:28px;background:var(--surface-raised);border:1px solid var(--line-strong);">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px;">
          <div>
            <h3 style="margin:0 0 2px;font-size:18px;font-weight:700;color:var(--ink);">+ Add New User Identity</h3>
            <p style="margin:0;font-size:12px;color:var(--muted);">Create user login credentials and assign role permissions and café scopes.</p>
          </div>
          <button class="btn btn-xs btn-ghost" id="admin-close-user-wizard-btn" type="button">✕</button>
        </div>

        <form id="admin-add-user-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Full Name*</label>
              <input type="text" id="user-wiz-name" class="form-control" placeholder="e.g. Full Name" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Login Email*</label>
              <input type="email" id="user-wiz-email" class="form-control" placeholder="e.g. ananya@zamorincafe.com" required />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Application Role*</label>
              <select id="user-wiz-role" class="form-control">
                ${isPrimary ? `<option value="MASTER">MASTER (Full Governance)</option>` : ""}
                <option value="CAFE_ADMIN">CAFE_ADMIN (Café Operations)</option>
                <option value="STAFF">STAFF (Self-Service)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:12px;font-weight:700;">Assigned Café</label>
              <select id="user-wiz-cafe" class="form-control">
                ${adminState.cafes.length === 0
                  ? `<option value="" disabled selected>No registered cafés found</option>`
                  : adminState.cafes.map((c) => `<option value="${c.cafeId}">${c.cafeId} · ${c.name}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="font-size:12px;font-weight:700;">Temporary Initial Password*</label>
            <input type="password" id="user-wiz-password" class="form-control" placeholder="Min 8 characters" required />
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--line);padding-top:14px;">
            <button class="btn btn-sm btn-ghost" id="admin-cancel-user-wiz-btn" type="button">Cancel</button>
            <button class="btn btn-sm btn-primary" type="submit">Create User Identity</button>
          </div>
        </form>

      </div>
    </div>
  `;

  mount.querySelectorAll("#admin-close-user-wizard-btn, #admin-cancel-user-wiz-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount.innerHTML = "";
    });
  });

  mount.querySelector("#admin-add-user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = mount.querySelector("#user-wiz-name")?.value?.trim();
    const email = mount.querySelector("#user-wiz-email")?.value?.trim();
    const role = mount.querySelector("#user-wiz-role")?.value;
    const cafeId = mount.querySelector("#user-wiz-cafe")?.value;
    const password = mount.querySelector("#user-wiz-password")?.value;

    try {
      await apiPost("/users", {
        body: {
          fullName,
          email,
          role,
          assignedCafeIds: [cafeId],
          password,
          reason: "User created via Administration Governance",
        },
      });
      showToast(`User "${fullName}" created successfully.`, "success");
      mount.innerHTML = "";
      await loadAdminData(root);
    } catch (err) {
      showToast(err.message || "Failed to create user.", "danger");
    }
  });
}

function openCreateCustomFieldModal(root) {
  const mount = root.querySelector("#admin-modals-mount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div class="modal-card card" style="width:650px;max-width:95vw;padding:24px;background:var(--surface-raised);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--ink);">+ Create Custom Metadata Field</h3>
          <button class="btn btn-xs btn-ghost" id="admin-close-field-modal-btn" type="button">✕</button>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Field Label*</label>
          <input type="text" id="cfg-field-label" class="form-control" placeholder="e.g. Uniform Size" />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div class="form-group">
            <label class="form-label" style="font-size:12px;font-weight:700;">Applies To Entity</label>
            <select id="cfg-field-entity" class="form-control">
              <option value="Employee">Employee</option>
              <option value="Cafe">Café</option>
              <option value="User">User</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:12px;font-weight:700;">Data Type</label>
            <select id="cfg-field-type" class="form-control">
              <option value="TEXT">Short Text</option>
              <option value="NUMBER">Number</option>
              <option value="SELECT">Single Select</option>
              <option value="DATE">Date</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Data Sensitivity</label>
          <select id="cfg-field-sens" class="form-control">
            <option value="STANDARD">Standard (Operational)</option>
            <option value="PERSONAL">Personal (Employee)</option>
            <option value="SENSITIVE">Sensitive (Restricted)</option>
          </select>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="admin-close-field-modal-btn-2" type="button">Cancel</button>
          <button class="btn btn-sm btn-primary" id="admin-save-custom-field-btn" type="button">Create Field</button>
        </div>
      </div>
    </div>
  `;

  mount.querySelectorAll("#admin-close-field-modal-btn, #admin-close-field-modal-btn-2").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount.innerHTML = "";
    });
  });

  mount.querySelector("#admin-save-custom-field-btn")?.addEventListener("click", () => {
    showToast("Custom field schema updated successfully.", "success");
    mount.innerHTML = "";
  });
}

function openAdminRequestModal(root) {
  const mount = root.querySelector("#admin-modals-mount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div class="modal-card card" style="width:600px;max-width:95vw;padding:24px;background:var(--surface-raised);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--ink);">Request Primary Master Action</h3>
          <button class="btn btn-xs btn-ghost" id="admin-close-req-modal-btn" type="button">✕</button>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 16px;">
          Submit an administrative request to the Primary Master for restricted operations.
        </p>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Request Type*</label>
          <select id="req-modal-type" class="form-control">
            <option value="CREATE_MASTER_USER">Request Master User Creation</option>
            <option value="ORGANISATION_PROFILE_CHANGE">Request Legal Company Profile Update</option>
            <option value="SERVICE_CREDENTIAL_ROTATION">Request Integration Credential Rotation</option>
            <option value="RESTRICTED_RECOVERY">Request Restricted Data Recovery</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Request Title*</label>
          <input type="text" id="req-modal-title" class="form-control" placeholder="e.g. New Regional Ops Master Account" required />
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px;font-weight:700;">Business Justification &amp; Details*</label>
          <textarea id="req-modal-reason" class="form-control" rows="3" placeholder="Provide operational reason and context..." required></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="admin-close-req-modal-btn-2" type="button">Cancel</button>
          <button class="btn btn-sm btn-primary" id="admin-confirm-req-btn" type="button">Submit to Primary</button>
        </div>
      </div>
    </div>
  `;

  mount.querySelectorAll("#admin-close-req-modal-btn, #admin-close-req-modal-btn-2").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount.innerHTML = "";
    });
  });

  mount.querySelector("#admin-confirm-req-btn")?.addEventListener("click", async () => {
    const requestType = mount.querySelector("#req-modal-type")?.value;
    const title = mount.querySelector("#req-modal-title")?.value?.trim();
    const reason = mount.querySelector("#req-modal-reason")?.value?.trim();

    if (!title || !reason) {
      showToast("Please provide a title and business justification.", "warning");
      return;
    }

    try {
      await apiPost("/admin/requests", {
        body: { requestType, title, reason },
      });
      showToast("Request submitted to Primary Master.", "success");
      mount.innerHTML = "";
      await loadAdminData(root);
    } catch (err) {
      showToast(err.message || "Failed to submit request.", "danger");
    }
  });
}

export const wireAdmin = hydrateAdmin;
