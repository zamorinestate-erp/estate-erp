// =============================================================================
// ZAMORIN CAFE ERP — SHARED COMPONENTS (Design System v2: Ledger & Roastery)
// =============================================================================

import { NAVIGATION, ROLES } from "./navigation.js";
import { icon } from "./icons.js";
import { state, setState } from "./state.js";
import { navigate } from "./router.js";
import { forRole, unreadCount, markRead, markAllRead } from "./notifications.js";
import { apiGet, apiPost } from "./apiClient.js";

const ROLE_LABELS = {
  [ROLES.MASTER]: "Master User",
  [ROLES.OWNER]: "Cafe Owner",
  [ROLES.CAFE_ADMIN]: "Cafe Admin",
  [ROLES.STAFF]: "Staff",
};

const ROLE_INITIALS = {
  [ROLES.MASTER]: "MU",
  [ROLES.OWNER]: "BO",
  [ROLES.CAFE_ADMIN]: "CA",
  [ROLES.STAFF]: "SA",
};

const SIDEBAR_COLLAPSED_KEY = "zamorin-sidebar-collapsed";

export function isSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {}

  const shell = document.querySelector(".app-shell");
  const sidebar = document.getElementById("sidebar");
  if (shell) shell.classList.toggle("sidebar-collapsed", collapsed);
  if (sidebar) sidebar.classList.toggle("collapsed", collapsed);

  const toggleBtn = document.getElementById("sidebar-collapse-btn");
  if (toggleBtn) {
    toggleBtn.innerHTML = collapsed ? icon("chevronRight") : icon("chevronLeft");
    toggleBtn.title = collapsed ? "Expand Sidebar (Ctrl+[)" : "Collapse Sidebar (Ctrl+[)";
  }
}

/* -------------------------------------------------------------------------
   Sidebar — Design System v2 Navigation (Retractable & Accessible)
   ------------------------------------------------------------------------- */
export function renderSidebar() {
  const nav = NAVIGATION[state.role] || { items: [], footnote: "" };
  const user = state.auth?.user || {};
  const currentRole = state.role || ROLES.MASTER;
  const collapsed = isSidebarCollapsed();

  const itemsHtml = nav.items
    .map((item) => {
      const active = state.route === item.route ? "active" : "";
      return `
        <button class="nav-link ${active}" data-route="${item.route}" data-navid="${item.id}" title="${item.label}" type="button">
          <span class="nav-icon">${icon(item.icon)}</span>
          <span class="nav-label">${item.label}</span>
        </button>`;
    })
    .join("");

  return `
    <div class="sidebar-brand">
      <div class="brand-logo-wrap">
        <div class="brand-badge">Z</div>
        <div class="brand-text">
          <span class="brand-title">Zamorin</span>
          <span class="brand-subtitle">Estate Pvt. Ltd.</span>
        </div>
      </div>
      <button class="sidebar-toggle-btn" id="sidebar-collapse-btn" type="button" title="${collapsed ? "Expand Sidebar" : "Collapse Sidebar"}" aria-label="Toggle Sidebar">
        ${collapsed ? icon("chevronRight") : icon("chevronLeft")}
      </button>
    </div>

    <div class="sidebar-scope">
      <span class="scope-pill">${ROLE_LABELS[currentRole] || "Workspace"}</span>
    </div>

    <nav class="sidebar-nav" aria-label="Main Navigation">
      <div class="nav-list">${itemsHtml}</div>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-user">
        <div class="user-avatar" title="${user.name || "Master"} (${ROLE_LABELS[currentRole] || "Workspace"})">${ROLE_INITIALS[currentRole] || "ZU"}</div>
        <div class="user-info">
          <div class="user-name">${user.name || "Master Administrator"}</div>
          <div class="user-role">${user.email || "master@zamorin.cafe"}</div>
        </div>
      </div>
    </div>
  `;
}

