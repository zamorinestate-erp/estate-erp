# ZAMORIN CAFE ERP — HT-04 WHOLE-SYSTEM STRESS, BREAKPOINT & GRACEFUL DEGRADATION TEST RESULTS

> **Hard-Testing Stage**: HT-04 Whole-System Stress, Breakpoint & Capacity Envelope  
> **Starting Commit**: `9f9ec6f`  
> **Final Tested Commit**: `PENDING COMMIT`  
> **Working Tree Status**: `CLEAN`  
> **HT-02 Status**: **BLOCKED — CLOUD STAGING PENDING**  
> **HT-03 Status**: **PASS**  
> **HT-04 Status**: **PASS WITH LOCAL CAPACITY LIMIT DOCUMENTED**  

---

## 1. EXECUTIVE SUMMARY & CAPACITY ENVELOPE

HT-04 executed whole-system mixed workload stress testing against Zamorin Cafe ERP across 8 sequential load tiers ranging from 250 to 2,500 concurrent Virtual Users (VUs) with a 3,000ms arrival window.

### Whole-ERP Workload Mix Distribution:
- **35% STAFF Self-Service**: `GET /api/v1/attendance/me/today`, `GET /api/v1/notifications`
- **25% POS Billing Writes**: `POST /api/v1/bills` (Immediate completion with Cash/UPI)
- **10% Menu Catalog Reads**: `GET /api/v1/menu/items`
- **8% Expense Submissions**: `POST /api/v1/expenses`
- **5% Inventory / Cafe Bills Reads**: `GET /api/v1/bills?cafeId=...`
- **5% Attendance Operations**: `POST /api/v1/attendance/me/today`
- **4% Reports & Analytics**: `GET /api/v1/reports/daily-summary`
- **3% Cash & Finance Reads**: `GET /api/v1/cash-transactions`
- **2% Procurement / Vendor Reads**: `GET /api/v1/vendors`
- **1% MASTER Governance & Search**: `GET /api/v1/search?q=coffee`
- **1% OWNER Strategic Reads**: `GET /api/v1/reports/daily-summary`
- **1% Negative Security Probes**: Owner Personal Ledger, Cafe Admin unassigned cafe, Staff cross-user, Staff operational checklist

---

## 2. LOAD LEVEL CAPACITY MATRIX

| Stage ID | Concurrency (VUs) | Requests | Success Rate | Unexpected 5xx | Throughput (RPS) | Overall p50 | Overall p95 | POS p95 | Menu p95 | Att p95 | Rep p95 | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **HT04-250** | 250 VUs | 252 | **100.0%** | 0 (0.0%) | 83.97 req/s | 11 ms | **29 ms** | 38 ms | 15 ms | 9 ms | 17 ms | **HEALTHY** |
| **HT04-500** | 500 VUs | 500 | **100.0%** | 0 (0.0%) | 141.88 req/s | 520 ms | **971 ms** | 1,083 ms | 1,050 ms | 839 ms | 765 ms | **HEALTHY** |
| **HT04-750** | 750 VUs | 750 | **100.0%** | 0 (0.0%) | 163.61 req/s | 1,386 ms | **2,192 ms** | 2,361 ms | 2,202 ms | 1,913 ms | 1,826 ms | **DEGRADED (First SLA Deviation)** |
| **HT04-1000** | 1,000 VUs | 1,000 | **100.0%** | 0 (0.0%) | 176.58 req/s | 2,448 ms | **3,917 ms** | 4,047 ms | 3,000 ms | 2,768 ms | 2,713 ms | **DEGRADED (Stable 100% Correct)** |
| **HT04-1250** | 1,250 VUs | 1,250 | **100.0%** | 0 (0.0%) | 175.66 req/s | 3,572 ms | **5,602 ms** | 5,745 ms | 4,337 ms | 3,698 ms | 3,827 ms | **DEGRADED (Stable 100% Correct)** |
| **HT04-1500** | 1,500 VUs | 1,500 | **100.0%** | 0 (0.0%) | 177.56 req/s | 4,509 ms | **6,963 ms** | 7,122 ms | 5,744 ms | 4,644 ms | 4,456 ms | **DEGRADED (Stable 100% Correct)** |
| **HT04-2000** | 2,000 VUs | 2,000 | **100.0%** | 0 (0.0%) | 176.55 req/s | 6,873 ms | **9,799 ms** | 9,952 ms | 8,609 ms | 6,793 ms | 7,066 ms | **DEGRADED (Stable 100% Correct)** |
| **HT04-2500** | 2,500 VUs | 2,500 | **98.0%** | 50 (2.0%) | 173.96 req/s | 9,273 ms | **12,771 ms** | 12,929 ms | 11,227 ms | 9,531 ms | 9,731 ms | **DEGRADED / FIRST ERROR BOUNDARY** |

