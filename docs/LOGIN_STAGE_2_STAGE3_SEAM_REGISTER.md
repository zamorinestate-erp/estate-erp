# LOGIN STAGE 2 — STAGE-3 SEAM REGISTER

## Purpose

This document is the authoritative register of every Stage-3 integration seam placed during Stage 2. Each seam is an explicit `undefined` callback in the router. Stage 3 must replace each `undefined` with a real backend-calling function before any terminal auth flow can complete.

---

## Seam Register

### Seam S3-1: Master Sign-In — Credentials

| Property | Value |
|----------|-------|
| ID | `S3-1` |
| File | `frontend/src/js/router.js` |
| Route | `cafe-master-signin` |
| Callback name | `onSignIn` |
| Current value | `undefined` |
| Expected signature | `({ identifier: string, password: string, accessReason?: string }) → Promise<{ requiresMfa: boolean, mfaChallengeId?: string }>` |
| Backend target | `POST /auth/login` (authController.authenticatePassword) |
| On success (no MFA) | Caller must call `navigate('cafe-terminal-welcome')` or equivalent |
| On success (MFA required) | Callback returns `{ requiresMfa: true, mfaChallengeId }` — screen transitions to MFA step |
| On failure | Callback throws with `{ message, status?, supportReference? }` — error displayed generically |
| Security notes | Password must not be logged, cached, or retransmitted. Should use HTTPS-only POST. |

---

### Seam S3-2: Master Sign-In — MFA Verification

| Property | Value |
|----------|-------|
| ID | `S3-2` |
| File | `frontend/src/js/router.js` |
| Route | `cafe-master-signin` |
| Callback name | `onMfaVerify` |
| Current value | `undefined` |
| Expected signature | `({ mfaChallengeId: string, code: string }) → Promise<void>` |
| Backend target | `POST /auth/mfa/verify` (mfaService.verifyTotp) |
| On success | Callback resolves → screen calls `_resetSensitive()` → caller navigates |
| On failure | Callback throws → MFA digits cleared → error displayed generically |
| Security notes | Code is 6 digits, cleared from DOM before call. Must not be retried without fresh challenge. |

---

### Seam S3-3: Device Enrollment

| Property | Value |
|----------|-------|
| ID | `S3-3` |
| File | `frontend/src/js/router.js` |
| Route | `cafe-device-enroll` |
| Callback name | `onEnroll` |
| Current value | `undefined` |
| Expected signature | `({ enrollmentCode: string, deviceDisplayName?: string }) → Promise<{ device: { cafeName: string, deviceId?: string } }>` |
| Backend target | `POST /devices/enroll` (deviceService.enrollDevice) |
| On success | Callback returns `{ device }` → screen transitions to success state with device context |
| On `ENROLLMENT_EXPIRED` | Callback throws with `{ code: 'ENROLLMENT_EXPIRED' }` → expired screen shown |
| On `ENROLLMENT_UNAVAILABLE` / `INVALID_CODE` | Callback throws with `{ code: 'ENROLLMENT_UNAVAILABLE' }` → invalid screen shown |
| On other error | Generic error message shown on idle screen |
| Security notes | Enrollment code cleared from input before call. Code is single-use — backend must invalidate on use. |

---

## Seam Checklist for Stage 3

```
[ ] S3-1  onSignIn: wire to POST /auth/login
[ ] S3-2  onMfaVerify: wire to POST /auth/mfa/verify
[ ] S3-3  onEnroll: wire to POST /devices/enroll
```

All three seams must be wired before Stage 2 screens become functional for end users.

---

## Non-Seam Connections (already wired — Stage 2 only navigates to these)

| Screen | Target | Already wired? |
|--------|--------|---------------|
| `cafe-terminal-welcome` → Operator Sign-In | `cafe-operator-signin` | ✅ Yes — pre-existing route |
| `cafe-terminal-welcome` → Kiosk | `kiosk-attendance` | ✅ Yes — pre-existing route |
| `cafe-master-signin` → back | `cafe-operator-signin` | ✅ Yes — router navigate |
| `cafe-device-enroll` → back | `cafe-operator-signin` | ✅ Yes — router navigate |
| `cafe-device-enroll` → success continue | `cafe-operator-signin` | ✅ Yes — router navigate |

---

## Stage-3 Gate

Stage 3 is NOT started. The gate condition is:

1. All three seams above are wired with real backend-calling functions
2. Backend routes `/auth/login`, `/auth/mfa/verify`, `/devices/enroll` are confirmed available
3. A new Stage-3 branch is created from the Stage-2 HEAD commit
4. Independent audit is completed before any merge
