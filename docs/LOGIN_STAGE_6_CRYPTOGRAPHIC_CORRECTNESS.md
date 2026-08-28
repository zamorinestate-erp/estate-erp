# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — CRYPTOGRAPHIC CORRECTNESS & ASSURANCE SPECIFICATION

---

### 1. Cryptographic Summary

| Primitive | Mechanism | Parameters / Construction | Threat / Vulnerability Mitigated |
|---|---|---|---|
| **Password Storage** | Canonical Memory-Hard `scrypt` | `N=65536, r=8, p=1`, 128-bit CSPRNG salt, 512-bit key, NFC norm | Eliminates 72-byte truncation & password-shucking; memory-hard GPU resistance |
| **Recovery Codes** | CSPRNG 128-Bit Tokens | `crypto.randomBytes(16)` (128 bits), SHA-256 hash at rest | Eliminates offline dictionary enumeration; single-use atomic consumption |
| **MFA TOTP** | RFC 6238 TOTP | SHA1, 6 digits, 30s step, $\pm 1$ window, `lastMfaCounter` | Replay attacks, adjacent window reuse, concurrent race conditions |
| **MFA Secret Storage** | AES-256-GCM | Encrypted at rest with environment key `MFA_ENCRYPTION_KEY` | Database dump compromise of TOTP shared secrets |
| **Terminal Device Trust** | Base32 Enrollment + HMAC Token | Crockford Base32 token (15m TTL), SHA-256 signature | Device spoofing, unregistered terminal access |
| **Operator PIN** | Bcrypt PIN Hash | 4-6 numeric digits, bcrypt cost 10, lookup hash index | Brute force guessing, timing attacks on PIN verification |

---

### 2. Assurance Level Classification (NIST SP 800-63B-4 Alignment)

1. **AAL2 (Authenticator Assurance Level 2)**:
   - **DESIGNED TO MEET AAL2-TARGETED CONTROLS**: Multi-factor authentication combining memorize-secret (password/passphrase) and out-of-band/software cryptographic authenticator (RFC 6238 TOTP) with replay resistance and rate limiting. Formal independent certification is not claimed.
2. **AAL3 (Authenticator Assurance Level 3)**:
   - **NOT CURRENTLY CLAIMED**: Formal AAL3 requires a phishing-resistant, hardware-protected public-key authenticator with non-exportable private key (FIDO2 / WebAuthn / physical hardware security key like YubiKey), hardware-backed authentication intent, and applicable FIPS 140 validation.
   - Cloud KMS / HSM envelope encryption for server secrets is classified as **defense-in-depth**, not formal AAL3.
