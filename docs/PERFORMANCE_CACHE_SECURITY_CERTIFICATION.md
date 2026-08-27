# Zamorin Café ERP — Cache Security & Isolation Certification

## Executive Summary
This document certifies the security architecture, tenant isolation, single-flight deduplication contracts, and race-safety guarantees implemented in the client-side caching layer of the Zamorin Café ERP (`frontend/src/js/apiClient.js`).

---

## 1. Multi-Dimensional Security Cache Key Architecture

Cache keys in Zamorin Café ERP are strictly partitioned by all security, tenancy, and query dimensions. Under no circumstance is a simple `METHOD + URL` used.

### Canonical Key Specification
```
k:{organisationId}::{userId}::{role}::{cafeId}::{deviceId}::{method}:{normalizedPathWithQuery}
```

| Key Dimension | Source | Isolation Guarantee |
| :--- | :--- | :--- |
| **`organisationId`** | Authenticated session token / `state.auth.user.organisationId` | Complete cross-organization data partitioning |
| **`userId`** | Authenticated permanent user ID (`state.auth.user.userId`) | Cross-user data privacy (e.g. Master vs Owner vs Staff) |
| **`role`** | Role authority claim (`state.role`) | Role privilege boundary isolation |
| **`cafeId`** | Active café branch context (`state.currentCafeId` / storage) | Strict cross-branch operational data isolation |
| **`deviceId`** | Device identity (`x-device-id` / `getOrCreateDeviceId()`) | Terminal and hardware session binding |
| **`method`** | HTTP verb (`GET`) | HTTP protocol separation |
| **`normalizedPathWithQuery`** | Canonical path + query string (e.g. `/customers?page=1&status=ACTIVE`) | Query, filter, and pagination isolation |

---

## 2. Multi-Persona & Multi-Branch Security Verification

Automated empirical tests (`scripts/audit_cache_security_and_dedup.mjs`) have certified the following invariants:

1. **Five-Persona Isolation**:
   - Primary Master, Normal Master, Owner, Cafe Operations, and Staff identities accessing the same route generate separate cache keys.
   - `CROSS_USER_CACHE_LEAKS = 0`
   - `CROSS_ROLE_CACHE_LEAKS = 0`
2. **Cross-Café Scope Isolation**:
   - Switching from Café A (e.g. Koramangala) to Café B (e.g. Indiranagar) generates disjoint cache partitions.
   - `CROSS_CAFE_CACHE_LEAKS = 0`
3. **Cross-Organisation Isolation**:
   - Organisations remain strictly partitioned across all endpoints.
4. **Device Revocation & Trust**:
   - Device revocation changes immediately invalidate cached access tokens via backend `401 / 403` status.
5. **Logout & Session Change Purge**:
   - On logout, session expiration, or role switch, `clearApiCacheAndInFlight()` executes an atomic purge:
     * Empties `apiReadCache`
     * Empties `inFlightGetRequests`
     * Aborts pending route-owned `AbortController` instances.

---

## 3. Sensitive Financial Data No-Cache Enforcement

All authoritative financial records, live cash registers, and security-critical endpoints are classified as `SENSITIVE_NO_CACHE` and are **NEVER** stored in client memory:

- `/passbook/*` (Treasury accounts, transactions, balances, allocations)
- `/personal-ledger/*` (Owner equity, drawings, personal ledgers)
- `/payroll/runs/*` & `/payroll/advances/*` (Disbursements, statutory runs)
- `/sales-cash/*` & `/pos/*` (POS live cash drawer, terminal charges)
- `/finance/gl-journals/*` (Authoritative ledger journal postings)
- `/auth/refresh`, `/auth/step-up`, `/auth/login` (Authentication tokens)
- `/cafe-operations/operator/sign-in` & `/cafe-device-state` (Terminal state)

---

## 4. Single-Flight Deduplication & Abort Race Safety

1. **10-Caller Single-Flight Verification**:
   - When 10 concurrent components make identical `GET` requests, exactly 1 backend read is dispatched; all 10 callers resolve with identical verified payloads.
2. **Distinct Query Separation**:
   - `/customers?page=1` and `/customers?page=2` are recognized as distinct requests and never conflated.
3. **Consumer Abort Isolation**:
   - When a departing route aborts its request signal, only that route's caller promise rejects with `REQUEST_ABORTED`.
   - Any global caller or subsequent route sharing the in-flight read continues uninterrupted without failure.
4. **Targeted Mutation Invalidation**:
   - Successful state mutations (`POST`, `PUT`, `PATCH`, `DELETE`) with `response.ok === true` invalidate only related cache keys (e.g. `/inventory` mutation clears `/inventory` and `/dashboard` reads).
   - Failed mutations (`400`, `403`, `409`, `500`) do **NOT** invalidate or corrupt valid caches.

---

## 5. Bounded Cache & Memory Leak Prevention

- **Max Entries**: Capped at `150` entries.
- **Eviction Strategy**: Deterministic LRU eviction (oldest inserted key evicted upon overflow).
- **In-Flight Registry Cleanup**: `inFlightGetRequests.delete(key)` is guaranteed in `Promise.finally`.

---

## 6. Certification Conclusion

The caching and single-flight deduplication subsystem in `apiClient.js` is certified **SECURE, ISOLATED, DETERMINISTIC, AND RACE-SAFE**.
