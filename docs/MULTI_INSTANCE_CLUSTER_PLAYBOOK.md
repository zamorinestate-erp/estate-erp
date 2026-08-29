# ZAMORIN CAFÉ ERP — MULTI-INSTANCE CLUSTER PLAYBOOK

> **Operations Runbook**: Zero-Downtime Deployment, Rolling Updates & Cluster Lifecycle  
> **Confidence Status**: **ARCHITECTURAL_TARGET & VERIFIED_CLUSTER_TEST**  

---

## 1. Zero-Downtime Rolling Deployment Workflow

```
[ Step 1: Health Check Pre-Flight ]
      │  Query /api/v1/health & /api/v1/readiness across active cluster
      ▼
[ Step 2: Traffic Draining on Target Node ]
      │  Deregister Target Node from ALB / Load Balancer Target Group
      │  Wait 15 seconds for in-flight HTTP connections to drain
      ▼
[ Step 3: Container / Process Replacement ]
      │  Send SIGTERM to process (triggers registerShutdownHandlers)
      │  HTTP server stops accepting new connections
      │  Database connection and Redis broker closed gracefully
      ▼
[ Step 4: Start New Version Container ]
      │  Launch new container with validated environment variables
      │  Node.js initializes, establishes Mongo & Redis connections
      ▼
[ Step 5: Readiness Probe Verification ]
      │  Poll /api/v1/readiness until HTTP 200 returned
      ▼
[ Step 6: Re-register with Load Balancer ]
      │  ALB adds instance to healthy target group
      ▼
[ Step 7: Repeat for Next Node in Cluster ]
```

---

## 2. Health & Readiness Endpoints

- **Liveness Probe**: `GET /api/v1/health`
  - Returns `status: 'ok'` and timestamp. Fast, lightweight.
- **Readiness Probe**: `GET /api/v1/readiness`
  - Verifies database connectivity (`readyState === 1`), connection pool health, and Redis broker state.
  - Returns `HTTP 503 Service Unavailable` if database is disconnected, preventing traffic routing to unready nodes.

---

## 3. Graceful Shutdown Implementation (`src/server.js`)

```javascript
function registerShutdownHandlers(server) {
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    // 1. Stop receiving new HTTP requests
    await closeHttpServer(server);
    // 2. Disconnect database pool
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```
