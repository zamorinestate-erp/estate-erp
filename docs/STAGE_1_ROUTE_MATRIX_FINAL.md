# STAGE 1 — FOUR-PROFILE FINAL ROUTE MATRIX & HISTORICAL DEFECT REGRESSION

## Overview
This document records the exhaustive route matrix across all four managerial profiles (**Primary Master**, **Normal Master**, **Owner**, **Cafe Operations**) and the targeted non-destructive regression smoke test for **Staff** under the persistent Single-Page Application (SPA) shell architecture established in Stage 1.

Every route has been verified in headless Chrome via Chrome DevTools Protocol (CDP) on the live mounted application (`http://localhost:3000`), proving:
1. **Zero DOM Remounting**: The sidebar and topbar remain mounted across all route transitions (`#page-content` updates in-place).
2. **Active Link Agreement**: The highlighted sidebar link strictly agrees with the active route and URL hash.
3. **Owner Historical Defect Resolution**: Clicking *Bills & Receipts* updates the active sidebar item, renders the full billing interface, and completely disposes of *Tasks & Oversight* (`#oto-grid` unmounted).
4. **Staff Boundary Isolation**: Staff retains a strict 5-item self-service navigation footprint with zero exposure of managerial or financial routes.

---

## 1. Primary Master (23 Visible Routes)

| # | Sidebar Label | Route Identifier | Expected View / Component | Active Link Matches | Shell Persistent | Test Status |
|---|---|---|---|:---:|:---:|:---:|
| 1 | Command Centre | `dashboard` | `renderMasterDashboard` | YES | YES | PASS |
| 2 | POS & Billing | `pos` | `renderPOS` | YES | YES | PASS |
| 3 | Attendance & Shifts | `attendance` | `renderAttendance` | YES | YES | PASS |
| 4 | Department Orders | `dept-orders` | `renderDepartmentOrders` | YES | YES | PASS |
| 5 | Inventory | `inventory` | `renderInventory` | YES | YES | PASS |
| 6 | Menu & Recipes | `menu` | `renderMenuManagement` | YES | YES | PASS |
| 7 | Procurement | `procurement` | `renderProcurement` | YES | YES | PASS |
| 8 | Suppliers & Vendors | `vendors` | `renderVendors` | YES | YES | PASS |
| 9 | Quality & Food Safety | `quality` | `renderQuality` | YES | YES | PASS |
| 10 | Assets & Machines | `assets` | `renderAssets` | YES | YES | PASS |
| 11 | Expense Claims | `expenses` | `renderExpenses` | YES | YES | PASS |
| 12 | Cash Book | `cashbook` | `renderCashBook` | YES | YES | PASS |
| 13 | Personal Ledger | `ledger` | `renderLedger` | YES | YES | PASS |
| 14 | Payroll & Advances | `payroll` | `renderPayrollManagement` | YES | YES | PASS |
| 15 | Finance & Accounts | `finance` | `renderFinance` | YES | YES | PASS |
| 16 | Revenue Share | `revenue-share` | `renderRevenueShare` | YES | YES | PASS |
| 17 | Cafe Performance | `performance` | `renderPerformance` | YES | YES | PASS |
| 18 | Reports & Analytics | `reports` | `renderReports` | YES | YES | PASS |
| 19 | Workforce Directory | `employees` | `renderEmployees` | YES | YES | PASS |
| 20 | MailOps Centre | `mailops` | `renderMailOpsCommandCentre` | YES | YES | PASS |
| 21 | Trash & Recovery | `trash` | `renderTrashBin` | YES | YES | PASS |
| 22 | Administration | `admin` | `renderAdmin` | YES | YES | PASS |
| 23 | Settings | `settings` | `renderSettingsShared` | YES | YES | PASS |

---

## 2. Normal Master (20 Visible Routes)

*Security Rule: Highly sensitive administrative routes (`finance`, `payroll`, `revenue-share`) are blocked for Normal Master and strictly restricted to Primary Master.*

| # | Sidebar Label | Route Identifier | Expected View / Component | Active Link Matches | Shell Persistent | Test Status |
|---|---|---|---|:---:|:---:|:---:|
| 1 | Command Centre | `dashboard` | `renderMasterDashboard` | YES | YES | PASS |
| 2 | POS & Billing | `pos` | `renderPOS` | YES | YES | PASS |
| 3 | Attendance & Shifts | `attendance` | `renderAttendance` | YES | YES | PASS |
| 4 | Department Orders | `dept-orders` | `renderDepartmentOrders` | YES | YES | PASS |
| 5 | Inventory | `inventory` | `renderInventory` | YES | YES | PASS |
| 6 | Menu & Recipes | `menu` | `renderMenuManagement` | YES | YES | PASS |
| 7 | Procurement | `procurement` | `renderProcurement` | YES | YES | PASS |
| 8 | Suppliers & Vendors | `vendors` | `renderVendors` | YES | YES | PASS |
| 9 | Quality & Food Safety | `quality` | `renderQuality` | YES | YES | PASS |
| 10 | Assets & Machines | `assets` | `renderAssets` | YES | YES | PASS |
| 11 | Expense Claims | `expenses` | `renderExpenses` | YES | YES | PASS |
| 12 | Cash Book | `cashbook` | `renderCashBook` | YES | YES | PASS |
| 13 | Personal Ledger | `ledger` | `renderLedger` | YES | YES | PASS |
| 14 | Cafe Performance | `performance` | `renderPerformance` | YES | YES | PASS |
| 15 | Reports & Analytics | `reports` | `renderReports` | YES | YES | PASS |
| 16 | Workforce Directory | `employees` | `renderEmployees` | YES | YES | PASS |
| 17 | MailOps Centre | `mailops` | `renderMailOpsCommandCentre` | YES | YES | PASS |
| 18 | Trash & Recovery | `trash` | `renderTrashBin` | YES | YES | PASS |
| 19 | Administration | `admin` | `renderAdmin` | YES | YES | PASS |
| 20 | Settings | `settings` | `renderSettingsShared` | YES | YES | PASS |

