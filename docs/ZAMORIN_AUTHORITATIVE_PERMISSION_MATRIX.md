# Zamorin Café ERP — Authoritative Permission Matrix

## Role Hierarchy & Absolute Restrictions

| Role | System Scope | Personal Ledger Access | User Administration | Security Escalations |
| :--- | :--- | :--- | :--- | :--- |
| `MASTER` | All Cafes / Organisation | Own Only (`ownerUserId`) | Full (`USER:MANAGE` + Step-Up + Reason) | Primary Master protected |
| `OWNER` | All Cafes / Organisation | Own Only (`ownerUserId`) | Denied | Permanent Owner Portal |
| `CAFE_ADMIN` | Assigned Cafes Only | **DENIED** (404) | Denied | Assigned Cafe Scoped |
| `STAFF` | Self-Service Only | **DENIED** (404) | Denied | Self-Service Scoped |

---

## Module-by-Module Permission Mapping

| Module | Code | Allowed Roles | Effective Scope | Sensitive Flags |
| :--- | :--- | :--- | :--- | :--- |
| **Command Centre** | `DASHBOARD_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | None |
| **POS & Billing** | `POS_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | None |
| | `POS_WRITE` | MASTER, CAFE_ADMIN | ASSIGNED_CAFES | Audit Event |
| | `POS_VOID` | MASTER, OWNER | ORGANISATION | Audit Event |
| **Bills Inspection** | `BILLS_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | None |
| **Inventory** | `INVENTORY_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | None |
| | `INVENTORY_WRITE` | MASTER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | Audit Event |
| **Vendors** | `VENDORS_READ` | MASTER, OWNER | ORGANISATION | None |
| | `VENDORS_WRITE` | MASTER | ORGANISATION | Audit Event |
| **Procurement** | `PROCUREMENT_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | None |
| | `PROCUREMENT_WRITE` | MASTER, CAFE_ADMIN | ASSIGNED_CAFES | Audit Event |
| **Menu & Pricing** | `MENU_READ` | MASTER, OWNER, CAFE_ADMIN | ORGANISATION / ASSIGNED_CAFES | Filter Active for non-Master |
| | `MENU_WRITE` | MASTER | ORGANISATION | Audit Event |
| **Personal Ledger** | `PERSONAL_LEDGER_READ` | MASTER, OWNER | SELF (`ownerUserId`) | Absolute Restriction (404 for others) |
| | `PERSONAL_LEDGER_WRITE` | MASTER, OWNER | SELF (`ownerUserId`) | Audit Event + Reason for Reversal |
| **Payroll** | `PAYROLL_READ` | MASTER, OWNER | ORGANISATION | None |
| | `PAYROLL_WRITE` | MASTER | ORGANISATION | MFA + Step-Up + Audit Event |
| **My Payslips** | `PAYSLIPS_SELF` | STAFF, CAFE_ADMIN, OWNER, MASTER | SELF | Self-service strictly scoped |
| **Loans & Advances**| `LOANS_SELF` | STAFF, CAFE_ADMIN, OWNER, MASTER | SELF | Self-service strictly scoped |
| **User Admin** | `USER:MANAGE` | MASTER | ORGANISATION | Step-Up + Reason + MFA + Audit Event |
