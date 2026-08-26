// =============================================================================
// ZAMORIN CAFE ERP — ADM-SCR-003 / SCR-004: ATTENDANCE & SHIFTS
// Canonical Attendance Engine + Single-Cafe Cafe Operations Projection
// + Master Parity UX Reflection
// =============================================================================

import { apiGet, apiPost } from "../../apiClient.js";
import { showToast, openModal, confirmAction, renderChildHeader } from "../../components.js";
import { state } from "../../state.js";
import { ROLES } from "../../navigation.js";
import { navigate } from "../../router.js";

let activeSubTab = "overview"; // 'overview' | 'live' | 'roster' | 'calendar360' | 'exceptions' | 'policies' | 'closure' | 'analytics'
let liveFilterStatus = "ALL"; // 'ALL' | 'NEEDS_ATTENTION' | 'PRESENT' | 'LATE' | 'MISSING_PUNCH' | 'ABSENT' | 'ON_LEAVE' | 'OVERTIME'
let liveSearchQuery = "";
let cachedOverview = null;
let cachedLiveAttendance = [];
let cachedRoster = null;
let cachedServerTime = null;
let selectedUserId = "EMP-001";

export function setAttendanceActiveTab(tab) {
  const norm = (tab || "overview").toLowerCase();
  const aliasMap = {
    "rosters": "roster",
    "daily": "live",
    "approvals": "exceptions",
    "reports": "analytics",
    "history": "calendar360",
    "rules": "policies",
  };
  activeSubTab = aliasMap[norm] || norm || "overview";
}

export function renderAttendance(subroute) {
  if (subroute !== undefined) {
    setAttendanceActiveTab(subroute);
  }
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isPrimary = state.user?.isPrimaryMaster === true;
  const isNormalMaster = role === ROLES.MASTER && !isPrimary;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;
  const isOwner = role === ROLES.OWNER;

  const assignedCafe = state.user?.assignedCafeIds?.[0] || "ZC-0001";
  const cafeDisplayName = assignedCafe === "ZC-0003" ? "Calicut Beach" : assignedCafe === "ZC-0002" ? "Indiranagar Central" : "Dawn Roast — Koramangala";
  const operatorName = state.user?.name || state.user?.fullName || (isCafeAdmin ? "Rahul K" : "Zamorin Master");
  const operatorEmpId = state.user?.employeeId || state.user?.userId || "EMP-0042";

  if (activeSubTab && activeSubTab !== "overview") {
    return `
      <div class="page-enter attendance-page-container" style="max-width:1400px; margin:0 auto; padding-bottom:60px;">
        <div id="attendance-subpanel-root">
          ${renderActiveSubpanel()}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter attendance-page-container" style="max-width:1400px; margin:0 auto; padding-bottom:60px;">
      <!-- Page Header & Context Strip -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:18px; border-bottom:1px solid var(--border-subtle); padding-bottom:16px;">
        <div>
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:4px;">
            <h1 class="page-title" style="font-size:23px; font-weight:800; margin:0; color:var(--ink); letter-spacing:-0.3px;">Attendance &amp; Shifts</h1>
            <span class="status info" style="font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">SCR-004</span>
            ${
              isCafeAdmin
                ? `<span class="status warning" style="font-size:10px; font-weight:800; letter-spacing:0.5px;">CAFE OPERATIONS</span>`
                : isPrimary
                ? `<span class="status success" style="font-size:10px; font-weight:800;">PRIMARY MASTER</span>`
                : `<span class="status info" style="font-size:10px; font-weight:800;">OPERATIONAL MASTER</span>`
            }
          </div>

          <p style="font-size:12.5px; color:var(--muted); margin:0 0 8px;">
            ${
              isCafeAdmin
                ? `Today's attendance, live presence, roster, exceptions and attendance operations for this cafe.`
                : `Multi-Café Workforce Presence, Shift Matrix, Employee 360 Calendar, Overtime Governance &amp; Period Closure`
            }
          </p>

          <!-- Fixed Context Strip for Cafe Operations & Master -->
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-size:12px; color:var(--ink);">
            <div style="display:inline-flex; align-items:center; gap:6px; background:var(--surface-sunken); padding:4px 10px; border-radius:6px; border:1px solid var(--line);">
              <span style="font-weight:700; color:var(--bronze-600);">📍 ${isCafeAdmin ? cafeDisplayName : "All Outlets (Portfolio)"}</span>
              ${isCafeAdmin ? `<span style="font-size:11px; color:var(--muted);">· Main Counter Mobile</span>` : ""}
            </div>

            <div style="display:inline-flex; align-items:center; gap:5px; background:var(--surface-sunken); padding:4px 10px; border-radius:6px; border:1px solid var(--line);">
              <span>👤 <strong>${operatorName}</strong></span>
              <span style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">(${operatorEmpId})</span>
            </div>

            <div style="display:inline-flex; align-items:center; gap:5px; background:var(--surface-sunken); padding:4px 10px; border-radius:6px; border:1px solid var(--line); font-family:var(--font-mono); font-size:11.5px;">
              <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--color-success, #2E7D32);"></span>
              <span>Server Time: <strong id="server-time-indicator">11:35 IST</strong> · Online · Synced</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-ghost" id="refresh-attendance-btn" type="button" style="font-size:12.5px; padding:7px 14px;">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Subpanel Content Container -->
      <div id="attendance-subpanel-root">
        ${renderActiveSubpanel()}
      </div>
    </div>
  `;
}

function renderActiveSubpanel() {
  if (activeSubTab === "overview") {
    return renderOverviewSubpanel();
  }

  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  const submodules = {
    live: {
      title: isCafeAdmin ? "Live Attendance & Shift Status" : "Live Multi-Café Attendance",
      icon: "🟢",
      desc: "Real-time employee clock-ins, biometric scans and active duty stations.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="open-manual-attendance-btn" type="button" style="font-size:12px; font-weight:700;">${isCafeAdmin ? "+ Manual Attendance" : "+ Master Manual Punch"}</button>`
    },
    roster: {
      title: "Shifts & Scheduling Roster",
      icon: "📅",
      desc: "Weekly shift rosters, opening/closing coverage and staff assignments.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="open-create-roster-btn" type="button" style="font-size:12px; font-weight:700;">+ Create Shift Roster</button>`
    },
    calendar360: {
      title: isCafeAdmin ? "Attendance History & Records" : "Employee 360° Attendance History",
      icon: "👤",
      desc: "Monthly punch cards, timesheets, leave balances and individual records.",
      actionsHtml: `<button class="btn btn-ghost btn-sm" id="export-history-btn" type="button" style="font-size:12px;">📊 Export Timesheets</button>`
    },
    exceptions: {
      title: "Attendance Exceptions & Overtime",
      icon: "⚠️",
      desc: "Missing checkouts, late punches, overtime requests and supervisor approvals.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="open-manual-attendance-btn" type="button" style="font-size:12px; font-weight:700;">${isCafeAdmin ? "+ Manual Attendance" : "+ Master Manual Punch"}</button>`
    },
    policies: {
      title: isCafeAdmin ? "Attendance Policies & Guidelines" : "Attendance Policies & Compliance Evidence",
      icon: "📜",
      desc: "Grace periods, half-day deduction rules, OT formulas and statutory proofs.",
      actionsHtml: `<button class="btn btn-ghost btn-sm" id="export-policy-btn" type="button" style="font-size:12px;">📄 Print Compliance Policy</button>`
    },
    closure: {
      title: "Payroll Period Timesheet Closure",
      icon: "🔒",
      desc: "Month-end timesheet locks, adjustments reconciliation and payroll handoff.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="close-period-btn" type="button" style="font-size:12px; font-weight:700;">🔒 Close Timesheet Period</button>`
    },
    analytics: {
      title: "Punctuality & Labour Hours Analytics",
      icon: "📈",
      desc: "Average shift adherence, OT trends, absenteeism rates and peak hour staffing.",
      actionsHtml: `<button class="btn btn-ghost btn-sm" id="export-analytics-btn" type="button" style="font-size:12px;">📈 Export CSV</button>`
    },
  };

  const cur = submodules[activeSubTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (activeSubTab) {
    case "live":
      bodyHtml = renderLiveSubpanel();
      break;
    case "roster":
      bodyHtml = renderRosterSubpanel();
      break;
    case "calendar360":
      bodyHtml = renderCalendar360Subpanel();
      break;
    case "exceptions":
      bodyHtml = renderExceptionsSubpanel();
      break;
    case "policies":
      bodyHtml = renderPoliciesSubpanel();
      break;
    case "closure":
      bodyHtml = renderClosureSubpanel();
      break;
    case "analytics":
      bodyHtml = renderAnalyticsSubpanel();
      break;
    default:
      bodyHtml = renderOverviewSubpanel();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentLabel: "Attendance & Shifts",
        parentRoute: "attendance",
        childTitle: cur.title,
        icon: cur.icon,
        description: cur.desc,
        backBtnId: "attendance-back-to-hub-btn",
        actionsHtml: cur.actionsHtml || ""
      })}
      <div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

