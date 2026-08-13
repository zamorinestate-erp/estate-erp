// =============================================================================
// PAGE: Owner Bills & Receipts (Stage 7 — Dedicated Bill Inspection Page)
// GET /api/v1/bills — List & filter cafe bills for OWNER / MASTER
// =============================================================================
import { apiGet } from "../apiClient.js";
import { state } from "../state.js";
import { showToast } from "../components.js";

let _bills = [];

export function renderOwnerBills() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Bills &amp; Receipts</div>
          <div class="muted-white" style="font-size:13.5px;" id="bills-subtitle">Loading bills…</div>
        </div>
        <div class="flex gap-sm">
          <input type="date" id="bills-date-filter" class="input-field" style="font-size:12px; padding:6px 10px;" />
          <button class="btn btn-ghost" id="refresh-bills-btn" style="padding:8px 14px; font-size:12px;">Refresh</button>
        </div>
      </div>

      <div class="glass" style="padding:18px; margin-bottom:16px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:12px;" id="bills-kpis">
          <div><div class="kpi-label">TOTAL BILLS</div><div class="kpi-value" id="kpi-count">0</div></div>
          <div><div class="kpi-label">TOTAL REVENUE</div><div class="kpi-value" id="kpi-revenue">₹0.00</div></div>
          <div><div class="kpi-label">COMPLETED</div><div class="kpi-value" id="kpi-completed">0</div></div>
          <div><div class="kpi-label">VOIDED</div><div class="kpi-value" id="kpi-voided">0</div></div>
        </div>
      </div>

      <div class="glass" style="padding:20px;">
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;" id="bills-table">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.15);">
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:left;">BILL ID</th>
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:left;">DATE</th>
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:left;">TYPE</th>
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:left;">PAYMENT</th>
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:right;">AMOUNT</th>
                <th style="padding:8px 12px; color:rgba(255,255,255,0.6); font-size:11px; text-align:center;">STATUS</th>
              </tr>
            </thead>
            <tbody id="bills-rows">
              <tr><td colspan="6" style="padding:24px; text-align:center; color:rgba(255,255,255,0.6);">Loading transaction data…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export async function wireOwnerBills(root) {
  const dateInput = root.querySelector("#bills-date-filter");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
    dateInput.addEventListener("change", () => loadBills(root));
  }

  root.querySelector("#refresh-bills-btn")?.addEventListener("click", () => loadBills(root));

  await loadBills(root);
}

async function loadBills(root) {
  const dateVal = root.querySelector("#bills-date-filter")?.value;
  let url = "/bills";
  if (dateVal) url += `?date=${dateVal}`;

  try {
    const res = await apiGet(url);
    _bills = res?.data?.bills || res?.bills || [];
    renderBillsTable(root);
  } catch (err) {
    root.querySelector("#bills-rows").innerHTML = `
      <tr><td colspan="6" style="padding:24px; text-align:center; color:rgba(255,100,100,0.8);">Could not load bills: ${err?.message || "Unknown error"}</td></tr>`;
  }
}

function renderBillsTable(root) {
  const subtitle = root.querySelector("#bills-subtitle");
  if (subtitle) subtitle.textContent = `${_bills.length} bill records found`;

  let totalRevPaisa = 0;
  let completedCount = 0;
  let voidedCount = 0;

  _bills.forEach((b) => {
    if (b.status === "COMPLETED") {
      totalRevPaisa += b.totalPaisa || 0;
      completedCount += 1;
    } else if (b.status === "VOIDED") {
      voidedCount += 1;
    }
  });

  if (root.querySelector("#kpi-count")) root.querySelector("#kpi-count").textContent = String(_bills.length);
  if (root.querySelector("#kpi-revenue")) root.querySelector("#kpi-revenue").textContent = `₹${(totalRevPaisa / 100).toFixed(2)}`;
  if (root.querySelector("#kpi-completed")) root.querySelector("#kpi-completed").textContent = String(completedCount);
  if (root.querySelector("#kpi-voided")) root.querySelector("#kpi-voided").textContent = String(voidedCount);

  const tbody = root.querySelector("#bills-rows");
  if (!tbody) return;

  if (!_bills.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:24px; text-align:center; color:rgba(255,255,255,0.6);">No bills recorded for this date.</td></tr>`;
    return;
  }

  tbody.innerHTML = _bills.map((b) => {
    const pill = b.status === "COMPLETED" ? "pill-mint" : b.status === "VOIDED" ? "pill-coral" : "pill-amber";
    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <td style="padding:10px 12px; color:#fff; font-size:12.5px; font-weight:600;">${b.billId}</td>
        <td style="padding:10px 12px; color:rgba(255,255,255,0.7); font-size:12px;">${b.businessDate || "—"}</td>
        <td style="padding:10px 12px; color:rgba(255,255,255,0.7); font-size:12px;">${b.orderType || "DINE_IN"}</td>
        <td style="padding:10px 12px; color:rgba(255,255,255,0.7); font-size:12px;">${b.paymentMethod || "CASH"}</td>
        <td style="padding:10px 12px; color:#fff; font-size:13px; text-align:right; font-weight:600;">₹${((b.totalPaisa || 0) / 100).toFixed(2)}</td>
        <td style="padding:10px 12px; text-align:center;"><div class="pill ${pill}" style="padding:2px 8px; font-size:10px; display:inline-flex;">${b.status}</div></td>
      </tr>`;
  }).join("");
}
