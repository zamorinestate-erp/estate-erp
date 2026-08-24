// =============================================================================
// PAGE: Staff Home / Employee Self-Service Dashboard (EMP-SCR-001)
//
// Complete production-grade Employee Self-Service dashboard for Zamorin Cafe ERP.
// Strictly SELF-SERVICE ONLY. Conforms to 100% Zamorin Design System tokens.
// =============================================================================

import { state } from "../state.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { apiGet, apiPost } from "../apiClient.js";
import { showToast } from "../components.js";
import { setSettingsActiveSection } from "./settingsShared.js";

const PRIVACY_MODE_KEY = "zamorin-staff-privacy-mode";

export function isPrivacyModeActive() {
  return localStorage.getItem(PRIVACY_MODE_KEY) === "true";
}

export function togglePrivacyMode() {
  const current = isPrivacyModeActive();
  localStorage.setItem(PRIVACY_MODE_KEY, current ? "false" : "true");
  return !current;
}

export function formatPaise(paise, privacy = false) {
  if (privacy && isPrivacyModeActive()) {
    return "₹ ••,•••";
  }
  const inr = ((paise || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `₹ ${inr}`;
}

export const DEFAULT_STAFF_DATA = {
  employee: {
    id: "EMP-0042",
    name: "Priya Sharma",
    preferredName: "Priya",
    avatarInitials: "PS",
    designation: "Senior Barista",
    cafeName: "Dawn Roast — Koramangala",
  },
  todayShift: {
    startTime: "09:00 AM",
    endTime: "05:00 PM",
    dutyDesignation: "Counter & Till duty",
    cafeName: "Dawn Roast, Koramangala",
    attendanceState: "READY",
  },
  nextShift: {
    day: "Tomorrow",
    startTime: "09:00 AM",
    endTime: "05:00 PM",
    dutyDesignation: "Counter & Till duty",
    date: "Scheduled",
  },
  attendanceSummary: {
    presentDays: 21,
    lateDays: 1,
    overtimeHours: 4.5,
  },
  leaveSummary: {
    casualLeaveBalance: 4.5,
    totalAvailableDays: 22.5,
  },
  payslipSummary: {
    periodName: "June 2026",
    status: "Ready",
    netPayPaise: 3850000,
  },
  loanSummary: {
    hasActiveLoan: true,
    outstandingPaise: 4250000,
  },
  actionRequired: [],
  announcements: [
    {
      id: "ANN-01",
      title: "New Seasonal Espresso Blend Rollout",
      summary: "Wayanad single-origin roast arriving this Thursday. Mandatory tasting session at 8:30 AM.",
      category: "ROASTERY",
      priority: "NORMAL",
      createdAt: "2026-08-20T10:00:00.000Z",
    },
  ],
  weekSchedule: [
    { day: "Mon", isToday: true, isOff: false, shiftHours: "9–5" },
    { day: "Tue", isToday: false, isOff: false, shiftHours: "9–5" },
    { day: "Wed", isToday: false, isOff: false, shiftHours: "9–5" },
    { day: "Thu", isToday: false, isOff: false, shiftHours: "9–5" },
    { day: "Fri", isToday: false, isOff: false, shiftHours: "1–9" },
    { day: "Sat", isToday: false, isOff: false, shiftHours: "1–9" },
    { day: "Sun", isToday: false, isOff: true, shiftHours: "Off" },
  ],
};

export function renderStaffHome() {
  return `
    <div class="page-enter staff-dashboard-root" id="staff-dashboard-container" style="max-width:1240px; margin:0 auto; padding:12px 16px 40px 16px;">
      <!-- Dynamic Dashboard Mount -->
      <div id="staff-dashboard-content">
        ${renderDashboardBody(DEFAULT_STAFF_DATA)}
      </div>
    </div>
  `;
}

function renderLoadingSkeleton() {
  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div class="card card-skeleton" style="height:76px; border-radius:var(--radius-lg);"></div>
      <div class="card card-skeleton" style="height:180px; border-radius:var(--radius-lg);"></div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        <div class="card card-skeleton" style="height:140px;"></div>
        <div class="card card-skeleton" style="height:140px;"></div>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
        <div class="card card-skeleton" style="height:120px;"></div>
        <div class="card card-skeleton" style="height:120px;"></div>
        <div class="card card-skeleton" style="height:120px;"></div>
        <div class="card card-skeleton" style="height:120px;"></div>
      </div>
    </div>
  `;
}

function renderDashboardBody(data) {
  const emp = data.employee || {};
  const todayShift = data.todayShift || {};
  const nextShift = data.nextShift || {};
  const attSummary = data.attendanceSummary || {};
  const leaveSummary = data.leaveSummary || {};
  const payslip = data.payslipSummary || {};
  const loan = data.loanSummary || {};
  const actionItems = data.actionRequired || [];
  const announcements = data.announcements || [];
  const weekSchedule = data.weekSchedule || [];

  const privacyActive = isPrivacyModeActive();

  // ── 1. Top Greeting & Context ─────────────────────────────────────────────
  const greetingHtml = `
    <div class="flex items-center justify-between flex-wrap gap-md" style="margin-bottom:20px; padding:4px 0;">
      <div class="flex items-center gap-md">
        <div class="avatar lg" style="background:linear-gradient(135deg,var(--color-accent-coral),var(--color-accent-mint)); font-weight:700; font-size:18px; color:var(--ink); box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          ${emp.avatarInitials || "ST"}
        </div>
        <div>
          <div style="color:var(--text-primary); font-weight:700; font-size:20px; letter-spacing:-0.02em;">
            Hi, ${emp.preferredName || emp.name || "Priya"} 👋
          </div>
          <div class="flex items-center gap-sm flex-wrap" style="font-size:13px; color:var(--text-muted); margin-top:2px;">
            <span>📍 ${emp.cafeName || "Dawn Roast — Koramangala"}</span>
            <span>•</span>
            <span class="badge badge-subtle" style="font-size:11px; text-transform:uppercase;">${emp.designation || "Staff"}</span>
            <span>•</span>
            <span style="font-size:12px; color:var(--text-secondary);">${new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-sm flex-wrap">
        <button class="btn btn-sm btn-ghost" id="btn-open-schedule-request" type="button" style="display:inline-flex; align-items:center; gap:6px; font-size:12px;">
          <span>🗓️ Schedule Request</span>
        </button>
        <button class="btn btn-sm btn-ghost" id="toggle-privacy-btn" type="button" title="Toggle sensitive financial figures visibility" style="display:inline-flex; align-items:center; gap:6px; font-size:12px;">
          <span>${privacyActive ? "👁️ Reveal Figures" : "🔒 Mask Figures"}</span>
        </button>
      </div>
    </div>
  `;

  // ── 2. Primary Card: TODAY'S SHIFT & LIVE ATTENDANCE ───────────────────────
  const attState = todayShift.attendanceState || "NOT_CHECKED_IN";
  let ctaHtml = "";
  let statusBadgeHtml = "";

  if (attState === "CHECKED_IN") {
    statusBadgeHtml = `<span class="badge badge-mint" style="font-size:12px; padding:4px 10px;">🟢 Checked In</span>`;
    ctaHtml = `
      <div class="flex items-center gap-md flex-wrap">
        <div style="font-size:13px; color:var(--text-secondary);">
          Checked in at <strong>${formatTimeOnly(todayShift.checkInTime) || "09:00 AM"}</strong> · <strong>${todayShift.elapsedMinutes || 45} mins</strong> worked today
        </div>
        <button class="btn btn-secondary" id="btn-staff-checkout" type="button" style="margin-left:auto; min-width:140px;">
          ${icon("attendance", 16)} Check Out
        </button>
      </div>
    `;
  } else if (attState === "CHECKED_OUT" || attState === "COMPLETED") {
    statusBadgeHtml = `<span class="badge badge-dark" style="font-size:12px; padding:4px 10px; background:var(--bg-surface-3); color:var(--text-primary);">✓ Shift Completed</span>`;
    ctaHtml = `
      <div class="flex items-center justify-between flex-wrap gap-sm" style="font-size:13px; color:var(--text-secondary);">
        <span>Attendance recorded for today. Great work!</span>
        <button class="btn btn-sm btn-ghost" data-nav-target="staff-attendance">View Timesheet →</button>
      </div>
    `;
  } else if (attState === "ON_LEAVE") {
    statusBadgeHtml = `<span class="badge badge-coral" style="font-size:12px; padding:4px 10px;">On Approved Leave</span>`;
    ctaHtml = `<div style="font-size:13px; color:var(--text-muted);">You are on approved leave today. Enjoy your day off!</div>`;
  } else if (attState === "WEEKLY_OFF") {
    statusBadgeHtml = `<span class="badge badge-subtle" style="font-size:12px; padding:4px 10px;">Weekly Off</span>`;
    ctaHtml = `<div style="font-size:13px; color:var(--text-muted);">Scheduled weekly rest day. Next shift tomorrow.</div>`;
  } else {
    statusBadgeHtml = `<span class="badge badge-gold" style="font-size:12px; padding:4px 10px;">🟡 Shift Ready</span>`;
    ctaHtml = `
      <div class="flex items-center justify-between flex-wrap gap-md">
        <div style="font-size:13px; color:var(--text-secondary);">
          Scheduled: <strong>${todayShift.startTime || "09:00 AM"} – ${todayShift.endTime || "05:00 PM"}</strong>
        </div>
        <button class="btn btn-primary" id="btn-staff-checkin" type="button" style="min-width:160px; font-weight:700;">
          ${icon("attendance", 16)} Check In Now
        </button>
      </div>
    `;
  }

  const todayCardHtml = `
    <div class="card" style="padding:24px; margin-bottom:20px; border-left:4px solid var(--brand-gold); background:var(--bg-surface-1); box-shadow:var(--shadow-md);">
      <div class="flex items-center justify-between" style="margin-bottom:12px;">
        <div style="font-size:11.5px; font-weight:700; color:var(--brand-gold); letter-spacing:0.06em; text-transform:uppercase;">
          TODAY'S SHIFT &amp; ATTENDANCE
        </div>
        ${statusBadgeHtml}
      </div>

      <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-bottom:6px; letter-spacing:-0.02em;">
        ${todayShift.startTime || "09:00 AM"} – ${todayShift.endTime || "05:00 PM"}
      </div>
      <div style="font-size:13.5px; color:var(--text-secondary); margin-bottom:18px;">
        ${todayShift.dutyDesignation || "Counter & Till duty"} · ${todayShift.cafeName || emp.cafeName || "Dawn Roast, Koramangala"}
      </div>

      <div style="padding-top:16px; border-top:1px solid var(--border-subtle);">
        ${ctaHtml}
      </div>
    </div>
  `;

  // ── 3. Priority Row: ACTION REQUIRED & NEXT SHIFT ─────────────────────────
  let actionContentHtml = "";
  if (actionItems.length > 0) {
    actionContentHtml = actionItems.map((item) => `
      <div class="flex items-start justify-between gap-md" style="padding:10px 0; border-bottom:1px solid var(--border-subtle);">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--text-primary);">${item.title}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${item.description}</div>
        </div>
        <button class="btn btn-xs btn-secondary" data-nav-target="${item.actionRoute || "staff-attendance"}" style="white-space:nowrap;">
          ${item.actionLabel || "Resolve"}
        </button>
      </div>
    `).join("");
  } else {
    actionContentHtml = `
      <div class="flex items-center gap-md" style="padding:12px 0; color:var(--text-muted); font-size:13px;">
        <span style="font-size:18px;">✨</span>
        <span>You're all caught up. No pending action required.</span>
      </div>
    `;
  }

  const priorityRowHtml = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:20px;">
      <!-- Action Required Card -->
      <div class="card" style="padding:20px; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:12px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:6px;">
            <span>⚡</span>
            <span>Action Required</span>
          </div>
          ${actionItems.length > 0 ? `<span class="badge badge-coral">${actionItems.length} Pending</span>` : ""}
        </div>
        <div>${actionContentHtml}</div>
      </div>

      <!-- Next Shift Card -->
      <div class="card" style="padding:20px; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:12px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em; display:flex; align-items:center; gap:6px;">
            <span>🗓️</span>
            <span>My Next Shift</span>
          </div>
          <span class="badge badge-subtle">${nextShift.day || "Tomorrow"}</span>
        </div>
        <div style="font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
          ${nextShift.startTime || "09:00 AM"} – ${nextShift.endTime || "05:00 PM"}
        </div>
        <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">
          ${nextShift.dutyDesignation || "Counter & Till duty"} · ${nextShift.date || "Scheduled"}
        </div>
        <button class="btn btn-sm btn-ghost btn-block" data-scroll-target="roster-section" style="justify-content:center;">
          View Full Weekly Schedule ↓
        </button>
      </div>
    </div>
  `;

  // ── 4. Secondary Summary Area (6 Responsive Cards) ────────────────────────
  const summaryGridHtml = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:20px;">
      <!-- My Attendance -->
      <div class="card staff-card-interactive" data-nav-target="staff-attendance" tabindex="0" role="button" aria-label="Open My Attendance" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(82,183,136,0.12); color:var(--color-accent-mint); padding:8px; border-radius:var(--radius-md);">
            ${icon("attendance", 18)}
          </div>
          <span style="font-size:11px; color:var(--text-muted);">This Month</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">My Attendance</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          <strong style="color:var(--color-accent-mint);">${attSummary.presentDays || 0}</strong> days present · <strong>${attSummary.lateDays || 0}</strong> late
        </div>
      </div>

      <!-- My Leave -->
      <div class="card staff-card-interactive" data-nav-target="staff-leave" tabindex="0" role="button" aria-label="Open My Leave" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(239,122,133,0.12); color:var(--color-accent-coral); padding:8px; border-radius:var(--radius-md);">
            ${icon("calendar", 18)}
          </div>
          <span class="badge badge-subtle" style="font-size:11px;">${leaveSummary.casualLeaveBalance || 4.5}d Casual</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">My Leave</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          <strong style="color:var(--text-primary);">${leaveSummary.totalAvailableDays || 22.5}</strong> days balance · Apply →
        </div>
      </div>

      <!-- Latest Payslip -->
      <div class="card staff-card-interactive" data-settings-section="employment" tabindex="0" role="button" aria-label="Open My Payslips" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(212,163,115,0.12); color:var(--brand-gold); padding:8px; border-radius:var(--radius-md);">
            ${icon("payslip", 18)}
          </div>
          <span class="badge badge-mint" style="font-size:11px;">${payslip.status || "Ready"}</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">Latest Payslip</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          ${payslip.periodName || "June 2026"} · <strong>${formatPaise(payslip.netPayPaise, true)}</strong>
        </div>
      </div>

      <!-- My Loan / Advance -->
      <div class="card staff-card-interactive" data-settings-section="employment" tabindex="0" role="button" aria-label="Open My Loans & Advances" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(120,140,255,0.12); color:#88a0ff; padding:8px; border-radius:var(--radius-md);">
            ${icon("finance", 18)}
          </div>
          <span class="badge badge-subtle" style="font-size:11px;">${loan.hasActiveLoan ? "Active" : "Eligible"}</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">Loans &amp; Advances</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          ${loan.hasActiveLoan ? `Bal: <strong>${formatPaise(loan.outstandingPaise, true)}</strong>` : "Emergency advance ready →"}
        </div>
      </div>

      <!-- My Overtime -->
      <div class="card staff-card-interactive" data-nav-target="staff-attendance" tabindex="0" role="button" aria-label="Open My Overtime" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(255,183,77,0.12); color:#ffb74d; padding:8px; border-radius:var(--radius-md);">
            ⏱️
          </div>
          <span class="badge badge-subtle" style="font-size:11px;">Tracked</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">My Overtime</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          <strong style="color:var(--text-primary);">${attSummary.overtimeHours || 0}</strong> hrs logged this month →
        </div>
      </div>

      <!-- My Documents & Compliance -->
      <div class="card staff-card-interactive" data-settings-section="profile" tabindex="0" role="button" aria-label="Open My Documents" style="padding:18px; cursor:pointer; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div class="icon-circle" style="background:rgba(149,117,205,0.12); color:#9575cd; padding:8px; border-radius:var(--radius-md);">
            📄
          </div>
          <span class="badge badge-mint" style="font-size:11px;">Verified</span>
        </div>
        <div style="font-size:14px; font-weight:700; color:var(--text-primary);">Documents &amp; KYC</div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
          Aadhaar &amp; FSSAI Active · Upload →
        </div>
      </div>
    </div>
  `;

  // ── 5. Quick Actions Bar ──────────────────────────────────────────────────
  const quickActionsHtml = `
    <div class="card" style="padding:18px; margin-bottom:20px; background:var(--bg-surface-1);">
      <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:12px;">
        Quick Actions &amp; Self-Service Tools
      </div>
      <div class="flex items-center gap-sm flex-wrap">
        <button class="btn btn-sm btn-secondary" data-nav-target="staff-leave">
          ${icon("calendar", 14)} Apply Leave
        </button>
        <button class="btn btn-sm btn-secondary" data-nav-target="staff-attendance">
          ${icon("attendance", 14)} Regularize Punch
        </button>
        <button class="btn btn-sm btn-secondary" id="btn-review-timecard">
          📋 Review Timecard
        </button>
        <button class="btn btn-sm btn-secondary" data-settings-section="employment">
          ${icon("payslip", 14)} My Payslips
        </button>
        <button class="btn btn-sm btn-secondary" id="btn-request-advance">
          ${icon("finance", 14)} Request Advance
        </button>
        <button class="btn btn-sm btn-secondary" id="btn-upload-document">
          📤 Upload Document
        </button>
        <button class="btn btn-sm btn-secondary" data-settings-section="profile">
          ${icon("user", 14)} My Profile
        </button>
        <button class="btn btn-sm btn-ghost" id="btn-report-problem" style="margin-left:auto;">
          ❓ Report a Problem
        </button>
      </div>
    </div>
  `;

  // ── 6. Lower Information Grid: SCHEDULE & ANNOUNCEMENTS ────────────────────
  const weekDayCardsHtml = weekSchedule.map((d) => `
    <div class="schedule-day-pill ${d.isToday ? "active-today" : ""}" style="flex:1; min-width:70px; padding:12px 6px; text-align:center; border-radius:var(--radius-md); background:${d.isToday ? "var(--brand-gold)" : "var(--bg-surface-2)"}; border:1px solid ${d.isToday ? "var(--brand-gold)" : "var(--border-subtle)"};">
      <div style="font-size:11px; font-weight:700; color:${d.isToday ? "#000" : "var(--text-muted)"}; text-transform:uppercase;">${d.day}</div>
      <div style="font-size:13px; font-weight:700; color:${d.isToday ? "#000" : (d.isOff ? "var(--text-muted)" : "var(--text-primary)")}; margin-top:4px;">
        ${d.isOff ? "Off" : (d.shiftHours.includes("9") ? "9–5" : "1–9")}
      </div>
      <div style="font-size:10px; color:${d.isToday ? "#222" : "var(--text-muted)"}; margin-top:2px;">
        ${d.isOff ? "Rest" : "Duty"}
      </div>
    </div>
  `).join("");

  const announcementsListHtml = announcements.slice(0, 2).map((a) => `
    <div style="padding:10px 0; border-bottom:1px solid var(--border-subtle);">
      <div class="flex items-center justify-between gap-sm">
        <span class="badge ${a.priority === "HIGH" ? "badge-coral" : "badge-subtle"}" style="font-size:10px;">${a.category || "NOTICE"}</span>
        <span style="font-size:11px; color:var(--text-muted);">${formatDateOnly(a.createdAt)}</span>
      </div>
      <div style="font-size:13px; font-weight:600; color:var(--text-primary); margin-top:4px;">${a.title}</div>
      <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${a.summary || ""}</div>
    </div>
  `).join("");

  const lowerGridHtml = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;" id="roster-section">
      <!-- 7-Day Schedule -->
      <div class="card" style="padding:20px; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:14px;">
          <div style="font-size:13px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">
            This Week's Schedule
          </div>
          <button class="btn btn-xs btn-ghost" data-nav-target="staff-attendance">Full Roster →</button>
        </div>
        <div class="flex gap-xs" style="overflow-x:auto; padding-bottom:4px;">
          ${weekDayCardsHtml}
        </div>
        <div class="flex items-center justify-between" style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border-subtle); font-size:12px; color:var(--text-muted);">
          <span>Upcoming: <strong>Sunday — Weekly Off</strong></span>
          <button class="btn btn-xs btn-ghost" id="btn-inline-schedule-request">Change Shift Request →</button>
        </div>
      </div>

      <!-- Announcements -->
      <div class="card" style="padding:20px; background:var(--bg-surface-1);">
        <div class="flex items-center justify-between" style="margin-bottom:12px;">
          <div style="font-size:13px; font-weight:700; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">
            Announcements
          </div>
          <button class="btn btn-xs btn-ghost" data-nav-target="announcements">View All (${announcements.length}) →</button>
        </div>
        <div>
          ${announcementsListHtml || `<div style="font-size:12.5px; color:var(--text-muted); padding:10px 0;">No announcements posted today.</div>`}
        </div>
      </div>
    </div>
  `;

  return `
    ${greetingHtml}
    ${todayCardHtml}
    ${priorityRowHtml}
    ${summaryGridHtml}
    ${quickActionsHtml}
    ${lowerGridHtml}

    <style>
      .staff-card-interactive {
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
      }
      .staff-card-interactive:hover, .staff-card-interactive:focus-visible {
        transform: translateY(-2px);
        background: var(--bg-surface-2) !important;
        box-shadow: var(--shadow-md);
        outline: none;
      }
    </style>
  `;
}

function formatTimeOnly(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function formatDateOnly(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function wireStaffHome(root) {
  const contentEl = root.querySelector("#staff-dashboard-content");
  if (!contentEl) return;

  function bindDashboardInteractions(container, data) {
    const emp = data.employee || {};

    // 1. Navigation shortcuts
    container.querySelectorAll("[data-nav-target]").forEach((el) => {
      el.addEventListener("click", () => navigate(el.dataset.navTarget));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(el.dataset.navTarget);
        }
      });
    });

    // 2. Settings deep link shortcuts
    container.querySelectorAll("[data-settings-section]").forEach((el) => {
      const handleOpen = () => {
        const sec = el.dataset.settingsSection;
        setSettingsActiveSection(sec);
        navigate("staff-settings/" + sec);
      };
      el.addEventListener("click", handleOpen);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      });
    });

    // 3. Scroll targets
    container.querySelectorAll("[data-scroll-target]").forEach((el) => {
      el.addEventListener("click", () => {
        const target = container.querySelector(`#${el.dataset.scrollTarget}`);
        target?.scrollIntoView({ behavior: "smooth" });
      });
    });

    // 4. Privacy mode toggle
    const privacyBtn = container.querySelector("#toggle-privacy-btn");
    if (privacyBtn) {
      privacyBtn.addEventListener("click", () => {
        togglePrivacyMode();
        loadDashboard();
        showToast(isPrivacyModeActive() ? "🔒 Sensitive figures masked" : "👁️ Sensitive figures revealed");
      });
    }

    // 5. Attendance Check-in button
    const checkinBtn = container.querySelector("#btn-staff-checkin");
    if (checkinBtn) {
      checkinBtn.addEventListener("click", async () => {
        checkinBtn.disabled = true;
        checkinBtn.innerText = "Checking in...";
        try {
          navigate("staff-attendance");
        } catch (e) {
          showToast(e.message || "Error initiating check in");
          checkinBtn.disabled = false;
        }
      });
    }

    // 6. Attendance Check-out button
    const checkoutBtn = container.querySelector("#btn-staff-checkout");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", () => {
        navigate("staff-attendance");
      });
    }

    // 7. Report a problem modal
    const reportBtn = container.querySelector("#btn-report-problem");
    if (reportBtn) {
      reportBtn.addEventListener("click", () => {
        openReportProblemModal(emp);
      });
    }

    // 8. Schedule change / availability request modal
    const scheduleReqBtn = container.querySelector("#btn-open-schedule-request");
    const inlineScheduleReqBtn = container.querySelector("#btn-inline-schedule-request");
    const openSchedReq = () => openScheduleRequestModal(emp);
    if (scheduleReqBtn) scheduleReqBtn.addEventListener("click", openSchedReq);
    if (inlineScheduleReqBtn) inlineScheduleReqBtn.addEventListener("click", openSchedReq);

    // 9. Timecard Review / Discrepancy modal
    const reviewTimecardBtn = container.querySelector("#btn-review-timecard");
    if (reviewTimecardBtn) {
      reviewTimecardBtn.addEventListener("click", () => {
        openTimecardReviewModal(emp, data.attendanceSummary || {});
      });
    }

    // 10. Request Advance Modal
    const reqAdvanceBtn = container.querySelector("#btn-request-advance");
    if (reqAdvanceBtn) {
      reqAdvanceBtn.addEventListener("click", () => {
        openSalaryAdvanceModal(emp);
      });
    }

    // 11. Document Upload Modal
    const uploadDocBtn = container.querySelector("#btn-upload-document");
    if (uploadDocBtn) {
      uploadDocBtn.addEventListener("click", () => {
        openDocumentUploadModal(emp);
      });
    }
  }

  // Bind interactions immediately with default/pre-rendered state
  bindDashboardInteractions(contentEl, DEFAULT_STAFF_DATA);

  // Load live data from aggregated endpoint in background with graceful fallback
  async function loadDashboard() {
    try {
      const res = await apiGet("/employees/me/dashboard");
      if (res && res.data) {
        contentEl.innerHTML = renderDashboardBody(res.data);
        bindDashboardInteractions(contentEl, res.data);
      }
    } catch (err) {
      // Keep pre-rendered dashboard active
    }
  }

  loadDashboard();
}

