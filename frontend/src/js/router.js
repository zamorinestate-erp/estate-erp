// =============================================================================
// ZAMORIN CAFE ERP — ROUTER
//
// Enforces the route-layer check from Part B.3: every navigation re-checks
// the current role against NAVIGATION before rendering anything. The shell
// (sidebar + topbar) is mounted once in main.js and never remounted here —
// only #page-content is replaced, which is the direct fix for Part H.3
// ("switching sidebar items must never trigger a full reload").
// =============================================================================

import { state, setState } from "./state.js";
import { NAVIGATION, isRouteAllowed, ROLES } from "./navigation.js";
import { renderSidebar, wireSidebar, renderTopbar, wireBell, updateBellBadge } from "./components.js";
import { renderNotificationCentre, wireNotificationCentre } from "./pages/notificationCentre.js";
import { icon } from "./icons.js";
import { renderMasterDashboard, hydrateMasterDashboard } from "./pages/dashboardMaster.js";
import { renderAdminDashboard } from "./pages/dashboardAdmin.js";
import { renderStaffHome, wireStaffHome } from "./pages/staffHome.js";
import { renderStaffSettings, wireStaffSettings } from "./pages/staffSettings.js";
import { renderSettingsShared, wireSettingsShared } from "./pages/settingsShared.js";
import { renderPOS, wirePOS } from "./pages/posTill.js";
import { renderInventory, wireInventory } from "./pages/inventory.js";
import { renderExpenses, wireExpenses } from "./pages/expenses.js";
import { renderFinance } from "./pages/financeAccounts.js";
import { renderLedger, wireLedger } from "./pages/personalLedger.js";
import { renderEmployees, wireEmployees } from "./pages/employees.js";
import { renderAttendance } from "./pages/attendanceShifts.js";
import { renderReports, wireReports } from "./pages/reportsAnalytics.js";
import { renderAdmin, wireAdmin } from "./pages/administration.js";
import { renderCashBook, wireCashBook } from "./pages/cashBook.js";
import { renderTasks, wireTasks } from "./pages/tasksApprovals.js";
import { renderPerformance } from "./pages/cafePerformance.js";
import { renderStaffAttendance, wireStaffAttendance } from "./pages/staffAttendance.js";
import { renderStaffLeave, wireStaffLeave } from "./pages/staffLeave.js";
import { renderStaffPayslips, wireStaffPayslips } from "./pages/staffPayslips.js";
import { renderAnnouncements, wireAnnouncements } from "./pages/announcements.js";
import { renderNotAvailable, renderNotBuiltYet } from "./pages/notAvailable.js";

const ROLE_LABELS = {
  [ROLES.MASTER]: "Master",
  [ROLES.OWNER]: "Owner",
  [ROLES.CAFE_ADMIN]: "Ravi",
  [ROLES.STAFF]: "Priya",
};

export function navigate(route) {
  // Route-layer guard: deny by default, exactly per Part B.3 / Part R's
  // closing rule ("any action not explicitly marked defaults to no access").
  // "notifications" is the one deliberate exception — every authenticated
  // role reaches it through the bell, not through a sidebar item, so it's
  // not listed in any role's NAVIGATION config.
  if (route !== "notifications" && !isRouteAllowed(state.role, route)) {
    setState({ route: "__blocked__" });
    renderShell();
    return;
  }
  setState({ route });
  renderShell();
}

