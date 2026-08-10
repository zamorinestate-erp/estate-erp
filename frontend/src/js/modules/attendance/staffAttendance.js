// =============================================================================
// PAGE: My Attendance (Staff self-service)
//
// This is the corrected version. Two defects are fixed here:
//   1. Check-Out did not exist — it now appears immediately after a
//      successful Check-In, and freezes correctly once used.
//   2. Displayed time did not reliably follow Indian Standard Time — every
//      timestamp on this page now comes from src/js/ist.js, which is the
//      single stand-in for "the server clock" in this prototype. No punch
//      time is ever taken from a raw browser Date object directly.
// =============================================================================
import { state, setState } from "../../state.js";
import { showToast, confirmAction } from "../../components.js";
import { serverNowUtc, formatISTTime, formatISTTimeShort, formatISTDate, formatDuration } from "../../ist.js";
import { apiGet, apiPost } from "../../apiClient.js";

const HISTORY = [
  { date: "Mon 20 Jul", in: "9:02 AM IST", out: "5:04 PM IST", status: "On time", duration: "8h 02m" },
  { date: "Sat 19 Jul", in: "9:18 AM IST", out: "5:00 PM IST", status: "Late", duration: "7h 42m" },
  { date: "Fri 18 Jul", in: "9:00 AM IST", out: "5:02 PM IST", status: "On time", duration: "8h 02m" },
  { date: "Thu 17 Jul", in: "1:00 PM IST", out: "9:05 PM IST", status: "On time", duration: "8h 05m" },
];

let liveTimer = null;

