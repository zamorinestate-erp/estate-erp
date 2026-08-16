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
import { renderSidebar, wireSidebar, renderTopbar, wireBell, updateBellBadge, isSidebarCollapsed } from "./components.js";
import { renderNotificationCentre, wireNotificationCentre } from "./pages/notificationCentre.js";
import { icon } from "./icons.js";
import { renderMasterDashboard, hydrateMasterDashboard } from "./pages/dashboardMaster.js";
import { renderAdminDashboard } from "./pages/dashboardAdmin.js";
import { renderStaffHome, wireStaffHome } from "./pages/staffHome.js";
import { renderStaffSettings, wireStaffSettings } from "./pages/staffSettings.js";
import { renderSettingsShared, wireSettingsShared } from "./pages/settingsShared.js?v=2.0.1";
import { renderPOS, wirePOS } from "./pages/posTill.js?v=2.0.1";
import { renderOwnerBills, wireOwnerBills } from "./pages/ownerBills.js?v=2.0.1";
import { renderInventory, wireInventory } from "./pages/inventory.js?v=2.0.1";
import { renderExpenses, wireExpenses } from "./pages/expenses.js?v=2.0.1";
import { renderFinance, wireFinance } from "./pages/financeAccounts.js?v=2.0.1";
import { renderLedger, wireLedger } from "./pages/personalLedger.js?v=2.0.1";
import { renderEmployees, wireEmployees } from "./pages/employees.js?v=2.0.1";
import { renderEmployeeProfile, wireEmployeeProfile } from "./pages/employeeProfile.js?v=2.0.1";
import { renderAttendance } from "./modules/attendance/attendanceShifts.js?v=2.0.1";
import { renderReports, wireReports } from "./pages/reportsAnalytics.js?v=2.0.1";
import { renderAdmin, wireAdmin } from "./pages/administration.js?v=2.0.1";
import { renderCashBook, wireCashBook } from "./pages/cashBook.js?v=2.0.1";
import { renderTasks, wireTasks } from "./pages/tasksApprovals.js?v=2.0.1";
import { renderPerformance, wirePerformance } from "./pages/cafePerformance.js?v=2.0.1";
import { renderStaffAttendance, wireStaffAttendance } from "./modules/attendance/staffAttendance.js?v=2.0.1";
import { renderStaffLeave, wireStaffLeave } from "./pages/staffLeave.js?v=2.0.1";
import { renderStaffPayslips, wireStaffPayslips } from "./pages/staffPayslips.js?v=2.0.1";
import { renderStaffLoansAdvances, wireStaffLoansAdvances } from "./pages/staffLoansAdvances.js?v=2.0.1";
import { renderPayrollManagement, wirePayrollManagement } from "./pages/payrollManagement.js?v=2.0.1";
import { renderAnnouncements, wireAnnouncements } from "./pages/announcements.js?v=2.0.1";
import { renderNotAvailable, renderNotBuiltYet } from "./pages/notAvailable.js?v=2.0.1";
import { renderVendors, wireVendors } from "./pages/vendors.js?v=2.0.1";
import { renderProcurement, wireProcurement } from "./pages/procurement.js?v=2.0.1";
import { renderMenuManagement, wireMenuManagement } from "./pages/menuManagement.js?v=2.0.1";
import { renderCustomers, wireCustomers } from "./pages/customers.js?v=2.0.1";
import { renderQuality, wireQuality } from "./pages/quality.js?v=2.0.1";
import { renderAssets, wireAssets } from "./pages/assets.js?v=2.0.1";
import { renderDepartmentOrders, wireDepartmentOrders } from "./pages/departmentOrders.js?v=2.0.1";
import { renderTrashBin, wireTrashBin } from "./pages/trashBin.js?v=2.0.1";
import { renderMailOpsCommandCentre, wireMailOpsCommandCentre } from "./pages/mailOpsCommandCentre.js?v=2.0.1";
import { CafeAttendanceDisplayPage } from "./pages/cafeAttendanceDisplay.js?v=2.0.1";

