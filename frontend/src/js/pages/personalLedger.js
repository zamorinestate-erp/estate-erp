// =============================================================================
// PAGE: Personal Ledger — MASTER ONLY — API-wired version
//
// ABSOLUTE RESTRICTION: MASTER ONLY
// (backend/src/middleware/authorize.js → ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER)
//
// All data is fetched from GET /api/v1/personal-ledger and
// GET /api/v1/personal-ledger/balance. No sample data anywhere.
// =============================================================================
import { showToast, confirmAction, skeleton } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";

let _ledgerPage = 1;
let _hasMore = false;

function fmtInr(paisa) {
  if (typeof paisa !== "number") return "₹0";
  const r = paisa / 100;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function entryRow(e) {
  const isCredit = e.entryType === "CREDIT";
  const statusPill = e.status === "ACTIVE"
    ? `<span class="pill pill-mint" style="font-size:10px;">ACTIVE</span>`
    : `<span class="pill pill-coral" style="font-size:10px;">REVERSED</span>`;
  return `
    <tr data-entry-id="${e.ledgerEntryId}">
      <td>${e.ledgerEntryId}</td>
      <td>${e.category || "—"}</td>
      <td>${e.description || "—"}</td>
      <td style="color:${isCredit ? "var(--color-accent-mint-bright)" : "#FF9E8F"}; font-weight:600;">
        ${isCredit ? "+" : "−"}${fmtInr(e.amountPaisa)}
      </td>
      <td>${e.entryDate || "—"}</td>
      <td>${statusPill}</td>
      <td>
        ${e.status === "ACTIVE" ? `<button class="btn btn-ghost" style="padding:5px 12px; font-size:11.5px;" data-reverse="${e.ledgerEntryId}">Reverse</button>` : "—"}
      </td>
    </tr>`;
}

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

      <div id="ledger-balance-strip" style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:18px;">
        ${skeleton("80px")}${skeleton("80px")}${skeleton("80px")}
      </div>

      <div class="glass" style="padding:20px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">All entries</div>
        <div id="ledger-table-wrap">${skeleton("200px")}</div>
      </div>
    </div>

    <!-- New entry dialog -->
    <div id="ledger-form-overlay" class="dialog-overlay" style="display:none;">
      <div class="glass-dark dialog-box" style="width:440px;">
        <h3>New Ledger Entry</h3>
        <div class="flex-col gap-md" style="margin-bottom:18px;">
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Type</label>
            <select id="le-type" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;">
              <option value="CREDIT">Credit (income / receipt)</option>
              <option value="DEBIT">Debit (expense / payment)</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Category</label>
            <select id="le-category" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;">
              <option value="SALARY">Salary</option>
              <option value="BONUS">Bonus</option>
              <option value="DIVIDEND">Dividend</option>
              <option value="REIMBURSEMENT">Reimbursement</option>
              <option value="PERSONAL_EXPENSE">Personal Expense</option>
              <option value="INVESTMENT">Investment</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Amount (₹)</label>
            <input type="number" id="le-amount" min="1" step="1" placeholder="0" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Date</label>
            <input type="date" id="le-date" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12px; color:rgba(255,255,255,0.65);">Description</label>
            <input type="text" id="le-description" maxlength="300" placeholder="Brief note…" style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; margin-top:4px;" />
          </div>
        </div>
        <div class="flex gap-sm" style="justify-content:flex-end;">
          <button class="btn btn-ghost" id="ledger-form-cancel">Cancel</button>
          <button class="btn btn-primary" id="ledger-form-submit">Save entry</button>
        </div>
      </div>
    </div>
  `;
}

export async function wireLedger(root) {
  await Promise.all([loadBalance(root), loadEntries(root)]);
  bindLedgerActions(root);
}

async function loadBalance(root) {
  try {
    const res = await apiGet("/personal-ledger/balance");
    const b = res?.data || {};
    const strip = root.querySelector("#ledger-balance-strip");
    if (strip) {
      strip.innerHTML = `
        <div class="glass kpi-card"><div class="kpi-label">Total Credits</div><div class="kpi-value" style="color:var(--color-accent-mint-bright);">${fmtInr(b.totalCreditPaisa || 0)}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Total Debits</div><div class="kpi-value" style="color:#FF9E8F;">${fmtInr(b.totalDebitPaisa || 0)}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Net Balance</div><div class="kpi-value">${fmtInr(b.netBalancePaisa || 0)}</div></div>
      `;
    }
  } catch {
    const strip = root.querySelector("#ledger-balance-strip");
    if (strip) strip.innerHTML = `<div class="glass" style="grid-column:1/-1;padding:12px;color:rgba(255,255,255,0.5);font-size:13px;">Balance unavailable</div>`;
  }
}

async function loadEntries(root, page = 1) {
  try {
    const res = await apiGet(`/personal-ledger?page=${page}&limit=25`);
    const entries = res?.data?.entries || [];
    const pagination = res?.data?.pagination || {};
    _ledgerPage = page;
    _hasMore = page < (pagination.totalPages || 1);

    const wrap = root.querySelector("#ledger-table-wrap");
    if (!wrap) return;

    if (entries.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No ledger entries yet</div><div>Create your first entry using the button above.</div></div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="glass-table">
        <thead><tr><th>ID</th><th>Category</th><th>Description</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${entries.map(entryRow).join("")}</tbody>
      </table>
      ${_hasMore ? `<button class="btn btn-ghost" id="ledger-load-more" style="margin-top:12px; width:100%;">Load more</button>` : ""}
    `;

    const moreBtn = root.querySelector("#ledger-load-more");
    if (moreBtn) moreBtn.addEventListener("click", () => loadEntries(root, _ledgerPage + 1));

    root.querySelectorAll("[data-reverse]").forEach((btn) => {
      btn.addEventListener("click", () => handleReverse(root, btn.dataset.reverse));
    });
  } catch (err) {
    const wrap = root.querySelector("#ledger-table-wrap");
    if (wrap) wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load entries — ${err.message}</div>`;
  }
}

async function handleReverse(root, ledgerEntryId) {
  confirmAction({
    title: "Reverse this entry?",
    description: "A reversing entry will be posted. The original entry is preserved and marked REVERSED. This cannot be undone.",
    confirmLabel: "Post reversal",
    onConfirm: async () => {
      try {
        await apiPost(`/personal-ledger/${ledgerEntryId}/reverse`, {
          body: { reason: "Manual reversal by Master" },
        });
        showToast("Reversal posted successfully", "mint");
        await Promise.all([loadBalance(root), loadEntries(root)]);
      } catch (err) {
        showToast(err.message || "Reversal failed", "coral");
      }
    },
  });
}

function bindLedgerActions(root) {
  const addBtn = root.querySelector("#add-entry-btn");
  const overlay = root.querySelector("#ledger-form-overlay");
  const cancelBtn = root.querySelector("#ledger-form-cancel");
  const submitBtn = root.querySelector("#ledger-form-submit");

  if (addBtn && overlay) {
    addBtn.addEventListener("click", () => {
      overlay.style.display = "flex";
      const dateInput = root.querySelector("#le-date");
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    });
  }

  if (cancelBtn && overlay) {
    cancelBtn.addEventListener("click", () => { overlay.style.display = "none"; });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const entryType = root.querySelector("#le-type")?.value;
      const category = root.querySelector("#le-category")?.value;
      const amountRupees = parseFloat(root.querySelector("#le-amount")?.value || "0");
      const entryDate = root.querySelector("#le-date")?.value;
      const description = root.querySelector("#le-description")?.value?.trim() || "";

      if (!amountRupees || amountRupees <= 0) {
        showToast("Please enter a valid amount", "amber");
        return;
      }
      if (!entryDate) {
        showToast("Please select a date", "amber");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      try {
        await apiPost("/personal-ledger", {
          body: {
            entryType,
            category,
            amountPaisa: Math.round(amountRupees * 100),
            entryDate,
            description,
          },
        });
        overlay.style.display = "none";
        showToast("Entry saved to Personal Ledger", "mint");
        await Promise.all([loadBalance(root), loadEntries(root)]);
      } catch (err) {
        showToast(err.message || "Failed to save entry", "coral");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save entry";
      }
    });
  }
}
