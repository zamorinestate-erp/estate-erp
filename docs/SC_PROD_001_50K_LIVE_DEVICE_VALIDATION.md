# ZAMORIN CAFÉ ERP
## SC-PROD-001: 50,000 REAL LIVE DEVICE CONNECTION VALIDATION SPECIFICATION

**Programme**: Enterprise Cluster Capacity Validation  
**Gate**: `SC-PROD-001`  
**Target Metric**: `50,000+ Simultaneous Physical Connected Devices`  
**Local Test Harness Ceiling**: `232 sockets` (Loopback OS limit)  
**Cluster Status**: `BLOCKED_INFRASTRUCTURE_ACCESS` (Pending Authorized Cloud Infrastructure Provisioning)  

---

### Target Architecture & Infrastructure Plan

To achieve truthful certification of 50,000 genuine network device connections, the following staging cluster is specified in `infra/scale-validation/main.tf`:

1. **Application Load Balancer (ALB)**:
   - AWS Application Load Balancer with unbuffered SSE streaming and `idle_timeout = 120`
   - Configured cross-zone routing and HTTP/2 frontend protocol
2. **Application Cluster Replicas**:
   - 4 to 16 container instances (ECS / Fargate or EC2 `c6i.xlarge`)
   - Node.js API processes running `backend/src/server.js`
3. **Shared Production Redis**:
   - AWS ElastiCache for Redis (2-node replication group, `cache.m6g.large`)
   - Dedicated Pub/Sub connection per process, sliding window rate limiter Lua script
4. **MongoDB Replica Set**:
   - MongoDB Atlas M30/M40 3-node replica set with wiredTiger engine
5. **Distributed Load Generators**:
   - 5 independent generator instances (`c6i.2xlarge`, 8 vCPU, 16 GB RAM)
   - 10,000 connections per generator node to prevent socket/CPU exhaustion

---

### Verification Execution Protocol

- **Connection Ramp**: Progressive ramp through checkpoints: 1,000 -> 5,000 -> 10,000 -> 25,000 -> 40,000 -> 50,000
- **Steady-State Plateau**: Minimum **30 minutes** sustained hold at 50,000 active SSE streams
- **Heartbeat Workload**: Jittered 20–30s interval producing ~1,667 events/sec with >= 95% write coalescing
- **Resilience Chaos Tests**:
  - Reconnect storm: 5,000 devices reconnecting within 60s
  - Instance termination: Kill 1 of 4 API instances under 50K load
  - Realtime revocation: Broadcast device revocation via Redis and verify disconnect within $p95 \le 2\text{s}$
- **Acceptance Criteria**: $\ge 99.5\%$ connection retention, $5\text{xx} < 0.1\%$, 0 cross-cafe / cross-device leaks
