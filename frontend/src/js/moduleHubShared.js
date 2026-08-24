// =============================================================================
// ZAMORIN CAFE ERP — SHARED MODULE HUB & DEDICATED WORKSPACE PRIMITIVES
//
// Authoritative Shared Component Architecture for all Level 1 (Control Centre)
// and Level 2 (Dedicated Child Workspaces) across the 4 management profiles.
// =============================================================================

import { navigate } from "./router.js";
import { state } from "./state.js";

function escHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Render standard Level 1 Module Control Centre (Overview Landing)
 */
export function renderModuleControlCentre({
  moduleKey,
  title,
  subtitle,
  badge = null,
  scopeBanner = "",
  kpis = [],
  attentionItems = [],
  tiles = [],
  recentActivity = [],
  quickActions = [],
}) {
  return `
    <div class="page-enter module-control-centre" id="${escHtml(moduleKey)}-root-wrap" data-module="${escHtml(moduleKey)}" style="display:flex; flex-direction:column; gap:20px; padding-bottom:60px;">
      <!-- Module Header -->
      <header class="page-header-standard" style="margin-bottom:0;">
        <div class="page-title-group" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; width:100%;">
          <div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <h1 class="page-title" style="font-size:22px; font-weight:800; color:var(--ink); margin:0; font-family:var(--font-display);">
                ${escHtml(title)}
              </h1>
              ${badge ? `
                <span class="badge ${badge.type || "badge-accent"}" style="font-size:11px; padding:2px 8px; font-weight:700;">
                  ${escHtml(badge.label)}
                </span>
              ` : ""}
            </div>
            <p class="page-subtitle" style="font-size:13px; color:var(--muted); margin:4px 0 0; line-height:1.4;">
              ${escHtml(subtitle)}
            </p>
          </div>

          ${quickActions.length > 0 ? `
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${quickActions.map((qa) => `
                <button
                  class="btn ${qa.primary ? "btn-primary" : "btn-ghost"} btn-sm"
                  id="${escHtml(qa.id || "")}"
                  data-module-action="${escHtml(qa.action || "")}"
                  type="button"
                  style="font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"
                >
                  ${qa.icon ? `<span>${qa.icon}</span>` : ""}
                  <span>${escHtml(qa.label)}</span>
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </header>

      <!-- Scope Context Strip (if applicable) -->
      ${scopeBanner || ""}

      <!-- Module-Wide KPI Summary Grid -->
      ${kpis.length > 0 ? `
        <div class="kpi-metric-grid">
          ${kpis.map((kpi) => `
            <div class="kpi-metric-card">
              <div class="kpi-label">${escHtml(kpi.label)}</div>
              <div class="kpi-value" style="${kpi.color ? `color:${kpi.color};` : ""}">${escHtml(kpi.value)}</div>
              ${kpi.footer ? `<div class="kpi-footer">${escHtml(kpi.footer)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}

      <!-- Attention / Exceptions Strip -->
      ${attentionItems.length > 0 ? `
        <div class="card" style="padding:14px 18px; background:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.3); border-radius:var(--radius-md, 10px); display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:11.5px; font-weight:800; color:var(--amber, #f59e0b); display:flex; align-items:center; gap:6px; text-transform:uppercase; letter-spacing:0.5px;">
            <span>⚡</span> REQUIRES ATTENTION (${attentionItems.length})
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${attentionItems.map((item) => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; color:var(--ink); gap:12px; flex-wrap:wrap;">
                <span>• ${escHtml(item.message)}</span>
                ${item.targetRoute ? `
                  <button
                    class="btn btn-ghost btn-sm"
                    data-attention-route="${escHtml(item.targetRoute)}"
                    type="button"
                    style="font-size:11px; padding:2px 8px; color:var(--bronze-600, #b17d38); font-weight:700;"
                  >
                    ${escHtml(item.actionLabel || "Review →")}
                  </button>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <!-- Dedicated Option Workspace Navigation Tiles -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title" style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:var(--muted); margin-bottom:12px;">
          Operational Workspaces &amp; Registers
        </h3>
        <div class="module-tile-grid">
          ${tiles.map((t) => `
            <button
              class="module-hub-tile"
              data-hub-tile="${escHtml(t.id)}"
              data-hub-route="${escHtml(t.route || `${moduleKey}/${t.id}`)}"
              type="button"
              tabindex="0"
              aria-label="${escHtml(t.title)}: ${escHtml(t.subtitle || "")}"
            >
              <div class="module-tile-icon-box">${t.icon || "📁"}</div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${escHtml(t.title)}</span>
                  ${t.badge ? `
                    <span class="module-tile-badge ${t.badgeType || ""}">${escHtml(t.badge)}</span>
                  ` : ""}
                </div>
                <div class="module-tile-sub">${escHtml(t.subtitle || "")}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Recent Activity Feed (Optional Module-Level) -->
      ${recentActivity.length > 0 ? `
        <div class="card" style="padding:18px 20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md, 10px);">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted); margin-bottom:12px;">
            Recent Module Activity
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${recentActivity.map((act) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface-sunken); border-radius:var(--radius-sm, 6px); font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:700; color:var(--ink);">${escHtml(act.action)}</span>
                  <span style="color:var(--muted);">· ${escHtml(act.entity)}</span>
                </div>
                <span style="color:var(--muted); font-size:11px;">${escHtml(act.time)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

/**
 * Render standard Level 2 Dedicated Child Workspace Header with Breadcrumbs
 */
export function renderChildWorkspaceHeader({
  moduleKey,
  moduleTitle,
  workspaceTitle,
  icon = "📁",
  desc = "",
  topActions = [],
  breadcrumbExtra = "",
  statusBadge = null,
}) {
  return `
    <header class="settings-header-box" style="margin-bottom:20px;">
      <!-- Breadcrumb Bar -->
      <div class="settings-breadcrumb-bar">
        <button class="settings-breadcrumb-link" data-module-back="${escHtml(moduleKey)}" type="button">
          ${escHtml(moduleTitle)}
        </button>
        <span>/</span>
        ${breadcrumbExtra ? `<span>${escHtml(breadcrumbExtra)}</span><span>/</span>` : ""}
        <span style="color:var(--ink); font-weight:700;">${escHtml(workspaceTitle)}</span>
      </div>

      <!-- Title & Actions Row -->
      <div class="settings-page-title-row" style="margin-top:4px;">
        <h1 class="settings-page-h1" style="margin:0;">
          <span>${icon}</span>
          <span>${escHtml(workspaceTitle)}</span>
        </h1>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${statusBadge ? `
            <span class="settings-status-chip ${statusBadge.type || "success"}">
              ${escHtml(statusBadge.label)}
            </span>
          ` : ""}
          <button class="btn btn-ghost btn-sm" data-module-back="${escHtml(moduleKey)}" type="button" style="font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
            <span>←</span> <span>Back to ${escHtml(moduleTitle)}</span>
          </button>
          ${topActions.map((act) => `
            <button
              class="btn ${act.primary ? "btn-primary" : "btn-ghost"} btn-sm"
              id="${escHtml(act.id || "")}"
              data-action="${escHtml(act.action || "")}"
              type="button"
              style="font-size:12px; font-weight:700;"
            >
              ${act.icon ? `<span>${act.icon}</span> ` : ""}${escHtml(act.label)}
            </button>
          `).join("")}
        </div>
      </div>

      ${desc ? `<p class="settings-page-desc" style="margin:6px 0 0;">${escHtml(desc)}</p>` : ""}
    </header>
  `;
}

/**
 * Standard event wiring for Level 1 Module Control Centre
 */
export function wireModuleControlCentre(root, moduleKey) {
  if (!root) return;

  // Option tile clicks -> navigate to dedicated child route
  root.querySelectorAll("[data-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const targetRoute = evt.currentTarget.dataset.hubRoute || `${moduleKey}/${evt.currentTarget.dataset.hubTile}`;
      navigate(targetRoute);
    });

    btn.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        btn.click();
      }
    });
  });

  // Attention strip review clicks -> navigate to child route
  root.querySelectorAll("[data-attention-route]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      const targetRoute = evt.currentTarget.dataset.attentionRoute;
      if (targetRoute) navigate(targetRoute);
    });
  });

  // Breadcrumb back clicks -> return to module overview
  root.querySelectorAll("[data-module-back]").forEach((btn) => {
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      const baseModule = evt.currentTarget.dataset.moduleBack || moduleKey;
      navigate(baseModule);
    });
  });
}
