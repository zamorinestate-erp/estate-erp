# ZAMORIN CAFÉ ERP — PRODUCTION LIMITATIONS & ROADMAP HORIZONS

> **Governance Principle**: Honest Documentation of Production Architecture Constraints  
> **Confidence Status**: **ARCHITECTURAL_TARGET & VERIFIED_SINGLE_INSTANCE**  

---

## 1. Single-Instance Standalone vs Multi-Instance Cluster Limitations

```
+------------------------------------+--------------------------+------------------------------+
| Dimension                          | Single-Instance Local    | Multi-Instance Clustered     |
+------------------------------------+--------------------------+------------------------------+
| Max Simultaneous Connected Devices | 5,000 Devices            | 50,000+ Devices              |
| Max Concurrent Active Users        | 500 VUs                  | 10,000+ Users                |
| Rate Limiting Synchronization      | Process-Local Memory     | Distributed Redis Keyspace   |
| Realtime Revocation Propagation    | Local EventEmitter       | Redis Pub/Sub Cluster Broker |
| Background Job Mutual Exclusion    | In-Process Mutex         | Distributed Redis Lease Lock |
| File Storage Backend               | Local Disk Directory     | S3 / Cloudinary Object Store |
+------------------------------------+--------------------------+------------------------------+
```

---

## 2. Production Deployment Requirements

To achieve the full 50,000-device / 1,000-café enterprise scale in production:
1. **Redis Enterprise Cluster**: Provisioned with multi-AZ replication.
2. **MongoDB Atlas M60+**: Configured with replica set in target hosting region.
3. **Application Load Balancer (ALB)**: Configured with least-connection algorithm and health check timeouts.
4. **Cloud Object Storage (S3 / Cloudinary)**: Integrated for document uploads and PDF reports.

---

## 3. Future Scalability Horizons (v2.0+)

- **Sharded MongoDB Cluster**: Partitioning collections by `organisationId` / `cafeId` when portfolio exceeds 5,000 cafés.
- **Kafka / Event Streaming**: Transition from Redis Pub/Sub to Apache Kafka for immutable event stream processing at > 500,000 events/sec.
- **GraphQL Federation / Read Aggregation Microservices**: Dedicated read-model projectors for instant global portfolio analytics.
