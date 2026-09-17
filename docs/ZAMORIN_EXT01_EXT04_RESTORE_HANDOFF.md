# ZAMORIN CAFÉ ERP — EXT-01 TO EXT-04 DOCUMENT RESTORE HANDOFF

**Handoff From:** EXT-01 (Object Storage Architecture)  
**Handoff To:** EXT-04 (Document Restore & Disaster Recovery Certification)  
**Status:** RESTORE CAPABILITIES ARCHITECTED & VERSIONING COMPLIANT  
**Audit Date:** 2026-09-17  

---

## 1. Storage Versioning & Restore Interface for EXT-04

To support the non-destructive restore testing required by EXT-04, the storage and metadata layer maintains full version fidelity.

### 1.1 Object Versioning Configuration
- **S3 Bucket Configuration:** Object Versioning must be set to `Status: Enabled` on the production bucket (`zamorin-production-documents`).
- **Version ID Persistence:** 
  - Every `putObject()` execution records the returned `storageVersionId`.
  - Stored in `BusinessDocument.storageVersionId` and in the `versions` array.
- **Delete Markers:** In S3 versioning, a standard `DeleteObject` creates a delete marker. The prior version remains restorable by deleting the delete marker or retrieving the specific `VersionId`.

### 1.2 Soft Delete vs. Permanent Purge
1. **Application Soft Delete:**
   - Triggered via `DELETE /api/v1/documents/:documentId`.
   - Sets `isDeleted: true`, `documentStatus: 'ARCHIVED'`, `deletedAt: new Date()`.
   - The physical object in cloud storage is preserved intact.
   - Restorable via `POST /api/v1/documents/:documentId/restore` by MASTER or OWNER roles.
2. **Permanent Destruction:**
   - Strictly gated to `MASTER` role.
   - Blocked by statutory 72-month retention (Section 36 CGST), active legal holds, or appeal holds.
   - Deletes object versions from S3.

### 1.3 Hand-off Parameters for EXT-04 Drill
- **Storage Driver:** `S3_COMPATIBLE` (`S3CompatibleStorageAdapter`)
- **Bucket Identification:** `process.env.S3_BUCKET` (`zamorin-production-documents`)
- **Metadata Source of Truth:** MongoDB `BusinessDocument` collection
- **Key Retrieval Function:** `documentStorageAdapter.getStream({ storageKey })`
- **Integrity Validation:** SHA-256 computed on restored binary must match `BusinessDocument.sha256`.
