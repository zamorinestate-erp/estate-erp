# ZAMORIN CAFÉ ERP — SCALABILITY TEST SUITE SPECIFICATION (SC-01 TO SC-20)

> **Test Suite**: `scripts/run_scalability_stress.mjs`  
> **Total Test Cases**: 20 Discrete Capacity & Invariant Assertions  
> **Status**: **20 / 20 PASS (100.0%)**  

---

## 1. Test Specifications Matrix

| Test ID | Test Name | Assertion Criteria | Result |
|---|---|---|:---:|
| **SC-01** | 50,000-Employee Bounded Pagination | 50-row chunk returned in < 100ms with zero full scans | **PASS** |
| **SC-02** | 100,000-Device Status Aggregation | Fleet status breakdown of 100k records executed in < 100ms | **PASS** |
| **SC-03** | 50,000 Heartbeat Burst & Coalescing | 50,000 heartbeats processed; write coalescing ratio > 50% on initial cycles, > 90% steady | **PASS** |
| **SC-04** | 1,000-Café Multi-Tenant Isolation | 1,000 cross-café permission checks produce exactly 0 leaks | **PASS** |
| **SC-05** | 10,000 Concurrent User Stateless Auth | 10,000 token validations execute with zero process affinity | **PASS** |
| **SC-06** | Auth KDF Concurrency Backpressure | Saturated KDF queue rejects overflow with HTTP 429 backpressure | **PASS** |
| **SC-07** | Distributed Multi-Dimensional Rate Limiter | 5 failed attempts locks target scope without locking sibling scopes | **PASS** |
| **SC-08** | Cross-Instance Revocation Broadcast | Device revocation event received by cluster node in < 50ms | **PASS** |
| **SC-09** | Distributed Mutex Lease & Collision Prevention | Exactly one worker acquires mutex lock; duplicate attempts denied | **PASS** |
| **SC-10** | Asynchronous Export Queue & Progress | Large export processes in background with observable status | **PASS** |
| **SC-11** | Database Connection Pool Saturation | Max pool size enforced at 100 connections/node with wait timeout | **PASS** |
| **SC-12** | Database Compound Index Alignment | Compound indexes verified across all critical high-throughput collections | **PASS** |
| **SC-13** | Idempotent High-Value Transactions | Double-submitted transaction executes exactly once; 0 duplicate records | **PASS** |
| **SC-14** | 1,000-Café Portfolio KPI Rollup | Cross-café revenue & order rollup completes in < 50ms | **PASS** |
| **SC-15** | Stock Movement Ledger Decimal Integrity | 10,000 stock postings preserve exact integer/decimal ledger balance | **PASS** |
| **SC-16** | Rapid Device Lifecycle Transitions | Rapid ACTIVE -> LOST -> RETIRED -> REVOKED transitions captured cleanly | **PASS** |
| **SC-17** | Pluggable Object Storage Multi-Instance | Storage adapter uploads and returns URL with zero shared-disk lock | **PASS** |
| **SC-18** | Graceful Process Draining | SIGTERM/SIGINT triggers connection draining and clean DB close | **PASS** |
| **SC-19** | 1,000-Outlet Frontend Search Filter | Typeahead filter over 1,000 outlets executes in < 5ms | **PASS** |
| **SC-20** | End-to-End Cluster Capacity Invariants | 50k staff / 100k devices / 1k cafes verified under capacity model | **PASS** |
