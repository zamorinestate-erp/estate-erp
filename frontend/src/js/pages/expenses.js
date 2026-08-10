// =============================================================================
// PAGE: Expenses — API-wired version
// List + slide-over "New Expense" form. Approve/Reject inline.
// All data from GET /api/v1/expenses. Mutations use POST/PATCH/POST endpoints.
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, confirmAction, skeleton } from "../components.js";
import { apiGet, apiPost, apiPatch } from "../apiClient.js";

let _expensesPage = 1;

function fmtInr(paisa) {
  const r = Math.round((paisa || 0) / 100);
  return "₹" + r.toLocaleString("en-IN");
}

function statusPill(status) {
  const map = {
    DRAFT:     "pill-dark",
    SUBMITTED: "pill-amber",
    APPROVED:  "pill-mint",
    REJECTED:  "pill-coral",
    PAID:      "pill-mint",
    REVERSED:  "pill-dark",
  };
  return `<span class="pill ${map[status] || "pill-dark"}" style="font-size:10px;">${status}</span>`;
}

function expenseRow(e, canApprove) {
  const actionCell = canApprove && e.status === "SUBMITTED"
    ? `<td>
        <div class="flex gap-sm">
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:11.5px;" data-reject="${e.expenseId}">Reject</button>
          <button class="btn btn-primary" style="padding:5px 10px;font-size:11.5px;" data-approve="${e.expenseId}">Approve</button>
        </div>
      </td>`
    : canApprove ? `<td>—</td>` : "";
  return `<tr>
    <td>${e.expenseId}</td>
    <td>${e.category || "—"}</td>
    <td>${e.payee || "—"}</td>
    <td>${e.expenseDate || "—"}</td>
    <td>${fmtInr(e.amountPaisa)}</td>
    <td>${statusPill(e.status)}</td>
    ${actionCell}
  </tr>`;
}

function summaryKpis(summary) {
  const total = fmtInr(summary?.totalApprovedPaisa || 0);
  const pending = summary?.pendingCount || 0;
  const rejected = summary?.rejectedCount || 0;
  return `
    <div class="glass kpi-card"><div class="kpi-label">Approved this month</div><div class="kpi-value">${total}</div></div>
    <div class="glass kpi-card"><div class="kpi-label">Awaiting approval</div><div class="kpi-value">${pending}</div></div>
    <div class="glass kpi-card"><div class="kpi-label">Rejected</div><div class="kpi-value">${rejected}</div></div>
  `;
}

