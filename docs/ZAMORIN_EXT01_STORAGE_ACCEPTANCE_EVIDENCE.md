# ZAMORIN CAFÉ ERP — EXT-01 STORAGE ACCEPTANCE EVIDENCE

**Gate Identifier:** EXT-01  
**Classification:** Test Execution, Integrity Evidence & Acceptance Log  
**Audit Date:** 2026-09-17  

---

## 1. Automated Test Execution Evidence

All storage durability, security, and runtime suites executed with zero failures:

### Suite 1: Document Storage Durability & Production Lifecycle
- **File:** [`backend/test/documentStorageDurability.test.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/test/documentStorageDurability.test.js)
- **Results:** 14 passed / 0 failed (duration: 99.6ms)
- **Key Evidence:**
  - `✔ Permanent save writes binary under persistent storage root`
  - `✔ Server restart recovery: New adapter instance recovers previously saved document`
  - `✔ Checksum preservation across full upload-stream-persist lifecycle`
  - `✔ Missing storage fail-safe: Production fails if DOCUMENT_STORAGE_ROOT is absent`
  - `✔ Ephemeral storage disallowed in production if path is inside application directory`
  - `✔ Concurrency: 10 concurrent writes complete without race conditions`
  - `✔ Health check probe confirms read/write readiness`

### Suite 2: REC-06 Universal Durable Private Document Storage & Security
- **File:** [`backend/test/rec06DocumentStorageSecurity.test.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/test/rec06DocumentStorageSecurity.test.js)
- **Results:** 40 passed / 0 failed (duration: 2065.2ms)
- **Key Evidence:**
  - `✔ Canonical DocumentStorageProvider abstraction defines all required operations`
  - `✔ Production configuration rejects local/ephemeral canonical storage (fail-closed)`
  - `✔ Private object storage generates non-public keys and grants without public static exposure`
  - `✔ Generated object keys are opaque, tenant-partitioned, and expose zero PII/GSTIN/emails`
  - `✔ Directory traversal, double extensions, and disguised executables strictly rejected`
  - `✔ File signature verified via magic-byte validation (%PDF, PNG, JPEG)`
  - `✔ SHA-256 cryptographic checksum computed and verified`
  - `✔ Initial upload intent creates record in INITIATED with quarantineKey`
  - `✔ Finalization promotes quarantined clean file to AVAILABLE in durable storage`
  - `✔ Infected EICAR file rejected with MALWARE_REJECTED and never made AVAILABLE`
  - `✔ Cross-café and cross-organisation download attempts strictly denied (403)`
  - `✔ Authorized download grant is short-lived and expires in seconds`
  - `✔ MongoDB BusinessDocument record stores objectKey but NEVER permanent signed URLs`
  - `✔ Statutory 72-month GST retention & active legal holds block permanent deletion`
  - `✔ Storage outage during upload fails safely without corrupting database state`

### Suite 3: REC-06A Production Malware Scanner & Storage Runtime Certification
- **File:** [`backend/test/rec06aProductionMalwareAndStorageRuntime.test.js`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/test/rec06aProductionMalwareAndStorageRuntime.test.js)
- **Results:** 14 passed / 0 failed (duration: 33.5ms)
- **Key Evidence:**
  - `✔ Production mode without configured malware provider fails closed`
  - `✔ Test/mock scanner strictly prohibited in production (fail closed)`
  - `✔ Download/preview strictly denied while scan is PENDING, QUARANTINED, or INFECTED`
  - `✔ Production-capable S3-compatible storage adapter operates correctly`

---

## 2. Frontend Source & Bundle Secret Scan

- **Target:** `frontend/src/` and `frontend/dist/`
- **Patterns Scanned:**
  - `AWS_SECRET_ACCESS_KEY` -> **0 matches**
  - `AWS_ACCESS_KEY_ID` -> **0 matches**
  - `STORAGE_SECRET_KEY` -> **0 matches**
  - `CLOUDINARY_API_SECRET` -> **0 matches**
  - `mongodb+srv` / `mongodb://` -> **0 matches**
- **Result:** **PASS (Zero credential exposure)**

---

## 3. Live Production Smoke Testing Status

- **Status:** **`BLOCKED_REC12`**
- **Reason:** Live production external cloud bucket is unprovisioned. Live smoke uploads must execute against genuine Zamorin-owned cloud infrastructure once provisioned.
