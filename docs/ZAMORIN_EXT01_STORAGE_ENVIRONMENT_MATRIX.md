# ZAMORIN CAFÉ ERP — EXT-01 STORAGE ENVIRONMENT MATRIX

**Gate Identifier:** EXT-01  
**Classification:** Configuration & Environment Specification  
**Audit Date:** 2026-09-17  

---

## 1. Sanitized Environment Variable Matrix

This matrix documents the canonical configuration variables utilized by `DocumentStorageAdapter` and `S3CompatibleStorageAdapter`. **No plaintext secret values are present in this document.**

| Variable | Canonical Purpose | Secret? | Production Required? | Staging / Prod Distinct? |
| :--- | :--- | :---: | :---: | :---: |
| `DOCUMENT_STORAGE_PROVIDER` | Driver selector (`s3` / `s3_compatible` / `private_object_storage`) | No | **YES** | Identical value |
| `S3_BUCKET` / `STORAGE_CONTAINER` | Cloud object storage bucket identifier | No | **YES** | **MANDATORY DISTINCT** |
| `AWS_REGION` / `STORAGE_REGION` | Cloud provider region (e.g. `ap-south-1` Mumbai) | No | **YES** | May be same region |
| `S3_ENDPOINT` / `STORAGE_ENDPOINT` | Custom S3 endpoint URL (Required for Cloudflare R2/MinIO) | No | Provider-dependent | Distinct endpoint if applicable |
| `AWS_ACCESS_KEY_ID` / `STORAGE_ACCESS_KEY` | Dedicated least-privilege IAM service account Access Key ID | **YES** | **YES** | **MANDATORY DISTINCT** |
| `AWS_SECRET_ACCESS_KEY` / `STORAGE_SECRET_KEY` | Dedicated least-privilege IAM service account Secret Key | **YES** | **YES** | **MANDATORY DISTINCT** |
| `DOCUMENT_STORAGE_MAX_BYTES` | Maximum allowed attachment payload size in bytes (default: 15MB) | No | Optional (Defaults to 15MB) | Identical |
| `DOCUMENT_STORAGE_SIGNED_URL_TTL` | Short-lived grant access lifetime in seconds (default: 180s) | No | Optional (Defaults to 180s) | Identical |

---

## 2. Environment Isolation Invariants

1. **Bucket Separation:**
   - **Staging Bucket:** `zamorin-staging-documents`
   - **Production Bucket:** `zamorin-production-documents`
   - Test files written in staging must never touch the production container.
2. **Credential Separation:**
   - The staging backend principal must have zero IAM permissions on the production bucket.
   - The production backend principal must have zero IAM permissions on the staging bucket.
3. **Secret Storage Location:**
   - Production secrets must be stored **only** in the Render Dashboard under **Environment Variables** (marked Secret) or in AWS Secrets Manager.
   - Storage credentials must **never** be committed to Git, embedded in frontend bundles, or saved in MongoDB.
