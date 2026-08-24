# File Upload Security & Storage Governance Report

**Date:** 2026-08-24  
**System:** Zamorin Café ERP v2.2.2  
**Standard:** Enterprise Evidence Storage & Access Governance  

---

## 1. Security Controls & Validation Architecture

1. **Strict File Extension & MIME Allowlist**:
   - **Allowed Formats:** `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.xlsx`, `.docx`, `.csv`.
   - **Strictly Blocked Formats:** `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.html`, `.js`, `.apk`, `.jar`, `.svg`.
   - Browser `Content-Type` is cross-verified against extension and binary signatures.

2. **Safe Filename Generation**:
   - Original filename is preserved purely as display metadata (`originalDisplayName`).
   - File is stored on the filesystem/object storage using an opaque, randomized ID (e.g. `FILE-2026-0824-xxxx`).

3. **Size Bounds & Throttling**:
   - Maximum upload limit strictly enforced at 15 MB.
   - Validation occurs on the client dropzone prior to payload dispatch, and is re-verified by server-side middleware.

4. **Cryptographic Integrity & SHA-256 Hashing**:
   - Each upload computes a client/server SHA-256 checksum.
   - Enables duplicate warning prompts without silently overwriting existing files.
   - Provides tamper-evident proof for statutory audits (8-year FSSAI/GST retention).

5. **Authenticated Download Protection**:
   - Files are never served from unrestricted public webroots.
   - Downloads pass through authorized endpoints checking role, café scope, and record permissions.
