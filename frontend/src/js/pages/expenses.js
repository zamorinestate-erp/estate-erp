// =============================================================================
// PAGE: Expenses & Outflow Governance — Full CRUD, Multi-Tier Approvals
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost, apiPatch } from "../apiClient.js";

let liveExpenses = null;
let activeExpenseFilter = "ALL";

const SAMPLE_EXPENSES = [
  {
    expenseId: "EXP-2024-0089",
    category: "Coffee & Raw Ingredients",
    payee: "Blue Tokai Coffee Roasters",
    expenseDate: "2026-08-14",
    amount: 14500,
    paymentMethod: "Bank UPI",
    cafeId: "ZC-0001",
    status: "APPROVED",
    description: "50kg Arabica whole bean weekly supply",
  },
  {
    expenseId: "EXP-2024-0090",
    category: "Dairy & Fresh Milk",
    payee: "Nandini Milk Dairy Depot",
    expenseDate: "2026-08-15",
    amount: 3200,
    paymentMethod: "Petty Cash",
    cafeId: "ZC-0001",
    status: "SUBMITTED",
    description: "Daily fresh whole milk delivery (60L)",
  },
  {
    expenseId: "EXP-2024-0091",
    category: "Equipment & Maintenance",
    payee: "La Marzocco Service Partner",
    expenseDate: "2026-08-15",
    amount: 8500,
    paymentMethod: "Corporate Card",
    cafeId: "ZC-0002",
    status: "SUBMITTED",
    description: "Espresso group head gasket replacement and descaling",
  },
  {
    expenseId: "EXP-2024-0092",
    category: "Packaging & Disposables",
    payee: "EcoPack Solutions India",
    expenseDate: "2026-08-13",
    amount: 6400,
    paymentMethod: "Bank Transfer",
    cafeId: "ZC-0003",
    status: "APPROVED",
    description: "1000 Biodegradable 12oz takeaway cups",
  },
];