export function wireSidebar(root) {
  root.querySelectorAll(".nav-link").forEach((el) => {
    el.addEventListener("click", () => {
      navigate(el.dataset.route);
      closeMobileDrawer();
    });
  });

  const collapseBtn = root.querySelector("#sidebar-collapse-btn");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setSidebarCollapsed(!isSidebarCollapsed());
    });
  }

  // Keyboard shortcut Ctrl + [ to toggle sidebar
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "[") {
      e.preventDefault();
      setSidebarCollapsed(!isSidebarCollapsed());
    }
  });
}

/* -------------------------------------------------------------------------
   Topbar — Design System v2 Header with Cafe switcher, Search & Popovers
   ------------------------------------------------------------------------- */
export function renderTopbar({ scopeChip } = {}) {
  const currentTheme = document.documentElement.dataset.theme || "paper";
  const user = state.auth?.user || {};
  const role = state.role || ROLES.MASTER;
  const initials = ROLE_INITIALS[role] || "MU";

  return `
    <div class="topbar-inner">
      <div class="topbar-left">
        <button class="topbar-action-btn sidebar-topbar-toggle" id="sidebar-toggle-btn" title="Toggle Navigation Sidebar (Ctrl+[)" aria-label="Toggle Sidebar" type="button">
          ${icon("menu")}
        </button>
        <div class="cafe-scope-dropdown">
          <select id="global-cafe-selector" class="select-scope" aria-label="Selected Cafe Scope">
            <option value="ALL">🏠 All Cafés (Global Portfolio)</option>
            <option value="ZC-0001">☕ ZC-0001 · Koramangala Main</option>
            <option value="ZC-0002">☕ ZC-0002 · Indiranagar Central</option>
            <option value="ZC-0003">☕ ZC-0003 · Calicut Beach</option>
          </select>
        </div>
      </div>

      <div class="topbar-centre">
        <div class="global-search-wrap">
          <span class="search-icon">${icon("search")}</span>
          <input type="text" id="topbar-search-input" placeholder="Search modules, records, employees... (Ctrl+K)" autocomplete="off" />
          <kbd class="search-kbd">Ctrl+K</kbd>
          <div id="topbar-search-results" class="search-results-dropdown" style="display:none;"></div>
        </div>
      </div>

      <div class="topbar-right">
        <!-- Theme Switcher Button -->
        <button class="topbar-action-btn" id="theme-btn" title="Change Appearance & Theme" type="button">
          ${icon("sun")}
        </button>

        <!-- Notification Bell Button -->
        <div class="notif-wrap">
          <button class="topbar-action-btn" id="notif-bell-btn" title="Notifications" type="button">
            ${icon("bell")}
            <span id="notif-bell-badge" class="badge-dot" style="display:none;"></span>
          </button>
        </div>

        <!-- User Profile Avatar Button -->
        <button class="profile-avatar-btn" id="profile-avatar-btn" type="button">
          <span class="avatar-text">${initials}</span>
        </button>
      </div>
    </div>

    <!-- Popovers Mount -->
    <div id="themePopover" class="popover theme-popover" style="display:none;">
      <div class="popover-head">
        <h4>Appearance &amp; Themes</h4>
      </div>
      <div class="theme-options">
        <button class="theme-opt-btn ${currentTheme === "paper" ? "selected" : ""}" data-theme-choice="paper">
          <span class="theme-color-dot" style="background:#faf9f5;border:1px solid #d7d0bd;"></span>
          <span class="theme-text">
            <strong>Paper (Default)</strong>
            <span>Warm porcelain light theme</span>
          </span>
        </button>
        <button class="theme-opt-btn ${currentTheme === "pearl" ? "selected" : ""}" data-theme-choice="pearl">
          <span class="theme-color-dot" style="background:#f7f0e2;border:1px solid #c99a5c;"></span>
          <span class="theme-text">
            <strong>Pearl</strong>
            <span>Warm parchment roastery light</span>
          </span>
        </button>
        <button class="theme-opt-btn ${currentTheme === "midnight" ? "selected" : ""}" data-theme-choice="midnight">
          <span class="theme-color-dot" style="background:#0e1729;border:1px solid #b17d38;"></span>
          <span class="theme-text">
            <strong>Midnight</strong>
            <span>Zamorin Navy brand dark mode</span>
          </span>
        </button>
        <button class="theme-opt-btn ${currentTheme === "noir" ? "selected" : ""}" data-theme-choice="noir">
          <span class="theme-color-dot" style="background:#0a0c10;border:1px solid #445064;"></span>
          <span class="theme-text">
            <strong>Noir</strong>
            <span>Charcoal high-contrast dark</span>
          </span>
        </button>
      </div>
    </div>

    <div id="notifPopover" class="popover notif-popover" style="display:none;">
      <div class="popover-head">
        <h4>Notifications</h4>
        <button class="btn btn-sm btn-ghost" id="popover-mark-all">Mark all read</button>
      </div>
      <div id="notif-popover-list" class="notif-list"></div>
      <div class="popover-foot">
        <button class="btn btn-sm btn-ghost btn-block" id="popover-view-all">Open Notification Centre</button>
      </div>
    </div>

    <div id="profilePopover" class="popover profile-popover" style="display:none;">
      <div class="profile-card-top">
        <div class="user-avatar lg">${initials}</div>
        <div class="profile-details">
          <div class="user-name">${user.name || "Master Administrator"}</div>
          <div class="user-sub">${ROLE_LABELS[role] || "Master Account"} · ${user.userId || "MU-0001"}</div>
          <div class="user-email">${user.email || "master@zamorin.cafe"}</div>
        </div>
      </div>
      <div class="popover-menu">
        <button class="popover-menu-item" data-profile-action="my-profile">
          ${icon("user")} My Profile
        </button>
        <button class="popover-menu-item" data-profile-action="settings">
          ${icon("settings")} Preferences &amp; Settings
        </button>
        <button class="popover-menu-item" data-profile-action="security">
          ${icon("shield")} Security &amp; MFA
        </button>
        <div class="popover-divider"></div>
        <button class="popover-menu-item logout" data-profile-action="logout">
          ${icon("logout")} Sign Out
        </button>
      </div>
    </div>
  `;
}

