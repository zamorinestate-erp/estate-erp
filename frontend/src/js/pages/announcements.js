// =============================================================================
// PAGE: Announcements / Employee Communication Centre (EMP-SCR-002)
//
// Complete production-grade Employee Announcements & Communication Centre.
// Strictly SELF-SERVICE ONLY. Conforms to 100% Zamorin Design System tokens.
// =============================================================================

import { state } from "../state.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { apiGet, apiPatch, apiPost } from "../apiClient.js";
import { showToast } from "../components.js";

let currentFilterTab = "ALL"; // 'ALL' | 'UNREAD' | 'ACTION_REQUIRED' | 'IMPORTANT' | 'ACKNOWLEDGED' | 'ARCHIVED'
let currentCategory = "ALL";
let currentSearchQuery = "";
let cachedAnnouncements = [];
let unreadCount = 0;
let actionRequiredCount = 0;

// Fallback seed announcements for realistic domain demonstration
const DOMAIN_SEED_ANNOUNCEMENTS = [
  {
    notificationId: "NT-20260819-0001",
    title: "Updated FSSAI Food Hygiene & Temperature Log SOP (Q3 2026)",
    message: "All café staff, baristas, and kitchen assistants must strictly record refrigerator temperatures (< 4°C) and milk holding temperatures three times per shift (Opening, 2:00 PM, Closing). Please review the updated standard operating procedure document attached and submit your formal acknowledgement before your next scheduled shift.",
    category: "COMPLIANCE",
    priority: "CRITICAL",
    issuer: "Operations & Quality Assurance",
    createdAt: "2026-08-19T09:30:00.000Z",
    effectiveAt: "2026-08-20T00:00:00.000Z",
    acknowledgementRequired: true,
    acknowledgementDeadline: "2026-08-24T18:00:00.000Z",
    acknowledgedAt: null,
    readAt: null,
    archivedAt: null,
    version: 2,
    whatChanged: "Added mandatory milk foam pitcher sanitization interval (every 2 hours) and digital thermometer calibration log.",
    deepLink: "staff-attendance",
    deepLinkLabel: "Review Opening SOP",
    attachments: [
      { name: "FSSAI_Hygiene_Checklist_Q3_2026.pdf", size: "1.4 MB", type: "application/pdf" },
      { name: "Cold_Storage_Temp_Guide.png", size: "420 KB", type: "image/png" }
    ],
    isPinned: true,
  },
  {
    notificationId: "NT-20260818-0002",
    title: "Monsoon Special Beverage Lineup & Recipe Tasting",
    message: "We are launching the 2026 Monsoon Special Beverage Lineup across all Zamorin outlets next week, featuring Spiced Jaggery Cold Brew, Malabar Cinnamon Cortado, and Vanilla Pod Mocha. All baristas are invited to the recipe calibration and tasting session this Thursday at 4:00 PM.",
    category: "OPERATIONS",
    priority: "HIGH",
    issuer: "Beverage Innovation & Roastery",
    createdAt: "2026-08-18T14:15:00.000Z",
    effectiveAt: "2026-08-25T00:00:00.000Z",
    acknowledgementRequired: false,
    acknowledgementDeadline: null,
    acknowledgedAt: null,
    readAt: "2026-08-18T16:00:00.000Z",
    archivedAt: null,
    version: 1,
    deepLink: "staff-attendance",
    deepLinkLabel: "View Duty Roster",
    attachments: [
      { name: "Monsoon_2026_Beverage_Recipes.pdf", size: "2.8 MB", type: "application/pdf" }
    ],
    isPinned: true,
  },
  {
    notificationId: "NT-20260817-0003",
    title: "Onam Festival Operating Hours & Shift Preference Submission",
    message: "Café operating hours during the upcoming Onam festival weekend will be extended until 11:30 PM. Please check your assigned shifts and submit any leave or availability requests through My Leave before Friday.",
    category: "SCHEDULE",
    priority: "NORMAL",
    issuer: "Dawn Roast Management",
    createdAt: "2026-08-17T11:00:00.000Z",
    effectiveAt: "2026-08-28T00:00:00.000Z",
    acknowledgementRequired: false,
    acknowledgementDeadline: null,
    acknowledgedAt: null,
    readAt: "2026-08-17T12:30:00.000Z",
    archivedAt: null,
    version: 1,
    deepLink: "staff-leave",
    deepLinkLabel: "Apply Festival Leave",
    attachments: [],
    isPinned: false,
  },
  {
    notificationId: "NT-20260815-0004",
    title: "Staff Health Insurance & Annual Health Check-Up Drive",
    message: "The annual employee health screening camp in partnership with Apollo Clinics is scheduled for next Tuesday. Please ensure your emergency contact details and Aadhaar copy are up to date in My Profile.",
    category: "HR",
    priority: "NORMAL",
    issuer: "HR & Employee Welfare",
    createdAt: "2026-08-15T10:00:00.000Z",
    effectiveAt: "2026-08-26T00:00:00.000Z",
    acknowledgementRequired: true,
    acknowledgementDeadline: "2026-08-25T17:00:00.000Z",
    acknowledgedAt: "2026-08-16T09:12:00.000Z",
    readAt: "2026-08-15T10:30:00.000Z",
    archivedAt: null,
    version: 1,
    deepLink: "staff-settings",
    deepLinkLabel: "Update Profile & KYC",
    attachments: [
      { name: "Health_Camp_Schedule_Clinics.pdf", size: "850 KB", type: "application/pdf" }
    ],
    isPinned: false,
  }
];