---

## 3. Owner (11 Visible Routes)

| # | Sidebar Label | Route Identifier | Expected View / Component | Active Link Matches | Shell Persistent | Test Status |
|---|---|---|---|:---:|:---:|:---:|
| 1 | Command Overview | `dashboard` | `renderOwnerDashboard` | YES | YES | PASS |
| 2 | Tasks & Oversight | `tasks` | `renderTasks` | YES | YES | PASS |
| 3 | Bills & Receipts | `bills` | `renderOwnerBills` | YES | YES | PASS |
| 4 | Cafe Performance | `performance` | `renderPerformance` | YES | YES | PASS |
| 5 | Multi-Cafe Summary | `finance-summary` | `renderOwnerFinanceSummary` | YES | YES | PASS |
| 6 | Finance & Accounts | `finance` | `renderFinance` | YES | YES | PASS |
| 7 | Personal Ledger | `ledger` | `renderLedger` | YES | YES | PASS |
| 8 | Procurement & Orders | `procurement` | `renderProcurement` | YES | YES | PASS |
| 9 | Reports & Analytics | `reports` | `renderReports` | YES | YES | PASS |
| 10 | Workforce Roster | `employees` | `renderEmployees` | YES | YES | PASS |
| 11 | Settings | `settings` | `renderSettingsShared` | YES | YES | PASS |

---

## 4. Historical Owner Defect Regression Proof

### Background Defect
In earlier builds, clicking *Bills & Receipts* while on *Tasks & Oversight* updated the active indicator in the sidebar, but failed to unmount the `#oto-grid` component, leaving Tasks rendered in `#page-content`.

### Automated CDP Verification Proof

```json
{
  "testName": "Owner Historical Defect (Bills & Receipts vs Tasks & Oversight)",
  "step1_initial": {
    "route": "tasks",
    "activeSidebarLink": "Tasks & Oversight",
    "isTasksRendered": true,
    "urlHash": "#tasks"
  },
  "step2_transition": {
    "action": "Click .sidebar .nav-link[data-route='bills']",
    "activeSidebarLink": "Bills & Receipts",
    "isBillsRendered": true,
    "isTasksStillRendered": false,
    "urlHash": "#bills"
  },
  "verdict": "PASS — Historical Defect Fully Resolved (100% Component Clean Transition)"
}
```

---

## 5. Cafe Operations (15 Visible Routes)

| # | Sidebar Label | Route Identifier | Expected View / Component | Active Link Matches | Shell Persistent | Test Status |
|---|---|---|---|:---:|:---:|:---:|
| 1 | Today at Cafe | `dashboard` | `renderAdminDashboard` | YES | YES | PASS |
| 2 | Register & Till | `pos` | `renderPOS` | YES | YES | PASS |
| 3 | Attendance Operations | `attendance` | `renderAttendance` | YES | YES | PASS |
| 4 | Orders & Fulfillment | `dept-orders` | `renderDepartmentOrders` | YES | YES | PASS |
| 5 | Inventory & Stock | `inventory` | `renderInventory` | YES | YES | PASS |
| 6 | Cafe Recipes & Menu | `menu` | `renderMenuManagement` | YES | YES | PASS |
| 7 | Daily Procurement | `procurement` | `renderProcurement` | YES | YES | PASS |
| 8 | Quality & Safety | `quality` | `renderQuality` | YES | YES | PASS |
| 9 | Cafe Assets & Machines | `assets` | `renderAssets` | YES | YES | PASS |
| 10 | Daily Cash Book | `cashbook` | `renderCashBook` | YES | YES | PASS |
| 11 | Cafe Petty Expense | `expenses` | `renderExpenses` | YES | YES | PASS |
| 12 | Shift & Cafe Reports | `reports` | `renderReports` | YES | YES | PASS |
| 13 | Cafe Staff Directory | `employees` | `renderEmployees` | YES | YES | PASS |
| 14 | Operational State | `cafe-ops-state` | `renderCafeOperationsState` | YES | YES | PASS |
| 15 | Settings | `settings` | `renderSettingsShared` | YES | YES | PASS |

---

## 6. Staff Shared-Infrastructure Regression Smoke Test

*Staff scope is frozen and was not modified in Stage 1. This smoke test confirms that shared shell infrastructure changes caused zero functional alteration or permission bleed.*

| Check Description | Observed Value | Expected Contract | Status |
|---|---|---|:---:|
| Scope Pill Label | `"Staff"` | `"Staff"` | PASS |
| Sidebar Items Count | `5` | `5` | PASS |
| Landing Route | `staff-home` | `staff-home` | PASS |
| Representative Route | `staff-leave` | `staff-leave` | PASS |
| Managerial Routes Exposed | `0` (None) | `0` (None) | PASS |
| Financial Routes Exposed | `0` (None) | `0` (None) | PASS |
| Theme Applied | `paper` (Persisted) | `paper` | PASS |
| Overall Regression Verdict | **PASS** | **PASS** | **PASS** |
