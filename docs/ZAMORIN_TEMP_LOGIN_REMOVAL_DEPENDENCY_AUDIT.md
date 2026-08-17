# ZAMORIN CAFE ERP — TEMPORARY LOGIN REMOVAL DEPENDENCY AUDIT

**Date:** 2026-08-17  
**Objective:** Complete audit and dependency classification of all login-related frontend and backend artifacts prior to temporary login UI removal and direct development dashboard entry.

---

## 1. Classification Methodology & Policy

Each candidate artifact is categorized into exactly one classification:
- **`LOGIN_UI_EXCLUSIVE`**: Exclusively used by the old login screen and login UI form. Candidate for temporary removal / placeholder stubbing.
- **`SHARED_UI`**: Used across dashboard, app shell, navigation, forms, modals, or other business modules. **MUST BE KEPT INTACT.**
- **`AUTH_BACKEND`**: Core authentication APIs, controllers, services, token handling, MFA backend, password reset endpoints, session store. **MUST BE KEPT 100% INTACT.**
- **`RBAC_SECURITY`**: RBAC models, 4 canonical roles (MASTER, OWNER, CAFE_ADMIN, STAFF), 95 permission catalog, policy enforcement, device authorization, Personal Ledger access checks. **MUST BE KEPT 100% INTACT.**
- **`SHARED_ASSET`**: Brand marks, icons, fonts, global styles used by multiple modules or app shell. **MUST BE KEPT INTACT.**
- **`OTHER_FEATURE`**: Business modules (POS, Attendance, Expenses, Payroll, Inventory, CashBook, MailOps, Reports, etc.). **ZERO COLLATERAL CHANGES.**

---

## 2. Dependency Audit Matrix

| Artifact Path | Classification | Dependent Consumers | Action | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `frontend/src/js/pages/login.js` | `LOGIN_UI_EXCLUSIVE` | `main.js` (auth screen) | **STUB / REMOVE OLD UI** (Mark `PENDING REDESIGN`) | Contains old login form markup and client-side form wiring. Replaced with clean placeholder module maintaining export contracts for future redesign. |
| `frontend/src/styles/components.css` (login rules) | `LOGIN_UI_EXCLUSIVE` / `SHARED_UI` | Global app shell, dialogs, tables | **CLEAN LOGIN SELECTORS ONLY** | Remove obsolete `.login-*` selectors while preserving all shared UI classes (`.dialog-*`, `.kpi-*`, `.btn-*`, `.text-input`). |
| `frontend/src/styles/zamorin.css` | `SHARED_UI` | Entire Frontend Application | **KEEP INTACT** | Core design system tokens, typography, ledger/roastery theme. |
| `frontend/src/styles/tokens.css` | `SHARED_UI` | Entire Frontend Application | **KEEP INTACT** | Design tokens, color scales, elevation. |
| `frontend/src/styles/layout.css` | `SHARED_UI` | App shell, sidebar, topbar | **KEEP INTACT** | Grid layout, responsive shell containers. |
| `frontend/src/assets/zamorin-estate-mark.png` | `SHARED_ASSET` | Sidebar brand header, logo | **KEEP INTACT** | Official estate mark used across application navigation. |
| `frontend/src/assets/zamorin-app-icon-vector.svg` | `SHARED_ASSET` | Favicon, PWA manifest | **KEEP INTACT** | Core branding icon. |
| `frontend/src/js/apiClient.js` | `SHARED_UI` | All frontend modules | **KEEP INTACT** | Authoritative HTTP client, CSRF, error handling, session cookies. |
| `frontend/src/js/state.js` | `SHARED_UI` | All frontend modules | **KEEP INTACT** | Global application state management. |
| `frontend/src/js/router.js` | `SHARED_UI` | Navigation & pages | **KEEP INTACT** | Client-side routing. Modified to route to `/` dashboard during dev preview. |
| `frontend/src/js/navigation.js` | `SHARED_UI` | Sidebar, topbar, roles | **KEEP INTACT** | Role-aware navigation definitions for MASTER, OWNER, CAFE_ADMIN, STAFF. |
| `frontend/src/js/main.js` | `SHARED_UI` | App entry point | **UPDATE ROUTING** | Add `DEV_DIRECT_DASHBOARD` guard for local preview; fail-closed in production. |
| `backend/src/routes/authRoutes.js` | `AUTH_BACKEND` | Express API Server | **KEEP 100% INTACT** | Login, logout, session, MFA, password reset routes. |
| `backend/src/controllers/authController.js` | `AUTH_BACKEND` | Auth routes | **KEEP 100% INTACT** | Authentication logic, step-up auth, session management. |
| `backend/src/services/authService.js` | `AUTH_BACKEND` | Auth controller | **KEEP 100% INTACT** | Password verification, token generation, security auditing. |
| `backend/src/services/mfaService.js` | `AUTH_BACKEND` | Auth controller | **KEEP 100% INTACT** | TOTP generation and verification, recovery code validation. |
| `backend/src/models/User.js` | `AUTH_BACKEND` / `RBAC_SECURITY` | Mongoose ODM | **KEEP 100% INTACT** | User schema, password hashing, role assignment, lockouts. |
| `backend/src/models/Session.js` | `AUTH_BACKEND` | Mongoose ODM | **KEEP 100% INTACT** | Session tracking, revocation, device binding. |
| `backend/src/models/RolePermission.js` | `RBAC_SECURITY` | Authorization middleware | **KEEP 100% INTACT** | 95/95 canonical RBAC rules across 4 roles. |
| `backend/src/middleware/authenticate.js` | `AUTH_BACKEND` | Protected routes | **KEEP 100% INTACT** | JWT cookie/header validation, token expiry verification. |
| `backend/src/middleware/authorize.js` | `RBAC_SECURITY` | Protected routes | **KEEP 100% INTACT** | Permission-based route access controls. |

---

## 3. Deletion Safety Verification

- **Non-login files to be deleted:** 0
- **Non-login folders to be deleted:** 0
- **Business modules affected:** 0
- **Shared assets affected:** 0
- **Backend authentication API changes:** 0 (100% preserved)
- **Role changes:** 0 (Preserving strictly 4 canonical roles: MASTER, OWNER, CAFE_ADMIN, STAFF)
- **Permission baseline:** 95 / 95 preserved
- **Personal Ledger / Expense approvals:** MASTER ONLY enforced.
