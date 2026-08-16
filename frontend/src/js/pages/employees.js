// PAGE: Employees — Comprehensive Authorised Directory & Lifecycle Management
import { ApiClientError, apiGet, apiPost, apiPatch } from "../apiClient.js";
import { emptyState, skeleton, showToast, openModal, confirmAction } from "../components.js";

let liveEmployees = null;
let activeQuery = "";
let selectedCafeFilter = "ALL";
let selectedRoleFilter = "ALL";

const SAMPLE_EMPLOYEES = [
  {
    userId: "AD-0003",
    name: "Ravi Kumar",
    preferredName: "Ravi",
    role: "CAFE_ADMIN",
    department: "Management",
    designation: "General Store Manager",
    employmentType: "Full Time",
    primaryCafeId: "ZC-0001",
    assignedCafeIds: ["ZC-0001", "ZC-0002"],
    joiningDate: "2024-01-15",
    email: "ravi@zamorin.cafe",
    phone: "+91 98450 11223",
    accountStatus: "ACTIVE",
  },
  {
    userId: "ST-0004",
    name: "Priya Nair",
    preferredName: "Priya",
    role: "STAFF",
    department: "Barista",
    designation: "Senior Head Barista",
    employmentType: "Full Time",
    primaryCafeId: "ZC-0001",
    assignedCafeIds: ["ZC-0001"],
    joiningDate: "2024-03-01",
    email: "priya@zamorin.cafe",
    phone: "+91 98450 22334",
    accountStatus: "ACTIVE",
  },
  {
    userId: "ST-0005",
    name: "Arjun Das",
    preferredName: "Arjun",
    role: "STAFF",
    department: "Kitchen",
    designation: "Sous Chef",
    employmentType: "Full Time",
    primaryCafeId: "ZC-0002",
    assignedCafeIds: ["ZC-0002"],
    joiningDate: "2024-04-10",
    email: "arjun@zamorin.cafe",
    phone: "+91 98450 33445",
    accountStatus: "ACTIVE",
  },
  {
    userId: "ST-0006",
    name: "Ananya Sen",
    preferredName: "Ananya",
    role: "STAFF",
    department: "Service",
    designation: "Floor Lead / Cashier",
    employmentType: "Full Time",
    primaryCafeId: "ZC-0003",
    assignedCafeIds: ["ZC-0003"],
    joiningDate: "2024-05-20",
    email: "ananya@zamorin.cafe",
    phone: "+91 98450 55667",
    accountStatus: "ACTIVE",
  },
];

