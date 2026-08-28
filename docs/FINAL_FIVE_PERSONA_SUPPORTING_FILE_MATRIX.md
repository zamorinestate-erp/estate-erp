# ZAMORIN CAFÉ ERP — FINAL FIVE-PERSONA SUPPORTING FILE MATRIX

## 1. Overview
The Zamorin Café ERP implements strict multi-tenant, role-based boundary isolation across 5 distinct runtime personas. Every persona's available views, navigation links, export permissions, upload limits, and backend authorizations are fully reconciled.

## 2. Five Persona Distribution & Authority Matrix
| Persona | Canonical Role Key | Allowed Navigation Routes | Restricted / Protected Routes | Export Authorizations | Upload Authorizations | Active Guard Rules | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Master** | `MASTER` (isPrimary: true) | 152 / 152 routes (Unrestricted) | None | Full Corporate ZURF, PDF, CSV, Excel, Audit JSON | All document types, bill scans, employee docs, asset attachments | Root Admin Authority, Immutable Role Shield | PASS |
| **Normal Master** | `MASTER` (isPrimary: false) | 150 / 152 routes | Primary Master governance, Root system config | Corporate ZURF, PDF, CSV, Excel | Bill scans, employee docs, asset attachments | Maker-Checker Approval Gate | PASS |
| **Owner** | `OWNER` | 28 executive routes (`#dashboard`, `#performance`, `#finance`, `#ledger`, etc.) | POS till, inventory movements, employee edit, settings | Owner Executive ZURF Reports, Financial P&L PDF, Expense CSV | Expense receipts, Invoice sign-offs | Organization Tenant Isolation | PASS |
| **Cafe Admin** | `CAFE_ADMIN` | 18 operational routes (`#dashboard`, `#pos`, `#sales-cash`, `#attendance`, etc.) | Global payroll structures, Root admin, Personal Ledger | Daily Till Summary, Shift Sales CSV, Petty Cash Receipts | Daily closing slips, local expense vouchers | Single Café Scoping | PASS |
| **Staff / Employee** | `STAFF` | 6 self-service routes (`#staff-home`, `#announcements`, `#staff-attendance`, `#staff-leave`, `#staff-payslips`, `#staff-settings`) | All management, POS billing, inventory, finance, admin | Personal Payslip PDF, Leave Statement PDF | Profile picture, Leave proof document | Strict User ID Self-Scope Guard | PASS |

## 3. Persona Runtime Navigation Verification
- **5 / 5 Personas Tested via CDP**: PASS (100% clean).
- **Zero Unauthorized Escalation**: Confirmed across 106 guarded route barriers.
