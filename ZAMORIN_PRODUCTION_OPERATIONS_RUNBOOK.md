# ZAMORIN CAFÉ ERP — PRODUCTION OPERATIONS RUNBOOK

**Target Document**: `ZAMORIN_PRODUCTION_OPERATIONS_RUNBOOK.md`  
**System**: Zamorin Café ERP v1.0.0-stage10  
**Target Environment**: Render (Backend + Persistent Disk), Vercel (Frontend), MongoDB Atlas (Database)  
**Classification**: Operational Governance & Incident Prevention  

---

## 1. System Inventory & Infrastructure Overview

| Tier | Provider | Deployment Architecture | Storage / Persistence | Critical Health Probes |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Single Page Application (SPA / Vanilla ES6) | Static CDN edge cache, Client IndexedDB (Offline) | `https://<frontend-domain>/` |
| **Backend** | Render | Node.js (Express LTS), Render Web Service | Ephemeral app container + Attached Persistent Disk | `/health/live`, `/health/ready` |
| **Storage** | Render Disk | Render Persistent Storage (10 GB mounted) | Mounted at `/var/data/zamorin_documents` | `/system/storage` probe, disk space check |
| **Database** | MongoDB Atlas | Managed Cluster (M0 / Dedicated) | Automated Snapshots, Replication Set | Native MongoDB wire protocol / Mongoose ping |

---

## 2. Standard Deployment Procedure

### 2.1 Pre-Deploy Checklist (Zero P0 / P1 Requirement)
1. Verify git branch is clean and status checks pass:
   ```bash
   git status
   npm run test:deploy-readiness
   ```
2. Generate Release Manifest:
   ```bash
   node scripts/generate_release_manifest.mjs
   ```
3. Run Migration Safety Pre-Flight:
   ```bash
   node scripts/migration_safety_checker.mjs
   ```
4. Verify environment variable presence using the startup validator:
   ```bash
   NODE_ENV=production node -e "import('./backend/src/config/startupValidator.js').then(m => console.log(m.validateStartupConfig()))"
   ```

### 2.2 Deployment Execution
1. **Database Migrations**: Deploy backward-compatible schema changes prior to application code.
2. **Backend (Render)**:
   - Push release tag or merge to `main`.
   - Monitor Render deployment logs.
   - Render will test `/health/ready`. Deployment succeeds ONLY when `/health/ready` returns HTTP 200 (`status: "READY"`).
3. **Frontend (Vercel)**:
   - Deploy build artifact to Vercel.
   - Run post-deploy smoke tests.

---

## 3. Liveness and Readiness Monitoring

### 3.1 Endpoints
- **Liveness Probe**: `GET /health/live`
  - *Purpose*: Process alive check.
  - *Response*: `{ "status": "LIVE", "timestamp": "...", "uptime": 1234 }` (HTTP 200).
  - *External Dependency*: None. Never restart process due to temporary external network drop.
- **Readiness Probe**: `GET /health/ready`
  - *Purpose*: Traffic acceptance check.
  - *Checks*: MongoDB connected (`readyState === 1`), Document Storage accessible (`DOCUMENT_STORAGE_ROOT`).
  - *Response*: `{ "status": "READY", "checks": { "database": "CONNECTED", "storage": "OK" } }` (HTTP 200).
  - *Failure*: HTTP 503 if database disconnected or storage missing in production.

---

## 4. Operational Alerting & Escalation Matrix

### 4.1 Severity Levels
- **SEV-1 (Critical)**: Production offline, DB down, persistent disk unavailable, global auth failure, active data corruption. Target Response: `< 15 minutes`.
- **SEV-2 (High)**: Major module failure (POS offline, export queue failing, persistent disk > 85% full), backup failure. Target Response: `< 1 hour`.
- **SEV-3 (Medium)**: Degraded latency, single background task failure, disk > 70% full. Target Response: `< 4 hours`.
- **SEV-4 (Informational)**: Maintenance completed, routine backup verified, deployment manifest logged. Target Response: Next business review.

### 4.2 Deduplication & Auto-Resolution
- Alerting service (`backend/src/services/operationalAlertService.js`) enforces a 5-minute cooldown per alert key to prevent alert storms.
- When an underlying condition clears, the service triggers `autoResolveAlert(category, source)` appending resolution timestamp and audit event.

---

## 5. Persistent Document Storage Runbook

### 5.1 Storage Architecture
- Mounted root: `/var/data/zamorin_documents`
- Staging directory: `os.tmpdir()/zamorin_document_staging`
- Render persistent disk capacity: 10 GB.
- Capacity alerts:
  - **WARNING**: `>= 70%` (Investigate high-volume PDF/bill generators).
  - **HIGH**: `>= 85%` (Prepare disk expansion on Render).
  - **CRITICAL**: `>= 95%` (Activate `KILL_SWITCH_DOCUMENT_UPLOADS`).