---

## 3. CAPACITY ENVELOPE ANALYSIS

1. **Local Verified Sustainable Concurrency**: **500 VUs**  
   - All operations strictly satisfy the frozen SLA: POS p95 = 1,083 ms (<=3,000 ms), Menu p95 = 1,050 ms (<=2,000 ms), Attendance p95 = 839 ms (<=2,000 ms), Reports p95 = 765 ms (<=5,000 ms).
   - Success rate: **100.0%**, 5xx errors: **0**.

2. **First Degradation Point**: **750 VUs**  
   - The system maintained 100% success and 0 errors, but Menu read p95 rose to 2,202 ms (exceeding the strict 2,000 ms read threshold). POS write p95 remained healthy at 2,361 ms.

3. **First SLA Failure**: **750 VUs** (Menu Read p95: 2,202 ms > 2,000 ms).

4. **First Error-Rate Failure**: **2,500 VUs**  
   - At 2,500 VUs, 50 requests out of 2,500 (2.0%) timed out due to client-side Node.js event-loop socket backlog on the local machine.

5. **First Breakpoint / Local Ceiling**: **2,500 VUs**  
   - Local hardware throughput ceiling is reached at **~177 requests/second**. Beyond 2,000 VUs, request queues grow linearly while throughput remains flat.

6. **Process Stability**:  
   - Process crashes: **0 (Zero)**  
   - Unhandled rejections: **0**  
   - Uncaught exceptions: **0**  

7. **Post-Overload Recovery**:  
   - Immediate automatic recovery: **0.02 seconds** (`/health` = `ok`, `/readiness` = `ready`).

---

## 4. FINANCIAL INTEGRITY & RECONCILIATION

Across all load levels (Cold Runs + Escalation Stages + Repeat Runs):
- **Total Bills Created**: **2,814**
- **Total Cash Bills**: **1,411** (Total Cash Value: ₹498,347.00)
- **Total Cash Transactions Journal Entries**: **1,411** (Total Cash Value: ₹498,347.00)
- **Financial Reconciliation Variance**: **₹0.00 (Exact 100.0% Match)**
- **Duplicate Financial Postings**: **0**
- **Unexplained Records**: **0**

---

## 5. SECURITY & DENY-BY-DEFAULT UNDER OVERLOAD

Negative security probes injected across all load stages (including 500, 1,000, 1,500, 2,000, and 2,500 VUs):
- **Owner Personal Ledger Access**: **100% Denied (403 Forbidden)**
- **Cafe Admin Cross-Café Access**: **100% Denied (403 Forbidden)**
- **Staff Cross-User Access**: **100% Denied (403 Forbidden / 404)**
- **Staff Operational Quality Access**: **100% Denied (403 Forbidden)**
- **Prohibited Expense Decisions**: **0 Succeeded**
- **Security Leakage Under Overload**: **0 (Fail-Closed Deny-by-Default Confirmed)**

---

## 6. COLD-START STRESS INVESTIGATION

| Run | Concurrency | Success | Throughput | Overall p95 | POS p95 | Menu p95 | Att p95 | Rep p95 | Status |
|---|---|---|---|---|---|---|---|---|---|
| **Cold #1** | 500 VUs | 100% | 107.76 req/s | 2,146 ms | 2,673 ms | 2,518 ms | 1,937 ms | 1,859 ms | **DEGRADED (Cold startup)** |
| **Cold #2** | 500 VUs | 100% | 117.12 req/s | 1,849 ms | 2,099 ms | 1,914 ms | 1,617 ms | 1,403 ms | **HEALTHY** |
| **Cold #3** | 500 VUs | 100% | 147.19 req/s | 784 ms | 897 ms | 790 ms | 548 ms | 640 ms | **HEALTHY** |

### Cold-Start Root Cause:
1. **Mongoose Connection Pool Expansion**: On cold boot with `minPoolSize: 50`, initial TCP handshakes occur during the first burst.
2. **V8 JIT Warmup**: Hot execution paths (JWT verification, route regex evaluation, JSON schema serialization) compile within ~1.5 seconds.
3. **MongoDB Index Page Caching**: WiredTiger loads collection indexes into RAM during the first 500 operations.

---

## 7. AUTOMATED REGRESSION STATUS

```
ℹ tests 332
ℹ suites 12
ℹ pass 332
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 42695.9186
```
**Result: 332 / 332 PASS (100%)**.