export function renderShell() {
  const isStaffShell = state.role === ROLES.STAFF;
  const app = document.getElementById("app");
  app.classList.toggle("shell-minimal", isStaffShell);

  if (isStaffShell) {
    app.innerHTML = `
      <div id="page-content" style="grid-column:1; padding-bottom:90px;"></div>
      <div id="staff-tabbar" class="glass-dark" style="position:fixed; bottom:16px; left:50%; transform:translateX(-50%); width:calc(100% - 32px); max-width:430px; padding:10px; display:flex; justify-content:space-around; z-index:800;"></div>
    `;
    const tabbar = document.getElementById("staff-tabbar");
    tabbar.innerHTML = NAVIGATION[ROLES.STAFF].items
      .map(
        (item) => `
        <div class="nav-item ${state.route === item.route ? "active" : ""}" data-route="${item.route}" data-navid="${item.id}" style="flex-direction:column; gap:4px; padding:8px 6px; font-size:10px; text-align:center;">
          ${icon(item.icon, 18)}
          <span>${item.label}</span>
        </div>`
      )
      .join("");
    tabbar.querySelectorAll(".nav-item").forEach((el) => {
      el.addEventListener("click", () => navigate(el.dataset.route));
    });
  } else {
    // Only rebuild sidebar/topbar containers if they don't already exist for
    // this role — otherwise just update active-state classes (Part H.3).
    if (!document.getElementById("sidebar") || app.dataset.shellRole !== state.role) {
      app.dataset.shellRole = state.role;
      app.innerHTML = `
        <div id="sidebar" class="glass-dark"></div>
        <div id="topbar"></div>
        <div id="page-content"></div>
      `;
      document.getElementById("sidebar").innerHTML = renderSidebar();
      wireSidebar(document.getElementById("sidebar"));
      document.getElementById("topbar").innerHTML = renderTopbar({
        scopeChip: `<div class="pill pill-dark">${state.role === ROLES.MASTER ? "🏠 All Cafes ▾" : "🏠 Dawn Roast — Koramangala"}</div>`,
      });
      wireBell(document.getElementById("topbar"));
      updateBellBadge();
    } else {
      document.getElementById("sidebar").innerHTML = renderSidebar();
      wireSidebar(document.getElementById("sidebar"));
    }
  }

  renderPage();
}

function renderPage() {
  const content = document.getElementById("page-content");
  const route = state.route;
  updateBellBadge();

  if (route === "__blocked__") {
    content.innerHTML = renderNotAvailable();
    return;
  }

  switch (route) {
    case "dashboard":
      if (state.role === ROLES.CAFE_ADMIN) {
        content.innerHTML = renderAdminDashboard();
      } else {
        content.innerHTML = renderMasterDashboard({ roleLabel: ROLE_LABELS[state.role] });
        hydrateMasterDashboard(content);
      }
      break;

    case "staff-home":
      content.innerHTML = renderStaffHome();
      wireStaffHome(content);
      break;

    case "staff-settings":
      content.innerHTML = renderStaffSettings();
      wireStaffSettings(content);
      break;

    case "settings":
      content.innerHTML = renderSettingsShared();
      wireSettingsShared(content);
      break;

    case "pos":
      content.innerHTML = renderPOS();
      wirePOS(content);
      break;

    case "inventory":
      content.innerHTML = renderInventory();
      wireInventory(content);
      break;

    case "expenses":
      content.innerHTML = renderExpenses();
      wireExpenses(content);
      break;

    case "finance":
      content.innerHTML = renderFinance();
      break;

    case "ledger":
      content.innerHTML = renderLedger();
      wireLedger(content);
      break;

    case "employees":
      content.innerHTML = renderEmployees();
      wireEmployees(content);
      break;

    case "attendance":
      content.innerHTML = renderAttendance();
      break;

    case "reports":
      content.innerHTML = renderReports();
      wireReports(content);
      break;

    case "admin":
      content.innerHTML = renderAdmin();
      wireAdmin(content);
      break;

    case "sales-cash":
      content.innerHTML = renderCashBook();
      wireCashBook(content);
      break;

    case "tasks":
      content.innerHTML = renderTasks({ title: "Tasks & Approvals" });
      wireTasks(content);
      break;

    case "approvals":
      content.innerHTML = renderTasks({ title: "Approvals Waiting on You" });
      wireTasks(content);
      break;

    case "performance":
      content.innerHTML = renderPerformance();
      break;

    case "staff-attendance":
      content.innerHTML = renderStaffAttendance();
      wireStaffAttendance(content);
      break;

    case "staff-leave":
      content.innerHTML = renderStaffLeave();
      wireStaffLeave(content);
      break;

    case "staff-payslips":
      content.innerHTML = renderStaffPayslips();
      wireStaffPayslips(content);
      break;

    case "announcements":
      content.innerHTML = renderAnnouncements();
      wireAnnouncements(content);
      break;

    case "notifications":
      content.innerHTML = renderNotificationCentre();
      wireNotificationCentre(content);
      break;

    case "not-built":
      content.innerHTML = renderNotBuiltYet();
      break;

    default:
      content.innerHTML = renderNotAvailable();
  }
}
