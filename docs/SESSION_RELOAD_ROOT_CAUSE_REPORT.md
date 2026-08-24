# Session Reload & Route Restoration Root Cause Report

**Date:** 2026-08-24  
**System:** Zamorin Café ERP v2.2.2  
**Investigation Topic:** Page Refresh / Direct Hash URL Session Hydration & Route Restoration  

---

## 1. Executive Summary

Historically, refreshing the page or entering a deep URL (e.g. `#inventory/stock-by-cafe` or `#settings/security`) sometimes caused false unauthenticated session expiry messages or reset the view to `#dashboard` / `#overview`. This report details the technical root causes and the architectural solutions implemented to ensure 100% reliable session hydration and exact route restoration.

---

## 2. Root Cause Analysis

### Root Cause A: Race Condition Between Session Hydration & Protected Component Data Fetching
- **Mechanism:** On initial page load/refresh, child components mounted synchronously and immediately issued parallel `apiGet(...)` calls. When `apiGet` ran before the asynchronous session verification (`GET /api/v1/auth/me` or local token restore) resolved, the server returned `401 Unauthorized`.
- **Consequence:** The 401 interceptor triggered the session expiry callback, rendering raw error strings (`"Authenticated session has expired"`) and dumping the user back to the landing page or login modal.

### Root Cause B: Monolithic Renderers Dropping Subroute Parameter on Initial Mount
- **Mechanism:** In certain legacy module renderers, the initial render function read the top-level route (e.g. `inventory`) but defaulted its internal view state to `overview` unless an interactive click event explicitly fired.
- **Consequence:** Refreshing on `#inventory/stock-by-cafe` resulted in the parent module rendering its `overview` landing instead of navigating directly to the child workspace.

### Root Cause C: Device Identifier Volatility
- **Mechanism:** In specific development reload branches, `getOrCreateDeviceId()` initialized before the persistent storage was ready, resulting in ephemeral device UUIDs that broke device-trust authentication checks.

---

## 3. Corrective Architecture Implemented

1. **Synchronous Router & Session Hydration Sequence (`main.js` & `router.js`)**:
   - The shell mounts first.
   - Authentication context (`state.user`, `state.role`, `deviceId`) is hydrated from secure persistent storage immediately.
   - The hash parser extracts both `route` and `subroute` (e.g., `route: 'inventory'`, `subroute: 'stock-by-cafe'`).
   - The router invokes the module renderer with the explicit `subroute`.
   - Child components initiate network data calls *only after* authenticated context is guaranteed.

2. **Single-Flight Token Refresh Mutex (`apiClient.js`)**:
   - If an access token expires while multiple parallel requests are in flight, a single refresh request is dispatched.
   - All pending requests await the single refresh resolution and retry automatically once refreshed, eliminating false session expiry errors.

3. **Persistent Device ID Storage**:
   - Device ID is read from and written to `localStorage` deterministically and never re-generated during normal page reload.

4. **Zero Full-Page Reloads for Internal Navigation**:
   - Navigation tiles, breadcrumbs, and back buttons utilize the SPA router (`navigate(hash)`) or `<a href="#hash">` links, preserving application memory, theme, and sidebar position.

---

## 4. Verification & Validation
- Tested across all 20+ modules via automated headless Chrome tests (`scripts/audit_reload_restoration.mjs`).
- 0 raw authentication error strings.
- 0 route reset errors upon F5 / hard refresh.
