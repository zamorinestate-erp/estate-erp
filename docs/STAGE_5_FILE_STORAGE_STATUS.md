# ZAMORIN CAFE ERP
## STAGE 5 — FILE STORAGE STATUS

### 1. Architecture Classification
- **Local Development Environment**: Uses validated local filesystem storage (`/uploads`) with authoritative MongoDB document metadata tracking.
- **Production Cloud Target**: Configured for AWS S3 / Google Cloud Storage object storage with signed URLs and IAM bucket policies.

### 2. File Upload & Storage Matrix

| File Type / Category | Supported Extensions | Size Limit | Local Development Implementation | Production Cloud Target | Security Validation | Status |
|---|---|:---:|---|---|---|:---:|
| **Expense Receipts & Invoices** | `.pdf`, `.png`, `.jpg`, `.jpeg` | 10 MB | Local disk storage with UUID sanitization | AWS S3 Private Bucket | Server MIME + Magic Byte check | **LOCAL VERIFIED / CLOUD PENDING** |
| **Supplier Statutory Documents** | `.pdf`, `.jpg`, `.png` | 15 MB | Local disk storage with UUID sanitization | AWS S3 Private Bucket | Server MIME + Magic Byte check | **LOCAL VERIFIED / CLOUD PENDING** |
| **Quality CAPA Photo Evidence** | `.jpg`, `.jpeg`, `.png`, `.webp`| 10 MB | Local disk storage with UUID sanitization | AWS S3 Private Bucket | Server MIME + Magic Byte check | **LOCAL VERIFIED / CLOUD PENDING** |
| **ZURF & Report PDF Exports** | `.pdf`, `.xlsx`, `.csv` | 25 MB | Generated in-memory / temporary buffer | Streaming download / Signed URL | Ephemeral buffer, zero leak | **COMPLETE_AND_VERIFIED** |

---
**Storage Status Certified:** Local file upload pipelines fully operational; production cloud object-storage correctly marked as deployment-environment pending.
