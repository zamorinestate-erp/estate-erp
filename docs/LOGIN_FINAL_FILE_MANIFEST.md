# ZAMORIN CAFÉ ERP
## LOGIN MODULE INTEGRATION PROGRAMME
## FINAL FILE CLASSIFICATION & DELTA MANIFEST

---

| File Path | Classification | Role in Login Ecosystem | Status |
|---|---|---|---|
| `backend/src/models/User.js` | MODEL | User credentials, roles, MFA secret, recovery codes, versions | RUNTIME_CORE |
| `backend/src/models/Session.js` | MODEL | Personal JWT sessions, device binding, refresh token hashes | RUNTIME_CORE |
| `backend/src/models/OperatorSession.js` | MODEL | POS till operator sessions, lock status, activity timers | RUNTIME_CORE |
| `backend/src/models/DeviceRegistration.js` | MODEL | Enrolled terminal hardware, trust state, cafeId binding | RUNTIME_CORE |
| `backend/src/models/PasswordResetChallenge.js`| MODEL | 6-digit codes, HMAC tokens, attempt tracking, TTLs | RUNTIME_CORE |
| `backend/src/models/AuditEvent.js` | MODEL | Write-only immutable audit logging with 0 secret leaks | RUNTIME_CORE |
| `backend/src/services/authService.js` | SERVICE | Password hashing (bcrypt), strength, session management | RUNTIME_CORE |
| `backend/src/services/mfaService.js` | SERVICE | AES-256-GCM secret encryption, TOTP, 128-bit recovery codes | RUNTIME_CORE |
| `backend/src/services/passwordResetService.js`| SERVICE | Forgot password, challenge verification, reset execution | RUNTIME_CORE |
| `backend/src/services/operatorSessionService.js`| SERVICE | POS till sign-in, lock/unlock, switch, master elevation | RUNTIME_CORE |
| `backend/src/services/deviceTrustService.js` | SERVICE | Crockford Base32 token enrollment, revocation, lifecycle | RUNTIME_CORE |
| `backend/src/controllers/authController.js` | CONTROLLER | Express route handlers for authentication & recovery | RUNTIME_CORE |
| `backend/src/controllers/deviceController.js` | CONTROLLER | Express route handlers for POS terminal operations | RUNTIME_CORE |
| `backend/src/routes/authRoutes.js` | ROUTE | API routing for `/api/v1/auth/*` | RUNTIME_CORE |
| `backend/src/routes/deviceRoutes.js` | ROUTE | API routing for `/api/v1/cafe-ops/*` | RUNTIME_CORE |
| `frontend/src/js/pages/login.js` | RUNTIME_UI | Frozen personal login page (SHA-256 untouched) | FROZEN_CORE |
| `frontend/src/js/navigation.js` | RUNTIME_UI | Five-persona route definitions & RBAC permissions | RUNTIME_CORE |
| `scripts/audit_login_stage*.mjs` | AUDIT_TEST | Stage 2–6 validation suites & negative controls | TEST_HARNESS |
| `docs/LOGIN_*.md` | DOCUMENTATION | Architecture records, threat matrix, policy authority | GOVERNANCE |
