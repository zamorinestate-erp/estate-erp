# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# CLAUDE LOGIN PACKAGE INVENTORY

**Discovery Date:** 2026-08-28  
**Package Path:** `d:/Zamorin_Cafe_ERP_Build/files/Login/`  
**Target Integration Branch:** `feature/login-integration`  
**Baseline Commit:** `643c386f0a82684045c480cd9a80b9be6b5a3a6d`  

---

## 1. Top-Level Package File Inventory

The Claude Login package supplied in `files/Login/` contains exactly 5 files:

| # | Filename | Extension | Size (Bytes) | Category | Runtime Role | Intended to Replace Existing Zamorin File? |
|---|----------|-----------|--------------|----------|--------------|---------------------------------------------|
| 1 | `ANTIGRAVITY_INTEGRATION_PROMPT.md` | `.md` | 17,546 | Documentation / Integration Guide | Authoritative instructions for Antigravity AI agent detailing non-negotiable boundaries, integration sequence, and seam contracts. | **NO** (Integration specification & guidelines). |
| 2 | `ARCHITECTURE_DECISIONS.md` | `.md` | 14,677 | Documentation / Architecture Rationales | Comprehensive rationale explaining why decisions were made (e.g. 1 unified session engine, PIN security, Master password/MFA, defaults). | **NO** (Reference documentation). |
| 3 | `IMPLEMENTATION_REPORT.md` | `.md` | 11,941 | Documentation / Evidence Report | Specification verification evidence, test matrices, and remaining gaps list from the standalone module build. | **NO** (Reference documentation). |
| 4 | `PROJECT_FILE_MANIFEST.md` | `.md` | 11,457 | Documentation / File Manifest | File map cataloging every source file bundled inside `zamorin-cafe-operations-v2.zip`. | **NO** (Reference documentation). |
| 5 | `zamorin-cafe-operations-v2.zip` | `.zip` | 168,761 | Archive (Codebase & Assets) | Contains standalone `backend/` (Express, Mongoose, 64/64 passing tests) and `frontend/` (Vanilla JS, CSS, SVG assets) implementation for Cafe Operations Trusted Device Login. | **NO** (New additive module / Cafe Operations terminal subsystem). |

---

## 2. Uncompressed Zip Contents Detailed Inventory

Inside `zamorin-cafe-operations-v2.zip`, the codebase is structured cleanly into `backend/` and `frontend/`:

### 2.1 Backend Codebase (`backend/`)

