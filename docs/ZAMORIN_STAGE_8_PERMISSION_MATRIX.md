# ZAMORIN CAFE ERP — STAGE 8 PERMISSION MATRIX
## Role-Based Access Control for All Stage 8 Modules

Generated: 2026-08-07 | Git HEAD: 6c73fe5

---

## Role Hierarchy

MASTER > OWNER > CAFE_ADMIN > STAFF

Absolute restrictions (MASTER ONLY regardless of hierarchy):
- Personal Ledger (all operations)
- Expense decisions (approve/reject/return/mark-paid/reverse)
- Overtime final decision
- User Administration
- Master Audit Page
- Trash Bin
- Primary Master governance

---

## Stage 8 Module Permission Table

| Module / Endpoint | MASTER | OWNER | CAFE_ADMIN | STAFF | Enforcement |
|------------------|--------|-------|-----------|-------|-------------|
| **Personal Ledger** | | | | | |
| GET /personal-ledger | READ (own org) | DENIED (404) | DENIED (404) | DENIED (404) | absoluteRestriction: PERSONAL_LEDGER |
| POST /personal-ledger | CREATE | DENIED | DENIED | DENIED | absoluteRestriction: PERSONAL_LEDGER |
| POST /personal-ledger/:id/reverse | REVERSE | DENIED | DENIED | DENIED | absoluteRestriction: PERSONAL_LEDGER |
| **Inventory** | | | | | |
| GET /inventory/items | READ all org | READ all org | READ assigned cafes | DENIED | authorize INVENTORY:READ |
| POST /inventory/items | CREATE | CREATE | DENIED | DENIED | authorize INVENTORY:WRITE, MASTER/OWNER |
| POST /inventory/stock/:cafeId/movement | RECORD | RECORD | RECORD (own cafe) | DENIED | cafeId intersection check |
| GET /inventory/stock/:cafeId | READ | READ | READ (own cafe) | DENIED | cafeId scope |
| **Vendors** | | | | | |
| GET /vendors | READ | READ | DENIED | DENIED | authorize VENDORS:READ |
| POST /vendors | CREATE | DENIED | DENIED | DENIED | authorize VENDORS:WRITE, MASTER only |
| PATCH /vendors/:id/status | UPDATE | DENIED | DENIED | DENIED | MASTER only |
| **Procurement** | | | | | |
| GET /procurement/orders | READ all | READ all | READ assigned cafes | DENIED | authorize PROCUREMENT:READ |
| POST /procurement/orders | CREATE | CREATE | DENIED | DENIED | authorize PROCUREMENT:WRITE |
| POST /procurement/orders/:id/approve | APPROVE | APPROVE | DENIED | DENIED | MASTER/OWNER only |
| POST /procurement/orders/:id/receive | RECEIVE | RECEIVE | RECEIVE (own cafe) | DENIED | cafeId scope |
| **Menu** | | | | | |
| GET /menu | READ | READ | READ | DENIED | authorize MENU:READ |
| POST /menu | CREATE | DENIED | DENIED | DENIED | authorize MENU:WRITE, MASTER only |
| PATCH /menu/:id | UPDATE | DENIED | DENIED | DENIED | MASTER only |
| **POS / Bills** | | | | | |
| GET /bills | READ | READ | READ (own cafe) | DENIED | cafeId scope |
| POST /bills | CREATE | DENIED | CREATE (own cafe) | CREATE (own cafe) | cafeId must match |
| POST /bills/:id/complete | COMPLETE | DENIED | COMPLETE (own cafe) | COMPLETE (own cafe) | cafeId scope |
| POST /bills/:id/void | VOID | VOID | DENIED | DENIED | MASTER/OWNER only |
| **Customers** | | | | | |
| GET /customers | READ | READ | READ (own cafe) | DENIED | cafeId scope |
| POST /customers | CREATE | CREATE | CREATE | DENIED | cafeId scope |
| POST /customers/:id/earn | EARN | EARN | EARN (own cafe) | DENIED | cafeId scope |
| POST /customers/:id/redeem | REDEEM | REDEEM | REDEEM (own cafe) | DENIED | cafeId scope |
| **Tasks** | | | | | |
| GET /tasks | READ | READ | READ (assigned cafes) | READ (own tasks) | cafeId + userId scope |
| POST /tasks | CREATE | CREATE | CREATE (own cafes) | DENIED | MASTER/OWNER/CAFE_ADMIN |
| PATCH /tasks/:id | UPDATE | UPDATE | UPDATE (own cafes) | UPDATE (own tasks, status only) | scope check |
| **Approvals** | | | | | |
| GET /approvals | READ | READ | READ (own org) | DENIED | MASTER/OWNER/CAFE_ADMIN |
| POST /approvals/:id/decide | DECIDE | DECIDE (non-protected) | DECIDE (non-protected) | DENIED | GAP-004: entityType blocklist MISSING — fix required |
| **Quality** | | | | | |
| GET /quality | READ | READ | READ (own cafes) | DENIED | cafeId scope |
| POST /quality | CREATE | CREATE | CREATE (own cafes) | DENIED | cafeId scope |
| **Assets** | | | | | |
| GET /assets | READ | READ | READ (own cafes) | DENIED | cafeId scope |
| POST /assets | CREATE | CREATE | DENIED | DENIED | MASTER/OWNER |
| POST /assets/:id/maintenance | CREATE JOB | CREATE JOB | CREATE JOB (own cafes) | DENIED | cafeId scope |
| **Department Orders** | | | | | |
| GET /department-orders | READ | READ | READ (own cafes) | DENIED | cafeId scope |
| POST /department-orders | CREATE | CREATE | CREATE (own cafes) | DENIED | cafeId scope |
| **Revenue Share** | | | | | |
| GET /revenue-share | READ | READ | DENIED | DENIED | MASTER/OWNER |
| POST /revenue-share | CREATE | DENIED | DENIED | DENIED | MASTER only |
| **Dashboard** | | | | | |
| GET /dashboard | Full org metrics | Full org metrics | Assigned cafes only | DENIED | role+cafeId filter |
| **Files** | | | | | |
| GET /files/:id | READ (own org) | READ (own org) | READ (own cafes) | DENIED | organisationId scope |
| POST /files | REGISTER | REGISTER | REGISTER | DENIED | authenticate |
| **Trash Bin** | | | | | |
| GET /trash | READ | DENIED | DENIED | DENIED | MASTER only |
| POST /trash/:type/:id/restore | RESTORE | DENIED | DENIED | DENIED | MASTER only |
| **Global Search** | | | | | |
| GET /search | Full org scope | Full org scope | Own cafes scope | DENIED | role+cafeId filter; Personal Ledger excluded |

---

## Absolute Restrictions Summary

| Restriction | Enforced In | Roles Blocked |
|------------|-------------|---------------|
| PERSONAL_LEDGER | personalLedgerRoutes.js + authorize middleware | OWNER, CAFE_ADMIN, STAFF |
| EXPENSE_DECISIONS | expenseRoutes.js approve/reject/markpaid routes | OWNER, CAFE_ADMIN, STAFF |
| USER_MANAGE | userRoutes.js all mutation routes | OWNER, CAFE_ADMIN, STAFF |
| MASTER_AUDIT | auditRoutes.js | OWNER, CAFE_ADMIN, STAFF |
| TRASH | trashRoutes.js | OWNER, CAFE_ADMIN, STAFF |
| GENERIC_APPROVAL bypass | GAP-004: NOT YET ENFORCED — fix pending | entityType check missing in approvalController.js |

---

## Cross-Organisation Isolation

All Stage 8 models include `organisationId: { type: String, required: true, immutable: true }`.
All controllers scope queries with `organisationId: request.auth.organisationId`.
Cross-organisation access is impossible through normal API paths.

Cross-cafe isolation for CAFE_ADMIN: all controllers check `cafeId: { $in: request.auth.assignedCafeIds }`.