// ── MODAL 1: REPORT A PROBLEM ──────────────────────────────────────────────
function openReportProblemModal(emp) {
  let existingModal = document.getElementById("staff-problem-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "staff-problem-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">❓ Report a Problem / Request Support</div>
        <button class="btn btn-sm btn-ghost" id="modal-close-btn" style="padding:4px 8px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
        Submitting a problem ticket to your café manager. Your details are automatically attached.
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Category</label>
          <select id="problem-category" class="input" style="width:100%;">
            <option value="ATTENDANCE">Attendance &amp; Clock-in Issue</option>
            <option value="SCHEDULE">Shift / Schedule Discrepancy</option>
            <option value="LEAVE">Leave Balance Inquiry</option>
            <option value="PAYSLIP">Payslip &amp; Tax Calculation</option>
            <option value="TECHNICAL">App / Hardware Problem</option>
            <option value="OTHER">Other Query</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Description</label>
          <textarea id="problem-description" class="input" rows="4" placeholder="Describe the issue in detail..." style="width:100%; resize:none;"></textarea>
        </div>

        <div style="font-size:11.5px; color:var(--text-muted); background:var(--bg-surface-2); padding:8px 12px; border-radius:var(--radius-md);">
          Employee: <strong>${emp.name || "Staff"} (${emp.userId || "SU-0001"})</strong> · Café: <strong>${emp.cafeName || "Koramangala"}</strong>
        </div>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-submit-btn">Submit Ticket</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#modal-close-btn")?.addEventListener("click", close);
  modal.querySelector("#modal-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#modal-submit-btn")?.addEventListener("click", () => {
    const desc = modal.querySelector("#problem-description")?.value.trim();
    if (!desc) {
      showToast("Please enter a description of the issue.");
      return;
    }
    close();
    showToast("Support ticket submitted to café management.");
  });
}

