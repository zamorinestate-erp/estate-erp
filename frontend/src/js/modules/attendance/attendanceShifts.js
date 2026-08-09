// PAGE: Attendance & Shifts (Part G.11)
import { ROLES } from "../../navigation.js";
import { state } from "../../state.js";

const ROSTER = [
  { name: "Priya Nair", mon: "9-5", tue: "9-5", wed: "Off", thu: "1-9", fri: "9-5" },
  { name: "Anjali Rao", mon: "1-9", tue: "1-9", wed: "9-5", thu: "Off", fri: "1-9" },
  { name: "Kiran Shetty", mon: "9-5", tue: "Off", wed: "9-5", thu: "9-5", fri: "Off" },
];

const EXCEPTIONS = [
  { name: "Anjali Rao", type: "Late arrival", detail: "18 min late, 19 Jul", severity: "amber" },
  { name: "Kiran Shetty", type: "Missed punch", detail: "No clock-out recorded, 18 Jul", severity: "coral" },
];

export function renderAttendance() {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">Attendance &amp; Shifts</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">${isAdmin ? "Dawn Roast — Koramangala, only" : "All cafes"}</div>

      <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:16px;">
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">This week's roster</div>
          <table class="glass-table">
            <thead><tr><th>Staff</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th></tr></thead>
            <tbody>${ROSTER.map((r) => `<tr><td>${r.name}</td><td>${r.mon}</td><td>${r.tue}</td><td>${r.wed}</td><td>${r.thu}</td><td>${r.fri}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <div class="glass" style="padding:22px;">
          <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Attendance exceptions</div>
          <div class="flex-col gap-md">
            ${EXCEPTIONS.map(
              (e) => `
              <div class="flex gap-sm" style="align-items:flex-start;">
                <div class="pill pill-${e.severity}" style="padding:5px 9px;">!</div>
                <div style="font-size:12.5px;"><span style="color:#fff; font-weight:600;">${e.name} — ${e.type}</span><br/><span class="muted-white">${e.detail}</span></div>
              </div>`
            ).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}
