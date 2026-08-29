# ZAMORIN CAFÉ ERP — DATABASE SCALABILITY & INDEXING STRATEGY

> **Standard**: Zero Full Collection Scans (`COLLSCAN = 0`) on all Normal Workforce Workflows  
> **Confidence Status**: **VERIFIED_LOCAL & ARCHITECTURAL_TARGET**  

---

## 1. High-Volume Compound Index Catalog

| Collection | Compound Index Specification | Purpose / Query Path |
|---|---|---|
| `device_registrations` | `{ organisationId: 1, assignedCafeId: 1, status: 1 }` | Café-scoped device fleet queries |
| `device_registrations` | `{ organisationId: 1, status: 1, lastSeenAt: -1 }` | Fleet-wide presence & offline monitoring |
| `device_registrations` | `{ organisationId: 1, status: 1, createdAt: -1 }` | Device registration audit & onboarding log |
| `users` | `{ organisationId: 1, primaryCafeId: 1, status: 1 }` | 50k Employee directory café view |
| `users` | `{ organisationId: 1, role: 1, status: 1 }` | Governance & RBAC permission evaluation |
| `users` | `{ organisationId: 1, employeeId: 1 }` | Fast exact-ID employee lookup |
| `users` | `{ organisationId: 1, status: 1, name: 1 }` | Case-insensitive workforce search |
| `cafes` | `{ organisationId: 1, status: 1 }` | 1,000 Outlets portfolio aggregation |
| `bills` | `{ organisationId: 1, cafeId: 1, createdAt: -1 }` | POS billing ledger & sales reporting |
| `stock_movements` | `{ organisationId: 1, cafeId: 1, createdAt: -1 }` | Stock ledger journal & inventory balance |
| `operator_sessions` | `{ deviceId: 1, status: 1 }` | Active device session validation & revocation |
| `audit_events` | `{ organisationId: 1, createdAt: -1 }` | Immutable compliance audit trail |

---

## 2. Keyset & Bounded Pagination Guarantees

All entity listing endpoints enforce strict pagination limits:
- **Default Limit**: 50 items
- **Hard Maximum Limit**: 200 items
- **Keyset / Indexed Sorting**: Sorts use indexed timestamp (`createdAt: -1` or `lastSeenAt: -1`), avoiding in-memory sort buffer overflow.