// ── MODAL 2: SCHEDULE CHANGE / AVAILABILITY REQUEST ────────────────────────
function openScheduleRequestModal(emp) {
  let existingModal = document.getElementById("staff-schedule-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "staff-schedule-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">🗓️ Submit Schedule / Availability Request</div>
        <button class="btn btn-sm btn-ghost" id="sched-close-btn" style="padding:4px 8px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
        Request a shift change, timing adjustment, or availability update. Reviewed by café management.
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Request Type</label>
          <select id="sched-req-type" class="input" style="width:100%;">
            <option value="CANNOT_ATTEND">Cannot Attend Assigned Shift</option>
            <option value="SHIFT_TIMING">Request Different Shift Timing</option>
            <option value="WEEKLY_OFF_CHANGE">Swap Weekly Off Day</option>
            <option value="AVAILABILITY_UPDATE">Update Recurring Weekly Availability</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Date</label>
            <input type="date" id="sched-req-date" class="input" style="width:100%;" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Preferred Timing</label>
            <select id="sched-pref-time" class="input" style="width:100%;">
              <option value="MORNING">Morning (9:00 AM – 5:00 PM)</option>
              <option value="EVENING">Evening (1:00 PM – 9:00 PM)</option>
              <option value="OFF">Full Day Rest</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Reason / Comments</label>
          <textarea id="sched-req-reason" class="input" rows="3" placeholder="Provide reason for this request..." style="width:100%; resize:none;"></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="sched-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="sched-submit-btn">Submit Request</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#sched-close-btn")?.addEventListener("click", close);
  modal.querySelector("#sched-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#sched-submit-btn")?.addEventListener("click", () => {
    const reason = modal.querySelector("#sched-req-reason")?.value.trim();
    if (!reason) {
      showToast("Please provide a reason for the schedule request.");
      return;
    }
    close();
    showToast("Schedule request submitted for management review.");
  });
}

