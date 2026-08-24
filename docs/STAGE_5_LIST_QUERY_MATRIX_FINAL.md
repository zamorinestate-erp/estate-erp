# ZAMORIN CAFE ERP
## STAGE 5 — LIST QUERY & PAGINATION MATRIX (FINAL)

Audit of all major user-facing list endpoints to verify bounded limit enforcement and pagination semantics.

| Endpoint | Mongoose Model | Default Filter | Default Sort | Default Limit | Max Page Size | Pagination Mechanism | Status |
|---|---|---|---|:---:|:---:|---|:---:|
| `GET /api/v1/bills` | `Bill` | `{ organisationId, cafeId }` | `{ createdAt: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/customers` | `Customer` | `{ organisationId, status }` | `{ totalSpendPaisa: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/inventory/items` | `GlobalInventoryItem` | `{ organisationId }` | `{ itemCode: 1 }` | 100 | 200 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/procurement/orders` | `PurchaseOrder` | `{ organisationId, status }` | `{ createdAt: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/assets` | `Asset` | `{ organisationId, cafeId }` | `{ createdAt: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/expenses` | `Expense` | `{ organisationId, cafeId }` | `{ expenseDate: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/vendors` | `Vendor` | `{ organisationId }` | `{ vendorName: 1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/tasks` | `Task` | `{ organisationId, status }` | `{ priority: -1, dueDate: 1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/employees` | `Employee` | `{ organisationId, status }` | `{ fullName: 1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/payroll/runs` | `PayrollRun` | `{ organisationId }` | `{ periodKey: -1 }` | 20 | 50 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/devices` | `DeviceRegistration` | `{ organisationId, cafeId }` | `{ lastSeenAt: -1 }` | 50 | 100 | Skip / Limit cursor | **BOUNDED & PAGINATED** |
| `GET /api/v1/admin/cafes` | `Cafe` | `{ organisationId }` | `{ cafeCode: 1 }` | 50 | 50 | Bounded reference set (≤10 cafes)| **BOUNDED REFERENCE** |
| `GET /api/v1/menu/items` | `MenuItem` | `{ organisationId }` | `{ category: 1, name: 1 }` | 100 | 250 | Catalog reference set | **BOUNDED REFERENCE** |

---
**Query Audit Certified:** Zero unbounded `find()` calls. All user-facing list endpoints enforce strict limits and pagination parameters.
