# ZAMORIN CAFE ERP — OWNER MUTATION PERMISSION AUDIT

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0` (Commit `4765c2c`)  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Owner Mutation Permission Audit Matrix

| OWNER Permission | Backend Route | Operation | Business Justification | Scope | Status |
|---|---|---|---|---|---|
| `POS_VOID` | `/api/v1/bills/:id/void` | Voiding a Cafe Transaction | Strategic executive authority to void incorrect bills across organisation | `ORGANISATION` | JUSTIFIED & APPROVED |
| `PROCUREMENT_WRITE` | `/api/v1/procurement/orders` | Create/Approve Purchase Orders | Executive approval authority for high-value supplier POs | `ORGANISATION` | JUSTIFIED & APPROVED |
| `PROCUREMENT_CANCEL` | `/api/v1/procurement/orders/:id/cancel` | Cancel Purchase Orders | Strategic authority to cancel PO contracts | `ORGANISATION` | JUSTIFIED & APPROVED |
| `EXPENSE_CREATE` | `/api/v1/expenses` | Submit Executive Expense Claim | Owner submitting own business expenses for Master approval | `ORGANISATION` | JUSTIFIED & APPROVED |
| `EMPLOYEE:WRITE` | `/api/v1/employees` | Update Employee Information | Executive HR updates for senior management records | `ORGANISATION` | JUSTIFIED & APPROVED |

---

## 2. Forbidden OWNER Mutations (Verified Denied)

| Prohibited Operation | Guard Mechanism | Response Code | Status |
|---|---|---|---|
| **Personal Ledger Read/Write** | `ABSOLUTE_ROLE_RESTRICTION` | `403 ABSOLUTE_ROLE_RESTRICTION` | VERIFIED DENIED |
| **Expense Decision (Approve/Reject/Pay)** | `ABSOLUTE_ROLE_RESTRICTION` | `403 Forbidden` | VERIFIED DENIED |
| **User Governance & Role Promotion** | `authorize('USER:MANAGE')` + MASTER Guard | `403 Forbidden` | VERIFIED DENIED |
| **Trash Bin Listing & Restoration** | `authorize('TRASH_READ')` + MASTER Guard | `403 Forbidden` | VERIFIED DENIED |
| **Primary Master Modification** | Primary Master Security Middleware | `403 Forbidden` | VERIFIED DENIED |
