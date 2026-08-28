# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 5 — FINAL PASSWORD POLICY & AUTHENTICATION STANDARDS RECORD

---

### 1. Architectural Baseline & Standards Alignment (NIST SP 800-63B-4)

The Zamorin Café ERP password policy aligns with modern digital identity guidelines (**NIST SP 800-63B-4**). The legacy practice of requiring mandatory character-class composition (e.g. forcing combinations of uppercase, lowercase, numbers, and special symbols) has been removed in favor of a **length-first, passphrase-friendly, blocklisted-dictionary, and multi-factor authentication (MFA)** architecture.

---

### 2. Password Length Assurance Architecture

| Policy Dimension | Single-Factor Accounts (Password-Only) | Multi-Factor Accounts (MFA Enforced) |
|---|---|---|
| **Minimum Length** | **15 characters** (NIST Single-Factor Baseline) | **8 characters** (NIST Multi-Factor Baseline) |
| **Maximum Length** | **128 characters** without silent truncation | **128 characters** without silent truncation |
| **Passphrase Support** | Fully supported (spaces, words, punctuation) | Fully supported (spaces, words, punctuation) |
| **Composition Rules** | **0 mandatory composition requirements** | **0 mandatory composition requirements** |
| **Unicode / Charsets** | Full printable ASCII, spaces, and UTF-8 Unicode | Full printable ASCII, spaces, and UTF-8 Unicode |
| **Offline Blocklist** | Enforced at creation & change | Enforced at creation & change |
| **Repetitive String Check** | Single-character repeats (`aaaa...`) rejected | Single-character repeats (`aaaa...`) rejected |
| **Periodic Expiry** | **Zero arbitrary periodic expiration** | **Zero arbitrary periodic expiration** |

---

### 3. Five-Persona Password & MFA Matrix

| Persona | Canonical Role | Authentication Model | Password Baseline | MFA Policy |
|---|---|---|---|---|
| **Primary Master** | `master` (`isPrimaryMaster: true`) | Multi-Factor (Password + TOTP) | 8+ characters (15+ recommended) | **MANDATORY** |
| **Normal Master** | `master` (`isPrimaryMaster: false`) | Multi-Factor (Password + TOTP) | 8+ characters (15+ recommended) | **MANDATORY** |
| **Executive Owner** | `owner` | Multi-Factor (Password + TOTP) | 8+ characters (15+ recommended) | **MANDATORY** |
| **Café Operations** | `cafe_admin` / Operator | Device-Bound Context / Multi-Factor | 8+ characters (or trusted terminal PIN) | **MANDATORY** |
| **Staff Member** | `staff` | Single-Factor / Optional MFA | **15+ characters** (password-only) | Optional Self-Service |

---

### 4. Dictionary & Common Password Blocklist

Zamorin ERP validates passwords against an **offline/local blocklist** of commonly used, compromised, and predictable credentials without making external third-party network calls at verification time.

- **Blocklist Scope**: Common weak passwords (`password123456`, `123456789012345`, `administrator123`, etc.), predictable permutations, and context-specific brand terms (`zamorincafe12345`).
- **External Breach Feeds**: `PRODUCTION_ENRICHMENT_OPTIONAL` (Enterprise deployments may asynchronously hydrate the local blocklist database via pre-vetted hashed breach corpuses).

---

### 5. Storage & Hashing Architecture

- **Algorithm**: `bcrypt` with work factor `PASSWORD_HASH_ROUNDS = 12`.
- **Memory/Computational Cost**: Standardized server-side timing (~250ms per evaluation) to neutralize brute-force attacks.
- **Salt**: Cryptographically secure 128-bit random salt automatically generated per password digest.

---

### 6. Frontend & Backend Policy Parity

- **Authoritative Validation**: The backend `authService.validatePasswordStrength()` serves as the single source of truth.
- **Frontend Alignment**: Client-side password forms (Settings, Password Change, Reset Completion) provide real-time guidance matching the authoritative 15+ length / passphrase standard with zero outdated composition requirements.
- **Login UI Freeze**: The personal login module (`frontend/src/js/pages/login.js`) remains 100% frozen with certified SHA-256 hash `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`.
