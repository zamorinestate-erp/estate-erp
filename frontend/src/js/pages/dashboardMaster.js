// =============================================================================
// PAGE: Master / Owner Command Centre — API-wired version
//
// Hydrates live metrics from GET /api/v1/dashboard.
// KPI cards show real MongoDB aggregations (bills, approvals, stock, tasks).
// Chart remains SVG placeholder (no charting library dependency).
// =============================================================================
import { kpiCard, skeleton } from "../components.js";
import { apiGet } from "../apiClient.js";

function fmtInr(paisa) {
  const rupees = Math.round(paisa / 100);
  if (rupees >= 100000) return "₹" + (rupees / 100000).toFixed(2) + "L";
  if (rupees >= 1000)   return "₹" + (rupees / 1000).toFixed(1) + "K";
  return "₹" + rupees.toLocaleString("en-IN");
}

export function renderMasterDashboard({ roleLabel = "Master" } = {}) {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Good morning, ${roleLabel}</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Loading today's live metrics…</div>

      <div id="kpi-grid" style="display:grid; grid-template-columns: repeat(5, 1fr); gap:16px; margin-bottom:18px;">
        ${skeleton("90px")}${skeleton("90px")}${skeleton("90px")}${skeleton("90px")}${skeleton("90px")}
      </div>

      <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:16px;">
        <div class="glass" style="padding:22px;">
          <div class="flex justify-between items-center" style="margin-bottom:14px;">
            <div style="color:#fff; font-weight:600; font-size:15px;">Day-wise P&amp;L — trailing 14 days</div>
            <div class="pill pill-mint">All cafes</div>
          </div>
          <svg viewBox="0 0 620 210" style="width:100%; height:210px;">
            <polyline points="0,150 44,140 88,120 132,135 176,95 220,110 264,80 308,90 352,60 396,75 440,50 484,65 528,40 572,55" fill="none" stroke="var(--color-accent-mint-bright)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="0,180 44,175 88,178 132,165 176,170 220,155 264,160 308,150 352,152 396,140 440,145 484,130 528,132 572,120" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>
          </svg>
          <div class="flex gap-md" style="margin-top:6px;">
            <div class="flex items-center gap-sm muted-white" style="font-size:12px;"><span style="width:10px;height:10px;border-radius:3px;background:var(--color-accent-mint-bright);display:inline-block;"></span> Net profit</div>
            <div class="flex items-center gap-sm muted-white" style="font-size:12px;"><span style="width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,0.55);display:inline-block;"></span> Forecast</div>
          </div>
        </div>

        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Needs your attention</div>
          <div id="attention-feed">${skeleton("220px")}</div>
        </div>
      </div>
    </div>
  `;
}

export async function hydrateMasterDashboard(root) {
  try {
    const res = await apiGet("/dashboard");
    const m = res?.data?.metrics || {};

    const kpiGrid = root.querySelector("#kpi-grid");
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        ${kpiCard({ label: "Net sales today",         value: fmtInr(m.totalSalesPaisa || 0),       trend: `${m.totalBillsCount || 0} bills`,          trendType: "up" })}
        ${kpiCard({ label: "Open approvals",          value: String(m.pendingApprovalsCount || 0),  trend: m.pendingApprovalsCount > 0 ? "awaiting you" : "all clear", trendType: m.pendingApprovalsCount > 0 ? "down" : "up" })}
        ${kpiCard({ label: "Pending tasks",           value: String(m.pendingTasksCount || 0),       trend: "in progress",                              trendType: "neutral" })}
        ${kpiCard({ label: "Low stock alerts",        value: String(m.lowStockCount || 0),           trend: m.lowStockCount > 0 ? "need restock" : "well stocked",   trendType: m.lowStockCount > 0 ? "down" : "up" })}
        ${kpiCard({ label: "Active cafes",            value: String(m.activeCafesCount || 0),        trend: "in network",                               trendType: "neutral" })}
      `;
    }

    // Build attention feed from live counts
    const attentionFeed = root.querySelector("#attention-feed");
    if (attentionFeed) {
      const items = [];
      if (m.pendingApprovalsCount > 0) {
        items.push(`<div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-coral" style="padding:5px 9px;">!</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">${m.pendingApprovalsCount} open approval${m.pendingApprovalsCount > 1 ? "s" : ""}</span><br/><span class="muted-white">Awaiting your decision</span></div>
        </div>`);
      }
      if (m.lowStockCount > 0) {
        items.push(`<div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-amber" style="padding:5px 9px;">i</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">${m.lowStockCount} low-stock item${m.lowStockCount > 1 ? "s" : ""}</span><br/><span class="muted-white">Below reorder level — procurement needed</span></div>
        </div>`);
      }
      if (m.pendingTasksCount > 0) {
        items.push(`<div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-mint" style="padding:5px 9px;">✓</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">${m.pendingTasksCount} pending task${m.pendingTasksCount > 1 ? "s" : ""}</span><br/><span class="muted-white">Assigned across cafes</span></div>
        </div>`);
      }
      if (items.length === 0) {
        items.push(`<div class="empty-state" style="padding:16px 0;"><div class="empty-state-title" style="font-size:14px;">All clear</div><div>No urgent items need attention right now.</div></div>`);
      }
      attentionFeed.innerHTML = `<div class="flex-col gap-md">${items.join("")}</div>`;
    }

    // Update subtitle
    const subtitle = root.querySelector(".muted-white");
    if (subtitle) {
      subtitle.textContent = `Live metrics for ${res?.data?.businessDate || "today"} · ${m.activeCafesCount || 0} cafes in network`;
    }
  } catch (err) {
    const kpiGrid = root.querySelector("#kpi-grid");
    if (kpiGrid) {
      kpiGrid.innerHTML = `<div class="glass" style="grid-column:1/-1; padding:16px; color:rgba(255,255,255,0.6); font-size:13px;">Unable to load live metrics — ${err.message || "network error"}. Data will refresh on next navigation.</div>`;
    }
  }
}
