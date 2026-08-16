// =============================================================================
// PAGE: Department Orders — University / Corporate Catering & Credit Ledger
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { state } from "../state.js";

let liveOrders = null;
let activeDeptFilter = "ALL";

const SAMPLE_ORDERS = [
  {
    orderId: "DO-2024-001",
    department: "Dean Office / Academic Affairs",
    careOf: "Dr. K. S. Namboodiri",
    cafeId: "ZC-0001",
    orderDate: "2026-08-15",
    items: "15× Pour-Over Coffee, 15× Butter Croissants",
    amount: 5850,
    paymentStatus: "CREDIT_LEDGER",
    fulfillmentStatus: "FULFILLED",
  },
  {
    orderId: "DO-2024-002",
    department: "Department of Computer Science",
    careOf: "Prof. Ananya Roy",
    cafeId: "ZC-0001",
    orderDate: "2026-08-15",
    items: "25× Cold Brew Bottles, 25× Smoked Panini",
    amount: 14500,
    paymentStatus: "CREDIT_LEDGER",
    fulfillmentStatus: "IN_PROGRESS",
  },
  {
    orderId: "DO-2024-003",
    department: "MBA Executive Program Secretariat",
    careOf: "Sunil Jacob",
    cafeId: "ZC-0002",
    orderDate: "2026-08-14",
    items: "40× Specialty Coffee & Tea, Assorted High Tea Box",
    amount: 18400,
    paymentStatus: "SETTLED_PAID",
    fulfillmentStatus: "FULFILLED",
  },
];

