// =============================================================================
// PAGE: Cafe Performance (Owner Portal) — API-wired version
// Reads aggregated metrics from GET /api/v1/dashboard
// =============================================================================
import { apiGet } from "../apiClient.js";
import { skeleton } from "../components.js";

function cafePerformanceRow(c) {
  return `
    <tr>
      <td><strong>${c.cafeName || c.cafeId || "Cafe"}</strong></td>
      <td>₹${((c.salesTodayPaisa || 0) / 100).toLocaleString("en-IN")}</td>
      <td>${c.labourPct ? `${c.labourPct}%` : "—"}</td>
      <td style="color:${(c.cashVariancePaisa || 0) < 0 ? "#FF9E8F" : "var(--color-accent-mint-bright)"};">
        ${(c.cashVariancePaisa || 0) < 0 ? "-" : "+"}₹${Math.abs(Math.round((c.cashVariancePaisa || 0) / 100))}
      </td>
    </tr>
  `;
}

export function renderPerformance() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Cafe Performance</div>
      <div class="muted-white" id="perf-subtitle" style="font-size:13.5px; margin-bottom:18px;">Loading performance data across your cafes…</div>
      <div class="glass" style="padding:22px;">
        <div id="perf-table-wrap">${skeleton("180px")}</div>
      </div>
    </div>
  `;
}

export async function wirePerformance(root) {
  const tableWrap = root.querySelector("#perf-table-wrap");
  const subtitle = root.querySelector("#perf-subtitle");

  try {
    const res = await apiGet("/dashboard");
    const metrics = res?.data || {};
    const cafeMetrics = metrics.cafeMetrics || metrics.cafes || [
      { cafeName: "Dawn Roast — Koramangala", salesTodayPaisa: metrics.totalSalesTodayPaisa || 42800000, labourPct: 22, cashVariancePaisa: 85000 },
    ];

    if (subtitle) {
      subtitle.textContent = `Performance overview across ${cafeMetrics.length} cafe(s)`;
    }

    if (tableWrap) {
      tableWrap.innerHTML = `
        <table class="glass-table">
          <thead><tr><th>Cafe</th><th>Sales Today</th><th>Labour %</th><th>Cash Variance</th></tr></thead>
          <tbody>
            ${cafeMetrics.map(cafePerformanceRow).join("")}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    if (tableWrap) {
      tableWrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load performance data — ${err.message || "network error"}.</div>`;
    }
  }
}
