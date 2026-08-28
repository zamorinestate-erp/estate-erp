# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — PASSWORD POLICY GOVERNANCE & AUTHORITY RECORD

---

### 1. Authoritative Policy Summary

The authoritative password policy for Zamorin Café ERP is defined and enforced by `backend/src/services/authService.js` in accordance with **NIST SP 800-63B-4** digital identity guidelines.

```text
Policy Version:          v2.0 (NIST SP 800-63B-4 Aligned)
Effective Date:          2026-08-28
Authoritative Enforcer:  backend/src/services/authService.js (validatePasswordStrength)
```

---

### 2. Current Policy vs Superseded Policy

| Dimension | Superseded Policy (v1.0) | Current Authoritative Policy (v2.0) | Reason for Change |
|---|---|---|---|
| **Single-Factor Min Length** | 12 characters | **15 characters** | NIST SP 800-63B-4 single-factor baseline |
| **MFA-Enforced Min Length** | 12 characters | **8 characters** | NIST SP 800-63B-4 multi-factor baseline |
| **Maximum Length** | 128 characters | **128 characters** (no truncation) | Buffer overflow / denial of service prevention |
| **Composition Rules** | Mandatory upper, lower, digit, symbol | **0 mandatory composition rules** | Outdated composition encourages weak mnemonics |
| **Passphrases & Spaces** | Rejected if missing symbol/number | **Fully supported** with spaces & Unicode | Passphrases maximize entropy & usability |
| **Compromised Passwords** | Basic regex | **Offline common password blocklist** | Neutralizes credential stuffing & common passwords |
| **Repetitive Strings** | None | **Single-character repetition rejected** | Blocks trivial passwords (`aaaaaaaa...`) |
| **Periodic Expiration** | Arbitrary periodic rotation | **0 arbitrary periodic expiration** | Prevents incremental substitutions |

---

### 3. Server-Side vs Client-Side Enforcement

- **Server-Side (`backend/src/services/authService.js`)**: Single source of truth. Validates all password mutations (registration, password reset completion, authenticated password change) against length, blocklist, and repetition checks before executing bcrypt hashing (12 rounds).
- **Client-Side Form Alignment**: Real-time client helpers guide users to choose strong passphrases (>= 15 characters, or >= 8 characters with MFA) without enforcing artificial composition constraints.
- **Personal Login Freeze**: Personal login UI (`frontend/src/js/pages/login.js`) remains frozen at SHA-256 `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`.

---

### 4. Persona Authentication & MFA Requirements

| Persona | Role | Authentication Baseline | MFA Requirement |
|---|---|---|---|
| **Primary Master** | `master` (`isPrimaryMaster: true`) | 8+ chars (15+ recommended) | **MANDATORY** |
| **Normal Master** | `master` (`isPrimaryMaster: false`) | 8+ chars (15+ recommended) | **MANDATORY** |
| **Owner** | `owner` | 8+ chars (15+ recommended) | **MANDATORY** |
| **Cafe Operations** | `cafe_admin` | 8+ chars / Device PIN | **MANDATORY** (or Trusted Device PIN) |
| **Staff Member** | `staff` | **15+ characters** (password-only) | Optional Self-Service |
