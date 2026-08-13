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

---

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
