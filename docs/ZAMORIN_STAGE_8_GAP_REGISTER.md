# ZAMORIN CAFE ERP — STAGE 8 GAP REGISTER
## Evidence-Based Gap and Risk Document

Generated: 2026-08-07
Git HEAD: `6c73fe5`

---

## Critical Gaps (Blocking Stage 8 Formal Closure)

### GAP-001: Frontend is a Demo Shell — /auth/me Bootstrap Missing
**Severity**: CRITICAL
**Module(s)**: ALL 28
**Description**: `main.js` boots with `state.role = 'MASTER'` as a hardcoded default. No call to `GET /auth/me` is made. All role-based navigation, permissions, and data scope are derived from local state, not from the backend session.
**Evidence**: `main.js` line 17: "the app renders in a demo-safe read-only shell using the MASTER role default"; `state.js` defaults; `router.js` line 129 `renderMasterDashboard({ roleLabel: ROLE_LABELS[state.role] })` derives label from local state.
**Risk**: Every production user sees the MASTER dashboard regardless of actual role. No real authentication enforced in frontend.
**Fix Required**: Stage 9 (connect login page to `/auth/me`) must be completed first. This is the root prerequisite for all frontend API integration.
**Fix Stage**: Stage 9

---

### GAP-002: Command Centre Dashboard Hardcodes Production Data
**Severity**: CRITICAL
**Module(s)**: Command Centre (Module 1)
**Description**: `dashboardMaster.js` `hydrateMasterDashboard()` fills `#attention-feed` with hardcoded business data strings: "Cafe 07 — cash variance ₹850 over threshold", "Dawn Roast Suppliers — ₹42,000 in 2 days", "Cafe 03 — ready for review". These are not from the backend API.
**Evidence**: `dashboardMaster.js` lines 55–64: hardcoded innerHTML strings.
**Risk**: Dashboard presents false business information as real data.
**Fix Required**: `hydrateMasterDashboard()` must call `GET /api/v1/dashboard` and render from real API response. KPI cards must also hydrate from API.
**Fix Stage**: Stage 8 closure / frontend integration

---

### GAP-003: POS Frontend Does Not Call Bills API
**Severity**: HIGH
**Module(s)**: POS and Billing (Module 2)
**Description**: `posTill.js` renders a POS UI and `wirePOS(content)` wires events, but no fetch to `/api/v1/bills` or `/api/v1/menu` is made. Bills are not created, completed, or voided through the API.
**Evidence**: No `fetch('/api/v1/bills')` call in `posTill.js`.
**Risk**: No real POS transactions recorded; cash book integration non-functional.
**Fix Stage**: Stage 8 frontend integration

---

### GAP-004: Approval Bypass — entityType Not Blocked for Protected Domains
**Severity**: HIGH (Security)
**Module(s)**: Tasks and Approvals (Module 17)
**Description**: `decideApproval` in `approvalController.js` allows OWNER and CAFE_ADMIN to decide any Approval record by approvalId regardless of `entityType`. If a bad actor tags `entityType: 'EXPENSE'` or `entityType: 'OVERTIME_DECISION'` on a generic Approval record, OWNER/CAFE_ADMIN can "decide" it via this route, bypassing the canonical MASTER-only expense and overtime workflows.
**Evidence**: `approvalController.js` line 72–116: no entityType check before setting status.
**Risk**: MASTER-only expense and overtime decision authority can be circumvented through generic approval endpoint.
**Fix Required**: Add entityType blocklist in `decideApproval`: if `approval.entityType` is in `['EXPENSE', 'OVERTIME', 'PAYROLL', 'PERSONAL_LEDGER']`, return 403 and direct to canonical endpoint.
**Fix Stage**: IMMEDIATE — must be fixed before Stage 8 closure

---

### GAP-005: 9 Modules Are BACKEND_ONLY — No Frontend Screens
**Severity**: HIGH
**Module(s)**: Finance (4), Procurement (7), Vendors (8), Menu/Pricing (10), Customers/Loyalty (14), Quality (15), Assets/Maintenance (16), Dept Orders (19), Trash Bin (26)
**Description**: These backend modules have complete controllers, routes, and models, but have zero frontend screens. The router.js does not render any page for them. There are no routes registered for them in the frontend navigation.
**Fix Stage**: Stage 8 frontend integration

---

### GAP-006: Employee Full Profile API Missing (GET /employees/:userId and GET /employees/me)
**Severity**: HIGH
**Module(s)**: Employees and HR (Module 11)
**Description**: `employeeController.js` only implements `searchEmployees`. The full profile endpoints (`GET /employees/:userId` and `GET /employees/me`) are not implemented despite `employeeReadService.js` having `buildEmployeeProfile()` ready.
**Evidence**: `employeeRoutes.js` only mounts `/search`.
**Fix Stage**: Stage 2 (Phase A) — approved and in progress

