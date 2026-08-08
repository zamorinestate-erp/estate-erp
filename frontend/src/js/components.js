// =============================================================================
// ZAMORIN CAFE ERP — SHARED COMPONENTS (Part S of the guideline)
// Every function here returns an HTML string or mounts DOM. Built once,
// used by every page — this is what keeps the whole app visually and
// behaviourally consistent instead of each screen reinventing its own card.
// =============================================================================

import { NAVIGATION, ROLES } from "./navigation.js";
import { icon } from "./icons.js";
import { state } from "./state.js";
import { navigate } from "./router.js";
import { forRole, unreadCount, markRead, markAllRead } from "./notifications.js";

const ROLE_LABELS = {
  [ROLES.MASTER]: "Master User",
  [ROLES.OWNER]: "Cafe Owner",
  [ROLES.CAFE_ADMIN]: "Cafe Admin",
  [ROLES.STAFF]: "Staff",
};

const ROLE_INITIALS = {
  [ROLES.MASTER]: "MU",
  [ROLES.OWNER]: "CO",
  [ROLES.CAFE_ADMIN]: "RA",
  [ROLES.STAFF]: "PN",
};

/* -------------------------------------------------------------------------
   Sidebar — built entirely from NAVIGATION[role]. Nothing conditional here;
   if a role's config doesn't list an item, this loop never sees it.
   ------------------------------------------------------------------------- */
export function renderSidebar() {
  const nav = NAVIGATION[state.role];
  const itemsHtml = nav.items
    .map((item) => {
      const active = state.route === item.route ? "active" : "";
      return `
        <div class="nav-item ${active}" data-route="${item.route}" data-navid="${item.id}">
          ${icon(item.icon)}
          <span>${item.label}</span>
        </div>`;
    })
    .join("");

  return `
    <div class="brand-row">
      <div class="brand-mark"></div>
      <div class="brand-name">Zamorin</div>
    </div>
    ${nav.scopeLabel ? `<div class="nav-scope-label">${nav.scopeLabel}</div>` : ""}
    <div class="nav-list">${itemsHtml}</div>
    <div class="nav-footnote">${nav.footnote}</div>
  `;
}

export function wireSidebar(root) {
  root.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.route));
  });
}

/* -------------------------------------------------------------------------
   Topbar
   ------------------------------------------------------------------------- */