export function renderExpenses() {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const canApprove = state.role === ROLES.MASTER;

  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Expenses</div>
          <div class="muted-white" style="font-size:13.5px;">${isAdmin ? "Your assigned café, only" : "All cafes"}</div>
        </div>
        <button class="btn btn-primary" id="new-expense-btn">+ New expense</button>
      </div>

      <div id="expense-kpi-strip" style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:18px;">
        ${skeleton("80px")}${skeleton("80px")}${skeleton("80px")}
      </div>

      <div class="glass" style="padding:20px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">All expenses</div>
        <div id="expense-table-wrap">${skeleton("200px")}</div>
      </div>
    </div>

    <!-- New expense slide-over -->
    <div id="expense-form-overlay" class="dialog-overlay" style="display:none;">
      <div class="glass-dark dialog-box" style="width:440px;">
        <h3>New expense</h3>
        <div class="flex-col gap-md" style="margin-bottom:18px;">
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.65);">Category</label>
            <select id="exp-category" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;margin-top:4px;">
              <option value="UTILITIES">Utilities</option>
              <option value="REPAIRS">Repairs</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="MARKETING">Marketing</option>
              <option value="SALARIES">Salaries</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.65);">Payee</label>
            <input type="text" id="exp-payee" placeholder="Vendor or payee name" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.65);">Amount (₹)</label>
            <input type="number" id="exp-amount" min="1" step="1" placeholder="0" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.65);">Date</label>
            <input type="date" id="exp-date" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px;color:rgba(255,255,255,0.65);">Description</label>
            <input type="text" id="exp-description" maxlength="300" placeholder="Brief note…" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;margin-top:4px;" />
          </div>
        </div>
        <div class="flex gap-sm" style="justify-content:flex-end;">
          <button class="btn btn-ghost" id="expense-form-cancel">Cancel</button>
          <button class="btn btn-primary" id="expense-form-submit">Save as draft</button>
        </div>
      </div>
    </div>
  `;
}

export async function wireExpenses(root) {
  await Promise.all([loadSummary(root), loadExpenses(root)]);
  bindExpenseActions(root);
}

async function loadSummary(root) {
  try {
    const res = await apiGet("/expenses/summary");
    const strip = root.querySelector("#expense-kpi-strip");
    if (strip) strip.innerHTML = summaryKpis(res?.data);
  } catch {
    const strip = root.querySelector("#expense-kpi-strip");
    if (strip) strip.innerHTML = summaryKpis({});
  }
}

async function loadExpenses(root, page = 1) {
  const canApprove = state.role === ROLES.MASTER;
  try {
    const res = await apiGet(`/expenses?page=${page}&limit=25`);
    const expenses = res?.data?.expenses || [];
    const pagination = res?.data?.pagination || {};
    _expensesPage = page;
    const hasMore = page < (pagination.totalPages || 1);

    const wrap = root.querySelector("#expense-table-wrap");
    if (!wrap) return;

    if (expenses.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No expenses yet</div><div>Create your first expense using the button above.</div></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="glass-table">
        <thead><tr><th>ID</th><th>Category</th><th>Payee</th><th>Date</th><th>Amount</th><th>Status</th>${canApprove ? "<th>Action</th>" : ""}</tr></thead>
        <tbody id="expense-rows">${expenses.map((e) => expenseRow(e, canApprove)).join("")}</tbody>
      </table>
      ${hasMore ? `<button class="btn btn-ghost" id="expense-load-more" style="margin-top:12px;width:100%;">Load more</button>` : ""}
    `;

    const moreBtn = root.querySelector("#expense-load-more");
    if (moreBtn) moreBtn.addEventListener("click", () => loadExpenses(root, _expensesPage + 1));

    root.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => handleDecision(root, btn.dataset.approve, "APPROVED"));
    });
    root.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => handleDecision(root, btn.dataset.reject, "REJECTED"));
    });
  } catch (err) {
    const wrap = root.querySelector("#expense-table-wrap");
    if (wrap) wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load expenses — ${err.message}</div>`;
  }
}

async function handleDecision(root, expenseId, decision) {
  const label = decision === "APPROVED" ? "Approve" : "Reject";
  confirmAction({
    title: `${label} expense ${expenseId}?`,
    description: decision === "REJECTED" ? "The submitter will be notified. Rejection reason is required." : "Approved expenses can proceed to payment.",
    confirmLabel: label,
    onConfirm: async () => {
      try {
        await apiPost(`/expenses/${expenseId}/decision`, {
          body: { decision, reason: decision === "REJECTED" ? "Rejected by Master" : undefined },
        });
        showToast(`Expense ${decision.toLowerCase()}`, decision === "APPROVED" ? "mint" : "amber");
        await loadExpenses(root);
      } catch (err) {
        showToast(err.message || "Action failed", "coral");
      }
    },
  });
}

function bindExpenseActions(root) {
  const overlay = root.querySelector("#expense-form-overlay");

  root.querySelector("#new-expense-btn")?.addEventListener("click", () => {
    if (overlay) {
      overlay.style.display = "flex";
      const dateInput = root.querySelector("#exp-date");
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    }
  });

  root.querySelector("#expense-form-cancel")?.addEventListener("click", () => {
    if (overlay) overlay.style.display = "none";
  });

  root.querySelector("#expense-form-submit")?.addEventListener("click", async () => {
    const category    = root.querySelector("#exp-category")?.value;
    const payee       = root.querySelector("#exp-payee")?.value?.trim();
    const amountRupees = parseFloat(root.querySelector("#exp-amount")?.value || "0");
    const expenseDate = root.querySelector("#exp-date")?.value;
    const description = root.querySelector("#exp-description")?.value?.trim() || "";

    if (!payee) { showToast("Payee is required", "amber"); return; }
    if (!amountRupees || amountRupees <= 0) { showToast("Enter a valid amount", "amber"); return; }
    if (!expenseDate) { showToast("Select a date", "amber"); return; }

    const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0];
    if (!cafeId) { showToast("No café assigned to your account", "coral"); return; }

    const submitBtn = root.querySelector("#expense-form-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";

    try {
      await apiPost("/expenses", {
        body: { category, payee, amountPaisa: Math.round(amountRupees * 100), expenseDate, description, cafeId },
      });
      if (overlay) overlay.style.display = "none";
      showToast("Expense saved as draft", "mint");
      await Promise.all([loadSummary(root), loadExpenses(root)]);
    } catch (err) {
      showToast(err.message || "Failed to save", "coral");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save as draft";
    }
  });
}
