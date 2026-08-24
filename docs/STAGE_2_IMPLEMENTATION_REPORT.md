# ZAMORIN CAFE ERP — STAGE 2 IMPLEMENTATION REPORT
## Authentication / Session / API Foundation & Universal Shared UI Component System

### 1. Scope & Objective Summary
Stage 2 established a hardened, unified, and resilient API, session, and UI component foundation across the four non-Staff workspaces:
- **Primary Master**
- **Normal Master**
- **Owner**
- **Cafe Operations**

Feature scope for **Employee / Staff** remained strictly frozen throughout Stage 2 execution, verified via non-destructive regression smoke tests.

---

### 2. Root Cause Analysis: Recurring Session Error
#### Symptom
Recurring toast notifications displaying:
> `"Session ID, refresh token and device ID are required."`

#### Forensic Root Cause
1. **Missing Session Context in Dev Preview / Fresh Sessions**:
   - `backend/src/controllers/authController.js` (`getRefreshInput`) expects `sessionId`, `refreshToken` (cookies or body), and `deviceId` (header or body) on `POST /auth/refresh`.
   - In dev preview mode or when active session cookies expired, unauthenticated requests hitting protected routes returned `401 AUTHENTICATION_REQUIRED`.
   - `apiClient.js` caught any `401` and immediately triggered `refreshAuthenticatedSession()`.
   - Because `sessionId` and `refreshToken` cookies were absent in preview mode, `POST /auth/refresh` threw `401 REFRESH_SESSION_REQUIRED: "Session ID, refresh token and device ID are required."`, which bubbled directly to user-facing toasts on POS, Inventory, Reports, and Payslips.
2. **Double Path Prefix Doubling**:
   - `API_BASE_URL` was `http://localhost:4000/api/v1`. Calling `apiGet("/api/v1/customers")` generated `http://localhost:4000/api/v1/api/v1/customers`, returning 404 HTML responses that threw JSON parse syntax errors.

#### Corrective Resolution
1. **Path Normalization**: Added `normalizeApiPath(path)` in `apiClient.js` to strip redundant `/api/v1` or `/api` prefixes automatically.
2. **Single-Flight Refresh Queue**: Implemented `singleFlightRefreshPromise` with state detection (`sessionState = "EXPIRED"`) preventing refresh cascading loops.
3. **Canonical Error Taxonomy & User Messages**:
   - Created `ApiClientError` and mapped `REFRESH_SESSION_REQUIRED`, `AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, and `STEP_UP_AUTHENTICATION_REQUIRED` to clean, actionable user messages (`"Authenticated session has expired. Please log in again."`).
4. **Device Context Persistence**: Generated and persisted canonical device ID (`x-device-id`) across all API requests.

---

### 3. Canonical API Client Refactoring (`frontend/src/js/apiClient.js`)
- **Transport Methods**:
  - `apiGet(path, options)`
  - `apiPost(path, body, options)`
  - `apiPut(path, body, options)`
  - `apiDelete(path, options)`
  - `apiBlob(path, options)`
  - `apiUpload(path, formData, options)`
  - `downloadFile({ url, filename, expectedMimeTypes })`
- **Safety**: Robust HTML vs JSON content-type detection preventing parser crashes on 404/500 server error pages.

---

### 4. Universal Shared UI Component System
1. **Universal Form Control Scale (`frontend/src/styles/components.css`)**:
   - `.form-input`, `.form-select`, `.form-textarea`, `.form-control`, `.input`
   - Height scale: `32px` (compact), `40px` (standard), `48px` (touch/POS)
   - Consistent focus ring: `var(--bronze-500)` with `rgba(177, 125, 56, 0.15)`
2. **Universal Modal System (`frontend/src/js/components.js`)**:
   - Standard structure: `.modal-backdrop`, `.modal-window`, `.modal-header`, `.modal-title`, `.modal-close-btn` (`✕`), `.modal-content`, `.modal-footer` (`[Cancel]` + `[Save/Action]`).
   - Verified 0 home/house icons across all modal triggers and headers.
   - Escape key dismiss and backdrop click dismiss support.
3. **Shared Select / Dropdown (`createSelect` / `ZamorinSelect`)**:
   - Dropdown with custom trigger, search filter, keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`), and viewport boundary detection (`.open-up`).
4. **Shared DatePicker (`createDatePicker` / `ZamorinDatePicker`)**:
   - Calendar popup with month navigation, day grid, Today/Clear actions, and boundary detection.
5. **Global Topbar Enhancements**:
   - Live System Status Indicator (`● Online` / `🔴 Offline` tied to network connectivity).
   - 3-Tab Notification Popover (`All`, `Unread`, `Action Required`) with mark all read and deep linking.
   - Smart Search with `Ctrl+K` shortcut, grouped recommendations, and keyboard navigation.

---

### 5. Page-Level Direct `fetch()` Migration
- All direct `fetch()` calls in `frontend/src/js/pages/revenueShare.js` migrated to `apiGet`, `apiPost`, and `downloadFile`.
- Verified 0 remaining raw `fetch()` calls in `frontend/src/js/pages/`.
