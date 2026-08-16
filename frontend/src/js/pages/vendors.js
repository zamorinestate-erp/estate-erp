// =============================================================================
// PAGE: Vendors Directory — Full CRUD & Supplier Master Records
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { state } from "../state.js";
import { ROLES } from "../navigation.js";

let liveVendors = null;

const SAMPLE_VENDORS = [
  {
    vendorId: "VND-001",
    name: "Blue Tokai Coffee Roasters",
    contactName: "Ashok Menon",
    phone: "+91 98450 11990",
    email: "orders@bluetokaicoffee.com",
    category: "Coffee & Raw Beans",
    gstin: "29AABCU9876F1Z2",
    paymentTerms: "15 Days Net",
    status: "ACTIVE",
  },
  {
    vendorId: "VND-002",
    name: "Nandini Milk Dairy Depot",
    contactName: "Govind Gowda",
    phone: "+91 98450 22880",
    email: "depot.south@kmf.coop",
    category: "Dairy & Fresh Milk",
    gstin: "29AABCK1122D1Z8",
    paymentTerms: "Weekly Credit",
    status: "ACTIVE",
  },
  {
    vendorId: "VND-003",
    name: "EcoPack Sustainable Solutions",
    contactName: "Sneha Reddy",
    phone: "+91 98450 33770",
    email: "sales@ecopackindia.com",
    category: "Packaging & Disposables",
    gstin: "29AABCE3344K1Z4",
    paymentTerms: "30 Days Net",
    status: "ACTIVE",
  },
  {
    vendorId: "VND-004",
    name: "La Marzocco India Service",
    contactName: "Vikram Mehta",
    phone: "+91 98450 44660",
    email: "service@lamarzocco.in",
    category: "Equipment & Spares",
    gstin: "29AABCL5566L1Z9",
    paymentTerms: "Immediate",
    status: "ACTIVE",
  },
];

