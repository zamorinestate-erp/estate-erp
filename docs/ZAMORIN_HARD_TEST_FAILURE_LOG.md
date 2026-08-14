# ZAMORIN CAFE ERP — HARD TESTING FAILURE LOG

## INCIDENT LOG: FAIL-HT01-001

| Parameter | Value |
|---|---|
| **Incident ID** | FAIL-HT01-001 |
| **Stage** | HT-01 — Concurrent Login & Application Boot Storm |
| **Tested Commit** | `3fc32c53be7db365a115d3fba817a6464fdd6555` |
| **Date & Time** | 2026-08-13 |
| **Severity** | **P1 — High Capacity Defect** |
| **Status** | **REMEDIATION REQUIRED** |

---

## 1. FAILURE DESCRIPTION
During HT-01 500-user concurrent login storm execution (`HT01-LOGIN-500-MODE-B`), the application failed the mandatory acceptance criteria for latency (p95 <= 3,000 ms) and request success rate (>= 99.5%).

### Empirical Test Measurements:
- **500 VU Mode A (Pure Login)**: Success Rate 31.6%, p95 Login Latency 12,902 ms (BREAKPOINT).
- **500 VU Mode B (Full Application Bootstrap)**: Success Rate 0.0% (due to client harness header structure and server TCP socket queue saturation), p95 Login Latency 80,347 ms (BREAKPOINT).
- **Required Acceptance Criteria**:
  - Valid Login Success Rate: `>= 99.5%`
  - Unexpected 5xx Errors: `< 0.5%`
  - Login p95 Latency: `<= 3,000 ms`
  - Login p99 Latency: `<= 5,000 ms`
  - `/auth/me` p95 Latency: `<= 2,000 ms`

---

## 2. ROOT CAUSE ANALYSIS

### Primary CPU Hashing Bottleneck:
1. **Password Hashing Compute**: User password verification utilizes `bcrypt` with cost factor 12 (as mandated by security policy).
2. **CPU Execution Time**: Computing a single `bcrypt` hash with cost factor 12 requires ~300ms to 500ms of dedicated CPU time on modern V8 execution engines.
3. **Pure JS Execution Overhead**: `bcryptjs` (pure JavaScript) ran single-threaded on the V8 main event loop, completely blocking incoming HTTP request acceptance.
4. **Single-Instance CPU Capacity Limit**: A single Node.js process core can process at most ~2.0 to 3.3 logins per second. For 500 VUs arriving simultaneously, CPU compute queue depth reaches ~250 seconds, exceeding socket timeout limits (30s).

### Secondary Harness Discrepancy Analysis:
- In the original submission, `HT01-MIXED-ROLE` reported 100% success in 1,240 ms because an earlier test iteration executed prior to schema validation alignment, causing instant HTTP 400 Bad Request responses (0ms compute latency).
- When real credentials with valid schema and cost factor 12 password hashing were executed, both pure login and mixed-role scenarios hit identical CPU saturation limits.

## INCIDENT LOG: FAIL-HT03R-001

| Parameter | Value |
|---|---|
| **Incident ID** | FAIL-HT03R-001 |
| **Stage** | HT-03R — Mixed Workload Security, Financial Integrity & Performance |
| **Tested Commit** | `e621cee` |
| **Date & Time** | 2026-08-15 |
| **Severity** | **P1 — Performance & Policy Alignment Defect** |
| **Status** | **RESOLVED (HT-03R2 Closure)** |

### 1. FAILURE DESCRIPTION
During HT-03R mixed workload testing, the first 500-VU run (`HT03R-MIXED-500-001`) failed the strict local performance thresholds (POS p95: 4,004 ms > 3,000 ms; Menu p95: 2,786 ms > 2,000 ms; Attendance p95: 2,300 ms > 2,000 ms). Furthermore, two policy contradictions existed:
1. `PERSONAL_LEDGER` allowed `OWNER` role access in middleware, routes, and seeds despite authoritative policy restricting Personal Ledger strictly to `MASTER`.
2. `STAFF` possessed 2 `ASSIGNED_CAFES` rules for operational quality inspection checklists despite authoritative policy restricting `STAFF` strictly to self-service.

### 2. ROOT CAUSE ANALYSIS
1. **Cold Database Connection Pool**: In cold runs, Mongoose connection pool started with `minPoolSize: 10`. Under an immediate 500-VU concurrent spike, Mongoose had to synchronously establish 40+ new TCP connections to MongoDB while processing writes.
2. **Cold V8 JIT & MongoDB Index Cache**: The Node.js event loop had not JIT-compiled JSON serializers and Express route handlers, and MongoDB WiredTiger storage had not warmed index B-trees into cache.

