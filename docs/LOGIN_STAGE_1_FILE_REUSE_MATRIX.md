# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# CLAUDE PACKAGE FILE-BY-FILE REUSE DECISION MATRIX

**Audit Date:** 2026-08-28  
**Package Source:** `files/Login/zamorin-cafe-operations-v2.zip`  

---

## 1. Documentation & Manifest Files

| File Name | Category | Classification | Decision Rationale |
|-----------|----------|:--------------:|--------------------|
| `ANTIGRAVITY_INTEGRATION_PROMPT.md` | Specification | `REFERENCE_ONLY` | Authoritative guideline for integration constraints and boundaries. |
| `ARCHITECTURE_DECISIONS.md` | Specification | `REFERENCE_ONLY` | Contextual architectural rationale document. |
| `IMPLEMENTATION_REPORT.md` | Evidence | `REFERENCE_ONLY` | Test and verification benchmark report. |
| `PROJECT_FILE_MANIFEST.md` | Manifest | `REFERENCE_ONLY` | Package structure map. |

---

## 2. Backend Files (`backend/`)

| File Path | Component | Classification | Decision Rationale |
|-----------|-----------|:--------------:|--------------------|
| `backend/package.json` | Dependencies | `REFERENCE_ONLY` | Existing Zamorin `backend/package.json` already contains `express`, `mongoose`, `bcryptjs`. |
| `backend/server-standalone.js` | Server Entry | `REFERENCE_ONLY` | Standalone server runner; Zamorin uses `backend/src/server.js`. |
| `backend/README_INTEGRATION.md` | Documentation | `REFERENCE_ONLY` | Integration wiring guide. |
| `backend/src/app.js` | App Factory | `REFERENCE_ONLY` | Standalone app factory; Zamorin has canonical `server.js` and `routes/index.js`. |
| `backend/src/config/sessionPolicy.js` | Configuration | `REUSE_AS_IS` | Clean, centralized timeouts and lockout constants for Cafe Operations. |
| `backend/src/config/pinPolicy.js` | Configuration | `REUSE_AS_IS` | PIN validation rules and weak-PIN blocklist. |
| `backend/src/config/integrationRefs.js` | Seam Config | `ADAPT` | Set model names to Zamorin's `User` and `Cafe`. |
| `backend/src/utils/constants.js` | Enums | `REUSE_AS_IS` | Clean enums for session types, denial reasons, and audit events. |
| `backend/src/utils/ids.js` | Utilities | `REUSE_AS_IS` | Secure token generation and hashing utilities. |
| `backend/src/utils/responses.js` | Utilities | `REUSE_AS_IS` | Clean `{ success, data, error }` response formatters. |
| `backend/src/models/CafeOpsDevice.js` | Model | `ADAPT` | Align with or complement existing Zamorin `DeviceRegistration` collection. |
| `backend/src/models/CafeOpsDeviceEnrollmentToken.js` | Model | `REUSE_AS_IS` | Clean 15-minute single-use enrollment token collection. |
| `backend/src/models/CafeOpsOperatorCredential.js` | Model | `REUSE_AS_IS` | Dedicated bcrypt+HMAC operator PIN credential model. |
| `backend/src/models/CafeOpsOperatorAccess.js` | Model | `REUSE_AS_IS` | Explicit cafe-operator access authorization grant collection. |
| `backend/src/models/CafeOpsSession.js` | Model | `ADAPT` | Align with or complement existing Zamorin `OperatorSession` collection. |
| `backend/src/models/CafeOpsSecurityEvent.js` | Model | `REUSE_AS_IS` | Additive audit log for Cafe Operations terminal security events. |
| `backend/src/models/index.js` | Model Index | `ADAPT` | Wire model export registry and external model lookups. |
| `backend/src/repositories/*` (3 files) | Data Access | `ADAPT` | Connect Mongoose repository to Zamorin's active MongoDB connection. |
| `backend/src/services/masterAuthAdapter.js` | Auth Seam | `ADAPT` | Bind `identify`, `completeMfa`, `reauth` directly to Zamorin's canonical `authService.js` and `mfaService.js`. |
| `backend/src/services/operatorPinService.js` | Service | `REUSE_AS_IS` | High-security PIN hashing, timing-normalized comparison, and verification. |
| `backend/src/services/operatorAuthorizationService.js` | Service | `REUSE_AS_IS` | Pure Operator access decision function. |
| `backend/src/services/masterAuthorizationService.js` | Service | `REUSE_AS_IS` | Pure Master cafe-scope boundary decision function. |
| `backend/src/services/cafeOpsSessionService.js` | Service | `REUSE_AS_IS` | Unified session lifecycle engine (lock, unlock, switch, end, expire). |
| `backend/src/services/rateLimitService.js` | Service | `REUSE_AS_IS` | Dedicated per-device PIN and Master throttling service. |
| `backend/src/services/auditService.js` | Service | `REUSE_AS_IS` | Redacting audit service stripping sensitive keys before persistence. |
| `backend/src/services/supportReferenceService.js` | Service | `REUSE_AS_IS` | Diagnostic code generation. |
| `backend/src/services/timeIntegrityService.js` | Service | `REUSE_AS_IS` | Server time integrity & client drift checking. |
| `backend/src/services/deviceService.js` | Service | `REUSE_AS_IS` | Device lifecycle and cafe-reassignment management. |
| `backend/src/services/deviceEnrollmentService.js` | Service | `REUSE_AS_IS` | Enrollment code generation and verification. |
| `backend/src/middleware/deviceContext.js` | Middleware | `ADAPT` | Device authentication gate; align with Zamorin's `x-device-id` / token context. |
| `backend/src/middleware/cafeOpsSessionContext.js` | Middleware | `REUSE_AS_IS` | Validates active operator/master terminal session. |
| `backend/src/middleware/requireGovernanceRole.js` | Middleware | `REFACTOR` | Replace with Zamorin's canonical `authorize.js` middleware. |
| `backend/src/routes/*` (6 files) | API Routes | `ADAPT` | Mount routes under `/api/cafe-ops` in `backend/src/routes/index.js`. |
| `backend/tests/*` (6 files) | Tests | `REUSE_AS_IS` | Preserve 64/64 passing tests to verify integration integrity. |