export function renderTopbar({ scopeChip } = {}) {
  return `
    <div class="flex items-center gap-md">
      ${scopeChip || ""}
    </div>
    <div class="flex items-center gap-md" style="position:relative;">
      <div id="notif-bell-wrap" style="position:relative; cursor:pointer;">
        <div id="notif-bell" style="width:20px;height:20px;color:var(--text-on-light);">
          ${icon("bell").replace('class="nav-icon"', 'style="width:100%;height:100%"')}
        </div>
        <div id="notif-bell-badge" class="pill pill-coral" style="display:none; position:absolute; top:-8px; right:-10px; padding:1px 5px; font-size:9.5px; min-width:16px; justify-content:center;"></div>
      </div>
      <div id="notif-panel" class="glass" style="display:none; position:absolute; top:44px; right:0; width:340px; max-height:420px; overflow-y:auto; padding:14px; z-index:850;"></div>
      <div class="avatar">${ROLE_INITIALS[state.role]}</div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
   Notification bell — compact panel + live badge (Part 14 of the spec)
   ------------------------------------------------------------------------- */
export function updateBellBadge() {
  const badge = document.getElementById("notif-bell-badge");
  if (!badge) return;
  const count = unreadCount(state.role);
  if (count > 0) {
    badge.style.display = "flex";
    badge.textContent = count > 99 ? "99+" : String(count);
  } else {
    badge.style.display = "none";
  }
}

function renderBellPanel() {
  const items = forRole(state.role).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const actionItems = items.filter((n) => n.actionRequired && !n.read);
  return `
    <div class="flex justify-between items-center" style="margin-bottom:10px;">
      <div style="color:#fff; font-weight:600; font-size:13px;">Notifications</div>
      <div style="color:var(--color-accent-mint-bright); font-size:11px; cursor:pointer;" data-mark-all>Mark all read</div>
    </div>
    ${actionItems.length ? `<div class="muted-white" style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Action required</div>` : ""}
    <div class="flex-col gap-sm" style="margin-bottom:10px;">
      ${items.length ? items.map((n) => `
        <div class="flex-col" style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08); cursor:pointer; ${n.read ? "opacity:0.55;" : ""}" data-panel-item="${n.id}" data-deeplink="${n.deepLink}">
          <div style="color:#fff; font-size:12px; font-weight:600;">${n.title}</div>
          <div class="muted-white" style="font-size:11px;">${n.message}</div>
        </div>`).join("") : `<div class="muted-white" style="font-size:12px; padding:10px 0;">No notifications yet</div>`}
    </div>
    <button class="btn btn-ghost btn-block" data-view-all style="font-size:12px; padding:9px;">View All</button>
  `;
}

export function wireBell(root, docBody) {
  const wrap = root.querySelector("#notif-bell-wrap");
  const panel = root.querySelector("#notif-panel");
  if (!wrap || !panel) return;

  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display === "block";
    if (isOpen) {
      panel.style.display = "none";
      return;
    }
    panel.innerHTML = renderBellPanel();
    panel.style.display = "block";
    panel.querySelectorAll("[data-panel-item]").forEach((el) => {
      el.addEventListener("click", () => {
        markRead(el.dataset.panelItem);
        updateBellBadge();
        panel.style.display = "none";
        navigate(el.dataset.deeplink);
      });
    });
    const markAll = panel.querySelector("[data-mark-all]");
    if (markAll) markAll.addEventListener("click", (ev) => {
      ev.stopPropagation();
      markAllRead(state.role);
      updateBellBadge();
      panel.innerHTML = renderBellPanel();
    });
    const viewAll = panel.querySelector("[data-view-all]");
    if (viewAll) viewAll.addEventListener("click", () => {
      panel.style.display = "none";
      navigate("notifications");
    });
  });

  (docBody || document).addEventListener("click", () => {
    if (panel) panel.style.display = "none";
  });
}

/* -------------------------------------------------------------------------
   KPI card
   ------------------------------------------------------------------------- */
export function kpiCard({ label, value, trend, trendType = "up", onClick }) {
  const trendClass = trendType === "up" ? "kpi-trend-up" : "kpi-trend-down";
  const arrow = trendType === "up" ? "▲" : "▼";
  const clickable = onClick ? "clickable" : "";
  return `
    <div class="glass kpi-card ${clickable}" ${onClick ? `data-action="${onClick}"` : ""}>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="${trendClass}">${arrow} ${trend}</div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
   Toast (Part S.8 — confirms results, auto-dismisses, never blocks)
   ------------------------------------------------------------------------- */
export function showToast(message, kind = "mint") {
  const bg = { mint: "#05A88A", coral: "#c9584a", amber: "#b98a3a" }[kind] || "#05A88A";
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.style.background = bg;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 200ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

/* -------------------------------------------------------------------------
   Confirm dialog (Part J.2 — always names the specific record)
   ------------------------------------------------------------------------- */
export function confirmAction({ title, description, confirmLabel = "Confirm", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="glass-dark dialog-box">
      <h3>${title}</h3>
      <p>${description}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="confirm">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-act="cancel"]').onclick = () => overlay.remove();
  overlay.querySelector('[data-act="confirm"]').onclick = () => {
    overlay.remove();
    onConfirm && onConfirm();
  };
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

/* -------------------------------------------------------------------------
   Empty state (Part N.1 — never a blank box)
   ------------------------------------------------------------------------- */
export function emptyState({ title, body }) {
  return `
    <div class="empty-state">
      <div class="empty-state-title">${title}</div>
      <div style="font-size:13px; max-width:360px;">${body}</div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
   Skeleton block (Part H.4 — shape-matching loading placeholder)
   ------------------------------------------------------------------------- */
export function skeleton(height = "80px") {
  return `<div class="skeleton" style="width:100%; height:${height};"></div>`;
}
