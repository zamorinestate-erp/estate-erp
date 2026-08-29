# ZAMORIN CAFÉ ERP — DISTRIBUTED JOB COORDINATION & ASYNC EXPORTS

> **Standard**: Zero Duplicate Payroll Executions & Bounded Memory Exports  
> **Confidence Status**: **VERIFIED_CLUSTER_TEST & VERIFIED_LOCAL**  

---

## 1. Distributed Mutex Leases (`src/services/jobCoordinationService.js`)

In a multi-instance cluster, scheduled background jobs (payroll processing, inventory balance rollups, retention cleanups) must run on **exactly one node**.

```
Node A (Worker 1) ───► acquireLock('DAILY_PAYROLL_RUN', ttl=60s) ───► Acquired (Lock granted)
Node B (Worker 2) ───► acquireLock('DAILY_PAYROLL_RUN', ttl=60s) ───► Denied (Lock held by Node A)
Node A finishes   ───► releaseLock('DAILY_PAYROLL_RUN')          ───► Released
```

---

## 2. Asynchronous Export Job Queue (`src/services/exportJobQueueService.js`)

For 1,000 cafés and 50,000 employees, generating large Excel / CSV exports synchronously blocks the HTTP thread.

- **Small Single-Outlet Export**: Fast-path synchronous streaming.
- **Large Multi-Café / Portfolio Export**:
  - Request returns `HTTP 202 Accepted` with `jobId`.
  - Client polls `GET /api/v1/reports/exports/jobs/:jobId` for percentage progress (0% -> 100%).
  - Once `COMPLETED`, client downloads artifact via streaming chunked URL with 50MB per-job memory cap.
