# ZAMORIN CAFÉ ERP — PRODUCTION CLUSTER VALIDATION REGISTER
**Document ID**: `ZAM-SCAL-REG-001`  
**Programme**: `feature/enterprise-scalability`  
**Status**: `PENDING CLOUD CLUSTER DEPLOYMENT (NON-BLOCKING FOR LOCAL MERGE)`

---

## 1. Register Overview

This register formally distinguishes between **Locally Verified Architecture/Integration** and **Production Cluster Hardware Validation Gates**. The presence of pending cluster validation gates does not block local codebase merge, but defines mandatory staging/UAT verification before production go-live.

---

## 2. Production Validation Gates

| Item ID | Scope & Validation Description | Architecture Target | Current Local Verification | Production Cluster Validation Requirement | Status |
|---|---|---|---|---|---|
| **SC-PROD-001** | **50,000 Real Concurrent Live Devices** | 50,000+ simultaneous physical devices | Local socket ramp (232 sockets, 1,731 hb/s) | Multi-node cluster behind AWS ALB / NGINX with 50,000 real persistent TCP/TLS connections | `PENDING_CLUSTER_TEST` |
| **SC-PROD-002** | **10,000 Concurrent Interactive Users** | 10,000+ simultaneous interactive web sessions | Stateless JWT token verification (1ms) & bounded worker queue | Multi-node cluster with distributed load generator dispatching 10k concurrent virtual users | `PENDING_CLUSTER_TEST` |
| **SC-PROD-003** | **Real Redis Deployed Integration** | Managed Redis Cluster / ElastiCache | Local multi-process IPC/Shared adapter & Redis Adapter contracts | AWS ElastiCache / Redis Cluster multi-node deployment with real Redis protocol verification | `PENDING_DEPLOYMENT` |
| **SC-PROD-004** | **Representative Mongo Atlas Tier / Pool Validation** | MongoDB Atlas M30/M40 Cluster | 50k Employee, 100k Device local MongoDB dataset (`zamorin_scale_test`) | Atlas connection pool sizing & query execution under real network latency ($\ge 10\text{ ms}$) | `PENDING_DEPLOYMENT` |
| **SC-PROD-005** | **Load Balancer / Proxy SSE & HTTP/2 Validation** | NGINX / Cloudflare / AWS ALB | Direct Express HTTP/1.1 Keep-Alive & SSE stream | Long-lived stream connection timeouts, keep-alive headers, and multiplexed HTTP/2 streams | `PENDING_DEPLOYMENT` |
| **SC-PROD-006** | **Multi-Member Mongo Failover & Change Stream Resume** | High-Availability 3-Node Replica Set | Single-member standalone / isolated test DB with durable MongoDB checkpoints | Primary node stepdown/failover with change stream `resumeAfter` recovery under active writes | `PENDING_CLUSTER_TEST` |
| **SC-PROD-007** | **Large-Scale Real HTTP + Mongo Distributed Soak** | 1,000,000+ end-to-end network requests | 1,000,000 business-logic operations with ₹0.00 modeled financial variance | Multi-day sustained 1M HTTP + persistent MongoDB write soak under production-like traffic | `PENDING_CLUSTER_TEST` |
| **SC-PROD-008** | **Production Object-Storage Scale Validation** | Cloudinary / AWS S3 Standard | Local filesystem fallback + Cloudinary client integration contracts | High-concurrency document and receipt attachment uploads/downloads to S3/Cloudinary | `PENDING_DEPLOYMENT` |

---

## 3. Product Capacity Guarantees vs Validation Classification

| Dimension | Architecture Target | Local Empirical Proof | Cluster Verification Classification |
|---|---|---|---|
| **Employees** | 50,000+ | 50,000 real Mongo docs (2ms p50, IXSCAN) | `VERIFIED_DATASET` |
| **Registered Devices** | 100,000+ | 100,000 real Mongo docs (0ms p50, IXSCAN) | `VERIFIED_DATASET` |
| **Connected Devices** | 50,000+ | 232 real local connections + 50k heartbeat simulation | `ARCHITECTURE_READY_CLUSTER_VALIDATION_PENDING` |
| **Café Outlets** | 1,000+ | 1,000 real Mongo docs (0 cross-tenant leaks) | `VERIFIED_DATASET` |
| **Interactive Users** | 10,000+ | Stateless horizontal token verification | `ARCHITECTURE_READY_CLUSTER_VALIDATION_PENDING` |
| **Soak Operations** | 1,000,000+ | 1,000,000 logic operations (₹0.00 variance) | `VERIFIED_LOGIC_SOAK` |
