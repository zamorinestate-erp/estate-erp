// =============================================================================
// PAGE: Master / Owner Command Centre (Part C of the guideline)
// =============================================================================
import { kpiCard, skeleton } from "../components.js";

export function renderMasterDashboard({ roleLabel = "Master" } = {}) {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Good morning, ${roleLabel}</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Here is how all 18 cafes are performing today</div>

      <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:16px; margin-bottom:18px;">
        ${kpiCard({ label: "Net sales today", value: "₹4.82L", trend: "8.2% vs yesterday", trendType: "up", onClick: "open-sales-report" })}
        ${kpiCard({ label: "Cash variance", value: "₹1,240", trend: "2 cafes over limit", trendType: "down", onClick: "open-cash-book" })}
        ${kpiCard({ label: "Open approvals", value: "14", trend: "3 urgent", trendType: "up", onClick: "open-approvals" })}
        ${kpiCard({ label: "Low stock alerts", value: "7", trend: "across 4 cafes", trendType: "down", onClick: "open-inventory" })}
        ${kpiCard({ label: "Attendance exceptions", value: "5", trend: "improved", trendType: "up", onClick: "open-attendance" })}
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

        <div class="glass" style="padding:22px;" class="flex-col gap-md">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Needs your attention</div>
          <div id="attention-feed">${skeleton("220px")}</div>
        </div>
      </div>
    </div>
  `;
}

// Simulates progressive loading (Part H.4 — each widget loads independently,
// never one full-page spinner blocking everything).
export function hydrateMasterDashboard(root) {
  setTimeout(() => {
    const el = root.querySelector("#attention-feed");
    if (!el) return;
    el.innerHTML = `
      <div class="flex-col gap-md">
        <div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-coral" style="padding:5px 9px;">!</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">Cafe 07 — cash variance</span><br/><span class="muted-white">₹850 over threshold, awaiting approval</span></div>
        </div>
        <div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-amber" style="padding:5px 9px;">i</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">Vendor payment due</span><br/><span class="muted-white">Dawn Roast Suppliers — ₹42,000 in 2 days</span></div>
        </div>
        <div class="flex gap-sm" style="align-items:flex-start;">
          <div class="pill pill-mint" style="padding:5px 9px;">✓</div>
          <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">Payroll run ready</span><br/><span class="muted-white">Cafe 03 — ready for review</span></div>
        </div>
      </div>
    `;
  }, 350);
}
