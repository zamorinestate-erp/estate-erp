# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — FINAL PASSWORD HASHING ARCHITECTURE & OWASP SCRYPT SPECIFICATION

---

### 1. Architectural Overview

Zamorin Café ERP utilizes the memory-hard **scrypt** Key Derivation Function conforming to current OWASP password storage recommendations ($N=65536, r=8, p=2$) executed asynchronously on libuv worker threads for all canonical password hashing and verification operations.

---

### 2. Canonical Password KDF Technical Specification

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
[ Async Memory-Hard scrypt KDF ] ──► N = 65536 (2^16), r = 8, p = 2, keylen = 64 bytes
       │                             maxmem = 256 MiB (268,435,456 bytes)
       ▼
[ Canonical Verifier String ] ──► "$scrypt$v=1$N=65536,r=8,p=2$<salt_hex>$<derived_key_hex>"
```

---

### 3. Key Cryptographic & Runtime Properties

1. **OWASP Baseline Compliance**: Parameterized with $N=65536, r=8, p=2$ (64 MiB memory cost, doubled parallelization work factor), providing strong resistance to offline parallel hardware/ASIC cracking.
2. **Non-Blocking Asynchronous Execution**: All runtime password derivations execute via `util.promisify(crypto.scrypt)` on Node's libuv worker pool. The HTTP event loop remains completely unblocked (`scryptSync` is 100% barred from runtime request paths).
3. **Zero 72-Byte Truncation**: Scrypt operates natively on variable-length byte buffers, fully evaluating all 128 characters without truncation.
4. **Zero Password-Shucking Risk**: Plain unkeyed fast SHA-256 pre-hashing before bcrypt has been completely eliminated from the canonical path.
5. **Dynamic Parameter Decoding**: Verifier strings encode exact $(N, r, p)$ parameters, enabling safe verification of legacy parameters alongside canonical targets.
6. **Timing-Safe Equality**: Verification executes `crypto.timingSafeEqual` over derived key buffers, eliminating timing side-channel leaks.

---

### 4. Multi-Tier Backward Compatibility & Migration

- **Tier 1 (`$scrypt$v=1$N=65536,r=8,p=2`)**: Verified directly via async scrypt.
- **Tier 1b Legacy Scrypt (`$scrypt$v=1$N=65536,r=8,p=1`)**: Dynamically verified using stored $p=1$; automatically upgraded to $p=2$ upon valid login.
- **Tier 2 (`$v2$`)**: Verified via SHA-256 pre-hashed bcrypt; automatically upgraded to Tier 1 on successful login.
- **Tier 3 (`$2a$`, `$2b$`, `$2y$`)**: Verified via standard `bcrypt.compare`; automatically upgraded to Tier 1 on successful login.
- **Wrong Password Protection**: Failed logins do not trigger migration; stored verifiers remain 100% untouched.

---

### 5. Performance & Concurrency Benchmarks

Measured on integration server hardware:

- **Single-Derivation Latency**:
  - Hash ($N=65536, r=8, p=2$): p50 = ~500ms - 590ms | p95 = ~720ms
  - Verify ($N=65536, r=8, p=2$): p50 = ~450ms - 490ms | p95 = ~575ms
- **Concurrent Load**:
  - 1 concurrent: ~563ms
  - 4 concurrent: ~549ms
  - 8 concurrent: ~1130ms
  - 16 concurrent: ~2220ms
- **Event-Loop Responsiveness**: Unrelated lightweight HTTP requests during 8 concurrent password hashes maintain an average response latency of ~6.9ms.
