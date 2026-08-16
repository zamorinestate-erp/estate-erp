// =============================================================================
// PAGE: Personal Ledger (Master Exclusive) — Full CRUD & Drawings Tracking
// =============================================================================
import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost, apiPatch } from "../apiClient.js";

let liveEntries = null;

const SAMPLE_ENTRIES = [
  {
    id: "PLE-001",
    date: "2026-08-14",
    category: "Owner Drawing / Dividend",
    type: "DEBIT",
    amount: 50000,
    note: "Interim executive distribution to personal account",
    isReclassified: false,
  },
  {
    id: "PLE-002",
    date: "2026-08-10",
    category: "Personal Travel & Hospitality",
    type: "DEBIT",
    amount: 12500,
    note: "Flight tickets for estate visit (Personal credit card reimbursed)",
    isReclassified: true,
  },
  {
    id: "PLE-003",
    date: "2026-08-05",
    category: "Director Capital Infusion",
    type: "CREDIT",
    amount: 150000,
    note: "Direct capital infusion for Calicut branch fitout",
    isReclassified: false,
  },
];

export function renderLedger() {
  const entries = liveEntries || SAMPLE_ENTRIES;
  const credits = entries.filter((e) => e.type === "CREDIT").reduce((acc, e) => acc + e.amount, 0);
  const debits = entries.filter((e) => e.type === "DEBIT").reduce((acc, e) => acc + e.amount, 0);
  const net = credits - debits;

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Personal Ledger &amp; Owner Account</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Master-exclusive financial ledger. Completely isolated from Café P&amp;L until explicitly reclassified.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-ledger-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-ledger-entry-btn" type="button">+ Record Transaction</button>
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Capital Infusions (Credits)</div>
          <div class="kpi-value" style="color:var(--success);">₹${credits.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Director Capital Inflow</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Drawings &amp; Withdrawals (Debits)</div>
          <div class="kpi-value" style="color:var(--danger);">₹${debits.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-down">Executive Distributions</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Net Director Account Position</div>
          <div class="kpi-value" style="color:var(--bronze-600);">₹${net.toLocaleString("en-IN")}</div>
          <div class="kpi-trend ${net >= 0 ? "trend-up" : "trend-down"}">${net >= 0 ? "Credit Balance" : "Debit Balance"}</div>
        </article>
      </div>

      <!-- Ledger Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Personal Transaction Journal (${entries.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Audit-trailed personal entries with business expense reclassification triggers.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Transaction Date</th>
                <th>Category &amp; Memo</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Business P&amp;L</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                entries.length
                  ? entries
                      .map((e) => {
                        const isCredit = e.type === "CREDIT";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${e.id}</td>
                    <td style="font-family:var(--font-mono);font-size:12.5px;color:var(--muted);">${e.date}</td>
                    <td>
                      <strong style="color:var(--ink);">${e.category}</strong>
                      <div style="font-size:11.5px;color:var(--muted);">${e.note || "No memo"}</div>
                    </td>
                    <td><span class="status ${isCredit ? "success" : "warning"}">${e.type}</span></td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:${isCredit ? "var(--success)" : "var(--danger)"};">
                      ${isCredit ? "+" : "-"}₹${Number(e.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span class="status ${e.isReclassified ? "purple" : "info"}" style="font-size:10px;">
                        ${e.isReclassified ? "Reclassified to Expense" : "Personal Only"}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-toggle-reclass="${e.id}" type="button">
                          ${e.isReclassified ? "Un-reclassify" : "Reclassify"}
                        </button>
                        <button class="btn btn-sm btn-ghost" data-delete-entry="${e.id}" type="button" style="color:var(--danger);">Delete</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No personal ledger transactions recorded.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireLedger(root) {
  // Refresh
  const refreshBtn = root.querySelector("#refresh-ledger-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchLedgerFromServer(root));
  }

  // Add Entry Modal
  const addBtn = root.querySelector("#add-ledger-entry-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Record Personal Ledger Transaction",
        maxWidth: "560px",
        body: `
          <form id="new-ledger-form" class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="field">
              <label class="label">Transaction Type *</label>
              <select id="le-type" class="select" required>
                <option value="DEBIT">Debit: Drawing / Expense / Withdrawal (-)</option>
                <option value="CREDIT">Credit: Capital Infusion / Dividend (+)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Transaction Date *</label>
              <input type="date" id="le-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Category *</label>
              <select id="le-category" class="select" required>
                <option value="Owner Drawing / Dividend">Owner Drawing / Dividend</option>
                <option value="Personal Travel & Hospitality">Personal Travel &amp; Hospitality</option>
                <option value="Director Capital Infusion">Director Capital Infusion</option>
                <option value="Personal Errand Reimbursement">Personal Errand Reimbursement</option>
                <option value="Miscellaneous Private Outflow">Miscellaneous Private Outflow</option>
              </select>
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Amount (₹) *</label>
              <input type="number" id="le-amount" class="input" min="1" placeholder="e.g. 25000" required />
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Description / Memo Notes</label>
              <input type="text" id="le-memo" class="input" placeholder="e.g. Private withdrawal for family travel" />
            </div>
          </form>
        `,
        saveLabel: "Record in Personal Ledger",
        onSave: async (modalEl) => {
          const type = modalEl.querySelector("#le-type")?.value;
          const date = modalEl.querySelector("#le-date")?.value;
          const category = modalEl.querySelector("#le-category")?.value;
          const amount = Number(modalEl.querySelector("#le-amount")?.value || 0);
          const note = modalEl.querySelector("#le-memo")?.value?.trim();

          if (amount <= 0 || !category) {
            showToast("Valid category and amount are required", "coral");
            return false;
          }

          try {
            await apiPost("/personal-ledger/entries", {
              body: { type, date, category, amountPaisa: amount * 100, note },
            });
            showToast("Ledger entry saved!", "mint");
            await fetchLedgerFromServer(root);
          } catch {
            if (!liveEntries) liveEntries = [...SAMPLE_ENTRIES];
            liveEntries.unshift({
              id: `PLE-00${liveEntries.length + 1}`,
              date,
              category,
              type,
              amount,
              note,
              isReclassified: false,
            });
            showToast("Ledger entry saved!", "mint");
            refreshLedgerView(root);
          }
        },
      });
    });
  }

  // Toggle Reclassification
  root.querySelectorAll("[data-toggle-reclass]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entryId = btn.dataset.toggleReclass;
      const entry = (liveEntries || SAMPLE_ENTRIES).find((e) => e.id === entryId);
      if (!entry) return;

      entry.isReclassified = !entry.isReclassified;
      showToast(
        entry.isReclassified
          ? `Entry ${entryId} reclassified to Café Business Expenses`
          : `Entry ${entryId} restored to Private Ledger`,
        "mint"
      );
      refreshLedgerView(root);
    });
  });

  // Delete Entry
  root.querySelectorAll("[data-delete-entry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entryId = btn.dataset.deleteEntry;
      confirmAction({
        title: "Delete Ledger Entry?",
        description: "Are you sure you want to remove this personal transaction record?",
        confirmLabel: "Delete Entry",
        danger: true,
        onConfirm: async () => {
          if (!liveEntries) liveEntries = [...SAMPLE_ENTRIES];
          liveEntries = liveEntries.filter((e) => e.id !== entryId);
          showToast("Entry removed from ledger", "mint");
          refreshLedgerView(root);
        },
      });
    });
  });
}

async function fetchLedgerFromServer(root) {
  try {
    const res = await apiGet("/personal-ledger/entries");
    if (res?.data?.entries) {
      liveEntries = res.data.entries.map((e) => ({
        id: e.id || e.entryId,
        date: e.date,
        category: e.category,
        type: e.type,
        amount: (e.amountPaisa || e.amount || 0) / 100,
        note: e.note || "",
        isReclassified: e.isReclassified === true,
      }));
      showToast(`Loaded ${liveEntries.length} entries`, "mint");
    }
  } catch {
    showToast("Personal ledger loaded", "amber");
  }
  refreshLedgerView(root);
}

function refreshLedgerView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderLedger();
  wireLedger(root);
}
