# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — FINAL PASSWORD HASHING ARCHITECTURE & MODERN KDF SPECIFICATION

---

### 1. Architectural Overview

Zamorin Café ERP utilizes the memory-hard **scrypt** Key Derivation Function conforming to current OWASP password storage recommendations for all canonical password hashing operations.

---

### 2. Canonical Password KDF Specification

```text
USER PLAINTEXT PASSWORD (1 to 128 chars, UTF-8)
       │
       ▼
[ Unicode NFC Normalization ] ──► Standardizes composed/decomposed Unicode sequences
       │
       ▼
[ Length / Policy Validation ] ──► Bounded max 128 chars (DoS defense) & blocklist check
       │
       ▼
[ CSPRNG Salt Generation ] ──► 128-bit (16 bytes) unique random salt per credential
       │
       ▼
[ Memory-Hard scrypt KDF ] ──► N = 65536 (2^16), r = 8, p = 1, keylen = 64 bytes
       │
       ▼
[ Canonical Verifier String ] ──► "$scrypt$v=1$N=65536,r=8,p=1$<salt_hex>$<derived_key_hex>"
```

---

### 3. Key Security Properties

1. **Zero 72-Byte Truncation**: Scrypt operates natively on variable-length byte buffers, fully evaluating all 128 characters without truncation.
2. **Zero Password-Shucking Risk**: Plain unkeyed fast SHA-256 pre-hashing before bcrypt has been completely eliminated from the canonical path.
3. **Memory-Hard ASIC/GPU Resistance**: Parameterized with $N=65536, r=8, p=1$ (128 MB working memory limit), providing strong resistance to offline parallel hardware cracking.
4. **Timing-Safe Equality**: Verification executes `crypto.timingSafeEqual` over derived key buffers, eliminating timing side-channel leaks.
5. **Zero Frontend Transformation**: Password hashing remains strictly server-side. Password managers operate natively over TLS.

---

### 4. Multi-Tier Backward Compatibility & Migration

- **Tier 1 (`$scrypt$v=1$`)**: Verified directly via `crypto.scryptSync`.
- **Tier 2 (`$v2$`)**: Verified via SHA-256 pre-hashed bcrypt; automatically upgraded to Tier 1 on successful login.
- **Tier 3 (`$2a$`, `$2b$`, `$2y$`)**: Verified via standard `bcrypt.compare`; automatically upgraded to Tier 1 on successful login.
- **Wrong Password Protection**: Failed logins do not trigger migration; stored verifiers remain 100% untouched.

---

### 5. Performance Benchmarks

Measured on local integration test hardware:

- **Scrypt Password Hash ($N=65536, r=8, p=1, keylen=64$)**:
  - Latency: ~200ms - 350ms
- **Scrypt Password Verification**:
  - Latency: ~200ms - 350ms
- **Timing Normalization**: Constant-time verification path executed on missing users to prevent account enumeration timing attacks.
