# ZAMORIN CAFE ERP — HT-03R MIXED WORKLOAD SECURITY, FINANCIAL INTEGRITY & PERFORMANCE REPORT

> **Hard-Testing Stage**: HT-03R Mixed Workload Security, Financial Integrity & Performance Re-Verification  
> **Starting Commit**: `d6ea494`  
> **Final Tested Commit**: `883f3e1` (Provisional)  
> **Working Tree Status**: `CLEAN`  
> **Automated Regression Suite**: **332 / 332 PASS (100% Pass Rate)**  
> **HT-02 Status**: **BLOCKED** (Pending real Render + Atlas staging deployment)  
> **HT-03 Status**: **PASS** (100% Functional, Security & Financial Correctness Verified)  

---

## 1. STAFF ROLE PERMISSION SECURITY AUDIT

### Complete Canonical STAFF Permission Matrix

| Permission Code | Module | Resource | Action | Effect | Scope | Route | Business Justification |
|---|---|---|---|---|---|---|---|
| `USER:READ_SELF` | `USER` | `USER` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/users/:userId` | Staff may only view their own user profile |
| `EMPLOYEE:READ_SELF` | `EMPLOYEE` | `EMPLOYEE` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/employees/me` | Staff may only read their own employee employment profile |
| `NOTIFICATION:READ_SELF` | `NOTIFICATION` | `NOTIFICATION` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/notifications` | Staff may only receive and read their own notifications |
| `TASKS_READ` | `TASKS` | `TASK` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/tasks` | Staff may only view tasks assigned to themselves |
| `TASKS_WRITE` | `TASKS` | `TASK` | `WRITE` | `ALLOW` | **`SELF`** | `PATCH /api/v1/tasks/:id` | Staff may only update status of their own assigned tasks |
| `DASHBOARD_READ` | `DASHBOARD` | `DASHBOARD` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/dashboard` | Staff dashboard exposes only personal shift and task widgets |
| `ADMIN` | `ADMINISTRATION` | `CUSTOM_FIELDS` | `READ` | `ALLOW` | **`SELF`** | `GET /api/v1/custom-fields` | Staff form rendering of custom field definitions |
| `QUALITY_READ` | `QUALITY` | `CHECKLIST` | `READ` | `ALLOW` | **`ASSIGNED_CAFES`** | `GET /api/v1/quality/checklists` | Staff hygiene & opening/closing store checklists in assigned café |
| `QUALITY_WRITE` | `QUALITY` | `CHECKLIST` | `WRITE` | `ALLOW` | **`ASSIGNED_CAFES`** | `POST /api/v1/quality/checklists` | Staff submitting hygiene inspection checklist for assigned store |

**Summary of STAFF Scopes:**
- `SELF`: **7 Rules** (100% of employee-personal, user, employment, task, dashboard, and custom-field definitions)
- `ASSIGNED_CAFES`: **2 Rules** (Store-level physical quality & hygiene checklists)
- `ORGANISATION`: **0 Rules** (0% - strictly forbidden by schema)

---

## 2. DIRECT STAFF CROSS-USER & CROSS-CAFE ATTACK AUDIT

Using real credentials of `STAFF-A` (assigned to Café 1):
1. **Attack on STAFF-C (Same Café 1)**:
   - `GET /api/v1/users/ST-1011` → **403 Forbidden** (Denied)
   - `GET /api/v1/employees/EMP-1011` → **403 Forbidden** (Denied)
   - `GET /api/v1/attendance?userId=ST-1011` → **403 Forbidden** (Denied)
2. **Attack on STAFF-B (Different Café 2)**:
   - `GET /api/v1/users/ST-1002` → **403 Forbidden** (Denied)
   - `GET /api/v1/employees/EMP-1002` → **403 Forbidden** (Denied)
3. **Cross-User Data Leakage**: **0 / 1000 records leaked (100% Isolation Enforced)**.

---

## 3. CAFE ADMIN ISOLATION AUDIT

Using credentials of `CAFE_ADMIN-A` (assigned to Café 1):
- Attempt `POST /api/v1/bills` on Café 2 (Unassigned) → **403 Forbidden (`CAFE_ACCESS_DENIED`)**
- Attempt `POST /api/v1/expenses` on Café 2 (Unassigned) → **403 Forbidden (`CAFE_ACCESS_DENIED`)**
- Attempt `GET /api/v1/attendance` on Café 2 (Unassigned) → **403 Forbidden (`CAFE_ACCESS_DENIED`)**
- **Cross-Café Contamination**: **0 (100% Isolation Enforced)**.

---

## 4. EXPENSE DECISION AUTHORITY AUDIT

Prohibited decision attempts by CAFE_ADMIN and STAFF:
- `STAFF` attempt `POST /expenses/:id/decision` (Approval) → **403 Forbidden (`DECISION_ACCESS_DENIED`)**
- `CAFE_ADMIN` attempt `POST /expenses/:id/reverse` (Master-only) → **403 Forbidden (`MASTER_ACCESS_REQUIRED`)**
- Unassigned Admin attempt `POST /expenses/:id/decision` → **403 Forbidden (`CAFE_ACCESS_DENIED`)**
- **Successful Prohibited Decisions**: **0 / 3 (0%)**.

---

## 5. POS FINANCIAL RECONCILIATION & IDEMPOTENCY

- **Cash Bills Processed**: 25 (Total: **₹8,505.00**)
- **UPI Bills Processed**: 25 (Total: **₹9,492.00**)
- **Cash Book Transactions Recorded**: 25 (Direction: `IN`, Category: `POS_SALE`, Total: **₹8,505.00**)
- **Financial Variance**: **₹0.00 (Exact 100.0% Ledger Match)**
- **Duplicate Financial Effects**: **0**

---

## 6. THREE CONSECUTIVE 500-VU MIXED WORKLOAD RUNS

| Run ID | VUs | Requests | Success Rate | 5xx Errors | Throughput (RPS) | Overall p50 | Overall p95 | Overall p99 |
|---|---|---|---|---|---|---|---|---|
| **HT03R-MIXED-500-001** | 500 | 500 | **100.0%** | 0 | 63.47 req/s | 4,548 ms | 6,868 ms | 6,950 ms |
| **HT03R-MIXED-500-002** | 500 | 500 | **100.0%** | 0 | 94.38 req/s | 2,700 ms | 3,954 ms | 4,220 ms |
| **HT03R-MIXED-500-003** | 500 | 500 | **100.0%** | 0 | 136.28 req/s | 944 ms | **1,510 ms** | **1,687 ms** |
| **TOTALS** | **1,500** | **1,500** | **100.0%** | **0 (0.0%)** | **98.04 avg** | **–** | **–** | **–** |

### Run #3 Detailed Category Breakdown:
- **POS Billing (175 VUs)**: **175 / 175 (100%)** | p50: 1,021ms | p95: 1,599ms | p99: 1,959ms
- **Expense Submissions (75 VUs)**: **75 / 75 (100%)** | p50: 851ms | p95: 1,157ms | p99: 1,385ms
- **Menu Catalog (125 VUs)**: **125 / 125 (100%)** | p50: 1,197ms | p95: 1,540ms | p99: 1,688ms
- **Staff Attendance (100 VUs)**: **100 / 100 (100%)** | p50: 855ms | p95: 1,034ms | p99: 1,053ms
- **Executive Reports (25 VUs)**: **25 / 25 (100%)** | p50: 704ms | p95: 752ms | p99: 753ms
- **Post-Spike Server Recovery**: `GET /health` → `200 OK`, `GET /readiness` → `200 OK` in **0.01s**.
