# ZAMORIN CAFE ERP — ROUTE, NAVIGATION, AUTH & SEED MASTER INVENTORY

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Master Application Inventory Overview

This inventory records every page, module, option, route, API operation, security guard, permission code, scope filter, seed rule, and test case across the entire **Zamorin Cafe ERP** platform.

| Portal | Module | Page | Function/Action | Nav Key | Frontend Route | Frontend File | API Method | API Route | Authentication | Permission Code | RolePermission Scope | Controller Scope | Seed Rule | Test | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Master | Dashboard | Command Centre | View KPI Dashboard | `dashboard` | `dashboard` | `dashboard.js` | GET | `/api/v1/dashboard` | `authenticate` | `DASHBOARD_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `dashboardRoutes.js`, `dashboardController.js` |
| Master | Admin | Administration | Manage Users & Cafes | `admin` | `admin` | `administration.js` | GET/POST | `/api/v1/users`, `/api/v1/custom-fields` | `authenticate` | `ADMIN` / `USER:MANAGE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `userRoutes.js`, `customFieldRoutes.js` |
| Master | Assets | Assets & Maintenance | View & Manage Assets | `assets` | `assets` | `assets.js` | GET/POST | `/api/v1/assets` | `authenticate` | `ASSET_READ` / `ASSET_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `assetRoutes.js`, `assetController.js` |
| Master | Attendance | Attendance & Shifts | View/Manage Shift Logs | `attendance` | `attendance` | `attendance.js` | GET/POST | `/api/v1/attendance` | `authenticate` | `ATTENDANCE_READ` / `ATTENDANCE_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `attendanceRoutes.js` |
| Master | POS | Bills & Receipts | View All Transactions | `bills` | `bills` | `bills.js` | GET | `/api/v1/bills` | `authenticate` | `POS_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `billRoutes.js`, `billController.js` |
| Master | Customers | Customers & Loyalty | Manage Customer Registry | `customers` | `customers` | `customers.js` | GET/POST | `/api/v1/customers` | `authenticate` | `CUSTOMERS_READ` / `CUSTOMERS_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `customerRoutes.js` |
| Master | Dept Orders | Department Orders | Internal Kitchen/Staff Orders | `dept-orders` | `dept-orders` | `departmentOrders.js` | GET/POST | `/api/v1/department-orders` | `authenticate` | `DEPT_ORDER_READ` / `DEPT_ORDER_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `departmentOrderRoutes.js` |
| Master | HRMS | Employees | Manage Employee Profiles | `employees` | `employees` | `employees.js` | GET/POST | `/api/v1/employees` | `authenticate` | `EMPLOYEE:READ` / `EMPLOYEE:WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `employeeRoutes.js` |
| Master | Finance | Expenses | View & Decide Expenses | `expenses` | `expenses` | `expenses.js` | GET/POST | `/api/v1/expenses` | `authenticate` | `EXPENSE_READ` / `EXPENSE_DECIDE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `expenseRoutes.js` (Decision: MASTER-only) |
| Master | Finance | Finance & Accounts | General Ledger & P&L | `finance` | `finance` | `finance.js` | GET | `/api/v1/cash-transactions` | `authenticate` | `FINANCE_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `cashRoutes.js` |
| Master | Inventory | Inventory | Stock & Multi-Cafe Levels | `inventory` | `inventory` | `inventory.js` | GET/POST | `/api/v1/inventory` | `authenticate` | `INVENTORY_READ` / `INVENTORY_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `inventoryRoutes.js` |
| Master | Menu | Menu Management | Menu & Pricing Engine | `menu` | `menu` | `menu.js` | GET/POST | `/api/v1/menu` | `authenticate` | `MENU_READ` / `MENU_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `menuRoutes.js` |
| Master | Self-Service | My Loans/Advances | Own Salary Advance Requests | `my-loans-advances` | `staff-loans-advances` | `loansAdvances.js` | GET/POST | `/api/v1/loan-advances` | `authenticate` | `LOAN_ADVANCE_READ_SELF` | `SELF` | Self Filter | PASS | PASS | COMPLETE | `loanAdvanceRoutes.js` |
| Master | Self-Service | My Payslips | Own Monthly Payslips | `my-payslips` | `staff-payslips` | `payslips.js` | GET | `/api/v1/payroll/slips/me` | `authenticate` | `PAYROLL_READ_SELF` | `SELF` | Self Filter | PASS | PASS | COMPLETE | `payrollRoutes.js` |
| Master | Self-Service | My Profile | Own Employee Profile | `my-profile` | `employee-profile` | `employees.js` | GET | `/api/v1/employees/me` | `authenticate` | `EMPLOYEE:READ_SELF` | `SELF` | Self Filter | PASS | PASS | COMPLETE | `employeeRoutes.js` |
| Master | Payroll | Payroll & Payslips | Run Payroll & Issue Slips | `payroll` | `payroll` | `payroll.js` | GET/POST | `/api/v1/payroll` | `authenticate` | `PAYROLL_MANAGE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `payrollRoutes.js` |
| Master | Treasury | Personal Ledger | Executive Personal Ledger | `ledger` | `ledger` | `personalLedger.js` | GET/POST | `/api/v1/personal-ledger` | `authenticate` | `PERSONAL_LEDGER_READ` | `ORGANISATION` | MASTER-only | PASS | PASS | COMPLETE | `personalLedgerRoutes.js` (MASTER-only) |
| Master | POS | POS & Billing | Order Entry & Voiding | `pos` | `pos` | `pos.js` | GET/POST | `/api/v1/bills` | `authenticate` | `POS_WRITE` / `POS_VOID` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `billRoutes.js` |
| Master | Procurement | Procurement | Purchase Orders & Match | `procurement` | `procurement` | `procurement.js` | GET/POST | `/api/v1/procurement` | `authenticate` | `PROCUREMENT_READ` / `PROCUREMENT_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `procurementRoutes.js` |
| Master | Quality | Quality & Compliance | HACCP & Checklists | `quality` | `quality` | `quality.js` | GET/POST | `/api/v1/quality` | `authenticate` | `QUALITY_READ` / `QUALITY_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `qualityRoutes.js` |
| Master | Analytics | Reports & Analytics | System Financial Reports | `reports` | `reports` | `reports.js` | GET | `/api/v1/reports` | `authenticate` | `REPORT_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `reportRoutes.js` |
| Master | Settings | Settings | Platform Preferences | `settings` | `settings` | `settings.js` | GET/POST | `/api/v1/settings` | `authenticate` | `SETTINGS_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `settings.js` |
| Master | Governance | Trash Bin | Soft-Deleted Records | `trash` | `trash` | `trash.js` | GET/POST | `/api/v1/trash` | `authenticate` | `TRASH_READ` / `TRASH_RESTORE` | `ORGANISATION` | MASTER-only | PASS | PASS | COMPLETE | `trashRoutes.js` (MASTER-only) |
| Master | Procurement | Vendors | Vendor Registry | `vendors` | `vendors` | `vendors.js` | GET/POST | `/api/v1/vendors` | `authenticate` | `VENDORS_READ` / `VENDORS_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `vendorRoutes.js` |
| Owner | Overview | Strategic Overview | High-level KPI metrics | `dashboard` | `dashboard` | `dashboard.js` | GET | `/api/v1/dashboard` | `authenticate` | `DASHBOARD_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `dashboardRoutes.js` |
| Owner | Governance | Approvals Waiting | Executive Approval Inbox | `approvals` | `approvals` | `approvals.js` | GET/POST | `/api/v1/approvals` | `authenticate` | `APPROVALS_READ` / `APPROVALS_WRITE` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `approvalRoutes.js` |
| Owner | Performance | Cafe Performance | Strategic Cafe Metrics | `performance` | `performance` | `performance.js` | GET | `/api/v1/reports` | `authenticate` | `REPORT_READ` | `ORGANISATION` | Org Filter | PASS | PASS | COMPLETE | `reportRoutes.js` |
| Cafe Admin | POS | POS & Billing | Assigned Cafe Billing | `pos` | `pos` | `pos.js` | GET/POST | `/api/v1/bills` | `authenticate` | `POS_WRITE` | `ASSIGNED_CAFES` | Cafe Filter | PASS | PASS | COMPLETE | `billRoutes.js` |
| Cafe Admin | Expenses | Expense Creation | Submit Cafe Expenses | `expenses` | `expenses` | `expenses.js` | GET/POST | `/api/v1/expenses` | `authenticate` | `EXPENSE_READ` / `EXPENSE_CREATE` | `ASSIGNED_CAFES` | Cafe Filter | PASS | PASS | COMPLETE | `expenseRoutes.js` (No Decision) |
| Staff | Self-Service | Home | Personal Portal Home | `home` | `staff-home` | `staffHome.js` | GET | `/api/v1/auth/me` | `authenticate` | `SELF` | `SELF` | Self Filter | PASS | PASS | COMPLETE | `authRoutes.js` |
| Staff | Self-Service | My Attendance | Own Punch Clock & History | `attendance` | `staff-attendance` | `staffAttendance.js` | GET/POST | `/api/v1/attendance/me` | `authenticate` | `ATTENDANCE_READ_SELF` | `SELF` | Self Filter | PASS | PASS | COMPLETE | `attendanceRoutes.js` |