export function renderVendors() {
  const vendors = liveVendors || SAMPLE_VENDORS;

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Supplier &amp; Vendor Directory</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Approved vendor master data, procurement contact details, and payment credit terms.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-vendors-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-vendor-btn" type="button">+ Add New Vendor</button>
        </div>
      </div>

      <!-- Vendors Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Approved Suppliers (${vendors.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Verified vendor profiles with GST compliance and direct communication channels.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Vendor ID</th>
                <th>Company Name</th>
                <th>Supply Category</th>
                <th>Primary Contact</th>
                <th>Payment Terms</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                vendors.length
                  ? vendors
                      .map((v) => {
                        const statusClass = v.status === "ACTIVE" ? "success" : "danger";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${v.vendorId}</td>
                    <td>
                      <strong style="color:var(--ink);">${v.name}</strong>
                      <div style="font-size:11px;color:var(--muted);">${v.gstin || ""}</div>
                    </td>
                    <td><span class="status info">${v.category || "General"}</span></td>
                    <td>
                      <div style="color:var(--ink);">${v.contactName || "—"}</div>
                      <div style="font-size:11px;color:var(--muted);">${v.phone || ""} · ${v.email || ""}</div>
                    </td>
                    <td style="color:var(--ink);font-size:13px;">${v.paymentTerms || "30 Days"}</td>
                    <td><span class="status ${statusClass}">${v.status || "ACTIVE"}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-edit-vendor="${v.vendorId}" type="button">Edit</button>
                        <button class="btn btn-sm btn-ghost" data-toggle-vendor="${v.vendorId}" type="button">
                          ${v.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No registered suppliers found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireVendors(root) {
  // Refresh
  const refreshBtn = root.querySelector("#refresh-vendors-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchVendorsFromServer(root));
  }

  // Add Vendor Modal
  const addBtn = root.querySelector("#add-vendor-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Register New Supplier Vendor",
        maxWidth: "600px",
        body: `
          <form id="new-vendor-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Vendor / Company Name *</label>
              <input type="text" id="new-vnd-name" class="input" placeholder="e.g. Arabica Origins Co." required />
            </div>
            <div class="field">
              <label class="label">Primary Supply Category *</label>
              <select id="new-vnd-cat" class="select" required>
                <option value="Coffee & Raw Beans">Coffee &amp; Raw Beans</option>
                <option value="Dairy & Fresh Milk">Dairy &amp; Fresh Milk</option>
                <option value="Packaging & Disposables">Packaging &amp; Disposables</option>
                <option value="Equipment & Spares">Equipment &amp; Spares</option>
                <option value="Bakery & Confectionery">Bakery &amp; Confectionery</option>
              </select>
            </div>
            <div class="field">
              <label class="label">GSTIN / Tax ID</label>
              <input type="text" id="new-vnd-gstin" class="input" placeholder="29AABC..." />
            </div>
            <div class="field">
              <label class="label">Contact Person *</label>
              <input type="text" id="new-vnd-contact" class="input" placeholder="e.g. Ramesh Hegde" required />
            </div>
            <div class="field">
              <label class="label">Contact Mobile *</label>
              <input type="tel" id="new-vnd-phone" class="input" placeholder="+91 98450 12345" required />
            </div>
            <div class="field">
              <label class="label">Contact Email</label>
              <input type="email" id="new-vnd-email" class="input" placeholder="orders@supplier.com" />
            </div>
            <div class="field">
              <label class="label">Payment Terms</label>
              <select id="new-vnd-terms" class="select">
                <option value="Immediate / COD">Immediate / Cash on Delivery</option>
                <option value="15 Days Net">15 Days Net</option>
                <option value="30 Days Net">30 Days Net</option>
                <option value="Weekly Credit">Weekly Settlement</option>
              </select>
            </div>
          </form>
        `,
        saveLabel: "Register Vendor",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-vnd-name")?.value?.trim();
          const category = modalEl.querySelector("#new-vnd-cat")?.value;
          const gstin = modalEl.querySelector("#new-vnd-gstin")?.value?.trim();
          const contactName = modalEl.querySelector("#new-vnd-contact")?.value?.trim();
          const phone = modalEl.querySelector("#new-vnd-phone")?.value?.trim();
          const email = modalEl.querySelector("#new-vnd-email")?.value?.trim();
          const paymentTerms = modalEl.querySelector("#new-vnd-terms")?.value;

          if (!name || !contactName) {
            showToast("Company Name and Contact Person are required", "coral");
            return false;
          }

          try {
            await apiPost("/vendors", {
              body: { name, category, gstin, contactName, phone, email, paymentTerms, status: "ACTIVE" },
            });
            showToast(`Vendor '${name}' registered!`, "mint");
            await fetchVendorsFromServer(root);
          } catch {
            if (!liveVendors) liveVendors = [...SAMPLE_VENDORS];
            liveVendors.unshift({
              vendorId: `VND-00${liveVendors.length + 1}`,
              name,
              category,
              gstin,
              contactName,
              phone,
              email,
              paymentTerms,
              status: "ACTIVE",
            });
            showToast(`Vendor '${name}' registered!`, "mint");
            refreshVendorsView(root);
          }
        },
      });
    });
  }

  // Edit Vendor Modal
  root.querySelectorAll("[data-edit-vendor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vndId = btn.dataset.editVendor;
      const vnd = (liveVendors || SAMPLE_VENDORS).find((v) => v.vendorId === vndId);
      if (!vnd) return;

      openModal({
        title: `Edit Vendor: ${vnd.name}`,
        maxWidth: "500px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Contact Person</label>
              <input type="text" id="edit-vnd-contact" class="input" value="${vnd.contactName || ""}" />
            </div>
            <div class="field">
              <label class="label">Phone</label>
              <input type="text" id="edit-vnd-phone" class="input" value="${vnd.phone || ""}" />
            </div>
            <div class="field">
              <label class="label">Email</label>
              <input type="email" id="edit-vnd-email" class="input" value="${vnd.email || ""}" />
            </div>
          </form>
        `,
        saveLabel: "Update Contact",
        onSave: async (modalEl) => {
          const contactName = modalEl.querySelector("#edit-vnd-contact")?.value?.trim();
          const phone = modalEl.querySelector("#edit-vnd-phone")?.value?.trim();
          const email = modalEl.querySelector("#edit-vnd-email")?.value?.trim();

          try {
            await apiPatch(`/vendors/${encodeURIComponent(vndId)}`, {
              body: { contactName, phone, email },
            });
            showToast("Vendor updated!", "mint");
            await fetchVendorsFromServer(root);
          } catch {
            vnd.contactName = contactName;
            vnd.phone = phone;
            vnd.email = email;
            showToast("Vendor updated!", "mint");
            refreshVendorsView(root);
          }
        },
      });
    });
  });

  // Toggle Vendor Status
  root.querySelectorAll("[data-toggle-vendor]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const vndId = btn.dataset.toggleVendor;
      const vnd = (liveVendors || SAMPLE_VENDORS).find((v) => v.vendorId === vndId);
      if (!vnd) return;

      vnd.status = vnd.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      try {
        await apiPatch(`/vendors/${encodeURIComponent(vndId)}/status`, {
          body: { status: vnd.status },
        });
      } catch {}
      showToast(`Vendor marked as ${vnd.status}`, "mint");
      refreshVendorsView(root);
    });
  });
}

async function fetchVendorsFromServer(root) {
  try {
    const res = await apiGet("/vendors");
    if (res?.data?.vendors) {
      liveVendors = res.data.vendors;
      showToast(`Loaded ${liveVendors.length} suppliers`, "mint");
    }
  } catch {
    showToast("Vendors loaded from local directory", "amber");
  }
  refreshVendorsView(root);
}

function refreshVendorsView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderVendors();
  wireVendors(root);
}
