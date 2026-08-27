# ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION (STAGE 1)
# CLIENT STORAGE & TOKEN SECURITY AUDIT

**Audit Date:** 2026-08-28  
**Scope:** `frontend/` (Zamorin Codebase) and `files/Login/` (Claude Package)  

---

## 1. Existing Zamorin Client Storage Usage

A complete regex and AST search across all JavaScript files in `frontend/src/js/` revealed the following storage keys:

| Storage Type | Key Name | Purpose | Data Classification | Security Impact |
|:------------:|:---------|:--------|:-------------------:|:---------------:|
| `localStorage` | `zamorin-theme` | Selected theme (`paper`, `pearl`, `midnight`, `noir`) | Non-Sensitive UI Preference | None |
| `localStorage` | `zamorin-font-size` | Selected typography scaling | Non-Sensitive UI Preference | None |
| `localStorage` | `zamorin_staff_privacy_mode` | Staff dashboard pay mask boolean toggle | Non-Sensitive UI State | None |
| `localStorage` | `zamorin_sidebar_collapsed` | Desktop sidebar collapse state boolean | Non-Sensitive UI State | None |
| `localStorage` | `zamorin_device_id` | Client-generated device UUID | Non-Secret Device Identifier | None |
| `sessionStorage`| *(None)* | *(Zero entries in use)* | N/A | None |

### Invariant Verification
- **Tokens in `localStorage`:** 0
- **Passwords / Hashes in `localStorage`:** 0
- **Session IDs in `localStorage`:** 0
- **Refresh Tokens in `localStorage`:** 0
- **JWT / Bearer Tokens in `localStorage`:** 0

All authentication tokens (`accessToken`, `refreshToken`, `sessionId`) are issued exclusively as **HttpOnly, Secure cookies** (`zamorin_access_token`, `zamorin_refresh_token`, `zamorin_session_id`). They are completely inaccessible to client-side scripts, neutralizing XSS credential theft.

---

## 2. Claude Login Package Client Storage Usage

The Claude package in `files/Login/` was audited for client storage patterns:

| File | Search Term | Usage in Claude Package | Audit Finding & Recommendation |
|------|-------------|-------------------------|--------------------------------|
| `frontend/js/api/cafeOpsApi.js` | `token` / `headers` | Attaches `x-cafe-device-token` and `x-cafe-session-token` to fetch headers | **COMPATIBLE:** Opaque hardware device tokens and transient terminal operator tokens passed via dedicated request headers. |
| `frontend/js/state/sessionPolicyClient.js` | `session` | In-memory session tracking for inactivity timer | **SAFE:** In-memory state only; not persisted to storage. |
| `frontend/js/cafeOpsApp.js` | `localStorage` | Stores enrolled device token locally on the shared tablet hardware | **ADAPTATION REQUIRED:** Must use existing Zamorin `DeviceRegistration` hardware binding and HttpOnly operator cookie/header convention. |

---

## 3. Storage Security Assessment & Decision

1. **Strict No-Token-in-Storage Policy Maintained:**
   - No personal login token or Master account credential will ever be written to `localStorage` or `sessionStorage`.
2. **Device Hardware Token Isolation:**
   - The device enrollment token for a physical tablet is bound to `DeviceRegistration` in MongoDB.
3. **Session Invariant:**
   - Authentication authority remains 100% server-verified on every request. Client storage cannot elevate permissions or dictate role context.
