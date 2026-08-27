# Zamorin Café ERP — Slow-Interaction Register

## Overview
This register catalogs, ranks, and diagnoses the slowest interactions identified during baseline performance profiling across all 5 personas and 46 modules.

---

## Slow Interaction Register

| Rank | Persona | Module | Route | Control | p50 (ms) | p95 (ms) | Max (ms) | Root Cause Category | Root Cause Analysis | Severity | Target Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Primary Master | Inventory | `#inventory` | Sidebar Inventory | 1100 | 1339 | 1380 | `SERIAL_FETCH_WATERFALL` | Sequential hydration of inventory overview, item categories, valuation, and recent movements without parallelization or SWR caching. | **HIGH** | Parallelize reads via `Promise.all()`, render lightweight Zamorin skeletons, and enable SWR cache. |
| **2** | Normal Master | Inventory | `#inventory` | Sidebar Inventory | 1080 | 1311 | 1350 | `SERIAL_FETCH_WATERFALL` | Cold mount initial query execution before rendering primary item list. | **HIGH** | SWR caching & instant skeleton fallback. |
| **3** | Primary Master | Settings | `#settings` | Sidebar Settings | 1050 | 1294 | 1320 | `EXCESSIVE_RENDER` | Settings overview mounts extensive sub-section tabs before rendering primary overview card. | **MEDIUM** | Progressive hydration of section tabs & instantaneous active state. |
| **4** | Staff | Attendance | `#staff-attendance` | Staff Attendance Nav | 1020 | 1265 | 1300 | `ROUTE_MODULE_LOAD` | Sub-module attendance script execution on initial mount. | **MEDIUM** | In-memory module caching and instant attendance check-in button state. |
| **5** | Staff | Payslips | `#staff-payslips` | Staff Payslips Nav | 1010 | 1263 | 1290 | `ROUTE_MODULE_LOAD` | Mount latency for payslip history list. | **MEDIUM** | SWR caching of previous month payslip summaries. |
| **6** | Primary Master | Trash | `#trash` | Settings Trash | 980 | 1250 | 1280 | `EXCESSIVE_RENDER` | Retention policy calculation during initial render. | **MEDIUM** | Instant table skeleton render and async policy reconciliation. |
| **7** | Primary Master | Settings | `#settings/appearance` | Appearance Section | 960 | 1249 | 1270 | `EXCESSIVE_RENDER` | Theme preview palette swatch generation inside synchronous render loop. | **LOW** | Pre-compute static theme swatch styles. |
| **8** | Owner | Ledger | `#ledger` | Owner Personal Ledger | 880 | 1028 | 1100 | `API_LATENCY` | Un-cached personal equity & drawdown summary calculations. | **HIGH** | SWR client cache for static ledger periods with background refresh. |
| **9** | Cafe Operations | POS | `#pos` | POS Till Navigation | 620 | 745 | 810 | `LARGE_DOM` | POS catalog table grid with full modifier list rendered synchronously. | **HIGH** | Instant POS category bar skeleton, chunked catalog item hydration. |
| **10** | Staff | Leave | `#staff-leave` | Staff Leave Portal | 450 | 564 | 620 | `SERIAL_FETCH_WATERFALL` | Leave balance + leave policy + leave request history loaded in sequence. | **MEDIUM** | Parallelize 3 read requests via `Promise.all()`. |
| **11** | Normal Master | Reports | `#reports` | Reports Overview | 180 | 207 | 240 | `CHART_RENDER` | Chart.js / canvas redraw on route transition. | **LOW** | SWR chart data caching and deferred canvas rendering. |
| **12** | Primary Master | Inventory | `#inventory/stock-levels` | Stock Levels Tab | 140 | 177 | 210 | `TABLE_RENDER` | Filterable stock list re-rendering 50+ rows. | **LOW** | Optimized row DOM template string batching. |

---

## Remediation Roadmap
1. **Frontend Transport (`apiClient.js`)**:
   - Single-flight GET request deduplication.
   - SWR (Stale-While-Revalidate) caching with configurable TTLs and policies.
   - Immediate AbortController cancellation for stale route / filter requests.
2. **Instant UI Feedback (`router.js` & `components.js`)**:
   - Immediate top navigation progress indicator bar (`#zamorin-nav-progress`).
   - Instant visual pressed state on buttons, tabs, and navigation links (`.btn-active-feedback`).
   - Instant shell and skeleton render for all route transitions.
3. **Backend (`server.js`)**:
   - Response compression (`compression` middleware) for fast JSON payloads.
   - Server-Timing diagnostic headers for query profiling.