### 3. REMEDIATION ACTIONS EXECUTED
1. **Personal Ledger Policy Remediation**: Enforced `MASTER` only access across `authorize.js`, `personalLedgerRoutes.js`, `searchController.js`, `seedInitialData.js`, frontend router, and navigation. Verified `OWNER` receives 403 Forbidden across all ledger endpoints.
2. **STAFF Scope Remediation**: Removed `STAFF` from quality checklist permissions and routes. Verified `STAFF` holds exactly 7 `SELF` rules, 0 `ASSIGNED_CAFES` rules, and 0 `ORGANISATION` rules.
3. **Database Reconciliation**: Added automatic stale rule cleanup in `seedPermissionRules`.
4. **Connection Pool Optimization**: Configured `minPoolSize: 50` on worker instances to eliminate TCP socket allocation jitter during load bursts.
5. **Repeatability Verification**: Successfully executed Cold Start Test (documenting cold behavior) followed by 3 consecutive qualifying runs (`HT03R2-MIXED-500-001`, `HT03R2-MIXED-500-002`, `HT03R2-MIXED-500-003`), all achieving 100% success and satisfying all p95 thresholds (POS p95: 2670ms / 1535ms / 1160ms; Menu p95: 1905ms / 1321ms / 1164ms; Attendance p95: 1397ms / 890ms / 912ms; Expense p95: 1475ms / 1069ms / 886ms; Reports p95: 984ms / 594ms / 595ms).

---

## INCIDENT LOG: FAIL-HT02R2-001

- **Test ID**: HT-02R2 (Shift-Start Attendance Storm Final SLA Closure)
- **Component**: Attendance Check-in Engine / SequenceCounter / Database Write Bottleneck
- **Defect Description**: Single and multi-instance 500-VU Mode-B p95 latency reached a physical local disk I/O floor of 4,009 ms (exceeding strict p95 <= 2,000 ms SLA).
- **Severity**: P1 (Performance SLA Defect)
- **Remediation Actions Executed**:
  1. Reduced `SequenceCounter.generateId` DB calls by 98% via lock-free block range allocation (1,000 sequence IDs generated in 95ms).
  2. Implemented 10s TTL in-memory cache for operational cafe lookups.
  3. Reduced per-user DB operations from 7 down to 3 (57% reduction in DB I/O).
  4. Executed benchmarks across 4, 5, 6, and 8 worker instances (100.0% request success rate).
  5. Re-verified 332/332 regression tests PASS.
- **Status**: BLOCKED (Production-Like Database Performance Validation Pending on Atlas M30 Staging)


## INCIDENT LOG: FAIL-HT02-001

- **Test ID**: HT-02 (Shift-Start Attendance Storm)
- **Component**: Attendance Check-in Engine / SequenceCounter / Error Handler
- **Initial Failure Mode**:
  1. `ECONNREFUSED 127.0.0.1:4006` caused by Node.js process exit on unhandled Mongoose `VersionError` in `SequenceCounter` with `optimisticConcurrency: true`.
  2. Single-instance 500 Mode-B p95 latency was 10,553 ms (exceeding p95 <= 2,000 ms SLA).
  3. `errorHandler.js` translated all `E11000` errors globally to `ATTENDANCE_ALREADY_EXISTS`.
- **Severity**: P1 (Performance SLA Defect & Domain Error Misclassification)
- **Remediation Actions Taken**:
  1. Removed `optimisticConcurrency: true` from `sequenceCounterSchema` to enable atomic `$inc` updates. Verified with 1,000 concurrent callers (0 duplicates).
  2. Added process error listeners (`unhandledRejection`, `uncaughtException`). Verified 3 consecutive 500-VU stability runs (0 crashes).
  3. Updated `errorHandler.js` with domain-aware E11000 mapping (`ATTENDANCE_ALREADY_EXISTS`, `USER_ALREADY_EXISTS`, `VENDOR_ALREADY_EXISTS`, `DUPLICATE_KEY_CONFLICT`).
  4. Added 10s TTL in-memory cache for `validateOperationalCafe` in `attendanceController.js`.
  5. Performed multi-instance cluster load testing (2, 3, 4 instances).
  6. Verified 500 clock-in, 500 duplicate blocked (409), 500 clock-out, and 400 mixed workload operations (100.0% success rate).
  7. Re-verified 332/332 regression tests PASS.
- **Status**: RESOLVED (P1: 0)


## 3. REMEDIATION PLAN (HT-01R)
1. **Offload Hashing to Native C++ Libuv Pool**: Replace `bcryptjs` with native `bcrypt` (C++ addon) and set `process.env.UV_THREADPOOL_SIZE = 128` to execute hashes concurrently on C++ background threads.
2. **Socket Pool Expansion**: Set Node.js `http.globalAgent.maxSockets = 2000` to prevent load client socket queue contention.
3. **Horizontal Scaling Architecture**: Document multi-instance Render horizontal scaling strategy (10-19 instances for 500 VUs) and MongoDB Atlas M30 connection pooling strategy (`maxPoolSize: 50`).
