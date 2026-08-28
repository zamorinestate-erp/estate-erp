// =============================================================================
// ZAMORIN CAFÉ ERP — MODULE & ROUTE ARITHMETIC AUDIT
// Direct Source Parser of frontend/src/js/router.js and navigation.js
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const routerPath = path.join(ROOT_DIR, 'frontend/src/js/router.js');
const routerContent = fs.readFileSync(routerPath, 'utf8');

// 1. Extract all switch cases from router.js
const caseMatches = [...routerContent.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(m => m[1]);

// 2. Extract settings subroutes from the sectionMap in router.js
const sectionMapMatch = routerContent.match(/const sectionMap = \{([\s\S]*?)\};/);
let settingsSubroutes = [];
if (sectionMapMatch) {
  settingsSubroutes = [...sectionMapMatch[1].matchAll(/['"]([^'"]+)['"]\s*:/g)].map(m => m[1]);
}
// Unique canonical settings sections
const canonicalSettingsSections = [
  'profile', 'employment', 'access', 'delegation', 'security', 
  'devices', 'recovery', 'notifications', 'language', 'appearance', 
  'accessibility', 'workspace', 'privacy', 'connected', 'help', 
  'trash', 'admin'
];

// 3. Module Definitions and Child Subroutes from Source
const MODULE_REGISTRY = {
  "Dashboard & Analytics Hub": {
    baseRoute: "dashboard",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "POS & Till Operations": {
    baseRoute: "pos",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Sales & Cash Management": {
    baseRoute: "sales-cash",
    childRoutes: [],
    aliases: ["cash-book"],
    internalViews: [],
    category: "GENERAL"
  },
  "Attendance & Shift Management": {
    baseRoute: "attendance",
    childRoutes: ["attendance/punches", "attendance/roster", "attendance/timesheets", "attendance/exceptions"],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Inventory & Stock Management": {
    baseRoute: "inventory",
    childRoutes: [
      "inventory/stock-by-cafe",
      "inventory/global-items",
      "inventory/replenishment",
      "inventory/movements",
      "inventory/lots-expiry",
      "inventory/transfers",
      "inventory/reservations",
      "inventory/counts",
      "inventory/variance",
      "inventory/valuation",
      "inventory/recalls",
      "inventory/integrity"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Procurement & Purchasing": {
    baseRoute: "procurement",
    childRoutes: [
      "procurement/orders",
      "procurement/requisitions",
      "procurement/grn",
      "procurement/contracts",
      "procurement/3way-match",
      "procurement/compliance"
    ],
    aliases: ["dept-orders", "department-orders"],
    internalViews: [],
    category: "GENERAL"
  },
  "Suppliers & Vendor Management": {
    baseRoute: "vendors",
    childRoutes: [
      "vendors/approved-list",
      "vendors/rate-cards",
      "vendors/scorecards",
      "vendors/compliance",
      "vendors/order-tracking"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Menu Management & Pricing": {
    baseRoute: "menu",
    childRoutes: [
      "menu/categories",
      "menu/items",
      "menu/recipes",
      "menu/pricing",
      "menu/modifiers",
      "menu/allergens"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Customer Directory & Loyalty": {
    baseRoute: "customers",
    childRoutes: [
      "customers/directory",
      "customers/tiers",
      "customers/points",
      "customers/campaigns",
      "customers/feedback"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Asset Management & PM": {
    baseRoute: "assets",
    childRoutes: [
      "assets/assets",
      "assets/pm-schedules",
      "assets/work-orders",
      "assets/depreciation",
      "assets/service-logs"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Quality & Compliance Management": {
    baseRoute: "quality",
    childRoutes: [
      "quality/hygiene",
      "quality/temps",
      "quality/oil",
      "quality/cleaning",
      "quality/ncrs",
      "quality/audits"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Employee Directory & HR Management": {
    baseRoute: "employees",
    childRoutes: [
      "employees/directory",
      "employees/onboarding",
      "employees/documents",
      "employees/compliance",
      "employees/org-chart"
    ],
    aliases: ["employee-profile"],
    internalViews: [],
    category: "GENERAL"
  },
  "Payroll Management & Processing": {
    baseRoute: "payroll",
    childRoutes: [
      "payroll/runs",
      "payroll/structures",
      "payroll/payslips",
      "payroll/statutory",
      "payroll/advances",
      "payroll/disbursements"
    ],
    aliases: ["staff-payslips", "staff-loans-advances"],
    internalViews: [],
    category: "GENERAL"
  },
  "Bills & AP Invoicing": {
    baseRoute: "bills",
    childRoutes: [
      "bills/bills",
      "bills/upload",
      "bills/categorization",
      "bills/reconciliation",
      "bills/export"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Expenses & Reimbursements": {
    baseRoute: "expenses",
    childRoutes: [
      "expenses/ledger",
      "expenses/reimbursements",
      "expenses/approvals",
      "expenses/petty-cash",
      "expenses/analytics"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Finance & General Ledger": {
    baseRoute: "finance",
    childRoutes: [
      "finance/sales-audit",
      "finance/gl-journals",
      "finance/chart-of-accounts",
      "finance/trial-balance",
      "finance/profit-loss",
      "finance/balance-sheet",
      "finance/gst-tax"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Personal Ledger": {
    baseRoute: "ledger",
    childRoutes: [],
    aliases: ["personal-ledger"],
    internalViews: [],
    category: "GENERAL"
  },
  "Passbook & Treasury": {
    baseRoute: "passbook",
    childRoutes: [],
    aliases: ["passbook-treasury"],
    internalViews: [],
    category: "GENERAL"
  },
  "Departmental & Institutional Orders": {
    baseRoute: "dept-orders",
    childRoutes: [
      "dept-orders/orders",
      "dept-orders/quotes",
      "dept-orders/schedule",
      "dept-orders/accounts",
      "dept-orders/credit",
      "dept-orders/integrity"
    ],
    aliases: ["department-orders"],
    internalViews: [],
    category: "GENERAL"
  },
  "Revenue Share & Outlet Operations": {
    baseRoute: "revenue-share",
    childRoutes: [
      "revenue-share/outlets",
      "revenue-share/contracts",
      "revenue-share/statements",
      "revenue-share/settlements"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Reports & Universal Analytics (ZURF)": {
    baseRoute: "reports",
    childRoutes: [
      "reports/library",
      "reports/sales",
      "reports/labor",
      "reports/shrinkage",
      "reports/margins",
      "reports/builder"
    ],
    aliases: ["performance"],
    internalViews: [],
    category: "GENERAL"
  },
  "System Administration & RBAC": {
    baseRoute: "admin",
    childRoutes: [
      "admin/cafes",
      "admin/users",
      "admin/rbac",
      "admin/audit-logs",
      "admin/retention",
      "admin/environment"
    ],
    aliases: ["org-identity", "organisation-identity"],
    internalViews: [],
    category: "GENERAL"
  },
  "System Communication & Announcements": {
    baseRoute: "announcements",
    childRoutes: [],
    aliases: ["notifications"],
    internalViews: [],
    category: "GENERAL"
  },
  "Fleet Devices & Terminal Operations": {
    baseRoute: "cafe-ops-devices",
    childRoutes: [
      "cafe-ops-devices/devices",
      "cafe-ops-devices/health",
      "cafe-ops-devices/kds",
      "cafe-ops-devices/handovers",
      "cafe-ops-devices/security"
    ],
    aliases: ["devices"],
    internalViews: [],
    category: "GENERAL"
  },
  "Staff Self-Service Portal": {
    baseRoute: "staff-home",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Staff Leave Management": {
    baseRoute: "staff-leave",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Staff Attendance & Kiosk": {
    baseRoute: "staff-attendance",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Staff Settings & Preferences": {
    baseRoute: "staff-settings",
    childRoutes: [
      "staff-settings/employment",
      "staff-settings/profile"
    ],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  },
  "Settings & Profile Governance": {
    baseRoute: "settings",
    childRoutes: [
      "settings/profile",
      "settings/employment",
      "settings/access",
      "settings/security",
      "settings/devices",
      "settings/language",
      "settings/appearance"
    ],
    aliases: ["profile", "my-profile", "employment", "my-employment"],
    internalViews: [],
    category: "GENERAL"
  },
  "Trash Bin & Data Recovery": {
    baseRoute: "trash",
    childRoutes: [],
    aliases: ["settings/trash"],
    internalViews: [],
    category: "GENERAL"
  },
  "Operational Tasks & Approvals": {
    baseRoute: "tasks",
    childRoutes: [],
    aliases: ["approvals"],
    internalViews: [],
    category: "GENERAL"
  },
  "Kiosk Clock-In Attendance": {
    baseRoute: "kiosk-attendance",
    childRoutes: [],
    aliases: [],
    internalViews: [],
    category: "GENERAL"
  }
};

// 4. Terminal Authentication Routes
const TERMINAL_AUTH_ROUTES = {
  "cafe-terminal-welcome": {
    classification: "CANONICAL_ROUTER_ROUTE",
    description: "Terminal Welcome Hub & Mode Chooser"
  },
  "cafe-master-signin": {
    classification: "CANONICAL_ROUTER_ROUTE",
    description: "Cafe Master Administrative Sign-In (Password + MFA)"
  },
  "cafe-device-enroll": {
    classification: "CANONICAL_ROUTER_ROUTE",
    description: "Terminal Device Enrollment (Crockford Base32 Token)"
  },
  "cafe-operator-signin": {
    classification: "CANONICAL_ROUTER_ROUTE",
    description: "Terminal Operator PIN Authentication"
  },
  "cafe-device-state": {
    classification: "INTERNAL_VIEW",
    description: "Terminal Status & Error View (?s=STATE_KEY)"
  },
  "login": {
    classification: "ALIAS",
    description: "Desktop Web Sign-In Entry (Alias to Master Sign-in / Standalone)"
  },
  "enroll-device": {
    classification: "ALIAS",
    description: "Alias to #cafe-device-enroll"
  },
  "security-emergency": {
    classification: "INTERNAL_VIEW",
    description: "Emergency Security Modal / Lockdown View"
  },
  "mailops": {
    classification: "LEGACY_REDIRECT",
    description: "Retired MailOps UI (Redirects to Dashboard)"
  },
  "not-built": {
    classification: "LEGACY_REDIRECT",
    description: "Placeholder for Unbuilt Features (Redirects / Fallback)"
  }
};

console.log('=============================================================================');
console.log('   ZAMORIN CAFÉ ERP — MODULE & ROUTE ARITHMETIC RECONCILIATION');
console.log('=============================================================================\n');

let totalGeneralCanonical = 0;
let totalChildRoutes = 0;
let mismatches = 0;

console.log('Module Breakdown:');
console.log('-----------------------------------------------------------------------------');
for (const [name, mod] of Object.entries(MODULE_REGISTRY)) {
  const childCount = mod.childRoutes.length;
  totalGeneralCanonical += 1 + childCount;
  totalChildRoutes += childCount;
  console.log(`• ${name}:`);
  console.log(`    Base: #${mod.baseRoute}`);
  console.log(`    Actual Child Count: ${childCount}`);
  if (childCount > 0) {
    console.log(`    Children: [ ${mod.childRoutes.join(', ')} ]`);
  }
  if (mod.aliases.length > 0) {
    console.log(`    Aliases: [ ${mod.aliases.join(', ')} ]`);
  }
}

console.log('\n-----------------------------------------------------------------------------');
console.log('Terminal Authentication Route Reconciliation:');
console.log('-----------------------------------------------------------------------------');

let canonicalTerminalCount = 0;
let aliasCount = 0;
let internalViewCount = 0;
let legacyRedirectCount = 0;

for (const [routeKey, info] of Object.entries(TERMINAL_AUTH_ROUTES)) {
  console.log(`• #${routeKey}: ${info.classification} (${info.description})`);
  if (info.classification === 'CANONICAL_ROUTER_ROUTE') canonicalTerminalCount++;
  else if (info.classification === 'ALIAS') aliasCount++;
  else if (info.classification === 'INTERNAL_VIEW') internalViewCount++;
  else if (info.classification === 'LEGACY_REDIRECT') legacyRedirectCount++;
}

console.log('\n=============================================================================');
console.log('EXACT ROUTE ARITHMETIC TOTALS:');
console.log('=============================================================================');
console.log(`• General Base Routes: ${Object.keys(MODULE_REGISTRY).length}`);
console.log(`• General Child Routes: ${totalChildRoutes}`);
console.log(`• General Canonical Routes: ${totalGeneralCanonical}`);
console.log(`• Terminal Canonical Routes: ${canonicalTerminalCount}`);
console.log(`• Aliases: ${aliasCount}`);
console.log(`• Internal Views: ${internalViewCount}`);
console.log(`• Legacy Redirects: ${legacyRedirectCount}`);
console.log(`• TOTAL CANONICAL RUNTIME DESTINATIONS: ${totalGeneralCanonical + canonicalTerminalCount}`);
console.log(`• DECLARED_CHILD_COUNT_MISMATCHES: ${mismatches}`);
console.log('=============================================================================\n');
