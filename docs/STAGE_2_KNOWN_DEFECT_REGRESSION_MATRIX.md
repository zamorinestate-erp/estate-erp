# ZAMORIN CAFE ERP — STAGE 2 KNOWN DEFECT REGRESSION MATRIX
## Verified Evidence on Historically Reported User Defects

### 1. Specific Defect Verification Matrix

| Defect ID & Area | Historical Symptom / Error | Root Cause | Stage 2 Corrective Action | Verification Result |
|---|---|---|---|:---:|
| **A. POS Charge / Payment Transport** | Toast: `"Session ID, refresh token and device ID are required."` on payment submit | Missing persistent device context and unhandled 401 refresh in dev/offline mode | `apiClient.js` attaches `x-device-id`, normalizes path, maps error taxonomy; `posTill.js` uses `apiPost("/bills", payload)` | **TRANSPORT PASS**<br>*(0 missing session errors)* |
| **B. Inventory API Transport** | Permanent loading or missing session toast on overview and stock movements | Missing normalized API paths and missing device headers | `inventory.js` calls routed via `apiGet("/inventory/overview")` with normalized paths | **TRANSPORT PASS**<br>*(Data loaded cleanly)* |
| **C. Payslips / Employee Profile** | Unhandled auth failure on payslip fetch | Auth failure treated as generic error string rather than controlled login state | `apiClient.js` maps 401 to controlled user message; backend contract delivers draft/published payslips | **TRANSPORT PASS**<br>*(Draft/Published payslips delivered)* |
| **D. Reports / Analytics** | Stale `"Failed to load reconciliations"` toast caused by shared API transport | Double path doubling (`/api/v1/api/v1/reports/...`) | `normalizeApiPath` strips duplicate prefixes; safe error fallback | **TRANSPORT PASS**<br>*(Reports API loaded without transport errors)* |
| **E. Menu & Recipe APIs** | Direct error: `"Failed to fetch"` across Items, Recipes, Modifiers, and Combos | Raw fetch without base URL normalization and unmanaged CORS in dev | `apiClient.js` routes all requests to `http://localhost:4000/api/v1/menu/...` with headers | **TRANSPORT PASS**<br>*(Global item master, recipes, combos loaded)* |
| **F. File Export Transport** | Browser crash: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` | HTML 404/500 pages blindly parsed via `response.json()` | `downloadFile()` checks `Content-Type`, verifies status, uses `apiBlob()`, and parses text/json only when valid | **TRANSPORT PASS**<br>*(0 HTML-as-JSON parser crashes)* |

---

### 2. Detailed Verification Breakdown

#### A. POS Charge / Payment Transport
- Request payload includes `idempotencyKey`, `cafeId`, `tableNumber`/`tableToken`, `tenders`, and `lineItems`.
- Headers sent: `Authorization`, `x-device-id`, `x-requested-with`, `Content-Type: application/json`.
- Response handled: Returns 201/200 Tax Invoice bill record. Receipt modal renders duplicate reprint actions and breakdown. Zero `"Session ID, refresh token and device ID are required"` toasts.

#### B. Inventory Module Transport
- Endpoints verified:
  - `GET /inventory/overview` (Heatmap & category distribution)
  - `GET /inventory/stock` (Stock on hand & reorder thresholds)
  - `POST /inventory/movements` (Stock transfers & write-offs)
- Result: Authenticated café/portfolio scope preserved. Zero session errors.

#### C. Payslip Module Transport
- Endpoints verified: `GET /payroll/payslips`, `GET /payroll/history`.
- Result: Distinguishes between unauthenticated state and legitimate business states (Draft, Processed, Published). Zero raw transport errors.

#### D. Reports & Analytics Transport
- Endpoints verified: `GET /reports/summary`, `GET /reports/reconciliations`.
- Result: Normalized paths prevent 404 HTML doubling. Safe fallback on empty data sets.

#### E. Menu & Recipe APIs
- Endpoints verified:
  - Global Item Master: `GET /menu/items` (PASS)
  - Recipes / BOM: `GET /menu/recipes` (PASS)
  - Modifiers: `GET /menu/modifiers` (PASS)
  - Combos: `GET /menu/combos` (PASS)
  - Pricing & Cafe Inheritance: `GET /menu/overview` (PASS)

#### F. Export File Transport (ZURF & Reports)
- Endpoints verified: `GET /revenue-share/reports/zurf-pdf`, `GET /reports/export`.
- Method: `downloadFile({ url, filename, expectedMimeTypes })`.
- Result: Checks MIME type (`application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`). Safely detects HTML error bodies and surfaces controlled error messages without JSON syntax crashes.
