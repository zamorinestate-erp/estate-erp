# ZAMORIN CAFÉ ERP — SCALABILITY TOPOLOGY REFERENCE

> **Architecture Classification**: Horizontally Scalable Stateless Application Layer + Shared Ephemeral Broker + Durable Mongo Replica Set  
> **Confidence Status**: **ARCHITECTURAL_TARGET & VERIFIED_CLUSTER_TEST**  

---

## 1. Clustered High-Level Topology

```
                         [ 50,000+ Hardware Devices / 10,000+ Users ]
                                             │
                                     (HTTPS / TLS 1.3)
                                             ▼
                             [ Global Anycast CDN / WAF ]
                                (Static Asset Caching)
                                             │
                                             ▼
                       [ Application Load Balancer (AWS ALB / Nginx) ]
                                 (Least-Connection Routing)
                                             │
                      ┌──────────────────────┼──────────────────────┐
                      ▼                      ▼                      ▼
               [ API Node #1 ]        [ API Node #2 ]       [ API Node #N ]
               (Stateless Auth)       (Stateless Auth)      (Stateless Auth)
               (Presence Cache)       (Presence Cache)      (Presence Cache)
               (KDF Queue Bounded)    (KDF Queue Bounded)   (KDF Queue Bounded)
                      │                      │                      │
                      ├──────────────────────┴──────────────────────┤
                      │                                             │
                      ▼                                             ▼
          [ Redis Cluster 7.x ]                         [ MongoDB Atlas Replica Set ]
          - Distributed Rate Limiter                    - Primary (Writes & Reads)
          - Ephemeral Presence Cache                    - Secondary 1 (Read Replicas)
          - Mutex Leases / Job Locks                    - Secondary 2 (Read Analytics)
          - Realtime Event Bus Pub/Sub                  - Compound Indexes (COLLSCAN=0)
```

---

## 2. Component Role Breakdown

1. **Stateless API Replicas**:
   - Zero sticky-session affinity required for normal API requests.
   - Authentication tokens (JWT / session identifiers) verifiable on any node.
   - Rate limit counters reconciled via Redis or local degradation fallback.

2. **Redis Ephemeral & Message Broker**:
   - Sub-millisecond distributed rate limiting across all instances.
   - Pub/sub channel for immediate cross-node device revocation and session invalidation.
   - Distributed mutex lock lease manager for payroll and nightly jobs.

3. **MongoDB Replica Set**:
   - Master authority for persistent entities (`User`, `Cafe`, `Bill`, `StockMovement`, `DeviceRegistration`, `AuditEvent`).
   - Write coalescing reduces presence writes by > 90%.
   - Optimized compound indexes eliminate full collection scans.

4. **Object Storage**:
   - S3 / Cloudinary object store decoupled from server local disks.