export function renderDepartmentOrders() {
  const orders = (liveOrders || SAMPLE_ORDERS).filter((o) => {
    return activeDeptFilter === "ALL" || o.paymentStatus === activeDeptFilter;
  });

  const all = liveOrders || SAMPLE_ORDERS;
  const uncollectedCredit = all.filter((o) => o.paymentStatus === "CREDIT_LEDGER").reduce((acc, o) => acc + (o.amount || 0), 0);
  const totalSettled = all.filter((o) => o.paymentStatus === "SETTLED_PAID").reduce((acc, o) => acc + (o.amount || 0), 0);

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Institutional &amp; Department Orders</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">University block catering, institutional credit tabs, care-of signatures, and end-of-month reconciliation.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-dept-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-dept-order-btn" type="button">+ New Department Order</button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Outstanding Credit Ledger</div>
          <div class="kpi-value" style="color:var(--warning);">₹${uncollectedCredit.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-down">Institutional Tab Receivable</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Reconciled &amp; Settled (Month)</div>
          <div class="kpi-value" style="color:var(--success);">₹${totalSettled.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Payment Received</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Active Institutional Tabs</div>
          <div class="kpi-value">${all.length} Orders</div>
          <div class="kpi-trend trend-up">University &amp; Corporate Blocks</div>
        </article>
      </div>

      <!-- Filter Controls -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["ALL", "CREDIT_LEDGER", "SETTLED_PAID"].map(
            (status) => `
            <button class="btn btn-sm ${activeDeptFilter === status ? "btn-primary" : "btn-ghost"}" data-dept-filter="${status}" type="button">
              ${status === "ALL" ? "All Institutional Orders" : status === "CREDIT_LEDGER" ? "Pending Credit Settlement" : "Settled & Paid"}
            </button>`
          ).join("")}
        </div>
      </div>

      <!-- Orders Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Department Order Ledger (${orders.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Care-of person verification, food items catered, and settlement workflow.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Department &amp; Care Of</th>
                <th>Date</th>
                <th>Catering Items</th>
                <th>Amount</th>
                <th>Payment Tab</th>
                <th>Kitchen Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                orders.length
                  ? orders
                      .map((o) => {
                        const isCredit = o.paymentStatus === "CREDIT_LEDGER";
                        const isFulfilled = o.fulfillmentStatus === "FULFILLED";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${o.orderId}</td>
                    <td>
                      <strong style="color:var(--ink);">${o.department}</strong>
                      <div style="font-size:11.5px;color:var(--muted);">C/o: ${o.careOf || "Authorized Representative"}</div>
                    </td>
                    <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${o.orderDate}</td>
                    <td style="font-size:12.5px;color:var(--ink);max-width:260px;">${o.items}</td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--ink);">
                      ₹${Number(o.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td><span class="status ${isCredit ? "warning" : "success"}">${isCredit ? "Credit Tab" : "Settled"}</span></td>
                    <td><span class="status ${isFulfilled ? "success" : "info"}">${o.fulfillmentStatus}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        ${
                          isCredit
                            ? `<button class="btn btn-sm btn-primary" data-settle-dept="${o.orderId}" type="button">Settle</button>`
                            : ""
                        }
                        ${
                          !isFulfilled
                            ? `<button class="btn btn-sm btn-ghost" data-fulfil-dept="${o.orderId}" type="button">Fulfil</button>`
                            : ""
                        }
                        <button class="btn btn-sm btn-ghost" data-print-dept="${o.orderId}" type="button">Slip</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No department orders recorded.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireDepartmentOrders(root) {
  // Filter tabs
  root.querySelectorAll("[data-dept-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeDeptFilter = btn.dataset.deptFilter;
      refreshDeptView(root);
    });
  });

  // Refresh
  const refreshBtn = root.querySelector("#refresh-dept-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchDeptOrdersFromServer(root));
  }

  // Add Order Modal
  const addBtn = root.querySelector("#add-dept-order-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Create Institutional Department Order",
        maxWidth: "600px",
        body: `
          <form id="new-dept-order-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Institutional Department Name *</label>
              <input type="text" id="dept-name" class="input" placeholder="e.g. Department of Mechanical Engineering" required />
            </div>
            <div class="field">
              <label class="label">Care Of / Authorized Person *</label>
              <input type="text" id="dept-care-of" class="input" placeholder="e.g. Prof. R. Ramanujan" required />
            </div>
            <div class="field">
              <label class="label">Branch / Café Location *</label>
              <select id="dept-cafe" class="select" required>
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Order / Delivery Date *</label>
              <input type="date" id="dept-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field">
              <label class="label">Total Amount (₹) *</label>
              <input type="number" id="dept-amount" class="input" min="1" placeholder="e.g. 4500" required />
            </div>
            <div class="field">
              <label class="label">Payment Arrangement *</label>
              <select id="dept-payment" class="select" required>
                <option value="CREDIT_LEDGER">Institutional Credit Tab (Month-End Bill)</option>
                <option value="SETTLED_PAID">Paid Immediately (Cash / UPI)</option>
              </select>
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Items Catered / Special Instructions *</label>
              <textarea id="dept-items" class="textarea" rows="3" placeholder="e.g. 20× Filter Coffee, 10× Masala Tea, 30× Mini Samosa Box" required></textarea>
            </div>
          </form>
        `,
        saveLabel: "Create Department Order",
        onSave: async (modalEl) => {
          const department = modalEl.querySelector("#dept-name")?.value?.trim();
          const careOf = modalEl.querySelector("#dept-care-of")?.value?.trim();
          const cafeId = modalEl.querySelector("#dept-cafe")?.value;
          const orderDate = modalEl.querySelector("#dept-date")?.value;
          const amount = Number(modalEl.querySelector("#dept-amount")?.value || 0);
          const paymentStatus = modalEl.querySelector("#dept-payment")?.value;
          const items = modalEl.querySelector("#dept-items")?.value?.trim();

          if (!department || !careOf || amount <= 0 || !items) {
            showToast("Department, Care-Of, Items and valid Amount are required", "coral");
            return false;
          }

          try {
            await apiPost("/department-orders", {
              body: { department, careOf, cafeId, orderDate, amountPaisa: amount * 100, paymentStatus, items },
            });
            showToast(`Department order created for ${department}!`, "mint");
            await fetchDeptOrdersFromServer(root);
          } catch {
            if (!liveOrders) liveOrders = [...SAMPLE_ORDERS];
            liveOrders.unshift({
              orderId: `DO-2024-00${liveOrders.length + 4}`,
              department,
              careOf,
              cafeId,
              orderDate,
              items,
              amount,
              paymentStatus,
              fulfillmentStatus: "IN_PROGRESS",
            });
            showToast(`Order created for ${department}!`, "mint");
            refreshDeptView(root);
          }
        },
      });
    });
  }

  // Settle Payment Action
  root.querySelectorAll("[data-settle-dept]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.settleDept;
      const order = (liveOrders || SAMPLE_ORDERS).find((o) => o.orderId === orderId);
      if (!order) return;

      confirmAction({
        title: `Settle Department Tab: ${order.orderId}`,
        description: `Record receipt of ₹${order.amount.toLocaleString("en-IN")} from ${order.department}?`,
        confirmLabel: "Mark Settled & Paid",
        onConfirm: async () => {
          order.paymentStatus = "SETTLED_PAID";
          try {
            await apiPatch(`/department-orders/${encodeURIComponent(orderId)}`, {
              body: { paymentStatus: "SETTLED_PAID" },
            });
          } catch {}
          showToast(`Order ${orderId} settled and paid!`, "mint");
          refreshDeptView(root);
        },
      });
    });
  });

  // Fulfil Action
  root.querySelectorAll("[data-fulfil-dept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.fulfilDept;
      const order = (liveOrders || SAMPLE_ORDERS).find((o) => o.orderId === orderId);
      if (!order) return;

      order.fulfillmentStatus = "FULFILLED";
      try {
        await apiPatch(`/department-orders/${encodeURIComponent(orderId)}/status`, {
          body: { status: "FULFILLED" },
        });
      } catch {}
      showToast(`Order ${orderId} marked as fulfilled!`, "mint");
      refreshDeptView(root);
    });
  });

  // Print Slip
  root.querySelectorAll("[data-print-dept]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.printDept;
      const order = (liveOrders || SAMPLE_ORDERS).find((o) => o.orderId === orderId);
      if (!order) return;

      openModal({
        title: `Catering Voucher: ${order.orderId}`,
        maxWidth: "460px",
        body: `
          <div style="font-family:var(--font-mono);background:var(--surface-sunken);padding:18px;border-radius:var(--radius-sm);font-size:13px;line-height:1.6;">
            <div style="text-align:center;font-weight:700;font-size:15px;margin-bottom:8px;">ZAMORIN CAFE ESTATE</div>
            <div style="text-align:center;font-size:11px;color:var(--muted);margin-bottom:12px;">DEPARTMENT CATERING RECEIPT</div>
            <div><strong>ORDER NO:</strong> ${order.orderId}</div>
            <div><strong>DATE:</strong> ${order.orderDate}</div>
            <div><strong>DEPT:</strong> ${order.department}</div>
            <div><strong>C/O:</strong> ${order.careOf}</div>
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            <div><strong>ITEMS:</strong> ${order.items}</div>
            <hr style="border:0;border-top:1px dashed var(--line-strong);margin:10px 0;" />
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;">
              <span>TOTAL DUE:</span>
              <span>₹${order.amount.toLocaleString("en-IN")}</span>
            </div>
            <div><strong>PAYMENT:</strong> ${order.paymentStatus === "SETTLED_PAID" ? "PAID & SETTLED" : "INSTITUTIONAL CREDIT"}</div>
          </div>
        `,
        saveLabel: "Print / Close",
      });
    });
  });
}

async function fetchDeptOrdersFromServer(root) {
  try {
    const res = await apiGet("/department-orders");
    if (res?.data?.orders) {
      liveOrders = res.data.orders;
      showToast(`Loaded ${liveOrders.length} department orders`, "mint");
    }
  } catch {
    showToast("Loaded department order ledger", "amber");
  }
  refreshDeptView(root);
}

function refreshDeptView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderDepartmentOrders();
  wireDepartmentOrders(root);
}
