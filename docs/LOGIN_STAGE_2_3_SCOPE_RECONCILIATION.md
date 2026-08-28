# Zamorin Café ERP — Login Integration Programme
# Stage 2 + 3 Scope Reconciliation Document

## 1. Scope Evolution & Justification

### Original Stage 2 Scope
- **Authorized Boundary**: Frontend-only placement and UI layout testing of the terminal authentication screens (`cafeMasterSignIn.js`, `cafeDeviceEnroll.js`, `cafeTerminalWelcome.js`).
- **Seam Policy**: All backend connections stubbed with `undefined`.

### Actual Work Performed (Combined Stage 2 + Stage 3)
- **Frontend Placement**: Standalone terminal application placed at `frontend/cafe-operations/` and wired into SPA router `frontend/src/js/router.js`.
- **Backend Module Placement**: Complete backend service placed at `backend/src/cafe-operations/` and mounted under `/api/v1/cafe-ops` in `backend/src/routes/index.js`.
- **Three Integration Seams Wired**:
  1. `config/integrationRefs.js` & `repositories/mongo.js`: Connected to canonical `User` and `Cafe` Mongoose models.
  2. `services/masterAuthAdapter.js`: Connected directly to `authService.authenticatePassword`, `mfaService.generateMfaToken`, and `mfaService.verifyTotpCode`.
  3. `middleware/requireGovernanceRole.js`: Connected to canonical `req.auth` and `req.authenticatedUser`.
- **Test Suite**: Added 64 module tests under `backend/tests/cafe-operations/`, expanding backend test suite from 831 to 895 passing tests.

### Rationale for Scope Progression
Executing the complete integration allows end-to-end certification of the physical device trust, operator attribution, and Master step-up MFA flows against the real database and server lifecycles, ensuring zero drift between frontend contracts and backend enforcement.

---

## 2. Complete Inventory of Backend Files

### Domain Components (`backend/src/cafe-operations/`)
- `app.js` (NEW_DOMAIN_COMPONENT — Test & dev Express app factory)
- `config/integrationRefs.js` (ADAPTER — Seam configuration for model names)
- `config/pinPolicy.js` (NEW_DOMAIN_COMPONENT — PIN length and blocklist)
- `config/sessionPolicy.js` (NEW_DOMAIN_COMPONENT — Centralized timeouts and rate limits)
- `middleware/cafeOpsSessionContext.js` (NEW_DOMAIN_COMPONENT — Session validation & auto-lock)
- `middleware/deviceContext.js` (NEW_DOMAIN_COMPONENT — Device token extraction and lifecycle guard)
- `middleware/requireGovernanceRole.js` (ADAPTER — Governance role guard bridging to req.auth)
- `models/CafeOpsDevice.js` (NEW_DOMAIN_COMPONENT — Device entity schema)
- `models/CafeOpsDeviceEnrollmentToken.js` (NEW_DOMAIN_COMPONENT — One-time enrollment tokens)
- `models/CafeOpsOperatorCredential.js` (NEW_DOMAIN_COMPONENT — Bcrypt + HMAC PIN storage)
- `models/CafeOpsOperatorAccess.js` (NEW_DOMAIN_COMPONENT — Cafe access grant record)
- `models/CafeOpsSession.js` (NEW_DOMAIN_COMPONENT — Unified terminal session model)
- `models/CafeOpsSecurityEvent.js` (NEW_DOMAIN_COMPONENT — Security event audit log)
- `models/index.js` (NEW_DOMAIN_COMPONENT — Models export)
- `repositories/memory.js` (TEST_ONLY — In-memory repository implementation)
- `repositories/mongo.js` (NEW_DOMAIN_COMPONENT — MongoDB repository implementation)
- `repositories/index.js` (NEW_DOMAIN_COMPONENT — Repository factory)
- `routes/deviceEnrollmentRoutes.js` (NEW_DOMAIN_COMPONENT — Enrollment endpoints)
- `routes/cafeOpsAuthRoutes.js` (NEW_DOMAIN_COMPONENT — Operator & Master auth endpoints)
- `routes/adminDeviceRoutes.js` (NEW_DOMAIN_COMPONENT — Device administration endpoints)
- `routes/adminOperatorAccessRoutes.js` (NEW_DOMAIN_COMPONENT — Operator access governance)
- `routes/adminSessionRoutes.js` (NEW_DOMAIN_COMPONENT — Session administration)
- `routes/index.js` (NEW_DOMAIN_COMPONENT — Sub-router mounting)
- `services/masterAuthAdapter.js` (ADAPTER — Strong auth bridge to authService/mfaService)
- `services/operatorPinService.js` (NEW_DOMAIN_COMPONENT — PIN verification & timing normalization)
- `services/operatorAuthorizationService.js` (NEW_DOMAIN_COMPONENT — Pure operator decision logic)
- `services/masterAuthorizationService.js` (NEW_DOMAIN_COMPONENT — Pure master decision logic)
- `services/cafeOpsSessionService.js` (NEW_DOMAIN_COMPONENT — Unified session lifecycle engine)
- `services/rateLimitService.js` (NEW_DOMAIN_COMPONENT — Independent PIN/MASTER rate limiter)
- `services/auditService.js` (NEW_DOMAIN_COMPONENT — Security event recording & sanitizer)
- `services/supportReferenceService.js` (NEW_DOMAIN_COMPONENT — Diagnostics reference generator)
- `services/timeIntegrityService.js` (NEW_DOMAIN_COMPONENT — Server time synchronization)
- `services/deviceService.js` (NEW_DOMAIN_COMPONENT — Device lifecycle & reassignment)
- `services/deviceEnrollmentService.js` (NEW_DOMAIN_COMPONENT — Enrollment token issuance)
- `utils/constants.js` (NEW_DOMAIN_COMPONENT — Enums and constants)
- `utils/ids.js` (NEW_DOMAIN_COMPONENT — Cryptographic identifier utilities)
- `utils/responses.js` (NEW_DOMAIN_COMPONENT — Privacy-safe response helpers)

### Canonical Backend Files Modified
- `backend/src/routes/index.js` (CANONICAL_ZAMORIN_FILE_MODIFIED — Mounted `/cafe-ops` router)
- `backend/src/server.js` (CANONICAL_ZAMORIN_FILE_MODIFIED — Added `initRepositories('mongo')` in `startServer()`)