| File Path | Purpose | Dependencies / Imports | Exports | Runtime Role | Replacement Target? |
|-----------|---------|------------------------|---------|--------------|---------------------|
| `backend/package.json` | Manifest & script definitions | `express`, `mongoose`, `bcryptjs` | N/A | Dependency configuration | NO |
| `backend/server-standalone.js` | Local standalone dev server entry | `express`, `app.js`, `repositories` | Server listener | Standalone test runner entry | NO |
| `backend/README_INTEGRATION.md` | Backend integration guide | N/A | N/A | Integration documentation | NO |
| `backend/src/app.js` | Express application factory | `express`, routes | `createApp()` | App instance creator | NO |
| `backend/src/config/sessionPolicy.js` | Centralized timeout & policy constants | None | Inactivity, lifetime, lockout constants | Configuration token provider | NO |
| `backend/src/config/pinPolicy.js` | PIN length and blocklist rules | None | PIN rules & weak list | Policy provider | NO |
| `backend/src/config/integrationRefs.js` | Model name registry (**Seam 1**) | None | `EMPLOYEE_MODEL_NAME`, `CAFE_MODEL_NAME` | Model lookup pointer | NO |
| `backend/src/utils/constants.js` | Domain enums & event types | None | Session types, statuses, denial reasons | Constants definition | NO |
| `backend/src/utils/ids.js` | Cryptographic ID & hash utilities | `node:crypto` | ID generators, SHA-256 hashers | Helper utility | NO |
| `backend/src/utils/responses.js` | Standard privacy-preserving HTTP envelopes | None | `{ success, data, error }` response helpers | Response envelope standardizer | NO |
| `backend/src/models/CafeOpsDevice.js` | Trusted device model | `mongoose` | `CafeOpsDevice` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/CafeOpsDeviceEnrollmentToken.js` | Enrollment code model | `mongoose` | `CafeOpsDeviceEnrollmentToken` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/CafeOpsOperatorCredential.js` | Operator PIN credential model | `mongoose` | `CafeOpsOperatorCredential` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/CafeOpsOperatorAccess.js` | Cafe-operator authorization grant model | `mongoose` | `CafeOpsOperatorAccess` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/CafeOpsSession.js` | Unified operator/master terminal session | `mongoose` | `CafeOpsSession` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/CafeOpsSecurityEvent.js` | Audit trail security log model | `mongoose` | `CafeOpsSecurityEvent` model | Mongoose schema | NO (Additive collection) |
| `backend/src/models/index.js` | Model index & seam lookup resolver | `mongoose`, models | Models + external model getters | Model registry | NO |
| `backend/src/repositories/memory.js` | In-memory data store for standalone testing | None | In-memory repository functions | Test adapter | NO |
| `backend/src/repositories/mongo.js` | Mongoose repository implementation | Models | MongoDB repository functions | Database adapter | NO |
| `backend/src/repositories/index.js` | Repository implementation selector | `memory.js`, `mongo.js` | Active repository interface | Persistence router | NO |
| `backend/src/services/masterAuthAdapter.js` | Master strong-auth adapter (**Seam 2**) | `bcryptjs` (demo) | `identify`, `completeMfa`, `reauth` | Auth adapter | NO (Interface seam) |
| `backend/src/services/operatorPinService.js` | PIN hashing (bcrypt+HMAC) & verification | `bcryptjs`, `crypto` | PIN service methods | Auth service | NO |
| `backend/src/services/operatorAuthorizationService.js` | Operator access decision engine | None | `evaluateOperatorAuthorization()` | Rule evaluator | NO |
| `backend/src/services/masterAuthorizationService.js` | Master cafe-scope decision engine | None | `evaluateMasterAuthorization()` | Rule evaluator | NO |
| `backend/src/services/cafeOpsSessionService.js` | Unified session lifecycle engine | Repositories, audit | Session lifecycle methods | Core business service | NO |
| `backend/src/services/rateLimitService.js` | Per-device / per-auth-path rate limiter | None | Rate limit checker & recorder | Security service | NO |
| `backend/src/services/auditService.js` | Redacting audit logger | Repositories | `recordSecurityEvent()` | Audit service | NO |
| `backend/src/services/supportReferenceService.js` | Diagnostic reference generator | `crypto` | Support code generator | Diagnostic service | NO |
| `backend/src/services/timeIntegrityService.js` | Server time & drift evaluator | None | Time check utilities | Drift protection | NO |
| `backend/src/services/deviceService.js` | Device lifecycle & reassignment | Repositories, audit | Device management methods | Domain service | NO |
| `backend/src/services/deviceEnrollmentService.js` | 15-minute enrollment token generator | Repositories | Enrollment methods | Security service | NO |
| `backend/src/middleware/deviceContext.js` | Validates device token from header | Repositories | Express middleware | Request gate | NO |
| `backend/src/middleware/cafeOpsSessionContext.js` | Validates active operator/master session | Repositories | Express middleware | Request gate | NO |
| `backend/src/middleware/requireGovernanceRole.js` | Admin route role guard (**Seam 3**) | None (placeholder) | Express middleware | RBAC gate | NO |
| `backend/src/routes/deviceEnrollmentRoutes.js` | Device registration HTTP endpoints | Express router | Router instance | API route module | NO |
| `backend/src/routes/cafeOpsAuthRoutes.js` | Operator & Master sign-in endpoints | Express router | Router instance | API route module | NO |
| `backend/src/routes/adminDeviceRoutes.js` | Device governance HTTP endpoints | Express router | Router instance | API route module | NO |
| `backend/src/routes/adminOperatorAccessRoutes.js` | Operator access grant HTTP endpoints | Express router | Router instance | API route module | NO |
| `backend/src/routes/adminSessionRoutes.js` | Session governance & remote termination | Express router | Router instance | API route module | NO |
| `backend/src/routes/index.js` | Master router mounting `/api/cafe-ops` | Express router | Router instance | Subsystem router | NO |
| `backend/tests/*` (6 files) | 64 standalone unit & integration tests | `node:test`, `node:assert` | N/A | Verification suite | NO |

### 2.2 Frontend Codebase (`frontend/`)

| File Path | Purpose | Dependencies | Runtime Role | Replacement Target? |
|-----------|---------|--------------|--------------|---------------------|
| `frontend/cafe-operations.html` | Standalone Cafe Operations Terminal entry point | Vanilla HTML/CSS/JS | Web Page entry | NO (Additive terminal page) |
| `frontend/README_INTEGRATION.md` | Frontend integration guidelines | N/A | Documentation | NO |
| `frontend/assets/zamorin-logo-stacked.svg` | Brand logo asset (light mode) | SVG | UI Asset | NO |
| `frontend/assets/zamorin-logo-stacked-reversed.svg` | Brand logo asset (dark mode) | SVG | UI Asset | NO |
| `frontend/assets/favicon.ico`, `icon-192.png`, `icon-512.png` | Web / PWA icon assets | Binary | UI Asset | NO |
| `frontend/css/components.base.css` | Reference copy of Zamorin `components.css` | CSS | Local reference only | **DELETE ON INTEGRATION** |
| `frontend/css/cafe-operations.css` | Additive classes prefixed `.cafeops-*` | Vanilla CSS | Module styling | NO (Additive stylesheet) |
| `frontend/js/cafeOpsApp.js` | Router & state bootstrap for terminal | ES Modules | Frontend App Router | NO |
| `frontend/js/api/cafeOpsApi.js` | Dedicated API transport for Cafe Operations | Vanilla Fetch | API Client | NO |
| `frontend/js/state/sessionPolicyClient.js` | Client-side inactivity & heartbeat watcher | Vanilla JS | State manager | NO |
| `frontend/js/components/brandHeader.js` | Shared logo + cafe identity header | Vanilla JS DOM | Component | NO |
| `frontend/js/components/pinPad.js` | 6-digit numeric touch & keyboard PIN pad | Vanilla JS DOM | Component | NO |
| `frontend/js/components/statusShell.js` | Terminal status & modal error dialogs | Vanilla JS DOM | Component | NO |
| `frontend/js/screens/registerDevice.js` | Device enrollment screen | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/attendanceKiosk.js` | Default locked terminal / Attendance Kiosk | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/operatorSignIn.js` | Operator PIN authentication screen | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/masterSignIn.js` | Master password + MFA credential screen | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/welcome.js` | Transient welcome / handover confirmation | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/sessionLocked.js` | Session resume / unlock screen | Vanilla JS DOM | Screen module | NO |
| `frontend/js/screens/cafeOperationsShell.js` | Authenticated topbar context shell | Vanilla JS DOM | Shell module | NO |
| `frontend/js/screens/deviceStatusHelp.js` | Diagnostic & device status info screen | Vanilla JS DOM | Screen module | NO |

---

## 3. Package Classification Summary

- **Total Files in Archive:** 72 items (code, tests, assets, and docs).
- **Core Purpose:** Dedicated **Cafe Operations Shared Terminal / Trusted Device Operator Session Module**.
- **Scope:** Provides PIN sign-in for `CAFE_ADMIN` and strong credential sign-in for `MASTER` on trusted, cafe-bound shared hardware terminals.
- **Impact on Existing Personal Login (`frontend/src/js/pages/login.js`):** **ZERO**. The package is 100% additive.
