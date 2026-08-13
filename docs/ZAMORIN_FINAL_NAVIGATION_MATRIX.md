# ZAMORIN CAFE ERP — FINAL NAVIGATION MATRIX

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Role Navigation Matrix

| Role | Nav Label | Route Key | Page Component | Router Registered | Deep Linkable | Backend Domain | Permission Code | Status |
|---|---|---|---|---|---|---|---|---|
| **MASTER** | Command Centre | `dashboard` | `dashboard.js` | YES | YES | Dashboard | `DASHBOARD_READ` | COMPLETE |
| MASTER | Administration | `admin` | `administration.js` | YES | YES | Administration | `ADMIN` / `USER:MANAGE` | COMPLETE |
| MASTER | Assets & Maintenance | `assets` | `assets.js` | YES | YES | Assets | `ASSET_READ` | COMPLETE |
| MASTER | Attendance & Shifts | `attendance` | `attendance.js` | YES | YES | Attendance | `ATTENDANCE_READ` | COMPLETE |
| MASTER | Bills & Receipts | `bills` | `bills.js` | YES | YES | POS / Billing | `POS_READ` | COMPLETE |
| MASTER | Customers & Loyalty | `customers` | `customers.js` | YES | YES | Customers | `CUSTOMERS_READ` | COMPLETE |
| MASTER | Department Orders | `dept-orders` | `departmentOrders.js` | YES | YES | Dept Orders | `DEPT_ORDER_READ` | COMPLETE |
| MASTER | Employees | `employees` | `employees.js` | YES | YES | HRMS | `EMPLOYEE:READ` | COMPLETE |
| MASTER | Expenses | `expenses` | `expenses.js` | YES | YES | Expenses | `EXPENSE_READ` | COMPLETE |
| MASTER | Finance & Accounts | `finance` | `finance.js` | YES | YES | Finance | `FINANCE_READ` | COMPLETE |
| MASTER | Inventory | `inventory` | `inventory.js` | YES | YES | Inventory | `INVENTORY_READ` | COMPLETE |
| MASTER | Menu Management | `menu` | `menu.js` | YES | YES | Menu | `MENU_READ` | COMPLETE |
| MASTER | My Loans & Advances | `staff-loans-advances` | `loansAdvances.js` | YES | YES | Loan/Advance | `LOAN_ADVANCE_READ_SELF` | COMPLETE |
| MASTER | My Payslips | `staff-payslips` | `payslips.js` | YES | YES | Payroll | `PAYROLL_READ_SELF` | COMPLETE |
| MASTER | My Profile | `employee-profile` | `employees.js` | YES | YES | HRMS | `EMPLOYEE:READ_SELF` | COMPLETE |
| MASTER | Payroll & Payslips | `payroll` | `payroll.js` | YES | YES | Payroll | `PAYROLL_MANAGE` | COMPLETE |
| MASTER | Personal Ledger | `ledger` | `personalLedger.js` | YES | YES | Personal Ledger | `PERSONAL_LEDGER_READ` | COMPLETE |
| MASTER | POS & Billing | `pos` | `pos.js` | YES | YES | POS | `POS_WRITE` | COMPLETE |
| MASTER | Procurement | `procurement` | `procurement.js` | YES | YES | Procurement | `PROCUREMENT_READ` | COMPLETE |
| MASTER | Quality & Compliance | `quality` | `quality.js` | YES | YES | Quality | `QUALITY_READ` | COMPLETE |
| MASTER | Reports & Analytics | `reports` | `reports.js` | YES | YES | Analytics | `REPORT_READ` | COMPLETE |
| MASTER | Settings & Preferences | `settings` | `settings.js` | YES | YES | Settings | `SETTINGS_READ` | COMPLETE |
| MASTER | Trash Bin | `trash` | `trash.js` | YES | YES | Trash | `TRASH_READ` | COMPLETE |
| MASTER | Vendors | `vendors` | `vendors.js` | YES | YES | Vendors | `VENDORS_READ` | COMPLETE |
| **OWNER** | Overview | `dashboard` | `dashboard.js` | YES | YES | Dashboard | `DASHBOARD_READ` | COMPLETE |
| OWNER | Approvals Waiting on You | `approvals` | `approvals.js` | YES | YES | Approvals | `APPROVALS_READ` | COMPLETE |
| OWNER | Bills & Receipts | `bills` | `bills.js` | YES | YES | POS | `POS_READ` | COMPLETE |
| OWNER | Cafe Performance | `performance` | `performance.js` | YES | YES | Reports | `REPORT_READ` | COMPLETE |
| OWNER | Employees | `employees` | `employees.js` | YES | YES | HRMS | `EMPLOYEE:READ` | COMPLETE |
| OWNER | Finance Summary | `finance` | `finance.js` | YES | YES | Finance | `FINANCE_READ` | COMPLETE |
| OWNER | My Loans & Advances | `staff-loans-advances` | `loansAdvances.js` | YES | YES | Self-Service | `LOAN_ADVANCE_READ_SELF` | COMPLETE |
| OWNER | My Payslips | `staff-payslips` | `payslips.js` | YES | YES | Self-Service | `PAYROLL_READ_SELF` | COMPLETE |
| OWNER | My Profile | `employee-profile` | `employees.js` | YES | YES | Self-Service | `EMPLOYEE:READ_SELF` | COMPLETE |
| OWNER | Payroll & Payslips | `payroll` | `payroll.js` | YES | YES | Payroll | `PAYROLL_MANAGE` | COMPLETE |
| OWNER | Reports | `reports` | `reports.js` | YES | YES | Reports | `REPORT_READ` | COMPLETE |
| OWNER | Settings & Preferences | `settings` | `settings.js` | YES | YES | Settings | `SETTINGS_READ` | COMPLETE |
| **CAFE_ADMIN** | Command Centre | `dashboard` | `dashboard.js` | YES | YES | Dashboard | `DASHBOARD_READ` | COMPLETE |
| CAFE_ADMIN | Assets & Maintenance | `assets` | `assets.js` | YES | YES | Assets | `ASSET_READ` | COMPLETE |
| CAFE_ADMIN | Attendance & Shifts | `attendance` | `attendance.js` | YES | YES | Attendance | `ATTENDANCE_READ` | COMPLETE |
| CAFE_ADMIN | Customers & Loyalty | `customers` | `customers.js` | YES | YES | Customers | `CUSTOMERS_READ` | COMPLETE |
| CAFE_ADMIN | Department Orders | `dept-orders` | `departmentOrders.js` | YES | YES | Dept Orders | `DEPT_ORDER_READ` | COMPLETE |
| CAFE_ADMIN | Expenses | `expenses` | `expenses.js` | YES | YES | Expenses | `EXPENSE_READ` | COMPLETE |
| CAFE_ADMIN | Inventory | `inventory` | `inventory.js` | YES | YES | Inventory | `INVENTORY_READ` | COMPLETE |
| CAFE_ADMIN | POS & Billing | `pos` | `pos.js` | YES | YES | POS | `POS_WRITE` | COMPLETE |
| CAFE_ADMIN | Procurement | `procurement` | `procurement.js` | YES | YES | Procurement | `PROCUREMENT_READ` | COMPLETE |
| CAFE_ADMIN | Quality & Compliance | `quality` | `quality.js` | YES | YES | Quality | `QUALITY_READ` | COMPLETE |
| CAFE_ADMIN | Reports (this cafe) | `reports` | `reports.js` | YES | YES | Reports | `REPORT_READ` | COMPLETE |
| CAFE_ADMIN | Sales & Cash | `sales-cash` | `cash.js` | YES | YES | Cash | `CASH_READ` | COMPLETE |
| CAFE_ADMIN | Settings & Preferences | `settings` | `settings.js` | YES | YES | Settings | `SETTINGS_READ` | COMPLETE |
| CAFE_ADMIN | Tasks & Approvals | `tasks` | `tasks.js` | YES | YES | Tasks | `TASKS_READ` | COMPLETE |
| **STAFF** | Home | `staff-home` | `staffHome.js` | YES | YES | Auth | `SELF` | COMPLETE |
| STAFF | Announcements | `announcements` | `announcements.js` | YES | YES | Notifications | `SELF` | COMPLETE |
| STAFF | My Attendance | `staff-attendance` | `staffAttendance.js` | YES | YES | Attendance | `ATTENDANCE_READ_SELF` | COMPLETE |
| STAFF | My Leave | `staff-leave` | `staffLeave.js` | YES | YES | Leave | `LEAVE_READ_SELF` | COMPLETE |
| STAFF | My Loans & Advances | `staff-loans-advances` | `loansAdvances.js` | YES | YES | Self-Service | `LOAN_ADVANCE_READ_SELF` | COMPLETE |
| STAFF | My Payslips | `staff-payslips` | `payslips.js` | YES | YES | Self-Service | `PAYROLL_READ_SELF` | COMPLETE |
| STAFF | My Profile | `employee-profile` | `employees.js` | YES | YES | Self-Service | `EMPLOYEE:READ_SELF` | COMPLETE |
| STAFF | Settings | `staff-settings` | `staffSettings.js` | YES | YES | Self-Service | `SELF` | COMPLETE |
