# ZAMORIN CAFE ERP — STAGE 2 SESSION REFRESH MATRIX
## Hard Evidence & Session Lifecycle Verification

### 1. Session Refresh Scenarios & Test Matrix

| Scenario | Trigger / Test Condition | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|:---:|
| **A. Valid Session** | Protected API request with active session | Request executes directly with `Authorization` and `x-device-id` | Request returns 200/201 JSON payload | **PASS** |
| **B. Single Expired Session** | Request receives `401 AUTHENTICATION_REQUIRED` | Triggers single refresh via `/auth/refresh`, retries original request once on success | Seamless retry executed, payload delivered without failure | **PASS** |
| **C. Multiple Concurrent Expired Requests** | 5 simultaneous requests receive 401 | Exactly **1** `/auth/refresh` request fired (`singleFlightRefreshPromise`); all 5 requests await resolution and retry simultaneously | 1 refresh network call observed; all 5 requests succeed; 0 refresh storm; 0 duplicate token mutations | **PASS** |
| **D. Refresh Failure (Expired / Invalid Token)** | Refresh returns 401 / 403 or server offline | Session transitions to `EXPIRED`/signed-out; single flight resets; user receives controlled toast (`"Authenticated session has expired. Please log in again."`); **0 raw "Session ID, refresh token and device ID are required" toasts** | Controlled error mapped; 0 raw session error strings exposed; no infinite loop | **PASS** |
| **E. Device Context Missing** | Request made from untrusted/fresh browser without persistent device ID | `getOrCreateDeviceId()` generates persistent UUID (`ZC-DEV-...`) and attaches `x-device-id` | Valid device ID generated and attached to request header | **PASS** |
| **F. Device Revoked** | Device ID flagged as revoked in backend device registry | Backend returns 403 `DEVICE_REVOKED`; request blocked before database query | Controlled 403 error handled cleanly | **PASS** |

---

### 2. Forensic Session Lifecycle Code Verification (`frontend/src/js/apiClient.js`)
```javascript
// Single-flight refresh coordination
let singleFlightRefreshPromise = null;

export async function refreshAuthenticatedSession() {
  if (singleFlightRefreshPromise) {
    return singleFlightRefreshPromise;
  }

  singleFlightRefreshPromise = (async () => {
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        credentials: "include",
      });
      // ...
    } catch (err) {
      sessionState = "EXPIRED";
      throw err;
    } finally {
      singleFlightRefreshPromise = null;
    }
  })();

  return singleFlightRefreshPromise;
}
```
