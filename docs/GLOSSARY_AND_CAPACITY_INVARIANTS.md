# ZAMORIN CAFÉ ERP — GLOSSARY & CAPACITY INVARIANTS

> **Standard**: Canonical Definitions & Absolute Capacity Invariants  
> **Confidence Status**: **CANONICAL_SPECIFICATION**  

---

## 1. Glossary of Terms

- **`VERIFIED_LOCAL`**: Empirically measured in local benchmark harness on workstation hardware.
- **`VERIFIED_SINGLE_INSTANCE`**: Validated under standalone single-node test executions.
- **`VERIFIED_CLUSTER_TEST`**: Verified in simulated multi-instance clustered test harness.
- **`ARCHITECTURAL_TARGET`**: Engineered topology envelope verified via sizing arithmetic and backpressure modeling.
- **`PRODUCTION_VALIDATION_PENDING`**: Awaiting staging deployment on production-sized cloud cluster.
- **Write Coalescing**: Aggregating rapid transient updates (e.g. device pings) in memory/Redis and flushing to disk only periodically or on state change.
- **Heartbeat Jitter**: Introducing a uniform random offset (±20%) to periodic intervals to prevent arrival synchronization storms.
- **Passbook Balance Invariant**: The sum of all individual credits minus debits must exactly equal the account balance ($Variance = 0.00$).
- **Revenue Share Invariant**: $\text{Gross Revenue} = \text{Platform Share} + \text{Franchisee Share}$ with exact 0.00 variance.

---

## 2. Universal Capacity Invariants

1. **`ACCIDENTAL_SCALE_LIMIT = 0`**: No artificial hardcoded query limits or collection sizes in codebase.
2. **`FINANCIAL_VARIANCE = 0.00`**: Zero rounding loss or duplicate postings in any batch or soak test.
3. **`CROSS_CAFE_LEAK = 0`**: Zero data exposure between distinct café outlets.
4. **`KDF_EVENT_LOOP_STARVATION = 0`**: Password hashing bounded by worker pool, keeping HTTP threads responsive.
