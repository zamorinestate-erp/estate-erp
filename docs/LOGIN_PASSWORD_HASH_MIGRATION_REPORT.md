# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## PASSWORD HASH MIGRATION & MODERN KDF SPECIFICATION REPORT

---

### 1. Architectural Summary

Zamorin Café ERP implements a multi-tier, version-aware password verification architecture that transitions all user credentials to a modern, memory-hard Key Derivation Function (**scrypt**) conforming to current OWASP password security recommendations.

---

### 2. Multi-Tier Verifier Hierarchy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PASSWORD VERIFICATION ENGINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. TIER 1 — CANONICAL MODERN KDF (scrypt)                                  │
│     Prefix:      $scrypt$v=1$                                               │
│     Parameters:  N=65536, r=8, p=1, keylen=64, maxmem=128MiB                 │
│     Salt:        128-bit CSPRNG (16 bytes random per credential)            │
│     Action:      Active scheme for all new credentials, resets, and changes │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. TIER 2 — INTERMEDIATE FORMAT ($v2$ Pre-Hashed Bcrypt)                   │
│     Prefix:      $v2$                                                       │
│     Parameters:  SHA-256 (Base64 44-byte digest) -> bcrypt (Cost 12)        │
│     Action:      Supported for test/dev credentials; upgraded on login      │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. TIER 3 — LEGACY BCRYPT ($2a$, $2b$, $2y$)                               │
│     Prefix:      $2a$, $2b$, $2y$                                           │
│     Parameters:  Raw bcrypt (Cost 10-12)                                    │
│     Action:      Supported for pre-existing credentials; upgraded on login  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. On-Login Transparent Re-Hash Migration Workflow

When a user submits credentials during login:

1. **Authentication Verification**:
   - `verifyPassword(password, user.passwordHash)` checks the credential against Tier 1, Tier 2, or Tier 3.
   - If invalid: Request is immediately rejected with `401 INVALID_LOGIN`, failed attempt counter is incremented, and stored verifier remains **100% UNCHANGED**.
2. **Upgrade Detection**:
   - If valid, `needsPasswordRehash(user.passwordHash)` evaluates whether the stored verifier lacks the `$scrypt$v=1$` prefix.
3. **Atomic Re-Hash & Persistence**:
   - If `needsPasswordRehash === true`, `hashPassword(password)` derives a fresh canonical `$scrypt$v=1$` verifier with an independent 128-bit CSPRNG salt.
   - `user.passwordHash = upgradedHash; await user.save();` atomically persists the upgraded credential.
   - Subsequent logins evaluate directly against Tier 1 (`$scrypt$v=1$`) without further migration overhead.
4. **Failure Fault Tolerance**:
   - If re-hash derivation or persistence fails, the primary login session is preserved and authentication completes safely.

---

### 4. Input Sensitivity & Anti-Shucking Invariants

1. **Zero 72-Byte Truncation**: Unlike direct bcrypt, scrypt accepts arbitrary byte length inputs without silent truncation.
2. **Zero Password-Shucking Vulnerability**: Plain unkeyed fast SHA-256 pre-hashing before bcrypt has been completely removed from the canonical credential path.
3. **Unicode NFC Normalization**: All password inputs pass through `password.normalize('NFC')` before KDF processing, guaranteeing consistent verification across cross-platform character encodings.
4. **Length Bounding (DoS Defense)**: Max 128-character limit is verified prior to KDF execution, preventing memory/CPU exhaustion attacks.

---

### 5. Verification Test Matrix

| Test Case | Initial Verifier Format | Submitted Password | Verification Result | Final Verifier Format | Certified Status |
|---|---|---|---|---|---|
| **New Registration / Reset** | N/A | Valid 15+ char passphrase | SUCCESS | `$scrypt$v=1$...` | **PASS** |
| **Legacy Bcrypt Login** | `$2b$10$...` | Correct legacy password | SUCCESS | `$scrypt$v=1$...` (Upgraded) | **PASS** |
| **Legacy Wrong Password** | `$2b$10$...` | Incorrect password | DENIED (401) | `$2b$10$...` (Unchanged) | **PASS** |
| **Intermediate $v2$ Login** | `$v2$$2b$12$...` | Correct password | SUCCESS | `$scrypt$v=1$...` (Upgraded) | **PASS** |
| **Canonical Scrypt Login** | `$scrypt$v=1$...` | Correct password | SUCCESS | `$scrypt$v=1$...` (No-op) | **PASS** |
| **72-Byte Boundary A/B** | `$scrypt$v=1$...` | 72 'A's + "SUFFIX1" vs "SUFFIX2" | DIFFERENTIATED | `$scrypt$v=1$...` | **PASS** |
| **128-Character Test** | `$scrypt$v=1$...` | 128-char matching 127 bytes | DIFFERENTIATED | `$scrypt$v=1$...` | **PASS** |
| **Multibyte UTF-8 Unicode** | `$scrypt$v=1$...` | 90+ byte UTF-8 emoji/Kanji | DIFFERENTIATED | `$scrypt$v=1$...` | **PASS** |
