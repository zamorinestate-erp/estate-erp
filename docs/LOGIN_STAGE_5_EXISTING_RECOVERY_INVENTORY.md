# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — EXISTING RECOVERY & IDENTITY LIFECYCLE INVENTORY

---

### 1. Authoritative Backend Services & Models

| Capability | Canonical Backend Service | Associated Model(s) | Key Methods / Invariants |
|---|---|---|---|
| **Password Reset Challenge** | `backend/src/services/passwordResetService.js` | `PasswordResetChallenge.js` | `createPasswordResetChallenge`, `verifyPasswordResetCode`, `verifyPasswordResetToken` |
| **Password Reset Delivery** | `backend/src/services/passwordResetDeliveryService.js` | `Notification.js` | `deliverPasswordResetCode` (Console provider locally; queue adapter) |
| **Password Policy & Hashing** | `backend/src/services/authService.js` | `User.js` | `validatePasswordStrength`, `hashPassword`, `verifyPassword`, bcrypt (12 rounds) |
| **Password Change & Reauth** | `backend/src/services/authService.js` | `User.js`, `Session.js` | `changePassword` (current password verify, session revocation policy) |
| **MFA & TOTP Operations** | `backend/src/services/mfaService.js` | `User.js` | `generateTotpSecret`, `verifyTotpCode`, `encryptMfaSecret`, `decryptMfaSecret` |
| **Recovery Codes** | `backend/src/services/mfaService.js` | `User.js` | `generateRecoveryCodes`, `hashRecoveryCode`, 10 codes, SHA-256 digests |
| **Session Control & Revocation** | `backend/src/services/authService.js` | `Session.js` | `createSession`, `revokeSession`, `revokeAllUserSessions`, `rotateRefreshToken` |
| **Security Audit Logging** | `backend/src/services/auditService.js` | `AuditEvent.js` | Immutable append-only audit trail; 0 secrets logged |
| **User Governance & Status** | `backend/src/services/userGovernanceService.js` | `User.js` | `updateUserRole`, `updateUserStatus` (increments permissionsVersion & sessionVersion) |

---

### 2. Canonical API Endpoints (`backend/src/routes/authRoutes.js`)

| Endpoint | HTTP Method | Access Level | Rate Limit | Purpose |
|---|---|---|---|---|
| `/api/v1/auth/password/forgot` | `POST` | Public | 5 req / 15m | Request password recovery code (Generic response) |
| `/api/v1/auth/password/reset/verify` | `POST` | Public | 5 req / 15m | Verify 6-digit code, issue short-lived Base64URL reset token |
| `/api/v1/auth/password/reset` | `POST` | Public | 5 req / 15m | Complete password reset, update hash, revoke sessions |
| `/api/v1/auth/password/change` | `POST` | Authenticated | Standard | Authenticated password change with reauthentication |
| `/api/v1/auth/mfa/setup` | `POST` | Public / Flow | 15 req / 15m | Generate TOTP secret & QR code during setup flow |
| `/api/v1/auth/mfa/confirm` | `POST` | Public / Flow | 15 req / 15m | Confirm TOTP code and enable MFA on user record |
| `/api/v1/auth/mfa/verify` | `POST` | Public / Flow | 15 req / 15m | Validate TOTP code or single-use recovery code |
| `/api/v1/auth/mfa/status` | `GET` | Authenticated | Standard | Retrieve MFA enabled status & recovery code count |
| `/api/v1/auth/mfa/recovery-codes/regenerate` | `POST` | Authenticated | 15 req / 15m | Issue fresh recovery codes, invalidating prior set |
| `/api/v1/auth/me` | `GET` | Authenticated | Standard | Authoritative user identity & permissions bootstrap |
| `/api/v1/auth/logout` | `POST` | Authenticated | Standard | Revoke active session & clear authentication cookies |
| `/api/v1/auth/logout-all` | `POST` | Authenticated | Standard | Invalidate all sessions for the authenticated user |
| `/api/v1/auth/sessions` | `GET` | Authenticated | Standard | List active user sessions with safe device metadata |
| `/api/v1/auth/sessions/:sessionId` | `DELETE` | Authenticated | Standard | Terminate specific session by ID (IDOR-guarded) |

---

### 3. Frontend Recovery Components (`frontend/src/js/pages/login.js`)

| Screen / Component | Render Function | Wiring Function | Target Flow |
|---|---|---|---|
| **Screen 1: Request** | `renderPasswordResetRequest` | `wirePasswordResetRequest` | Capture Org ID & corporate email address |
| **Screen 2: Verify Code** | `renderPasswordResetVerify` | `wirePasswordResetVerify` | Capture 6-digit recovery code |
| **Screen 3: New Password** | `renderPasswordResetComplete` | `wirePasswordResetComplete` | Capture & confirm new password |
| **MFA Challenge Modal** | `renderMfaChallenge` | `wireMfaChallenge` | Capture TOTP or backup recovery code |
| **Devices & Sessions** | `renderSettingsDevices` | `wireSettingsDevices` | `#settings/devices` workspace for sessions |
| **Account Recovery UI** | `renderSettingsRecovery` | `wireSettingsRecovery` | `#settings/recovery` workspace for emergency |

---

### 4. Single Canonical Authority Invariant
The Café Operations terminal subsystem links to these canonical personal recovery endpoints for Master credential management and never maintains a shadow or parallel recovery database.
