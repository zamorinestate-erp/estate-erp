// PAGE: Administration & Settings (Part G.19) — Master only, no other role reaches this
import { showToast } from "../components.js";

const TABS = ["Cafes", "Users", "Branding", "Trash Bin", "Audit Page"];

const CAFES = [
  { id: "ZC-0001", name: "Dawn Roast — Koramangala", admin: "Ravi Kumar", status: "Active" },
  { id: "ZC-0002", name: "Indiranagar", admin: "Suresh Menon", status: "Active" },
  { id: "ZC-0003", name: "Koramangala Central", admin: "Meera Iyer", status: "Active" },
];

const USERS = [
  { id: "MU-0001", name: "Master User", role: "Master" },
  { id: "OW-0002", name: "Cafe Owner", role: "Owner" },
  { id: "AD-0003", name: "Ravi Kumar", role: "Cafe Admin" },
  { id: "ST-0004", name: "Priya Nair", role: "Staff" },
];

const TRASH = [
  { entity: "Expense EX-0089", deletedBy: "Ravi Kumar", days: "12 days left" },
  { entity: "Vendor 'Old Supplies Co'", deletedBy: "Master User", days: "27 days left" },
];

const AUDIT = [
  { time: "Today 09:14", event: "Login — Master User", detail: "Chrome, Bengaluru" },
  { time: "Today 08:02", event: "Cash session opened — Dawn Roast", detail: "By Ravi Kumar" },
  { time: "Yesterday 22:40", event: "Bank details revealed — Priya Nair", detail: "By Master User" },
];

export function renderAdmin() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Administration &amp; Settings</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Master only — no other role has any version of this screen</div>

      <div class="flex gap-sm" style="margin-bottom:16px;" id="admin-tabs">
        ${TABS.map((t, i) => `<button class="btn btn-ghost ${i === 0 ? "selected" : ""}" data-tab="${t}" style="padding:9px 16px; font-size:12.5px;">${t}</button>`).join("")}
      </div>

      <div id="admin-tab-content">${cafesTab()}</div>
    </div>
  `;
}

function cafesTab() {
  return `<div class="glass" style="padding:22px;">
    <table class="glass-table"><thead><tr><th>ID</th><th>Cafe</th><th>Admin</th><th>Status</th></tr></thead>
    <tbody>${CAFES.map((c) => `<tr><td class="muted-white">${c.id}</td><td>${c.name}</td><td>${c.admin}</td><td><span class="pill pill-mint">${c.status}</span></td></tr>`).join("")}</tbody></table>
  </div>`;
}
function usersTab() {
  return `<div class="glass" style="padding:22px;">
    <table class="glass-table"><thead><tr><th>ID</th><th>Name</th><th>Role</th></tr></thead>
    <tbody>${USERS.map((u) => `<tr><td class="muted-white">${u.id}</td><td>${u.name}</td><td>${u.role}</td></tr>`).join("")}</tbody></table>
  </div>`;
}
function brandingTab() {
  return `<div class="glass" style="padding:22px;">
    <div style="color:#fff; font-weight:600; margin-bottom:10px;">Company &amp; Branding</div>
    <div class="muted-white" style="font-size:13px; line-height:1.6;">Logo, legal name, address, GSTIN — used centred at the top of every generated report and formal document (Section 21).</div>
  </div>`;
}
function trashTab() {
  return `<div class="glass" style="padding:22px;">
    <table class="glass-table"><thead><tr><th>Record</th><th>Deleted by</th><th>Retention</th><th></th></tr></thead>
    <tbody>${TRASH.map((t) => `<tr><td>${t.entity}</td><td class="muted-white">${t.deletedBy}</td><td class="muted-white">${t.days}</td><td><button class="btn btn-ghost" style="padding:6px 12px; font-size:11.5px;" data-restore="${t.entity}">Restore</button></td></tr>`).join("")}</tbody></table>
  </div>`;
}
function auditTab() {
  return `<div class="glass" style="padding:22px;">
    <div class="flex-col gap-md">${AUDIT.map((a) => `<div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">${a.time} — ${a.event}</span><br/><span class="muted-white">${a.detail}</span></div>`).join("")}</div>
  </div>`;
}

const TAB_RENDERERS = { Cafes: cafesTab, Users: usersTab, Branding: brandingTab, "Trash Bin": trashTab, "Audit Page": auditTab };

export function wireAdmin(root) {
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const content = root.querySelector("#admin-tab-content");
      content.innerHTML = TAB_RENDERERS[btn.dataset.tab]();
      wireAdmin(root);
    });
  });
  root.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", () => showToast(`Restored: ${btn.dataset.restore}`, "mint"));
  });
}
