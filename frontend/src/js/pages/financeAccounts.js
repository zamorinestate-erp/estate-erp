// PAGE: Finance & Accounts (Part G.4)
import { kpiCard } from "../components.js";

const PNL_ROWS = [
  ["Gross sales", "₹4,82,000"],
  ["Discounts & refunds", "-₹9,400"],
  ["Net revenue", "₹4,72,600"],
  ["Cost of goods sold", "-₹1,41,780"],
  ["Salary (day-wise allocation)", "-₹86,200"],
  ["Rent & utilities (allocated)", "-₹34,500"],
  ["Other controllable costs", "-₹18,900"],
  ["Net profit today", "₹1,91,220"],
];

export function renderFinance() {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Finance &amp; Accounts</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">Day-wise P&amp;L, consolidated across all cafes</div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:18px;">
        ${kpiCard({ label: "Net profit today", value: "₹1.91L", trend: "6.4% vs yesterday", trendType: "up" })}
        ${kpiCard({ label: "Vendor payables due (7d)", value: "₹2.14L", trend: "3 invoices", trendType: "down" })}
        ${kpiCard({ label: "Cashflow forecast (30d)", value: "₹18.6L", trend: "healthy", trendType: "up" })}
      </div>

      <div class="glass" style="padding:22px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Day-wise P&amp;L waterfall — today, all cafes</div>
        <table class="glass-table">
          <tbody>
            ${PNL_ROWS.map(
              ([label, val], i) => `
              <tr>
                <td style="${i === PNL_ROWS.length - 1 ? "font-weight:700;color:var(--color-accent-mint-bright);" : ""}">${label}</td>
                <td style="text-align:right; ${i === PNL_ROWS.length - 1 ? "font-weight:700;color:var(--color-accent-mint-bright);" : ""}">${val}</td>
              </tr>`
            ).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
