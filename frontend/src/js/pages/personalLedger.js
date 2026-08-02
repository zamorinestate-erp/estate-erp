// PAGE: Personal Ledger (Master-only, Section 22.9 / Part G.20)
import { showToast, confirmAction } from "../components.js";

let entries = [
  { date: "18 Jul", category: "Personal transfer", amount: 12000, note: "To personal savings" },
  { date: "12 Jul", category: "Reimbursement", amount: -3200, note: "Business cash used for personal errand" },
  { date: "02 Jul", category: "Personal spend", amount: 5400, note: "Family expense, restricted withdrawal linked" },
];

export function renderLedger() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Personal Ledger</div>
          <div class="muted-white" style="font-size:13.5px;">Visible only to you. Never shared with Owner, Cafe Admin, or Staff.</div>
        </div>
        <button class="btn btn-primary" id="add-entry-btn">+ New entry</button>
      </div>

      <div class="glass" style="padding:22px;">
        <table class="glass-table" id="ledger-table">
          <thead><tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>${entries.map(rowHtml).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function rowHtml(e) {
  const color = e.amount < 0 ? "#FF9E8F" : "var(--color-accent-mint-bright)";
  const sign = e.amount < 0 ? "-" : "+";
  return `<tr><td>${e.date}</td><td>${e.category}</td><td class="muted-white">${e.note}</td><td style="text-align:right; color:${color}; font-weight:600;">${sign}₹${Math.abs(e.amount).toLocaleString("en-IN")}</td></tr>`;
}

export function wireLedger(root) {
  root.querySelector("#add-entry-btn").addEventListener("click", () => {
    confirmAction({
      title: "Add a Personal Ledger entry",
      description: "In the full build this opens a form (category, amount, payee, notes, attachment). This demo adds a sample entry so you can see it land in the ledger.",
      confirmLabel: "Add sample entry",
      onConfirm: () => {
        entries = [{ date: "Today", category: "Personal spend", amount: 1500, note: "Added from demo" }, ...entries];
        root.querySelector("#ledger-table tbody").innerHTML = entries.map(rowHtml).join("");
        showToast("Entry added to Personal Ledger", "mint");
      },
    });
  });
}
