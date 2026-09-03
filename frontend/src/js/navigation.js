// =============================================================================
// ZAMORIN CAFE ERP — NAVIGATION CONFIGURATION
//
// Per the Global Implementation Governance Layer:
//   - Each role's navigation is built from its OWN configuration.
//   - Items not listed for a role here are unreachable by that role anywhere.
//   - Navigation is structured in logical groups (COMMAND, OPERATIONS, PEOPLE,
//     FINANCE, COMMERCIAL, INSIGHTS, ADMINISTRATION, SYSTEM).
//   - Primary Master vs Normal Master distinction is enforced here and in
//     router.js — no 5th/6th role is created.
//   - User-facing CAFE_ADMIN terminology is "Cafe Operations" / "Operator".
//   - My Profile, My Payslip → Avatar menu / Settings (not main sidebar).
//   - My Payslips, My Loans & Advances → Settings → My Employment (not STAFF sidebar).
//   - Trash Bin → Settings → Data & Recovery (not main sidebar).
//   - Department Orders = University/Department/C/o business orders (NOT kitchen).
//
// route:  the hash route this item renders
// group:  logical section label for the sidebar heading
// =============================================================================

export const ROLES = {
  MASTER: 'master',
  OWNER: 'owner',
  CAFE_ADMIN: 'cafe_admin',
  STAFF: 'staff',
};

// ─── Primary Master Navigation ────────────────────────────────────────────────
// Full access — every café, every module, every sensitive finance area.
const PRIMARY_MASTER_ITEMS = [
  // ── COMMAND ─────────────────────────────────────────────────────────────────
  { id: 'dashboard',     label: 'Command Centre',         icon: 'home',         route: 'dashboard',         group: 'COMMAND' },

  // ── OPERATIONS ──────────────────────────────────────────────────────────────
  { id: 'pos',           label: 'POS & Billing',          icon: 'pos',          route: 'pos',               group: 'OPERATIONS' },
  { id: 'approvals',     label: 'Tasks & Oversight',      icon: 'tasks',        route: 'approvals',         group: 'OPERATIONS' },
  { id: 'attendance',    label: 'Attendance & Shifts',    icon: 'attendance',   route: 'attendance',        group: 'OPERATIONS' },
  { id: 'dept-orders',   label: 'Department Orders',      icon: 'deptOrders',   route: 'dept-orders',       group: 'OPERATIONS' },
  { id: 'inventory',     label: 'Inventory',              icon: 'inventory',    route: 'inventory',         group: 'OPERATIONS' },
  { id: 'procurement',   label: 'Procurement',            icon: 'procurement',  route: 'procurement',       group: 'OPERATIONS' },
  { id: 'assets',        label: 'Assets & Maintenance',   icon: 'assets',       route: 'assets',            group: 'OPERATIONS' },
  { id: 'quality',       label: 'Quality & Compliance',   icon: 'quality',      route: 'quality',           group: 'OPERATIONS' },

  // ── PEOPLE ───────────────────────────────────────────────────────────────────
  { id: 'employees',     label: 'Employees',              icon: 'employees',    route: 'employees',         group: 'PEOPLE' },
  { id: 'staff-home',    label: 'Staff Self-Service',     icon: 'user',         route: 'staff-home',        group: 'PEOPLE' },
  { id: 'payroll',       label: 'Payroll & Payslips',     icon: 'payslip',      route: 'payroll',           group: 'PEOPLE', primaryMasterOnly: true },

  // ── FINANCE ──────────────────────────────────────────────────────────────────
  { id: 'bills',         label: 'Bills & Receipts',       icon: 'bills',        route: 'bills',             group: 'FINANCE' },
  { id: 'expenses',      label: 'Expenses',               icon: 'expenses',     route: 'expenses',          group: 'FINANCE' },
  { id: 'sales-cash',    label: 'Sales & Cash Book',      icon: 'finance',      route: 'sales-cash',        group: 'FINANCE' },
  { id: 'finance',       label: 'Finance & Accounts',     icon: 'finance',      route: 'finance',           group: 'FINANCE' },
  { id: 'passbook',      label: 'Passbook & Treasury',    icon: 'passbook',     route: 'passbook',          group: 'FINANCE', primaryMasterOnly: true },
  { id: 'ledger',        label: 'Personal Ledger & Owner Account', icon: 'ledger', route: 'ledger', group: 'FINANCE', primaryMasterOnly: true },

  // ── COMMERCIAL ───────────────────────────────────────────────────────────────
  { id: 'customers',     label: 'Customers & Loyalty',    icon: 'customers',    route: 'customers',         group: 'COMMERCIAL' },
  { id: 'menu',          label: 'Menu Management',        icon: 'menuItem',     route: 'menu',              group: 'COMMERCIAL' },
  { id: 'vendors',       label: 'Vendors',                icon: 'vendors',      route: 'vendors',           group: 'COMMERCIAL' },
  { id: 'revenue-share', label: 'Revenue Share & Outlets', icon: 'revenueShare', route: 'revenue-share',   group: 'COMMERCIAL', primaryMasterOnly: true },

  // ── INSIGHTS ─────────────────────────────────────────────────────────────────
  { id: 'reports',       label: 'Reports & Analytics',    icon: 'reports',      route: 'reports',           group: 'INSIGHTS' },

  // ── ADMINISTRATION ───────────────────────────────────────────────────────────
  { id: 'admin',         label: 'Administration',         icon: 'admin',        route: 'admin',             group: 'ADMINISTRATION' },

  // ── SYSTEM ───────────────────────────────────────────────────────────────────
  { id: 'cafe-ops-devices', label: 'Devices & Sessions',  icon: 'devices',      route: 'cafe-ops-devices',  group: 'SYSTEM' },
  { id: 'settings',      label: 'Settings',               icon: 'settings',     route: 'settings',          group: 'SYSTEM' },
];

