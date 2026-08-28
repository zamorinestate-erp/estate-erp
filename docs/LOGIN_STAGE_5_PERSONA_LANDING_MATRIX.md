# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — PERSONA LANDING & WORKSPACE MATRIX

---

### 1. Authoritative Persona Landing Destinations

| Persona | Canonical Role | Authority Attributes | Primary Landing Destination | Allowed Core Workspaces | Blocked / Guarded Routes |
|---|---|---|---|---|---|
| **Primary Master** | `MASTER` | `isPrimaryMaster: true` | `#dashboard` | Command Centre, Passbook, Ledger, Payroll Runs, Revenue Share, Settings | None (Full Root Governance) |
| **Normal Master** | `MASTER` | `isPrimaryMaster: false` | `#dashboard` | Command Centre, Inventory, Procurement, Reports, Quality | Mutate Primary Master designation, Universal Payroll unlock |
| **Owner** | `OWNER` | Executive Investor | `#dashboard` | Executive Dashboard, Performance, Bills, Ledger, Approvals | POS register, raw inventory counts, user role mutation |
| **Café Operations** | `CAFE_ADMIN` | Café In-Charge | `#pos` / `#dashboard` | POS Billing, Shift Management, Sales & Cash Book, Device Status | Cross-café ledger, company-wide payroll, revenue contracts |
| **Staff Member** | `STAFF` | Employee / Operator | `#staff-home` | Staff Portal, My Shifts, My Punches, My Leave, My Payslips | All management sidebars, all admin routes, all cash books |

---

### 2. Zero Client-Side Role Selection Contract
- Role assignment and landing route are computed **exclusively** on the backend from the authenticated JWT / session token.
- The client receives identity payload from `GET /api/v1/auth/me` and navigates strictly according to `user.role` and `user.isPrimaryMaster`.
- No query parameters (`?role=...`), `localStorage` keys, or unauthenticated client cookies can override server-determined role authority.
- During bootstrap/loading, a neutral loading shell is presented, ensuring **zero UI flash** of privileged management menus to unauthorized actors.
