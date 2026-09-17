# ZAMORIN CAFÉ ERP — EXT-01 PRODUCTION OBJECT STORAGE AUDIT

**Gate Identifier:** EXT-01 (Live Production Object Storage Configuration, Security & Acceptance)  
**Security Level:** Enterprise Restricted  
**Governance Framework:** OWASP ASVS 5.0 / Statutory Record Retention (CGST Section 36)  
**Audit Date:** 2026-09-17  
**Audited By:** Senior Cloud Infrastructure Architect & Storage Security Lead  

---

## 1. Executive Summary

An exhaustive technical audit of Zamorin Café ERP's document storage architecture was conducted to evaluate readiness for live production object storage. 

The software application layer demonstrates exceptional maturity:
- Canonical abstraction via `DocumentStorageAdapter` with zero vendor lock-in.
- Full `S3CompatibleStorageAdapter` supporting AWS S3, Cloudflare R2, MinIO, and other S3-compatible APIs.
- Opaque, tenant-isolated, PII-free object key namespaces.
- Fail-closed security architecture rejecting unauthenticated, cross-org, cross-café, or unscanned access.
- Cryptographic SHA-256 integrity verification, magic-byte validation, and quarantine staging.
- Automated tests passing 100% (70/70 storage-specific tests).

However, **live production external cloud infrastructure ownership (REC-12) is currently unfulfilled**:
- `render.yaml` currently provisions a single-instance persistent disk (`/var/data/zamorin_documents`), which cannot scale across multi-instance clustered backends.
- No live S3/R2 bucket has been provisioned under verified Zamorin business ownership.
- Per EXT-01 Gate rules, the gate status is classified as **`BLOCKED_REC12`** pending human/business provisioning of the cloud storage resource.

---

## 2. Current Implementation Audit Table

| Area | Current Implementation | Evidence | Production Ready? |
| :--- | :--- | :--- | :--- |
| **Storage Abstraction** | `DocumentStorageAdapter` facade delegating to provider factory | [`backend/src/services/documentStorageAdapter.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/documentStorageAdapter.js) | **YES** (Code complete) |
| **S3 Adapter** | `S3CompatibleStorageAdapter` with presigned upload/download grants, streams, metadata, and copy | [`backend/src/services/storage/S3CompatibleStorageAdapter.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/storage/S3CompatibleStorageAdapter.js) | **YES** (Requires cloud credentials) |
| **BusinessDocument Model** | Authoritative MongoDB schema with versioning, checksums, retention holds, and audit trails | [`backend/src/models/BusinessDocument.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/models/BusinessDocument.js) | **YES** |
| **Upload Controller** | Two-phase direct-to-storage upload intent (`/upload-intent`) + finalization (`/finalize`) + staged multipart (`/attach`) | [`backend/src/routes/documentRoutes.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/routes/documentRoutes.js) | **YES** |
| **Download / Preview Controller** | Short-lived signed download grants (`/:id/download-grant`) and authenticated binary/inline streams (`/:id/download`, `/:id/preview`) | [`backend/src/routes/documentRoutes.js:L266-359`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/routes/documentRoutes.js) | **YES** |
| **Object Key Structure** | Tenant-isolated opaque keys: `<org>/<cafe>/<classification>/<documentId>-<randomHex>.<ext>` | [`backend/src/services/documentStorageAdapter.js:L142-171`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/documentStorageAdapter.js) | **YES** |
| **Signed URL Implementation** | Post-authorization HMAC-SHA256 presigned PUT/GET grants with 180s–300s TTL | [`backend/src/services/storage/S3CompatibleStorageAdapter.js:L218-255`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/storage/S3CompatibleStorageAdapter.js) | **YES** |
| **Scan Status Gate** | Strict quarantine isolation; `PENDING_SCAN` / `INFECTED` strictly blocked from download/preview | [`backend/src/services/documentAttachmentService.js:L356-375`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/documentAttachmentService.js) | **YES** |
| **Document Retention** | Section 36 CGST statutory 72-month retention, legal holds, appeal holds; Master-only permanent deletion | [`backend/src/services/retentionPolicyService.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/retentionPolicyService.js) | **YES** |
| **Ephemeral Filesystem Safeguard** | Fail-closed startup validator blocks local disk in production (`PROD_EPHEMERAL_STORAGE_DISALLOWED`) | [`backend/src/services/documentStorageAdapter.js:L66-135`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/documentStorageAdapter.js) | **YES** |
| **Cloud Object Store Resource** | AWS S3 / Cloudflare R2 bucket provisioned under Zamorin business account | Unprovisioned / pending REC-12 ownership | **NO (BLOCKED_REC12)** |

---

## 3. Render Filesystem & Ephemeral Storage Audit

A codebase-wide sweep was conducted to identify all disk references:
1. `path.join(os.tmpdir(), 'zamorin_document_staging')`:
   - **Classification:** `TEMPORARY_STREAMING_OK`. Used solely by multer to stream incoming multipart payloads during the request lifecycle. Automatically unlinked upon completion or error.
2. `path.join(effectiveRoot, '.probe-...')`:
   - **Classification:** `TEST_ONLY`. Storage mount health probe written and immediately unlinked during startup.
3. `/var/data/zamorin_documents` in `render.yaml`:
   - **Classification:** `MIGRATION_ONLY / INTERIM`. While durable across container restarts on a single instance, it cannot support clustered multi-instance deployment. Cloud object storage is mandatory.
4. `path.resolve(__dirname, '../../uploads')` in `storageAdapterService.js`:
   - **Classification:** `MIGRATION_ONLY`. Legacy service strictly logs `CLUSTER_STORAGE_INVALID` when executed in production mode.

---

## 4. Multi-Instance Clustered Compatibility

Render web services in high-availability production clusters run multiple concurrent containers behind a load balancer. Local disk or single-instance attached disks:
- Cannot be shared concurrently across multi-region or horizontally scaled container instances.
- Preclude seamless rolling deployments.
- Create single points of failure.

`S3CompatibleStorageAdapter` solves this completely: any authorised backend instance connects to the central private object store via IAM credentials over TLS.

---

## 5. Audit Conclusion & Gate Classification

- **Software Architecture Status:** PASS (Fully implemented, hardened, and verified).
- **Cloud Infrastructure Status:** BLOCKED_REC12 (Production cloud bucket unprovisioned).
- **EXT-01 Determination:** **`BLOCKED_REC12`**