---

### GAP-007: Finance and Accounts Module is a Static Stub
**Severity**: MEDIUM
**Module(s)**: Finance and Accounts (Module 4)
**Description**: `financeAccounts.js` `renderFinance()` returns a static placeholder HTML string with no API calls. No dedicated finance controller or routes exist beyond `cashController.js`.
**Fix Stage**: Finance frontend integration

---

### GAP-008: Revenue Share Calculation Formula Not Defined
**Severity**: MEDIUM — BLOCKED
**Module(s)**: Revenue Share (Module 18)
**Description**: `RevenueShareAgreement.js` stores agreement metadata (rate, period, cafeId) but no calculation/settlement logic is implemented. The business formula is not defined.
**Status**: BLOCKED/PENDING BUSINESS CONFIRMATION
**Fix Stage**: Requires business requirement sign-off before implementation

---

### GAP-009: Private File Object Storage Not Configured
**Severity**: MEDIUM — PENDING CLOUD
**Module(s)**: Private Files (Module 25)
**Description**: `fileController.js` registers file metadata in MongoDB but has no connection to a real object storage provider. Files stored on Render's local filesystem would be lost on restart/redeploy.
**Status**: PARTIAL / PENDING CLOUD VALIDATION
**Fix Stage**: Cloud deployment phase (Atlas + Render + S3/GCS/MinIO)

---

### GAP-010: Stage 7 Report Watermarking Not Formally Tested
**Severity**: MEDIUM
**Module(s)**: Reports and Analytics (Module 20)
**Description**: Stage 7 required DEFAULT ON watermark (4%–8% opacity) on PDF/Print/XLSX exports and company logo (not app icon). No formal test exists verifying watermark is applied.
**Fix Stage**: Stage 7 closure / Reports module

---

### GAP-011: Global Search Frontend Not Connected
**Severity**: MEDIUM
**Module(s)**: Global Search (Module 28 subset)
**Description**: `searchController.js` and `searchRoutes.js` are implemented backend. However no Ctrl+K / topbar search UI calls `/api/v1/search` in the frontend.
**Fix Stage**: Stage 3 (Phase B)

---

### GAP-012: Notifications Frontend Not Calling Live API
**Severity**: LOW-MEDIUM
**Module(s)**: Notification Centre (Module 24)
**Description**: `wireNotificationCentre()` is called in router.js but the notification centre frontend does not fetch from `/api/v1/notifications` live.
**Fix Stage**: Notification frontend integration

---

### GAP-013: Multiple Frontend Pages Not Calling Live APIs
**Severity**: MEDIUM (cumulative)
**Module(s)**: Expenses (6), Inventory (9), Tasks (17), Cash Book (3)
**Description**: These pages render UI and wire events but do not call the corresponding backend APIs for data fetching or mutations.
**Fix Stage**: Stage 8 frontend integration

---

## Non-Critical Observations

| ID | Description | Classification |
|----|-------------|---------------|
| OBS-001 | `businessModules.test.js` tests model schemas only — not end-to-end API integration | Test quality gap |
| OBS-002 | `notAvailable.js` references "this demo covers Command Centre, POS and Billing" — must be updated post-integration | Documentation/UI text |
| OBS-003 | `ist.js` comment "Simulates the server is the source of truth for time" is a legitimate technical comment, not a mock | No action required |
| OBS-004 | Input `placeholder` attributes in form fields (expenses.js, cashBook.js) are legitimate HTML form placeholders | No action required |
| OBS-005 | `components.js` skeleton block comment "shape-matching loading placeholder" is a legitimate UI pattern | No action required |
| OBS-006 | `navigation.js` comment "demo-appropriate level" — this comment should be updated to reflect production status | Documentation update |

---

## Gap Closure Priority Order

1. **IMMEDIATE**: GAP-004 — Approval bypass security fix (decideApproval entityType blocklist)
2. **Stage 9**: GAP-001 — /auth/me bootstrap (prerequisite for all frontend integration)
3. **Stage 8 Frontend**: GAP-002 — Dashboard live API hydration
4. **Stage 8 Frontend**: GAP-003 — POS API connection
5. **Stage 2**: GAP-006 — Employee full profile API
6. **Stage 3**: GAP-011 — Global search frontend
7. **Stage 8 Frontend**: GAP-005 — Missing frontend screens for 9 BACKEND_ONLY modules
8. **Stage 8 Frontend**: GAP-013 — Remaining pages not calling live APIs
9. **Stage 7**: GAP-010 — Watermark testing
10. **Business**: GAP-008 — Revenue share formula sign-off
11. **Cloud**: GAP-009 — Private file object storage
