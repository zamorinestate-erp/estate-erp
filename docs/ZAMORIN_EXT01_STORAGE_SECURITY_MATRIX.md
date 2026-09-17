# ZAMORIN CAFÉ ERP — EXT-01 STORAGE SECURITY MATRIX

**Gate Identifier:** EXT-01  
**Classification:** Security Architecture & Access Control Policy  
**Effective Date:** 2026-09-17  

---

## 1. Access Control & Public Blocking Matrix

| Policy Dimension | Requirement | Implementation | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **Anonymous List** | **DENIED** | Bucket policy prohibits `s3:ListBucket` for unauthenticated principals | Cloud Storage Policy |
| **Anonymous Read** | **DENIED** | S3 Block Public Access enabled; direct object URLs return 403 Forbidden | Cloud Storage Policy |
| **Anonymous Write** | **DENIED** | PutObject requires valid IAM signature or short-lived presigned grant | Cloud Storage Policy |
| **Anonymous Delete** | **DENIED** | DeleteObject requires IAM credential; blocked from presigned grants | Cloud Storage Policy |
| **ACL Model** | **Bucket Owner Enforced** | Object ACLs disabled; bucket policy controls all access | Cloud Storage Policy |
| **Public IP Whitelist** | N/A | Restricted to Render production backend outbound NAT / IAM | Cloud IAM Policy |

---

## 2. Server-Side Role-Based Authorization Matrix

All download and preview access is evaluated dynamically by `DocumentAttachmentService.assertDocumentAuthorization`:

| Role | Procurement Docs | Financial / Banking Docs | HR Confidential | General Attachments | Permanent Deletion |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **MASTER (Primary/Normal)** | ALLOW (Global) | ALLOW (Global) | ALLOW (Global) | ALLOW (Global) | **ALLOW** (If retention expired & no legal hold) |
| **OWNER** | ALLOW (Global) | ALLOW (Global) | ALLOW (Global) | ALLOW (Global) | **DENY** (Master authority required) |
| **REGIONAL_MANAGER** | ALLOW (Assigned Cafés) | ALLOW (Assigned Cafés) | DENY | ALLOW (Assigned Cafés) | **DENY** |
| **CAFE_ADMIN** | ALLOW (Assigned Café) | DENY | DENY | ALLOW (Assigned Café) | **DENY** |
| **STAFF (Kitchen/Service)** | **DENY** (403) | **DENY** (403) | Self-only (HR_SELF) | Assigned Café only | **DENY** |
| **ANONYMOUS** | **DENY** (401) | **DENY** (401) | **DENY** (401) | **DENY** (401) | **DENY** (401) |

---

## 3. Cryptographic Security & Integrity Controls

```text
Incoming Upload Stream
        │
        ▼
[Magic-Byte / File Signature Verification] (PDF: %PDF, PNG: 0x89504E47, JPEG: 0xFFD8FF)
        │
        ▼
[Static Heuristic & Extension Inspection] (Rejects double extensions, scripts, null bytes)
        │
        ▼
[Cryptographic SHA-256 Checksum Computed]
        │
        ▼
[Quarantine Storage Staging] (quarantine/<org>/<cafe>/<docId>-<rand>.<ext>)
        │
        ▼
[Layer 2 Security Scan (EXT-02 Handoff)]
   ├── CLEAN ────────► Promoted to Canonical Key (<org>/<cafe>/<class>/<docId>-<rand>.<ext>)
   └── INFECTED ─────► Quarantine deleted, status marked MALWARE_REJECTED / INFECTED
```

- **Encryption at Rest:** Mandatory AES-256 (SSE-S3) or AWS KMS customer-managed key.
- **TLS in Transit:** Minimum TLS 1.2 enforced on all endpoints; plain HTTP endpoints rejected at startup.
- **Checksum Storage:** Immutable `sha256` recorded in `BusinessDocument` record and returned in `X-File-Checksum` response header.
- **Signed URL TTL:** Maximum 180 seconds for download; 300 seconds for upload intent. Zero permanent URLs stored in MongoDB.
