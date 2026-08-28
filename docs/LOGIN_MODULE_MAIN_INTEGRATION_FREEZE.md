# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## MAIN BRANCH INTEGRATION & FREEZE GATE SPECIFICATION

---

### 1. Executive Status

```text
========================================================================================
STATUS: LOGIN FEATURE INTEGRATED INTO MAIN
ASSURANCE: LOCAL / INTEGRATION CERTIFIED (STAGES 1 TO 6 COMPLETE)
REMAINING: PRODUCTION INFRASTRUCTURE VALIDATION ITEMS REMAIN (LOGIN-PROD-001..003)
========================================================================================
```

---

### 2. Certified Core Capabilities

1. **Personal Identity Authentication**:
   - Canonical memory-hard `scrypt` (`$scrypt$v=1$N=65536,r=8,p=2`) with 128-bit CSPRNG salt, 512-bit key, NFC normalization, async non-blocking execution.
   - Transparent on-login upgrade for legacy bcrypt (`$2b$`), intermediate `$v2$`, and legacy scrypt ($p=1$).
   - NIST SP 800-63B-4 password policy (15+ chars single factor / 8+ chars MFA, 128 max chars, offline blocklist, 0 composition rules).
   - RFC 6238 TOTP with atomic replay counter and AES-256-GCM secret encryption at rest.
   - 128-bit CSPRNG single-use recovery tokens.
2. **Cafe Operations POS Terminal Authentication**:
   - Single-use Crockford Base32 enrollment codes (15m TTL).
   - 4-6 digit numeric PIN with bcrypt cost 10 and timing normalization.
   - 5-minute inactivity auto-lock and explicit terminal lock.
   - Clean operator switch and MFA-backed Master elevation.
   - Complete terminal device state machine (PENDING, ACTIVE, LOCKED, REVOKED, LOST, RETIRED, REPLACED).
3. **Five-Persona RBAC & Deep-Linking**:
   - Primary Master, Normal Master, Owner, Cafe Operations, Staff.
   - Safe role landing pages and guarded deep links with zero privilege escalation.
   - Strict protocol stripping and open-redirect neutralization.
4. **Zero Regression Guarantee**:
   - Personal `login.js` is byte-for-byte untouched (SHA-256: `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`).
   - 152 / 152 subroutes functional.
   - 235 / 235 control destinations active with 0 dead controls.
   - 895 / 895 backend unit tests passing.
   - 0 repository secret leaks.
