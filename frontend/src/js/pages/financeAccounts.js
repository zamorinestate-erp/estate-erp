// =============================================================================
// PAGE: Finance & Accounts — API-wired version
// Reads P&L metrics from GET /api/v1/dashboard
// =============================================================================
import { apiGet } from "../apiClient.js";
import { kpiCard, skeleton } from "../components.js";

function fmtInr(paisa) {
  const r = Math.round((paisa || 0) / 100);
  return "₹" + r.toLocaleString("en-IN");
}

export function renderFinance() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Finance &amp; Accounts</div>
      <div class="muted-white" id="fin-subtitle" style="font-size:13.5px; margin-bottom:18px;">Consolidated financial summary</div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:18px;" id="fin-kpi-grid">
        ${skeleton("80px")}${skeleton("80px")}${skeleton("80px")}
      </div>

      <div class="glass" style="padding:22px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Day-wise P&amp;L breakdown</div>
        <div id="fin-pnl-wrap">${skeleton("200px")}</div>
      </div>
    </div>
  `;
}

export async function wireFinance(root) {
  const kpiGrid = root.querySelector("#fin-kpi-grid");
  const pnlWrap = root.querySelector("#fin-pnl-wrap");

  try {
    const res = await apiGet("/dashboard");
    const data = res?.data || {};

    const grossSalesPaisa = data.totalSalesTodayPaisa || 0;
    const expensePaisa = data.totalExpensesTodayPaisa || 0;
    const netProfitPaisa = grossSalesPaisa - expensePaisa;

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        ${kpiCard({ label: "Net profit today", value: fmtInr(netProfitPaisa), trend: "Live", trendType: netProfitPaisa >= 0 ? "up" : "down" })}
        ${kpiCard({ label: "Gross sales today", value: fmtInr(grossSalesPaisa), trend: `${data.todayBillCount || 0} bills`, trendType: "up" })}
        ${kpiCard({ label: "Expenses today", value: fmtInr(expensePaisa), trend: "Logged today", trendType: "neutral" })}
      `;
    }

    if (pnlWrap) {
      const pnlRows = [
        ["Gross sales", fmtInr(grossSalesPaisa)],
        ["Expenses logged", `-${fmtInr(expensePaisa)}`],
        ["Net profit today", fmtInr(netProfitPaisa)],
      ];

      pnlWrap.innerHTML = `
        <table class="glass-table">
          <tbody>
            ${pnlRows.map(
              ([label, val], i) => `
              <tr>
                <td style="${i === pnlRows.length - 1 ? "font-weight:700;color:var(--color-accent-mint-bright);" : ""}">${label}</td>
                <td style="text-align:right; ${i === pnlRows.length - 1 ? "font-weight:700;color:var(--color-accent-mint-bright);" : ""}">${val}</td>
              </tr>`
            ).join("")}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    if (pnlWrap) {
      pnlWrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load financial breakdown — ${err.message || "error"}.</div>`;
    }
  }
}