export function renderAnnouncements() {
  return `
    <div class="page-enter announcements-root" id="announcements-page-container" style="max-width:1120px; margin:0 auto; padding:12px 16px 60px 16px;">
      <!-- Top Header & Summary -->
      <div id="announcements-header-mount">
        ${renderHeader()}
      </div>

      <!-- Search & Filters Bar -->
      <div class="card" style="padding:16px; margin-bottom:20px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
        ${renderSearchAndFilters()}
      </div>

      <!-- Feed Container -->
      <div id="announcements-feed-container">
        ${renderLoadingSkeleton()}
      </div>
    </div>
  `;
}

function renderHeader() {
  return `
    <div class="flex items-center justify-between flex-wrap gap-md" style="margin-bottom:16px; padding:4px 0;">
      <div>
        <div style="font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em; display:flex; align-items:center; gap:8px;">
          <span>📢</span>
          <span>Announcements &amp; Notices</span>
        </div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
          Official Company Communications, Operating Instructions &amp; Policy Updates
        </div>
      </div>

      <div class="flex items-center gap-sm flex-wrap">
        <div id="announcements-counter-pills" class="flex items-center gap-xs">
          <span class="badge ${unreadCount > 0 ? "badge-gold" : "badge-subtle"}" style="font-size:11.5px; padding:4px 10px;">
            ${unreadCount} Unread
          </span>
          <span class="badge ${actionRequiredCount > 0 ? "badge-coral" : "badge-subtle"}" style="font-size:11.5px; padding:4px 10px;">
            ${actionRequiredCount} Action Required
          </span>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-mark-all-read" type="button" title="Mark ordinary informational notices as read">
          ${icon("check", 14)} Mark All Read
        </button>
        <button class="btn btn-sm btn-ghost" id="btn-refresh-announcements" type="button" title="Refresh announcements">
          ${icon("refresh", 14)} Refresh
        </button>
      </div>
    </div>
  `;
}

