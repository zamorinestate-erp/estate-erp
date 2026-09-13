# CHANGELOG — ZAMORIN CAFÉ ERP

All notable changes to this project are documented in this file in adherence with Semantic Versioning and rigorous architectural audit requirements.

---

## [v1.0.0-stage10] — 2026-09-13
### Stage 10 — Explicit Safe Post-Release Systems (Freeze Baseline: `e2ec643811b2e26550a54aebb37cbfe91c60be2f`)

#### Added — Operational Governance & Safety
- **Startup Configuration Validator**: universal `startupValidator.js` validating all critical production variables before application boot. Operates fail-closed; masks credentials with `PRESENT`/`MISSING`/`INVALID`/`UNSAFE`.
- **Production Secret Register**: `config/PRODUCTION_SECRET_REGISTER.json` documenting metadata only (purpose, owner, rotation schedule, environment). Zero secrets committed.
- **Liveness & Readiness Probes**:
  - `GET /health/live`: Lightweight process survival check (HTTP 200).
  - `GET /health/ready`: Deep dependency readiness check verifying MongoDB connection and persistent document storage health.
  - Render configuration (`render.yaml`) updated to use `/health/ready`.
- **Request Context & Correlation Tracing**:
  - Express middleware generating and propagating `X-Request-ID` and `X-Correlation-ID`.
  - Production 500 errors concealed with safe reference: `Something went wrong. Reference: REQ-...`.
- **Structured Security & Operational Logging**:
  - Universal log schema incorporating `requestId`, `correlationId`, `userId`, `cafeId`, `route`, `status`, and sanitized payloads.
- **Provider-Neutral Error Tracking Adapter**:
  - `errorTrackingAdapter.js` declaring truthful status: `ERROR_TRACKING_PROVIDER_PENDING`.
- **Universal Operational Alerting Framework**:
  - `OperationalAlert.js` model supporting SEV-1 through SEV-4.
  - Automated deduplication with 5-minute cooldown and auto-resolution when recovery occurs.
- **Document Storage Capacity & Reconciliation Engine**:
  - Real-time disk capacity monitoring with WARNING (70%), HIGH (85%), and CRITICAL (95%) alerts.
  - Scheduled non-destructive document integrity reconciler comparing MongoDB metadata against physical disk binaries without deleting data.
- **Release Manifest & Governance**:
  - `ReleaseManifest.js` model and `generate_release_manifest.mjs` script tracking commits, deployments, migration versions, and lifecycle states.
- **Database Migration Safety Checker**:
  - `migration_safety_checker.mjs` enforcing backward compatibility pre-flights and expand-contract patterns.
- **Server-Authoritative Feature Flags & Emergency Kill Switches**:
  - `featureFlagService.js` providing auditable switches: `KILL_SWITCH_DOCUMENT_UPLOADS`, `KILL_SWITCH_EXPORT_QUEUE`, `KILL_SWITCH_EXTERNAL_MAIL_SYNC`.
- **Maintenance & Read-Only Modes**:
  - `maintenanceMode.js` middleware returning HTTP 503 during maintenance, with authorized bypass for Primary Master and Café Owner.
  - Read-Only mode returning HTTP 423 (Locked) on state mutations during storage/database degradation.
- **Incident Response NIST Model**:
  - Expanded `Incident.js` statuses: `DETECTED`, `TRIAGED`, `CONTAINING`, `RECOVERING`, `MONITORING`, `RESOLVED`, `POST_INCIDENT_REVIEW`.
- **Scheduled Job Registry**:
  - Background job inventory with stale job alert thresholds and execution idempotency keys.
- **Statutory Retention & Staging Cleanup**:
  - `retentionPolicyService.js` defining retention classes and safe orphan staging cleaner for `os.tmpdir()/zamorin_document_staging`.
- **Master Operations / System Health Dashboard**:
  - Frontend SPA page (`/#system-health`) restricted to Primary Master and Owner roles. Exposes real-time subsystem health, storage gauges, alert resolution, release manifest, and non-destructive restore drill controls.

---

## [v0.9.0-stage09] — 2026-09-12
### Stage 09 — Offline Resilience & Sync Integrity
- Implemented IndexedDB offline storage for orders, bills, and menu items.
- Added Service Worker background sync engine with conflict resolution.
- Enforced strict tenant and café boundary verification during offline synchronization.

## [v0.8.0-stage08] — 2026-09-11
### Stage 08 — Multi-Tenant Isolation & ASVS Security
- Completed OWASP ASVS Level 2 security compliance across authentication and access control.
- Enforced multi-tier tenancy: Organisation -> Café -> User -> Role -> Permission.
- Enforced NIST SP 800-63B passphrase standards (15 min, 128 max capacity).

## [v0.1.0-v0.7.0] — Initial System Build
- Core ERP modules: POS, Billing, Inventory, Procurement, Assets, Quality, HR, Finance, Commercial.
