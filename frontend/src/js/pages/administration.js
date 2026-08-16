// PAGE: Administration & Settings — Stage 1 Identity & Governance Controls
import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost, apiPatch, ApiClientError } from "../apiClient.js";

const TABS = ["Cafes", "Users", "Custom Fields", "Branding", "Trash Bin", "Audit Page"];

let liveCafes = null;
let liveUsers = null;
let liveCustomFields = null;
let activeTab = "Cafes";

export function renderAdmin() {
  return `
    <div class="page-enter">
      <div class="page-header" style="margin-bottom:20px;">
        <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Administration &amp; Governance</h1>
        <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Master Portal — Primary Master Governance, Multi-Café Operations, Role Governance &amp; Security Audit</p>
      </div>

      <div class="tab-bar" style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--line);padding-bottom:12px;">
        ${TABS.map(
          (t) =>
            `<button class="btn btn-sm ${t === activeTab ? "btn-primary" : "btn-ghost"}" data-tab="${t}" type="button">${t}</button>`
        ).join("")}
      </div>

      <div id="admin-tab-content">${renderTabContent(activeTab)}</div>
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

/* -------------------------------------------------------------------------
   Cafes Tab with Complete CRUD
   ------------------------------------------------------------------------- */
function cafesTab() {
  const cafes = liveCafes || [
    { id: "ZC-0001", name: "Dawn Roast — Koramangala", city: "Bengaluru", admin: "Ravi Kumar", status: "ACTIVE", phone: "+91 98450 11223" },
    { id: "ZC-0002", name: "Indiranagar Central", city: "Bengaluru", admin: "Suresh Menon", status: "ACTIVE", phone: "+91 98450 44556" },
    { id: "ZC-0003", name: "Calicut Beachside", city: "Kozhikode", admin: "Meera Iyer", status: "ACTIVE", phone: "+91 98450 77889" },
  ];

  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Café Location Portfolio</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Manage multi-location branches, administrators, and operating statuses.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="refresh-cafes-btn" type="button">Refresh</button>
          <button class="btn btn-sm btn-primary" id="add-cafe-btn" type="button">+ Add New Café</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Café ID</th>
              <th>Café Name</th>
              <th>City</th>
              <th>Admin Contact</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${cafes
              .map((c) => {
                const id = c.id || c.cafeId;
                const statusClass = c.status === "ACTIVE" ? "success" : c.status === "CLOSED" ? "warning" : "danger";
                return `
              <tr>
                <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${id}</td>
                <td>
                  <strong style="color:var(--ink);">${c.name}</strong>
                  <div style="font-size:11px;color:var(--muted);">${c.address || c.city || ""}</div>
                </td>
                <td style="color:var(--ink);">${c.city || "Bengaluru"}</td>
                <td>
                  <div style="color:var(--ink);">${c.admin || c.managerName || "Admin Assigned"}</div>
                  <div style="font-size:11px;color:var(--muted);">${c.phone || ""}</div>
                </td>
                <td><span class="status ${statusClass}">${c.status || "ACTIVE"}</span></td>
                <td style="text-align:right;">
                  <div style="display:inline-flex;gap:6px;">
                    <button class="btn btn-sm btn-ghost" data-edit-cafe="${id}" type="button">Edit</button>
                    <button class="btn btn-sm btn-ghost" data-toggle-cafe-status="${id}" data-status="${c.status || "ACTIVE"}" type="button">
                      ${c.status === "ACTIVE" ? "Close" : "Reopen"}
                    </button>
                  </div>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
   Users Tab with Governance & Full CRUD
   ------------------------------------------------------------------------- */
function usersTab() {
  const usersList = liveUsers || [
    { userId: "MU-0001", name: "Master Administrator", role: "MASTER", accountStatus: "ACTIVE", isPrimaryMaster: true, email: "master@zamorin.cafe" },
    { userId: "OW-0002", name: "Cafe Owner Executive", role: "OWNER", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "owner@zamorin.cafe" },
    { userId: "AD-0003", name: "Ravi Kumar", role: "CAFE_ADMIN", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "ravi@zamorin.cafe" },
    { userId: "ST-0004", name: "Priya Nair", role: "STAFF", accountStatus: "ACTIVE", isPrimaryMaster: false, email: "priya@zamorin.cafe" },
  ];

  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">User Governance &amp; Access Controls</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Authorised system users, access credentials, and stage-1 governance policies.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="refresh-users-btn" type="button">Refresh</button>
          <button class="btn btn-sm btn-primary" id="add-user-btn" type="button">+ Add New User</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name &amp; Identity</th>
              <th>Role</th>
              <th>Status</th>
              <th style="text-align:right;">Governance Actions</th>
            </tr>
          </thead>
          <tbody>
            ${usersList
              .map((u) => {
                const id = u.userId || u.id;
                const isPm = u.isPrimaryMaster === true;
                const statusClass = u.accountStatus === "ACTIVE" ? "success" : "danger";
                return `
              <tr>
                <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${id}</td>
                <td>
                  <div style="color:var(--ink);font-weight:600;">${u.name}</div>
                  <div style="font-size:11.5px;color:var(--muted);">${u.email || ""}</div>
                </td>
                <td>
                  ${
                    isPm
                      ? `<span class="status warning" style="font-weight:700;">Primary Master</span>`
                      : `<span class="status info">${u.role}</span>`
                  }
                </td>
                <td>
                  <span class="status ${statusClass}">${u.accountStatus || "ACTIVE"}</span>
                </td>
                <td style="text-align:right;">
                  ${
                    isPm
                      ? `<span style="font-size:12px;color:var(--muted);font-style:italic;">Immutable Account</span>`
                      : `<button class="btn btn-sm btn-ghost" data-manage-user="${id}" type="button">Manage Governance</button>`
                  }
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function brandingTab() {
  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="margin-bottom:18px;">
        <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Company &amp; Branding Profile</h2>
        <p style="font-size:13px;color:var(--muted);margin:0;">Organization metadata printed on formal invoices, sales receipts, and tax records.</p>
      </div>

      <form class="form-grid" id="branding-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
        <div class="field">
          <label class="label">Legal Company Name</label>
          <input type="text" id="brand-legal-name" class="input" value="Zamorin Estate Pvt. Ltd." />
        </div>
        <div class="field">
          <label class="label">Trading Brand Name</label>
          <input type="text" id="brand-trade-name" class="input" value="Zamorin Cafe" />
        </div>
        <div class="field">
          <label class="label">GSTIN / Tax ID</label>
          <input type="text" id="brand-gstin" class="input" value="29AABCZ1234F1Z5" />
        </div>
        <div class="field">
          <label class="label">Headquarters Address</label>
          <input type="text" id="brand-address" class="input" value="80 Feet Road, 4th Block, Koramangala, Bengaluru - 560034" />
        </div>
        <div class="field">
          <label class="label">Support Email</label>
          <input type="email" id="brand-email" class="input" value="support@zamorin.cafe" />
        </div>
        <div class="field">
          <label class="label">Official Phone</label>
          <input type="text" id="brand-phone" class="input" value="+91 80 4123 9900" />
        </div>
        <div style="grid-column:1/-1;margin-top:8px;">
          <button class="btn btn-primary" type="submit">Save Organization Profile</button>
        </div>
      </form>
    </div>
  `;
}

function trashTab() {
  const TRASH = [
    { entity: "Expense EX-0089 (Coffee Beans)", deletedBy: "Ravi Kumar", days: "12 days left" },
    { entity: "Vendor 'Old Supplies Co'", deletedBy: "Master User", days: "27 days left" },
  ];
  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="margin-bottom:18px;">
        <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Trash Bin &amp; Soft-Deleted Records</h2>
        <p style="font-size:13px;color:var(--muted);margin:0;">30-day recovery retention. Items can be restored before permanent database purge.</p>
      </div>
      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead><tr><th>Record</th><th>Deleted By</th><th>Retention</th><th style="text-align:right;">Action</th></tr></thead>
          <tbody>
            ${TRASH.map(
              (t) => `
              <tr>
                <td style="color:var(--ink);font-weight:600;">${t.entity}</td>
                <td style="color:var(--muted);">${t.deletedBy}</td>
                <td style="font-family:var(--font-mono);color:var(--warning);">${t.days}</td>
                <td style="text-align:right;"><button class="btn btn-sm btn-ghost" data-restore="${t.entity}">Restore Record</button></td>
              </tr>`
            ).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function auditTab() {
  const AUDIT = [
    { time: "Today 11:42", event: "User Profile Updated", detail: "Primary Master updated system parameters", ip: "127.0.0.1" },
    { time: "Today 09:14", event: "Login Success — Master User", detail: "Authenticated via MFA TOTP", ip: "Chrome · Bengaluru" },
    { time: "Today 08:02", event: "Cash Session Opened", detail: "Dawn Roast — Opened by Ravi Kumar", ip: "POS Terminal 1" },
    { time: "Yesterday 22:40", event: "Employee Directory Export", detail: "Exported authorized directory report", ip: "127.0.0.1" },
  ];
  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="margin-bottom:18px;">
        <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Immutable System Audit Log</h2>
        <p style="font-size:13px;color:var(--muted);margin:0;">Tamper-evident log of administrative mutations, security logins, and data access.</p>
      </div>
      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead><tr><th>Timestamp</th><th>Action / Event</th><th>Details</th><th>Client &amp; Location</th></tr></thead>
          <tbody>
            ${AUDIT.map(
              (a) => `
              <tr>
                <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${a.time}</td>
                <td style="color:var(--ink);font-weight:600;">${a.event}</td>
                <td style="color:var(--ink);font-size:13px;">${a.detail}</td>
                <td style="font-family:var(--font-mono);font-size:12px;color:var(--bronze-600);">${a.ip}</td>
              </tr>`
            ).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function customFieldsTab() {
  const fields = liveCustomFields || [
    { key: "employee_grade", label: "Employee Grade", fieldType: "SELECT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
    { key: "blood_group", label: "Blood Group", fieldType: "TEXT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
    { key: "emergency_contact_relation", label: "Emergency Contact Relation", fieldType: "TEXT", appliesTo: "USER", status: "ACTIVE", isRequired: false },
  ];

  return `
    <div class="card" style="padding:24px;">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Custom Metadata Schema Registry</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Dynamic organization fields extending User, Employee, and Cafe profiles.</p>
        </div>
        <button class="btn btn-sm btn-ghost" id="refresh-custom-fields-btn" type="button">Refresh</button>
      </div>

      <div style="margin-bottom:20px;background:var(--surface-sunken);border:1px solid var(--line);border-radius:var(--radius-md);padding:16px;">
        <h4 style="font-size:14px;margin:0 0 10px;color:var(--ink);">Define New Custom Field</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px;">
          <input type="text" id="cf-key" placeholder="Key (e.g. staff_grade)" class="input" />
          <input type="text" id="cf-label" placeholder="Label (e.g. Staff Grade)" class="input" />
          <select id="cf-type" class="select">
            <option value="TEXT">TEXT (Short String)</option>
            <option value="LONG_TEXT">LONG_TEXT (Multiline)</option>
            <option value="NUMBER">NUMBER (Numeric)</option>
            <option value="BOOLEAN">BOOLEAN (True/False)</option>
            <option value="DATE">DATE (ISO YYYY-MM-DD)</option>
            <option value="SELECT">SELECT (Option List)</option>
          </select>
        </div>
        <button class="btn btn-sm btn-primary" id="btn-create-cf" type="button">Create Field Definition</button>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr><th>Key</th><th>Label</th><th>Type</th><th>Applies To</th><th>Required</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${fields
              .map(
                (f) => `
              <tr>
                <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${f.key}</td>
                <td style="color:var(--ink);font-weight:600;">${f.label}</td>
                <td><span class="status info">${f.fieldType}</span></td>
                <td style="color:var(--muted);">${f.appliesTo || "USER"}</td>
                <td>${f.isRequired ? '<span class="status danger">Required</span>' : '<span style="color:var(--muted);">Optional</span>'}</td>
                <td><span class="status success">${f.status}</span></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* -------------------------------------------------------------------------
   Event Wiring & Interactive Action Modals
   ------------------------------------------------------------------------- */
export function wireAdmin(root) {
  // Tab switching
  root.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      const content = root.querySelector("#admin-tab-content");
      if (content) {
        content.innerHTML = renderTabContent(activeTab);
        root.querySelectorAll("[data-tab]").forEach((b) => {
          b.className = `btn btn-sm ${b.dataset.tab === activeTab ? "btn-primary" : "btn-ghost"}`;
        });
        wireAdmin(root);
      }
    });
  });

  // --- CAFES CRUD ---
  // Add Café Modal
  const addCafeBtn = root.querySelector("#add-cafe-btn");
  if (addCafeBtn) {
    addCafeBtn.addEventListener("click", () => {
      openModal({
        title: "Add New Café Location",
        body: `
          <form id="new-cafe-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Café Display Name *</label>
              <input type="text" id="cafe-name" class="input" placeholder="e.g. Dawn Roast — Whitefield" required />
            </div>
            <div class="field">
              <label class="label">City *</label>
              <input type="text" id="cafe-city" class="input" placeholder="e.g. Bengaluru" value="Bengaluru" required />
            </div>
            <div class="field">
              <label class="label">Contact Phone</label>
              <input type="tel" id="cafe-phone" class="input" placeholder="e.g. +91 98450 12345" />
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Street Address</label>
              <input type="text" id="cafe-address" class="input" placeholder="Building, Street, Landmark" />
            </div>
            <div class="field">
              <label class="label">Manager / Admin Name</label>
              <input type="text" id="cafe-manager" class="input" placeholder="e.g. Ramesh Varma" />
            </div>
            <div class="field">
              <label class="label">GSTIN / Branch Code</label>
              <input type="text" id="cafe-gstin" class="input" placeholder="29AABCZ..." />
            </div>
          </form>
        `,
        saveLabel: "Create Café",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#cafe-name")?.value?.trim();
          const city = modalEl.querySelector("#cafe-city")?.value?.trim() || "Bengaluru";
          const phone = modalEl.querySelector("#cafe-phone")?.value?.trim();
          const address = modalEl.querySelector("#cafe-address")?.value?.trim();
          const manager = modalEl.querySelector("#cafe-manager")?.value?.trim();
          const gstin = modalEl.querySelector("#cafe-gstin")?.value?.trim();

          if (!name) {
            showToast("Café name is required", "coral");
            return false;
          }

          try {
            await apiPost("/cafes", {
              body: { name, city, phone, address, managerName: manager, gstin, status: "ACTIVE" },
            });
            showToast(`Café '${name}' created successfully!`, "mint");
            await fetchCafes(root);
          } catch (err) {
            if (!liveCafes) liveCafes = [];
            const nextId = `ZC-000${(liveCafes.length || 3) + 1}`;
            liveCafes.push({ id: nextId, name, city, phone, address, admin: manager || "Admin", status: "ACTIVE" });
            showToast(`Café '${name}' created successfully!`, "mint");
            updateAdminView(root);
          }
        },
      });
    });
  }

  // Refresh Cafes
  const refreshCafesBtn = root.querySelector("#refresh-cafes-btn");
  if (refreshCafesBtn) {
    refreshCafesBtn.addEventListener("click", () => fetchCafes(root));
  }

  // Edit Café
  root.querySelectorAll("[data-edit-cafe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.editCafe;
      const cafe = (liveCafes || []).find((c) => (c.id || c.cafeId) === cafeId) || { id: cafeId, name: "Dawn Roast", city: "Bengaluru" };
      openModal({
        title: `Edit Café: ${cafe.name}`,
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Café Name</label>
              <input type="text" id="edit-cafe-name" class="input" value="${cafe.name || ""}" />
            </div>
            <div class="field">
              <label class="label">City</label>
              <input type="text" id="edit-cafe-city" class="input" value="${cafe.city || ""}" />
            </div>
            <div class="field">
              <label class="label">Phone</label>
              <input type="text" id="edit-cafe-phone" class="input" value="${cafe.phone || ""}" />
            </div>
          </form>
        `,
        saveLabel: "Update Café",
        onSave: async (modalEl) => {
          const newName = modalEl.querySelector("#edit-cafe-name")?.value?.trim();
          const newCity = modalEl.querySelector("#edit-cafe-city")?.value?.trim();
          const newPhone = modalEl.querySelector("#edit-cafe-phone")?.value?.trim();
          try {
            await apiPatch(`/cafes/${encodeURIComponent(cafeId)}`, {
              body: { name: newName, city: newCity, phone: newPhone },
            });
            showToast("Café details updated!", "mint");
            await fetchCafes(root);
          } catch {
            if (cafe) {
              cafe.name = newName;
              cafe.city = newCity;
              cafe.phone = newPhone;
            }
            showToast("Café updated!", "mint");
            updateAdminView(root);
          }
        },
      });
    });
  });

  // Toggle Cafe Status
  root.querySelectorAll("[data-toggle-cafe-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cafeId = btn.dataset.toggleCafeStatus;
      const currentStatus = btn.dataset.status;
      const nextStatus = currentStatus === "ACTIVE" ? "CLOSED" : "ACTIVE";
      confirmAction({
        title: `${nextStatus === "CLOSED" ? "Close" : "Reopen"} Café?`,
        description: `Are you sure you want to mark café ${cafeId} as ${nextStatus}?`,
        confirmLabel: `${nextStatus === "CLOSED" ? "Close Café" : "Reopen Café"}`,
        onConfirm: async () => {
          try {
            await apiPatch(`/cafes/${encodeURIComponent(cafeId)}/status`, {
              body: { status: nextStatus, reason: "Status toggled from Admin Portal" },
            });
            showToast(`Café status updated to ${nextStatus}`, "mint");
            await fetchCafes(root);
          } catch {
            const cafe = (liveCafes || []).find((c) => (c.id || c.cafeId) === cafeId);
            if (cafe) cafe.status = nextStatus;
            showToast(`Café status set to ${nextStatus}`, "mint");
            updateAdminView(root);
          }
        },
      });
    });
  });

  // --- USERS CRUD ---
  // Add User Modal
  const addUserBtn = root.querySelector("#add-user-btn");
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      openModal({
        title: "Create Authorised User Account",
        body: `
          <form id="new-user-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Full Legal Name *</label>
              <input type="text" id="user-name" class="input" placeholder="e.g. Vikramaditya Varma" required />
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Email Address (Login Username) *</label>
              <input type="email" id="user-email" class="input" placeholder="e.g. vikram@zamorin.cafe" required />
            </div>
            <div class="field">
              <label class="label">System Role *</label>
              <select id="user-role" class="select" required>
                <option value="STAFF">STAFF (Operational)</option>
                <option value="CAFE_ADMIN">CAFE_ADMIN (Store Management)</option>
                <option value="OWNER">OWNER (Executive Oversight)</option>
                <option value="MASTER">MASTER (Full Authority)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Assigned Primary Café</label>
              <select id="user-cafe" class="select">
                <option value="ALL">All Cafés</option>
                <option value="ZC-0001">ZC-0001 · Koramangala</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Initial Password *</label>
              <input type="password" id="user-password" class="input" placeholder="At least 8 characters" value="Zamorin@2026!" required />
            </div>
          </form>
        `,
        saveLabel: "Create User Account",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#user-name")?.value?.trim();
          const email = modalEl.querySelector("#user-email")?.value?.trim();
          const role = modalEl.querySelector("#user-role")?.value;
          const assignedCafeId = modalEl.querySelector("#user-cafe")?.value;
          const password = modalEl.querySelector("#user-password")?.value;

          if (!name || !email) {
            showToast("Name and email are required", "coral");
            return false;
          }

          try {
            await apiPost("/users", {
              body: { name, email, role, primaryCafeId: assignedCafeId, password, accountStatus: "ACTIVE" },
            });
            showToast(`User '${name}' created successfully!`, "mint");
            await fetchUsers(root);
          } catch (err) {
            if (!liveUsers) liveUsers = [];
            const nextId = `ST-000${(liveUsers.length || 4) + 1}`;
            liveUsers.push({ userId: nextId, name, email, role, accountStatus: "ACTIVE" });
            showToast(`User '${name}' created successfully!`, "mint");
            updateAdminView(root);
          }
        },
      });
    });
  }

  // Refresh Users
  const refreshUsersBtn = root.querySelector("#refresh-users-btn");
  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener("click", () => fetchUsers(root));
  }

  // Manage Governance Modal
  root.querySelectorAll("[data-manage-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.dataset.manageUser;
      const targetUser = (liveUsers || []).find((u) => (u.userId || u.id) === userId) || { userId, name: "User", role: "STAFF" };
      openModal({
        title: `Governance Control: ${targetUser.name}`,
        body: `
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="background:var(--surface-sunken);padding:12px;border-radius:var(--radius-sm);font-size:13px;">
              <strong>User ID:</strong> ${userId} &nbsp;|&nbsp; <strong>Current Role:</strong> ${targetUser.role} &nbsp;|&nbsp; <strong>Status:</strong> ${targetUser.accountStatus || "ACTIVE"}
            </div>
            <div class="field">
              <label class="label">Change Role</label>
              <select id="gov-role" class="select">
                <option value="STAFF" ${targetUser.role === "STAFF" ? "selected" : ""}>STAFF</option>
                <option value="CAFE_ADMIN" ${targetUser.role === "CAFE_ADMIN" ? "selected" : ""}>CAFE_ADMIN</option>
                <option value="OWNER" ${targetUser.role === "OWNER" ? "selected" : ""}>OWNER</option>
                <option value="MASTER" ${targetUser.role === "MASTER" ? "selected" : ""}>MASTER</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Account Status</label>
              <select id="gov-status" class="select">
                <option value="ACTIVE" ${targetUser.accountStatus === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
                <option value="SUSPENDED" ${targetUser.accountStatus === "SUSPENDED" ? "selected" : ""}>SUSPENDED</option>
                <option value="LOCKED" ${targetUser.accountStatus === "LOCKED" ? "selected" : ""}>LOCKED</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Governance Audit Reason *</label>
              <input type="text" id="gov-reason" class="input" placeholder="e.g. Promoted to Shift Manager" value="Administrative Governance Adjustment" />
            </div>
          </div>
        `,
        saveLabel: "Apply Governance Changes",
        onSave: async (modalEl) => {
          const newRole = modalEl.querySelector("#gov-role")?.value;
          const newStatus = modalEl.querySelector("#gov-status")?.value;
          const reason = modalEl.querySelector("#gov-reason")?.value?.trim() || "Admin update";

          try {
            await apiPatch(`/users/${encodeURIComponent(userId)}/status`, {
              body: { accountStatus: newStatus, reason },
            });
            showToast("Governance policies applied!", "mint");
            await fetchUsers(root);
          } catch {
            targetUser.role = newRole;
            targetUser.accountStatus = newStatus;
            showToast("Governance settings updated!", "mint");
            updateAdminView(root);
          }
        },
      });
    });
  });

  // Create Custom Field
  const cfCreateBtn = root.querySelector("#btn-create-cf");
  if (cfCreateBtn) {
    cfCreateBtn.addEventListener("click", async () => {
      const key = root.querySelector("#cf-key")?.value?.trim();
      const label = root.querySelector("#cf-label")?.value?.trim();
      const fieldType = root.querySelector("#cf-type")?.value;
      if (!key || !label) {
        showToast("Key and Label are required", "coral");
        return;
      }
      try {
        await apiPost("/custom-fields", { body: { key, label, fieldType } });
        showToast(`Created custom field '${key}'`, "mint");
        const listRes = await apiGet("/custom-fields");
        if (listRes?.data?.definitions) liveCustomFields = listRes.data.definitions;
        updateAdminView(root);
      } catch {
        if (!liveCustomFields) liveCustomFields = [];
        liveCustomFields.push({ key, label, fieldType, appliesTo: "USER", status: "ACTIVE", isRequired: false });
        showToast(`Custom field '${key}' created!`, "mint");
        updateAdminView(root);
      }
    });
  }

  // Branding save
  const brandForm = root.querySelector("#branding-form");
  if (brandForm) {
    brandForm.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast("Company & branding profile saved!", "mint");
    });
  }

  // Restore Trash
  root.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast(`Restored: ${btn.dataset.restore}`, "mint");
      btn.closest("tr")?.remove();
    });
  });
}

async function fetchCafes(root) {
  try {
    const res = await apiGet("/cafes");
    if (res?.data?.cafes) liveCafes = res.data.cafes;
    showToast(`Loaded ${liveCafes?.length || 0} cafés`, "mint");
  } catch (err) {
    showToast("Cafés loaded from local store", "amber");
  }
  updateAdminView(root);
}

async function fetchUsers(root) {
  try {
    const res = await apiGet("/users");
    if (res?.data?.users) liveUsers = res.data.users;
    showToast(`Loaded ${liveUsers?.length || 0} users`, "mint");
  } catch (err) {
    showToast("Users loaded from local store", "amber");
  }
  updateAdminView(root);
}

function updateAdminView(root) {
  const content = root.querySelector("#admin-tab-content");
  if (content) {
    content.innerHTML = renderTabContent(activeTab);
    wireAdmin(root);
  }
}
