// =============================================================================
// PAGE: Staff Home
//
// Corrected version. The defect was: every card on this screen was a plain,
// non-interactive <div> — no href, no onClick, nothing. The bottom tab bar
// (built in router.js from the shared NAVIGATION registry) always worked
// because it wires real navigate() calls per item; this screen's cards never
// did. Every card below now either navigates through the same navigate()
// function the tab bar uses, or performs a real in-page action — nothing
// here is a decorative placeholder or an empty onClick handler.
// =============================================================================
import { state } from "../state.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";

export function renderStaffHome() {
  const shiftAction = shiftCardHtml();

  return `
    <div class="page-enter" style="padding:8px 4px;">
      <div class="flex items-center justify-between" style="margin-bottom:26px;">
        <div class="flex items-center gap-md">
          <div class="avatar" style="background:linear-gradient(135deg,var(--color-accent-coral),var(--color-accent-mint));">PN</div>
          <div>
            <div style="color:#fff; font-weight:700; font-size:16px;">Hi, Priya</div>
            <div class="muted-white" style="font-size:12px;">Dawn Roast — Koramangala</div>
          </div>
        </div>
      </div>

      <div class="glass" style="padding:20px; margin-bottom:16px; cursor:pointer;" data-nav="staff-attendance" tabindex="0" role="button" aria-label="Open My Attendance">
        <div class="kpi-label">TODAY'S SHIFT</div>
        <div style="color:#fff; font-size:20px; font-weight:700; margin:4px 0;">9:00 AM – 5:00 PM</div>
        <div class="muted-white" style="font-size:12.5px; margin-bottom:14px;">Counter &amp; Till duty — Dawn Roast, Koramangala</div>
        ${shiftAction}
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:16px;">
        <div class="glass staff-card" style="padding:16px; cursor:pointer;" data-nav="staff-leave" tabindex="0" role="button" aria-label="Apply for leave">
          ${icon("calendar", 18)}
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-top:8px;">Apply for leave</div>
          <div class="muted-white" style="font-size:11.5px;">4.5 days left</div>
        </div>
        <div class="glass staff-card" style="padding:16px; cursor:pointer;" data-nav="staff-payslips" tabindex="0" role="button" aria-label="View payslip">
          ${icon("payslip", 18)}
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-top:8px;">View payslip</div>
          <div class="muted-white" style="font-size:11.5px;">June, ready</div>
        </div>
        <div class="glass staff-card" style="padding:16px; cursor:pointer;" data-scroll="roster-section" tabindex="0" role="button" aria-label="View duty roster">
          ${icon("attendance", 18)}
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-top:8px;">Duty roster</div>
          <div class="muted-white" style="font-size:11.5px;">This week</div>
        </div>
        <div class="glass staff-card" style="padding:16px; cursor:pointer;" data-nav="announcements" tabindex="0" role="button" aria-label="View announcements">
          ${icon("announce", 18)}
          <div style="color:#fff; font-weight:600; font-size:13.5px; margin-top:8px;">Announcements</div>
          <div class="muted-white" style="font-size:11.5px;">2 new</div>
        </div>
      </div>

      <div class="glass" style="padding:18px;" id="roster-section">
        <div style="color:#fff; font-weight:600; font-size:13.5px; margin-bottom:10px;">This week's roster</div>
        <div class="flex justify-between muted-white" style="font-size:12px;">
          <div>Mon<br/><span style="color:#fff;">9–5</span></div>
          <div>Tue<br/><span style="color:#fff;">9–5</span></div>
          <div>Wed<br/><span style="color:#fff;">Off</span></div>
          <div>Thu<br/><span style="color:#fff;">1–9</span></div>
          <div>Fri<br/><span style="color:#fff;">9–5</span></div>
          <div>Sat<br/><span style="color:#fff;">9–5</span></div>
          <div>Sun<br/><span style="color:#fff;">Off</span></div>
        </div>
      </div>
    </div>

    <style>
      .staff-card { transition: transform 120ms ease, background 120ms ease; }
      .staff-card:hover, .staff-card:focus-visible { transform: translateY(-2px); background: rgba(255,255,255,0.2); outline: none; }
    </style>
  `;
}

function shiftCardHtml() {
  const status = state.attendance.status;
  if (status === "checked_in") {
    return `<div class="pill pill-mint" style="width:100%; justify-content:center; padding:12px;">Checked in — tap to check out</div>`;
  }
  if (status === "checked_out") {
    return `<div class="pill pill-dark" style="width:100%; justify-content:center; padding:12px; color:#fff;">Attendance completed for today</div>`;
  }
  return `<button class="btn btn-primary btn-block" data-nav-stop="staff-attendance">Check In</button>`;
}

export function wireStaffHome(root) {
  // Cards and the whole shift block navigate via the same navigate() the
  // bottom tab bar uses — one shared navigation path, not two systems.
  root.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(el.dataset.nav);
      }
    });
  });

  // The Check In button inside the shift card stops the card's own click
  // from also firing, so tapping it does not double-navigate.
  const stopBtn = root.querySelector("[data-nav-stop]");
  if (stopBtn) {
    stopBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigate(stopBtn.dataset.navStop);
    });
  }

  // In-page scroll for Duty Roster — a real action, not a dead link, since
  // this prototype keeps the weekly roster on the home screen itself.
  const scrollCard = root.querySelector("[data-scroll]");
  if (scrollCard) {
    const doScroll = () => {
      const target = root.querySelector(`#${scrollCard.dataset.scroll}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollCard.addEventListener("click", doScroll);
    scrollCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doScroll(); }
    });
  }
}
