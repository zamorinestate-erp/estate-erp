// =============================================================================
// PAGE: Cafe Admin Command Centre — API-wired version
// Scoped strictly to the authenticated admin's assigned cafes.
// Nothing from other cafes ever appears here.
// =============================================================================
import { kpiCard, skeleton } from "../components.js";
import { apiGet } from "../apiClient.js";
import { state } from "../state.js";

function fmtInr(paisa) {
  const r = Math.round(paisa / 100);
  if (r >= 100000) return "₹" + (r / 100000).toFixed(2) + "L";
  if (r >= 1000)   return "₹" + (r / 1000).toFixed(1) + "K";
  return "₹" + r.toLocaleString("en-IN");
}

export function renderAdminDashboard() {
  const name = state.auth?.user?.name || "Admin";
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Good morning, ${name}</div>
      <div class="muted-white" id="admin-dash-subtitle" style="font-size:13.5px; margin-bottom:18px;">Loading your café metrics…</div>

      <div id="admin-kpi-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:18px;">
        ${skeleton("90px")}${skeleton("90px")}${skeleton("90px")}${skeleton("90px")}
      </div>

      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:16px;">
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Sales by hour — today</div>
          <svg viewBox="0 0 600 200" style="width:100%; height:200px;">
            <g fill="var(--color-accent-mint-bright)">
              <rect x="10" y="150" width="24" height="50" rx="6"/><rect x="50" y="120" width="24" height="80" rx="6"/>
              <rect x="90" y="90" width="24" height="110" rx="6"/><rect x="130" y="60" width="24" height="140" rx="6"/>
              <rect x="170" y="40" width="24" height="160" rx="6"/><rect x="210" y="70" width="24" height="130" rx="6"/>
              <rect x="250" y="100" width="24" height="100" rx="6"/><rect x="290" y="50" width="24" height="150" rx="6"/>
              <rect x="330" y="30" width="24" height="170" rx="6"/><rect x="370" y="65" width="24" height="135" rx="6"/>
              <rect x="410" y="95" width="24" height="105" rx="6"/><rect x="450" y="120" width="24" height="80" rx="6"/>
              <rect x="490" y="140" width="24" height="60" rx="6"/><rect x="530" y="155" width="24" height="45" rx="6"/>
            </g>
          </svg>
        </div>
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Live alerts</div>
          <div id="admin-attention-feed">${skeleton("180px")}</div>
        </div>
      </div>
    </div>
  `;
}

export async function hydrateAdminDashboard(root) {
  try {
    const res = await apiGet("/dashboard");
    const m = res?.data?.metrics || {};

    const grid = root.querySelector("#admin-kpi-grid");
    if (grid) {
      grid.innerHTML = `
        ${kpiCard({ label: "Today's sales",     value: fmtInr(m.totalSalesPaisa || 0),       trend: `${m.totalBillsCount || 0} bills`,            trendType: "up" })}
        ${kpiCard({ label: "Low stock items",   value: String(m.lowStockCount || 0),           trend: m.lowStockCount > 0 ? "need restock" : "OK", trendType: m.lowStockCount > 0 ? "down" : "up" })}
        ${kpiCard({ label: "Pending approvals", value: String(m.pendingApprovalsCount || 0),   trend: "awaiting action",                            trendType: m.pendingApprovalsCount > 0 ? "down" : "up" })}
        ${kpiCard({ label: "Open tasks",        value: String(m.pendingTasksCount || 0),        trend: "in progress",                               trendType: "neutral" })}
      `;
    }

    const subtitle = root.querySelector("#admin-dash-subtitle");
    if (subtitle) {
      const cafe = state.auth?.user?.primaryCafeId || "your café";
      subtitle.textContent = `${cafe} · Live metrics for ${res?.data?.businessDate || "today"}`;
    }

    const feed = root.querySelector("#admin-attention-feed");
    if (feed) {
      const items = [];
      if (m.lowStockCount > 0) items.push(`<div style="font-size:12.5px; margin-bottom:10px;"><span style="color:#fff; font-weight:600;">${m.lowStockCount} low-stock item${m.lowStockCount > 1 ? "s" : ""}</span><br/><span class="muted-white">Check inventory and raise a purchase order</span></div>`);
      if (m.pendingApprovalsCount > 0) items.push(`<div style="font-size:12.5px; margin-bottom:10px;"><span style="color:#fff; font-weight:600;">${m.pendingApprovalsCount} pending approval${m.pendingApprovalsCount > 1 ? "s" : ""}</span><br/><span class="muted-white">Review and action from Tasks &amp; Approvals</span></div>`);
      if (items.length === 0) items.push(`<div class="muted-white" style="font-size:13px;">All clear — no alerts right now.</div>`);
      feed.innerHTML = items.join("");
    }
  } catch (err) {
    const grid = root.querySelector("#admin-kpi-grid");
    if (grid) grid.innerHTML = `<div class="glass" style="grid-column:1/-1; padding:16px; color:rgba(255,255,255,0.6); font-size:13px;">Could not load metrics — ${err.message || "network error"}.</div>`;
  }
}
