# ZAMORIN CAFE ERP — PRODUCTION OPERATIONS RUNBOOK

**DOCUMENT CLASSIFICATION**: PRODUCTION OPERATIONAL RUNBOOK & SYSTEM ADMINISTRATION GUIDE  
**SYSTEM VERSION**: `v1.2.0-ht20-release-candidate`  
**REVISION**: 2026-08-15  

---

## 1. System Architecture & Topology

- **Frontend**: Vercel Cloud Static Single-Page Application & Progressive Web App (`/frontend`).
- **Backend**: Render Web Service running Node.js / Express production container (`/backend`, `render.yaml`).
- **Database**: MongoDB Atlas 3-node Replica Set in AWS Mumbai (`ap-south-1`).
- **DNS Configuration**: IPv4-first DNS order with Google DNS fallback (`8.8.8.8, 1.1.1.1`).
- **Connection Pool**: Mongoose `minPoolSize: 20`, `maxPoolSize: 100`.

---

## 2. Health, Readiness & Observability

### 2.1 Standard Health Endpoints
- **Liveness Probe**: `GET /api/v1/health` -> Returns `200 OK` (`status: "HEALTHY"`).
- **Readiness Probe**: `GET /api/v1/readiness` -> Returns `200 OK` (checks live MongoDB ping, connection pool status).

### 2.2 Alerting Thresholds
| Metric | Warning Threshold | Critical Incident Threshold | Immediate Response Action |
| :--- | :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | > 0.1% over 5m | > 0.5% over 2m | Inspect application error logs via correlation IDs |
| **API Latency (p95)** | > 1000ms | > 2000ms | Check Atlas connection pool & database CPU |
| **Render Container CPU** | > 70% | > 85% | Check for unindexed queries or runaway loops |
| **Render Container Memory** | > 75% | > 90% | Trigger graceful container restart |
| **MongoDB Atlas Connections** | > 70 sockets | > 90 sockets | Audit socket leak or connection spike |
| **Primary Master Attacks** | >= 1 incident | >= 1 incident | Immediate security team review of attacking user |

---

## 3. Production Backup & Disaster Recovery Procedures

### 3.1 Backup Policy
- **Automated Snapshots**: MongoDB Atlas continuous cloud snapshots with point-in-time restore within a 7-day retention window.
- **Pre-Migration Backups**: Mandatory manual snapshot taken before any batch employee, catalog, or financial opening import.

### 3.2 Point-in-Time Restore Runbook
1. Access MongoDB Atlas Console -> Clusters -> `zamorin-cluster` -> Backup.
2. Select "Restore" -> Choose Point-in-Time Restore (exact UTC timestamp).
3. Target: Restore to existing cluster or dedicated staging instance.
4. Execute `node hard-testing/scripts/run_ht15_disaster_recovery_simulation.js` logic to verify post-restore checksum parity.
5. Re-run `node hard-testing/scripts/run_production_smoke_test.js` to certify operational integrity.

---

## 4. Security Administration & Incident Management

### 4.1 Primary Master Neutralization Defense
- If a secondary Master initiates an unauthorized governance action against Primary Master `MU-0001`:
  1. The attacker's account is automatically set to `SUSPENDED`.
  2. All attacker active sessions are revoked instantly.
  3. A `CRITICAL` audit record `PRIMARY_MASTER_ATTACK_BLOCKED_AND_ACTOR_SUSPENDED` is recorded with actor ID, target ID, and timestamp.
  4. Only the Primary Master (`MU-0001`) can reactivate or restore the suspended account.

### 4.2 Correlation ID Tracing
All HTTP requests generate or accept an `X-Correlation-ID` header. When tracing an error:
```bash
# Search logs for specific correlation ID without exposing sensitive user tokens
grep "CORRELATION_ID_HERE" backend.log
```

---

## 5. Rollback Protocols

### 5.1 Frontend Rollback (Vercel)
- Navigate to Vercel Project Dashboard -> Deployments.
- Locate the previous certified deployment commit hash (`2185069`).
- Click "Instant Rollback" -> Production traffic is redirected within 5 seconds.

### 5.2 Backend Rollback (Render)
- In Render Dashboard -> `zamorin-cafe-erp-backend` -> Deploys.
- Select previous known good deployment commit -> Click "Rollback".
