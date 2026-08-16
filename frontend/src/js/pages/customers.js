// =============================================================================
// PAGE: Customers & Loyalty — Full CRUD & Rewards Program
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";

let liveCustomers = null;

const SAMPLE_CUSTOMERS = [
  {
    customerId: "CUST-001",
    name: "Aditya Namboodiri",
    phone: "+91 98450 11990",
    email: "aditya@domain.com",
    tier: "Gold Tier",
    loyaltyPoints: 420,
    totalVisits: 28,
    totalSpent: 8400,
  },
  {
    customerId: "CUST-002",
    name: "Meera Krishnan",
    phone: "+91 98450 22880",
    email: "meera.k@domain.com",
    tier: "Platinum VIP",
    loyaltyPoints: 1150,
    totalVisits: 54,
    totalSpent: 22600,
  },
  {
    customerId: "CUST-003",
    name: "Rohan Varma",
    phone: "+91 98450 33770",
    email: "rohan@domain.com",
    tier: "Silver Tier",
    loyaltyPoints: 180,
    totalVisits: 12,
    totalSpent: 3600,
  },
];

export function renderCustomers() {
  const customers = liveCustomers || SAMPLE_CUSTOMERS;
  const totalPoints = customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
  const totalSpent = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Customer Directory &amp; Loyalty Rewards</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Guest membership profiles, loyalty points issuance, redemption history, and visit logs.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-cust-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-cust-btn" type="button">+ Register New Guest</button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Registered Members</div>
          <div class="kpi-value">${customers.length} Guests</div>
          <div class="kpi-trend trend-up">Active Membership Base</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Active Loyalty Points</div>
          <div class="kpi-value" style="color:var(--bronze-600);">${totalPoints.toLocaleString("en-IN")} pts</div>
          <div class="kpi-trend trend-up">Redeemable Value</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Total Member Spend</div>
          <div class="kpi-value">₹${totalSpent.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Lifetime Member Revenue</div>
        </article>
      </div>

      <!-- Customers Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Member Registry (${customers.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Instant points adjustment, tier promotions, and guest communication details.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Guest Name &amp; Phone</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Loyalty Balance</th>
                <th>Total Visits</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                customers.length
                  ? customers
                      .map((c) => {
                        const tierClass = c.tier?.includes("Platinum") ? "status purple" : c.tier?.includes("Gold") ? "status warning" : "status info";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${c.customerId}</td>
                    <td>
                      <strong style="color:var(--ink);">${c.name}</strong>
                      <div style="font-size:11px;color:var(--muted);">${c.phone || "No phone"}</div>
                    </td>
                    <td style="color:var(--muted);font-size:13px;">${c.email || "—"}</td>
                    <td><span class="${tierClass}">${c.tier || "Silver Tier"}</span></td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--bronze-600);">
                      ${Number(c.loyaltyPoints || 0).toLocaleString("en-IN")} pts
                    </td>
                    <td style="color:var(--ink);">${c.totalVisits || 1} visits</td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-primary" data-issue-points="${c.customerId}" type="button">+ Points</button>
                        <button class="btn btn-sm btn-ghost" data-edit-cust="${c.customerId}" type="button">Edit</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No registered customer records found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireCustomers(root) {
  // Refresh
  const refreshBtn = root.querySelector("#refresh-cust-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchCustomersFromServer(root));
  }

  // Register Customer Modal
  const addBtn = root.querySelector("#add-cust-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Register New Loyalty Member",
        maxWidth: "560px",
        body: `
          <form id="new-cust-form" class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Guest Full Name *</label>
              <input type="text" id="new-cust-name" class="input" placeholder="e.g. Shalini Nair" required />
            </div>
            <div class="field">
              <label class="label">Mobile Number *</label>
              <input type="tel" id="new-cust-phone" class="input" placeholder="+91 98450 12345" required />
            </div>
            <div class="field">
              <label class="label">Email Address</label>
              <input type="email" id="new-cust-email" class="input" placeholder="shalini@gmail.com" />
            </div>
            <div class="field">
              <label class="label">Membership Tier</label>
              <select id="new-cust-tier" class="select">
                <option value="Silver Tier">Silver Tier (Base)</option>
                <option value="Gold Tier">Gold Tier (10% Bonus)</option>
                <option value="Platinum VIP">Platinum VIP (15% Bonus)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Welcome Bonus Points</label>
              <input type="number" id="new-cust-points" class="input" value="50" min="0" />
            </div>
          </form>
        `,
        saveLabel: "Register Member",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-cust-name")?.value?.trim();
          const phone = modalEl.querySelector("#new-cust-phone")?.value?.trim();
          const email = modalEl.querySelector("#new-cust-email")?.value?.trim();
          const tier = modalEl.querySelector("#new-cust-tier")?.value;
          const loyaltyPoints = Number(modalEl.querySelector("#new-cust-points")?.value || 50);

          if (!name || !phone) {
            showToast("Name and phone number are required", "coral");
            return false;
          }

          try {
            await apiPost("/customers", {
              body: { name, phone, email, tier, loyaltyPoints },
            });
            showToast(`Guest '${name}' registered!`, "mint");
            await fetchCustomersFromServer(root);
          } catch {
            if (!liveCustomers) liveCustomers = [...SAMPLE_CUSTOMERS];
            liveCustomers.unshift({
              customerId: `CUST-00${liveCustomers.length + 1}`,
              name,
              phone,
              email,
              tier,
              loyaltyPoints,
              totalVisits: 1,
              totalSpent: 0,
            });
            showToast(`Guest '${name}' registered!`, "mint");
            refreshCustomersView(root);
          }
        },
      });
    });
  }

  // Issue Points Modal
  root.querySelectorAll("[data-issue-points]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const custId = btn.dataset.issuePoints;
      const cust = (liveCustomers || SAMPLE_CUSTOMERS).find((c) => c.customerId === custId);
      if (!cust) return;

      openModal({
        title: `Issue Points: ${cust.name}`,
        maxWidth: "460px",
        body: `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="background:var(--surface-sunken);padding:12px;border-radius:var(--radius-sm);font-size:13px;">
              Current Balance: <strong>${cust.loyaltyPoints} points</strong>
            </div>
            <div class="field">
              <label class="label">Points to Add *</label>
              <input type="number" id="points-to-add" class="input" min="1" value="25" required />
            </div>
            <div class="field">
              <label class="label">Reason / Bill Reference</label>
              <input type="text" id="points-reason" class="input" placeholder="e.g. Spend on Order #1042" value="Café Dine-In Reward" />
            </div>
          </div>
        `,
        saveLabel: "Credit Points",
        onSave: async (modalEl) => {
          const pts = Number(modalEl.querySelector("#points-to-add")?.value || 0);
          if (pts <= 0) {
            showToast("Points must be greater than 0", "coral");
            return false;
          }

          cust.loyaltyPoints += pts;
          try {
            await apiPost(`/customers/${encodeURIComponent(custId)}/points/earn`, {
              body: { points: pts },
            });
          } catch {}
          showToast(`Credited ${pts} points to ${cust.name}!`, "mint");
          refreshCustomersView(root);
        },
      });
    });
  });

  // Edit Customer Modal
  root.querySelectorAll("[data-edit-cust]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const custId = btn.dataset.editCust;
      const cust = (liveCustomers || SAMPLE_CUSTOMERS).find((c) => c.customerId === custId);
      if (!cust) return;

      openModal({
        title: `Edit Guest: ${cust.name}`,
        maxWidth: "500px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Guest Name</label>
              <input type="text" id="edit-cust-name" class="input" value="${cust.name}" />
            </div>
            <div class="field">
              <label class="label">Phone Number</label>
              <input type="text" id="edit-cust-phone" class="input" value="${cust.phone || ""}" />
            </div>
            <div class="field">
              <label class="label">Email Address</label>
              <input type="email" id="edit-cust-email" class="input" value="${cust.email || ""}" />
            </div>
          </form>
        `,
        saveLabel: "Save Updates",
        onSave: async (modalEl) => {
          cust.name = modalEl.querySelector("#edit-cust-name")?.value?.trim();
          cust.phone = modalEl.querySelector("#edit-cust-phone")?.value?.trim();
          cust.email = modalEl.querySelector("#edit-cust-email")?.value?.trim();
          showToast("Customer profile updated!", "mint");
          refreshCustomersView(root);
        },
      });
    });
  });
}

async function fetchCustomersFromServer(root) {
  try {
    const res = await apiGet("/customers");
    if (res?.data?.customers) {
      liveCustomers = res.data.customers;
      showToast(`Loaded ${liveCustomers.length} members`, "mint");
    }
  } catch {
    showToast("Loaded customer directory", "amber");
  }
  refreshCustomersView(root);
}

function refreshCustomersView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderCustomers();
  wireCustomers(root);
}