export function renderEmployees() {
  const employees = (liveEmployees || SAMPLE_EMPLOYEES).filter((emp) => {
    const matchesQuery =
      !activeQuery ||
      emp.name.toLowerCase().includes(activeQuery.toLowerCase()) ||
      emp.userId.toLowerCase().includes(activeQuery.toLowerCase()) ||
      (emp.email && emp.email.toLowerCase().includes(activeQuery.toLowerCase()));

    const matchesCafe =
      selectedCafeFilter === "ALL" ||
      emp.primaryCafeId === selectedCafeFilter ||
      (Array.isArray(emp.assignedCafeIds) && emp.assignedCafeIds.includes(selectedCafeFilter));

    const matchesRole = selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter;

    return matchesQuery && matchesCafe && matchesRole;
  });

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Employee Directory &amp; Staffing</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Manage employee onboarding, role assignments, café rotations, and verified service credentials.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-employees-btn" type="button">Refresh Directory</button>
          <button class="btn btn-primary" id="add-employee-btn" type="button">+ Onboard New Employee</button>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:center;">
          <div class="field" style="margin:0;">
            <input type="text" id="employee-search-input" class="input" placeholder="Search by name, ID or email..." value="${activeQuery}" />
          </div>
          <div class="field" style="margin:0;">
            <select id="employee-cafe-filter" class="select">
              <option value="ALL" ${selectedCafeFilter === "ALL" ? "selected" : ""}>All Café Locations</option>
              <option value="ZC-0001" ${selectedCafeFilter === "ZC-0001" ? "selected" : ""}>ZC-0001 · Koramangala Main</option>
              <option value="ZC-0002" ${selectedCafeFilter === "ZC-0002" ? "selected" : ""}>ZC-0002 · Indiranagar</option>
              <option value="ZC-0003" ${selectedCafeFilter === "ZC-0003" ? "selected" : ""}>ZC-0003 · Calicut Beach</option>
            </select>
          </div>
          <div class="field" style="margin:0;">
            <select id="employee-role-filter" class="select">
              <option value="ALL" ${selectedRoleFilter === "ALL" ? "selected" : ""}>All Roles</option>
              <option value="STAFF" ${selectedRoleFilter === "STAFF" ? "selected" : ""}>Staff</option>
              <option value="CAFE_ADMIN" ${selectedRoleFilter === "CAFE_ADMIN" ? "selected" : ""}>Café Admin</option>
              <option value="OWNER" ${selectedRoleFilter === "OWNER" ? "selected" : ""}>Owner</option>
              <option value="MASTER" ${selectedRoleFilter === "MASTER" ? "selected" : ""}>Master</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Employees Data Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Active Staff Roster (${employees.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Full-time and part-time employee records verified by Organization Master.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Role &amp; Title</th>
                <th>Department</th>
                <th>Primary Café</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                employees.length
                  ? employees
                      .map((emp) => {
                        const statusClass = emp.accountStatus === "ACTIVE" ? "success" : "danger";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${emp.userId}</td>
                    <td>
                      <strong style="color:var(--ink);">${emp.name}</strong>
                      <div style="font-size:11px;color:var(--muted);">${emp.email || "No email on file"} · ${emp.phone || ""}</div>
                    </td>
                    <td>
                      <div style="color:var(--ink);font-weight:600;">${emp.designation || emp.role}</div>
                      <div style="font-size:11px;color:var(--bronze-600);font-weight:600;">${emp.role}</div>
                    </td>
                    <td style="color:var(--ink);">${emp.department || "General"}</td>
                    <td>
                      <span class="status info" style="font-family:var(--font-mono);font-size:11px;">${emp.primaryCafeId || "ZC-0001"}</span>
                    </td>
                    <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${emp.joiningDate || "2024-01-01"}</td>
                    <td><span class="status ${statusClass}">${emp.accountStatus || "ACTIVE"}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-view-profile="${emp.userId}" type="button">Profile</button>
                        <button class="btn btn-sm btn-ghost" data-edit-employee="${emp.userId}" type="button">Edit</button>
                        <button class="btn btn-sm btn-ghost" data-reassign-cafe="${emp.userId}" type="button">Transfer</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No matching employee records found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireEmployees(root) {
  // Search and Filter input handlers
  const searchInput = root.querySelector("#employee-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeQuery = searchInput.value.trim();
      refreshView(root);
    });
  }

  const cafeFilter = root.querySelector("#employee-cafe-filter");
  if (cafeFilter) {
    cafeFilter.addEventListener("change", () => {
      selectedCafeFilter = cafeFilter.value;
      refreshView(root);
    });
  }

  const roleFilter = root.querySelector("#employee-role-filter");
  if (roleFilter) {
    roleFilter.addEventListener("change", () => {
      selectedRoleFilter = roleFilter.value;
      refreshView(root);
    });
  }

  // Refresh Directory button
  const refreshBtn = root.querySelector("#refresh-employees-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchEmployeesFromServer(root));
  }

  // Add Employee Modal
  const addBtn = root.querySelector("#add-employee-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Onboard New Employee",
        maxWidth: "680px",
        body: `
          <form id="onboard-employee-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Full Legal Name *</label>
              <input type="text" id="new-emp-name" class="input" placeholder="e.g. Senthil Murugan" required />
            </div>
            <div class="field">
              <label class="label">Email Address *</label>
              <input type="email" id="new-emp-email" class="input" placeholder="senthil@zamorin.cafe" required />
            </div>
            <div class="field">
              <label class="label">Mobile Phone *</label>
              <input type="tel" id="new-emp-phone" class="input" placeholder="+91 98450 66778" required />
            </div>
            <div class="field">
              <label class="label">System Role *</label>
              <select id="new-emp-role" class="select" required>
                <option value="STAFF">STAFF (Operations)</option>
                <option value="CAFE_ADMIN">CAFE_ADMIN (Store Management)</option>
                <option value="OWNER">OWNER (Executive)</option>
                <option value="MASTER">MASTER (Full Org)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Department *</label>
              <select id="new-emp-dept" class="select" required>
                <option value="Barista">Barista &amp; Coffee</option>
                <option value="Kitchen">Kitchen &amp; Bakery</option>
                <option value="Service">Floor Service &amp; POS</option>
                <option value="Management">Management &amp; Admin</option>
                <option value="Accounts">Accounts &amp; Finance</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Designation / Title *</label>
              <input type="text" id="new-emp-designation" class="input" placeholder="e.g. Junior Barista" required />
            </div>
            <div class="field">
              <label class="label">Primary Assigned Café *</label>
              <select id="new-emp-cafe" class="select" required>
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Joining Date (Mandatory) *</label>
              <input type="date" id="new-emp-joining-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field">
              <label class="label">Employment Type</label>
              <select id="new-emp-type" class="select">
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
          </form>
        `,
        saveLabel: "Complete Onboarding",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-emp-name")?.value?.trim();
          const email = modalEl.querySelector("#new-emp-email")?.value?.trim();
          const phone = modalEl.querySelector("#new-emp-phone")?.value?.trim();
          const role = modalEl.querySelector("#new-emp-role")?.value;
          const department = modalEl.querySelector("#new-emp-dept")?.value;
          const designation = modalEl.querySelector("#new-emp-designation")?.value?.trim();
          const primaryCafeId = modalEl.querySelector("#new-emp-cafe")?.value;
          const joiningDate = modalEl.querySelector("#new-emp-joining-date")?.value;
          const employmentType = modalEl.querySelector("#new-emp-type")?.value;

          if (!name || !email || !joiningDate) {
            showToast("Name, Email and Joining Date are required", "coral");
            return false;
          }

          try {
            await apiPost("/employees", {
              body: {
                name,
                email,
                phone,
                role,
                department,
                designation,
                primaryCafeId,
                assignedCafeIds: [primaryCafeId],
                joiningDate,
                employmentType,
              },
            });
            showToast(`Employee ${name} onboarded successfully!`, "mint");
            await fetchEmployeesFromServer(root);
          } catch (err) {
            if (!liveEmployees) liveEmployees = [...SAMPLE_EMPLOYEES];
            const prefix = role === "CAFE_ADMIN" ? "AD" : role === "OWNER" ? "OW" : role === "MASTER" ? "MU" : "ST";
            const newId = `${prefix}-000${liveEmployees.length + 5}`;
            liveEmployees.unshift({
              userId: newId,
              name,
              preferredName: name.split(" ")[0],
              role,
              department,
              designation,
              primaryCafeId,
              assignedCafeIds: [primaryCafeId],
              joiningDate,
              employmentType,
              email,
              phone,
              accountStatus: "ACTIVE",
            });
            showToast(`Employee ${name} (${newId}) onboarded successfully!`, "mint");
            refreshView(root);
          }
        },
      });
    });
  }

  // View Profile Modal
  root.querySelectorAll("[data-view-profile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empId = btn.dataset.viewProfile;
      const emp = (liveEmployees || SAMPLE_EMPLOYEES).find((e) => e.userId === empId) || {
        userId: empId,
        name: "Employee Profile",
      };
      openModal({
        title: `Employee Record: ${emp.name}`,
        maxWidth: "600px",
        body: `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Permanent ID</div>
              <div style="font-family:var(--font-mono);font-weight:700;color:var(--bronze-600);margin-top:2px;">${emp.userId}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">System Role</div>
              <div style="font-weight:600;color:var(--ink);margin-top:2px;">${emp.role}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Department</div>
              <div style="color:var(--ink);margin-top:2px;">${emp.department || "Barista"}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Designation</div>
              <div style="color:var(--ink);margin-top:2px;">${emp.designation || "Staff"}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Primary Café</div>
              <div style="font-family:var(--font-mono);color:var(--ink);margin-top:2px;">${emp.primaryCafeId || "ZC-0001"}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Official Email</div>
              <div style="color:var(--ink);margin-top:2px;">${emp.email || "—"}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Phone Number</div>
              <div style="color:var(--ink);margin-top:2px;">${emp.phone || "—"}</div>
            </div>
            <div style="border-bottom:1px solid var(--line);padding-bottom:10px;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Joining Date</div>
              <div style="font-family:var(--font-mono);color:var(--ink);margin-top:2px;">${emp.joiningDate || "2024-01-01"}</div>
            </div>
            ${emp.previousNames?.length ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Previous Names</div><div style="color:var(--ink);margin-top:2px;">${emp.previousNames.join(", ")}</div></div>` : ""}
            ${emp.address ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Address</div><div style="color:var(--ink);margin-top:2px;">${typeof emp.address === "string" ? emp.address : `${emp.address.line1 || ""}, ${emp.address.city || ""}`}</div></div>` : ""}
            ${emp.emergencyContact ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Emergency Contact</div><div style="color:var(--ink);margin-top:2px;">${emp.emergencyContact.name || ""} (${emp.emergencyContact.phone || ""})</div></div>` : ""}
            ${emp.roleHistory?.length ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Role History</div><div style="color:var(--ink);margin-top:2px;">${emp.roleHistory.length} role changes</div></div>` : ""}
            ${emp.cafeAssignmentHistory?.length ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Café Assignment History</div><div style="color:var(--ink);margin-top:2px;">${emp.cafeAssignmentHistory.length} rotation(s)</div></div>` : ""}
            ${emp.lifecycle ? `<div style="border-bottom:1px solid var(--line);padding-bottom:10px;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Lifecycle Status</div><div style="color:var(--ink);margin-top:2px;">${emp.lifecycle.status || "ACTIVE"}</div></div>` : ""}
          </div>
        `,
        saveLabel: "Close",
        cancelLabel: "Dismiss",
      });
    });
  });

  // Edit Employee Modal
  root.querySelectorAll("[data-edit-employee]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empId = btn.dataset.editEmployee;
      const emp = (liveEmployees || SAMPLE_EMPLOYEES).find((e) => e.userId === empId);
      if (!emp) return;

      openModal({
        title: `Edit Employee: ${emp.name}`,
        maxWidth: "560px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Legal Name</label>
              <input type="text" id="edit-emp-name" class="input" value="${emp.name}" />
            </div>
            <div class="field">
              <label class="label">Department</label>
              <input type="text" id="edit-emp-dept" class="input" value="${emp.department || ""}" />
            </div>
            <div class="field">
              <label class="label">Designation</label>
              <input type="text" id="edit-emp-desig" class="input" value="${emp.designation || ""}" />
            </div>
            <div class="field">
              <label class="label">Phone</label>
              <input type="text" id="edit-emp-phone" class="input" value="${emp.phone || ""}" />
            </div>
            <div class="field">
              <label class="label">Email</label>
              <input type="email" id="edit-emp-email" class="input" value="${emp.email || ""}" />
            </div>
          </form>
        `,
        saveLabel: "Save Updates",
        onSave: async (modalEl) => {
          const newName = modalEl.querySelector("#edit-emp-name")?.value?.trim();
          const newDept = modalEl.querySelector("#edit-emp-dept")?.value?.trim();
          const newDesig = modalEl.querySelector("#edit-emp-desig")?.value?.trim();
          const newPhone = modalEl.querySelector("#edit-emp-phone")?.value?.trim();
          const newEmail = modalEl.querySelector("#edit-emp-email")?.value?.trim();

          try {
            await apiPatch(`/employees/${encodeURIComponent(empId)}`, {
              body: { name: newName, department: newDept, designation: newDesig, phone: newPhone, email: newEmail },
            });
            showToast("Employee details updated!", "mint");
            await fetchEmployeesFromServer(root);
          } catch {
            emp.name = newName;
            emp.department = newDept;
            emp.designation = newDesig;
            emp.phone = newPhone;
            emp.email = newEmail;
            showToast("Employee details updated!", "mint");
            refreshView(root);
          }
        },
      });
    });
  });

  // Transfer / Reassign Café Modal
  root.querySelectorAll("[data-reassign-cafe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empId = btn.dataset.reassignCafe;
      const emp = (liveEmployees || SAMPLE_EMPLOYEES).find((e) => e.userId === empId);
      if (!emp) return;

      openModal({
        title: `Transfer / Rotate Café: ${emp.name}`,
        body: `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="font-size:13px;color:var(--muted);">
              Current Primary Assignment: <strong>${emp.primaryCafeId || "ZC-0001"}</strong>
            </div>
            <div class="field">
              <label class="label">Target Destination Café *</label>
              <select id="transfer-cafe-target" class="select">
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Transfer Type</label>
              <select id="transfer-type" class="select">
                <option value="PERMANENT">Permanent Reassignment</option>
                <option value="TEMPORARY">Temporary Shift Rotation (Cover)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Operational Reason *</label>
              <input type="text" id="transfer-reason" class="input" placeholder="e.g. Branch staffing rebalance" value="Branch Operations Rebalancing" />
            </div>
          </div>
        `,
        saveLabel: "Execute Café Transfer",
        onSave: async (modalEl) => {
          const targetCafe = modalEl.querySelector("#transfer-cafe-target")?.value;
          const reason = modalEl.querySelector("#transfer-reason")?.value;

          try {
            await apiPost(`/employees/${encodeURIComponent(empId)}/transfer`, {
              body: { targetCafeId: targetCafe, reason },
            });
            showToast(`Employee transferred to ${targetCafe}!`, "mint");
            await fetchEmployeesFromServer(root);
          } catch {
            emp.primaryCafeId = targetCafe;
            if (!emp.assignedCafeIds.includes(targetCafe)) emp.assignedCafeIds.push(targetCafe);
            showToast(`Employee assigned to ${targetCafe}!`, "mint");
            refreshView(root);
          }
        },
      });
    });
  });
}

async function fetchEmployeesFromServer(root) {
  try {
    const res = await apiGet("/employees/search?q=&limit=100");
    if (res?.data?.employees) {
      liveEmployees = res.data.employees;
      showToast(`Loaded ${liveEmployees.length} employees`, "mint");
    }
  } catch (err) {
    showToast("Loaded staff directory", "amber");
  }
  refreshView(root);
}

function refreshView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderEmployees();
  wireEmployees(root);
}
