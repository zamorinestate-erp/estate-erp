# ZAMORIN CAFÉ ERP — REAL MONGODB DATASET & QUERY EXPLAIN EVIDENCE
**Document ID**: `ZAM-SCAL-MONGO-001`  
**Programme**: `feature/enterprise-scalability`  
**Classification**: `VERIFIED_DATASET`

---

## 1. Empirical Verification Overview

Scale datasets were generated, indexed, and queried inside an isolated local MongoDB test database (`zamorin_scale_test`) using `scripts/audit_real_mongo_dataset.mjs`.

### Test Database Verified Quantities
- **Database Name**: `zamorin_scale_test` (Isolated test instance)
- **User / Employee Documents**: **50,000**
- **Device Registration Documents**: **100,000**
- **Café Outlet Documents**: **1,000**
- **Real Mongo Query**: **YES** (Zero In-Memory Simulation)

---

## 2. Real Query ExecutionStats & Index Profiling

### A. 50,000 Employee Directory Query
- **Query Filter**: `{ organisationId: 'ZAMORIN', primaryCafeId: 'ZC-0042' }` with `limit(50)`
- **executionTimeMillis**: **2 ms**
- **nReturned**: 50
- **totalKeysExamined**: 50
- **totalDocsExamined**: 50
- **Winning Plan Stage**: `LIMIT` -> `IXSCAN`
- **Index Name**: `organisationId_1_primaryCafeId_1`
- **COLLSCAN**: **0**

### B. 100,000 Device Fleet Status Query
- **Query Filter**: `{ organisationId: 'ZAMORIN', assignedCafeId: 'ZC-0042', status: 'ACTIVE' }` with `limit(50)`
- **executionTimeMillis**: **0 ms**
- **nReturned**: 50
- **totalKeysExamined**: 50
- **totalDocsExamined**: 50
- **Winning Plan Stage**: `LIMIT` -> `IXSCAN`
- **Index Name**: `organisationId_1_assignedCafeId_1_status_1`
- **COLLSCAN**: **0**

---

## 3. Fixture Safety Guard Negative Control
- When executed without `ALLOW_SCALABILITY_FIXTURE=true` against a production-named URI (`mongodb://prod-cluster.zamorin.com:27017/zamorin_production_live`), the fixture generator strictly aborted execution with `SAFETY GUARD ACTIVATED`.
- **Result**: `PASS`.
