# ZAMORIN CAFÉ ERP — CAPACITY & HARDWARE PLANNING GUIDE

> **Target Tier**: Enterprise Multi-Outlet Deployment (1,000 Cafés / 50,000 Employees / 100,000 Devices)  
> **Confidence Status**: **ARCHITECTURAL_TARGET & VERIFIED_CLUSTER_TEST**  

---

## 1. Workload Sizing Envelope

```
+------------------------------------+--------------------------+------------------------------+
| Dimension                          | Enterprise Scale Target  | Sizing Basis                 |
+------------------------------------+--------------------------+------------------------------+
| Registered Employees               | 50,000                   | 50 staff per café average    |
| Registered Device Records          | 100,000                  | 100 devices per café fleet   |
| Active Simultaneously Connected    | 50,000 devices           | 50 active POS/KDS per café   |
| Peak Heartbeat Arrival Rate        | ~1,667 heartbeats/sec    | 30s base interval with jitter|
| Daily Orders / Transactions        | 500,000 orders/day       | 500 orders/café/day          |
| Peak POS Order Rate                | 120 orders/sec           | 12:00 - 14:00 Lunch Rush     |
| Peak Shift-Start Attendance Storm  | 5,000 check-ins / minute | 08:30 - 09:00 IST Morning    |
+------------------------------------+--------------------------+------------------------------+
```

---

## 2. Infrastructure Sizing by Tier

### Tier 1: Single-Instance Dev / Pilot (1–10 Cafés)
- **API Server**: 1x Node.js instance (2 vCPU, 4GB RAM)
- **Database**: MongoDB M10 / Shared (2 vCPU, 2GB RAM, 100 max connections)
- **Object Storage**: Local / S3 Free Tier
- **Redis Cache**: None / Optional In-memory

### Tier 2: Mid-Enterprise Cluster (100–300 Cafés)
- **API Cluster**: 4x Node.js instances (4 vCPU, 8GB RAM each)
- **Load Balancer**: Nginx / AWS ALB / Cloudflare (Least Connection Routing)
- **Database**: MongoDB Atlas M30 (4 vCPU, 8GB RAM, 3,000 max connections)
- **Redis Cluster**: Redis 7.x 3-node cluster (4GB RAM) for rate limits & presence
- **Storage**: AWS S3 / Cloudinary Enterprise

### Tier 3: Enterprise Mega-Cluster (1,000+ Cafés / 50,000 Staff / 100,000 Devices)
- **API Cluster**: 16x Node.js instances (8 vCPU, 16GB RAM each) behind ALB
- **Load Balancer**: AWS ALB with sticky session support and TLS 1.3 termination
- **Database**: MongoDB Atlas M60 (16 vCPU, 64GB RAM, 8,000 max connections) Replica Set (Primary + 2 Secondary Replicas in AWS Mumbai `ap-south-1`)
- **Redis Cache**: Redis Enterprise Cluster (16GB RAM, multi-AZ replication)
- **Storage**: Amazon S3 + CloudFront CDN for static assets

---

## 3. Database Connection Pool Arithmetic

```
Total Database Connections = INSTANCE_COUNT × MONGODB_MAX_POOL_SIZE

For 16 API Instances:
16 nodes × 100 maxPoolSize = 1,600 maximum DB connections.

MongoDB Atlas M60 Capacity: 8,000 connections.
Safety Margin: 1,600 / 8,000 = 20.0% utilization at absolute peak saturation.
```

---

## 4. RAM & CPU Envelopes per API Instance

| Component | Average Memory Allocation | Peak Stress Memory Allocation |
|---|---|---|
| Node.js Runtime Base | 45 MB | 65 MB |
| Ephemeral Device Presence Cache | 30 MB (10,000 devices/node) | 80 MB |
| In-Flight Request Buffers | 50 MB | 150 MB |
| Authentication KDF Worker Pool | 128 MB (8 workers @ 16MB) | 256 MB |
| Export Streaming Buffer | 25 MB | 50 MB |
| **Total Instance Heap Usage** | **~278 MB** | **~601 MB (Well below 1.5GB default)** |