export function updateBellBadge() {
  const badge = document.getElementById("notif-bell-badge");
  if (!badge) return;
  const count = unreadCount(state.role);
  if (count > 0) {
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

export function wireBell(root) {
  // Topbar sidebar collapse toggle & mobile drawer
  const sidebarToggleBtn = root.querySelector("#sidebar-toggle-btn");
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        const sb = document.getElementById("sidebar");
        sb?.classList.toggle("open");
      } else {
        setSidebarCollapsed(!isSidebarCollapsed());
      }
    });
  }

  const menuBtn = root.querySelector("#mobile-menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const sb = document.getElementById("sidebar");
      sb?.classList.toggle("open");
    });
  }

  // Theme switcher
  const themeBtn = root.querySelector("#theme-btn");
  const themePop = root.querySelector("#themePopover");
  if (themeBtn && themePop) {
    themeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopovers(themePop);
      themePop.style.display = themePop.style.display === "block" ? "none" : "block";
    });

    themePop.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.themeChoice;
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("zamorin-theme", theme);
        themePop.querySelectorAll("[data-theme-choice]").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        themePop.style.display = "none";
        showToast(`Theme updated to ${theme.toUpperCase()}`);
      });
    });
  }

  // Notification Bell
  const notifBtn = root.querySelector("#notif-bell-btn");
  const notifPop = root.querySelector("#notifPopover");
  if (notifBtn && notifPop) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopovers(notifPop);
      const isVisible = notifPop.style.display === "block";
      if (!isVisible) {
        renderNotifList(notifPop);
        notifPop.style.display = "block";
      } else {
        notifPop.style.display = "none";
      }
    });

    const markAllBtn = notifPop.querySelector("#popover-mark-all");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => {
        markAllRead(state.role);
        updateBellBadge();
        renderNotifList(notifPop);
        showToast("All notifications marked as read");
      });
    }

    const viewAllBtn = notifPop.querySelector("#popover-view-all");
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", () => {
        notifPop.style.display = "none";
        navigate("notifications");
      });
    }
  }

  // Profile Menu
  const profileBtn = root.querySelector("#profile-avatar-btn");
  const profilePop = root.querySelector("#profilePopover");
  if (profileBtn && profilePop) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopovers(profilePop);
      profilePop.style.display = profilePop.style.display === "block" ? "none" : "block";
    });

    profilePop.querySelectorAll("[data-profile-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.profileAction;
        profilePop.style.display = "none";
        if (action === "logout") {
          try {
            await apiPost("/auth/logout");
          } catch {}
          window.location.reload();
        } else if (action === "my-profile") {
          navigate(state.role === ROLES.STAFF ? "profile" : "employees");
        } else if (action === "settings" || action === "security") {
          navigate(state.role === ROLES.STAFF ? "staff-settings" : "settings");
        }
      });
    });
  }

  // Global Search
  const searchInput = root.querySelector("#topbar-search-input");
  const searchResults = root.querySelector("#topbar-search-results");
  if (searchInput && searchResults) {
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    let searchDebounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      const q = searchInput.value.trim();
      if (q.length < 1) {
        searchResults.style.display = "none";
        return;
      }
      searchDebounce = setTimeout(async () => {
        try {
          const res = await apiGet(`/search?q=${encodeURIComponent(q)}`);
          const results = res?.data?.results || {};
          let html = "";
          for (const [group, list] of Object.entries(results)) {
            if (!list?.length) continue;
            html += `<div class="search-group-title">${group.replace(/_/g, " ")}</div>`;
            list.forEach((item) => {
              html += `
                <div class="search-item" data-search-route="${item.route}">
                  <div class="search-item-title">${item.title}</div>
                  <div class="search-item-sub">${item.subtitle || ""}</div>
                </div>`;
            });
          }
          if (!html) html = `<div class="search-empty">No matching records found</div>`;
          searchResults.innerHTML = html;
          searchResults.style.display = "block";
          searchResults.querySelectorAll("[data-search-route]").forEach((el) => {
            el.addEventListener("click", () => {
              searchResults.style.display = "none";
              searchInput.value = "";
              navigate(el.dataset.searchRoute);
            });
          });
        } catch {
          searchResults.style.display = "none";
        }
      }, 200);
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".popover") && !e.target.closest(".topbar-action-btn") && !e.target.closest(".profile-avatar-btn")) {
      closeAllPopovers();
    }
    if (!e.target.closest(".global-search-wrap")) {
      if (searchResults) searchResults.style.display = "none";
    }
  });
}

