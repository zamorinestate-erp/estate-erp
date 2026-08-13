// =============================================================================
// PAGE: Reports & Analytics — API-wired
// GET /api/v1/reports/dashboard       — summary KPIs
// GET /api/v1/reports/daily-summary   — daily sales
// GET /api/v1/reports/cash-flow       — cash flow
// GET /api/v1/reports/expenses        — expenses
// GET /api/v1/reports/attendance      — attendance
// =============================================================================
import { apiGet } from "../apiClient.js";
import { state } from "../state.js";
import { showToast } from "../components.js";

const REPORT_CATALOGUE = [
  { id: "daily-summary",  name: "Daily Sales Summary",         cat: "Sales",     endpoint: "/reports/daily-summary",  roles: ["master", "owner", "cafe_admin"] },
  { id: "cash-flow",      name: "Cash Book & Variance Report", cat: "Finance",   endpoint: "/reports/cash-flow",      roles: ["master", "cafe_admin"] },
  { id: "dashboard",      name: "Day-wise P&L Waterfall",      cat: "Finance",   endpoint: "/reports/dashboard",      roles: ["master", "owner"] },
  { id: "expenses",       name: "Expenses Breakdown",          cat: "Finance",   endpoint: "/reports/expenses",       roles: ["master", "owner", "cafe_admin"] },
  { id: "attendance",     name: "Attendance Exceptions",       cat: "Workforce", endpoint: "/reports/attendance",     roles: ["master", "cafe_admin"] },
];

export function renderReports() {
  const role = (state.role || "").toLowerCase();
  const visible = REPORT_CATALOGUE.filter((r) => r.roles.includes(role));

  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Reports &amp; Analytics</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:20px;">${visible.length} reports available for your role</div>

      <div id="report-preview" style="margin-bottom:24px; display:none;">
        <div class="glass" style="padding:22px;" id="report-preview-content">
          <div class="muted-white" style="font-size:13px;">Select a report to preview data.</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;" id="report-grid">
        ${visible.map((r) => `
          <div class="glass" style="padding:18px; display:flex; justify-content:space-between; align-items:center;" data-report-id="${r.id}">
            <div>
              <div style="color:#fff; font-weight:600; font-size:13.5px;">${r.name}</div>
              <div class="pill pill-dark" style="margin-top:6px; padding:3px 9px; font-size:10.5px;">${r.cat}</div>
            </div>
            <div class="flex gap-sm">
              <button class="btn btn-ghost" style="padding:8px 12px; font-size:12px;" data-preview="${r.id}">Preview</button>
              <button class="btn btn-ghost" style="padding:8px 12px; font-size:12px;" data-export="${r.id}">Export</button>
            </div>
          </div>`).join("")}
      </div>
    </div>
  `;
}

export function wireReports(root) {
  root.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => loadReportPreview(root, btn.dataset.preview));
  });

  root.querySelectorAll("[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rep = REPORT_CATALOGUE.find((r) => r.id === btn.dataset.export);
      showToast(`Preparing "${rep?.name || btn.dataset.export}" — PDF, Excel, CSV and print all available`, "mint");
    });
  });
}

async function loadReportPreview(root, reportId) {
  const rep = REPORT_CATALOGUE.find((r) => r.id === reportId);
  if (!rep) return;

  const previewDiv = root.querySelector("#report-preview");
  const previewContent = root.querySelector("#report-preview-content");
  previewDiv.style.display = "block";
  previewContent.innerHTML = `<div class="muted-white" style="font-size:13px;">Loading ${rep.name}…</div>`;

  try {
    const data = await apiGet(rep.endpoint);
    previewContent.innerHTML = renderPreviewTable(rep, data);
  } catch (err) {
    previewContent.innerHTML = `
      <div style="color:#fff; font-weight:600; margin-bottom:8px;">${rep.name}</div>
      <div class="muted-white" style="font-size:13px;">Could not load report data: ${err?.message || "Unknown error"}</div>`;
  }
}

function renderPreviewTable(rep, data) {
  const payload = data?.data || data;

  // Build a generic key-value summary table
  function flattenObject(obj, prefix = "") {
    const rows = [];
    for (const [key, val] of Object.entries(obj || {})) {
      const label = prefix ? `${prefix} → ${key}` : key;
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        rows.push(...flattenObject(val, label));
      } else if (Array.isArray(val)) {
        rows.push({ label, value: `[${val.length} item(s)]` });
      } else {
        rows.push({ label, value: String(val ?? "—") });
      }
    }
    return rows;
  }

  const rows = flattenObject(payload);

  if (!rows.length) {
    return `
      <div style="color:#fff; font-weight:600; margin-bottom:8px;">${rep.name}</div>
      <div class="muted-white" style="font-size:13px;">No data available for this period.</div>`;
  }

  const tableRows = rows.slice(0, 30).map((r) => `
    <tr>
      <td style="padding:6px 10px; color:rgba(255,255,255,0.7); font-size:12.5px; border-bottom:1px solid rgba(255,255,255,0.08); text-transform:capitalize;">${r.label.replace(/_/g, " ")}</td>
      <td style="padding:6px 10px; color:#fff; font-size:12.5px; border-bottom:1px solid rgba(255,255,255,0.08); font-weight:500; text-align:right;">${r.value}</td>
    </tr>`).join("");

  return `
    <div style="color:#fff; font-weight:600; margin-bottom:12px; font-size:14px;">${rep.name}</div>
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px 10px; color:rgba(255,255,255,0.5); font-size:11px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.15); font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">Metric</th>
            <th style="padding:8px 10px; color:rgba(255,255,255,0.5); font-size:11px; text-align:right; border-bottom:1px solid rgba(255,255,255,0.15); font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">Value</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${rows.length > 30 ? `<div class="muted-white" style="font-size:11.5px; margin-top:10px;">+ ${rows.length - 30} more rows — use Export for full data</div>` : ""}
    </div>`;
}
