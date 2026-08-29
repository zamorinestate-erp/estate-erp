# ZAMORIN CAFÉ ERP — DISASTER RECOVERY & CLUSTER FAILOVER

> **Resilience Profile**: Partition Tolerance, Redis Outage Degradation & Mongo Multi-AZ Replica Failover  
> **Confidence Status**: **ARCHITECTURAL_TARGET & VERIFIED_CLUSTER_TEST**  

---

## 1. Failure Scenarios & Failover Matrix

### Scenario A: Redis Cache / Broker Outage
- **Impact**: Cross-instance pub/sub disabled; distributed rate limit keys unavailable.
- **Automated Failover Response**:
  - `DistributedRateLimiter` automatically flips state to `degraded_local`.
  - Rate limiting continues per-node in local process memory.
  - `DevicePresenceService` continues tracking presence locally and checkpoints to MongoDB.
  - System logs warning and alerts monitoring. Zero downtime for active cashiers or POS terminals.

### Scenario B: MongoDB Primary Node Failover
- **Impact**: Primary election in progress (~2–5 seconds).
- **Automated Failover Response**:
  - Mongoose automatic reconnect and driver retryable writes (`retryWrites=true`) buffer and retry in-flight writes.
  - Secondary replicas continue serving read-only requests.
  - Once new primary is elected, write stream resumes seamlessly.

### Scenario C: Mass Reconnect Storm (e.g. Regional Network Restored)
- **Impact**: 50,000 devices reconnect simultaneously.
- **Mitigation**:
  - Dynamic ±20% jitter prevents immediate synchronization.
  - Token-based reconnection bypasses password KDF.
  - Ephemeral presence cache absorbs reconnection wave without disk write spike.