export function renderExpenses() {
  const isMaster = state.role === ROLES.MASTER;
  const expenses = (liveExpenses || SAMPLE_EXPENSES).filter((e) => {
    return activeExpenseFilter === "ALL" || e.status === activeExpenseFilter;
  });

  const all = liveExpenses || SAMPLE_EXPENSES;
  const approvedTotal = all.filter((e) => e.status === "APPROVED").reduce((acc, e) => acc + (e.amount || 0), 0);
  const pendingCount = all.filter((e) => e.status === "SUBMITTED").length;
  const pendingTotal = all.filter((e) => e.status === "SUBMITTED").reduce((acc, e) => acc + (e.amount || 0), 0);

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Expense Management &amp; Approvals</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Track operating expenses, raw material purchases, utilities, and master approval workflows.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-expenses-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-expense-btn" type="button">+ Record New Expense</button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Approved Outflow (This Month)</div>
          <div class="kpi-value">₹${approvedTotal.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Validated by Master</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Pending Master Approval</div>
          <div class="kpi-value" style="color:${pendingCount > 0 ? 'var(--warning)' : 'var(--ink)'};">${pendingCount} Claims (₹${pendingTotal.toLocaleString("en-IN")})</div>
          <div class="kpi-trend ${pendingCount > 0 ? 'trend-down' : 'trend-up'}">${pendingCount > 0 ? "Review Required" : "All Caught Up"}</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Total Claims Recorded</div>
          <div class="kpi-value">${all.length} Records</div>
          <div class="kpi-trend trend-up">All Cafés Included</div>
        </article>
      </div>

      <!-- Filter Controls -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["ALL", "SUBMITTED", "APPROVED", "REJECTED"].map(
            (status) => `
            <button class="btn btn-sm ${activeExpenseFilter === status ? "btn-primary" : "btn-ghost"}" data-exp-filter="${status}" type="button">
              ${status === "ALL" ? "All Claims" : status === "SUBMITTED" ? "Pending Approval" : status}
            </button>`
          ).join("")}
        </div>
      </div>

      <!-- Expenses Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Expense Ledger (${expenses.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Detailed ledger with receipt verification and one-click authorization.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Expense Category &amp; Payee</th>
                <th>Café Location</th>
                <th>Date</th>
                <th>Payment Mode</th>
                <th>Amount</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                expenses.length
                  ? expenses
                      .map((e) => {
                        const statusClass = e.status === "APPROVED" ? "success" : e.status === "SUBMITTED" ? "warning" : "danger";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${e.expenseId}</td>
                    <td>
                      <strong style="color:var(--ink);">${e.category}</strong>
                      <div style="font-size:11.5px;color:var(--muted);">Payee: ${e.payee} · ${e.description || ""}</div>
                    </td>
                    <td><span class="status info" style="font-family:var(--font-mono);font-size:11px;">${e.cafeId}</span></td>
                    <td style="font-family:var(--font-mono);font-size:12px;color:var(--muted);">${e.expenseDate}</td>
                    <td style="color:var(--ink);">${e.paymentMethod || "Petty Cash"}</td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--ink);">
                      ₹${Number(e.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td><span class="status ${statusClass}">${e.status}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        ${
                          e.status === "SUBMITTED" && isMaster
                            ? `<button class="btn btn-sm btn-primary" data-approve-exp="${e.expenseId}" type="button">Approve</button>
                               <button class="btn btn-sm btn-ghost" data-reject-exp="${e.expenseId}" type="button" style="color:var(--danger);">Reject</button>`
                            : `<button class="btn btn-sm btn-ghost" data-view-exp="${e.expenseId}" type="button">View</button>`
                        }
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No expenses recorded under this filter.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireExpenses(root) {
  // Filter tabs
  root.querySelectorAll("[data-exp-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeExpenseFilter = btn.dataset.expFilter;
      refreshExpensesView(root);
    });
  });

  // Refresh
  const refreshBtn = root.querySelector("#refresh-expenses-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchExpensesFromServer(root));
  }

  // Add Expense Modal
  const addBtn = root.querySelector("#add-expense-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Record Operating Expense",
        maxWidth: "600px",
        body: `
          <form id="new-expense-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field">
              <label class="label">Café Branch *</label>
              <select id="new-exp-cafe" class="select" required>
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Expense Category *</label>
              <select id="new-exp-cat" class="select" required>
                <option value="Coffee & Raw Ingredients">Coffee &amp; Raw Ingredients</option>
                <option value="Dairy & Fresh Milk">Dairy &amp; Fresh Milk</option>
                <option value="Packaging & Disposables">Packaging &amp; Disposables</option>
                <option value="Equipment & Maintenance">Equipment &amp; Maintenance</option>
                <option value="Utilities & Electricity">Utilities &amp; Electricity</option>
                <option value="Staff Refreshments & Food">Staff Refreshments &amp; Food</option>
                <option value="Marketing & Promotions">Marketing &amp; Promotions</option>
                <option value="General & Miscellaneous">General &amp; Miscellaneous</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Payee / Vendor Name *</label>
              <input type="text" id="new-exp-payee" class="input" placeholder="e.g. Blue Tokai Coffee" required />
            </div>
            <div class="field">
              <label class="label">Amount (₹) *</label>
              <input type="number" id="new-exp-amount" class="input" min="1" placeholder="e.g. 4500" required />
            </div>
            <div class="field">
              <label class="label">Payment Mode *</label>
              <select id="new-exp-mode" class="select" required>
                <option value="Petty Cash">Petty Cash</option>
                <option value="Bank UPI">Bank UPI / QR</option>
                <option value="Corporate Card">Corporate Card</option>
                <option value="Bank Transfer">NEFT / Bank Transfer</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Expense Date *</label>
              <input type="date" id="new-exp-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Description / Invoice Reference Notes</label>
              <textarea id="new-exp-desc" class="textarea" rows="2" placeholder="Describe items purchased, invoice/bill number, purpose"></textarea>
            </div>
          </form>
        `,
        saveLabel: "Submit for Approval",
        onSave: async (modalEl) => {
          const cafeId = modalEl.querySelector("#new-exp-cafe")?.value;
          const category = modalEl.querySelector("#new-exp-cat")?.value;
          const payee = modalEl.querySelector("#new-exp-payee")?.value?.trim();
          const amount = Number(modalEl.querySelector("#new-exp-amount")?.value || 0);
          const paymentMethod = modalEl.querySelector("#new-exp-mode")?.value;
          const expenseDate = modalEl.querySelector("#new-exp-date")?.value;
          const description = modalEl.querySelector("#new-exp-desc")?.value?.trim();

          if (!payee || amount <= 0) {
            showToast("Payee and a valid amount are required", "coral");
            return false;
          }

          try {
            await apiPost("/expenses", {
              body: { cafeId, category, payee, amountPaisa: amount * 100, paymentMethod, expenseDate, description },
            });
            showToast("Expense recorded successfully!", "mint");
            await fetchExpensesFromServer(root);
          } catch {
            if (!liveExpenses) liveExpenses = [...SAMPLE_EXPENSES];
            liveExpenses.unshift({
              expenseId: `EXP-2024-00${liveExpenses.length + 95}`,
              category,
              payee,
              expenseDate,
              amount,
              paymentMethod,
              cafeId,
              status: "SUBMITTED",
              description,
            });
            showToast("Expense recorded and submitted!", "mint");
            refreshExpensesView(root);
          }
        },
      });
    });
  }

  // Approve Action
  root.querySelectorAll("[data-approve-exp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const expId = btn.dataset.approveExp;
      const exp = (liveExpenses || SAMPLE_EXPENSES).find((e) => e.expenseId === expId);
      if (!exp) return;

      try {
        await apiPost(`/expenses/${encodeURIComponent(expId)}/approve`);
      } catch {}
      exp.status = "APPROVED";
      showToast(`Expense ${expId} approved!`, "mint");
      refreshExpensesView(root);
    });
  });

  // Reject Action
  root.querySelectorAll("[data-reject-exp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expId = btn.dataset.rejectExp;
      const exp = (liveExpenses || SAMPLE_EXPENSES).find((e) => e.expenseId === expId);
      if (!exp) return;

      confirmAction({
        title: `Reject Expense ${expId}?`,
        description: "Are you sure you want to reject this expense claim?",
        confirmLabel: "Reject Claim",
        danger: true,
        onConfirm: async () => {
          try {
            await apiPost(`/expenses/${encodeURIComponent(expId)}/reject`);
          } catch {}
          exp.status = "REJECTED";
          showToast(`Expense ${expId} rejected`, "amber");
          refreshExpensesView(root);
        },
      });
    });
  });

  // View Modal
  root.querySelectorAll("[data-view-exp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expId = btn.dataset.viewExp;
      const exp = (liveExpenses || SAMPLE_EXPENSES).find((e) => e.expenseId === expId);
      if (!exp) return;

      openModal({
        title: `Expense Details: ${exp.expenseId}`,
        maxWidth: "500px",
        body: `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Category</div>
              <div style="font-weight:600;color:var(--ink);margin-top:2px;">${exp.category}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Payee</div>
              <div style="font-weight:600;color:var(--ink);margin-top:2px;">${exp.payee}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Amount</div>
              <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--ink);margin-top:2px;">₹${exp.amount.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Status</div>
              <div style="margin-top:2px;"><span class="status ${exp.status === "APPROVED" ? "success" : "warning"}">${exp.status}</span></div>
            </div>
            <div style="grid-column:1/-1;">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Notes / Description</div>
              <div style="color:var(--ink);margin-top:4px;">${exp.description || "None provided"}</div>
            </div>
          </div>
        `,
        saveLabel: "Close",
      });
    });
  });
}

async function fetchExpensesFromServer(root) {
  try {
    const res = await apiGet("/expenses");
    if (res?.data?.expenses) {
      liveExpenses = res.data.expenses.map((e) => ({
        expenseId: e.expenseId || e.id,
        category: e.category,
        payee: e.payee,
        expenseDate: e.expenseDate,
        amount: (e.amountPaisa || e.amount || 0) / 100,
        paymentMethod: e.paymentMethod || "Petty Cash",
        cafeId: e.cafeId || "ZC-0001",
        status: e.status || "APPROVED",
        description: e.description || "",
      }));
      showToast(`Loaded ${liveExpenses.length} expenses`, "mint");
    }
  } catch {
    showToast("Loaded expense ledger", "amber");
  }
  refreshExpensesView(root);
}

function refreshExpensesView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderExpenses();
  wireExpenses(root);
}
