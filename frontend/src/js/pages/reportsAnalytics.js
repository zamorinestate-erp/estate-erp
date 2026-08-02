// PAGE: Reports & Analytics (Part G.17) — role-scoped catalogue subset
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast } from "../components.js";

const ALL_REPORTS = [
  { name: "Daily Sales Summary", cat: "Sales", roles: ["master", "owner", "cafe_admin"] },
  { name: "Cash Book & Variance Report", cat: "Finance", roles: ["master", "cafe_admin"] },
  { name: "Day-wise P&L Waterfall", cat: "Finance", roles: ["master", "owner"] },
  { name: "Stock Valuation Report", cat: "Inventory", roles: ["master"] },
  { name: "Low Stock Report", cat: "Inventory", roles: ["master", "cafe_admin"] },
  { name: "Attendance Exceptions Report", cat: "Workforce", roles: ["master", "cafe_admin"] },
  { name: "Payroll Register", cat: "Workforce", roles: ["master"] },
  { name: "Vendor Ageing Report", cat: "Finance", roles: ["master", "owner"] },
  { name: "Cashflow Forecast (30-day)", cat: "Finance", roles: ["master", "owner"] },
  { name: "Cafe Performance Comparison", cat: "Strategic", roles: ["master", "owner"] },
];

export function renderReports() {
  const rows = ALL_REPORTS.filter((r) => r.roles.includes(state.role));
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Reports &amp; Analytics</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">${rows.length} reports available for your role</div>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        ${rows
          .map(
            (r) => `
          <div class="glass" style="padding:18px; display:flex; justify-content:space-between; align-items:center;" data-report="${r.name}">
            <div>
              <div style="color:#fff; font-weight:600; font-size:13.5px;">${r.name}</div>
              <div class="pill pill-dark" style="margin-top:6px; padding:3px 9px; font-size:10.5px;">${r.cat}</div>
            </div>
            <button class="btn btn-ghost" style="padding:8px 14px; font-size:12px;" data-export="${r.name}">Export</button>
          </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

export function wireReports(root) {
  root.querySelectorAll("[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => showToast(`Preparing "${btn.dataset.export}" — PDF, Excel, CSV and print all available`, "mint"));
  });
}
