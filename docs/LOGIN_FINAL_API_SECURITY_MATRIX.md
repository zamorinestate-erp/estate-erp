# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## FINAL API SECURITY & ENDPOINT MATRIX

---

| HTTP Method | API Path | Auth Scope | Rate Limit | Origin / CSRF | Input Validation | Audit Event Type | Test Reference |
|---|---|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | 10 req / 15m | Strict SameSite | Email + Password | `USER_LOGIN_SUCCESS` / `FAILED` | `auth_login.test.js` |
| `POST` | `/api/v1/auth/mfa/challenge/verify` | Challenge Token | 5 req / 15m | Strict SameSite | 6-Digit TOTP / Recovery Code | `MFA_VERIFIED` | `auth_mfa.test.js` |
| `POST` | `/api/v1/auth/password/forgot` | Public | 5 req / 1h | Strict SameSite | Normalized Email | `PASSWORD_RESET_REQUESTED` | `auth_recovery.test.js` |
| `POST` | `/api/v1/auth/password/reset/verify` | Public | 5 req / 15m | Strict SameSite | 6-Digit Code | `PASSWORD_RESET_CODE_VERIFIED` | `auth_recovery.test.js` |
| `POST` | `/api/v1/auth/password/reset` | Reset Token | 3 req / 15m | Strict SameSite | 15+ char Password | `PASSWORD_RESET_COMPLETED` | `auth_recovery.test.js` |
| `POST` | `/api/v1/auth/password/change` | Authenticated | 5 req / 15m | Strict SameSite | Current + New Password | `PASSWORD_CHANGED` | `auth_security.test.js` |
| `POST` | `/api/v1/auth/mfa/setup` | Authenticated | Standard | Strict SameSite | None | `MFA_SETUP_INITIATED` | `auth_mfa.test.js` |
| `POST` | `/api/v1/auth/mfa/confirm` | Authenticated | 5 req / 15m | Strict SameSite | 6-Digit TOTP Code | `MFA_ENABLED` | `auth_mfa.test.js` |
| `POST` | `/api/v1/auth/mfa/recovery-codes/regenerate` | Authenticated | 3 req / 1h | Strict SameSite | Re-authentication | `MFA_RECOVERY_CODES_REGENERATED`| `auth_mfa.test.js` |
| `GET` | `/api/v1/auth/sessions` | Authenticated | Standard | Read-only | None | None | `auth_session.test.js` |
| `POST` | `/api/v1/auth/sessions/revoke` | Authenticated | Standard | Strict SameSite | `sessionId` (IDOR guarded) | `SESSION_TERMINATED` | `auth_session.test.js` |
| `POST` | `/api/v1/auth/logout` | Authenticated | Standard | Strict SameSite | None | `USER_LOGOUT` | `auth_session.test.js` |
| `POST` | `/api/v1/auth/logout-everywhere` | Authenticated | Standard | Strict SameSite | None | `USER_LOGOUT_EVERYWHERE` | `auth_session.test.js` |
| `POST` | `/api/v1/cafe-ops/auth/operator/signin` | Trusted Device | 5 req / 5m | Strict SameSite | 4-6 Digit Operator PIN | `OPERATOR_SIGNIN_SUCCESS` | `cafeops_auth.test.js` |
| `POST` | `/api/v1/cafe-ops/auth/operator/lock` | Active Operator | Standard | Strict SameSite | None | `TERMINAL_LOCKED` | `cafeops_session.test.js`|
| `POST` | `/api/v1/cafe-ops/auth/operator/unlock` | Locked Operator | 5 req / 5m | Strict SameSite | 4-6 Digit Operator PIN | `TERMINAL_UNLOCKED` | `cafeops_session.test.js`|
| `POST` | `/api/v1/cafe-ops/auth/operator/switch` | Active Operator | Standard | Strict SameSite | New Operator PIN | `OPERATOR_SWITCHED` | `cafeops_session.test.js`|
| `POST` | `/api/v1/cafe-ops/auth/master/elevate` | Active Operator | 3 req / 15m | Strict SameSite | Master Password + MFA | `MASTER_ELEVATION_GRANTED` | `cafeops_auth.test.js` |
| `POST` | `/api/v1/cafe-ops/device/enroll` | Primary Master | 3 req / 1h | Strict SameSite | Crockford Base32 Code | `DEVICE_ENROLLED` | `device_trust.test.js` |
| `POST` | `/api/v1/cafe-ops/device/revoke` | Primary Master | Standard | Strict SameSite | `deviceId` | `DEVICE_REVOKED` | `device_trust.test.js` |
| `POST` | `/api/v1/cafe-ops/device/lost` | Master Governance | Standard | Strict SameSite | `deviceId` | `DEVICE_MARKED_LOST` | `device_trust.test.js` |
