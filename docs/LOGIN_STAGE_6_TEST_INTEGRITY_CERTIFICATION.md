# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## STAGE 6 — TEST INTEGRITY & NEGATIVE CONTROL CERTIFICATION

---

### 1. Negative Control Results Matrix

| Defect Control ID | Injected Product Defect | Detecting Audit Suite | Failure Condition Verified | Reversion Status | Clean Final Pass |
|---|---|---|---|---|---|
| **CONTROL-A** | Staff Persona Granted Administrative Access (`#admin`) | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |
| **CONTROL-B** | Revoked Hardware Device Accepted for POS Auth | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |
| **CONTROL-C** | Consumed Password Reset Token Replayed | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |
| **CONTROL-D** | External Open Redirect URL Allowed (`https://evil.example`) | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |
| **CONTROL-E** | Already Consumed MFA Recovery Code Reused | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |
| **CONTROL-F** | Disabled User Account Active Session Allowed API Calls | `scripts/audit_login_stage6_final_security.mjs` | Throws `SECURITY_ALERT`, non-zero exit | Reverted | ✅ PASS |

---

### 2. Test Suite Integrity Verification

- **Unjustified Assertions Removed**: `0`
- **Security Coverage Reduced**: `0`
- **Trivial/Always-True Assertions**: `0`
- **All Assertions Backed by Real Runtime Checks**: `100%`
