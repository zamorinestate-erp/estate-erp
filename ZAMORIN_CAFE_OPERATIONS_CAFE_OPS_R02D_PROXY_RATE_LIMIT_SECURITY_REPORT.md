# ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS (CAFÉ OPS-R02D)

## TRUSTED PROXY, CLIENT-IP INTEGRITY & AUTHENTICATION RATE-LIMIT SECURITY HARDENING REPORT

**Document ID:** `ZAMORIN-CAFE-OPS-R02D-PROXY-RATE-LIMIT-SECURITY-REPORT`  
**Security Classification:** CONFIDENTIAL — INTERNAL ARCHITECTURAL SPECIFICATION  
**Author:** Senior Principal Backend Engineer, Application Security Engineer, Network/Proxy Security Engineer & QA Lead  
**Scope:** Final Micro-Fix Before Café Operations is Parked  
**Date:** 2026-09-07  
**Status:** IMPLEMENTATION COMPLETE & REGRESSION VERIFIED — PARKED  

---

## 1. Baseline

- **Repository:** `d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE`
- **Branch:** `main`
- **Commit HEAD:** `742762abe2a0952ec38817792e788ee7f3ed6f2a`
- **Café Operations Controls:** 272 Controls (`CTL-001` through `CTL-272`) fully preserved
- **Pre-R02D Regression Baseline:** 1,541 / 1,541 PASS (19 suites, 153 test files)
- **Security Baseline:**
  - P0: 0
  - P1: 0
  - P2: 0
  - P3: 0
  - Cross-Café Leakage: 0
  - Cross-Organisation Leakage: 0
  - IDOR: 0
  - Privilege Escalation: 0
  - CAFÉ OPERATIONS DEVELOPMENT: PARKED

---

## 2. Scope

CAFÉ OPS-R02D addressed exclusively the security and integrity of trusted proxy configuration, client-IP extraction, and authentication rate limiting:

1. **R02D-01:** Audit and correct Express trust-proxy configuration.
2. **R02D-02:** Establish trustworthy client-IP derivation.
3. **R02D-03:** Remove unsafe manual leftmost-X-Forwarded-For assumptions.
4. **R02D-04:** Implement separate per-IP and per-account authentication rate limits.
5. **R02D-05:** Normalize IPv4/IPv6 rate-limit keys safely.
6. **R02D-06:** Check express-rate-limit version/security status.
7. **R02D-07:** Preserve optional/legacy MFA/passkey routes without reintroducing mandatory TOTP.
8. **R02D-08:** Add spoofing, bypass, and multi-proxy regression tests.
9. **R02D-09:** Run complete regression and park Café Operations again.

---

## 3. Network Topology Discovery

The actual network topology for Zamorin Café ERP exhibits two distinct ingress paths:

