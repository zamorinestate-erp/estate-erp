# ZAMORIN CAFÉ ERP — DISTRIBUTED JOB LOCK & FENCING TOKENS REPORT
**Document ID**: `ZAM-SCAL-JOB-001`  
**Programme**: `feature/enterprise-scalability`  
**Status**: `VERIFIED_LOCAL_MULTI_PROCESS`

---

## 1. High-Value Financial Operations & Stale Worker Problem

When distributed background workers execute critical tasks (daily payroll runs, revenue rollups, inventory valuation snapshots, passbook reconciliations):
- A worker (Process A) may acquire an exclusive lock, experience a long GC pause or network stall exceeding the lease TTL, and resume execution after a replacement worker (Process B) has acquired the lock and completed the job.
- Without **fencing tokens**, Process A would commit stale/duplicate financial journal entries.

---

## 2. Technical Implementation
1. **Monotonically Increasing Fencing Tokens**: Every successful `acquireLock()` call generates a monotonically increasing token `fencingToken` ($T_2 > T_1$).
2. **Safe Lock Release**: Lock release uses an atomic Lua script / exact owner match so a worker cannot accidentally release another worker's lock.
3. **Fencing Verification Hook**: `verifyFencingToken(jobName, ownerId, fencingToken)` is verified immediately prior to executing database commits.

---

## 3. Empirical Test Results

Executed via `scripts/audit_real_process_job_fencing.mjs`:

```
======================================================================
           JOB COORDINATION & FENCING SCORECARD
======================================================================
MUTUAL_EXCLUSION:              PASS
SAFE_LOCK_RELEASE:             PASS
FENCING_TOKEN_MONOTONIC:       PASS (T2: 17879875673220004 > T1: 17879875671630004)
STALE_COMMITS_BLOCKED:         1
AUTHORITATIVE_FINANCIAL_COMMITS: 1 (Expected: 1)
FINANCIAL_DUPLICATES:          0 (₹0.00 variance)
OVERALL_JOB_SAFETY_STATUS:     PASS
======================================================================
```

- **Worker A** acquired lock with Token $T_1 = 17879875671630004$ (100ms TTL) and paused for 150ms.
- **Worker B** acquired replacement lock with Token $T_2 = 17879875673220004$ ($T_2 > T_1$) and committed ₹150,000.00.
- **Worker A** resumed and attempted commit with $T_1$ -> **Rejected with `FENCING_TOKEN_STALE_LEASE_EXPIRED`**.
- **Financial Side-Effects**: Exactly 1 commit. Duplicate variance: ₹0.00.
