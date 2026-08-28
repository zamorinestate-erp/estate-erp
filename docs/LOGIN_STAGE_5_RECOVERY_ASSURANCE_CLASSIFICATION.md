# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 5 — RECOVERY ASSURANCE & IDENTITY PROOFING CLASSIFICATION

---

### 1. Scope & Purpose

This document formally records the **Recovery Assurance Classification** for the Zamorin Café ERP Stage-5 recovery mechanisms. It distinguishes between **Commercial Enterprise Application-Level Recovery** and formal **NIST SP 800-63A/B Authenticator Assurance Level (AAL)** certifications to prevent overstatement of compliance boundaries.

---

### 2. Recovery Classification Summary

| Recovery Subsystem | Classification Level | Identity Proofing & Channel Assurance | Formal NIST AAL Equivalent |
|---|---|---|---|
| **Self-Service Password Reset** | **Enterprise Application Recovery** | Pre-authenticated corporate email delivery with 6-digit challenge + HMAC token | AAL1 / High-Assurance Enterprise |
| **MFA TOTP Loss Recovery** | **Possession-Proof Recovery** | 10 pre-generated, single-use, SHA-256 hashed cryptographic backup codes | AAL2-Aligned Recovery Flow |
| **Terminal Device Recovery / Re-Enrollment** | **Dual-Authority Governance** | Cryptographic Master Account authorization + Time-bound enrollment token | High-Assurance Device Context |
| **Account Reactivation / Disablement** | **Administrative Maker-Checker** | Direct database / governance action by Primary Master / Organization Admin | Manual Identity Verification |

---

### 3. Standards Alignment & Boundary Statements

1. **No False AAL3 Claims**: Zamorin Café ERP implements high-strength commercial cryptographic controls (AES-256-GCM for MFA secrets at rest, SHA-256 for backup codes, HMAC-SHA256 for reset tokens, bcrypt for passwords). It does **not** claim formal FIPS 140-2 Level 3 hardware cryptoprocessor (HSM/YubiKey) backing unless deployed with external hardware authenticators in Stage 6 / Production.
2. **Email Delivery Channel Dependency**: Self-service password recovery is fundamentally bounded by the security of the destination email infrastructure. To mitigate channel compromise:
   - Reset codes expire after 15 minutes.
   - Code verification is throttled (max 5 failed attempts per challenge).
   - Reset tokens are single-use, Base64URL-encoded HMAC digests with 10-minute server-time validity.
   - Reset completion immediately revokes all prior active user sessions (`sessionVersion += 1`).
   - Successful reset does **not** auto-login, forcing fresh credential entry.
3. **MFA Independence**: A valid password alone is **strictly prohibited** from disabling or recovering an MFA-enrolled account. MFA loss requires either an unconsumed single-use recovery code or manual Primary Master administrative intervention.
