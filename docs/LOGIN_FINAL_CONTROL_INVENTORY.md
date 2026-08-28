# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## FINAL LOGIN CONTROL INVENTORY & VERIFICATION RECORD

---

| Page / Component | UI Control Description | Authority Level | Backend Endpoint | Postcondition / State Change | Test ID | Verification Result |
|---|---|---|---|---|---|---|
| **Personal Login** | Email + Password Submit | Public / Credentialed | `POST /api/v1/auth/login` | Issues session cookies / MFA challenge | `STG5-BROWSER-01` | **PASS** |
| **Personal Login** | MFA Code Submit | Challenge Token | `POST /api/v1/auth/mfa/challenge/verify` | Completes authentication -> `#dashboard` | `STG5-BROWSER-03` | **PASS** |
| **Forgot Password** | Request Reset Code | Public | `POST /api/v1/auth/password/forgot` | Creates 6-digit challenge (15m TTL) | `STG5-REC-01` | **PASS** |
| **Verify Code** | Submit 6-digit Code | Public | `POST /api/v1/auth/password/reset/verify` | Returns 48-byte Base64URL reset token | `STG5-REC-04` | **PASS** |
| **Complete Reset** | Submit New Password | Reset Token | `POST /api/v1/auth/password/reset` | Updates hash, revokes prior sessions | `STG5-REC-10` | **PASS** |
| **Password Change** | Current + New Password | Authenticated User | `POST /api/v1/auth/password/change` | Updates hash, retains current session | `STG5-REC-13` | **PASS** |
| **MFA Setup** | Generate TOTP Secret | Authenticated User | `POST /api/v1/auth/mfa/setup` | Returns encrypted secret & QR URI | `STG5-REC-15` | **PASS** |
| **MFA Confirm** | Verify TOTP & Activate | Authenticated User | `POST /api/v1/auth/mfa/confirm` | Sets `mfaEnabled=true`, generates 10 codes | `STG5-REC-16` | **PASS** |
| **Recovery Codes** | Regenerate 10 Codes | Authenticated User | `POST /api/v1/auth/mfa/recovery-codes/regenerate` | Overwrites active recovery set | `STG5-REC-22` | **PASS** |
| **Sessions View** | List Active Sessions | Authenticated User | `GET /api/v1/auth/sessions` | Returns sanitized device session metadata | `STG5-REC-26` | **PASS** |
| **Session Revoke** | Terminate Specific Session | Authenticated User | `POST /api/v1/auth/sessions/revoke` | Marks target session `REVOKED` | `STG5-REC-27` | **PASS** |
| **Logout Everywhere** | Terminate All Sessions | Authenticated User | `POST /api/v1/auth/logout-everywhere` | Increments `user.sessionVersion` | `STG5-REC-28` | **PASS** |
| **Terminal Welcome** | Device Status Badge | Terminal Context | `GET /api/v1/cafe-ops/device/trust` | Displays trust status & café name | `STG4-BROWSER-01` | **PASS** |
| **Operator PIN** | 4-6 Digit Numeric Pad | Trusted Terminal | `POST /api/v1/cafe-ops/auth/operator/signin` | Creates active `CafeOpsSession` | `STG4-LIFECYCLE-04` | **PASS** |
| **Terminal Lock** | Lock POS Terminal | Active Operator | `POST /api/v1/cafe-ops/auth/operator/lock` | Sets session status `LOCKED`, hides DOM | `STG4-LIFECYCLE-09` | **PASS** |
| **Terminal Unlock** | PIN Entry Modal | Locked Operator | `POST /api/v1/cafe-ops/auth/operator/unlock` | Restores session status `ACTIVE` | `STG4-LIFECYCLE-07` | **PASS** |
| **Operator Switch** | Switch Operator Modal | Active Operator | `POST /api/v1/cafe-ops/auth/operator/switch` | Re-attributes terminal to new operator | `STG4-LIFECYCLE-10` | **PASS** |
| **Master Elevation** | Master Auth on Terminal | Primary/Master | `POST /api/v1/cafe-ops/auth/master/elevate` | Elevates terminal session with MFA | `STG4-LIFECYCLE-12` | **PASS** |
| **Device Enroll** | Enter Crockford Code | Primary Master Auth | `POST /api/v1/cafe-ops/device/enroll` | Binds hardware, marks code `CONSUMED` | `STG4-LIFECYCLE-02` | **PASS** |
| **Device Lost** | Mark Lost & Revoke | Master Governance | `POST /api/v1/cafe-ops/device/lost` | Sets `status=LOST`, terminates sessions | `STG4-LIFECYCLE-24` | **PASS** |
