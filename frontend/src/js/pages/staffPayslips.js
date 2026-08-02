// PAGE: My Payslips (Staff self-service, Part E.1 / Part M.6)
import { showToast } from "../components.js";

const PAYSLIPS = [
  { month: "June 2026", net: "₹21,400" },
  { month: "May 2026", net: "₹21,400" },
  { month: "April 2026", net: "₹20,900" },
];

export function renderStaffPayslips() {
  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div style="color:#fff; font-weight:700; font-size:17px; margin-bottom:18px;" class="font-display">My Payslips</div>
      <div class="flex-col gap-md">
        ${PAYSLIPS.map(
          (p) => `
          <div class="glass" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div><div style="color:#fff; font-weight:600; font-size:13.5px;">${p.month}</div><div class="muted-white" style="font-size:11.5px;">Net pay: ${p.net}</div></div>
            <button class="btn btn-ghost" style="padding:8px 14px; font-size:12px;" data-download="${p.month}">Download</button>
          </div>`
        ).join("")}
      </div>
    </div>
  `;
}

export function wireStaffPayslips(root) {
  root.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", () => showToast(`Downloading payslip — ${btn.dataset.download}`, "mint"));
  });
}