// ─── Normal Master Navigation ─────────────────────────────────────────────────
// Same as Primary Master EXCEPT: no Personal Ledger, no Universal Payroll,
// no Staff Loans & Advances, no Revenue Share.
const NORMAL_MASTER_ITEMS = PRIMARY_MASTER_ITEMS.filter(
  (item) => !item.primaryMasterOnly
);

export const NAVIGATION = {
  // ── MASTER ───────────────────────────────────────────────────────────────────
  [ROLES.MASTER]: {
    scopeLabel: 'Master View',
    primaryItems: PRIMARY_MASTER_ITEMS,
    normalItems: NORMAL_MASTER_ITEMS,
    footnote: 'Full operational and financial control across all cafés.',
  },

  // ── OWNER ────────────────────────────────────────────────────────────────────
  [ROLES.OWNER]: {
    scopeLabel: 'Owner Portal',
    items: [
      { id: 'dashboard',    label: 'Overview',                icon: 'home',         route: 'dashboard',       group: 'COMMAND' },
      { id: 'approvals',    label: 'Tasks & Oversight',       icon: 'tasks',        route: 'approvals',       group: 'OPERATIONS' },
      { id: 'bills',        label: 'Bills & Receipts',        icon: 'bills',        route: 'bills',           group: 'FINANCE' },
      { id: 'sales-cash',   label: 'Sales & Cash Book',       icon: 'finance',      route: 'sales-cash',      group: 'FINANCE' },
      { id: 'performance',  label: 'Café Performance',        icon: 'performance',  route: 'performance',     group: 'INSIGHTS' },
      { id: 'employees',    label: 'Employees',               icon: 'employees',    route: 'employees',       group: 'PEOPLE' },
      { id: 'attendance',   label: 'Attendance & Shifts',     icon: 'attendance',   route: 'attendance',      group: 'PEOPLE' },
      { id: 'finance',      label: 'Finance Summary',         icon: 'finance',      route: 'finance',         group: 'FINANCE' },
      { id: 'passbook',     label: 'Passbook & Treasury',     icon: 'passbook',     route: 'passbook',        group: 'FINANCE' },
      { id: 'ledger',       label: 'Personal Ledger & Owner Account', icon: 'ledger', route: 'ledger',       group: 'FINANCE' },
      { id: 'payroll',      label: 'Payroll & Payslips',      icon: 'payslip',      route: 'payroll',         group: 'PEOPLE' },
      { id: 'revenue-share',label: 'Revenue Share & Outlets', icon: 'revenueShare', route: 'revenue-share', group: 'COMMERCIAL' },
      { id: 'reports',      label: 'Reports',                 icon: 'reports',      route: 'reports',         group: 'INSIGHTS' },
      { id: 'settings',     label: 'Settings',                icon: 'settings',     route: 'settings',        group: 'SYSTEM' },
    ],
    footnote: 'Owner Portal — strategic governance, executive metrics, and café oversight.',
  },

  // ── CAFE ADMIN (CAFE OPERATIONS) ─────────────────────────────────────────────
  [ROLES.CAFE_ADMIN]: {
    scopeLabel: 'Cafe Operations',
    items: [
      { id: 'dashboard',    label: 'Cafe Operations Dashboard', icon: 'home',       route: 'dashboard',       group: 'COMMAND' },
      { id: 'pos',          label: 'POS & Billing',           icon: 'pos',          route: 'pos',             group: 'OPERATIONS' },
      { id: 'attendance',   label: 'Attendance & Shifts',     icon: 'attendance',   route: 'attendance',      group: 'OPERATIONS' },
      { id: 'dept-orders',  label: 'Department Orders',       icon: 'deptOrders',   route: 'dept-orders',     group: 'OPERATIONS' },
      { id: 'inventory',    label: 'Inventory',               icon: 'inventory',    route: 'inventory',       group: 'OPERATIONS' },
      { id: 'procurement',  label: 'Procurement',             icon: 'procurement',  route: 'procurement',     group: 'OPERATIONS' },
      { id: 'assets',       label: 'Assets & Maintenance',    icon: 'assets',       route: 'assets',          group: 'OPERATIONS' },
      { id: 'quality',      label: 'Quality & Compliance',    icon: 'quality',      route: 'quality',         group: 'OPERATIONS' },
      { id: 'expenses',     label: 'Expenses',                icon: 'expenses',     route: 'expenses',        group: 'FINANCE' },
      { id: 'sales-cash',   label: 'Sales & Cash',            icon: 'finance',      route: 'sales-cash',      group: 'FINANCE' },
      { id: 'customers',    label: 'Customers & Loyalty',     icon: 'customers',    route: 'customers',       group: 'COMMERCIAL' },
      { id: 'reports',      label: 'Reports (this café)',      icon: 'reports',      route: 'reports',         group: 'INSIGHTS' },
      { id: 'tasks',        label: 'Action Centre',           icon: 'tasks',        route: 'tasks',           group: 'INSIGHTS' },
      { id: 'cafe-ops-devices', label: 'Devices & Sessions',  icon: 'devices',      route: 'cafe-ops-devices',group: 'SYSTEM' },
      { id: 'settings',     label: 'Settings',                icon: 'settings',     route: 'settings',        group: 'SYSTEM' },
    ],
    footnote: 'Cafe-owned trusted device operational workspace. Operator sessions & device context.',
  },

  // ── STAFF ────────────────────────────────────────────────────────────────────
  [ROLES.STAFF]: {
    scopeLabel: null,
    items: [
      { id: 'home',          label: 'Home',           icon: 'home',       route: 'staff-home',       group: 'COMMAND' },
      { id: 'announcements', label: 'Announcements',  icon: 'announce',   route: 'announcements',    group: 'COMMAND' },
      { id: 'attendance',    label: 'My Attendance',  icon: 'attendance', route: 'staff-attendance', group: 'SELF' },
      { id: 'leave',         label: 'My Leave',       icon: 'calendar',   route: 'staff-leave',      group: 'SELF' },
      { id: 'settings',      label: 'Settings',       icon: 'settings',   route: 'staff-settings',   group: 'SYSTEM' },
    ],
    footnote: 'Self-service only. Payslips & Loans are inside Settings.',
  },
};

