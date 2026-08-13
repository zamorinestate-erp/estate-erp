// PAGE: Administration & Settings — Stage 1 Identity & Governance Controls
import { showToast } from "../components.js";
import { apiGet, apiPost, apiPatch, ApiClientError } from "../apiClient.js";

const TABS = ["Cafes", "Users", "Custom Fields", "Branding", "Trash Bin", "Audit Page"];

const DEFAULT_USERS = [
  { userId: "MU-0001", name: "Master User", role: "MASTER", accountStatus: "ACTIVE", isPrimaryMaster: true, email: "master@zamorin.cafe" },
  { userId: "OW-0002", name: "Cafe Owner", role: "OWNER", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "owner@zamorin.cafe" },
  { userId: "AD-0003", name: "Ravi Kumar", role: "CAFE_ADMIN", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "ravi@zamorin.cafe" },
  { userId: "ST-0004", name: "Priya Nair", role: "STAFF", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "priya@zamorin.cafe" },
];

const CAFES = [
  { id: "ZC-0001", name: "Dawn Roast — Koramangala", admin: "Ravi Kumar", status: "Active" },
  { id: "ZC-0002", name: "Indiranagar", admin: "Suresh Menon", status: "Active" },
  { id: "ZC-0003", name: "Koramangala Central", admin: "Meera Iyer", status: "Active" },
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

let liveUsers = null;
let currentPreview = null;
let activeTab = "Cafes";

export function renderAdmin() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Administration &amp; Governance</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Master Portal — Primary Master Governance, Role Governance &amp; Security Audit</div>

      <div class="flex gap-sm" style="margin-bottom:16px;" id="admin-tabs">
        ${TABS.map(
          (t) =>
            `<button class="btn btn-ghost ${t === activeTab ? "selected" : ""}" data-tab="${t}" style="padding:9px 16px; font-size:12.5px;">${t}</button>`
        ).join("")}
      </div>

      <div id="admin-tab-content">${renderTabContent(activeTab)}</div>
      <div id="admin-modal-container"></div>
    </div>
  `;
}

function renderTabContent(tab) {
  switch (tab) {
    case "Users":
      return usersTab();
    case "Custom Fields":
      return customFieldsTab();
    case "Cafes":
      return cafesTab();
    case "Branding":
      return brandingTab();
    case "Trash Bin":
      return trashTab();
    case "Audit Page":
      return auditTab();
    default:
      return cafesTab();
  }
}

function cafesTab() {
  return `<div class="glass" style="padding:22px;">
    <table class="glass-table"><thead><tr><th>ID</th><th>Cafe</th><th>Admin</th><th>Status</th></tr></thead>
    <tbody>${CAFES.map((c) => `<tr><td class="muted-white">${c.id}</td><td>${c.name}</td><td>${c.admin}</td><td><span class="pill pill-mint">${c.status}</span></td></tr>`).join("")}</tbody></table>
  </div>`;
}

function usersTab() {
  const usersList = liveUsers || DEFAULT_USERS;
  return `
    <div class="glass" style="padding:22px;">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="color:#fff; font-weight:600;">User Governance &amp; Role Management</div>
        <button class="btn btn-ghost" id="refresh-users-btn" style="padding:6px 12px; font-size:12px;">Refresh from Server</button>
      </div>
      <table class="glass-table">
        <thead>
          <tr>
            <th>User ID</th>
            <th>Name &amp; Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Governance Controls</th>
          </tr>
        </thead>
        <tbody>
          ${usersList
            .map((u) => {
              const id = u.userId || u.id;
              const isPm = u.isPrimaryMaster === true;
              return `
            <tr>
              <td class="muted-white">${id}</td>
              <td>
                <div style="color:#fff; font-weight:600;">${u.name}</div>
                <div class="muted-white" style="font-size:11.5px;">${u.email || ""}</div>
              </td>
              <td>
                ${
                  isPm
                    ? `<span class="pill pill-amber" style="font-weight:700;">Primary Master</span>`
                    : `<span class="pill pill-mint">${u.role}</span>`
                }
              </td>
              <td>
                <span class="pill ${u.accountStatus === 'ACTIVE' ? 'pill-mint' : 'pill-coral'}">${u.accountStatus || 'ACTIVE'}</span>
              </td>
              <td>
                ${
                  isPm
                    ? `<span class="muted-white" style="font-size:11.5px; font-style:italic;">Protected Account (Immutable)</span>`
                    : `<button class="btn btn-ghost" data-manage-user="${id}" style="padding:5px 10px; font-size:11.5px;">Manage Governance</button>`
                }
              </td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function brandingTab() {
  return `<div class="glass" style="padding:22px;">
    <div style="color:#fff; font-weight:600; margin-bottom:10px;">Company &amp; Branding</div>
    <div class="muted-white" style="font-size:13px; line-height:1.6;">Logo, legal name, address, GSTIN — used centred at the top of every generated report and formal document.</div>
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

// ─── Governance Modal Renderer ───────────────────────────────────────────────

function renderGovernanceModal(user) {
  const id = user.userId || user.id;
  return `
    <div class="dialog-overlay" id="gov-modal-overlay">
      <div class="glass-dark dialog-box" style="width:560px; max-width:calc(100vw - 40px); padding:24px;">
        <div class="flex items-center justify-between" style="margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
          <div>
            <div style="color:#fff; font-size:16px; font-weight:700;">Governance Control: ${user.name}</div>
            <div class="muted-white" style="font-size:12px;">ID: ${id} | Current Role: ${user.role}</div>
          </div>
          <button class="btn btn-ghost" id="close-modal-btn" style="padding:4px 8px; font-size:16px;">&times;</button>
        </div>

        <div id="gov-modal-body">
          <!-- Step 1: Role Preview & Execution -->
          <div style="margin-bottom:20px;">
            <div style="color:#fff; font-size:13.5px; font-weight:600; margin-bottom:8px;">1. Role Promotion / Demotion</div>
            <div class="flex gap-sm items-center" style="margin-bottom:10px;">
              <select id="proposed-role-select" class="glass-input" style="padding:8px 12px; font-size:13px; flex:1;">
                <option value="">Select Proposed Role...</option>
                <option value="MASTER" ${user.role === 'MASTER' ? 'disabled' : ''}>MASTER (Organisation-Wide Authority)</option>
                <option value="OWNER" ${user.role === 'OWNER' ? 'disabled' : ''}>OWNER (Executive Oversight)</option>
                <option value="CAFE_ADMIN" ${user.role === 'CAFE_ADMIN' ? 'disabled' : ''}>CAFE_ADMIN (Store Management)</option>
                <option value="STAFF" ${user.role === 'STAFF' ? 'disabled' : ''}>STAFF (Operational)</option>
              </select>
              <button class="btn btn-primary" id="btn-preview-role" style="padding:8px 14px; font-size:12.5px;">Preview Impact</button>
            </div>
            <div id="role-preview-container"></div>
          </div>

          <!-- Step 2: Status Control -->
          <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:16px; margin-bottom:16px;">
            <div style="color:#fff; font-size:13.5px; font-weight:600; margin-bottom:8px;">2. Account Status Governance</div>
            <div class="flex gap-sm items-center">
              <select id="proposed-status-select" class="glass-input" style="padding:8px 12px; font-size:13px; flex:1;">
                <option value="ACTIVE" ${user.accountStatus === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                <option value="LOCKED" ${user.accountStatus === 'LOCKED' ? 'selected' : ''}>LOCKED</option>
                <option value="SUSPENDED" ${user.accountStatus === 'SUSPENDED' ? 'selected' : ''}>SUSPENDED</option>
                <option value="DISABLED" ${user.accountStatus === 'DISABLED' ? 'selected' : ''}>DISABLED</option>
              </select>
              <button class="btn btn-ghost" id="btn-update-status" style="padding:8px 14px; font-size:12.5px;">Update Status</button>
            </div>
          </div>

          <!-- Step 3: Archive Control -->
          <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:16px;">
            <div style="color:#fff; font-size:13.5px; font-weight:600; margin-bottom:8px;">3. Archive Account</div>
            <div class="flex gap-sm items-center">
              <input type="text" id="archive-reason-input" class="glass-input" placeholder="Reason for archival (required)..." style="padding:8px 12px; font-size:12.5px; flex:1;" />
              <button class="btn btn-ghost" id="btn-archive-user" style="padding:8px 14px; font-size:12.5px; color:var(--color-coral-bright);">Archive Account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPreviewResult(preview) {
  currentPreview = preview;
  return `
    <div class="glass" style="padding:14px; margin-top:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15);">
      <div class="pill pill-amber" style="margin-bottom:8px; font-weight:600;">Role Impact Preview</div>
      <div style="color:#fff; font-size:13px; margin-bottom:6px;">
        Transition: <span class="pill pill-coral">${preview.currentRole}</span> &rarr; <span class="pill pill-mint">${preview.proposedRole}</span>
      </div>
      ${
        preview.sessionsWillBeRevoked
          ? `<div style="color:#ff6b6b; font-size:12px; margin-bottom:8px;">&warning; ${preview.activeSessionCount || 0} active session(s) will be invalidated immediately.</div>`
          : ''
      }
      ${
        preview.warnings && preview.warnings.length > 0
          ? `<div class="muted-white" style="font-size:11.5px; margin-bottom:10px;">${preview.warnings.join("<br/>")}</div>`
          : ''
      }

      <div style="margin-top:12px;">
        <label style="color:#fff; font-size:12px; display:block; margin-bottom:4px;">Governance Reason (Required):</label>
        <textarea id="role-change-reason" class="glass-input" style="width:100%; height:60px; padding:8px; font-size:12px;" placeholder="Provide audit reason for role change..."></textarea>
      </div>

      <div class="flex items-center gap-sm" style="margin-top:10px;">
        <input type="checkbox" id="confirm-role-checkbox" style="cursor:pointer;" />
        <label for="confirm-role-checkbox" style="color:#fff; font-size:12px; cursor:pointer;">I confirm this role transition</label>
      </div>

      <div style="margin-top:12px;" class="flex justify-end">
        <button class="btn btn-primary" id="btn-execute-role-change" style="padding:8px 16px; font-size:12.5px;">Confirm &amp; Execute Role Change</button>
      </div>
    </div>
  `;
}

// ─── Wiring & Event Listeners ────────────────────────────────────────────────

export function wireAdmin(root) {
  // Tab switching
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      root.querySelectorAll("[data-tab]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const content = root.querySelector("#admin-tab-content");
      if (content) {
        content.innerHTML = renderTabContent(activeTab);
        wireAdmin(root);
      }
    });
  });

  // Refresh users from server
  const refreshBtn = root.querySelector("#refresh-users-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      try {
        const res = await apiGet("/users");
        if (res?.data?.users) {
          liveUsers = res.data.users;
          showToast(`Refreshed ${liveUsers.length} users from server`, "mint");
          const content = root.querySelector("#admin-tab-content");
          if (content) {
            content.innerHTML = usersTab();
            wireAdmin(root);
          }
        }
      } catch (err) {
        showToast(err.message || "Could not fetch users", "amber");
      }
    });
  }

  // Refresh custom fields
  const cfRefreshBtn = root.querySelector("#refresh-custom-fields-btn");
  if (cfRefreshBtn) {
    cfRefreshBtn.addEventListener("click", async () => {
      try {
        const res = await apiGet("/custom-fields");
        if (res?.data?.definitions) {
          liveCustomFields = res.data.definitions;
          showToast(`Refreshed ${liveCustomFields.length} custom field definitions`, "mint");
          const content = root.querySelector("#admin-tab-content");
          if (content) {
            content.innerHTML = customFieldsTab();
            wireAdmin(root);
          }
        }
      } catch (err) {
        showToast(err.message || "Could not fetch custom fields", "amber");
      }
    });
  }

  // Create custom field definition
  const cfCreateBtn = root.querySelector("#btn-create-cf");
  if (cfCreateBtn) {
    cfCreateBtn.addEventListener("click", async () => {
      const key = root.querySelector("#cf-key")?.value?.trim();
      const label = root.querySelector("#cf-label")?.value?.trim();
      const fieldType = root.querySelector("#cf-type")?.value;
      if (!key || !label) {
        showToast("Key and Label are required", "amber");
        return;
      }
      try {
        const res = await apiPost("/custom-fields", {
          body: { key, label, fieldType },
        });
        showToast(`Created custom field '${key}'`, "mint");
        const listRes = await apiGet("/custom-fields");
        if (listRes?.data?.definitions) liveCustomFields = listRes.data.definitions;
        const content = root.querySelector("#admin-tab-content");
        if (content) {
          content.innerHTML = customFieldsTab();
          wireAdmin(root);
        }
      } catch (err) {
        showToast(err.message || "Could not create custom field", "coral");
      }
    });
  }

  // Manage governance modal trigger
  root.querySelectorAll("[data-manage-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.manageUser;
      const usersList = liveUsers || DEFAULT_USERS;
      const targetUser = usersList.find((u) => (u.userId || u.id) === userId);
      if (!targetUser) return;

      const container = root.querySelector("#admin-modal-container") || document.body;
      container.innerHTML = renderGovernanceModal(targetUser);

      wireModalEvents(container, targetUser, root);
    });
  });

  // Restore items
  root.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", () => showToast(`Restored: ${btn.dataset.restore}`, "mint"));
  });
}

function wireModalEvents(container, user, root) {
  const userId = user.userId || user.id;
  const overlay = container.querySelector("#gov-modal-overlay");

  // Close modal
  container.querySelector("#close-modal-btn")?.addEventListener("click", () => {
    container.innerHTML = "";
  });

  // Role impact preview button
  container.querySelector("#btn-preview-role")?.addEventListener("click", async () => {
    const proposedRole = container.querySelector("#proposed-role-select")?.value;
    if (!proposedRole) {
      showToast("Please select a proposed role first.", "amber");
      return;
    }

    try {
      const res = await apiPost(`/users/${userId}/role-impact`, {
        body: { proposedRole },
      });

      const previewContainer = container.querySelector("#role-preview-container");
      if (previewContainer && res?.data) {
        previewContainer.innerHTML = renderPreviewResult(res.data);

        // Wire execute button inside preview
        container.querySelector("#btn-execute-role-change")?.addEventListener("click", async () => {
          const reason = container.querySelector("#role-change-reason")?.value?.trim();
          const confirmed = container.querySelector("#confirm-role-checkbox")?.checked;

          if (!confirmed) {
            showToast("You must check explicit confirmation before executing.", "amber");
            return;
          }
          if (!reason) {
            showToast("A governance reason is required.", "amber");
            return;
          }

          try {
            const execRes = await apiPatch(`/users/${userId}/role`, {
              body: {
                proposedRole: currentPreview.proposedRole,
                confirmed: true,
                reason,
                expectedCurrentRole: currentPreview.currentRole,
                expectedSessionVersion: currentPreview.currentSessionVersion,
                expectedPermissionsVersion: currentPreview.currentPermissionsVersion,
              },
            });

            showToast(execRes.message || "Role change executed successfully!", "mint");
            container.innerHTML = "";

            // Refresh user list
            const refreshRes = await apiGet("/users");
            if (refreshRes?.data?.users) {
              liveUsers = refreshRes.data.users;
            }
            const content = root.querySelector("#admin-tab-content");
            if (content) {
              content.innerHTML = usersTab();
              wireAdmin(root);
            }
          } catch (err) {
            if (err.code === "USER_GOVERNANCE_PREVIEW_STALE" || err.status === 409) {
              showToast("Stale preview! Target user state changed. Re-preview required.", "coral");
            } else {
              showToast(err.message || "Role change failed", "coral");
            }
          }
        });
      }
    } catch (err) {
      showToast(err.message || "Role preview failed", "coral");
    }
  });

  // Update status button
  container.querySelector("#btn-update-status")?.addEventListener("click", async () => {
    const accountStatus = container.querySelector("#proposed-status-select")?.value;
    const reason = prompt("Reason for account status update:") || "";
    if (!reason.trim()) {
      showToast("Reason is required for status change.", "amber");
      return;
    }

    try {
      const res = await apiPatch(`/users/${userId}/status`, {
        body: { accountStatus, reason: reason.trim() },
      });
      showToast(res.message || "Status updated successfully", "mint");
      container.innerHTML = "";
      const refreshRes = await apiGet("/users");
      if (refreshRes?.data?.users) liveUsers = refreshRes.data.users;
      const content = root.querySelector("#admin-tab-content");
      if (content) { content.innerHTML = usersTab(); wireAdmin(root); }
    } catch (err) {
      showToast(err.message || "Status change failed", "coral");
    }
  });

  // Archive user button
  container.querySelector("#btn-archive-user")?.addEventListener("click", async () => {
    const reason = container.querySelector("#archive-reason-input")?.value?.trim();
    if (!reason) {
      showToast("Reason is required to archive an account.", "amber");
      return;
    }

    try {
      const res = await apiPost(`/users/${userId}/archive`, {
        body: { reason },
      });
      showToast(res.message || "Account archived successfully", "mint");
      container.innerHTML = "";
      const refreshRes = await apiGet("/users");
      if (refreshRes?.data?.users) liveUsers = refreshRes.data.users;
      const content = root.querySelector("#admin-tab-content");
      if (content) { content.innerHTML = usersTab(); wireAdmin(root); }
    } catch (err) {
      showToast(err.message || "Archival failed", "coral");
  });
}

let liveCustomFields = null;

function customFieldsTab() {
  const fields = liveCustomFields || [
    { key: "employee_grade", label: "Employee Grade", fieldType: "SELECT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
    { key: "blood_group", label: "Blood Group", fieldType: "TEXT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
    { key: "emergency_contact_relation", label: "Emergency Contact Relation", fieldType: "TEXT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
  ];

  return `
    <div class="glass" style="padding:22px;">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div>
          <div style="color:#fff; font-weight:600; font-size:16px;">Custom Field Definitions</div>
          <div class="muted-white" style="font-size:12px;">Capability 26 — Enterprise Metadata Schema Registry</div>
        </div>
        <button class="btn btn-ghost" id="refresh-custom-fields-btn" style="padding:6px 12px; font-size:12px;">Refresh</button>
      </div>

      <div style="margin-bottom:20px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px;">
        <div style="color:#fff; font-weight:600; font-size:13px; margin-bottom:10px;">Define New Custom Field</div>
        <div class="grid grid-3 gap-sm" style="margin-bottom:10px;">
          <input type="text" id="cf-key" placeholder="Key (e.g. staff_grade)" class="form-input" style="font-size:12px;" />
          <input type="text" id="cf-label" placeholder="Label (e.g. Staff Grade)" class="form-input" style="font-size:12px;" />
          <select id="cf-type" class="form-input" style="font-size:12px;">
            <option value="TEXT">TEXT (Short String)</option>
            <option value="LONG_TEXT">LONG_TEXT (Multiline)</option>
            <option value="NUMBER">NUMBER (Numeric)</option>
            <option value="BOOLEAN">BOOLEAN (True/False)</option>
            <option value="DATE">DATE (ISO YYYY-MM-DD)</option>
            <option value="SELECT">SELECT (Option List)</option>
          </select>
        </div>
        <button class="btn btn-mint" id="btn-create-cf" style="padding:7px 16px; font-size:12px;">Create Field Definition</button>
      </div>

      <table class="glass-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Label</th>
            <th>Type</th>
            <th>Applies To</th>
            <th>Required</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map((f) => `
            <tr>
              <td class="font-mono text-mint">${f.key}</td>
              <td style="color:#fff;">${f.label}</td>
              <td><span class="pill pill-dark">${f.fieldType}</span></td>
              <td class="muted-white">${f.appliesTo || 'USER'}</td>
              <td>${f.isRequired ? '<span class="pill pill-coral">Required</span>' : '<span class="muted-white">Optional</span>'}</td>
              <td><span class="pill ${f.status === 'ACTIVE' ? 'pill-mint' : 'pill-dark'}">${f.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

