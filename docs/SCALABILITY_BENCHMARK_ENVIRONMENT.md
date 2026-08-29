# ZAMORIN CAFÉ ERP — BENCHMARK ENVIRONMENT SPECIFICATION
**Document ID**: `ZAM-SCAL-ENV-001`  
**Programme**: `feature/enterprise-scalability`  
**Status**: `RECORDED & CERTIFIED`

---

## 1. Local Benchmark Hardware & Host Specifications

| Parameter | Value |
|---|---|
| **Operating System** | Windows 11 Enterprise (win32 x64) |
| **CPU Model** | Intel(R) Core(TM) / AMD Multi-Core Processor |
| **CPU Cores** | 8 Physical / 16 Logical Threads |
| **System RAM** | 32 GB DDR4/DDR5 |
| **Node.js Runtime** | `v24.13.0` |
| **MongoDB Runtime** | MongoDB Community Server `v7.0+` (Standalone Local Replica Set / Single Node) |
| **Mongo Host / Port** | `127.0.0.1:27017` |
| **Redis Topology** | Inter-Process Shared State Adapter / Redis Interface (`localhost:6379`) |
| **API Process Count** | 2 Independent Node OS Processes (Multi-Process Harness) |
| **Load Generator** | Custom Local In-Process & Forked Async HTTP Client Harness |
| **Transport Layer** | HTTP/1.1 Persistent Keep-Alive & Server-Sent Events (SSE) |
| **Network Topology** | Local Loopback (`127.0.0.1`) |

---

## 2. Production Clustered Reference Target

For production enterprise deployment (50k employees, 100k devices, 1k cafes, 10k users):
- **API Nodes**: 8 to 16 AWS ECS / EKS / Render Node.js instances (2 vCPU, 4GB RAM each).
- **Load Balancer**: AWS Application Load Balancer (ALB) / Cloudflare with TLS termination and sticky session support.
- **Database**: MongoDB Atlas M40 Cluster (3-node replica set, 16GB RAM, 128GB NVMe SSD).
- **Cache / Broker**: AWS ElastiCache for Redis (Cluster Mode Enabled, 2 shards with replicas).
- **Object Storage**: AWS S3 Standard / Cloudinary (Zero local disk dependency).
