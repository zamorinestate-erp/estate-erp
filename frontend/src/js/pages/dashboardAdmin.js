// =============================================================================
// PAGE: Cafe Admin Command Centre (Part D of the guideline)
// Deliberately smaller than Master's — no cafe selector, no cross-cafe data,
// anywhere, in any widget.
// =============================================================================
import { kpiCard } from "../components.js";

export function renderAdminDashboard() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Good morning, Ravi</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Dawn Roast — Koramangala, only. Nothing from other cafes shows here.</div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom:18px;">
        ${kpiCard({ label: "Today's sales", value: "₹28,400", trend: "5.1% vs yesterday", trendType: "up" })}
        ${kpiCard({ label: "Cash session", value: "Open", trend: "Since 8:02 AM", trendType: "up" })}
        ${kpiCard({ label: "Low stock items", value: "3", trend: "Milk, oat milk, cups", trendType: "down" })}
        ${kpiCard({ label: "Attendance today", value: "9 / 10", trend: "1 late arrival", trendType: "down" })}
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
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Manager logbook — today</div>
          <div class="flex-col gap-md">
            <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">7:58 AM</span><br/><span class="muted-white">Opening checklist completed, milk delivery short by 2 crates</span></div>
            <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">11:20 AM</span><br/><span class="muted-white">Espresso machine 2 serviced, back online</span></div>
            <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">1:05 PM</span><br/><span class="muted-white">Priya covering Anjali's shift 2-6 PM, swap approved</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