---

## 3. Frontend Files (`frontend/`)

| File Path | Component | Classification | Decision Rationale |
|-----------|-----------|:--------------:|--------------------|
| `frontend/cafe-operations.html` | Entry Point | `REUSE_UI_ONLY` | Dedicated terminal HTML entry point. |
| `frontend/assets/*` (5 files) | Brand Assets | `REUSE_AS_IS` | Stacked SVG logos and icons. |
| `frontend/css/components.base.css` | Stylesheet | `DELETE_AFTER_INTEGRATION` | Bundled reference copy of `components.css`. Replaced by Zamorin's single canonical `components.css`. |
| `frontend/css/cafe-operations.css` | Stylesheet | `REUSE_AS_IS` | Additive `.cafeops-*` utility and component styles. |
| `frontend/js/cafeOpsApp.js` | App Router | `ADAPT` | Terminal screen router and startup resolver. |
| `frontend/js/api/cafeOpsApi.js` | API Transport | `ADAPT` | Point base URL to Zamorin's API origin and align with error handlers. |
| `frontend/js/state/sessionPolicyClient.js` | State Watcher | `REUSE_AS_IS` | Human-activity-driven inactivity lock and heartbeat manager. |
| `frontend/js/components/*` (3 files) | Components | `REUSE_AS_IS` | Brand header, touch PIN pad, and status shells. |
| `frontend/js/screens/*` (8 files) | Screens | `REUSE_AS_IS` | Terminal screens: attendance kiosk, PIN sign-in, Master sign-in, session lock, welcome, shell, help. |