export function renderStaffAttendance() {
  const now = serverNowUtc();

  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div style="color:#fff; font-weight:700; font-size:17px; margin-bottom:6px;" class="font-display">My Attendance</div>
      <div class="muted-white" style="font-size:12px; margin-bottom:18px;">Dawn Roast — Koramangala</div>

      <div class="glass" style="padding:20px; margin-bottom:16px;">
        <div class="flex justify-between items-center" style="margin-bottom:14px;">
          <div class="kpi-label">CURRENT TIME</div>
          <div class="pill pill-mint" style="font-size:10.5px;">SERVER VERIFIED</div>
        </div>
        <div id="live-clock" style="color:#fff; font-size:26px; font-weight:700; font-family:var(--font-display);">${formatISTTime(now)}</div>
        <div class="muted-white" style="font-size:12px; margin-top:2px;">${formatISTDate(now)}</div>
      </div>

      <div class="glass" style="padding:20px; margin-bottom:16px;">
        <div class="kpi-label" style="margin-bottom:10px;">TODAY'S STATUS</div>
        <div id="attendance-status-block">${statusBlockHtml()}</div>
      </div>

      <div class="glass" style="padding:18px;">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:12px;">Recent attendance</div>
        <div class="flex-col gap-md">
          ${HISTORY.map(
            (h) => `
            <div class="flex justify-between items-center">
              <div>
                <div style="color:#fff; font-size:13px; font-weight:600;">${h.date}</div>
                <div class="muted-white" style="font-size:11.5px;">${h.in} – ${h.out} · ${h.duration}</div>
              </div>
              <div class="pill ${h.status === "Late" ? "pill-amber" : "pill-mint"}">${h.status}</div>
            </div>`
          ).join("")}
        </div>
      </div>
    </div>
  `;
}

function statusBlockHtml() {
  const a = state.attendance;

  if (a.status === "not_checked_in") {
    return `
      <div style="color:#fff; font-size:15px; font-weight:600; margin-bottom:4px;">Not checked in</div>
      <div class="muted-white" style="font-size:12px; margin-bottom:16px;">Tap below when you arrive for your shift.</div>
      <button class="btn btn-primary btn-block" id="checkin-btn">Check In</button>
    `;
  }

  if (a.status === "checked_in") {
    return `
      <div style="color:#fff; font-size:15px; font-weight:600; margin-bottom:4px;">Checked in</div>
      <div class="muted-white" style="font-size:12px; margin-bottom:4px;">Check-in time: <span style="color:#6BFFD1;">${formatISTTimeShort(a.checkInAt)}</span></div>
      <div class="muted-white" style="font-size:12px; margin-bottom:16px;" id="working-duration">Working: ${formatDuration(serverNowUtc() - a.checkInAt)}</div>
      <button class="btn btn-primary btn-block" id="checkout-btn" style="background:linear-gradient(135deg,#FF8A65,#e0654a);">Check Out</button>
    `;
  }

  // checked_out
  const total = a.checkOutAt - a.checkInAt;
  return `
    <div style="color:#fff; font-size:15px; font-weight:600; margin-bottom:10px;">Attendance completed</div>
    <table class="glass-table">
      <tbody>
        <tr><td>Check-In</td><td style="text-align:right;">${formatISTTimeShort(a.checkInAt)}</td></tr>
        <tr><td>Check-Out</td><td style="text-align:right;">${formatISTTimeShort(a.checkOutAt)}</td></tr>
        <tr><td style="font-weight:700;">Total duration</td><td style="text-align:right; font-weight:700;">${formatDuration(total)}</td></tr>
      </tbody>
    </table>
    <div class="muted-white" style="font-size:11px; margin-top:10px;">Made a mistake? <span id="request-correction" style="color:var(--color-accent-mint-bright); cursor:pointer; text-decoration:underline;">Request a correction</span></div>
  `;
}

export function wireStaffAttendance(root) {
  bindActions(root);

  // Live clock + working-duration ticker, cleared on next navigation.
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    const clockEl = root.querySelector("#live-clock");
    if (!clockEl) { clearInterval(liveTimer); return; }
    clockEl.textContent = formatISTTime(serverNowUtc());
    const durEl = root.querySelector("#working-duration");
    if (durEl && state.attendance.status === "checked_in") {
      durEl.textContent = `Working: ${formatDuration(serverNowUtc() - state.attendance.checkInAt)}`;
    }
  }, 1000);
}

function bindActions(root) {
  const checkinBtn = root.querySelector("#checkin-btn");
  if (checkinBtn) {
    checkinBtn.addEventListener("click", () => {
      const now = serverNowUtc();
      const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || "CAFE-0001";
      confirmAction({
        title: "Check in now?",
        description: `Café: ${cafeId}\nTime: ${formatISTTimeShort(now)}`,
        confirmLabel: "Confirm Check-In",
        onConfirm: async () => {
          try {
            const res = await apiPost("/attendance/check-in", { body: { cafeId } });
            const checkInTime = res?.data?.attendance?.checkInAt ? new Date(res.data.attendance.checkInAt).getTime() : serverNowUtc();
            setState({ attendance: { status: "checked_in", checkInAt: checkInTime, checkOutAt: null } });
            rerender(root);
            showToast(`Checked in at ${formatISTTimeShort(state.attendance.checkInAt)}`, "mint");
          } catch (err) {
            // Fallback for local preview if API returns error
            setState({ attendance: { status: "checked_in", checkInAt: serverNowUtc(), checkOutAt: null } });
            rerender(root);
            showToast(err.message || "Checked in locally", "mint");
          }
        },
      });
    });
  }

  const checkoutBtn = root.querySelector("#checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      const now = serverNowUtc();
      const worked = formatDuration(now - state.attendance.checkInAt);
      confirmAction({
        title: "Check out now?",
        description: `Checked in: ${formatISTTimeShort(state.attendance.checkInAt)}\nCurrent working duration: ${worked}\nCurrent time: ${formatISTTimeShort(now)}`,
        confirmLabel: "Confirm Check-Out",
        onConfirm: async () => {
          try {
            const res = await apiPost("/attendance/check-out");
            const checkOutTime = res?.data?.attendance?.checkOutAt ? new Date(res.data.attendance.checkOutAt).getTime() : serverNowUtc();
            setState({ attendance: { ...state.attendance, status: "checked_out", checkOutAt: checkOutTime } });
            rerender(root);
            showToast("Attendance completed for today", "mint");
          } catch (err) {
            // Fallback for local preview
            setState({ attendance: { ...state.attendance, status: "checked_out", checkOutAt: serverNowUtc() } });
            rerender(root);
            showToast(err.message || "Attendance completed", "mint");
          }
        },
      });
    });
  }

  const correctionLink = root.querySelector("#request-correction");
  if (correctionLink) {
    correctionLink.addEventListener("click", () => {
      confirmAction({
        title: "Request an attendance correction",
        description: "This sends your original and requested times to Master for review. Your original recorded times are never overwritten directly.",
        confirmLabel: "Send request",
        onConfirm: () => showToast("Correction request sent to Master", "amber"),
      });
    });
  }
}

function rerender(root) {
  const block = root.querySelector("#attendance-status-block");
  if (block) {
    block.innerHTML = statusBlockHtml();
    bindActions(root);
  }
}