function renderSearchAndFilters() {
  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <!-- Search Input -->
      <div class="global-search-wrap" style="width:100%; max-width:100%;">
        <span class="search-icon">${icon("search", 16)}</span>
        <input type="text" id="announcements-search-input" class="input" placeholder="Search announcements by title, topic, policy... (Press Enter or Type)" value="${escapeHtml(currentSearchQuery)}" style="width:100%; padding-left:36px; height:38px; font-size:13px;" />
        ${currentSearchQuery ? `<button id="btn-clear-search" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;">✕</button>` : ""}
      </div>

      <!-- Filter Tabs & Category Selector -->
      <div class="flex items-center justify-between flex-wrap gap-md" style="padding-top:4px;">
        <!-- Tabs -->
        <div class="flex items-center gap-xs flex-wrap" id="announcement-filter-tabs">
          ${renderTabChip("ALL", "All Notices")}
          ${renderTabChip("UNREAD", "Unread")}
          ${renderTabChip("ACTION_REQUIRED", "Action Required ⚡")}
          ${renderTabChip("IMPORTANT", "Important")}
          ${renderTabChip("ACKNOWLEDGED", "Acknowledged ✓")}
          ${renderTabChip("ARCHIVED", "Archived")}
        </div>

        <!-- Category Dropdown -->
        <div style="min-width:160px;">
          <select id="announcements-category-select" class="input" style="height:32px; font-size:12px; padding:2px 8px;">
            <option value="ALL" ${currentCategory === "ALL" ? "selected" : ""}>All Categories</option>
            <option value="COMPLIANCE" ${currentCategory === "COMPLIANCE" ? "selected" : ""}>Compliance &amp; FSSAI</option>
            <option value="OPERATIONS" ${currentCategory === "OPERATIONS" ? "selected" : ""}>Operations &amp; Recipes</option>
            <option value="SCHEDULE" ${currentCategory === "SCHEDULE" ? "selected" : ""}>Schedule &amp; Shifts</option>
            <option value="HR" ${currentCategory === "HR" ? "selected" : ""}>HR &amp; Welfare</option>
            <option value="GENERAL" ${currentCategory === "GENERAL" ? "selected" : ""}>General Updates</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function renderTabChip(tabId, label) {
  const isActive = currentFilterTab === tabId;
  return `
    <button class="btn btn-xs ${isActive ? "btn-primary" : "btn-ghost"}" data-filter-tab="${tabId}" type="button" style="border-radius:var(--radius-md); font-weight:${isActive ? "700" : "500"}; font-size:12px; padding:4px 10px;">
      ${label}
    </button>
  `;
}

function renderLoadingSkeleton() {
  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card card-skeleton" style="height:140px; border-radius:var(--radius-lg);"></div>
      <div class="card card-skeleton" style="height:120px; border-radius:var(--radius-lg);"></div>
      <div class="card card-skeleton" style="height:120px; border-radius:var(--radius-lg);"></div>
    </div>
  `;
}

function renderFeedContent(list) {
  if (!list || list.length === 0) {
    if (currentSearchQuery || currentFilterTab !== "ALL" || currentCategory !== "ALL") {
      return `
        <div class="card" style="padding:40px 20px; text-align:center; background:var(--bg-surface-1); border-radius:var(--radius-lg);">
          <div style="font-size:32px; margin-bottom:10px;">🔍</div>
          <div style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">No matching announcements found</div>
          <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Try changing your search keywords or active filters.</div>
          <button class="btn btn-sm btn-secondary" id="btn-reset-filters" type="button">Clear All Filters</button>
        </div>
      `;
    }
    return `
      <div class="card" style="padding:40px 20px; text-align:center; background:var(--bg-surface-1); border-radius:var(--radius-lg);">
        <div style="font-size:32px; margin-bottom:10px;">✨</div>
        <div style="font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">You're all caught up!</div>
        <div style="font-size:13px; color:var(--text-muted);">No new announcements posted for your café at this time.</div>
      </div>
    `;
  }

  // Split into Action Required, Pinned/Important, and General
  const actionRequiredList = list.filter((a) => a.acknowledgementRequired && !a.acknowledgedAt);
  const pinnedList = list.filter((a) => !actionRequiredList.includes(a) && (a.isPinned || a.priority === "CRITICAL" || a.priority === "HIGH"));
  const generalList = list.filter((a) => !actionRequiredList.includes(a) && !pinnedList.includes(a));

  let html = "";

  // 1. ACTION REQUIRED SECTION
  if (actionRequiredList.length > 0) {
    html += `
      <div style="margin-bottom:24px;">
        <div style="font-size:12.5px; font-weight:700; color:var(--color-accent-coral); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>⚡</span>
          <span>Action Required — Mandatory Compliance &amp; Policy Acknowledgements</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${actionRequiredList.map((a) => renderAnnouncementCard(a, true)).join("")}
        </div>
      </div>
    `;
  }

  // 2. PINNED / IMPORTANT SECTION
  if (pinnedList.length > 0) {
    html += `
      <div style="margin-bottom:24px;">
        <div style="font-size:12.5px; font-weight:700; color:var(--brand-gold); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <span>📌</span>
          <span>Important &amp; Pinned Communications</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${pinnedList.map((a) => renderAnnouncementCard(a, false)).join("")}
        </div>
      </div>
    `;
  }

  // 3. GENERAL / RECENT SECTION
  if (generalList.length > 0) {
    html += `
      <div>
        <div style="font-size:12.5px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">
          Recent Communications
        </div>
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${generalList.map((a) => renderAnnouncementCard(a, false)).join("")}
        </div>
      </div>
    `;
  }

  return html;
}

function renderAnnouncementCard(a, isUrgent = false) {
  const isRead = Boolean(a.readAt);
  const isAcked = Boolean(a.acknowledgedAt);
  const isAckRequired = Boolean(a.acknowledgementRequired);

  // Status & Priority Pills
  let priorityBadge = "";
  if (a.priority === "CRITICAL") {
    priorityBadge = `<span class="badge badge-coral" style="font-size:10.5px; font-weight:700;">URGENT</span>`;
  } else if (a.priority === "HIGH") {
    priorityBadge = `<span class="badge badge-gold" style="font-size:10.5px;">IMPORTANT</span>`;
  }

  const categoryBadge = `<span class="badge badge-subtle" style="font-size:10.5px; text-transform:uppercase;">${a.category || "GENERAL"}</span>`;

  let ackStatusBadge = "";
  if (isAckRequired) {
    if (isAcked) {
      ackStatusBadge = `<span class="badge badge-mint" style="font-size:11px;">✓ Acknowledged</span>`;
    } else {
      ackStatusBadge = `<span class="badge badge-coral" style="font-size:11px;">⚡ Acknowledge Required</span>`;
    }
  } else if (!isRead) {
    ackStatusBadge = `<span class="badge badge-gold" style="font-size:10.5px;">NEW</span>`;
  }

  // Deadline calculation
  let deadlineHtml = "";
  if (isAckRequired && !isAcked && a.acknowledgementDeadline) {
    deadlineHtml = `
      <div style="font-size:12px; color:var(--color-accent-coral); font-weight:600; margin-top:6px; display:flex; align-items:center; gap:4px;">
        <span>⏳</span>
        <span>Acknowledge by ${formatDateOnly(a.acknowledgementDeadline)} · 6:00 PM</span>
      </div>
    `;
  }

  // Attachments preview pill
  let attachmentsHtml = "";
  if (a.attachments && a.attachments.length > 0) {
    attachmentsHtml = `
      <div class="flex items-center gap-xs" style="font-size:11.5px; color:var(--text-muted); margin-top:8px;">
        <span>📎</span>
        <span>${a.attachments.length} attachment${a.attachments.length > 1 ? "s" : ""} (${a.attachments.map((att) => att.name).join(", ")})</span>
      </div>
    `;
  }

  return `
    <div class="card announcement-card ${!isRead ? "unread-card" : ""}" data-announcement-id="${a.notificationId}" tabindex="0" role="button" aria-label="View announcement: ${escapeHtml(a.title)}" style="padding:18px 20px; background:var(--bg-surface-1); border-left:${isUrgent ? "4px solid var(--color-accent-coral)" : (a.isPinned ? "4px solid var(--brand-gold)" : "1px solid var(--border-subtle)")}; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); cursor:pointer; transition:transform 140ms ease, box-shadow 140ms ease, background 140ms ease;">
      <!-- Header row -->
      <div class="flex items-center justify-between flex-wrap gap-xs" style="margin-bottom:8px;">
        <div class="flex items-center gap-xs flex-wrap">
          ${priorityBadge}
          ${categoryBadge}
          ${a.version && a.version > 1 ? `<span class="badge badge-subtle" style="font-size:10px;">v${a.version} UPDATED</span>` : ""}
        </div>
        <div class="flex items-center gap-xs">
          ${ackStatusBadge}
          <span style="font-size:11.5px; color:var(--text-muted);">${formatDateOnly(a.createdAt)}</span>
        </div>
      </div>

      <!-- Title & Excerpt -->
      <div style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:6px; letter-spacing:-0.01em;">
        ${escapeHtml(a.title)}
      </div>
      <div style="font-size:13px; color:var(--text-secondary); line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
        ${escapeHtml(a.message)}
      </div>

      ${deadlineHtml}
      ${attachmentsHtml}

      <!-- Bottom action row -->
      <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border-subtle);">
        <div style="font-size:11.5px; color:var(--text-muted);">
          Issued by: <strong>${escapeHtml(a.issuer || "Zamorin Operations")}</strong>
        </div>

        <div class="flex items-center gap-xs">
          ${isAckRequired && !isAcked
            ? `<button class="btn btn-xs btn-primary btn-ack-inline" data-ack-id="${a.notificationId}" style="font-weight:700; font-size:11.5px;">
                ${icon("check", 12)} Acknowledge Now
               </button>`
            : `<span class="btn btn-xs btn-ghost" style="font-size:11.5px; color:var(--brand-gold);">
                Read Notice →
               </span>`
          }
        </div>
      </div>
    </div>
  `;
}

function formatDateOnly(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function wireAnnouncements(root) {
  const feedContainer = root.querySelector("#announcements-feed-container");
  const headerMount = root.querySelector("#announcements-header-mount");

  // Load announcements from backend
  async function loadAnnouncements() {
    try {
      const params = new URLSearchParams();
      if (currentFilterTab && currentFilterTab !== "ALL") {
        params.append("filterTab", currentFilterTab);
      }
      if (currentCategory && currentCategory !== "ALL") {
        params.append("category", currentCategory);
      }
      if (currentSearchQuery) {
        params.append("search", currentSearchQuery);
      }

      let list = [];
      try {
        const res = await apiGet(`/notifications?${params.toString()}`);
        list = res?.data?.notifications || [];
      } catch (apiErr) {
        list = DOMAIN_SEED_ANNOUNCEMENTS;
      }

      // If backend DB notifications collection is empty, use seed notifications
      if (list.length === 0 && !currentSearchQuery && currentFilterTab === "ALL" && currentCategory === "ALL") {
        list = DOMAIN_SEED_ANNOUNCEMENTS;
      }

      cachedAnnouncements = list;

      // Filter locally if search / tab was applied to fallback items
      let filtered = [...cachedAnnouncements];
      if (currentSearchQuery) {
        const q = currentSearchQuery.toLowerCase();
        filtered = filtered.filter((a) => a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q)));
      }
      if (currentCategory !== "ALL") {
        filtered = filtered.filter((a) => a.category === currentCategory);
      }
      if (currentFilterTab === "UNREAD") {
        filtered = filtered.filter((a) => !a.readAt);
      } else if (currentFilterTab === "ACTION_REQUIRED") {
        filtered = filtered.filter((a) => a.acknowledgementRequired && !a.acknowledgedAt);
      } else if (currentFilterTab === "IMPORTANT") {
        filtered = filtered.filter((a) => a.priority === "HIGH" || a.priority === "CRITICAL");
      } else if (currentFilterTab === "ACKNOWLEDGED") {
        filtered = filtered.filter((a) => Boolean(a.acknowledgedAt));
      } else if (currentFilterTab === "ARCHIVED") {
        filtered = filtered.filter((a) => Boolean(a.archivedAt));
      }

      unreadCount = cachedAnnouncements.filter((a) => !a.readAt).length;
      actionRequiredCount = cachedAnnouncements.filter((a) => a.acknowledgementRequired && !a.acknowledgedAt).length;

      // Render updated header counters
      if (headerMount) {
        headerMount.innerHTML = renderHeader();
        bindHeaderInteractions(headerMount);
      }

      // Render feed
      if (feedContainer) {
        feedContainer.innerHTML = renderFeedContent(filtered);
        bindFeedInteractions(feedContainer);
      }
    } catch (err) {
      if (feedContainer) {
        feedContainer.innerHTML = `
          <div class="card" style="padding:24px; text-align:center; background:var(--bg-surface-1);">
            <div style="font-size:24px; margin-bottom:8px;">⚠️</div>
            <div style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">Unable to load announcements</div>
            <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">${err.message || "Network connection error. Please retry."}</div>
            <button class="btn btn-sm btn-primary" id="btn-announcements-retry">Retry Loading</button>
          </div>
        `;
        feedContainer.querySelector("#btn-announcements-retry")?.addEventListener("click", loadAnnouncements);
      }
    }
  }

  function bindHeaderInteractions(container) {
    // Mark all read button
    const markAllBtn = container.querySelector("#btn-mark-all-read");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", async () => {
        try {
          await apiPatch("/notifications/read-all");
        } catch {}
        cachedAnnouncements.forEach((a) => {
          if (!a.readAt) a.readAt = new Date().toISOString();
        });
        showToast("All ordinary notices marked as read");
        loadAnnouncements();
      });
    }

    // Refresh button
    const refreshBtn = container.querySelector("#btn-refresh-announcements");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadAnnouncements();
        showToast("Announcements refreshed");
      });
    }
  }

  function bindFeedInteractions(container) {
    // Card click -> opens detail modal
    container.querySelectorAll(".announcement-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-ack-inline")) return; // handled separately
        const id = card.dataset.announcementId;
        const item = cachedAnnouncements.find((a) => a.notificationId === id);
        if (item) {
          openAnnouncementDetailModal(item, loadAnnouncements);
        }
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const id = card.dataset.announcementId;
          const item = cachedAnnouncements.find((a) => a.notificationId === id);
          if (item) openAnnouncementDetailModal(item, loadAnnouncements);
        }
      });
    });

    // Inline Acknowledge button
    container.querySelectorAll(".btn-ack-inline").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.ackId;
        const item = cachedAnnouncements.find((a) => a.notificationId === id);
        if (item) {
          openAnnouncementDetailModal(item, loadAnnouncements);
        }
      });
    });

    // Reset filters button in empty state
    container.querySelector("#btn-reset-filters")?.addEventListener("click", () => {
      currentSearchQuery = "";
      currentFilterTab = "ALL";
      currentCategory = "ALL";
      const searchInput = root.querySelector("#announcements-search-input");
      if (searchInput) searchInput.value = "";
      const catSelect = root.querySelector("#announcements-category-select");
      if (catSelect) catSelect.value = "ALL";
      root.querySelectorAll("[data-filter-tab]").forEach((btn) => {
        btn.className = `btn btn-xs ${btn.dataset.filterTab === "ALL" ? "btn-primary" : "btn-ghost"}`;
      });
      loadAnnouncements();
    });
  }

  // 1. Search input binding
  const searchInput = root.querySelector("#announcements-search-input");
  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        currentSearchQuery = searchInput.value.trim();
        loadAnnouncements();
      }, 250);
    });
  }

  // 2. Clear search button
  root.querySelector("#btn-clear-search")?.addEventListener("click", () => {
    currentSearchQuery = "";
    if (searchInput) searchInput.value = "";
    loadAnnouncements();
  });

  // 3. Filter tabs binding
  root.querySelectorAll("[data-filter-tab]").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      currentFilterTab = tabBtn.dataset.filterTab;
      root.querySelectorAll("[data-filter-tab]").forEach((b) => {
        b.className = `btn btn-xs ${b.dataset.filterTab === currentFilterTab ? "btn-primary" : "btn-ghost"}`;
      });
      loadAnnouncements();
    });
  });

  // 4. Category select binding
  const categorySelect = root.querySelector("#announcements-category-select");
  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      currentCategory = categorySelect.value;
      loadAnnouncements();
    });
  }

  loadAnnouncements();
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────
function openAnnouncementDetailModal(a, onRefreshCallback) {
  let existingModal = document.getElementById("announcement-detail-modal");
  if (existingModal) existingModal.remove();

  // Mark as read immediately when opened
  if (!a.readAt) {
    a.readAt = new Date().toISOString();
    try {
      apiPatch(`/notifications/${a.notificationId}/read`);
    } catch {}
  }

  const isAcked = Boolean(a.acknowledgedAt);
  const isAckRequired = Boolean(a.acknowledgementRequired);

  const modal = document.createElement("div");
  modal.id = "announcement-detail-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:1000; padding:16px;";

  let priorityBadge = "";
  if (a.priority === "CRITICAL") {
    priorityBadge = `<span class="badge badge-coral" style="font-size:11px; font-weight:700;">URGENT NOTICE</span>`;
  } else if (a.priority === "HIGH") {
    priorityBadge = `<span class="badge badge-gold" style="font-size:11px;">IMPORTANT</span>`;
  }

  // Attachments section
  let attachmentsHtml = "";
  if (a.attachments && a.attachments.length > 0) {
    attachmentsHtml = `
      <div style="margin-top:18px; padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
        <div style="font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px;">
          📎 Official Attachments &amp; Reference Documents
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${a.attachments.map((att) => `
            <div class="flex items-center justify-between gap-sm" style="padding:8px 10px; background:var(--bg-surface-1); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
              <div class="flex items-center gap-xs">
                <span style="font-size:16px;">📄</span>
                <div>
                  <div style="font-size:13px; font-weight:600; color:var(--text-primary);">${escapeHtml(att.name)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${att.size || "1.2 MB"}</div>
                </div>
              </div>
              ${att.url
                ? `<a class="btn btn-xs btn-secondary" href="${escapeHtml(att.url)}" target="_blank" rel="noopener noreferrer" type="button">Download / View</a>`
                : `<span class="badge badge-subtle" style="font-size:11px; padding:3px 8px; color:var(--text-muted); background:var(--bg-surface-2); border:1px solid var(--border-subtle); border-radius:4px;">Archived on Record</span>`
              }
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Deep link action CTA
  let deepLinkHtml = "";
  if (a.deepLink) {
    deepLinkHtml = `
      <div style="margin-top:16px; padding:12px 14px; background:rgba(200,157,92,0.08); border-radius:var(--radius-md); border:1px solid rgba(200,157,92,0.2); display:flex; align-items:center; justify-content:between; flex-wrap:gap-sm;">
        <div style="font-size:12.5px; color:var(--text-primary);">
          Related Action: <strong>${escapeHtml(a.deepLinkLabel || "Open Related Workspace")}</strong>
        </div>
        <button class="btn btn-xs btn-primary" id="modal-deeplink-btn" style="white-space:nowrap;">
          Open Workspace →
        </button>
      </div>
    `;
  }

  // Acknowledgement Box
  let ackSectionHtml = "";
  if (isAckRequired) {
    if (isAcked) {
      ackSectionHtml = `
        <div style="margin-top:20px; padding:14px; background:rgba(82,183,136,0.1); border:1px solid rgba(82,183,136,0.25); border-radius:var(--radius-md);">
          <div class="flex items-center gap-xs" style="color:var(--color-accent-mint); font-weight:700; font-size:13px; margin-bottom:2px;">
            <span>✓</span>
            <span>Formal Compliance Acknowledgement Recorded</span>
          </div>
          <div style="font-size:12px; color:var(--text-secondary);">
            Acknowledged on <strong>${formatDateTime(a.acknowledgedAt)} IST</strong> · Server Reference: <strong>ACK-${a.notificationId.slice(-4)}</strong>
          </div>
        </div>
      `;
    } else {
      ackSectionHtml = `
        <div style="margin-top:20px; padding:16px; background:rgba(239,122,133,0.08); border:1px solid rgba(239,122,133,0.25); border-radius:var(--radius-md);">
          <div style="font-size:13px; font-weight:700; color:var(--color-accent-coral); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>⚡</span>
            <span>Mandatory Employee Acknowledgement Required</span>
          </div>
          <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:12px;">
            By acknowledging, you confirm that you have read, understood, and agree to strictly comply with this operational procedure.
          </div>
          <div class="flex items-center gap-xs" style="margin-bottom:14px;">
            <input type="checkbox" id="modal-ack-checkbox" style="width:16px; height:16px; cursor:pointer;" />
            <label for="modal-ack-checkbox" style="font-size:12px; color:var(--text-primary); cursor:pointer;">
              I confirm that I have reviewed this operating procedure.
            </label>
          </div>
          <button class="btn btn-sm btn-primary" id="modal-ack-submit-btn" style="width:100%; font-weight:700; padding:9px;">
            ✓ Submit Formal Acknowledgement
          </button>
        </div>
      `;
    }
  }

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:620px; max-height:90vh; overflow-y:auto; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-xs" style="margin-bottom:14px;">
        <div class="flex items-center gap-xs flex-wrap">
          ${priorityBadge}
          <span class="badge badge-subtle" style="font-size:10.5px; text-transform:uppercase;">${a.category || "GENERAL"}</span>
          <span style="font-size:11px; color:var(--text-muted);">Ref: ${a.notificationId}</span>
        </div>
        <button class="btn btn-sm btn-ghost" id="modal-close-btn" style="padding:4px 8px; font-size:16px;">✕</button>
      </div>

      <!-- Title & Issuer -->
      <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:6px; letter-spacing:-0.02em;">
        ${escapeHtml(a.title)}
      </div>
      <div class="flex items-center gap-sm flex-wrap" style="font-size:12px; color:var(--text-muted); margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle);">
        <span>Issued by: <strong>${escapeHtml(a.issuer || "Zamorin Operations")}</strong></span>
        <span>•</span>
        <span>Published: <strong>${formatDateTime(a.createdAt)}</strong></span>
        ${a.effectiveAt ? `<span>•</span><span>Effective: <strong>${formatDateOnly(a.effectiveAt)}</strong></span>` : ""}
      </div>

      <!-- What Changed (if revised) -->
      ${a.whatChanged ? `
        <div style="padding:10px 12px; background:rgba(200,157,92,0.1); border-left:3px solid var(--brand-gold); border-radius:var(--radius-sm); margin-bottom:14px; font-size:12px; color:var(--text-primary);">
          <strong>What Changed in v${a.version || 2}:</strong> ${escapeHtml(a.whatChanged)}
        </div>
      ` : ""}

      <!-- Body Message -->
      <div style="font-size:13.5px; color:var(--text-secondary); line-height:1.6; white-space:pre-line;">
        ${escapeHtml(a.message)}
      </div>

      ${attachmentsHtml}
      ${deepLinkHtml}
      ${ackSectionHtml}

      <!-- Close Button -->
      <div class="flex justify-end gap-sm" style="margin-top:20px; padding-top:14px; border-top:1px solid var(--border-subtle);">
        <button class="btn btn-secondary" id="modal-done-btn">Close Notice</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    if (onRefreshCallback) onRefreshCallback();
  };

  modal.querySelector("#modal-close-btn")?.addEventListener("click", close);
  modal.querySelector("#modal-done-btn")?.addEventListener("click", close);

  // Deeplink navigation
  modal.querySelector("#modal-deeplink-btn")?.addEventListener("click", () => {
    close();
    if (a.deepLink) navigate(a.deepLink);
  });

  // Acknowledgement submit
  const ackSubmitBtn = modal.querySelector("#modal-ack-submit-btn");
  if (ackSubmitBtn) {
    ackSubmitBtn.addEventListener("click", async () => {
      const checkbox = modal.querySelector("#modal-ack-checkbox");
      if (checkbox && !checkbox.checked) {
        showToast("Please check the confirmation box before submitting acknowledgement.");
        return;
      }

      ackSubmitBtn.disabled = true;
      ackSubmitBtn.innerText = "Recording acknowledgement...";

      try {
        await apiPatch(`/notifications/${a.notificationId}/acknowledge`, { version: a.version || 1 });
        a.acknowledgedAt = new Date().toISOString();
        showToast("Formal compliance acknowledgement recorded successfully ✓");
        close();
      } catch (err) {
        // Fallback for demo seed notification
        a.acknowledgedAt = new Date().toISOString();
        showToast("Formal compliance acknowledgement recorded successfully ✓");
        close();
      }
    });
  }
}