### 5.2 Storage Capacity Emergency Procedure (Storage Full)
1. **Immediate Containment**:
   - Master/Owner activates emergency kill switch via `/system/feature-flags`:
     ```json
     { "flagKey": "KILL_SWITCH_DOCUMENT_UPLOADS", "enabled": true, "reason": "Persistent disk > 95% full" }
     ```
2. **Execute Staging Cleanup**:
   - Run temporary staging orphan cleaner:
     ```bash
     node -e "import('./backend/src/services/retentionPolicyService.js').then(m => m.cleanAbandonedStagingFiles(3600000))"
     ```
3. **Run Storage Reconciliation (Non-Destructive)**:
   - Call `POST /system/reconcile` (or run script) to identify orphaned files or missing binaries without deleting data.
4. **Expand Render Disk**:
   - In Render Dashboard -> Disks -> Resize Persistent Disk (e.g., from 10 GB to 20 GB).
   - Once disk capacity drops below 80%, deactivate the kill switch.

---

## 6. Secret Management & Emergency Secret Rotation

### 6.1 Secret Storage Rules
- All production secrets reside in Render / Vercel Environment Variables.
- **ZERO secrets in source control**.
- The `config/PRODUCTION_SECRET_REGISTER.json` stores metadata ONLY (purpose, rotation cycle, owner).

### 6.2 Emergency Secret Rotation (Compromise Procedure)
If a secret (e.g. `JWT_SECRET`, `SESSION_SECRET`, `MONGO_URI`) is suspected compromised:
1. Generate new cryptographically secure secret (minimum 64 characters):
   ```bash
   node -e "console.log(crypto.randomBytes(48).toString('base64'))"
   ```
2. Update secret in Render Environment settings.
3. If rotating `JWT_SECRET`: Existing active JWT sessions will invalidate, requiring users to log in again.
4. If rotating `MONGO_URI`: Create a secondary user in MongoDB Atlas before updating Render to ensure zero connection downtime, then revoke old credentials.
5. Trigger Render backend redeploy and verify `/health/ready`.
6. Record rotation in `PRODUCTION_SECRET_REGISTER.json` metadata.

---

## 7. Maintenance & Read-Only Modes

### 7.1 Maintenance Mode
- **Activation**:
  ```bash
  curl -X POST https://<backend>/api/v1/system/maintenance \
    -H "Authorization: Bearer <MASTER_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"enabled": true, "reason": "Scheduled database index maintenance", "message": "Zamorin ERP undergoing scheduled maintenance."}'
  ```
- **Behavior**:
  - Non-exempt routes return HTTP 503 with `{ "error": "MAINTENANCE_MODE", "message": "..." }`.
  - Health checks (`/health/live`, `/health/ready`) and auth login are exempt.
  - Primary Master and Café Owner bypass maintenance mode with full access for operational validation.

### 7.2 Read-Only Mode
- Activates during database read-only failover or storage write failure.
- `GET` requests proceed normally.
- `POST`, `PUT`, `PATCH`, `DELETE` return HTTP 423 (Locked) with `{ "error": "READ_ONLY_MODE", "message": "Modifications temporarily suspended." }`.

---

## 8. Scheduled Jobs & Background Tasks

### 8.1 Job Register
- Managed by `backend/src/services/scheduledJobRegistry.js`.
- Inventory:
  - `DOCUMENT_INTEGRITY_RECONCILIATION` (Weekly)
  - `STAGING_TEMP_CLEANUP` (Every 6 Hours)
  - `BACKUP_READINESS_AUDIT` (Daily)
  - `LICENCE_EXPIRY_NOTIFICATION` (Daily)
  - `EXPORT_RETENTION_CLEANUP` (Daily)

### 8.2 Stale Job Detection & Idempotency
- Registry marks jobs with `staleThresholdMs`. If a job does not report execution within threshold, a SEV-2 alert is emitted.
- All retryable background operations require an `idempotencyKey` to prevent double execution of billing or exports.

---

## 9. Malware Scanner Production Gate

### 9.1 Honest Provider Status
- Production Status: **`scanner integration ready — production provider pending`**
- Do NOT upload sensitive café documents to untrusted public cloud scanners.
- When an enterprise ClamAV or commercial ICAP provider is configured:
  1. File is placed in quarantine staging (`PENDING_SCAN`).
  2. Engine returns `CLEAN` -> File moved to `/var/data/zamorin_documents`.
  3. Engine returns `INFECTED` -> File purged, SEV-1 incident raised, audit logged.
  4. Timeout -> Fail-closed policy (reject upload with `SCAN_FAILED`).

---

## 10. Operational Dashboard Access

- **Route**: `/#system-health` (and `/#ops`)
- **Authorized Roles**: `PRIMARY_MASTER`, `OWNER` ONLY.
- **Normal Staff & Operators**: Strictly blocked with HTTP 403 / route guard redirect.
- Exposes: Live subsystem status, persistent storage gauges, active alerts with 1-click Acknowledge/Resolve, feature flags, release manifest, and non-destructive restore drill controls.
