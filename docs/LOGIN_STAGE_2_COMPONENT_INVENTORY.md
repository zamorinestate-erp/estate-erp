# LOGIN STAGE 2 — FRONTEND COMPONENT INVENTORY

## Programme Context

**Stage**: 2 — Frontend Placement, Terminal Auth UI & Design-System Integration  
**Branch**: `feature/login-integration`  
**Stage-1 HEAD**: `5a3e3d689801984985d2fabf4a58459d2ded95b7`  
**Certified Zamorin Base**: `643c386f0a82684045c480cd9a80b9be6b5a3a6d`  
**login.js SHA-256 (zero-diff mandate)**: `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2`

---

## 1. Claude Package — Frontend Manifest

Source: `files/Login/zamorin-cafe-operations-v2.zip`  
Extracted to scratch: `scratch/login_pkg/frontend/`

| File | Role | Disposition |
|------|------|-------------|
| `cafe-operations.html` | Standalone entry point for the Claude package | **Not used** — Zamorin has its own Vite SPA entry |
| `css/components.base.css` | Login page base CSS (the REAL Zamorin login CSS) | **Not imported** — Zamorin's existing `components.css` already covers all `.auth-*` classes |
| `css/cafe-operations.css` | Scoped `.cafeops-*` terminal auth extension CSS | **Migrated** → appended to `frontend/src/styles/zamorin.css` |
| `assets/zamorin-logo-stacked.svg` | Wordmark logo (light) | **Not copied** — Zamorin uses `zamorin-estate-mark.png` |
| `assets/zamorin-logo-stacked-reversed.svg` | Wordmark logo (dark) | **Not copied** |
| `assets/icon-192.png`, `icon-512.png`, `favicon.ico` | PWA assets | **Not copied** — Zamorin has its own assets pipeline |
| `js/cafeOpsApp.js` | Standalone router / startup resolver | **Not used** — Zamorin's `router.js` is authoritative |
| `js/api/cafeOpsApi.js` | API client for the Claude standalone app | **Not used** — Zamorin's `apiClient.js` is authoritative |
| `js/state/sessionPolicyClient.js` | Session policy client | **Not used** — Stage-3 concern |
| `js/components/brandHeader.js` | Brand header component | **Superseded** — Zamorin renders its own `.login-brand` HTML inline |
| `js/components/pinPad.js` | 6-digit PIN pad component | **Pattern adopted** — CSS migrated; DOM pattern used in `cafeOperatorSignIn.js` (pre-existing) |
| `js/components/statusShell.js` | Generic status screen component | **Pattern adopted** — `cafeOperationsState.js` already covers this |
| `js/screens/attendanceKiosk.js` | Kiosk QR rotation + clock | **Not used** — `cafeAttendanceDisplay.js` is authoritative |
| `js/screens/cafeOperationsShell.js` | Post-auth shell (navigation, context bar) | **Not used** — Zamorin's full shell (`router.js` + `renderShell()`) is authoritative |
| `js/screens/deviceStatusHelp.js` | Device status/help diagnostics | **Not used** — `cafeOperationsState.js` covers this |
| `js/screens/operatorSignIn.js` | Operator PIN sign-in screen | **Not used** — `cafeOperatorSignIn.js` is authoritative |
| `js/screens/masterSignIn.js` | Master account sign-in + MFA | **Pattern adopted** → `cafeMasterSignIn.js` (new) |
| `js/screens/registerDevice.js` | Device enrollment screen | **Pattern adopted** → `cafeDeviceEnroll.js` (new) |
| `js/screens/sessionLocked.js` | Session locked screen | **Pattern adopted** → `cafeOpsInactivity.js` + existing lock modal |
| `js/screens/welcome.js` | Post-auth welcome flash | **Pattern adopted** → `cafeTerminalWelcome.js` (new) |
| `README_INTEGRATION.md` | Integration guide | **Read** — used for integration decisions |

---

## 2. Zamorin Frontend — New Files Created (Stage 2)

| File | Purpose |
|------|---------|
| `frontend/src/js/pages/cafeMasterSignIn.js` | Master terminal sign-in: credentials step + MFA step. Stage-3 seams clearly labeled. |
| `frontend/src/js/pages/cafeDeviceEnroll.js` | Device enrollment: one-time code → device binding. Full state machine. |
| `frontend/src/js/pages/cafeTerminalWelcome.js` | Terminal welcome hub: selects between Operator PIN, Master Access, Enroll, Kiosk. |

---

## 3. Zamorin Frontend — Modified Files (Stage 2)

| File | Change |
|------|--------|
| `frontend/src/styles/zamorin.css` | Appended scoped `.cafeops-*` CSS (PIN pad, device strip, connection badge, diag rows, pills, master badge, menus, animations, theme overrides). |
| `frontend/src/js/navigation.js` | Extended `IMPLICIT_ROUTES_CAFE_ADMIN` with 3 new routes: `cafe-master-signin`, `cafe-device-enroll`, `cafe-terminal-welcome`. |
| `frontend/src/js/router.js` | Added 3 new imports + 3 new route `case` blocks with Stage-3 seam stubs. |

---

## 4. Protected File — Zero-Diff Verified

| File | Status |
|------|--------|
| `frontend/src/js/pages/login.js` | **UNCHANGED** — SHA-256 `C4E2006502A8A39550587D5FB29DE2D296BF06DFCBF5755DCC7143064FA3C1A2` verified |

---

## 5. Architecture Decisions

### 5.1 Why `cafeMasterSignIn.js` instead of Claude's `masterSignIn.js`

Claude's `masterSignIn.js` uses `global.CafeOpsApp.navigate()`, `global.CafeOpsApi.*`, and IIFE-on-`window` patterns — incompatible with Zamorin's ES module router. A Zamorin-native port was written using the same contract (credentials → MFA → Stage-3 callback) but with:
- ES module `export` instead of IIFE globals
- Zamorin's `.login-brand` + `.login-card` shell instead of Claude's `.auth-card`
- Zamorin's `.auth-input`, `.auth-error-banner`, `.btn-primary` classes
- Stage-3 seams clearly named `onSignIn`, `onMfaVerify`

### 5.2 Why CSS was appended to `zamorin.css` rather than a separate file

The Zamorin design system is loaded as a single stylesheet chain. Adding a separate CSS file would require modifying `index.html`. Appending to `zamorin.css` ensures the `.cafeops-*` classes are available everywhere the existing `.login-card` and `.auth-*` classes are, with zero load-order risk. The block is clearly delimited and can be extracted to its own file at any time.

### 5.3 Why `cafe-terminal-welcome` is a hub not an overlay

The Stage 1 audit (§58) notes the existing `cafeOpsInactivity.js` handles the inactivity lock overlay. `cafe-terminal-welcome` is the **route-level** entry point for the terminal when no session is active — it is not an inactivity modal. They serve different purposes and do not overlap.

### 5.4 Stage-3 seams are deliberate not-connected stubs

`onSignIn: undefined`, `onMfaVerify: undefined`, `onEnroll: undefined` in `router.js` are intentional. Each page's wire function detects `typeof callback !== 'function'` and shows a clear "Stage 3 backend integration required" message rather than a mock success. This is the correct fail-safe behaviour: no credential is ever trusted without a real backend response.
