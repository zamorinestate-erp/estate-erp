# ZAMORIN CAFÉ ERP — OBSERVABILITY & SATURATION TELEMETRY

> **Standard**: Realtime Metrics, Health Probes & Saturation Alert Thresholds  
> **Confidence Status**: **VERIFIED_LOCAL & ARCHITECTURAL_TARGET**  

---

## 1. Health & Telemetry Endpoints

- **`GET /api/v1/health`**: Lightweight liveness check.
- **`GET /api/v1/readiness`**: Database readiness probe reporting connection state (`readyState: 1`) and pool status (`maxPoolSize: 100, minPoolSize: 10`).

---

## 2. Saturation Telemetry & Alerting Thresholds

| Metric | Normal Range | Warning Threshold | Critical Alert Threshold | Recommended Action |
|---|---|---|---|---|
| **MongoDB Pool Utilization** | 10–40% | > 75% | > 90% | Scale API replica count or tune maxPoolSize |
| **Auth KDF Queue Depth** | 0–10 | > 50 | > 200 | Add API instances to expand worker threads |
| **Event Loop Lag** | < 10ms | > 30ms | > 80ms | Identify blocking CPU calls, scale out nodes |
| **Heap Memory Utilization** | 200–500MB | > 1,000MB | > 1,400MB | Check for uncoalesced buffers or node restart |
| **Presence Coalescing Ratio** | 80–98% | < 60% | < 40% | Verify checkpointWindowMs & cache health |
| **Redis Broker Latency** | < 2ms | > 10ms | > 50ms | Scale Redis cluster or check network partitions |