// ROLE_LABELS: display-safe generic labels used only for topbar scope chip
// until /auth/me bootstrap provides the real user's display name.
// "Ravi" and "Priya" were demo sample names — removed in Stage 8 Batch 1.
const ROLE_LABELS = {
  [ROLES.MASTER]: "Master",
  [ROLES.OWNER]: "Owner",
  [ROLES.CAFE_ADMIN]: "Cafe Admin",
  [ROLES.STAFF]: "Staff",
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
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.remove("auth-screen");
  const collapsed = isSidebarCollapsed();

  if (!document.getElementById("sidebar") || app.dataset.shellRole !== state.role) {
    app.dataset.shellRole = state.role;
    app.innerHTML = `
      <div class="app-shell ${collapsed ? "sidebar-collapsed" : ""}">
        <aside id="sidebar" class="sidebar ${collapsed ? "collapsed" : ""}"></aside>
        <main class="main-shell">
          <header id="topbar" class="topbar"></header>
          <div id="page-content" class="page"></div>
        </main>
      </div>
      <div id="modal-root"></div>
      <div id="toast-root" class="toast-stack"></div>
    `;
    const sb = document.getElementById("sidebar");
    const tb = document.getElementById("topbar");
    if (sb) {
      sb.innerHTML = renderSidebar();
      wireSidebar(sb);
    }
    if (tb) {
      tb.innerHTML = renderTopbar();
      wireBell(tb);
      updateBellBadge();
    }
  } else {
    const shell = document.querySelector(".app-shell");
    const sb = document.getElementById("sidebar");
    if (shell) shell.classList.toggle("sidebar-collapsed", collapsed);
    if (sb) {
      sb.classList.toggle("collapsed", collapsed);
      sb.innerHTML = renderSidebar();
      wireSidebar(sb);
    }
  }

  renderPage();
}

async function renderPage() {
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
      await wirePOS(content);
      break;

    case "bills":
      content.innerHTML = renderOwnerBills();
      await wireOwnerBills(content);
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
      wireFinance(content);
      break;

    case "ledger":
    case "personal-ledger":
      if (state.role !== ROLES.MASTER) {
        content.innerHTML = renderNotAvailable();
        break;
      }
      content.innerHTML = renderLedger();
      wireLedger(content);
      break;

    case "employees":
      content.innerHTML = renderEmployees();
      wireEmployees(content);
      break;

    case "employee-profile":
      content.innerHTML = renderEmployeeProfile();
      wireEmployeeProfile(content);
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
      wirePerformance(content);
      break;

    case "staff-attendance":
      content.innerHTML = renderStaffAttendance();
      wireStaffAttendance(content);
      break;

    case "staff-leave":
      content.innerHTML = renderStaffLeave();
      wireStaffLeave(content);
      break;

    case "payroll":
      content.innerHTML = renderPayrollManagement();
      wirePayrollManagement(content);
      break;

    case "staff-payslips":
      content.innerHTML = renderStaffPayslips();
      wireStaffPayslips(content);
      break;

    case "staff-loans-advances":
      content.innerHTML = renderStaffLoansAdvances();
      wireStaffLoansAdvances(content);
      break;

    case "announcements":
      content.innerHTML = renderAnnouncements();
      wireAnnouncements(content);
      break;

    case "notifications":
      content.innerHTML = renderNotificationCentre();
      await wireNotificationCentre(content);
      break;

    case "vendors":
      content.innerHTML = renderVendors();
      wireVendors(content);
      break;

    case "procurement":
      content.innerHTML = renderProcurement();
      wireProcurement(content);
      break;

    case "mailops":
      content.innerHTML = renderMailOpsCommandCentre();
      await wireMailOpsCommandCentre(content);
      break;

    case "menu":
      content.innerHTML = renderMenuManagement();
      wireMenuManagement(content);
      break;

    case "customers":
      content.innerHTML = renderCustomers();
      wireCustomers(content);
      break;

    case "quality":
      content.innerHTML = renderQuality();
      wireQuality(content);
      break;

    case "assets":
      content.innerHTML = renderAssets();
      wireAssets(content);
      break;

    case "dept-orders":
    case "department-orders":
      content.innerHTML = renderDepartmentOrders();
      wireDepartmentOrders(content);
      break;

    case "trash":
      content.innerHTML = renderTrashBin();
      wireTrashBin(content);
      break;

    case "kiosk-attendance":
      const kioskDisplay = new CafeAttendanceDisplayPage();
      kioskDisplay.init(content, {
        deviceId: localStorage.getItem('zamorin_device_id') || 'ACTIVE_KIOSK',
        boundCafeId: localStorage.getItem('zamorin_bound_cafe_id') || 'ZC-0001',
      });
      break;

    case "not-built":
      content.innerHTML = renderNotBuiltYet();
      break;

    default:
      content.innerHTML = renderNotAvailable();
  }
}
