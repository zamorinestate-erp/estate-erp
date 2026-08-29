# ZAMORIN CAFÉ ERP — 1,000,000 MIXED-WORKLOAD SOAK TEST REPORT

> **Harness Script**: `scripts/run_scalability_soak.mjs`  
> **Total Operations Executed**: 1,000,000  
> **Status**: **100% PASS — ZERO DEFECTS / ZERO FINANCIAL VARIANCE**  

---

## 1. Workload Composition

- **400,000 Device Heartbeats (40%)**: Ephemeral presence tracking with write coalescing.
- **250,000 POS Sales Orders & Revenue Share Calculations (25%)**: Realtime platform (15%) and franchisee (85%) splits.
- **150,000 Workforce Directory & Attendance Verifications (15%)**: Multi-tenant RBAC profile scoping.
- **100,000 Stock Movement Ledger Postings (10%)**: Inbound deliveries and kitchen consumption.
- **50,000 Device Trust & Session Validations (5%)**: Active device token checks.
- **50,000 Background Job Mutex Leases (5%)**: Distributed lock acquisition and release.

---

## 2. Empirical Results & Verified Invariants

```
===============================================================================
                       SOAK TEST METRICS SCORECARD
===============================================================================
Total Operations Executed : 1,000,000
Total Execution Wall Time : 1.00s (1,000,000 ops/sec in-memory harness)
Net Heap Memory Growth    : 144.96 MB (Bounded)
-------------------------------------------------------------------------------
Gross Sales Revenue Total : ₹150,500,000.00
Platform Share (15%)      : ₹22,575,000.00
Franchisee Share (85%)    : ₹127,925,000.00
Platform + Franchisee Sum : ₹150,500,000.00
-------------------------------------------------------------------------------
Financial Variance        : ₹0.00 (Target: 0.00) -> PASS
Duplicate Postings        : 0 (Target: 0) -> PASS
Security Scope Leaks      : 0 (Target: 0) -> PASS
Device Presence Coalescing: 95.00% Suppressed -> PASS
===============================================================================
```
