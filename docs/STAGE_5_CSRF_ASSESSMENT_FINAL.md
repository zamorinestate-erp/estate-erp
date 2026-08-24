# ZAMORIN CAFE ERP
## STAGE 5 — CSRF & AUTHENTICATION ASSESSMENT (FINAL)

### 1. Authentication Transport Architecture
- **Token Transport**: The Zamorin Cafe ERP uses short-lived JWT Access Tokens supplied via the standard `Authorization: Bearer <token>` HTTP request header for all state-mutating API requests.
- **Refresh Token Storage**: Refresh tokens are stored in `HttpOnly`, `SameSite=Lax` (or `SameSite=Strict` in production) cookies solely to facilitate `/api/v1/auth/refresh` operations.
- **Identity Resolution**: `backend/src/middleware/authenticate.js` extracts the bearer token, verifies signature and `sessionVersion`, and enforces tenant isolation.

### 2. CSRF Threat Model Evaluation

| Threat Vector | Evaluated Scenario | Architectural Mitigation | Risk Classification |
|---|---|---|:---:|
| **Cross-Origin Form POST** | Malicious site executes `<form action="http://erp.../api/v1/bills/settle" method="POST">` | Browser does NOT attach `Authorization: Bearer` header to cross-origin form submissions. The request fails `401 Unauthorized`. | **NOT APPLICABLE / FULLY MITIGATED** |
| **Cross-Origin Fetch / XHR** | Malicious script attempts cross-origin `fetch()` with credentials | CORS policy restricts allowed origins. Even if attempted, the script cannot read or attach the user's memory-stored bearer token. | **NOT APPLICABLE / FULLY MITIGATED** |
| **Refresh Token Endpoint CSRF** | Cross-origin image or script triggers `/api/v1/auth/refresh` | `SameSite=Lax` blocks third-party cookie transmission. Furthermore, the endpoint requires client session metadata matching the active token family. | **MITIGATED** |

### 3. Conclusion
- **CSRF Classification**: `NOT APPLICABLE UNDER CURRENT BEARER-HEADER AUTH MODEL`.
- **Reasoning**: State-mutating API requests are authenticated strictly via `Authorization: Bearer` headers rather than ambient browser cookie authentication. Separate CSRF token machinery is therefore not required.

---
**CSRF Assessment Certified:** Authentication model is resilient against cross-site request forgery attacks.
