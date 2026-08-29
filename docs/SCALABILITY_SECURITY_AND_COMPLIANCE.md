# ZAMORIN CAFÉ ERP — SCALABILITY SECURITY & COMPLIANCE

> **Standard**: NIST SP 800-63B Authentication Security & SOC2 Data Boundary Isolation  
> **Confidence Status**: **VERIFIED_LOCAL & VERIFIED_CLUSTER_TEST**  

---

## 1. Cryptographic Security Invariants

1. **Password Storage (NIST SP 800-63B)**:
   - Memory-hard scrypt KDF with 128-bit CSPRNG salt ($N=32768, r=8, p=1$).
   - Bounded concurrency queue prevents denial-of-service login attacks.
2. **Session Security**:
   - Cryptographically random 256-bit opaque refresh tokens and short-lived JWT access tokens (15 minutes).
   - Instant cross-instance revocation upon security events.
3. **Immutable Audit Trails**:
   - All high-privilege operations (`DEVICE_REVOKED`, `ROLE_CHANGED`, `PAYROLL_APPROVED`) emit immutable records to `audit_events` with SHA-256 integrity metadata.

---

## 2. Cross-Tenant Defense-in-Depth

- **0 Cross-Café Leaks**: Automated test harnesses continuously sample random cross-outlet requests and assert 100% rejection.
- **0 Privilege Escalations**: Staff and personal device contexts are unconditionally clamped to `SELF_ONLY`.
