# Frontend Integration Guide

This runs standalone today: open `cafe-operations.html` in a browser pointed
at a running instance of the backend (see `../backend/README_INTEGRATION.md`)
and every screen works. This document is what changes to make it live
inside the real Zamorin app rather than as its own page.

## 1. Where these files actually go

This was built and verified as a standalone page (`cafe-operations.html`)
because that's what could be tested in isolation. In the real app it's not
a separate page load — it's a new route inside whatever shell currently
renders `frontend/src/js/pages/login.js`. Two ways to fold it in, in order
of preference:

**A. New route, same shell (preferred).** Add a route (however routing
currently works in the app — this wasn't in what was shared) that mounts
`js/cafeOpsApp.js`'s resolver into the existing `#authRoot`/equivalent
element instead of a brand-new `#cafeOpsRoot`. The `.auth-page`/`.auth-bg`
markup in `cafe-operations.html` is a duplicate of what the real
`index.html` already renders — once merged, delete the duplicate and let
both the personal login and Cafe Operations render into the same
persistent shell.

**B. Separate static entry point.** Deploy `cafe-operations.html` as its own
page (e.g. `/cafe-operations.html`, served alongside the main app) if the
device is meant to load a dedicated URL rather than sharing the main app's
router. Nothing needs to change for this option — it's what's been tested.

## 2. Merge the two stylesheets

`css/components.base.css` in this delivery is a byte-for-byte copy of the
real `src/styles/components.css` — copied in only so this module could be
built and verified against the exact real classes rather than an
approximation. **Don't ship two copies.** Delete
`frontend/css/components.base.css` from this delivery and point
`css/cafe-operations.css` at the real, single `components.css` your app
already serves:

```html
<link rel="stylesheet" href="src/styles/components.css" />
<link rel="stylesheet" href="css/cafe-operations.css" />
```

`cafe-operations.css` was written against that file's real token names
(`--ink-900`, `--bronze-500`, `--radius-card`, `--font-display`, etc.) and
its real component classes (`.auth-card`, `.auth-btn-primary`, `.auth-input`,
`.auth-password` + `.auth-show-toggle`, `.auth-modal*`, `.auth-code-digit`)
— every one of those was cross-checked against the actual file before
shipping, not assumed. It adds only new classes, all prefixed `cafeops-`,
for surface area the login page doesn't have (kiosk, PIN pad, context bar,
session menu, status icons).

## 3. Point the API client at the real origin

`js/api/cafeOpsApi.js` reads `window.ZAMORIN_API_BASE_URL` — the exact same
override variable the real `login.js` uses — and appends `/cafe-ops`. If
that global is already set somewhere in the real app's bootstrap, this
module picks it up automatically; nothing else to configure.

## 4. The one thing that's a placeholder on purpose

`js/screens/attendanceKiosk.js` looks for `window.CAFE_OPS_ATTENDANCE_QR_ENDPOINT`
to render the rotating check-in QR. It's unset by design — the real
Attendance module (rotating QR / GPS+selfie verification) isn't part of
this module and wasn't in this conversation's context. Until that global is
set, the kiosk shows an honest "connects here once wired up" placeholder
instead of a fake or broken QR. Expected response shape once it exists:
`{ qrSvg: "<svg>...</svg>" }` or `{ qrImageUrl: "https://..." }`.

**Likely integration shape**, based on what's recorded about the existing
Attendance module (GPS + live selfie + rotating QR verification): the kiosk
displays the rotating code shown here, and the *employee's own phone*
scans it and completes GPS+selfie verification on their end — this module
owns only the kiosk-side display and the "Open Cafe Operations" hand-off,
never the verification itself. Confirm this against the real Attendance
code before wiring the endpoint in.

## 5. Logo and icon — please keep this distinction

Every branded screen uses `assets/zamorin-logo-stacked.svg` (the full
lockup — icon + "ZAMORIN" + "ESTATE PVT. LTD.", baked in as real SVG text).
The `icon/` files from the brand kit (the rounded-square "Z" monogram) are
used in exactly one place: the favicon and the PWA home-screen icon
(`<link rel="icon">` / `<link rel="apple-touch-icon">` in
`cafe-operations.html`). Nowhere else. If any future screen in this module
is extended, keep it that way.

## 6. What's genuinely absent, not just deferred quietly

- **Governance management views** (Cafe Operations Devices / Operator
  Access / Operator Sessions tables) — the backend routes are built and
  tested (`../backend/README_INTEGRATION.md`); the admin-facing screens
  that call them are not part of this pass.
- **Native Android hardening** (FLAG_SECURE screenshot blocking, app-
  switcher redaction, Android Enterprise dedicated-device/kiosk mode) —
  these are OS-level capabilities a web page cannot grant itself. This is
  a PWA, not a native build. The closest honest web-level equivalent
  (blurring sensitive content on `visibilitychange`, disabling
  autocomplete on the PIN/password fields) is not yet implemented here
  either — flagging it rather than claiming partial coverage that wasn't
  actually built.
- **Offline sign-in** — deliberately not implemented; see
  `ARCHITECTURE_DECISIONS.md` section 5. Both auth paths fail closed
  without a live connection.

## 7. Verified, not just written

Every `.auth-*` class this module uses was cross-checked against the real
`components.css` and `login.js` files (script-driven diff, not eyeballing).
Every `.cafeops-*` class used in the JS has a real, matching CSS rule, and
every rule defined has a real call site (both directions checked). The
full resolver flow (no device → register; active device, no session →
kiosk; revoked device → correct status screen; active session → shell) was
run in an actual DOM via jsdom against a mocked backend, not just
syntax-checked — that caught two real bugs before they shipped: a
`renderBody` function that was called but never defined in the shell
screen, and a device-revoked check that looked for the wrong signal
entirely (a REVOKED device is rejected by the backend's `deviceContext`
middleware before any route handler runs, so the failure shows up as a 403
on the *error* path, not as a field in a successful response — the first
draft only checked the success path). Both are fixed in the delivered code.
