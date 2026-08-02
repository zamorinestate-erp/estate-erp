// PAGE: Notification Centre (Part 13 of the notification spec)
import { state } from "../state.js";
import { forRole, markRead, markAllRead, timeAgo } from "../notifications.js";
import { navigate } from "../router.js";
import { updateBellBadge } from "../components.js";

let activeTab = "all";

export function renderNotificationCentre() {
  const all = forRole(state.role).sort((a, b) => b.createdAt - a.createdAt);
  const list = filterList(all);

  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Notification Centre</div>
          <div class="muted-white" style="font-size:13.5px;">${all.filter((n) => !n.read).length} unread</div>
        </div>
        <button class="btn btn-ghost" id="mark-all-read-btn">Mark all as read</button>
      </div>

      <div class="flex gap-sm" style="margin-bottom:16px;" id="notif-tabs">
        ${["all", "unread", "action"].map(
          (t) => `<button class="btn btn-ghost ${activeTab === t ? "selected" : ""}" data-tab="${t}" style="padding:9px 16px; font-size:12.5px;">${{ all: "All", unread: "Unread", action: "Action Required" }[t]}</button>`
        ).join("")}
      </div>

      <div class="flex-col gap-md" id="notif-list">${list.map(rowHtml).join("") || emptyHtml()}</div>
    </div>
  `;
}

function filterList(all) {
  if (activeTab === "unread") return all.filter((n) => !n.read);
  if (activeTab === "action") return all.filter((n) => n.actionRequired);
  return all;
}

function emptyHtml() {
  return `<div class="glass empty-state"><div class="empty-state-title">Nothing here</div><div>You're all caught up.</div></div>`;
}

function rowHtml(n) {
  const pill = n.severity === "high" || n.severity === "critical" ? "pill-coral" : n.severity === "warning" ? "pill-amber" : "pill-mint";
  return `
    <div class="glass" style="padding:16px; display:flex; justify-content:space-between; align-items:flex-start; ${n.read ? "opacity:0.6;" : ""}" data-notif-row="${n.id}">
      <div style="flex:1;">
        <div class="flex items-center gap-sm" style="margin-bottom:6px;">
          <div class="pill ${pill}" style="padding:3px 9px; font-size:10.5px;">${n.category}</div>
          ${!n.read ? `<div style="width:7px;height:7px;border-radius:50%;background:var(--color-accent-mint-bright);"></div>` : ""}
        </div>
        <div style="color:#fff; font-weight:600; font-size:13.5px;">${n.title}</div>
        <div class="muted-white" style="font-size:12px; margin-top:2px;">${n.message}</div>
        <div class="muted-white" style="font-size:10.5px; margin-top:6px;">${timeAgo(n.createdAt)}</div>
      </div>
      <button class="btn btn-ghost" style="padding:7px 12px; font-size:11.5px;" data-open="${n.id}" data-deeplink="${n.deepLink}">Open</button>
    </div>
  `;
}

export function wireNotificationCentre(root) {
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      root.innerHTML = renderNotificationCentre();
      wireNotificationCentre(root);
    });
  });

  root.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      markRead(btn.dataset.open);
      navigate(btn.dataset.deeplink);
    });
  });

  const markAllBtn = root.querySelector("#mark-all-read-btn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      markAllRead(state.role);
      updateBellBadge();
      root.innerHTML = renderNotificationCentre();
      wireNotificationCentre(root);
    });
  }
}