1. **Path A — Proxied through Vercel Edge:**
   $$\text{Browser} \longrightarrow \text{Vercel Frontend Edge} \xrightarrow{\text{Rewrite /api/*}} \text{Render Ingress/LB} \longrightarrow \text{Node.js Express Container}$$
   - Configured in `frontend/vercel.json` and root `vercel.json` (`/api/(.*)` rewrites to `https://zamorin-cafe-erp-backend.onrender.com/api/$1`).
   - Vercel forwards client IP in `x-forwarded-for` and appends its edge proxy hops.

2. **Path B — Direct Ingress to Render Backend:**
   $$\text{Client / POS Terminal / Attacker} \longrightarrow \text{Render Ingress/LB} \longrightarrow \text{Node.js Express Container}$$
   - Render public URL (`https://zamorin-cafe-erp-backend.onrender.com`) is directly routable on the public internet.
   - Any external client can establish a TCP connection directly to Render's load balancer without passing through Vercel.

---

## 4. Direct Backend Access

Because Direct Path B is publicly routable, the Express backend must **never** blindly assume requests arrived via Vercel.

- **Risk Identified:** If Express blindly trusts all hops or relies on client-supplied headers like `x-vercel-forwarded-for`, a direct attacker connecting to Render could forge arbitrary client addresses.
- **Remediation:** Ingress headers are trusted **only** when the immediate socket peer is a verified trusted proxy hop.

---

## 5. Existing Trust Proxy Configuration

Prior to R02D, `backend/src/server.js` contained:
```javascript
// BEFORE (Vulnerable):
app.set('trust proxy', true);
```
- **Flaw:** `trust proxy = true` instructs Express to trust **every single hop** in `X-Forwarded-For`. Under this setting, Express resolves `req.ip` as the leftmost entry in the header.
- An attacker connecting directly to Render who sends `X-Forwarded-For: 1.2.3.4` would have `1.2.3.4` adopted by Express as their identity, completely bypassing IP rate limiting.

---

## 6. Trust Proxy Correction

`app.set('trust proxy', true)` was eliminated. It is replaced by a topology-aware trust model:

```javascript
// AFTER (Secure Topology-Aware):
const trustedProxies = getTrustedProxies(process.env.TRUSTED_PROXY_CIDRS);
app.set('trust proxy', trustedProxies);
```

- **Default Trusted Proxies:** `['loopback', 'linklocal', 'uniquelocal']`.
  - In Render, the internal load balancer forwards requests across the private container network (`10.0.0.0/8`, covered by `uniquelocal`).
  - In local development and automated testing, connections arrive via `127.0.0.1` / `::1` (covered by `loopback`).
- **Environment Overrides:** `process.env.TRUSTED_PROXY_CIDRS` allows configuring custom proxy CIDRs (e.g. `198.51.100.0/24`) without hardcoding transient infrastructure IPs into source code.
- **Startup Validation:** Invalid or malformed CIDRs/IPs cause an immediate, clear configuration exception during startup rather than silently failing open.

---

## 7. Client IP Canonicalization

In `backend/src/utils/clientIp.js`:
- **Removed:** Manual `forwardedFor.split(',')[0].trim()` parsing.
- **Canonical Implementation:** `getTrustedClientIp(req)` relies strictly on `req.ip` (or `req.socket.remoteAddress` fallback).
- Express and `proxy-addr` evaluate the proxy chain from the immediate socket inwards, traversing only trusted hops and stopping at the **first untrusted hop**.

---

## 8. Vercel Header Analysis

- `x-vercel-forwarded-for` is not cryptographically authenticated by the backend and can be injected by direct callers to Render.
- Under R02D, `x-vercel-forwarded-for` is **not** used as an authoritative client identity. Authority derives solely from Express's proxy-trust chain resolution of the standard `X-Forwarded-For` header traversed through trusted proxies.

---

## 9. Render Proxy Analysis

- Render's load balancer terminates TLS and forwards requests to Express via private internal IPs (`10.x.x.x`).
- Render's LB appends the true peer IP to the right of `X-Forwarded-For`.
- Because `uniquelocal` (`10.0.0.0/8`) is trusted, Express traverses past Render's private hop and identifies the true connecting peer IP as `req.ip`.

---

## 10. Forwarded Header Spoofing

| Scenario | Connecting Socket IP | Injected Header | Resolved `req.ip` | Security Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Direct untrusted request** | `203.0.113.195` (untrusted) | `X-Forwarded-For: 1.2.3.4` | `203.0.113.195` | **BLOCKED:** Injected header ignored. |
| **Trusted proxy request** | `10.0.0.1` (trusted `uniquelocal`) | `X-Forwarded-For: 1.2.3.4, 203.0.113.195` | `203.0.113.195` | **BLOCKED:** Stops at first untrusted hop. |
| **Multi-hop trusted proxies** | `127.0.0.1` (trusted loopback) | `X-Forwarded-For: 203.0.113.77, 10.0.0.1` | `203.0.113.77` | **ACCURATE:** Client IP correctly resolved. |

---

## 11. IPv4 Handling

- Standard IPv4 addresses (e.g. `198.51.100.25`) normalize directly without truncation or distortion.
- Individual IPv4 clients do not collide into shared buckets.

---

## 12. IPv6 Handling

- **`ipKeyGenerator`** from `express-rate-limit` is used for all IP-keyed limiters.
- **IPv4-Mapped IPv6:** Addresses such as `::ffff:192.0.2.10` normalize to their IPv4 representation (`192.0.2.10`). Distinct IPv4 clients never collapse into a shared IPv6 subnet.
- **IPv6 Subnet Normalization:** Normal IPv6 addresses inside the same `/56` allocation (e.g. `2001:db8:85a3::/56`) normalize to the same subnet key, preventing trivial rotation bypasses within ISP blocks.

---

## 13. express-rate-limit Version Review

- **Installed Version:** `8.6.1`
- **Known Affected Releases:** `8.0.0`, `8.0.1`, `8.1.0`, `8.2.0`, `8.2.1` (CVE-2024-52596)
- **Status:** **SAFE / NOT AFFECTED.** `8.6.1` is on the modern `>= 8.3.0` line and includes all upstream IPv6 subnet normalization and security patches.
- **Upgrade Required:** **NO.** No unnecessary dependency churn performed.

---

## 14. Per-IP Limiter

- **Endpoint:** `POST /api/v1/auth/login`
- **Key Generator:** `ipKeyGenerator(getTrustedClientIp(req))`
- **Window:** 15 minutes
- **Threshold:** 50 requests (configurable via `AUTH_RATE_LIMIT_IP_MAX`)
- **Action:** Protects against credential stuffing from a single machine or compromised NAT gateway across hundreds of accounts.

---

## 15. Per-Account Limiter

- **Endpoint:** `POST /api/v1/auth/login`
- **Key Generator:** `normalizeAccountKey(req, 'email')`
  - Normalizes `orgId.toUpperCase()` + `email.toLowerCase()`.
  - Produces a deterministic SHA-256 pseudonym: `auth:acct:<hash32>`.
  - Raw passwords, tokens, and plaintext email addresses are **never** stored in rate-limit memory.
- **Window:** 15 minutes
- **Threshold:** 10 requests (configurable via `AUTH_RATE_LIMIT_ACCOUNT_MAX`)
- **Action:** Protects against distributed brute-force attacks rotating source IPs against a single targeted employee account.

Both limiters execute sequentially. If **either** limit is reached, an HTTP 429 response is returned with a generic, friendly message that prevents account enumeration.

---

## 16. Password Reset Limits

- **Endpoint:** `POST /api/v1/auth/password/forgot`
- **Dual Protection:**
  1. `passwordResetIpRateLimiter`: 15 requests / 15 min per IP.
  2. `passwordResetAccountRateLimiter`: 5 requests / 15 min per account (`orgId + email`).
- **Outcome:** Prevents distributed attackers from flooding an employee's mailbox with reset codes while preserving anti-enumeration semantics.

---

## 17. MFA/Passkey Route Review

- **Mandatory TOTP Reintroduced:** **NO.**
- **Classification Register:**

| Route | Status | Mandatory? | Reachable? | Rate Limited? | UI Exposed? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /auth/login` | ACTIVE_PRIMARY | NO (Password) | YES | YES (Dual: IP + Acct) | YES |
| `POST /auth/password/forgot` | ACTIVE_PRIMARY | NO | YES | YES (Dual: IP + Acct) | YES |
| `POST /auth/password/reset/verify` | ACTIVE_PRIMARY | NO | YES | YES (IP) | YES |
| `POST /auth/password/reset` | ACTIVE_PRIMARY | NO | YES | YES (IP) | YES |
| `POST /auth/passkeys/authenticate/*` | ACTIVE_OPTIONAL | NO | YES | YES (Dual: IP + Acct) | YES (WebAuthn) |
| `POST /auth/passkeys/register/*` | ACTIVE_OPTIONAL | NO | YES (Auth) | YES (IP) | YES (Settings) |
| `POST /auth/mfa/setup` | ACTIVE_OPTIONAL | NO | YES | YES (Dual: IP + Acct) | YES (Settings) |
| `POST /auth/mfa/confirm` | ACTIVE_OPTIONAL | NO | YES | YES (Dual: IP + Acct) | YES (Settings) |
| `POST /auth/mfa/verify` | ACTIVE_OPTIONAL | NO | YES | YES (Dual: IP + Acct) | YES (Step-Up) |
| `POST /auth/step-up` | ACTIVE_OPTIONAL | NO | YES (Auth) | YES (IP) | YES (Sensitive) |

---

## 18. Global API Limiter

- `backend/src/server.js` `apiLimiter` updated to use `ipKeyGenerator(getTrustedClientIp(req))`.
- Global limiter and authentication limiters now use the **identical canonical client IP source and IPv6 normalization engine**.

---

## 19. Rate-Limit Store Review

- **Current Implementation:** In-process `MemoryStore` (default in `express-rate-limit`).
- **Render Topology:** Render runs a single backend service instance (`zamorin-cafe-erp-backend`). MemoryStore provides fast, zero-dependency in-process isolation.
- **Multi-Instance Compatibility:** `DistributedRateLimiter` abstraction exists in `backend/src/services/distributedRateLimiter.js` and is architected for seamless migration to Redis if Render horizontal autoscaling is enabled in future programmes.

---

## 20. Proxy Security Tests

Tested in `backend/test/cafeOpsR02DProxyRateLimitSecurity.test.js`:
- `Area 1: Express Trust Proxy & Spoofed X-Forwarded-For Defense` — PASS
- `Area 2: Startup Validation & Environment-Driven Configuration` — PASS

---

## 21. Rate-Limit Bypass Tests

Tested in `backend/test/cafeOpsR02DProxyRateLimitSecurity.test.js`:
- `Area 3: express-rate-limit Version & IPv4/IPv6 Key Normalization` — PASS
- `Area 4: Independent Login Rate Limiters (Dual-Bucket Architecture)` — PASS
- `Area 5: Password Reset Dual-Limiter Protection & Anti-Automation` — PASS
- `Area 6: Account Identifier Normalization & Privacy Pseudonymization` — PASS

---

## 22. Frontend 429 Regression

Tested in `backend/test/cafeOpsR02DProxyRateLimitSecurity.test.js`:
- `Area 7: Frontend 429 Resilience & Submission Recovery` — PASS
- `login2.js` explicitly recovers submission state in `finally`:
  - `isSubmitting = false`
  - `clearTimeout(progressTimer)`
  - `submitBtn.disabled = false`
  - User-friendly message displayed: *"Too many sign-in attempts detected. Please wait a moment before trying again."*

---

## 23. Targeted Tests

- **Suite:** `backend/test/cafeOpsR02DProxyRateLimitSecurity.test.js`
- **Result:** **8 passed, 0 failed** (100% PASS)

---

## 24. Full Regression

- **Command:** `npm --prefix backend test`
- **Total Test Files:** 154
- **Total Tests Passed:** 1,549
- **Total Tests Failed:** 0
- **Total Tests Skipped:** 0
- **Net Increase:** +8 tests over the R02C baseline (1,541 $\to$ 1,549)

---

## 25. Static Validation

- **Backend JS Validation (`npm run check`):** 378/378 files passed (PASS).
- **Frontend Router Validation (`verifyRouterImports.mjs`):** All router imports validated (PASS).
- **Git Diff Hygiene (`git diff --check`):** 0 issues (PASS).

---

## 26. Security Regression

- **P0 / P1 / P2 / P3 Defects:** 0
- **Cross-Café Leakage:** 0
- **Cross-Organisation Leakage:** 0
- **IDOR / Privilege Escalation:** 0
- **Forwarded-Header Spoof Bypass:** 0
- **Rate-Limit Identity Bypass:** 0
- **IPv6 Rate-Limit Bypass:** 0
- **Account-Distribution Bypass:** 0
- **Username-Rotation-From-One-IP Bypass:** 0

---

## 27. Changed Files

1. `backend/src/utils/clientIp.js` — Canonicalized `getTrustedClientIp` to use `req.ip` via Express proxy trust resolution; added `getTrustedProxies`, `isValidProxyEntry`, and startup validation.
2. `backend/src/server.js` — Configured topology-aware `trust proxy` and unified `apiLimiter` with `ipKeyGenerator(getTrustedClientIp(req))`.
3. `backend/src/routes/authRoutes.js` — Implemented independent per-IP and per-account rate limiters with privacy-safe pseudonymous hashing, IPv6 normalization, and security event emission.
4. `backend/.env.example` — Documented `TRUSTED_PROXY_CIDRS` and auth rate limiting overrides.
5. `backend/test/cafeOpsR02DProxyRateLimitSecurity.test.js` [NEW] — 7-area security test suite verifying all R02D proxy, IP integrity, and rate limiting invariants.

---

## 28. Non-Deployment Confirmation

- **Production Index Creation:** NOT PERFORMED
- **Production Migrations:** NOT PERFORMED
- **FINAL-00:** NOT PERFORMED
- **Final Security Certification:** NOT PERFORMED
- **Production Deployment:** NOT PERFORMED
- **Git Push:** NOT PERFORMED

---

## 29. Final R02D Status

**CAFÉ OPS-R02D IMPLEMENTATION COMPLETE & REGRESSION VERIFIED**

---

## 30. Café Operations Parking Decision

**CAFÉ OPERATIONS DEVELOPMENT: OFFICIALLY PARKED.**

No further business feature or infrastructure changes may be made without explicit Owner authorisation.

---

## Required Matrices

### A. Evidence Matrix

| Area | Before | Fix | Test | Result |
| :--- | :--- | :--- | :--- | :--- |
| **trust proxy** | `app.set('trust proxy', true)` | `getTrustedProxies()` (topology-aware) | `Area 1` | **PASS** |
| **client IP** | Manual leftmost `XFF.split(',')[0]` | Express `req.ip` via proxy-addr | `Area 1` | **PASS** |
| **XFF spoofing** | Vulnerable to fake leftmost header | Stopped at nearest untrusted peer | `Area 1` | **PASS** |
| **IPv6** | Raw string / potential collapse | `ipKeyGenerator` /56 subnet | `Area 3` | **PASS** |
| **per-IP limiter** | Missing on `/login` | `loginIpRateLimiter` (50 / 15m) | `Area 4` | **PASS** |
| **per-account limiter** | Missing independent limiter | `loginAccountRateLimiter` (10 / 15m) | `Area 4` | **PASS** |
| **password reset** | Combined IP+email bucket | Independent IP + Acct limiters | `Area 5` | **PASS** |
| **MFA/passkey** | Combined bucket | Independent IP + Acct limiters | `Area 6` | **PASS** |
| **429 frontend recovery** | Verified | `isSubmitting = false` in finally | `Area 7` | **PASS** |

### B. Proxy Trust Matrix

| Request Path | Immediate Peer Trusted? | Forwarded Header Trusted? | Derived Client IP | Expected | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Local development** | YES (`127.0.0.1` loopback) | N/A (no header) | `127.0.0.1` | `127.0.0.1` | **PASS** |
| **Trusted proxy path** | YES (`10.0.0.1` uniquelocal) | Evaluated inwards | `203.0.113.195` | `203.0.113.195` | **PASS** |
| **Multi-hop trusted path**| YES (`127.0.0.1` & `10.0.0.1`) | Traversed to first untrusted | `203.0.113.77` | `203.0.113.77` | **PASS** |
| **Direct backend request**| NO (`203.0.113.195`) | NO (untrusted socket) | `203.0.113.195` | `203.0.113.195` | **PASS** |
| **Spoofed forwarded header**| YES (`127.0.0.1` loopback) | Stopped at nearest untrusted | `203.0.113.50` | `203.0.113.50` | **PASS** |
| **Malformed forwarded header**| YES (`127.0.0.1` loopback) | Fails safely | `127.0.0.1` | Safe string | **PASS** |

### C. Rate-Limit Matrix

| Scenario | IP Bucket | Account Bucket | Expected | Actual | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1 IP $\to$ 1 account** | Shared | Shared | Both pass (or trigger on overload) | Passed / throttled | **PASS** |
| **1 IP $\to$ Many accounts (Stuffing)** | Fills rapidly | Individual accounts low | IP limiter blocks with 429 | HTTP 429 (IP) | **PASS** |
| **Many IPs $\to$ 1 account (Brute-force)** | Individual IPs low | Fills rapidly | Account limiter blocks with 429 | HTTP 429 (Account) | **PASS** |
| **Normal different clients** | Separate buckets | Separate buckets | Both pass | HTTP 200 | **PASS** |
| **IPv6 rotation in /56** | Shares /56 bucket | Account evaluated | Normalizes to same subnet | Same bucket | **PASS** |

### D. Dependency Result

- `express-rate-limit version before:` **8.6.1**
- `express-rate-limit version after:` **8.6.1**
- `Known affected release:` **NO**
- `Upgrade required:` **NO**
- `Upgrade scope:` **None**

### E. MFA/Passkey Register Summary

- `Mandatory TOTP reintroduced:` **NO**
- All MFA and WebAuthn/Passkey routes retain dual rate-limiting while keeping standard login password-based.