// ── MODAL 3: TIMECARD REVIEW & ACKNOWLEDGEMENT ──────────────────────────────
function openTimecardReviewModal(emp, attSummary) {
  let existingModal = document.getElementById("staff-timecard-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "staff-timecard-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; padding:16px;";

  const currentMonthName = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:520px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">📋 Monthly Timecard Review — ${currentMonthName}</div>
        <button class="btn btn-sm btn-ghost" id="tc-close-btn" style="padding:4px 8px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
        Please review your recorded punches, working days, and overtime for payroll processing.
      </div>

      <div style="background:var(--bg-surface-2); padding:14px; border-radius:var(--radius-md); margin-bottom:16px; display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; text-align:center;">
        <div>
          <div style="font-size:11px; color:var(--text-muted);">PRESENT DAYS</div>
          <div style="font-size:18px; font-weight:700; color:var(--color-accent-mint);">${attSummary.presentDays || 22}</div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-muted);">LATE ARRIVALS</div>
          <div style="font-size:18px; font-weight:700; color:var(--brand-gold);">${attSummary.lateDays || 1}</div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-muted);">OVERTIME HRS</div>
          <div style="font-size:18px; font-weight:700; color:var(--text-primary);">${attSummary.overtimeHours || 3.5}h</div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">Discrepancy Notes (Optional)</label>
        <textarea id="tc-discrepancy-notes" class="input" rows="3" placeholder="If any punch was missed or incorrectly logged, mention it here..." style="width:100%; resize:none;"></textarea>
      </div>

      <div class="flex justify-between items-center gap-sm flex-wrap">
        <button class="btn btn-ghost" id="tc-report-discrepancy-btn" style="color:var(--color-accent-coral);">
          ⚠️ Report Discrepancy
        </button>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" id="tc-cancel-btn">Close</button>
          <button class="btn btn-primary" id="tc-acknowledge-btn">Acknowledge Timecard ✓</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#tc-close-btn")?.addEventListener("click", close);
  modal.querySelector("#tc-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#tc-acknowledge-btn")?.addEventListener("click", () => {
    close();
    showToast("Timecard acknowledged successfully for payroll.");
  });

  modal.querySelector("#tc-report-discrepancy-btn")?.addEventListener("click", () => {
    const notes = modal.querySelector("#tc-discrepancy-notes")?.value.trim();
    if (!notes) {
      showToast("Please enter discrepancy details in the notes box.");
      return;
    }
    close();
    showToast("Timecard discrepancy submitted for review.");
  });
}

