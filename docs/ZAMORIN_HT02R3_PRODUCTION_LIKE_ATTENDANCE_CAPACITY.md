# ZAMORIN CAFE ERP — HT-02R3 PRODUCTION-LIKE ATTENDANCE DATABASE CAPACITY SPECIFICATION & STAGING STATUS

> **Programme Stage**: HT-02R3 Production-Like Attendance Database Capacity Validation  
> **Starting Commit**: `6c4bcf2`  
> **Final Tested Commit**: `6c4bcf2`  
> **Working Tree Status**: `CLEAN`  
> **Automated Regression Suite**: **332 / 332 PASS (100% Pass Rate)**  
> **HT-02 Final Classification**: **BLOCKED**  
> **Blocker Reason**: **PRODUCTION-LIKE DATABASE PERFORMANCE VALIDATION PENDING (Staging Infrastructure Provisioning Required)**  

---

## 1. EXECUTIVE SUMMARY & STAGING STATUS

HT-02 evaluated the shift-start attendance check-in engine under 500-user simultaneous load. While all functional correctness, data integrity, duplicate prevention, and authorization security criteria have been proven 100%, the 500-VU write workload on local single-node MongoDB hits a physical disk I/O floor of ~4.0 seconds p95.

Per the HT-02R3 mandate, final closure of the `p95 <= 2,000 ms` SLA requires testing on a dedicated, region-aligned, production-like staging topology. Because live cloud infrastructure (Render Singapore + MongoDB Atlas M30) is pending provisioning and deployment, **HT-02 is classified as `BLOCKED`**.

---

## 2. PRODUCTION-LIKE STAGING TOPOLOGY SPECIFICATION

```text
+-------------------------------------------------------------------------------+
|                        SYNTHETIC LOAD GENERATOR                               |
|        500 Unique Staff | 10 Cafés | 2-Second Arrival Window                  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ (HTTPS / TLS 1.3)
+-------------------------------------------------------------------------------+
|                       RENDER STAGING WEB SERVICE                              |
|  Region: Singapore (singapore-1)                                              |
|  Instance Class: Standard / Pro (1 to 4 instances)                            |
|  Runtime: Node.js v24 LTS (UV_THREADPOOL_SIZE=128, maxSockets=2000)           |
|  Health / Readiness Endpoints: /api/v1/health, /api/v1/readiness              |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼ (MongoDB Wire Protocol TLS, VPC / Peering)
+-------------------------------------------------------------------------------+
|                     MONGODB ATLAS DEDICATED STAGING                           |
|  Tier: M30 Dedicated Replica Set (3 nodes: Primary + 2 Secondaries)          |
|  Cloud Provider: AWS / GCP (Singapore Region: ap-southeast-1)                |
|  Storage / IOPS: Provisioned SSD (3,000 IOPS minimum)                         |
|  Max Connections: 3,000 (Mongoose maxPoolSize: 100 per backend instance)      |
|  Security: Dedicated staging user, Least Privilege, TLS, IP Access List      |
+-------------------------------------------------------------------------------+
```

---

## 3. SUMMARY OF CODE-LEVEL OPTIMIZATIONS COMPLETED (Commit `6c4bcf2`)

1. **Lock-Free Block Sequence Pre-Allocation**:
   - `SequenceCounter.generateId` uses promise-deduped in-memory block pre-allocation (`sequenceBlockPools`).
   - 1,000 concurrent allocations executed in **95 ms** (**98% reduction in latency**).
   - Generates 100% unique sequence IDs matching `/^AT-\d{8}-\d{4,}$/`. Zero duplicates, zero skipped numbers.
2. **10-Second TTL Operational Café Caching**:
   - `validateOperationalCafe` in `attendanceController.js` caches active café status for 10 seconds, eliminating 500 redundant DB queries during storm check-ins.
3. **Domain-Aware E11000 Error Translation**:
   - `errorHandler.js` accurately routes duplicate errors to domain-specific HTTP 409 responses (`ATTENDANCE_ALREADY_EXISTS`, `USER_ALREADY_EXISTS`, `VENDOR_ALREADY_EXISTS`, `DUPLICATE_KEY_CONFLICT`).
4. **Database Operations Reduction**:
   - Total DB operations per full-flow clock-in reduced from **7 ops down to 3 ops (57% reduction)**.

---

## 4. LOCAL VALIDATION EVIDENCE

| Test Dimension | Requirement | Measured Result | Status |
|---|---|---|---|
| **Legitimate Check-in Success** | `>= 99.5%` | **100.0%** (500 / 500 VUs) | **PASS** |
| **Duplicate Check-in Blocked** | `100.0%` (409 Conflict) | **100.0%** (500 / 500 Blocked) | **PASS** |
| **500 Concurrent Clock-Out** | `>= 99.5%` | **100.0%** (500 / 500 Success) | **PASS** |
| **Mixed Attendance Workload** | `>= 99.5%` | **100.0%** (400 / 400 Success) | **PASS** |
| **Sequence Uniqueness (1000 Calls)** | `100.0% Unique` | **1000 / 1000 Unique** (95ms) | **PASS** |
| **Cross-User Data Leakage** | `0` | **0 (ZERO)** | **PASS** |
| **Cross-Café Data Leakage** | `0` | **0 (ZERO)** | **PASS** |
| **Process Stability / Crashes** | `0 Crashes` | **0 Crashes** (3 consecutive runs) | **PASS** |
| **Backend Regression Suite** | `100% Pass` | **332 / 332 PASS** (0 failures) | **PASS** |
| **500 VU Full-Flow p95 Latency** | `<= 2,000 ms` | `4,009 ms` (Local Disk Write Limit) | **BLOCKED (Pending Atlas M30 Staging)** |

---

## 5. STAGING VALIDATION EXECUTION PLAN (UPON PROVISIONING)

When the staging Render service and Atlas M30 cluster are online:
1. Seed synthetic staging dataset (`seedLoadTestData.js` with `LOADTEST_ORG`).
2. Execute baseline latency benchmarks (1 VU, 10 VUs, 50 VUs, 100 VUs, 250 VUs).
3. Execute **HT02R3-500-001, HT02R3-500-002, HT02R3-500-003** against staging HTTPS endpoint.
4. Capture Render metrics (CPU, RAM, RTT) and Atlas metrics (IOPS, disk latency, write queue).
5. If all three runs achieve `p95 <= 2,000 ms`, HT-02 status transitions to **PASS**.
