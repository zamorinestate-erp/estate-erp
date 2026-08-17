# ZAMORIN CAFE ERP — PRE-LOGIN REMOVAL FRONTEND MANIFEST

**Date:** 2026-08-17  
**Status:** Pre-Removal Inventory Baseline

---

## 1. Inventory of All Frontend Pages & Modules

Every active frontend page and business module present prior to the removal of the old login UI:

| # | Page / Module File | Module Purpose / Scope | Target Post-Removal State |
| :- | :--- | :--- | :--- |
| 1 | `src/js/pages/administration.js` | System administration & user management | **PRESENT & UNCHANGED** |
| 2 | `src/js/pages/announcements.js` | Broadcast announcements & noticeboard | **PRESENT & UNCHANGED** |
| 3 | `src/js/pages/assets.js` | Cafe asset register & maintenance tracking | **PRESENT & UNCHANGED** |
| 4 | `src/js/pages/cafeAttendanceDisplay.js` | Dedicated cafe attendance kiosk display | **PRESENT & UNCHANGED** |
| 5 | `src/js/pages/cafePerformance.js` | Real-time cafe performance KPIs | **PRESENT & UNCHANGED** |
| 6 | `src/js/pages/cashBook.js` | Daily cash transactions & shift closeout | **PRESENT & UNCHANGED** |
| 7 | `src/js/pages/customers.js` | Customer CRM & loyalty records | **PRESENT & UNCHANGED** |
| 8 | `src/js/pages/dashboardAdmin.js` | Branch Manager / Admin Dashboard | **PRESENT & UNCHANGED** |
| 9 | `src/js/pages/dashboardMaster.js` | Executive HQ Master Dashboard | **PRESENT & UNCHANGED** |
| 10 | `src/js/pages/departmentOrders.js` | Department & kitchen orders | **PRESENT & UNCHANGED** |
| 11 | `src/js/pages/employeeProfile.js` | Staff profile view & document manager | **PRESENT & UNCHANGED** |
| 12 | `src/js/pages/employees.js` | Employee directory & shift allocation | **PRESENT & UNCHANGED** |
| 13 | `src/js/pages/expenses.js` | Operational expense management & claims | **PRESENT & UNCHANGED** |
| 14 | `src/js/pages/financeAccounts.js` | Chart of accounts & accounting ledgers | **PRESENT & UNCHANGED** |
| 15 | `src/js/pages/inventory.js` | Stock inventory & stock movements | **PRESENT & UNCHANGED** |
| 16 | `src/js/pages/login.js` | **Legacy Login UI (Temporary Removal)** | **REMOVED / STUBBED (PENDING REDESIGN)** |
| 17 | `src/js/pages/mailOpsCommandCentre.js` | MailOps Gmail OAuth & message sync | **PRESENT & UNCHANGED** |
| 18 | `src/js/pages/menuManagement.js` | Recipe, menu pricing & allergen manager | **PRESENT & UNCHANGED** |
| 19 | `src/js/pages/notAvailable.js` | Fallback error boundary page | **PRESENT & UNCHANGED** |
| 20 | `src/js/pages/notificationCentre.js` | Notifications feed & security alerts | **PRESENT & UNCHANGED** |
| 21 | `src/js/pages/ownerBills.js` | Owner financial oversight & bills | **PRESENT & UNCHANGED** |
| 22 | `src/js/pages/payrollManagement.js` | Payroll run generation & calculations | **PRESENT & UNCHANGED** |
| 23 | `src/js/pages/payrollPayslips.js` | Official payslip generator & exports | **PRESENT & UNCHANGED** |
| 24 | `src/js/pages/personalLedger.js` | Master-only Personal Ledger | **PRESENT & UNCHANGED** |
| 25 | `src/js/pages/posTill.js` | Point-of-Sale Register & Live Billing | **PRESENT & UNCHANGED** |
| 26 | `src/js/pages/procurement.js` | Purchase orders & RFQ supplier orders | **PRESENT & UNCHANGED** |
| 27 | `src/js/pages/quality.js` | Daily quality & food safety checklists | **PRESENT & UNCHANGED** |
| 28 | `src/js/pages/reportsAnalytics.js` | Business intelligence & analytics | **PRESENT & UNCHANGED** |
| 29 | `src/js/pages/settingsShared.js` | Shared system settings & theme picker | **PRESENT & UNCHANGED** |
| 30 | `src/js/pages/staffHome.js` | Staff mobile self-service portal | **PRESENT & UNCHANGED** |
| 31 | `src/js/pages/staffLeave.js` | Staff leave application & balances | **PRESENT & UNCHANGED** |
| 32 | `src/js/pages/staffLoansAdvances.js` | Staff loan & salary advance requests | **PRESENT & UNCHANGED** |
| 33 | `src/js/pages/staffPayslips.js` | Staff personal payslips view | **PRESENT & UNCHANGED** |
| 34 | `src/js/pages/staffSettings.js` | Staff preference settings | **PRESENT & UNCHANGED** |
| 35 | `src/js/pages/tasksApprovals.js` | Workflow task approvals queue | **PRESENT & UNCHANGED** |
| 36 | `src/js/pages/trashBin.js` | Soft-deleted entity trash & recovery | **PRESENT & UNCHANGED** |
| 37 | `src/js/pages/vendors.js` | Supplier database & contact directory | **PRESENT & UNCHANGED** |
| 38 | `src/js/modules/attendance/attendanceShifts.js` | Shift planning & roster module | **PRESENT & UNCHANGED** |
| 39 | `src/js/modules/attendance/staffAttendance.js` | Staff attendance check-in engine | **PRESENT & UNCHANGED** |

---

## 2. Core Infrastructure & Support Modules

- `src/js/apiClient.js` — Authoritative API client (Kept)
- `src/js/components.js` — Shared UI components, modals, buttons, toolbars (Kept)
- `src/js/icons.js` — SVG iconography catalog (Kept)
- `src/js/ist.js` — Indian Standard Time date formatters (Kept)
- `src/js/navigation.js` — Role-based navigation configuration (Kept)
- `src/js/notifications.js` — In-app toast notification dispatcher (Kept)
- `src/js/popup.js` — Generic confirmation popups (Kept)
- `src/js/router.js` — Client-side route manager (Kept, adjusted default start route)
- `src/js/sessionManagement.js` — Session renewal & idle lock timers (Kept)
- `src/js/state.js` — Reactive app state store (Kept)
- `src/js/updateManager.js` — PWA & update checks (Kept)
- `src/js/version.js` — Application versioning (Kept)

---

## 3. Preservation Target Summary

- Total Business Pages/Modules in Catalog: **39**
- Old Login Page UI: **Removed / Marked Pending Redesign**
- Other Modules Preserved Intact: **38 / 38 (100%)**
- Accidental Module Deletions: **0**
