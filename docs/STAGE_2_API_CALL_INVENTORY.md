# ZAMORIN CAFE ERP — STAGE 2 API CALL INVENTORY

**Scope**: Complete Frontend API Invocation Audit  
**Target Workspaces**: Primary Master · Normal Master · Owner · Cafe Operations  
**Date**: 2026-08-23  

---

## 1. Classification Taxonomy

- **Class A (PUBLIC)**: Unauthenticated endpoints (e.g. `/health`, `/auth/login`, `/auth/password/*`).
- **Class B (AUTHENTICATED)**: Protected REST endpoints requiring active session and valid role permissions.
- **Class C (AUTHENTICATED + DEVICE TRUST)**: High-security operational and financial routes requiring verified device fingerprint.
- **Class D (FILE DOWNLOAD / EXPORT)**: Endpoints returning binary blobs (PDF, XLSX, CSV).
- **Class E (UPLOAD)**: Multipart form data endpoints.
- **Class F (STREAM / SPECIAL)**: Server-sent events or real-time polling.
- **Class G (LEGACY / UNKNOWN)**: Deprecated direct fetch or unmapped endpoints.

---

## 2. Comprehensive Inventory of Frontend API Invocations

| Module / File | Endpoint Path | HTTP Method | Request Class | Current Transport | Migration / Compliance Status |
|---|---|:---:|:---:|---|:---:|
| `main.js` | `/auth/me` | GET | B | `apiGet` | **Canonical** |
| `router.js` | `/cafe-operations/operator/sign-in` | POST | C | `apiPost` | **Canonical** |
| `sessionManagement.js` | `/settings/sessions` | GET | B | `apiGet` | **Canonical** |
| `sessionManagement.js` | `/auth/logout` | POST | B | `apiPost` | **Canonical** |
| `sessionManagement.js` | `/settings/sessions/:id` | DELETE | B | `apiDelete` | **Canonical** |
| `sessionManagement.js` | `/settings/sessions/revoke-others` | POST | B | `apiPost` | **Canonical** |
| `sessionManagement.js` | `/auth/logout-all` | POST | B | `apiPost` | **Canonical** |
| `dashboardMaster.js` | `/dashboard` | GET | B | `apiGet` | **Canonical** |
| `dashboardMaster.js` | `/dashboard/saved-views` | GET | B | `apiGet` | **Canonical** |
| `dashboardMaster.js` | `/dashboard/saved-views` | POST | B | `apiPost` | **Canonical** |
| `dashboardMaster.js` | `/dashboard/saved-views/:id` | DELETE | B | `apiDelete` | **Canonical** |
| `dashboardMaster.js` | `/dashboard/targets` | POST | B | `apiPost` | **Canonical** |
| `dashboardOwner.js` | `/dashboard/owner` | GET | B | `apiGet` | **Canonical** |
| `employeeProfile.js` | `/employees/me` | GET | B | `apiGet` | **Canonical** |
| `employeeProfile.js` | `/employees/me` | PATCH | B | `apiPatch` | **Canonical** |
| `employeeProfile.js` | `/employees/me/change-requests` | POST | B | `apiPost` | **Canonical** |
| `employeeProfile.js` | `/employees/me/attestation` | POST | B | `apiPost` | **Canonical** |
| `inventory.js` | `/inventory/overview` | GET | B | `apiGet` | **Canonical** |
| `inventory.js` | `/inventory/cafes/:id/stock` | GET | B | `apiGet` | **Canonical** |
| `inventory.js` | `/inventory/items` | GET | B | `apiGet` | **Canonical** |
| `inventory.js` | `/inventory/replenishment/recommendations` | GET | B | `apiGet` | **Canonical** |
| `inventory.js` | `/inventory/receipts` | POST | C | `apiPost` | **Canonical** |
| `inventory.js` | `/inventory/transfers` | GET/POST | C | `apiGet`/`apiPost` | **Canonical** |
| `inventory.js` | `/inventory/counts` | GET/POST | C | `apiGet`/`apiPost` | **Canonical** |
| `inventory.js` | `/inventory/reports/valuation` | GET | D | `apiGet` $\rightarrow$ `downloadFile` | **Migrated to downloadFile** |
| `menuManagement.js` | `/menu/overview` | GET | B | `apiGet` | **Canonical** |
| `menuManagement.js` | `/menu/items` | GET/POST/DELETE | B | `apiGet`/`apiPost`/`apiDelete` | **Canonical** |
| `menuManagement.js` | `/menu/recipes` | GET | B | `apiGet` | **Canonical** |
| `menuManagement.js` | `/menu/modifier-groups` | GET | B | `apiGet` | **Canonical** |
| `menuManagement.js` | `/menu/combos` | GET | B | `apiGet` | **Canonical** |
| `customers.js` | `/customers/overview` | GET | B | `apiGet` (path normalized) | **Fixed Prefix Doubling** |
| `customers.js` | `/customers` | GET/POST | B | `apiGet`/`apiPost` | **Fixed Prefix Doubling** |
| `customers.js` | `/customers/:id/loyalty/adjust` | POST | B | `apiPost` | **Fixed Prefix Doubling** |
| `vendors.js` | `/vendors` | GET/POST | B | `apiGet`/`apiPost` | **Fixed Prefix Doubling** |
| `vendors.js` | `/procurement/orders` | GET | B | `apiGet` | **Fixed Prefix Doubling** |
| `vendors.js` | `/vendors/reports/zurf-pdf` | GET | D | `apiGet` $\rightarrow$ `downloadFile` | **Migrated to downloadFile** |
| `assets.js` | `/assets/overview` | GET | B | `apiGet` | **Fixed Prefix Doubling** |
| `assets.js` | `/assets` | GET/POST | B | `apiGet`/`apiPost` | **Fixed Prefix Doubling** |
| `revenueShare.js` | `/revenue-share/overview` | GET | B | Direct `fetch()` $\rightarrow$ `apiGet` | **Migrated to apiGet** |
| `revenueShare.js` | `/revenue-share/outlets` | GET/POST | B | Direct `fetch()` $\rightarrow$ `apiGet`/`apiPost` | **Migrated to apiGet/apiPost** |
| `revenueShare.js` | `/revenue-share/sales` | GET/POST | B | Direct `fetch()` $\rightarrow$ `apiGet`/`apiPost` | **Migrated to apiGet/apiPost** |
| `revenueShare.js` | `/revenue-share/settlements` | GET/POST | B | Direct `fetch()` $\rightarrow$ `apiGet`/`apiPost` | **Migrated to apiGet/apiPost** |
| `revenueShare.js` | `/revenue-share/reports/zurf-pdf` | GET | D | Direct `fetch()` $\rightarrow$ `downloadFile` | **Migrated to downloadFile** |
| `posTill.js` | `/pos/orders` | POST | C | `apiPost` | **Canonical** |
| `posTill.js` | `/pos/charge` | POST | C | `apiPost` | **Canonical (Fixed Context)** |
| `ownerBills.js` | `/owner/bills` | GET/POST | B | `apiGet`/`apiPost` | **Canonical** |
| `components.js` | `/search?q=...` | GET | B | `apiGet` | **Canonical (Debounced)** |
| `components.js` | `/notifications` | GET/PATCH | B | `apiGet`/`apiPatch` | **Canonical** |

---

## 3. Direct Fetch Migration Strategy
- **Eliminated**: All raw `fetch()` calls in `revenueShare.js` and other page files replaced with canonical `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, or `downloadFile`.
- **Prefix Safety**: `apiClient.js` automatically strips redundant `/api/v1/` or `/api/` prefixes so both `/inventory/items` and `/api/v1/inventory/items` resolve correctly.
- **Export Safety**: File downloads use `downloadFile()` with explicit MIME validation, preventing HTML error bodies from being misparsed as JSON.
