# ZAMORIN CAFE ERP — STAGE 2 SESSION & API BASELINE AUDIT

**Target Workspaces**: Primary Master · Normal Master · Owner · Cafe Operations  
**Staff Status**: Feature Scope Strictly Frozen (Shared-Infrastructure Regression Smoke Only)  
**Date**: 2026-08-23  

---

## 1. Request & Session Lifecycle Map

```
USER / DEV PROFILE AUTH CONTEXT
    ↓
SESSION CREATION (POST /api/v1/auth/login or Operator PIN Login)
    ↓
SESSION ID (HttpOnly cookie `zamorin_session_id` or session snapshot)
    ↓
REFRESH TOKEN / REFRESH MECHANISM (HttpOnly cookie `zamorin_refresh_token` / POST /api/v1/auth/refresh)
    ↓
DEVICE ID / TRUSTED DEVICE CONTEXT (Storage: `zamorin-device-id`, Header: `x-device-id`)
    ↓
ROLE / USER IDENTITY (Master, Normal Master, Cafe Owner, Cafe Operations, Staff)
    ↓
CAFE / PORTFOLIO SCOPE (Global `ALL`, Assigned `assignedCafeIds`, Unit `primaryCafeId`)
    ↓
FRONTEND API CLIENT (`frontend/src/js/apiClient.js` — single-flight queue, normalized path, credentials)
    ↓
BACKEND AUTH MIDDLEWARE (`backend/src/middleware/authenticate.js` — extracts token/cookie, validates user & sessionVersion)
    ↓
ROUTE AUTHORIZATION (`backend/src/middleware/authorize.js` & cafe scoping)
    ↓
SERVICE / CONTROLLER / DATABASE
```

---

## 2. Component Responsibility & File Mapping

| Architectural Function | Responsible File(s) | Description / Role |
|---|---|---|
| **Login / Session Bootstrap** | `backend/src/controllers/authController.js`, `frontend/src/js/main.js` | Authenticates credentials, creates session document, sets secure HttpOnly cookies. |
| **Operator Session Bootstrap** | `backend/src/controllers/cafeOperationsController.js`, `frontend/src/js/router.js` | Operator PIN and till assignment for Cafe Operations. |
| **Session Storage** | `backend/src/models/Session.js`, Browser HttpOnly cookies | Encrypted session records in MongoDB; secure cookie transport. |
| **Refresh Token Storage** | `backend/src/services/authService.js`, Cookie `zamorin_refresh_token` | Hashed refresh tokens bound to session, user, and device. |
| **Device ID Storage** | `frontend/src/js/apiClient.js` (`zamorin-device-id`) | UUIDv4 stored in localStorage; passed via `x-device-id` header. |
| **Trusted Device Service** | `backend/src/services/trustedDeviceService.js`, `backend/src/models/TrustedDevice.js` | Device fingerprinting, approval workflow, and session binding. |
| **API Base URL** | `frontend/src/js/apiClient.js` (`API_BASE_URL`) | Canonical endpoint root (`http://localhost:4000/api/v1` or `/api/v1`). |
| **Frontend API Client** | `frontend/src/js/apiClient.js` | Canonical `apiGet`, `apiPost`, `apiPatch`, `apiPut`, `apiDelete`, `apiBlob`, `downloadFile`. |
| **Backend Auth Middleware** | `backend/src/middleware/authenticate.js` | Verifies JWT bearer / cookies, session version, user status. |
| **Backend Scope Middleware** | `backend/src/middleware/authorize.js` | Enforces RBAC permissions and café assignment boundaries. |
| **Profile / Role Switching** | `frontend/src/js/main.js`, `frontend/src/js/navigation.js` | Development role simulator (`?role=...` / `?devRole=...`) and session boundary. |

---

## 3. Forensic Root Cause Analysis

### Root Cause 1: Recurring `"Session ID, refresh token and device ID are required."`
- **Mechanism**: When a page component issues an API request without an active server cookie or when the access token expires, the backend returns `401 AUTHENTICATION_REQUIRED`.
- **Trigger**: `apiClient.js` intercepts 401 and calls `refreshAuthenticatedSession()` (`POST /auth/refresh`).
- **Failure**: If the browser lacks `zamorin_refresh_token` and `zamorin_session_id` cookies (such as in local preview mode or after direct page reload before login), `authController.js` throws `401 REFRESH_SESSION_REQUIRED: "Session ID, refresh token and device ID are required."`.
- **Defect**: The raw backend error message was propagated directly to end-user toasts on POS Charge, Inventory, Reports, Payslips, and Owner screens.
- **Resolution**:
  1. Implement an explicit Session Readiness model (`INITIALISING`, `AUTHENTICATED`, `REFRESHING`, `EXPIRED`, `SIGNED_OUT`, `DEV_PREVIEW`).
  2. Implement single-flight refresh queue to avoid duplicate concurrent refresh calls.
  3. Map technical error codes to user-friendly messages via a unified error taxonomy.

### Root Cause 2: Double Path Prefixing (`/api/v1/api/v1/...`)
- **Mechanism**: `API_BASE_URL` was defined as `http://localhost:4000/api/v1`. Certain page modules passed `/api/v1/customers` to `apiGet()`.
- **Result**: Request was dispatched to `http://localhost:4000/api/v1/api/v1/customers`, returning 404 HTML responses that threw `"Unexpected token '<', '<!DOCTYPE ...' is not valid JSON"`.
- **Resolution**: Implement `normalizeApiPath(path)` in `apiClient.js` to automatically strip redundant `/api/v1` or `/api` prefixes before formatting the URL.

### Root Cause 3: Direct `fetch` Usage Bypassing Canonical Client
- **Mechanism**: `revenueShare.js` and other isolated files used raw `fetch('/api/v1/...')` with relative paths, omitting credentials, `x-device-id`, and CORS port routing.
- **Resolution**: Migrate all direct protected requests to canonical `apiGet`, `apiPost`, and `downloadFile`.