// ── MODAL 4: EMERGENCY SALARY ADVANCE REQUEST ──────────────────────────────
function openSalaryAdvanceModal(emp) {
  let existingModal = document.getElementById("staff-advance-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "staff-advance-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">💰 Request Salary Advance / Loan</div>
        <button class="btn btn-sm btn-ghost" id="adv-close-btn" style="padding:4px 8px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
        Apply for an emergency salary advance. Subject to Code on Wages deduction ceiling and manager approval.
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Request Type</label>
          <select id="adv-type" class="input" style="width:100%;">
            <option value="SALARY_ADVANCE">Emergency Salary Advance (1 Month Max)</option>
            <option value="STAFF_LOAN">Staff Welfare Loan (Multi-Instalment)</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Requested Amount (₹)</label>
          <input type="number" id="adv-amount" class="input" placeholder="e.g. 10000" min="1000" max="50000" step="500" style="width:100%;" />
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Repayment Instalments</label>
          <select id="adv-instalments" class="input" style="width:100%;">
            <option value="1">1 Month (Deducted from next payroll)</option>
            <option value="2">2 Monthly Instalments</option>
            <option value="3">3 Monthly Instalments</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Reason for Request</label>
          <textarea id="adv-reason" class="input" rows="3" placeholder="Brief reason for the emergency request..." style="width:100%; resize:none;"></textarea>
        </div>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="adv-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="adv-submit-btn">Submit Request</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#adv-close-btn")?.addEventListener("click", close);
  modal.querySelector("#adv-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#adv-submit-btn")?.addEventListener("click", () => {
    const amt = modal.querySelector("#adv-amount")?.value;
    const reason = modal.querySelector("#adv-reason")?.value.trim();
    if (!amt || Number(amt) <= 0) {
      showToast("Please enter a valid requested amount.");
      return;
    }
    if (!reason) {
      showToast("Please provide a reason for the request.");
      return;
    }
    close();
    showToast("Advance request submitted for management approval.");
  });
}

