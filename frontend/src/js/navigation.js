// =============================================================================
// ZAMORIN CAFE ERP — NAVIGATION CONFIGURATION
//
// This is the single most important file in the whole app. Per the
// Antigravity guideline's Part B.1 and Part F.5: each role's navigation is
// built from its OWN configuration, never from one shared menu with items
// conditionally hidden. If an item is not listed for a role here, it must
// not be reachable by that role anywhere else in the app either — the
// router (router.js) enforces this at the route layer too, not just here.
//
// route:  the hash route this item renders
// scope:  "all" | "own-cafe" | "self" — used by the router as a second,
//         independent check (Part B.3's "three layers" — this file is the
//         navigation layer; router.js is the route layer; a real backend
//         would add the data layer on top of both).
// =============================================================================

export const ROLES = {
  MASTER: "master",
  OWNER: "owner",
  CAFE_ADMIN: "cafe_admin",
  STAFF: "staff",
};

export const NAVIGATION = {
  [ROLES.MASTER]: {
    scopeLabel: "Master View",
    items: [
      { id: "dashboard", label: "Command Centre", icon: "home", route: "dashboard" },
      { id: "pos", label: "POS & Billing", icon: "pos", route: "pos" },
      { id: "finance", label: "Finance & Accounts", icon: "finance", route: "finance" },
      { id: "inventory", label: "Inventory", icon: "inventory", route: "inventory" },
      { id: "expenses", label: "Expenses", icon: "finance", route: "expenses" },
      { id: "employees", label: "Employees", icon: "employees", route: "employees" },
      { id: "my-profile", label: "My Profile", icon: "employees", route: "employee-profile" },
      { id: "attendance", label: "Attendance & Shifts", icon: "attendance", route: "attendance" },
      { id: "payroll", label: "Payroll & Payslips", icon: "payslip", route: "payroll" },
      { id: "my-payslips", label: "My Payslips", icon: "payslip", route: "staff-payslips" },
      { id: "my-loans-advances", label: "My Loans & Advances", icon: "payslip", route: "staff-loans-advances" },
      { id: "reports", label: "Reports & Analytics", icon: "reports", route: "reports" },
      { id: "ledger", label: "Personal Ledger", icon: "ledger", route: "ledger" },
      { id: "admin", label: "Administration", icon: "settings", route: "admin" },
      { id: "settings", label: "Settings & Preferences", icon: "settings", route: "settings" },
    ],
    footnote: "Full access — every cafe, every module, every setting.",
  },

  [ROLES.OWNER]: {
    scopeLabel: "Owner Portal",
    items: [
      { id: "dashboard", label: "Overview", icon: "home", route: "dashboard" },
      { id: "approvals", label: "Approvals Waiting on You", icon: "tasks", route: "approvals" },
      { id: "performance", label: "Cafe Performance", icon: "reports", route: "performance" },
      { id: "employees", label: "Employees", icon: "employees", route: "employees" },
      { id: "my-profile", label: "My Profile", icon: "employees", route: "employee-profile" },
      { id: "finance-summary", label: "Finance Summary", icon: "finance", route: "finance" },
      { id: "payroll", label: "Payroll & Payslips", icon: "payslip", route: "payroll" },
      { id: "my-payslips", label: "My Payslips", icon: "payslip", route: "staff-payslips" },
      { id: "my-loans-advances", label: "My Loans & Advances", icon: "payslip", route: "staff-loans-advances" },
      { id: "ledger", label: "Personal Ledger", icon: "ledger", route: "ledger" },
      { id: "reports", label: "Reports", icon: "reports", route: "reports" },
      { id: "settings", label: "Settings & Preferences", icon: "settings", route: "settings" },
    ],
    // Personal Ledger is available to MASTER and OWNER (ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER).
    // It remains denied for Cafe Admin and Staff.
    footnote: "A separate portal — never Master's platform-admin screens.",
  },

  [ROLES.CAFE_ADMIN]: {
    scopeLabel: "Dawn Roast Cafe",
    items: [
      { id: "dashboard", label: "Command Centre", icon: "home", route: "dashboard" },
      { id: "pos", label: "POS & Billing", icon: "pos", route: "pos" },
      { id: "sales-cash", label: "Sales & Cash", icon: "finance", route: "sales-cash" },
      { id: "expenses", label: "Expenses", icon: "finance", route: "expenses" },
      { id: "inventory", label: "Inventory", icon: "inventory", route: "inventory" },
      { id: "my-profile", label: "My Profile", icon: "employees", route: "employee-profile" },
      { id: "attendance", label: "Attendance & Shifts", icon: "attendance", route: "attendance" },
      { id: "my-payslips", label: "My Payslips", icon: "payslip", route: "staff-payslips" },
      { id: "my-loans-advances", label: "My Loans & Advances", icon: "payslip", route: "staff-loans-advances" },
      { id: "tasks", label: "Tasks & Approvals", icon: "tasks", route: "tasks" },
      { id: "reports", label: "Reports (this cafe)", icon: "reports", route: "reports" },
      { id: "settings", label: "Settings & Preferences", icon: "settings", route: "settings" },
    ],
    footnote: "No Administration, no other cafe, no Personal Ledger.",
  },

  [ROLES.STAFF]: {
    scopeLabel: null, // Staff's mobile shell has no sidebar label — see shell-minimal
    items: [
      { id: "home", label: "Home", icon: "home", route: "staff-home" },
      { id: "attendance", label: "My Attendance", icon: "attendance", route: "staff-attendance" },
      { id: "my-profile", label: "My Profile", icon: "employees", route: "employee-profile" },
      { id: "leave", label: "My Leave", icon: "calendar", route: "staff-leave" },
      { id: "payslips", label: "My Payslips", icon: "payslip", route: "staff-payslips" },
      { id: "loans-advances", label: "My Loans & Advances", icon: "payslip", route: "staff-loans-advances" },
      { id: "announcements", label: "Announcements", icon: "announce", route: "announcements" },
      { id: "settings", label: "Settings", icon: "settings", route: "staff-settings" },
    ],
    footnote: "Self-service only — nothing outside these eight items.",
  },
};

// Explicit deny-list check used by the router. This mirrors Part R's
// permission matrix at a coarse, demo-appropriate level: it proves the
// *mechanism* (route guard denies by default) rather than reproducing
// the full production-grade permission engine.
export function isRouteAllowed(role, route) {
  const allowed = NAVIGATION[role].items.map((i) => i.route);
  return allowed.includes(route);
}
