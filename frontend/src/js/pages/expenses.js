// =============================================================================
// PAGE: Expenses (Part G.5 of the guideline)
// List + a slide-over "New Expense" form (Part S.6 pattern — longer forms
// use a slide-over, not a full navigation away). Approve/Reject uses the
// same inline-card pattern as the Tasks & Approvals inbox (Part M.8).
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, confirmAction } from "../components.js";

let EXPENSES = [
  { id: "EX-0091", category: "Utilities", amount: 4200, payee: "BESCOM", date: "18 Jul", status: "Approved", cafe: "Dawn Roast" },
  { id: "EX-0092", category: "Repairs", amount: 1850, payee: "CoolTech AC Service", date: "19 Jul", status: "Submitted", cafe: "Dawn Roast" },
  { id: "EX-0093", category: "Supplies", amount: 620, payee: "Local Mart", date: "19 Jul", status: "Submitted", cafe: "Dawn Roast" },
  { id: "EX-0094", category: "Marketing", amount: 3000, payee: "Instagram Ads", date: "20 Jul", status: "Rejected", cafe: "Indiranagar" },
  { id: "EX-0095", category: "Utilities", amount: 3950, payee: "BESCOM", date: "20 Jul", status: "Approved", cafe: "Indiranagar" },
];

export function renderExpenses() {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const canApprove = state.role === ROLES.MASTER || isAdmin;
  const visible = isAdmin ? EXPENSES.filter((e) => e.cafe === "Dawn Roast") : EXPENSES;
  const pending = visible.filter((e) => e.status === "Submitted");

  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Expenses</div>
          <div class="muted-white" style="font-size:13.5px;">${isAdmin ? "Dawn Roast — Koramangala, only" : "All cafes"}</div>
        </div>
        <button class="btn btn-primary" id="new-expense-btn">+ New expense</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:18px;">
        <div class="glass kpi-card"><div class="kpi-label">This month</div><div class="kpi-value">₹${visible.reduce((s, e) => s + e.amount, 0).toLocaleString("en-IN")}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Awaiting approval</div><div class="kpi-value">${pending.length}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Rejected</div><div class="kpi-value">${visible.filter((e) => e.status === "Rejected").length}</div></div>
      </div>

      <div class="glass" style="padding:20px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">All expenses</div>
        <table class="glass-table">
          <thead><tr><th>ID</th><th>Category</th><th>Payee</th><th>Date</th><th>Amount</th><th>Status</th>${canApprove ? "<th>Action</th>" : ""}</tr></thead>
          <tbody id="expense-rows">${visible.map((e) => expenseRow(e, canApprove)).join("")}</tbody>
        </table>
      </div>
    </div>

    <div id="expense-form-overlay" class="dialog-overlay" style="display:none;">
      <div class="glass-dark dialog-box" style="width:440px;">
        <h3>New expense</h3>
        <div class="flex-col gap-md" style="margin-bottom:18px;">
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Category</label>
            <select id="exp-category" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;">
              <option>Utilities</option><option>Repairs</option><option>Supplies</option><option>Marketing</option><option>Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Amount (₹)</label>
            <input id="exp-amount" type="number" placeholder="0" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Payee</label>
            <input id="exp-payee" type="text" placeholder="Vendor or payee name" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;" />
          </div>
          <div class="glass" style="padding:14px; text-align:center; border-style:dashed;">
            <div class="muted-white" style="font-size:12px;">📎 Receipt upload (required above ₹1,000)</div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" id="exp-cancel">Cancel</button>
          <button class="btn btn-primary" id="exp-submit">Submit for approval</button>
        </div>
      </div>
    </div>
  `;
}

function expenseRow(e, canApprove) {
  const statusPill = { Approved: "pill-mint", Submitted: "pill-amber", Rejected: "pill-coral" }[e.status];
  const action =
    canApprove && e.status === "Submitted"
      ? `<button class="btn btn-ghost" data-approve="${e.id}" style="padding:6px 12px; font-size:12px;">Approve</button> <button class="btn btn-ghost" data-reject="${e.id}" style="padding:6px 12px; font-size:12px; margin-left:6px;">Reject</button>`
      : "";
  return `
    <tr data-expense-row="${e.id}">
      <td>${e.id}</td><td>${e.category}</td><td>${e.payee}</td><td>${e.date}</td>
      <td>₹${e.amount.toLocaleString("en-IN")}</td>
      <td><span class="pill ${statusPill}" data-status-pill="${e.id}">${e.status}</span></td>
      ${canApprove ? `<td>${action}</td>` : ""}
    </tr>
  `;
}

export function wireExpenses(root) {
  const overlay = root.querySelector("#expense-form-overlay") || document.getElementById("expense-form-overlay");
  root.querySelector("#new-expense-btn").addEventListener("click", () => (overlay.style.display = "flex"));
  root.querySelector("#exp-cancel").addEventListener("click", () => (overlay.style.display = "none"));

  root.querySelector("#exp-submit").addEventListener("click", () => {
    const category = root.querySelector("#exp-category").value;
    const amount = Number(root.querySelector("#exp-amount").value || 0);
    const payee = root.querySelector("#exp-payee").value.trim();
    if (!amount || !payee) {
      showToast("Amount and payee are required", "amber");
      return;
    }
    const id = `EX-${String(90 + EXPENSES.length + 1).padStart(4, "0")}`;
    EXPENSES.unshift({ id, category, amount, payee, date: "Today", status: "Submitted", cafe: "Dawn Roast" });
    overlay.style.display = "none";
    showToast(`Expense ${id} submitted for approval`, "mint");
    refreshTable(root);
  });

  wireApprovalButtons(root);
}

function wireApprovalButtons(root) {
  root.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.approve;
      const exp = EXPENSES.find((e) => e.id === id);
      confirmAction({
        title: `Approve ${id} — ₹${exp.amount.toLocaleString("en-IN")}?`,
        description: `${exp.payee}, ${exp.category}, submitted ${exp.date}.`,
        confirmLabel: "Approve",
        onConfirm: () => {
          exp.status = "Approved";
          showToast(`${id} approved`, "mint");
          refreshTable(root);
        },
      });
    });
  });
  root.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.reject;
      const exp = EXPENSES.find((e) => e.id === id);
      confirmAction({
        title: `Reject ${id} — ₹${exp.amount.toLocaleString("en-IN")}?`,
        description: `${exp.payee}, ${exp.category}. This will notify the submitter.`,
        confirmLabel: "Reject",
        onConfirm: () => {
          exp.status = "Rejected";
          showToast(`${id} rejected`, "coral");
          refreshTable(root);
        },
      });
    });
  });
}

function refreshTable(root) {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const canApprove = state.role === ROLES.MASTER || isAdmin;
  const visible = isAdmin ? EXPENSES.filter((e) => e.cafe === "Dawn Roast") : EXPENSES;
  root.querySelector("#expense-rows").innerHTML = visible.map((e) => expenseRow(e, canApprove)).join("");
  wireApprovalButtons(root);
}
