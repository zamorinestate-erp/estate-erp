# LOGIN STAGE 2 — SECURITY POSTURE REPORT

## Programme Context

**Stage**: 2 — Frontend Placement, Terminal Auth UI & Design-System Integration  
**Branch**: `feature/login-integration`  
**Date**: 2026-08-28  
**Scope**: Frontend only. No backend auth logic changed.

---

## 1. Credential Handling

### 1.1 No credentials in browser storage

| Storage | Status |
|---------|--------|
| `localStorage` | Credentials **never written** |
| `sessionStorage` | Credentials **never written** |
| Cookie | Not touched in Stage 2 |
| IndexedDB | Not touched |
| Module-level variables | Cleared immediately after use (see below) |

### 1.2 Credential lifetime in memory

**Master Sign-In — Credentials step**:
- `identifier` and `password` are read from input values inside the `submit` handler closure
- They are passed directly to `onSignIn({ identifier, password })` — they never escape the function
- The `<input>` values are NOT saved to any module variable
- On failure: error is shown, `_busy` is cleared, inputs remain for retry — no password cached in module state
- On success: the module calls `_resetSensitive()` immediately after navigation is complete

**Master Sign-In — MFA step**:
- `code` is read from digit inputs inside the `click` handler
- Before `onMfaVerify` resolves (pass or fail), all digit inputs are cleared: `digits.forEach(d => { d.value = ''; })`
- The code string is passed to the callback and is not retained anywhere

**Device Enrollment**:
- `enrollmentCode` is normalised and cleared from `<input>` immediately before the async call
- The code is passed to `onEnroll` and not retained in any module variable
- On success: only the device name from the backend response is displayed — the enrollment code is gone

### 1.3 Escape-key cancel

All three screen implementations wire an `Escape` keydown handler that:
1. Clears all sensitive input state
2. Calls `onBack()` to navigate away
3. Removes the event listener

---

## 2. No Mock Authentication

Stage 2 explicitly rejects mock authentication:

```js
if (typeof onSignIn !== 'function') {
  _error = 'Master authentication is not yet connected. Stage 3 backend integration is required.';
  return;
}
```

No path in any Stage-2 screen synthesises a fake session token, fake device trust, or fake operator identity. The fail state is a visible error message, not a silent success.

---

## 3. No Credential Display

- Password inputs default to `type="password"`
- Show/hide toggle is implemented but only visible when explicitly clicked
- The toggle state (`_pwVisible`) is a module-local boolean, not stored anywhere
- MFA codes are displayed as plain text inputs (per standard TOTP UX) but cleared immediately after use

---

## 4. Error Message Security

All user-facing error messages are generic:

| Scenario | Message shown |
|----------|--------------|
| Wrong password | "Master access could not be verified. Please check your details and try again." |
| Wrong MFA code | "That verification code was not accepted. Please try again." |
| Wrong enrollment code | "Unable to register this device right now. Please try again." / Expired/Invalid state |
| Stage-3 not wired | "Stage 3 backend integration is required." |

No message reveals whether an account exists, whether a password was close, or any internal system state.

---

## 5. Rate Limiting — UI Readiness

The `cafeMasterSignIn.js` error handling is ready to receive a `429` status from Stage 3:

```js
// Pattern adopted from Claude's masterSignIn.js
if (err.status === 429) {
  // Show rate-limit message, navigate to status screen
}
```

The generic error handler also passes through `err.supportReference` if present, allowing a backend-issued support reference to be shown without revealing system internals.

---

## 6. Access Reason — Governance, Not Auth

The access reason dropdown in Master Sign-In is:
- **Always displayed** (governance value: auditing why a Master accessed a terminal)
- **Never blocks submission** in Stage 2 (enforcement is a Stage-3 backend policy, per `masterSignIn.js` Section 46 annotation)
- **Optional field** — UI reflects this with "(optional)" label

---

## 7. DOM Attribute Safety

- No credential is written to any `data-*` attribute, `aria-*` attribute, or element `.value` property after submission
- `_busy`, `_pwVisible`, `_error`, `_step` module variables contain only UI state (booleans, strings describing UI state), never credential data

---

## 8. New Backend Surface — None

Stage 2 adds **zero new backend API routes**. The Stage-3 seam stubs are `undefined` — no HTTP calls are made by the three new screens. Existing backend routes are unchanged.

---

## 9. CSP / Script Safety

All new JS is ES module code loaded via Vite's existing module pipeline. No `eval()`, no `innerHTML` with user-supplied untrusted content (all user values pass through `escHtml()` before insertion), no dynamic `<script>` creation.

---

## 10. Summary

| Risk | Stage-2 status |
|------|---------------|
| Credential in localStorage/sessionStorage | ❌ Not present |
| Credential in module variable after use | ❌ Cleared on use |
| Mock authentication / fake session | ❌ Not present |
| New backend API surface | ❌ None |
| Error messages revealing account existence | ❌ Generic only |
| Existing auth middleware modified | ❌ Not touched |
| Personal login page modified | ❌ Zero-diff verified |
| Token in DOM attribute | ❌ Not present |
| Unsafe innerHTML with user content | ❌ All user strings via escHtml() |
