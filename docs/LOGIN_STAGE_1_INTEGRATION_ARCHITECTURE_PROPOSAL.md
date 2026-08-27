# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# INTEGRATION ARCHITECTURE PROPOSAL & FUTURE STAGES PLAN

**Proposal Date:** 2026-08-28  
**Target Integration Branch:** `feature/login-integration`  
**Baseline Commit:** `643c386f0a82684045c480cd9a80b9be6b5a3a6d`  

---

## 1. Core Integration Architectural Principle

The integration follows a strict **additive, non-destructive architecture**. Zero existing certified authentication or personal login code will be replaced. The Claude module will be integrated as a dedicated **Cafe Operations Shared Terminal Subsystem**, wired directly into Zamorin's authoritative backend services:

```
[Shared Terminal Hardware: Tablet / POS]
                  │
                  ▼
[Cafe Operations Entry Point: cafe-operations.html]
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 [Operator PIN Path]  [Master Strong Auth Path]
        │                   │
        │                   │ (Calls masterAuthAdapter)
        │                   ▼
        │        [authService.authenticatePassword + mfaService]
        │                   │
        ▼                   ▼
 [cafeOpsAuthRoutes -> /api/cafe-ops/operator/*]
                  │
                  ▼
 [cafeOpsSessionService (Unified Terminal Lifecycle)]
                  │
                  ▼
 [Zamorin Mongoose DB: User, Cafe, DeviceRegistration, CafeOpsSession]
                  │
                  ▼
 [Strict Terminal Scope: effectiveCafeId = device.cafeId]
                  │
                  ▼
 [Cafe Operations Interactive Operational Shell]
```

---

## 2. Integration Seam Closures

### Seam 1: Model Registration (`backend/src/config/integrationRefs.js`)
- `EMPLOYEE_MODEL_NAME = 'User'` (Binds to Zamorin's canonical `User` collection).
- `CAFE_MODEL_NAME = 'Cafe'` (Binds to Zamorin's canonical `Cafe` collection).

### Seam 2: Master Auth Adapter (`backend/src/services/masterAuthAdapter.js`)
- `identify(email, password)` -> Invokes `authService.authenticatePassword({ organisationId: 'ZAMORIN', email, password })`.
- `completeMfa(mfaChallengeToken, code)` -> Invokes `mfaService.verifyTotpCode(secret, code)`.
- `reauth(userId, password)` -> Invokes `authService.verifyPassword(password, user.passwordHash)`.

### Seam 3: Governance RBAC Middleware (`backend/src/middleware/requireGovernanceRole.js`)
- Replaces placeholder with Zamorin's canonical `authorize('USER:MANAGE', { allowedRoles: ['MASTER', 'OWNER'] })`.

---

## 3. Proposed Future Integration Stages Plan

### STAGE 2: Additive Frontend Placement & Design System Binding
1. Place frontend files in `frontend/cafe-operations/` or root `frontend/cafe-operations.html`.
2. Delete bundled `frontend/css/components.base.css` and repoint stylesheet link to Zamorin's canonical `components.css`.
3. Verify zero modifications to `frontend/src/js/pages/login.js` and `frontend/index.html` via `git diff`.

### STAGE 3: Additive Backend Placement & Router Mounting
1. Place backend files under `backend/src/modules/cafe-operations/`.
2. Wire the 3 integration seams (`integrationRefs.js`, `masterAuthAdapter.js`, `requireGovernanceRole.js`).
3. Mount the router under `/api/cafe-ops` in `backend/src/routes/index.js`.
4. Run `npm test` inside `backend/` to verify **64/64 tests pass**.

### STAGE 4: Device Trust, Hardware Binding & Inactivity Policy
1. Wire `deviceContext` and `DeviceRegistration` collection for Crockford base32 15-minute enrollment.
2. Verify hardware inactivity lock (5-minute timer, 30-second warning, lazy server-side lock).
3. Validate rate limiting (independent PIN guessing lockout vs Master lockout).

### STAGE 5: Terminal Operations Shell & Multi-Persona Scope Enforcement
1. Verify `CAFE_ADMIN` operator session isolation to assigned cafe.
2. Verify `MASTER` strong-auth terminal session scoped strictly to `device.cafeId`.
3. Verify bidirectional operator switching (`SWITCH_OPERATOR` reason, clean session end, fresh token).
4. Verify remote session termination by governance roles.

### STAGE 6: Full System Test, Security Verification & Main FF-Merge
1. Execute 64/64 Cafe Operations backend tests.
2. Execute 831/831 canonical Zamorin backend tests (Total: 895 tests).
3. Execute 36/36 Five-Persona functional audit.
4. Execute 149/149 Subroutes zero-error audit.
5. Execute 11/11 Cache Security & Dedup audit.
6. Execute 15/15 Zero-Dead-Controls suites.
7. Verify `git diff -- frontend/src/js/pages/login.js` is **100% EMPTY**.
8. Fast-forward merge `feature/login-integration` into `main`.

---

## 4. Final Conclusion & Recommendation

The proposed integration architecture is **100% additive, secure, and robust**. It guarantees that personal login remains pristine while cleanly introducing the dedicated Cafe Operations shared-terminal capabilities.
