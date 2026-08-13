# ZAMORIN CAFE ERP — FINAL ROUTE MATRIX

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Complete Final Route Matrix

| Method | Backend Route | Module | Controller | Authenticated | Permission | Roles | Scope | Seeded | Frontend Caller | Tested | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Auth | `authController` | NO | None | Public | N/A | N/A | `loginPage.js` | PASS | COMPLETE |
| GET | `/api/v1/auth/me` | Auth | `authController` | YES | None | All | `SELF` | N/A | `router.js` | PASS | COMPLETE |
| GET | `/api/v1/dashboard` | Dashboard | `dashboardController` | YES | `DASHBOARD_READ` | MASTER, OWNER, CAFE_ADMIN, STAFF | Role Scoped | YES | `dashboard.js` | PASS | COMPLETE |
| GET | `/api/v1/cafes` | Cafe | `cafeController` | YES | `CAFE:READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `cafes.js` | PASS | COMPLETE |
| GET | `/api/v1/users` | Admin | `userController` | YES | `ADMIN` / `USER:MANAGE` | MASTER | `ORGANISATION` | YES | `administration.js` | PASS | COMPLETE |
| GET | `/api/v1/custom-fields` | Admin | `customFieldController` | YES | `ADMIN` | MASTER, OWNER, CAFE_ADMIN, STAFF | `ORGANISATION` | YES | `administration.js` | PASS | COMPLETE |
| GET | `/api/v1/employees` | HRMS | `employeeController` | YES | `EMPLOYEE:READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `employees.js` | PASS | COMPLETE |
| GET | `/api/v1/employees/me` | HRMS | `employeeController` | YES | `EMPLOYEE:READ_SELF` | All | `SELF` | YES | `employees.js` | PASS | COMPLETE |
| GET | `/api/v1/expenses` | Finance | `expenseController` | YES | `EXPENSE_READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `expenses.js` | PASS | COMPLETE |
| POST | `/api/v1/expenses/:id/decide` | Finance | `expenseController` | YES | `EXPENSE_DECIDE` | MASTER | `ORGANISATION` | YES | `expenses.js` | PASS | COMPLETE |
| GET | `/api/v1/personal-ledger` | Treasury | `personalLedgerController` | YES | `PERSONAL_LEDGER_READ` | MASTER | `ORGANISATION` | YES | `personalLedger.js` | PASS | COMPLETE |
| GET | `/api/v1/payroll` | Payroll | `payrollController` | YES | `PAYROLL_MANAGE` | MASTER, OWNER | `ORGANISATION` | YES | `payroll.js` | PASS | COMPLETE |
| GET | `/api/v1/inventory` | Inventory | `inventoryController` | YES | `INVENTORY_READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `inventory.js` | PASS | COMPLETE |
| GET | `/api/v1/vendors` | Vendors | `vendorController` | YES | `VENDORS_READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `vendors.js` | PASS | COMPLETE |
| GET | `/api/v1/procurement` | Procurement | `procurementController` | YES | `PROCUREMENT_READ` | MASTER, OWNER, CAFE_ADMIN | Role Scoped | YES | `procurement.js` | PASS | COMPLETE |
| GET | `/api/v1/quality` | Quality | `qualityController` | YES | `QUALITY_READ` | All | Role Scoped | YES | `quality.js` | PASS | COMPLETE |
| GET | `/api/v1/trash` | Governance | `trashController` | YES | `TRASH_READ` | MASTER | `ORGANISATION` | YES | `trash.js` | PASS | COMPLETE |
| GET | `/api/v1/search` | Search | `searchController` | YES | Dynamic | All | Role Scoped | YES | `headerSearch.js` | PASS | COMPLETE |
