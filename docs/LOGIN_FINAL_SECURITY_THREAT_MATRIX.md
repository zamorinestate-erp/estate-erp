# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## FINAL SECURITY THREAT & MITIGATION MATRIX

---

| Threat ID | Threat Description | Architectural Mitigation Control | Verification Test ID | Audit Result | Residual Risk |
|---|---|---|---|---|---|
| **THREAT-01** | **Credential Stuffing / Brute Force** | Rate limiting, bcrypt work factor 12, offline common password blocklist | `audit_login_stage5_identity_recovery.mjs` | **PASS** | LOW (Requires distributed IP pool; multi-instance Redis limitation logged) |
| **THREAT-02** | **Account Enumeration** | Constant-time response payloads for known/unknown/disabled accounts | `audit_login_stage5_identity_recovery.mjs` | **PASS** | NEGLIGIBLE |
| **THREAT-03** | **Session Fixation** | Complete session ID regeneration upon successful authentication | `audit_login_stage4_device_session_lifecycle.mjs` | **PASS** | ZERO |
| **THREAT-04** | **Session Hijacking / Theft** | HttpOnly, Secure, SameSite=Strict cookies + Device ID binding | `audit_login_stage4_browser_lifecycle.mjs` | **PASS** | LOW (Physical terminal compromise mitigated via lock) |
| **THREAT-05** | **Cross-Site Request Forgery (CSRF)** | SameSite=Strict cookie policy + Origin / Referer header verification | `audit_login_stage3_backend_security.mjs` | **PASS** | ZERO |
| **THREAT-06** | **Cross-Site Scripting (XSS)** | CSP, HTML output escaping, framework-level DOM sanitization | `audit_stage2_foundation.mjs` | **PASS** | LOW |
| **THREAT-07** | **Open Redirect Vulnerability** | Regex URI whitelist, external/protocol-relative URL stripping | `audit_login_stage5_persona_handoff.mjs` | **PASS** | ZERO |
| **THREAT-08** | **Insecure Direct Object Reference (IDOR)** | Mongoose organization & user ownership filters on every mutation | `audit_login_stage4_device_session_lifecycle.mjs` | **PASS** | ZERO |
| **THREAT-09** | **Cross-Café Scope Breach** | `effectiveCafeId` enforced strictly from authenticated device/session | `audit_login_stage3_backend_security.mjs` | **PASS** | ZERO |
| **THREAT-10** | **Cross-Organisation Data Leak** | Multitenancy isolation via mandatory `organisationId` query filter | `audit_cache_security_and_dedup.mjs` | **PASS** | ZERO |
| **THREAT-11** | **MFA Bypass** | Server-enforced intermediate challenge token; password alone cannot disable MFA | `audit_login_stage3_backend_security.mjs` | **PASS** | ZERO |
| **THREAT-12** | **Password Reset Token Replay** | Single-use status transition (`CONSUMED`) + HMAC digest validation | `audit_login_stage5_identity_recovery.mjs` | **PASS** | ZERO |
| **THREAT-13** | **Recovery Code Replay** | Consumed code hash removed atomically from valid set upon use | `audit_login_stage5_identity_recovery.mjs` | **PASS** | ZERO |
| **THREAT-14** | **Device Identity Spoofing** | Cryptographic enrollment token exchange + server-side device trust DB | `audit_login_stage4_device_session_lifecycle.mjs` | **PASS** | ZERO |
| **THREAT-15** | **Revoked Device Sign-in** | Hardware status checked before credential evaluation (fails fast with 403) | `audit_login_stage4_device_session_lifecycle.mjs` | **PASS** | ZERO |
| **THREAT-16** | **Stale Role Privilege Escalation** | `permissionsVersion` check invalidates stale session tokens on next request | `audit_login_stage5_identity_recovery.mjs` | **PASS** | ZERO |
| **THREAT-17** | **Offline Auth Replay / Walk-away** | 5-minute inactivity lock + server-authoritative time checks | `audit_login_stage4_browser_lifecycle.mjs` | **PASS** | LOW (Requires physical operator discipline) |
| **THREAT-18** | **Lost Device Compromise** | Emergency Lost Device workflow immediately revokes device and active sessions | `audit_login_stage4_device_session_lifecycle.mjs` | **PASS** | ZERO |
