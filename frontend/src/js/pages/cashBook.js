// =============================================================================
// PAGE: Sales & Cash / Cash Book — API-wired version
// Reads cash summary from GET /api/v1/cash-transactions/summary
// Lists today's cash entries from GET /api/v1/cash-transactions
// =============================================================================
import { showToast, confirmAction, skeleton } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";
import { state } from "../state.js";

const DENOMS = [500, 200, 100, 50, 20, 10];
let counts = {};
let expectedClosingCash = 0;

function fmtInr(paisa) {
  const r = Math.round((paisa || 0) / 100);
  return "₹" + r.toLocaleString("en-IN");
}

export function renderCashBook() {
  counts = {};
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || "CAFE-0001";

  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Sales &amp; Cash</div>
      <div class="muted-white" id="cash-subtitle" style="font-size:13.5px; margin-bottom:18px;">${cafeId} · Loading cash session…</div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Today's cash entries</div>
          <div id="cash-summary-table">${skeleton("160px")}</div>
        </div>

        <div class="glass" style="padding:22px;">
          <div class="flex justify-between items-center" style="margin-bottom:14px;">
            <div style="color:#fff; font-weight:600; font-size:15px;">Count drawer &amp; close session</div>
            <button class="btn btn-primary" id="close-session-btn" style="padding:9px 16px; font-size:13px;">Close session</button>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:16px;">
            ${DENOMS.map(
              (d) => `
              <div>
                <div class="muted-white" style="font-size:11px; margin-bottom:4px;">₹${d} notes</div>
                <input type="number" min="0" data-denom="${d}" placeholder="0" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; font-size:13px;" />
              </div>`
            ).join("")}
          </div>
          <div class="flex justify-between" style="border-top:1px solid rgba(255,255,255,0.18); padding-top:12px;">
            <div class="muted-white" style="font-size:13px;">Counted total</div>
            <div id="counted-total" style="color:#fff; font-weight:700; font-size:17px;">₹0</div>
          </div>
          <div class="flex justify-between" style="margin-top:6px;">
            <div class="muted-white" style="font-size:13px;">Variance</div>
            <div id="variance-total" style="font-weight:600; font-size:13px; color:rgba(255,255,255,0.5);">—</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function wireCashBook(root) {
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || "CAFE-0001";
  const summaryWrap = root.querySelector("#cash-summary-table");
  const subtitle = root.querySelector("#cash-subtitle");

  try {
    const res = await apiGet(`/cash-transactions/summary?cafeId=${cafeId}`);
    const summary = res?.data || {};

    const openingPaisa = summary.openingBalancePaisa || 0;
    const salesPaisa = summary.totalInflowPaisa || 0;
    const payoutPaisa = summary.totalOutflowPaisa || 0;
    const closingPaisa = summary.netCashPaisa || (openingPaisa + salesPaisa - payoutPaisa);
    expectedClosingCash = Math.round(closingPaisa / 100);

    if (subtitle) {
      subtitle.textContent = `${cafeId} · Session active`;
    }

    if (summaryWrap) {
      summaryWrap.innerHTML = `
        <table class="glass-table">
          <tbody>
            <tr><td>Opening balance</td><td style="text-align:right;">${fmtInr(openingPaisa)}</td></tr>
            <tr><td>Cash sales</td><td style="text-align:right; color:var(--color-accent-mint-bright);">+${fmtInr(salesPaisa)}</td></tr>
            <tr><td>Paid out</td><td style="text-align:right; color:#FF9E8F;">-${fmtInr(payoutPaisa)}</td></tr>
            <tr><td style="font-weight:700;">Expected closing cash</td><td style="text-align:right; font-weight:700;">${fmtInr(closingPaisa)}</td></tr>
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    if (summaryWrap) {
      summaryWrap.innerHTML = `<div class="muted-white" style="padding:12px;">Failed to load cash summary — ${err.message || "error"}.</div>`;
    }
  }

  root.querySelectorAll("[data-denom]").forEach((input) => {
    input.addEventListener("input", () => {
      const val = Number(input.dataset.denom);
      counts[val] = Number(input.value) || 0;
      const total = Object.entries(counts).reduce((s, [denom, qty]) => s + Number(denom) * qty, 0);
      root.querySelector("#counted-total").textContent = `₹${total.toLocaleString("en-IN")}`;
      const variance = total - expectedClosingCash;
      const vEl = root.querySelector("#variance-total");
      vEl.textContent = (variance > 0 ? "+" : "") + `₹${variance}`;
      vEl.style.color = variance === 0 ? "var(--color-accent-mint-bright)" : Math.abs(variance) > 200 ? "#FF9E8F" : "#FFD98A";
    });
  });

  root.querySelector("#close-session-btn")?.addEventListener("click", () => {
    const total = Object.entries(counts).reduce((s, [denom, qty]) => s + Number(denom) * qty, 0);
    const variance = total - expectedClosingCash;
    confirmAction({
      title: "Close today's cash session?",
      description: Math.abs(variance) > 200
        ? `Variance is ₹${variance} — above threshold. Closing will record a variance alert.`
        : `Counted ₹${total.toLocaleString("en-IN")} against an expected ₹${expectedClosingCash.toLocaleString("en-IN")}.`,
      confirmLabel: "Close session",
      onConfirm: async () => {
        const critical = Math.abs(variance) > 200;
        try {
          await apiPost("/cash-transactions", {
            body: {
              cafeId,
              transactionType: "CLOSE_DRAWER",
              category: "SESSION_CLOSE",
              amountPaisa: Math.round(total * 100),
              description: `Session closed with counted ₹${total} (expected ₹${expectedClosingCash}, variance ₹${variance})`,
            },
          });
          showToast(critical ? "Session closed — variance reported" : "Session closed and logged", critical ? "amber" : "mint");
        } catch (err) {
          showToast(err.message || "Failed to log session close", "coral");
        }
      },
    });
  });
}