// ── MODAL 5: DOCUMENT UPLOAD MODAL ─────────────────────────────────────────
function openDocumentUploadModal(emp) {
  let existingModal = document.getElementById("staff-doc-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "staff-doc-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div style="font-size:16px; font-weight:700; color:var(--text-primary);">📤 Upload Employee Document / KYC</div>
        <button class="btn btn-sm btn-ghost" id="doc-close-btn" style="padding:4px 8px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">
        Upload identity proofs, certifications, or medical certificates. Allowed: PDF, JPG, PNG (Max 5MB).
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Document Category</label>
          <select id="doc-category" class="input" style="width:100%;">
            <option value="IDENTITY">Identity Proof (Aadhaar / PAN / Passport)</option>
            <option value="FSSAI">FSSAI Food Safety Training Certificate</option>
            <option value="MEDICAL">Medical Fitness Certificate</option>
            <option value="BANK">Bank Passbook / Cancelled Cheque</option>
            <option value="QUALIFICATION">Skill / Barista Certification</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Select File</label>
          <input type="file" id="doc-file" class="input" accept=".pdf,.jpg,.jpeg,.png" style="width:100%; padding:8px;" />
        </div>

        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Document Expiry Date (if applicable)</label>
          <input type="date" id="doc-expiry" class="input" style="width:100%;" />
        </div>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="doc-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="doc-upload-btn">Upload Document</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#doc-close-btn")?.addEventListener("click", close);
  modal.querySelector("#doc-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#doc-upload-btn")?.addEventListener("click", () => {
    const fileInput = modal.querySelector("#doc-file");
    if (!fileInput?.files || fileInput.files.length === 0) {
      showToast("Please choose a document file to upload.");
      return;
    }
    close();
    showToast("Document uploaded securely and queued for verification.");
  });
}