// =============================================================================
// 1. OVERVIEW & PRESENCE SUBPANEL
// =============================================================================
function renderOverviewSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  const ov = cachedOverview || {
    kpis: {
      scheduledToday: 6,
      presentNow: 5,
      onTime: 4,
      late: 1,
      absent: 1,
      onLeave: 0,
      missingPunches: 1,
      overtimePending: 1,
    },
    cafeWorkforce: [
      { cafeId: "ZC-0001", cafeName: "Dawn Roast — Koramangala", scheduled: 6, present: 5, adequacyStatus: "ADEQUATE" },
      { cafeId: "ZC-0002", cafeName: "Indiranagar Central", scheduled: 5, present: 4, adequacyStatus: "ADEQUATE" },
      { cafeId: "ZC-0003", cafeName: "Calicut Beach", scheduled: 4, present: 3, adequacyStatus: "ADEQUATE" },
    ],
    needsAttention: [
      {
        type: "LATE_ARRIVAL",
        severity: "MEDIUM",
        userId: "EMP-002",
        userName: "Anjali Rao",
        role: "Barista",
        shiftName: "Morning Roastery Shift",
        age: "18 min overdue",
        status: "Checked In · 07:18 IST",
        nextAction: "Needs Operator Review",
      },
      {
        type: "MISSING_CHECKOUT",
        severity: "HIGH",
        userId: "EMP-003",
        userName: "Kiran Shetty",
        role: "Service Crew",
        shiftName: "Closing Shift",
        age: "Open 2h 14m",
        status: "Missing Checkout",
        nextAction: "Record Manual Punch",
      },
      {
        type: "OVERTIME_PENDING",
        severity: "MEDIUM",
        userId: "EMP-001",
        userName: "Priya Nair",
        role: "Head Barista",
        shiftName: "Full Day",
        age: "Yesterday",
        status: "+90 Min Detected OT",
        nextAction: isCafeAdmin ? "Review & Recommend" : "Waiting for MASTER Decision",
      },
    ],
  };

  const totalExceptions = (ov.kpis.missingPunches || 0) + (ov.kpis.overtimePending || 0) + (ov.kpis.late || 0);

  const attendanceTiles = [
    { id: "live", icon: "🟢", title: isCafeAdmin ? "Live Attendance" : "Live Multi-Café Attendance", subtitle: "Real-time employee clock-ins, biometric scans & duty floor", badge: `${ov.kpis.presentNow || 5} Present`, badgeType: "success" },
    { id: "roster", icon: "📅", title: "Shifts & Roster", subtitle: "Weekly shift schedules, opening/closing coverage & staff shifts", badge: `${ov.kpis.scheduledToday || 6} Rostered`, badgeType: "accent" },
    { id: "calendar360", icon: "👤", title: isCafeAdmin ? "Attendance History" : "Employee Attendance (360)", subtitle: "Monthly punch cards, timesheets & individual attendance", badge: "360 History", badgeType: "" },
    { id: "exceptions", icon: "⚠️", title: "Exceptions & Overtime", subtitle: "Missing checkouts, late punches & overtime authorizations", badge: `${totalExceptions} Items`, badgeType: totalExceptions > 0 ? "warning" : "success" },
    { id: "policies", icon: "📜", title: isCafeAdmin ? "Attendance Rules" : "Policies & Compliance", subtitle: "Grace periods, half-day deduction rules & OT formulas", badge: "Enforced", badgeType: "success" },
    ...(!isCafeAdmin ? [{ id: "closure", icon: "🔒", title: "Period Closure", subtitle: "Month-end timesheet locks & payroll handover", badge: "Locked", badgeType: "" }] : []),
    { id: "analytics", icon: "📈", title: "Punctuality & Trends", subtitle: "Average shift adherence, OT trends & peak hour coverage", badge: "98% Rate", badgeType: "success" },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Attendance &amp; Workforce Roster Workspaces</h3>
        <div class="module-tile-grid">
          ${attendanceTiles.map((t) => `
            <button class="module-hub-tile" data-attendance-hub-tile="${t.id}" type="button">
              <div class="module-tile-icon-box">${t.icon}</div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${t.title}</span>
                  ${t.badge ? `<span class="module-tile-badge ${t.badgeType}">${t.badge}</span>` : ""}
                </div>
                <div class="module-tile-sub">${t.subtitle}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Top Readiness Strip -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:var(--surface-sunken); padding:12px 18px; border-radius:var(--radius-sm, 8px); border:1px solid var(--line);">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">${totalExceptions > 0 ? "⚠️" : "✅"}</span>
        <div>
          <strong style="font-size:14px; color:var(--ink);">
            ${totalExceptions > 0 ? `${totalExceptions} Attendance Items Require Operational Attention` : "Attendance Operations Clear"}
          </strong>
          <div style="font-size:12px; color:var(--muted);">
            ${totalExceptions > 0 ? "Review exception queue, missing checkouts, and pending overtime records below." : "All scheduled staff present and accounted for with zero active exceptions."}
          </div>
        </div>
      </div>

      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm btn-ghost view-filter-btn" data-filter="LATE" type="button">Late (${ov.kpis.late})</button>
        <button class="btn btn-sm btn-ghost view-filter-btn" data-filter="MISSING_PUNCH" type="button">Missing Punch (${ov.kpis.missingPunches})</button>
        <button class="btn btn-sm btn-ghost view-filter-btn" data-filter="OVERTIME" type="button">Overtime (${ov.kpis.overtimePending})</button>
      </div>
    </div>

    <!-- Interactive Top KPI Grid (Clickable Filters) -->
    <div class="attendance-kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:12px; margin-bottom:24px;">
      ${clickableKpiCard("Scheduled Today", ov.kpis.scheduledToday, "Rostered Shifts", "var(--ink)", "ALL")}
      ${clickableKpiCard("Present Now", ov.kpis.presentNow, "Checked In / Floor", "var(--color-success, #2E7D32)", "PRESENT")}
      ${clickableKpiCard("On Time", ov.kpis.onTime, "Punctual Check-in", "var(--ink)", "PRESENT")}
      ${clickableKpiCard("Late Arrivals", ov.kpis.late, "Grace Exceeded", ov.kpis.late > 0 ? "var(--color-warning, #ED6C02)" : "var(--muted)", "LATE")}
      ${clickableKpiCard("Absent", ov.kpis.absent, "Unexcused", ov.kpis.absent > 0 ? "var(--color-danger, #D32F2F)" : "var(--muted)", "ABSENT")}
      ${clickableKpiCard("On Leave", ov.kpis.onLeave, "Approved Time Off", "var(--ink)", "ON_LEAVE")}
      ${clickableKpiCard("Missing Checkout", ov.kpis.missingPunches, "Pending Punch", ov.kpis.missingPunches > 0 ? "var(--color-danger)" : "var(--muted)", "MISSING_PUNCH")}
      ${clickableKpiCard("Overtime Pending", ov.kpis.overtimePending, isCafeAdmin ? "Awaiting Review" : "Awaiting Decision", "var(--color-accent-amber, #C89D5C)", "OVERTIME")}
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:20px; margin-bottom:24px;">
      <!-- Staffing Panel: Single Cafe vs Multi-Cafe -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 12px; color:var(--ink); display:flex; justify-content:space-between; align-items:center;">
          <span>${isCafeAdmin ? "Today's Staffing & Shift Coverage" : "Café Workforce & Staffing Adequacy"}</span>
          <span style="font-size:11.5px; font-weight:600; color:var(--muted);">Week of 17 Aug 2026</span>
        </h3>

        ${
          isCafeAdmin
            ? `
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="background:var(--surface-sunken); padding:14px; border-radius:6px; border:1px solid var(--line);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:14px; color:var(--ink);">Morning Roastery Shift (06:30 – 15:00)</strong>
                <span class="status success" style="font-size:11px;">ON FLOOR</span>
              </div>
              <div style="font-size:12.5px; color:var(--muted); display:flex; justify-content:space-between; align-items:center;">
                <span>Scheduled: <strong style="color:var(--ink);">4 Staff</strong></span>
                <span>Present: <strong style="color:var(--color-success);">4 Checked In</strong></span>
                <span>Ends in: <strong>2h 45m</strong></span>
              </div>
            </div>

            <div style="background:var(--surface-sunken); padding:14px; border-radius:6px; border:1px solid var(--line);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="font-size:14px; color:var(--ink);">Evening Closing Shift (13:00 – 21:30)</strong>
                <span class="status info" style="font-size:11px;">UPCOMING</span>
              </div>
              <div style="font-size:12.5px; color:var(--muted); display:flex; justify-content:space-between; align-items:center;">
                <span>Scheduled: <strong style="color:var(--ink);">2 Staff</strong></span>
                <span>Starts in: <strong style="color:var(--bronze-600);">3h 15m</strong></span>
                <span>Coverage: <strong>Optimal</strong></span>
              </div>
            </div>
          </div>
        `
            : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${ov.cafeWorkforce
              .map(
                (c) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
                <div>
                  <strong style="font-size:13.5px; color:var(--ink);">${c.cafeName}</strong>
                  <div style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">${c.cafeId}</div>
                </div>
                <div style="text-align:right;">
                  <span class="status ${c.adequacyStatus === "ADEQUATE" ? "success" : "danger"}" style="font-size:10.5px;">${c.adequacyStatus}</span>
                  <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Rostered: ${c.scheduled} · Present: ${c.present}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
        }
      </div>

      <!-- Kiosk / QR / Server Time Health -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 12px; color:var(--ink);">Attendance Kiosk &amp; Verification Health</h3>

        <div style="display:flex; flex-direction:column; gap:12px; font-size:12.5px;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-subtle);">
            <span>Rotating QR Code Token</span>
            <span class="status success" style="font-size:11px;">ACTIVE (45s Cycle)</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-subtle);">
            <span>Server Time Synchronization</span>
            <span class="status success" style="font-size:11px;">LOCKED TO SERVER (IST)</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-subtle);">
            <span>GPS Geofence Accuracy</span>
            <strong style="color:var(--ink);">50m Radius (Enforced)</strong>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-subtle);">
            <span>Live Selfie Privacy</span>
            <strong style="color:var(--color-success);">Short-Lived Signed Storage</strong>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Last Successful Attendance Punch</span>
            <span style="font-family:var(--font-mono); color:var(--muted);">07:18:42 IST (Anjali Rao)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Needs Attention Exception Queue -->
    <div class="card" style="padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
        <div>
          <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Prioritised Attendance Exception Queue</h3>
          <p style="font-size:12px; color:var(--muted); margin:0;">Real-time exceptions requiring operational action or review</p>
        </div>
        <span class="status warning" style="font-size:11px;">${ov.needsAttention.length} Pending</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        ${ov.needsAttention
          .map(
            (item) => `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:12px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="font-size:13.5px; color:var(--ink);">${item.userName}</strong>
                <span style="font-size:11px; font-family:var(--font-mono); font-weight:700; color:var(--color-accent-amber);">${item.userId}</span>
                <span class="status ${item.severity === "HIGH" ? "danger" : "warning"}" style="font-size:10px;">${item.type.replace(/_/g, " ")}</span>
              </div>
              <div style="font-size:12px; color:var(--muted); margin-top:3px;">
                ${item.role} · ${item.shiftName} · <span style="color:var(--color-warning); font-weight:600;">${item.status}</span> · <span style="font-family:var(--font-mono);">${item.age}</span>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px;">
              <span class="status info" style="font-size:11px;">${item.nextAction}</span>
              <button class="btn btn-sm btn-primary action-exception-btn" data-user="${item.userId}" data-type="${item.type}" type="button">
                Action
              </button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function clickableKpiCard(title, value, subtitle, valColor, filterStatus) {
  return `
    <div class="card kpi-card-clickable" data-kpi-filter="${filterStatus}" style="padding:14px 16px; cursor:pointer; transition:transform 0.1s ease, border-color 0.15s ease;">
      <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">${title}</div>
      <div style="font-size:23px; font-weight:800; color:${valColor}; font-family:var(--font-mono); line-height:1.1;">${value}</div>
      <div style="font-size:11px; color:var(--muted); margin-top:4px;">${subtitle}</div>
    </div>
  `;
}

// =============================================================================
// 2. LIVE ATTENDANCE SUBPANEL
// =============================================================================
function renderLiveSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  const records = cachedLiveAttendance.length > 0 ? cachedLiveAttendance : [
    {
      userId: "EMP-001",
      name: "Priya Nair",
      role: "HEAD_BARISTA",
      cafeId: "ZC-0001",
      status: "CHECKED_IN",
      checkInAt: "06:42 AM",
      checkOutAt: "—",
      regularMinutes: 360,
      isLate: false,
      isManualEntry: false,
      source: "QR",
    },
    {
      userId: "EMP-002",
      name: "Anjali Rao",
      role: "BARISTA",
      cafeId: "ZC-0001",
      status: "CHECKED_IN",
      checkInAt: "07:18 AM",
      checkOutAt: "—",
      regularMinutes: 320,
      isLate: true,
      isManualEntry: false,
      source: "QR",
    },
    {
      userId: "EMP-003",
      name: "Kiran Shetty",
      role: "SERVICE_CREW",
      cafeId: "ZC-0001",
      status: "MISSED_PUNCH",
      checkInAt: "06:30 AM",
      checkOutAt: "—",
      regularMinutes: 300,
      isLate: false,
      isManualEntry: false,
      source: "SELF",
    },
    {
      userId: "EMP-004",
      name: "Rahul Verma",
      role: "JUNIOR_BARISTA",
      cafeId: "ZC-0001",
      status: "CHECKED_OUT",
      checkInAt: "06:30 AM",
      checkOutAt: "15:00 PM",
      regularMinutes: 480,
      isLate: false,
      isManualEntry: true,
      source: "MANUAL",
    },
  ];

  // Filter records
  const filtered = records.filter((r) => {
    if (liveFilterStatus === "PRESENT" && r.status !== "CHECKED_IN" && r.status !== "ON_BREAK") return false;
    if (liveFilterStatus === "LATE" && !r.isLate) return false;
    if (liveFilterStatus === "MISSING_PUNCH" && r.status !== "MISSED_PUNCH") return false;
    if (liveFilterStatus === "ABSENT" && r.status !== "ABSENT") return false;
    if (liveFilterStatus === "ON_LEAVE" && r.status !== "ON_LEAVE") return false;

    if (liveSearchQuery) {
      const q = liveSearchQuery.toLowerCase();
      const matchName = (r.name || "").toLowerCase().includes(q);
      const matchId = (r.userId || "").toLowerCase().includes(q);
      const matchRole = (r.role || "").toLowerCase().includes(q);
      if (!matchName && !matchId && !matchRole) return false;
    }
    return true;
  });

  return `
    <div class="card" style="padding:22px;">
      <!-- Filter and Search Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <input type="text" id="live-search-input" class="input" placeholder="Search staff by name or EMP ID..." value="${liveSearchQuery}" style="max-width:340px; font-size:13px;" />

        <!-- Quick Filter Chips -->
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${renderFilterChip("ALL", "All Staff")}
          ${renderFilterChip("PRESENT", "Present")}
          ${renderFilterChip("LATE", "Late")}
          ${renderFilterChip("MISSING_PUNCH", "Missing Punch")}
          ${renderFilterChip("ABSENT", "Absent")}
          ${renderFilterChip("ON_LEAVE", "On Leave")}
        </div>
      </div>

      <!-- Live Attendance Table -->
      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Employee</th>
              ${!isCafeAdmin ? "<th>Location</th>" : ""}
              <th>Status</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Hours</th>
              <th>Source</th>
              <th>Markers</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length === 0
                ? `<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--muted);">No attendance records found matching current criteria.</td></tr>`
                : filtered
                    .map(
                      (r) => `
              <tr>
                <td>
                  <strong style="color:var(--ink); font-size:13.5px;">${r.name || r.userId}</strong>
                  <div style="font-size:11.5px; color:var(--color-accent-amber); font-family:var(--font-mono); font-weight:700;">${r.userId}</div>
                </td>
                ${!isCafeAdmin ? `<td><div style="font-size:12.5px; font-family:var(--font-mono);">${r.cafeId}</div></td>` : ""}
                <td>
                  <span class="status ${r.status === "CHECKED_IN" ? "success" : r.status === "ON_BREAK" ? "warning" : r.status === "MISSED_PUNCH" ? "danger" : "info"}" style="font-size:11px; font-weight:700;">
                    ${r.status}
                  </span>
                </td>
                <td style="font-family:var(--font-mono); font-size:12.5px;">${r.checkInAt || "—"}</td>
                <td style="font-family:var(--font-mono); font-size:12.5px;">${r.checkOutAt || "—"}</td>
                <td style="font-family:var(--font-mono); font-size:12.5px;">${((r.regularMinutes || 0) / 60).toFixed(1)} hrs</td>
                <td>
                  <span style="font-size:11px; font-family:var(--font-mono); background:var(--surface-sunken); padding:2px 6px; border-radius:4px; border:1px solid var(--line);">
                    ${r.source || (r.isManualEntry ? "MANUAL" : "QR")}
                  </span>
                </td>
                <td>
                  ${r.isLate ? `<span class="status warning" style="font-size:10px;">LATE</span> ` : ""}
                  ${r.isManualEntry ? `<span class="status info" style="font-size:10px;">MANUAL</span>` : ""}
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-ghost btn-sm view-employee-history-btn" data-user="${r.userId}" type="button" style="font-size:11.5px; padding:4px 10px;">
                    ${isCafeAdmin ? "History" : "360 History"}
                  </button>
                </td>
              </tr>
            `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFilterChip(filterKey, label) {
  const isSelected = liveFilterStatus === filterKey;
  return `
    <button class="btn btn-sm ${isSelected ? "btn-primary" : "btn-ghost"} live-filter-chip" data-filter="${filterKey}" type="button" style="font-size:12px; padding:4px 10px;">
      ${label}
    </button>
  `;
}

// =============================================================================
// 3. SHIFTS & ROSTER SUBPANEL
// =============================================================================
function renderRosterSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  const staff = [
    { name: "Priya Nair", id: "EMP-001", role: "Head Barista", mon: "06:30 - 15:00", tue: "06:30 - 15:00", wed: "OFF", thu: "13:00 - 21:30", fri: "06:30 - 15:00", sat: "06:30 - 15:00", sun: "OFF" },
    { name: "Anjali Rao", id: "EMP-002", role: "Barista", mon: "13:00 - 21:30", tue: "13:00 - 21:30", wed: "06:30 - 15:00", thu: "OFF", fri: "13:00 - 21:30", sat: "13:00 - 21:30", sun: "OFF" },
    { name: "Kiran Shetty", id: "EMP-003", role: "Service Crew", mon: "06:30 - 15:00", tue: "OFF", wed: "06:30 - 15:00", thu: "06:30 - 15:00", fri: "OFF", sat: "06:30 - 15:00", sun: "13:00 - 21:30" },
    { name: "Rahul Verma", id: "EMP-004", role: "Junior Barista", mon: "06:30 - 15:00", tue: "06:30 - 15:00", wed: "06:30 - 15:00", thu: "OFF", fri: "06:30 - 15:00", sat: "OFF", sun: "06:30 - 15:00" },
  ];

  return `
    <div class="card" style="padding:22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 2px; color:var(--ink);">
            Weekly Shift Roster — ${isCafeAdmin ? "Assigned Cafe" : "Dawn Roast Koramangala"}
          </h3>
          <p style="font-size:12.5px; color:var(--muted); margin:0;">
            Week of 17 Aug 2026 – 23 Aug 2026 · <span class="status success" style="font-size:10.5px;">PUBLISHED</span>
          </p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" id="copy-prev-week-roster-btn" type="button" style="font-size:12.5px;">Copy Last Week</button>
          <button class="btn btn-primary" id="publish-roster-btn" type="button" style="font-size:12.5px;">Publish Roster</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Mon (17)</th>
              <th>Tue (18)</th>
              <th>Wed (19)</th>
              <th>Thu (20)</th>
              <th>Fri (21)</th>
              <th>Sat (22)</th>
              <th>Sun (23)</th>
            </tr>
          </thead>
          <tbody>
            ${staff
              .map((s) => `
              <tr>
                <td>
                  <strong style="color:var(--ink); font-size:13px;">${s.name}</strong>
                  <div style="font-size:11px; color:var(--color-accent-amber); font-family:var(--font-mono); font-weight:700;">${s.id}</div>
                </td>
                <td><span class="status ${s.mon === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.mon}</span></td>
                <td><span class="status ${s.tue === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.tue}</span></td>
                <td><span class="status ${s.wed === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.wed}</span></td>
                <td><span class="status ${s.thu === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.thu}</span></td>
                <td><span class="status ${s.fri === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.fri}</span></td>
                <td><span class="status ${s.sat === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.sat}</span></td>
                <td><span class="status ${s.sun === "OFF" ? "neutral" : "info"}" style="font-size:11px;">${s.sun}</span></td>
              </tr>
            `)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =============================================================================
// 4. ATTENDANCE HISTORY SUBPANEL
// =============================================================================
function renderCalendar360Subpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return `
    <div class="card" style="padding:22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 2px; color:var(--ink);">
            ${isCafeAdmin ? "Staff Attendance History" : "Employee Attendance 360"} — Priya Nair (EMP-001)
          </h3>
          <p style="font-size:12.5px; color:var(--muted); margin:0;">
            ${isCafeAdmin ? "Operational attendance records and punch history for this employee." : "Monthly visual calendar with primary colour tokens and secondary punch markers."}
          </p>
        </div>
        <div style="display:flex; gap:10px;">
          <select id="calendar-user-select" class="input" style="font-size:12.5px; width:auto;">
            <option value="EMP-001" ${selectedUserId === "EMP-001" ? "selected" : ""}>Priya Nair (EMP-001)</option>
            <option value="EMP-002" ${selectedUserId === "EMP-002" ? "selected" : ""}>Anjali Rao (EMP-002)</option>
            <option value="EMP-003" ${selectedUserId === "EMP-003" ? "selected" : ""}>Kiran Shetty (EMP-003)</option>
          </select>
          <select class="input" style="font-size:12.5px; width:auto;">
            <option value="2026-08">August 2026</option>
            <option value="2026-07">July 2026</option>
          </select>
        </div>
      </div>

      <!-- Month Summary Strip -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px;">
        <div style="padding:10px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted);">Total Worked</div>
          <strong style="font-size:16px; color:var(--ink); font-family:var(--font-mono);">142.5 hrs</strong>
        </div>
        <div style="padding:10px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted);">Overtime</div>
          <strong style="font-size:16px; color:var(--color-accent-amber); font-family:var(--font-mono);">4.0 hrs</strong>
        </div>
        <div style="padding:10px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted);">Days Present</div>
          <strong style="font-size:16px; color:var(--color-success); font-family:var(--font-mono);">16 Days</strong>
        </div>
        <div style="padding:10px 14px; background:var(--surface-sunken); border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted);">Late Arrivals</div>
          <strong style="font-size:16px; color:var(--color-warning); font-family:var(--font-mono);">1 Day</strong>
        </div>
      </div>

      <!-- 31-Day Calendar Grid -->
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px;">
        ${days
          .map((d) => {
            const isPresent = d <= 19 && d % 7 !== 0 && d % 7 !== 6;
            const isWeeklyOff = d % 7 === 0 || d % 7 === 6;
            const isFuture = d > 19;
            const isLate = d === 12;

            let bg = "var(--surface-sunken)";
            let borderColor = "var(--line)";
            let statusText = "Present";
            let statusColor = "var(--color-success)";

            if (isWeeklyOff) {
              statusText = "Weekly Off";
              statusColor = "var(--muted)";
            } else if (isFuture) {
              statusText = "Scheduled";
              statusColor = "var(--muted)";
            } else if (isLate) {
              statusText = "Late (18m)";
              statusColor = "var(--color-warning)";
              borderColor = "var(--color-warning)";
            }

            return `
            <div style="padding:10px; border:1px solid ${borderColor}; border-radius:6px; background:${bg}; min-height:70px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted);">
                <strong>Aug ${d}</strong>
                ${isLate ? `<span style="color:var(--color-warning); font-weight:700;">!</span>` : ""}
              </div>
              <div style="font-size:12px; font-weight:700; color:${statusColor}; margin-top:8px;">${statusText}</div>
              ${isPresent ? `<div style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">06:42 – 15:10</div>` : ""}
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

// =============================================================================
// 5. EXCEPTIONS & OVERTIME SUBPANEL
// =============================================================================
function renderExceptionsSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isPrimary = state.user?.isPrimaryMaster === true;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
      <!-- Overtime Decision Queue -->
      <div class="card" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px; font-weight:700; margin:0 0 2px; color:var(--ink);">Overtime Workflow Queue</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">
              ${isCafeAdmin ? "Review & recommend overtime for Primary Master decision" : "CAFE_ADMIN verify → Normal Master review → Primary Master final decision"}
            </p>
          </div>
          <span class="status warning" style="font-size:11px;">1 Pending</span>
        </div>

        <div style="padding:14px; border:1px solid var(--border-subtle); border-radius:8px; background:var(--surface-sunken);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <strong style="color:var(--ink); font-size:13.5px;">Priya Nair (EMP-001) — 90 Min Overtime</strong>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">Dawn Roast Koramangala · 18 Aug 2026 · Reason: Peak evening rush coverage</div>
            </div>
            <span class="status info" style="font-size:11px;">Awaiting Review</span>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            ${
              isCafeAdmin
                ? `<button class="btn btn-primary" id="recommend-ot-btn" type="button" style="font-size:12px;">
                    Verify &amp; Recommend to Master
                   </button>`
                : isPrimary
                ? `<button class="btn btn-ghost" id="reject-ot-btn" type="button" style="font-size:12px; color:var(--color-danger);">Reject</button>
                   <button class="btn btn-primary" id="approve-ot-btn" type="button" style="font-size:12px;">Approve (Primary Master)</button>`
                : `<span style="font-size:11.5px; color:var(--muted);">Final OT decision: Primary Master only</span>`
            }
          </div>
        </div>
      </div>

      <!-- Attendance Exceptions -->
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Unresolved Attendance Exceptions</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 14px;">Lateness, missing checkouts, and validation warnings</p>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="padding:12px; border:1px solid var(--border-subtle); border-radius:6px; background:var(--surface-sunken); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--ink);">Anjali Rao (EMP-002) — Late Arrival (18 min)</div>
              <div style="font-size:11.5px; color:var(--muted);">19 Aug 2026 · Grace window exceeded</div>
            </div>
            <span class="status warning" style="font-size:11px;">Awaiting Review</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// 6. ATTENDANCE RULES / POLICIES SUBPANEL
// =============================================================================
function renderPoliciesSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isPrimary = state.user?.isPrimaryMaster === true;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  return `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%; min-width:0;">
      <!-- TOP EXECUTIVE POLICY METRIC STRIP -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Geofence Security</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">50 Meters <span style="font-size:12px; font-weight:600; color:var(--muted);">Radius</span></div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● High-Accuracy GPS Required</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Rotating QR Token</div>
          <div style="font-size:22px; font-weight:800; color:var(--bronze-600); font-family:var(--font-heading); margin-top:4px;">45 Seconds</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Anti-buddy punching refresh</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Late Grace Window</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">15 Minutes</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Automatic delay flag threshold</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Statutory Status</div>
          <div style="font-size:22px; font-weight:800; color:#059669; font-family:var(--font-heading); margin-top:4px;">100% Compliant</div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● Kerala Labour Act 1960</div>
        </div>
      </div>

      <!-- MAIN 4-POLICY CARD GRID -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:16px;">
        <!-- Card 1: Frontline Verification Parameters -->
        <div class="card" style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:15.5px; font-weight:800; margin:0 0 2px; color:var(--ink);">
                ${isCafeAdmin ? "Attendance Rules (Operational Summary)" : "Frontline Clock-In Verification Policies"}
              </h3>
              <p style="font-size:12px; color:var(--muted); margin:0;">
                ${isCafeAdmin ? "Configured clock-in and verification parameters for this cafe (Read-Only)." : "Configurable clock-in security parameters."}
              </p>
            </div>
            <span class="status success" style="font-size:10px; font-weight:700;">ACTIVE</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Geofence Radius &amp; Accuracy</span>
              <strong style="color:var(--ink); font-family:var(--font-mono);">50 Meters (GPS Required)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Rotating QR Code Interval</span>
              <strong style="color:var(--ink); font-family:var(--font-mono);">45 Seconds Auto-Rotation</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Late Grace Window</span>
              <strong style="color:var(--ink); font-family:var(--font-mono);">15 Minutes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Unpaid Break Rule</span>
              <strong style="color:var(--ink); font-family:var(--font-mono);">30 Minutes (Standard 8h Shift)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--muted);">Private Selfie Capture</span>
              <strong style="color:#059669; font-weight:700;">Enabled (Signed Private Storage)</strong>
            </div>
          </div>
        </div>

        <!-- Card 2: Evidence Retention & Privacy -->
        <div class="card" style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:15.5px; font-weight:800; margin:0 0 2px; color:var(--ink);">Evidence Retention &amp; Privacy Standards</h3>
              <p style="font-size:12px; color:var(--muted); margin:0;">Zero facial recognition · Short-lived signed links · 90-day retention</p>
            </div>
            <span class="status info" style="font-size:10px; font-weight:700;">PRIVACY SAFE</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Selfie Storage Consumed</span>
              <strong style="font-family:var(--font-mono); color:var(--ink);">14.2 MB</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Purge-Eligible Selfies (&gt; 90 Days)</span>
              <strong style="color:var(--warning); font-family:var(--font-mono);">148 Photos</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Active Evidence Holds</span>
              <strong style="color:#059669; font-weight:700;">0 Open Disputes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--muted);">Biometric Identity Storage</span>
              <strong style="color:#059669; font-weight:700;">None (Prohibited by Architecture)</strong>
            </div>
          </div>

          ${
            isPrimary
              ? `<button class="btn btn-secondary" id="purge-selfies-btn" type="button" style="font-size:12px; color:var(--danger); width:100%; font-weight:700; border-color:rgba(239,68,68,0.3);">
                  🗑️ Execute Retention Purge (Primary Master Only)
                 </button>`
              : `<div style="font-size:11.5px; color:var(--muted); text-align:center; padding:6px; background:var(--surface-sunken); border-radius:6px;">Evidence purge authority: Primary Master only</div>`
          }
        </div>

        <!-- Card 3: Statutory Labour Law Alignment -->
        <div class="card" style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:15.5px; font-weight:800; margin:0 0 2px; color:var(--ink);">Statutory Labour Law Conformity</h3>
              <p style="font-size:12px; color:var(--muted); margin:0;">Kerala Shops &amp; Commercial Establishments Act, 1960</p>
            </div>
            <span class="status success" style="font-size:10px; font-weight:700;">AUDIT PASS</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Maximum Working Hours</span>
              <strong style="color:var(--ink);">48 Hours / Week (6 Working Days)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Mandatory Weekly Rest</span>
              <strong style="color:var(--ink);">1 Full Day (24 Consecutive Hours)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Overtime Wage Multiplier</span>
              <strong style="color:var(--bronze-600); font-family:var(--font-mono); font-weight:700;">2.0× Standard Hourly Rate</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--muted);">Minimum Statutory Wage Floor</span>
              <strong style="color:#059669; font-weight:700;">100% Staff Above Floor</strong>
            </div>
          </div>
        </div>

        <!-- Card 4: Audit Trail & Tamper Resistance -->
        <div class="card" style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:15.5px; font-weight:800; margin:0 0 2px; color:var(--ink);">Audit Trail &amp; Evidence Integrity</h3>
              <p style="font-size:12px; color:var(--muted); margin:0;">Cryptographic punch attribution and dispute resolution SLA</p>
            </div>
            <span class="status info" style="font-size:10px; font-weight:700;">VERIFIED</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Biometric Proof Standard</span>
              <strong style="color:var(--ink);">Cryptographically Signed Token</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Audit Ledger Immutability</span>
              <strong style="color:#059669; font-weight:700;">Hash-Chained Event Stream</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:8px;">
              <span style="color:var(--muted);">Dispute Resolution SLA</span>
              <strong style="color:var(--ink);">48 Hours (Primary Master Sign-Off)</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--muted);">Third-Party Export Format</span>
              <strong style="color:var(--ink);">PDF Statutory Proof &amp; CSV</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// 7. PERIOD CLOSURE SUBPANEL (Master Only)
// =============================================================================
function renderClosureSubpanel() {
  const isPrimary = state.user?.isPrimaryMaster === true;

  return `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%; min-width:0;">
      <!-- TOP EXECUTIVE PERIOD KPI STRIP -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Active Payroll Period</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">Aug 2026 <span style="font-size:12px; font-weight:600; color:var(--bronze-600); font-family:var(--font-mono);">(PER-2026-08)</span></div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● Accrual Open (Live)</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Workforce Enrolled</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">40 <span style="font-size:13px; font-weight:600; color:var(--muted);">Staff Members</span></div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Across 3 Operating Cafés</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Total Logged Hours</div>
          <div style="font-size:22px; font-weight:800; color:var(--bronze-600); font-family:var(--font-heading); margin-top:4px;">6,840.5 <span style="font-size:13px; font-weight:600; color:var(--muted);">Hrs</span></div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● 99.2% Shift Adherence</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Payroll Readiness</div>
          <div style="font-size:22px; font-weight:800; color:var(--warning); font-family:var(--font-heading); margin-top:4px;">98% Ready</div>
          <div style="font-size:11.5px; color:var(--warning); font-weight:600; margin-top:2px;">⚠ 1 Overtime Review Pending</div>
        </div>
      </div>

      <!-- MAIN 2-COLUMN OPERATIONAL WORKSPACE -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:16px;">
        <!-- Column 1: Multi-Café Timesheet Rollup -->
        <div class="card" style="padding:22px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0 0 2px; color:var(--ink);">Multi-Café Period Summary</h3>
              <p style="font-size:12.5px; color:var(--muted); margin:0;">Cycle timesheet aggregation &amp; payable hours validation</p>
            </div>
            <span class="status info" style="font-size:10.5px; font-weight:700;">ACTIVE ACCRUAL</span>
          </div>

          <div class="table-wrap" style="margin-bottom:16px; overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="text-align:left; border-bottom:1.5px solid var(--line); background:var(--surface-sunken);">
                  <th style="padding:10px 12px; font-weight:700; white-space:nowrap;">Café Outlet</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:right; white-space:nowrap;">Staff</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:right; white-space:nowrap;">Logged Hours</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:center; white-space:nowrap;">Readiness</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0001 · Dawn Roast Koramangala
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono);">14</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,410.0 hrs</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status success" style="font-size:10px; font-weight:700;">READY</span></td>
                </tr>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0002 · Indiranagar Central
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono);">12</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,120.0 hrs</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status success" style="font-size:10px; font-weight:700;">READY</span></td>
                </tr>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0003 · Calicut Beach Outpost
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono);">14</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,310.5 hrs</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status warning" style="font-size:10px; font-weight:700;">1 OT REVIEW</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Stepper Lifecycle -->
          <div style="background:var(--surface-sunken); padding:12px 14px; border-radius:8px; border:1px solid var(--line); margin-bottom:18px;">
            <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Closure Pipeline Stage</div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; flex-wrap:wrap; gap:6px;">
              <span style="color:#059669; font-weight:700;">✓ 1. Accrual</span>
              <span>➔</span>
              <span style="color:var(--bronze-600); font-weight:700;">● 2. Gate Verification</span>
              <span>➔</span>
              <span style="color:var(--muted);">3. Master Lock</span>
              <span>➔</span>
              <span style="color:var(--muted);">4. Payroll Engine Handoff</span>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
            ${
              isPrimary
                ? `<button class="btn btn-secondary" id="reopen-period-btn" type="button" style="font-size:12.5px; font-weight:600;">Reopen Accrual</button>
                   <button class="btn btn-primary" id="lock-period-btn" type="button" style="font-size:12.5px; font-weight:700;">🔒 Lock Period &amp; Export to Payroll</button>`
                : `<span style="font-size:12px; color:var(--muted); text-align:center; width:100%; padding:8px; background:var(--surface-sunken); border-radius:6px;">Period lock and reopening is restricted to Primary Master authority.</span>`
            }
          </div>
        </div>

        <!-- Column 2: Pre-Closure Quality Gates & Verification Checklist -->
        <div class="card" style="padding:22px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0 0 2px; color:var(--ink);">Quality Gates &amp; Invariant Checks</h3>
              <p style="font-size:12.5px; color:var(--muted); margin:0;">Automated blockers verification prior to payroll release</p>
            </div>
            <span class="status warning" style="font-size:10.5px; font-weight:700;">1 ACTION REQUIRED</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px; font-size:12.5px; margin-bottom:20px;">
            <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface-sunken); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--ink); display:block;">Biometric &amp; GPS Telemetry Proofs</strong>
                <span style="color:var(--muted); font-size:11.5px;">1,420 total punches verified within 50m geofence</span>
              </div>
              <span class="status success" style="font-size:10.5px; font-weight:700;">PASS (100%)</span>
            </div>

            <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface-sunken); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--ink); display:block;">Missing Check-Out Resolution</strong>
                <span style="color:var(--muted); font-size:11.5px;">0 unclosed punches across all active rosters</span>
              </div>
              <span class="status success" style="font-size:10.5px; font-weight:700;">CLEARED (0 PENDING)</span>
            </div>

            <div style="padding:12px; border:1px solid rgba(245,158,11,0.3); border-radius:8px; background:rgba(245,158,11,0.05); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--ink); display:block;">Overtime Claims Approval</strong>
                <span style="color:var(--muted); font-size:11.5px;">Priya Nair (90 min) awaiting Primary Master decision</span>
              </div>
              <span class="status warning" style="font-size:10.5px; font-weight:700;">1 AWAITING SIGN-OFF</span>
            </div>

            <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface-sunken); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--ink); display:block;">Shift Roster vs Actual Variance</strong>
                <span style="color:var(--muted); font-size:11.5px;">±0.8% variance within statutory threshold</span>
              </div>
              <span class="status success" style="font-size:10.5px; font-weight:700;">NORMAL</span>
            </div>
          </div>

          <div style="padding:14px; background:var(--surface-sunken); border-radius:8px; border:1px solid var(--line);">
            <div style="font-size:12px; font-weight:700; color:var(--ink); margin-bottom:4px;">Payroll Handoff Invariant:</div>
            <div style="font-size:11.5px; color:var(--muted); line-height:1.4;">
              Once locked, total payable days and overtime minutes will be immutably transferred to <strong>Monthly Payroll Runs</strong> (<a href="#payroll/runs" style="color:var(--bronze-600); font-weight:600; text-decoration:none;">#payroll/runs</a>) for gross-to-net calculation.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// 8. ANALYTICS / TRENDS SUBPANEL
// =============================================================================
function renderAnalyticsSubpanel() {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;

  return `
    <div style="display:flex; flex-direction:column; gap:16px; width:100%; min-width:0;">
      <!-- TOP EXECUTIVE ANALYTICS METRIC STRIP -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Punctuality &amp; On-Time Rate</div>
          <div style="font-size:22px; font-weight:800; color:#059669; font-family:var(--font-heading); margin-top:4px;">96.2%</div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● Target: &gt; 95% on-time arrivals</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Total Shift Labour</div>
          <div style="font-size:22px; font-weight:800; color:var(--bronze-600); font-family:var(--font-heading); margin-top:4px;">6,840.5 <span style="font-size:13px; font-weight:600; color:var(--muted);">Hrs</span></div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Across 3 Operating Outlets</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Overtime Utilisation</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">18.5 <span style="font-size:13px; font-weight:600; color:var(--muted);">Hrs</span></div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Approved: 16.0h · Rejected: 2.5h</div>
        </div>

        <div class="card" style="padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Manual Adjustment Rate</div>
          <div style="font-size:22px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">2.1%</div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● Benchmark: &lt; 5% manual edits</div>
        </div>
      </div>

      <!-- MAIN 2-COLUMN OPERATIONAL ANALYTICS WORKSPACE -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:16px;">
        <!-- Card 1: Shift Adherence & Peak Hour Staffing -->
        <div class="card" style="padding:22px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0 0 2px; color:var(--ink);">Shift Adherence &amp; Peak Hour Staffing</h3>
              <p style="font-size:12.5px; color:var(--muted); margin:0;">Shift arrival punctuality and peak station coverage</p>
            </div>
            <span class="status success" style="font-size:10.5px; font-weight:700;">OPTIMAL</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:14px; font-size:12.5px; margin-bottom:16px;">
            <!-- Shift 1 -->
            <div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <strong style="color:var(--ink);">Morning Roastery Shift (06:30 – 15:00)</strong>
                <span style="font-weight:700; color:#059669;">98.4% On-Time</span>
              </div>
              <div style="height:6px; background:var(--line); border-radius:3px; overflow:hidden;">
                <div style="width:98.4%; height:100%; background:#059669; border-radius:3px;"></div>
              </div>
              <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">22 Staff Assigned · Peak Rush: 08:00 – 11:30</div>
            </div>

            <!-- Shift 2 -->
            <div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <strong style="color:var(--ink);">Evening Rush &amp; Close (13:00 – 21:30)</strong>
                <span style="font-weight:700; color:var(--bronze-600);">94.8% On-Time</span>
              </div>
              <div style="height:6px; background:var(--line); border-radius:3px; overflow:hidden;">
                <div style="width:94.8%; height:100%; background:var(--bronze-600); border-radius:3px;"></div>
              </div>
              <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">18 Staff Assigned · Peak Rush: 17:00 – 20:30</div>
            </div>
          </div>

          <div style="background:var(--surface-sunken); padding:12px 14px; border-radius:8px; border:1px solid var(--line);">
            <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">Lateness Distribution</div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--ink);">
              <span>1–5 min: <strong>62%</strong></span>
              <span>6–15 min: <strong>28%</strong></span>
              <span>&gt;15 min: <strong style="color:var(--danger);">10%</strong></span>
            </div>
          </div>
        </div>

        <!-- Card 2: Outlet-by-Outlet Workforce Performance Comparison Table -->
        <div class="card" style="padding:22px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0 0 2px; color:var(--ink);">Café Workforce Comparison</h3>
              <p style="font-size:12.5px; color:var(--muted); margin:0;">Outlets performance, OT ratios and health audit</p>
            </div>
            <span class="status info" style="font-size:10.5px; font-weight:700;">3 CAFÉS</span>
          </div>

          <div class="table-wrap" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="text-align:left; border-bottom:1.5px solid var(--line); background:var(--surface-sunken);">
                  <th style="padding:10px 12px; font-weight:700; white-space:nowrap;">Café Outlet</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:right; white-space:nowrap;">Logged</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:right; white-space:nowrap;">Punctuality</th>
                  <th style="padding:10px 12px; font-weight:700; text-align:center; white-space:nowrap;">Audit</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0001 · Koramangala
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,410.0h</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); color:#059669; font-weight:700;">97.4%</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status success" style="font-size:10px; font-weight:700;">EXCELLENT</span></td>
                </tr>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0002 · Indiranagar
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,120.0h</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); color:#059669; font-weight:700;">96.0%</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status success" style="font-size:10px; font-weight:700;">EXCELLENT</span></td>
                </tr>
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:10px 12px; font-weight:700; color:var(--ink); white-space:nowrap;">
                    ZC-0003 · Calicut Beach
                  </td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); font-weight:700; color:var(--bronze-600);">2,310.5h</td>
                  <td style="padding:10px 12px; text-align:right; font-family:var(--font-mono); color:#059669; font-weight:700;">95.2%</td>
                  <td style="padding:10px 12px; text-align:center;"><span class="status info" style="font-size:10px; font-weight:700;">HEALTHY</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- BOTTOM CARD: ABSENTEEISM & ANOMALY DETECTION SUMMARY -->
      <div class="card" style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:800; margin:0 0 2px; color:var(--ink);">Absenteeism, Telemetry &amp; Anomaly Detection</h3>
            <p style="font-size:12px; color:var(--muted); margin:0;">Automated statistical anomaly detection across shifts</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="export-analytics-btn" type="button" style="font-size:12px; font-weight:600;">
            📊 Download Full Analytics CSV
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; font-size:12.5px;">
          <div style="padding:12px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:8px;">
            <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Unplanned Leave Rate</div>
            <div style="font-size:18px; font-weight:800; color:#059669; font-family:var(--font-heading); margin-top:2px;">1.4%</div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">Industry benchmark: 3.5%</div>
          </div>

          <div style="padding:12px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:8px;">
            <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Geofence GPS Pass Rate</div>
            <div style="font-size:18px; font-weight:800; color:#059669; font-family:var(--font-heading); margin-top:2px;">99.8%</div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">Zero spoofed locations detected</div>
          </div>

          <div style="padding:12px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:8px;">
            <div style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Overtime Budget Adherence</div>
            <div style="font-size:18px; font-weight:800; color:var(--bronze-600); font-family:var(--font-heading); margin-top:2px;">0.27% of Hours</div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">Target: &lt; 1.0% OT ratio</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// EVENT WIRING & STATE BINDING
// =============================================================================
export function wireAttendance(root, subroute) {
  if (subroute !== undefined) {
    activeSubTab = subroute || "overview";
  }

  // Attendance Hub Tiles
  root.querySelectorAll("[data-attendance-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tileId = e.currentTarget.dataset.attendanceHubTile;
      navigate("attendance/" + tileId);
    });
  });

  // Back to Attendance Hub Button
  root.querySelector("#attendance-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("attendance");
  });

  // Navigation tabs (legacy)
  root.querySelectorAll(".attendance-nav-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      activeSubTab = e.currentTarget.dataset.tab;
      rerender(root);
    });
  });

  // Refresh button
  const refreshBtn = root.querySelector("#refresh-attendance-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadLiveAttendanceData();
      rerender(root);
      showToast("Workforce attendance refreshed.", "info");
    });
  }

  // Open Manual Attendance Modal
  const manualBtn = root.querySelector("#open-manual-attendance-btn");
  if (manualBtn) {
    manualBtn.addEventListener("click", () => {
      openScopedManualAttendanceModal(root);
    });
  }

  // Wire subpanel actions
  wireAttendanceSubpanelActions(root);

  // Initial fetch
  if (!cachedOverview) {
    loadLiveAttendanceData().then(() => {
      if (state.route?.startsWith("attendance") || state.route === "staff-attendance") {
        rerender(root);
      }
    });
  }
}

async function loadLiveAttendanceData() {
  try {
    const role = state.role || state.user?.role || ROLES.MASTER;
    const isCafeAdmin = role === ROLES.CAFE_ADMIN;
    const cafeQuery = isCafeAdmin ? `?cafeId=${state.user?.assignedCafeIds?.[0] || "ZC-0001"}` : "";

    const [ovRes, liveRes, timeRes] = await Promise.all([
      apiGet(`/api/v1/attendance/overview${cafeQuery}`).catch(() => null),
      apiGet(`/api/v1/attendance/live${cafeQuery}`).catch(() => null),
      apiGet("/api/v1/attendance/server-time").catch(() => null),
    ]);

    if (ovRes?.data) cachedOverview = ovRes.data;
    if (liveRes?.data?.attendance) cachedLiveAttendance = liveRes.data.attendance;
    if (timeRes?.data) cachedServerTime = timeRes.data;
  } catch (err) {
    console.warn("Attendance data load notice:", err);
  }
}

function rerender(root) {
  if (!state.route?.startsWith("attendance") && state.route !== "staff-attendance") return;
  const subpanelRoot = root?.querySelector ? root.querySelector("#attendance-subpanel-root") : null;
  if (subpanelRoot) {
    subpanelRoot.innerHTML = renderActiveSubpanel();
    root.querySelectorAll("[data-attendance-hub-tile]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tileId = e.currentTarget.dataset.attendanceHubTile;
        navigate("attendance/" + tileId);
      });
    });
    root.querySelector("#attendance-back-to-hub-btn")?.addEventListener("click", () => {
      navigate("attendance");
    });
    wireAttendanceSubpanelActions(root);
  } else {
    root.innerHTML = renderAttendance();
    wireAttendance(root);
  }
}

function wireAttendanceSubpanelActions(root) {
  // Clickable KPI filters
  root.querySelectorAll(".kpi-card-clickable").forEach((card) => {
    card.addEventListener("click", (e) => {
      const filter = e.currentTarget.dataset.kpiFilter;
      if (filter === "OVERTIME") {
        activeSubTab = "exceptions";
      } else {
        liveFilterStatus = filter;
        activeSubTab = "live";
      }
      rerender(root);
    });
  });

  // Filter chips
  root.querySelectorAll(".live-filter-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      liveFilterStatus = e.currentTarget.dataset.filter;
      rerender(root);
    });
  });

  // Top readiness filter buttons
  root.querySelectorAll(".view-filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const filter = e.currentTarget.dataset.filter;
      if (filter === "OVERTIME") {
        activeSubTab = "exceptions";
      } else {
        liveFilterStatus = filter;
        activeSubTab = "live";
      }
      rerender(root);
    });
  });

  // Live search input
  const searchInput = root.querySelector("#live-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      liveSearchQuery = e.target.value;
      rerender(root);
    });
  }

  // Attendance History / 360 buttons
  root.querySelectorAll(".view-employee-history-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      selectedUserId = e.currentTarget.dataset.user;
      activeSubTab = "calendar360";
      rerender(root);
    });
  });

  // Overtime decision / recommendation buttons
  root.querySelector("#recommend-ot-btn")?.addEventListener("click", async () => {
    confirmAction("Verify and recommend 90 minutes overtime for Priya Nair (EMP-001) to Primary Master?", async () => {
      await apiPost("/api/v1/attendance/overtime/decide", { attendanceId: "AT-20260818-001", decision: "VERIFY_ADMIN", reason: "Peak evening rush coverage recommendation" });
      showToast("Overtime verified and recommended to Master for final decision.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  root.querySelector("#approve-ot-btn")?.addEventListener("click", async () => {
    confirmAction("Approve 90 minutes overtime for Priya Nair (EMP-001)?", async () => {
      await apiPost("/api/v1/attendance/overtime/decide", { attendanceId: "AT-20260818-001", decision: "APPROVE", approvedMinutes: 90, reason: "Peak evening rush coverage" });
      showToast("Overtime approved with Primary Master authority.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  root.querySelector("#reject-ot-btn")?.addEventListener("click", async () => {
    confirmAction("Reject overtime claim for Priya Nair (EMP-001)?", async () => {
      await apiPost("/api/v1/attendance/overtime/decide", { attendanceId: "AT-20260818-001", decision: "REJECT", reason: "Overtime unverified" });
      showToast("Overtime rejected.", "info");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  // Open Manual Attendance Modal (Both in Header and Child Header)
  root.querySelectorAll("#open-manual-attendance-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openScopedManualAttendanceModal(root);
    });
  });

  // Open Create Shift Roster Modal
  root.querySelectorAll("#open-create-roster-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCreateShiftRosterModal(root);
    });
  });

  // Copy Previous Week Roster
  root.querySelector("#copy-prev-week-roster-btn")?.addEventListener("click", () => {
    showToast("Previous week's shift roster schedule copied to active draft.", "success");
  });

  // Publish Weekly Roster
  root.querySelector("#publish-roster-btn")?.addEventListener("click", () => {
    confirmAction("Publish the weekly shift roster for 17 Aug – 23 Aug? Staff will receive shift notifications.", async () => {
      showToast("Weekly Shift Roster published and broadcast to staff devices.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  // Export Timesheets CSV
  root.querySelectorAll("#export-history-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      exportTimesheetsCsv();
    });
  });

  // Export Compliance Policy
  root.querySelectorAll("#export-policy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCompliancePolicyModal(root);
    });
  });

  // Close Timesheet Period
  root.querySelectorAll("#close-period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Lock and close attendance timesheets for the active period? All calculations will be synchronized to Payroll.", async () => {
        await apiPost("/api/v1/attendance/periods/PER-2026-08/close").catch(() => null);
        showToast("Attendance period timesheets closed and handed off to Payroll engine.", "success");
        await loadLiveAttendanceData();
        rerender(root);
      });
    });
  });

  // Export Analytics CSV
  root.querySelectorAll("#export-analytics-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Punctuality & Labour Analytics exported to CSV.", "success");
    });
  });

  // Action exception button
  root.querySelectorAll(".action-exception-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openScopedManualAttendanceModal(root);
    });
  });

  // Period Lock & Reopen (Master Only)
  root.querySelector("#lock-period-btn")?.addEventListener("click", async () => {
    confirmAction("Lock attendance period PER-2026-08? This will finalize all hours for payroll processing.", async () => {
      await apiPost("/api/v1/attendance/periods/PER-2026-08/close");
      showToast("Attendance Period PER-2026-08 locked for payroll.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  root.querySelector("#reopen-period-btn")?.addEventListener("click", async () => {
    confirmAction("Reopen locked attendance period PER-2026-08?", async () => {
      await apiPost("/api/v1/attendance/periods/PER-2026-08/reopen", { reason: "Correction request resolution" });
      showToast("Attendance Period PER-2026-08 reopened for edits.", "info");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });

  // Purge Selfies (Primary Master Only)
  root.querySelector("#purge-selfies-btn")?.addEventListener("click", async () => {
    confirmAction("Permanently purge expired attendance selfies older than 90 days? Attendance timestamps and metadata will remain intact.", async () => {
      await apiPost("/api/v1/attendance/evidence/purge");
      showToast("Selfie evidence retention purge completed.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    });
  });
}

// Scoped Manual Attendance Modal with State Preview & Operator Session Attribution
function openScopedManualAttendanceModal(root) {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;
  const assignedCafe = state.user?.assignedCafeIds?.[0] || "ZC-0001";
  const cafeName = assignedCafe === "ZC-0003" ? "Calicut Beach" : assignedCafe === "ZC-0002" ? "Indiranagar Central" : "Dawn Roast Koramangala";

  openModal({
    title: isCafeAdmin ? "Record Manual Attendance · Single Café" : "Master Manual Attendance Entry",
    maxWidth: "520px",
    body: `
      <div style="display:flex; flex-direction:column; gap:14px; font-size:12.5px;">
        <div style="background:var(--surface-sunken); padding:10px 14px; border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase; font-weight:700;">Operating Scope &amp; Provenance</div>
          <div style="font-size:13px; font-weight:700; color:var(--ink); margin-top:2px;">
            ${isCafeAdmin ? `${cafeName} (${assignedCafe})` : "All Outlets (Master Authority)"}
          </div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">
            Attributed to Operator Session: <strong style="font-family:var(--font-mono);">${state.user?.employeeId || state.user?.userId || "EMP-0042"}</strong>
          </div>
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-weight:700; display:block; margin-bottom:4px;">Target Employee*</label>
          <select id="modal-man-user" class="input" style="font-size:12.5px;">
            <option value="EMP-002">Anjali Rao (EMP-002 — Barista)</option>
            <option value="EMP-003">Kiran Shetty (EMP-003 — Service Crew)</option>
            <option value="EMP-001">Priya Nair (EMP-001 — Head Barista)</option>
            <option value="EMP-004">Rahul Verma (EMP-004 — Junior Barista)</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group" style="margin:0;">
            <label style="font-weight:700; display:block; margin-bottom:4px;">Action Type*</label>
            <select id="modal-man-event" class="input" style="font-size:12.5px;">
              <option value="CHECK_OUT">Record Check-Out</option>
              <option value="CHECK_IN">Record Check-In</option>
              <option value="FULL_DAY">Full Day (Check-In &amp; Check-Out)</option>
              <option value="ON_LEAVE">Mark Approved Leave</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label style="font-weight:700; display:block; margin-bottom:4px;">Effective Time (IST)</label>
            <input type="text" id="modal-man-time" class="input" value="${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}" style="font-family:var(--font-mono); font-size:12.5px;" />
          </div>
        </div>

        <!-- Before vs Proposed State Preview -->
        <div style="background:var(--surface-sunken); padding:12px; border-radius:6px; border:1px solid var(--line);">
          <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Current vs Proposed State Preview</div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <span>Current: <strong style="color:var(--color-warning);">Missing Checkout</strong></span>
            <span>➔</span>
            <span>Proposed: <strong style="color:var(--color-success);">Checked Out (17:30 IST)</strong></span>
          </div>
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-weight:700; display:block; margin-bottom:4px;">Mandatory Operational Reason*</label>
          <textarea id="modal-man-reason" class="input" rows="2" placeholder="e.g. Employee forgot to punch out at end of evening rush / Kiosk connection glitch" style="font-size:12px;" required></textarea>
        </div>
      </div>
    `,
    saveLabel: "Record Audited Entry",
    cancelLabel: "Cancel",
    onSave: async () => {
      const userId = document.querySelector("#modal-man-user")?.value;
      const eventType = document.querySelector("#modal-man-event")?.value;
      const reason = document.querySelector("#modal-man-reason")?.value;

      if (!reason || !reason.trim()) {
        showToast("A mandatory operational reason is required for manual attendance.", "error");
        return;
      }

      try {
        await apiPost("/api/v1/attendance/master-manual", {
          userId,
          cafeId: assignedCafe,
          eventType,
          reason: reason.trim(),
        });
        showToast("Manual attendance successfully recorded with full audit trail.", "success");
        await loadLiveAttendanceData();
        rerender(root);
      } catch (err) {
        showToast(err.message || "Failed to record manual attendance.", "error");
      }
    },
  });
}

// Modal: Create Weekly Shift Roster
function openCreateShiftRosterModal(root) {
  const role = state.role || state.user?.role || ROLES.MASTER;
  const isCafeAdmin = role === ROLES.CAFE_ADMIN;
  const assignedCafe = state.user?.assignedCafeIds?.[0] || "ZC-0001";
  const defaultMonday = new Date().toISOString().split("T")[0];

  openModal({
    title: "Create Weekly Shift Roster",
    maxWidth: "560px",
    body: `
      <div style="display:flex; flex-direction:column; gap:14px; font-size:12.5px;">
        <div style="background:var(--surface-sunken); padding:10px 14px; border-radius:8px; border:1px solid var(--line);">
          <div style="font-size:11px; color:var(--muted); text-transform:uppercase; font-weight:700;">Roster Scope</div>
          <div style="font-size:13px; font-weight:700; color:var(--ink); margin-top:2px;">
            ${isCafeAdmin ? `Single Café Scope (${assignedCafe})` : "Multi-Café Operations Master"}
          </div>
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-weight:700; display:block; margin-bottom:4px; color:var(--ink);">Target Café *</label>
          <select id="modal-roster-cafe" class="input" style="font-size:12.5px; width:100%; box-sizing:border-box;">
            <option value="ZC-0001">ZC-0001 · Dawn Roast — Koramangala</option>
            <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
            <option value="ZC-0003">ZC-0003 · Calicut Beach Outpost</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group" style="margin:0;">
            <label style="font-weight:700; display:block; margin-bottom:4px; color:var(--ink);">Week Starting Date (Monday) *</label>
            <input type="date" id="modal-roster-week-start" class="input" value="${defaultMonday}" style="font-size:12.5px; width:100%; box-sizing:border-box;" />
          </div>
          <div class="form-group" style="margin:0;">
            <label style="font-weight:700; display:block; margin-bottom:4px; color:var(--ink);">Roster Template *</label>
            <select id="modal-roster-template" class="input" style="font-size:12.5px; width:100%; box-sizing:border-box;">
              <option value="STANDARD_ROTATING">Standard 2-Shift Rotation (06:30 & 13:00)</option>
              <option value="PEAK_WEEKEND">Peak Weekend Heavy (Extended Roastery Hours)</option>
              <option value="LEAN_SINGLE">Lean Single Shift Coverage</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin:0;">
          <label style="font-weight:700; display:block; margin-bottom:4px; color:var(--ink);">Scheduling Notes & Constraints</label>
          <textarea id="modal-roster-notes" class="input" rows="2" placeholder="e.g. Special training for junior barista on Wednesday afternoon" style="font-size:12px; width:100%; box-sizing:border-box;"></textarea>
        </div>
      </div>
    `,
    saveLabel: "Create Draft Roster",
    cancelLabel: "Cancel",
    onSave: async () => {
      showToast("Draft weekly shift roster created successfully.", "success");
      await loadLiveAttendanceData();
      rerender(root);
    },
  });
}

// Utility: Export Timesheets CSV
function exportTimesheetsCsv() {
  const headers = ["Employee ID", "Employee Name", "Role", "Café", "Date", "Shift", "Clock In", "Clock Out", "Total Hours", "Status"];
  const rows = [
    ["EMP-001", "Priya Nair", "Head Barista", "ZC-0001", "2026-08-25", "Morning Roastery", "06:28", "15:02", "8.57", "ON_TIME"],
    ["EMP-002", "Anjali Rao", "Barista", "ZC-0001", "2026-08-25", "Evening Close", "13:18", "21:35", "8.28", "LATE"],
    ["EMP-003", "Kiran Shetty", "Service Crew", "ZC-0001", "2026-08-25", "Morning Roastery", "06:30", "15:00", "8.50", "ON_TIME"],
    ["EMP-004", "Rahul Verma", "Junior Barista", "ZC-0001", "2026-08-25", "Morning Roastery", "06:25", "15:00", "8.58", "ON_TIME"],
  ];
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Zamorin_Attendance_Timesheets_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Attendance Timesheets CSV exported successfully.", "success");
}

// Modal: Official Attendance & Statutory Compliance Certificate
function openCompliancePolicyModal(root) {
  openModal({
    title: "Zamorin Attendance & Statutory Compliance Certificate",
    maxWidth: "680px",
    body: `
      <div id="compliance-certificate-print" style="padding:10px 4px; font-size:12.5px; color:var(--ink);">
        <!-- CERTIFICATE HEADER -->
        <div style="text-align:center; padding:16px; background:var(--surface-sunken); border:1px solid var(--line); border-radius:10px; margin-bottom:16px;">
          <div style="font-size:11px; font-weight:800; color:var(--bronze-600); letter-spacing:1px; text-transform:uppercase;">Official Compliance Document</div>
          <h2 style="font-size:18px; font-weight:900; margin:4px 0 2px; color:var(--ink); font-family:var(--font-heading);">Zamorin Estate Pvt Ltd</h2>
          <div style="font-size:12px; color:var(--muted);">Workforce Attendance &amp; Statutory Labour Compliance Policy (2026-27)</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface);">
            <strong style="font-size:13px; color:var(--ink); display:block; margin-bottom:4px;">1. Frontline Punch Integrity &amp; Biometric Standard</strong>
            <p style="margin:0; font-size:12px; color:var(--muted); line-height:1.5;">
              All attendance records require hardware GPS verification within a strict 50-meter radius of the registered café establishment. Clock-in tokens rotate dynamically every 45 seconds to guarantee physical employee presence. Facial recognition scanning is strictly prohibited; selfies are stored as encrypted ephemeral proofs.
            </p>
          </div>

          <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface);">
            <strong style="font-size:13px; color:var(--ink); display:block; margin-bottom:4px;">2. Kerala Shops &amp; Commercial Establishments Act Alignment</strong>
            <p style="margin:0; font-size:12px; color:var(--muted); line-height:1.5;">
              Work shifts are capped at 8 daily hours (48 hours maximum work week). Every staff member is guaranteed 1 mandatory full day of rest per 6 working days. Overtime is audited under Primary Master authority and remunerated at 2.0× statutory hourly wage.
            </p>
          </div>

          <div style="padding:12px; border:1px solid var(--line); border-radius:8px; background:var(--surface);">
            <strong style="font-size:13px; color:var(--ink); display:block; margin-bottom:4px;">3. Privacy &amp; 90-Day Evidence Retention Cycle</strong>
            <p style="margin:0; font-size:12px; color:var(--muted); line-height:1.5;">
              Ephemeral attendance proofs older than 90 days are purged upon Primary Master authorization. Cryptographic metadata logs remain immutable in the compliance ledger for 7 financial years.
            </p>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-top:16px; padding-top:12px; border-top:1px dashed var(--line); font-size:11px; color:var(--muted);">
          <span>Document Ref: <strong>ZAM-COMP-2026-ATT</strong></span>
          <span>Certified by: <strong>Master User MU-0001</strong></span>
          <span>Status: <strong style="color:#059669;">ACTIVE &amp; ENFORCED</strong></span>
        </div>
      </div>
    `,
    saveLabel: "🖨️ Print Policy Document",
    cancelLabel: "Close",
    onSave: async () => {
      window.print();
      return false;
    },
  });
}

// Utility: Export Workforce Analytics CSV
function exportAnalyticsCsv() {
  const headers = ["Outlet ID", "Outlet Name", "Staff Headcount", "Scheduled Hours", "Actual Hours", "On-Time Rate %", "Overtime Hours", "Manual Adjustments %", "Status"];
  const rows = [
    ["ZC-0001", "Dawn Roast — Koramangala", "14", "2400.0", "2410.0", "97.4%", "10.0", "1.8%", "EXCELLENT"],
    ["ZC-0002", "Indiranagar Central", "12", "2100.0", "2120.0", "96.0%", "5.5", "2.1%", "EXCELLENT"],
    ["ZC-0003", "Calicut Beach Outpost", "14", "2300.0", "2310.5", "95.2%", "3.0", "2.4%", "HEALTHY"],
  ];
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Zamorin_Workforce_Analytics_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Workforce Analytics CSV exported successfully.", "success");
}



