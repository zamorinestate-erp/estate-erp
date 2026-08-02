// PAGE: My Leave (Staff self-service, Part E.1 / Part M.7)
import { showToast } from "../components.js";
import { pushNotification } from "../notifications.js";

let requests = [{ type: "Casual Leave", dates: "10–11 Jul", status: "Approved" }];

export function renderStaffLeave() {
  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div style="color:#fff; font-weight:700; font-size:17px; margin-bottom:18px;" class="font-display">My Leave</div>

      <div class="glass" style="padding:18px; margin-bottom:14px;">
        <div class="kpi-label">BALANCE REMAINING</div>
        <div class="kpi-value">4.5 days</div>
      </div>

      <div class="glass" style="padding:18px; margin-bottom:14px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Apply for leave</div>
        <select id="leave-type" style="width:100%; margin-bottom:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.3); color:#fff; font-size:13px;">
          <option>Casual Leave</option><option>Sick Leave</option><option>Earned Leave</option>
        </select>
        <input id="leave-dates" placeholder="e.g. 24–26 Jul" style="width:100%; margin-bottom:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.3); color:#fff; font-size:13px;" />
        <button class="btn btn-primary btn-block" id="submit-leave-btn">Submit request</button>
      </div>

      <div class="glass" style="padding:18px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Request history</div>
        <div class="flex-col gap-md" id="leave-history">${requests.map(reqRow).join("")}</div>
      </div>
    </div>
  `;
}

function reqRow(r) {
  const pillClass = r.status === "Approved" ? "pill-mint" : r.status === "Submitted" ? "pill-amber" : "pill-coral";
  return `<div class="flex justify-between items-center"><div><div style="color:#fff; font-size:13px;">${r.type}</div><div class="muted-white" style="font-size:11.5px;">${r.dates}</div></div><div class="pill ${pillClass}">${r.status}</div></div>`;
}

export function wireStaffLeave(root) {
  root.querySelector("#submit-leave-btn").addEventListener("click", () => {
    const type = root.querySelector("#leave-type").value;
    const dates = root.querySelector("#leave-dates").value.trim();
    if (!dates) { showToast("Enter the dates you're requesting", "amber"); return; }
    requests = [{ type, dates, status: "Submitted" }, ...requests];
    root.querySelector("#leave-history").innerHTML = requests.map(reqRow).join("");
    root.querySelector("#leave-dates").value = "";
    showToast("Leave request submitted, awaiting approval", "mint");
    pushNotification({
      category: "Leave",
      severity: "warning",
      title: "Leave request submitted",
      message: `Priya Nair — ${type}, ${dates}`,
      recipientRoles: ["cafe_admin", "master"],
      actionRequired: true,
      popupEligible: true,
      deepLink: "tasks",
    });
  });
}