function renderNotifList(popoverEl) {
  const host = popoverEl.querySelector("#notif-popover-list");
  if (!host) return;
  const items = forRole(state.role).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  if (!items.length) {
    host.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
    return;
  }
  host.innerHTML = items
    .map(
      (n) => `
      <div class="notif-row ${n.read ? "read" : "unread"}" data-notif-id="${n.id}" data-deeplink="${n.deepLink || ""}">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.message}</div>
      </div>`
    )
    .join("");

  host.querySelectorAll(".notif-row").forEach((row) => {
    row.addEventListener("click", () => {
      markRead(row.dataset.notifId);
      updateBellBadge();
      popoverEl.style.display = "none";
      if (row.dataset.deeplink) navigate(row.dataset.deeplink);
    });
  });
}

function closeAllPopovers(exceptEl = null) {
  document.querySelectorAll(".popover").forEach((p) => {
    if (p !== exceptEl) p.style.display = "none";
  });
}

function closeMobileDrawer() {
  document.getElementById("sidebar")?.classList.remove("open");
}

/* -------------------------------------------------------------------------
   Universal Modal Manager (Design System v2)
   ------------------------------------------------------------------------- */
let currentModalResolve = null;

export function openModal({
  title = "Action",
  body = "",
  saveLabel = "Save Changes",
  cancelLabel = "Cancel",
  onSave = null,
  onCancel = null,
  maxWidth = "560px",
} = {}) {
  closeModal();

  const modalEl = document.createElement("div");
  modalEl.className = "modal-backdrop open";
  modalEl.id = "zamorin-global-modal";

  modalEl.innerHTML = `
    <div class="modal-window" style="max-width:${maxWidth}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close-btn" data-modal-cancel type="button" aria-label="Close">
          ${icon("x")}
        </button>
      </div>
      <div class="modal-content">
        ${body}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-modal-cancel type="button">${cancelLabel}</button>
        <button class="btn btn-primary" data-modal-save type="button">${saveLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const saveBtn = modalEl.querySelector("[data-modal-save]");
  const cancelBtns = modalEl.querySelectorAll("[data-modal-cancel]");

  cancelBtns.forEach((b) =>
    b.addEventListener("click", () => {
      closeModal();
      if (typeof onCancel === "function") onCancel();
    })
  );

  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeModal();
      if (typeof onCancel === "function") onCancel();
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      try {
        if (typeof onSave === "function") {
          const result = await onSave(modalEl);
          if (result !== false) closeModal();
        } else {
          closeModal();
        }
      } catch (err) {
        showToast(err?.message || "Operation failed", "coral");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = saveLabel;
      }
    });
  }

  // Focus first input
  setTimeout(() => {
    modalEl.querySelector("input, select, textarea")?.focus();
  }, 100);

  return modalEl;
}

export function closeModal() {
  const existing = document.getElementById("zamorin-global-modal");
  if (existing) existing.remove();
}

/* -------------------------------------------------------------------------
   Confirmation Dialog
   ------------------------------------------------------------------------- */
export function confirmAction({
  title = "Confirm Action",
  description = "Are you sure you want to proceed with this operation?",
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
}) {
  openModal({
    title,
    body: `<p style="font-size:14px;line-height:1.6;color:var(--muted);margin:0;">${description}</p>`,
    saveLabel: confirmLabel,
    cancelLabel: "Cancel",
    maxWidth: "440px",
    onSave: async () => {
      if (typeof onConfirm === "function") await onConfirm();
    },
  });
}

/* -------------------------------------------------------------------------
   Toast Notifications (Top Right Stack)
   ------------------------------------------------------------------------- */
export function showToast(message, type = "mint") {
  let stack = document.getElementById("toast-root");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-root";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast-pill ${type}`;
  toast.innerHTML = `
    <span class="toast-dot"></span>
    <span class="toast-msg">${message}</span>
    <button class="toast-x" type="button">×</button>
  `;

  stack.appendChild(toast);
  toast.querySelector(".toast-x").addEventListener("click", () => toast.remove());

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

/* -------------------------------------------------------------------------
   Helper Components (KPI card, Empty state, Skeleton)
   ------------------------------------------------------------------------- */
export function kpiCard({ label, value, trend = "", trendType = "up", onClick }) {
  const trendArrow = trendType === "up" ? "↑" : trendType === "down" ? "↓" : "";
  const trendClass = trendType === "up" ? "trend-up" : trendType === "down" ? "trend-down" : "";
  return `
    <article class="card kpi-card ${onClick ? "interactive" : ""}" ${onClick ? `data-action="${onClick}"` : ""}>
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${trend ? `<div class="kpi-trend ${trendClass}">${trendArrow} ${trend}</div>` : ""}
    </article>
  `;
}

export function emptyState({ title = "No records found", body = "" }) {
  return `
    <div class="empty-state-card">
      <div class="empty-icon">${icon("box")}</div>
      <h3 class="empty-title">${title}</h3>
      ${body ? `<p class="empty-body">${body}</p>` : ""}
    </div>
  `;
}

export function skeleton(height = "80px") {
  return `<div class="skeleton-shimmer" style="height:${height};border-radius:var(--radius-md);"></div>`;
}