// ── Routes exclusively accessible only to Primary Master (for MASTER role) ───
export const PRIMARY_MASTER_ONLY_ROUTES = new Set([
  'passbook',
  'ledger',
  'payroll',
  'staff-loans-advances',
  'revenue-share',
  'org-identity',
  'organisation-identity',
]);

// ─── Implicit routes — not in sidebar but accessible to all authenticated users ─
// These are auth-context / device-state screens that any authenticated role may
// reach (e.g. kiosk mode, operator sign-in, device blocked screens).
const IMPLICIT_ROUTES_ALL = new Set([
  'notifications',
  'kiosk-attendance',
  'staff-attendance',
  'staff-leave',
  'staff-payslips',
  'staff-loans-advances',
  'staff-settings',
  'staff-home',
  'announcements',
]);

// Implicit routes specific to CAFE_ADMIN — auth-context pages (not sidebar items)
const IMPLICIT_ROUTES_CAFE_ADMIN = new Set([
  'cafe-operator-signin',
  'cafe-device-state',
  // Stage-2 Login Integration: additive terminal auth screens
  'cafe-master-signin',
  'cafe-device-enroll',
  'cafe-terminal-welcome',
]);

// ─── Route allowlist check ─────────────────────────────────────────────────────
export function isRouteAllowed(role, rawRoute, isPrimaryMaster = false) {
  const route = (rawRoute || '').replace(/^#/, '');
  // Implicit routes allowed for all authenticated roles
  if (IMPLICIT_ROUTES_ALL.has(route)) return true;

  // Primary Master has 100% universal unrestricted access to every route and module
  if ((role === ROLES.MASTER || role === 'master') && isPrimaryMaster) {
    return true;
  }

  // Implicit CAFE_ADMIN auth-context routes
  if (role === ROLES.CAFE_ADMIN && IMPLICIT_ROUTES_CAFE_ADMIN.has(route)) return true;

  // Settings subroutes and universal profile/employment aliases
  if (route === "profile" || route === "my-profile" || route === "employment" || route === "my-employment") {
    return true;
  }

  if (route.startsWith("settings/")) {
    const sub = route.slice("settings/".length).toLowerCase();
    // Organisation governance / trash subroutes are restricted to MASTER
    if (sub === "trash" || sub === "data-recovery" || sub === "admin" || sub === "system-administration") {
      return role === ROLES.MASTER;
    }
    // All personal preference and identity subroutes are accessible to all authenticated profiles
    return true;
  }

  const navConfig = NAVIGATION[role];
  if (!navConfig) return false;

  // For MASTER: use the appropriate item set
  let items;
  if (role === ROLES.MASTER) {
    items = isPrimaryMaster
      ? navConfig.primaryItems
      : navConfig.normalItems;
  } else {
    items = navConfig.items;
  }

  const baseRoute = route ? route.split("/")[0] : "";
  const routeAliases = {
    'devices': 'cafe-ops-devices',
    'cafe-ops-devices': 'devices',
    'tasks': 'approvals',
    'approvals': 'tasks',
    'personal-ledger': 'ledger',
    'ledger': 'personal-ledger',
    'org-identity': 'admin',
    'organisation-identity': 'admin',
  };

  // Block Primary-Master-only routes for Normal Masters
  if (
    role === ROLES.MASTER &&
    !isPrimaryMaster &&
    (PRIMARY_MASTER_ONLY_ROUTES.has(route) || PRIMARY_MASTER_ONLY_ROUTES.has(baseRoute))
  ) {
    return false;
  }

  const allowed = items.map((i) => i.route);

  // Check direct route match or base module match or alias match
  return Boolean(
    allowed.includes(route) ||
    (baseRoute && allowed.includes(baseRoute)) ||
    (routeAliases[route] && allowed.includes(routeAliases[route])) ||
    (routeAliases[baseRoute] && allowed.includes(routeAliases[baseRoute]))
  );
}

// ─── Grouped navigation for sidebar rendering ─────────────────────────────────
export function getGroupedNavItems(role, isPrimaryMaster = false) {
  const navConfig = NAVIGATION[role];
  if (!navConfig) return {};

  let items;
  if (role === ROLES.MASTER) {
    items = isPrimaryMaster ? navConfig.primaryItems : navConfig.normalItems;
  } else {
    items = navConfig.items;
  }

  const groups = {};
  for (const item of items) {
    const groupKey = item.group || 'OTHER';
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
  }
  return groups;
}
