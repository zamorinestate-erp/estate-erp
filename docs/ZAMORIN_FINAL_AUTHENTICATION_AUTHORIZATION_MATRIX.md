# ZAMORIN CAFE ERP — FINAL AUTHENTICATION & AUTHORIZATION MATRIX

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. End-to-End Authentication & Authorization Controls Table

| Operation / Endpoint | Authentication | Permission Code | Role(s) | Scope | Record Check | Field Policy | Audit Logged | Negative Test Result | Status |
|---|---|---|---|---|---|---|---|---|---|
| User Authentication | Public | None | All | N/A | Password & Status Check | Sanitized | YES | 401 Unauthorized | COMPLETE |
| Token Refresh | Cookie / Bearer | None | All | `SELF` | Session & Revocation Check | Sanitized | YES | 401 Unauthorized | COMPLETE |
| Get Current User (`/auth/me`) | `authenticate` | None | All | `SELF` | Active User Lookup | Sanitized Contract | NO | 401 Unauthorized | COMPLETE |
| Role Governance Preview | `authenticate` + MFA | `USER:MANAGE` | MASTER | `ORGANISATION` | Target Role & Primary Master Check | Filtered | YES | 403 Forbidden | COMPLETE |
| Role Governance Execution | `authenticate` + MFA | `USER:MANAGE` | MASTER | `ORGANISATION` | Target Role & Primary Master Check | Filtered | YES | 403 Forbidden | COMPLETE |
| Personal Ledger Read | `authenticate` + MFA | `PERSONAL_LEDGER_READ` | MASTER | `ORGANISATION` | MASTER-only Guard | Masked | YES | 403 Forbidden | COMPLETE |
| Personal Ledger Entry Create | `authenticate` + MFA | `PERSONAL_LEDGER_WRITE` | MASTER | `ORGANISATION` | MASTER-only Guard | Filtered | YES | 403 Forbidden | COMPLETE |
| Expense Claim Create | `authenticate` | `EXPENSE_CREATE` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Cafe Assignment Filter | Filtered | YES | 403 Forbidden | COMPLETE |
| Expense Claim Decision | `authenticate` + MFA | `EXPENSE_DECIDE` | MASTER | `ORGANISATION` | Status & Role Restriction | Filtered | YES | 403 Forbidden | COMPLETE |
| Employee Self Profile Read | `authenticate` | `EMPLOYEE:READ_SELF` | All | `SELF` | Target ID Match | Redacted Internal Fields | NO | 403 Forbidden | COMPLETE |
| Employee Management Read | `authenticate` | `EMPLOYEE:READ` | MASTER, OWNER, CAFE_ADMIN | `ORGANISATION` / `ASSIGNED_CAFES` | Cafe Assignment Filter | Redacted Internal Fields | NO | 403 Forbidden | COMPLETE |
| Payroll Management | `authenticate` + MFA | `PAYROLL_MANAGE` | MASTER, OWNER | `ORGANISATION` | Duplicate Run Check | Masked Bank Details | YES | 403 Forbidden | COMPLETE |
| Global Search | `authenticate` | Dynamic | All | Role Scoped | Sub-Query Permission Guard | Masked Results | NO | Group Excluded | COMPLETE |
| Trash Bin Listing | `authenticate` + MFA | `TRASH_READ` | MASTER | `ORGANISATION` | MASTER-only Guard | Filtered | YES | 403 Forbidden | COMPLETE |
| Trash Bin Restore | `authenticate` + MFA | `TRASH_RESTORE` | MASTER | `ORGANISATION` | MASTER-only Guard | Filtered | YES | 403 Forbidden | COMPLETE |
