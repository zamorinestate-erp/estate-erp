# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# EXISTING ZAMORIN AUTHENTICATION & SECURITY ARCHITECTURE MAP

**Audit Date:** 2026-08-28  
**Repository Branch:** `feature/login-integration`  
**Base Commit:** `643c386f0a82684045c480cd9a80b9be6b5a3a6d`  

---

## 1. End-to-End Authentication Architecture Flow

```
[Browser / Client]
        │
        ▼
[Personal Login UI: frontend/src/js/pages/login.js]
        │  POST /api/auth/login
        │  Payload: { organisationId, email, password, device: { deviceId, ... } }
        ▼
[Auth Router: backend/src/routes/authRoutes.js]
        │
        ▼
[Auth Controller: backend/src/controllers/authController.js]
        │  Calls authenticatePassword()
        ▼
[Auth Service: backend/src/services/authService.js]
        │  1. Find User by { organisationId, email }
        │  2. Verify bcrypt password hash (cost 12)
        │  3. Check account status (ACTIVE vs SUSPENDED/INACTIVE)
        │  4. Evaluate MFA requirement (MFA_REQUIRED_ROLES: ['MASTER', 'OWNER'] or user.mfaEnabled)
        ▼
   [Is MFA Required?]
      ├── YES ──► Returns 403 { code: 'MFA_REQUIRED', data: { mfaChallengeToken } }
      │           Browser displays TOTP prompt -> POST /api/auth/mfa/verify
      │           mfaService.verifyTotpCode() confirms OTP
      └── NO  ──► Continues directly to Session Creation
        │
        ▼
[Session Service: createSession() in backend/src/services/authService.js]
        │  1. Generate opaque 256-bit accessToken & refreshToken
        │  2. Generate unique sessionId (UUIDv4)
        │  3. Compute SHA-256 hashes for storage in Mongoose Session collection
        │  4. Populate Session record with userId, role, isPrimaryMaster, primaryCafeId, device
        ▼
[Set Authentication Cookies in Response]
        │  - zamorin_access_token (HttpOnly, Secure in prod, SameSite lax/none, Path: /)
        │  - zamorin_refresh_token (HttpOnly, Secure in prod, SameSite lax/none, Path: /)
        │  - zamorin_session_id (HttpOnly, Secure in prod, SameSite lax/none, Path: /)
        ▼
[Authenticated Request Pipeline]
        │  Request arrives with cookies + x-device-id header
        ▼
[authenticate Middleware: backend/src/middleware/authenticate.js]
        │  1. Extract cookies & x-device-id
        │  2. Find Session by sessionId & status === 'ACTIVE'
        │  3. Verify hash(accessToken) === session.accessTokenHash
        │  4. Verify session.device.deviceId === x-device-id
        │  5. Populate req.user = user, req.session = session
        ▼
[deviceContext Middleware: backend/src/middleware/deviceContext.js]
        │  1. Check device trust in DeviceRegistration collection
        │  2. Populate req.deviceContext with device state & assigned cafe
        ▼
[authorize Middleware: backend/src/middleware/authorize.js]
        │  1. Enforce Primary Master vs Normal Master permissions
        │  2. Enforce Owner portfolio scope & Passbook rights
        │  3. Enforce Cafe Operations single-cafe boundary
        │  4. Enforce Staff SELF_ONLY route isolation
        ▼
[Target Controller / Service Action]
```

---

## 2. Comprehensive Security & Session Contract

### 2.1 Cookie Architecture

| Cookie Name | Value Stored | HttpOnly | Secure (Production) | SameSite | Path | Max-Age / Expiry | Purpose |
|-------------|--------------|:--------:|:-------------------:|:--------:|:----:|:----------------:|---------|
| `zamorin_access_token` | Opaque 256-bit Token | **YES** | **YES** | `Lax` / `None` | `/` | 15 Minutes | Stateless API authentication |
| `zamorin_refresh_token` | Opaque 256-bit Token | **YES** | **YES** | `Lax` / `None` | `/` | 7 Days | Single-flight session rotation |
| `zamorin_session_id` | UUIDv4 Session ID | **YES** | **YES** | `Lax` / `None` | `/` | 7 Days | Session lifecycle index |

> [!IMPORTANT]
> Zero authentication tokens or session IDs are ever stored in `localStorage`, `sessionStorage`, or IndexedDB. All credentials reside strictly in HttpOnly cookies inaccessible to JavaScript.

### 2.2 Token Refresh & Single-Flight Rotation
- Endpoint: `POST /api/auth/refresh`
- Validates current `zamorin_session_id`, `zamorin_refresh_token`, and matching `x-device-id`.
- Performs **refresh token rotation**: issues new `accessToken` and `refreshToken`, invalidates old hashes in DB, and emits updated cookies.

### 2.3 Logout & Session Termination
- Endpoint: `POST /api/auth/logout` (Current Session) and `POST /api/auth/logout-all` (All User Sessions).
- Transitions DB Session record status to `REVOKED`.
- Clears all 3 authentication cookies via `response.clearCookie()`.
- Client executes `clearApiCacheAndInFlight()` purging cached queries from memory.

---

## 3. Five-Persona Authorization & Scope Matrix

| Persona | Role Key (`user.role`) | `isPrimaryMaster` | Scope Contract | Personal Ledger | Payroll | Revenue Share | Cafe Scope |
|---------|------------------------|:-----------------:|----------------|:---------------:|:-------:|:-------------:|:----------:|
| **Primary Master** | `MASTER` | `true` | Organisation-Wide All Authority | **ALLOWED** | **ALLOWED** | **ALLOWED** | All Cafes |
| **Normal Master** | `MASTER` | `false` | All Cafes except Executive Treasury | **BLOCKED** | **BLOCKED** | **BLOCKED** | All Cafes |
| **Owner** | `OWNER` | N/A | Portfolio Governance & Passbook | **ALLOWED** | Read-Only | **ALLOWED** | Assigned Portfolio |
| **Cafe Operations** | `CAFE_ADMIN` | N/A | Single Cafe Operational Terminal | **BLOCKED** | **BLOCKED** | **BLOCKED** | Single Assigned Cafe |
| **Staff** | `STAFF` | N/A | Self-Service Portal Only | **BLOCKED** | **BLOCKED** | **BLOCKED** | `SELF_ONLY` |

---

## 4. Multi-Factor Authentication (MFA) & Recovery Architecture

- **Algorithm:** RFC 6238 TOTP (SHA-1, 6 digits, 30s period).
- **Secret Storage:** AES-256-GCM encrypted in `User.mfaSecretEncrypted`.
- **Mandatory Enforcement:** `MFA_REQUIRED_ROLES` (`['MASTER', 'OWNER']`).
- **Recovery Codes:** 8 single-use 10-character codes, stored as bcrypt hashes in `User.recoveryCodesHashed`.
- **Password Reset:** 6-digit numerical challenge expiring in 15 minutes, single-use, rate-limited to 5 requests per 15 minutes per IP.
