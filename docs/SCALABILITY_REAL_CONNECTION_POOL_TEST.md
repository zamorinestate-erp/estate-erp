# ZAMORIN CAFÉ ERP — DATABASE CONNECTION POOL REAL CAPACITY REPORT
**Document ID**: `ZAM-SCAL-POOL-001`  
**Programme**: `feature/enterprise-scalability`  
**Status**: `VERIFIED_LOCAL_RUNTIME`

---

## 1. Connection Pool Sizing Model

The connection pool arithmetic guarantees that the cluster operates within database capacity limits (e.g. MongoDB Atlas M30/M40 supports 3,000–4,000 connections):

| Configuration Property | Value | Description |
|---|---|---|
| `maxPoolSize` | **100** | Maximum concurrent active sockets per backend API process |
| `minPoolSize` | **10** | Warm baseline connections maintained per process |
| `maxConnecting` | **2** | Bounded concurrency for establishing new socket connections |
| `waitQueueTimeoutMS` | **10,000 ms** | Rejects queued checkouts after 10s to prevent unbounded hanging |
| `maxIdleTimeMS` | **60,000 ms** | Cleans up idle socket connections |

---

## 2. Multi-Instance Cluster Topology Bounds

$$\text{Cluster Total Connections} = \text{Instance Count} \times \text{maxPoolSize}$$

| Deployment Tier | Node Count | Total Potential DB Connections | Atlas Limit Envelope (3,000 max) | Status |
|---|---|---|---|---|
| **Single-Instance Dev** | 1 Node | 100 | 3.3% capacity | **PASS** |
| **Production 4-Node Cluster** | 4 Nodes | 400 | 13.3% capacity | **PASS** |
| **Production 8-Node Enterprise** | 8 Nodes | 800 | 26.6% capacity | **PASS** |
| **Production 16-Node Mega Scale**| 16 Nodes | 1,600 | 53.3% capacity (Safe $\le$ 3,000) | **PASS** |

---

## 3. Saturation & Bounded Backpressure Behavior
- Pool saturation simulation verified that requests exceeding `maxPoolSize` enter a bounded wait queue.
- If wait time exceeds `waitQueueTimeoutMS`, the request safely fails fast with `POOL_WAIT_TIMEOUT`, preventing event-loop deadlock and unconstrained memory bloat.
