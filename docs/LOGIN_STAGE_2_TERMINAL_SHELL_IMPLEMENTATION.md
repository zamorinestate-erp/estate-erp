# LOGIN STAGE 2 — TERMINAL SHELL IMPLEMENTATION REPORT

## Programme Context

**Stage**: 2 — Frontend Placement, Terminal Auth UI & Design-System Integration  
**Branch**: `feature/login-integration`  
**Date**: 2026-08-28  
**login.js SHA-256 (zero-diff mandate)**: `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`

---

## 1. Overview

Stage 2 places three additive terminal auth screens into the Zamorin SPA router without modifying any existing authentication logic, the personal login page, or any production backend. All three screens use the existing Zamorin visual shell (`.login-screen` → `.login-card`) and share the same `.auth-*` design system classes already used by the Operator Sign-In and login pages.

---

## 2. Implemented Screens

### 2.1 `cafe-master-signin` — Master Account Terminal Sign-In

**File**: `frontend/src/js/pages/cafeMasterSignIn.js`

**Two-step flow**:

| Step | Screen | Trigger |
|------|--------|---------|
| 1 | Credentials (email/password + optional access reason) | Initial navigation |
| 2 | MFA challenge (6-digit TOTP) | `onSignIn` callback returns `{ requiresMfa: true, mfaChallengeId }` |

**Security properties**:
- Credentials are passed to `onSignIn` callback and immediately fall out of scope — never stored in any module variable after the call
- MFA code is cleared from DOM and module state before the `onMfaVerify` callback resolves (pass or fail)
- Password visibility toggle uses ephemeral module state (`_pwVisible`) — not persisted
- Escape key clears all sensitive state and returns to Operator Sign-In
- No demo credentials, no mock success path
- Access reason field (governance metadata) is always displayed; enforcement is a Stage-3 backend policy, not hardcoded per-screen
- Stage-3 seam: if callbacks are `undefined`, user sees "Stage 3 backend integration required" — never a fake success

**Password visibility**: Implemented via module-level `_pwVisible` boolean — never reaches `localStorage` or `sessionStorage`.

**Paste support** (MFA code): Full paste handler on MFA digit inputs — detected, spread across cells, focused last cell. One-time-code autocomplete on first input.

**Keyboard navigation**: 
- Credential form: standard tab order
- MFA grid: backspace navigates to previous cell; Enter submits when all 6 digits are present

---

### 2.2 `cafe-device-enroll` — Device Enrollment

**File**: `frontend/src/js/pages/cafeDeviceEnroll.js`

**State machine**:

| State | Screen |
|-------|--------|
| `ENROLLMENT_IDLE` | Code entry form |
| `ENROLLMENT_SUBMITTING` | Loading (busy) state |
| `ENROLLMENT_SUCCESS` | Success + device context card |
| `ENROLLMENT_EXPIRED` | Code expired guidance |
| `ENROLLMENT_INVALID` | Code not recognised guidance |

**Security properties**:
- Enrollment code is cleared from the `<input>` immediately on submission (before async call)
- Code is never stored in `localStorage`, `sessionStorage`, or any module variable after submission
- The rendered success screen shows only the device name returned by the backend — no enrollment token is displayed
- Help popover reveals only public process information (how to get a code from an admin), never internal secrets
- Stage-3 seam: if `onEnroll` is `undefined`, shows integration required message — not a mock device trust

**Normalisation**: Code is stripped of spaces and hyphens, uppercased client-side for UX (users can type "K7M2-QRT9" or "k7m2qrt9"). The raw input is cleared; the normalised form is passed to the callback and not retained.

---

### 2.3 `cafe-terminal-welcome` — Terminal Welcome Hub

**File**: `frontend/src/js/pages/cafeTerminalWelcome.js`

**Purpose**: Route-level entry hub for the terminal when no session is active. Not an inactivity modal (that is `cafeOpsInactivity.js`). Not management content.

**Entry actions**:

| Button | Navigation target |
|--------|------------------|
| Operator Sign-In | `cafe-operator-signin` (existing authoritative screen) |
| Sign in with Master Account | `cafe-master-signin` (Stage-2 new) |
| Register This Device | `cafe-device-enroll` (Stage-2 new) |
| ← Attendance Kiosk | `kiosk-attendance` (existing) |

**Security properties**:
- No management content, no financial data, no role-specific navigation is rendered pre-auth
- No sensitive data from any prior session is shown
- Connection indicator updates live (online/offline events)
- `mode='session_expired'` variant shows the expired badge + re-auth prompt

---

## 3. Router Integration

**File**: `frontend/src/js/router.js`

Three new `case` blocks added to `renderPage()`:

```
case 'cafe-master-signin'  →  stopCafeOpsInactivityTimer() + reset + render + wire
case 'cafe-device-enroll'  →  stopCafeOpsInactivityTimer() + reset + render + wire
case 'cafe-terminal-welcome' → stopCafeOpsInactivityTimer() + render + wire
```

All three call `stopCafeOpsInactivityTimer()` first — correct, because the inactivity timer should never be running while a pre-session auth screen is displayed.

**Stage-3 seam stubs in router**:
```js
onSignIn: undefined,   // → authController.authenticatePassword + mfaService
onMfaVerify: undefined, // → mfaService.verifyTotp
onEnroll: undefined,   // → deviceService.enrollDevice
```

---

## 4. Navigation Allowlist

**File**: `frontend/src/js/navigation.js`

`IMPLICIT_ROUTES_CAFE_ADMIN` extended:

```js
const IMPLICIT_ROUTES_CAFE_ADMIN = new Set([
  'cafe-operator-signin',    // pre-existing
  'cafe-device-state',       // pre-existing
  'cafe-master-signin',      // Stage-2 new
  'cafe-device-enroll',      // Stage-2 new
  'cafe-terminal-welcome',   // Stage-2 new
]);
```

These routes bypass the sidebar item check (`isRouteAllowed`) because they are auth-context screens accessible to the `CAFE_ADMIN` role without appearing in any sidebar navigation item. They are still role-gated — only `CAFE_ADMIN` can reach them.

---

## 5. Inactivity Timer Interaction

| Action | Timer state |
|--------|-------------|
| Navigate to `cafe-master-signin` | `stopCafeOpsInactivityTimer()` called |
| Navigate to `cafe-device-enroll` | `stopCafeOpsInactivityTimer()` called |
| Navigate to `cafe-terminal-welcome` | `stopCafeOpsInactivityTimer()` called |
| Navigate to `cafe-operator-signin` | `stopCafeOpsInactivityTimer()` called (pre-existing) |
| Successful operator sign-in | `startCafeOpsInactivityTimer()` called (pre-existing, in router) |

No change to the inactivity timer logic itself — only interaction via existing public API.

---

## 6. What Stage 2 Does NOT Do

| Item | Status |
|------|--------|
| Modify `login.js` | ❌ Zero-diff, hash verified |
| Modify `authController.js` | ❌ Not touched |
| Modify `authenticate.js` / `authorize.js` middleware | ❌ Not touched |
| Modify `deviceContext.js` middleware | ❌ Not touched |
| Modify `cafeOperatorSignIn.js` | ❌ Not touched |
| Modify `cafeOpsInactivity.js` | ❌ Not touched |
| Store credentials in browser storage | ❌ Never |
| Wire real authentication | ❌ Stage-3 seams only |
| Create mock login tokens | ❌ Never |
| Start Stage 3 | ❌ Stage-3 gate not open |
