# ZAMORIN CAFE ERP — BACKEND ROUTE AUTHORIZATION MATRIX

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Backend Route Authorization Table

| Method | Path | Controller / Module | Authentication | Permission Code | Allowed Roles | Scope | Record Check | Audit Logged | Seeded | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `authController` | None (Public) | None | All | N/A | N/A | YES | N/A | PASS | PASS | COMPLETE |
| POST | `/api/v1/auth/refresh` | `authController` | Refresh Token | None | All | N/A | Session Check | YES | N/A | PASS | PASS | COMPLETE |
| GET | `/api/v1/auth/me` | `authController` | `authenticate` | None | All | `SELF` | Session Check | NO | N/A | PASS | PASS | COMPLETE |
| POST | `/api/v1/auth/logout` | `authController` | `authenticate` | None | All | `SELF` | Session Revoke | YES | N/A | PASS | PASS | COMPLETE |
| GET | `/api/v1/cafes` | `cafeController` | `authenticate` | `CAFE:READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Cafe Scope | NO | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/cafes` | `cafeController` | `authenticate` | `CAFE:WRITE` | MASTER | `ORGANISATION` | Org Scope | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/users` | `userController` | `authenticate` | `ADMIN` / `USER:MANAGE` | MASTER | `ORGANISATION` | Primary Master Guard | YES | YES | PASS | PASS | COMPLETE |
| PATCH | `/api/v1/users/:userId/role` | `userGovernanceController` | `authenticate` + MFA | `USER:MANAGE` | MASTER | `ORGANISATION` | Primary Master Guard | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/employees` | `employeeController` | `authenticate` | `EMPLOYEE:READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Cafe Scope | NO | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/employees/me` | `employeeController` | `authenticate` | `EMPLOYEE:READ_SELF` | MASTER, OWNER, CAFE_ADMIN, STAFF | `SELF` | Self User Filter | NO | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/expenses` | `expenseController` | `authenticate` | `EXPENSE_READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Cafe Scope | NO | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/expenses` | `expenseController` | `authenticate` | `EXPENSE_CREATE` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Draft Status Check | YES | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/expenses/:id/decide` | `expenseController` | `authenticate` + MFA | `EXPENSE_DECIDE` | MASTER | `ORGANISATION` | Status & Role Check | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/personal-ledger` | `personalLedgerController` | `authenticate` + MFA | `PERSONAL_LEDGER_READ` | MASTER | `ORGANISATION` | MASTER-only Guard | YES | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/personal-ledger` | `personalLedgerController` | `authenticate` + MFA | `PERSONAL_LEDGER_WRITE` | MASTER | `ORGANISATION` | MASTER-only Guard | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/payroll` | `payrollController` | `authenticate` + MFA | `PAYROLL_MANAGE` | MASTER, OWNER | `ORGANISATION` | Org Scope | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/inventory` | `inventoryController` | `authenticate` | `INVENTORY_READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Stock Level Check | NO | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/inventory/adjustments` | `inventoryController` | `authenticate` | `INVENTORY_WRITE` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Stock Level Check | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/procurement/orders` | `procurementController` | `authenticate` | `PROCUREMENT_READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | PO Scope | NO | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/trash` | `trashController` | `authenticate` | `TRASH_READ` | MASTER | `ORGANISATION` | MASTER-only Guard | YES | YES | PASS | PASS | COMPLETE |
| POST | `/api/v1/trash/restore` | `trashController` | `authenticate` | `TRASH_RESTORE` | MASTER | `ORGANISATION` | MASTER-only Guard | YES | YES | PASS | PASS | COMPLETE |
| GET | `/api/v1/search` | `searchController` | `authenticate` | Dynamic | MASTER, OWNER, CAFE_ADMIN, STAFF | Role Scoped | Group Guard | NO | YES | PASS | PASS | COMPLETE |
