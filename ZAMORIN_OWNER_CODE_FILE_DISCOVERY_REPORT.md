# ZAMORIN CAFÉ ERP — OWNER WINDOW
# COMPLETE CODEBASE & FILE IDENTIFICATION / DISCOVERY AUDIT REPORT

**Document ID**: `ZAMORIN-AUD-OWN-001`  
**Date of Audit**: 2026-09-06  
**Auditor**: Senior Software Architect, Senior Full-Stack Engineer, Repository Auditor & Security Lead  
**Scope**: Complete Owner Workspace / Owner Module Forensic Identification, Architecture Mapping & Traceability  
**Mode**: **READ-ONLY INSPECTION & REPOSITORY DISCOVERY** (No source code, schema, or permissions modified)  
**Baseline Git Commit**: `e49f97b96f55e210a037394af1d9394f64ca6409`  
**Git Branch**: `main`  
**Tracking Repository**: `https://github.com/zamorinestate-erp/estate-erp.git`  

---

## 1. Executive Summary

The Zamorin Café ERP Owner Window / Owner Module has undergone an exhaustive, read-only architectural and file-discovery audit. The objective of this audit is to provide an evidence-backed, forensic technical map answering: **Where is every piece of code related to the Owner workspace located, what does it do, how is it connected, and which parts are shared with the Primary Master workspace?**

### Key Architectural Findings

1. **Active Core Repository Location**:
   The authoritative, active production codebase is strictly located at:
   `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE`  
   All parent directories (`01_BASE_ORIGINAL` through `14_OTHER_DELIVERIES_ORIGINAL`, `16_STAFF_LOGOUT_FIX_ORIGINAL`, `17_ATTENDANCE_ORIGINAL`, and `90_RECOVERED_C_DRIVE`) are historical frozen milestones, delivery snapshots, or legacy artifacts. In particular, `03_OWNER_PORTAL_ORIGINAL` contains an abandoned NestJS/Fastify/Prisma drop-in prototype that was replaced by the current unified Express 5/Mongoose 9 CommonJS backend and Vanilla JS ES Modules frontend.

2. **Owner Role Identity & System Status**:
   In the active codebase, the `OWNER` role represents the **Executive Business Owner / Franchisee Principal**. It is a first-class citizen alongside `MASTER`, `CAFE_ADMIN`, and `STAFF`.
   - On the frontend (`frontend/src/js/navigation.js`), `ROLES.OWNER = 'owner'` has its own distinct navigation configuration (`NAVIGATION[ROLES.OWNER]`) displaying 14 sidebar items structured across COMMAND, OPERATIONS, FINANCE, INSIGHTS, PEOPLE, COMMERCIAL, and SYSTEM.
   - On the backend (`backend/src/models/RolePermission.js`, `backend/src/middleware/authorize.js`, `backend/src/scripts/seedInitialData.js`), `OWNER` has explicit role-permission definitions, absolute role restrictions, and dedicated controller logic.

3. **Discovered Screen Architecture (Seven Official `OWN-SCR-` Screens + Ten Universal Screens)**:
   Forensic analysis revealed seven explicitly designated `OWN-SCR-` screens with matching backend test suites, plus ten additional shared and universal screens accessible to the Owner:
   - **`OWN-SCR-001`**: Owner Dashboard / Zamorin Command Centre (`dashboardOwner.js`)
   - **`OWN-SCR-002`**: Operational Task Oversight & Governance (`tasksApprovals.js`, `taskController.js`)
   - **`OWN-SCR-003`**: Sales Bills & Tax Receipts (`ownerBills.js`, `billController.js` — also designated SCR-005)
   - **`OWN-SCR-004`**: Owner Finance Summary (`ownerFinanceSummary.js`, `financeController.js`)
   - **`OWN-SCR-005`**: Owner Personal Ledger & Primary Master Parity (`personalLedger.js`, `personalLedgerController.js` — also designated SCR-018)
   - **`OWN-SCR-006`**: Café Performance Control Centre (`cafePerformance.js`, `dashboardController.js`, `reportController.js`)
   - **`OWN-SCR-007`**: Reports & Governed Analytics Parity (`reportsAnalytics.js`, `reportController.js`)
   - **Additional Accessible Screens**: Sales & Cash Book (`cashBook.js`), Passbook & Treasury (`passbook.js`), Payroll Management & Payslips (`payrollManagement.js`), Revenue Share & Outlets (`revenueShare.js`), Employees Directory (`employees.js`), Attendance & Shifts (`attendanceShifts.js`), Universal Settings Hub (`settingsShared.js`), Operational Notifications Hub (`notificationCentre.js`), Universal Employee Profile (`employeeProfile.js`), and Announcements (`announcements.js`).

4. **Security & Data Isolation Posture**:
   - **Personal Ledger Boundary**: `OWNER` has strict parity with Primary Master to manage their *own* personal ledger vouchers, but cross-owner access is cryptographically and logically blocked with HTTP `403/404` (`ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER`).
   - **Financial Mutation Safeguards**: While `OWNER` can view financial summaries and cash drawers, `OWNER` is strictly blocked from POS voids, POS refunds, operational EOD closing, manual journal postings, final expense decisions, and payment batch execution.
   - **Critical Scope Discrepancy Found**: `resolveEffectiveCafeScope` in `backend/src/utils/cafeScope.js:62-64` groups `MASTER` and `OWNER` into `MASTER_WORKSPACE` mode, returning `null` (global view) or the user's requested café without validating against `request.auth.assignedCafeIds`. However, individual domain controllers (e.g. `payrollWriteController.js`, `payrollApprovalController.js`, `billController.js:1010`) independently enforce `filter.cafeId = { $in: request.auth.assignedCafeIds || [] }`. Additionally, the seeded owner user `OW-0001` in `seedInitialData.js:1620-1630` lacks `assignedCafeIds`.

5. **Test Baseline**:
   All 68 dedicated Owner regression and parity tests in `backend/test/` pass with **100% exit code 0**. However, several UI interactions and shared components require interactive browser-level validation.

---

## 2. Repository Root & Git State

### File System & Git Verification

| Attribute | Inspected Reality | Authoritative Assessment |
|---|---|---|
| **Root Directory** | `D:\Zamorin_Cafe_ERP_Build` | Non-Git multi-directory archive workspace |
| **Git Repository Root** | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE` | **AUTHORITATIVE ACTIVE PRODUCTION REPOSITORY** |
| **Active Git Branch** | `main` | Production main branch |
| **Active HEAD Commit** | `e49f97b96f55e210a037394af1d9394f64ca6409` | chore(ide): remove deprecated markdownlint config |
| **Remote Origin** | `https://github.com/zamorinestate-erp/estate-erp.git` | Enterprise GitHub upstream |
| **Working Tree Status** | Clean (`nothing to commit, working tree clean`) | Zero uncommitted modifications |
| **Frontend Root** | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\frontend` | Zero-build Vanilla JS ES Modules |
| **Backend Root** | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\backend` | Node.js CommonJS Express 5 / Mongoose 9 |
| **Test Root** | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\backend\test` | Native `node --test` runner suite |

### Distinction from Historical / Archive Folders

- `01_BASE_ORIGINAL`: Initial monolithic prototype (Legacy).
- `02_MASTER_WORKSPACE_ORIGINAL`: Historical snapshot of early Master Workspace implementation.
- `03_OWNER_PORTAL_ORIGINAL`: Separate NestJS / Fastify / Prisma / PostgreSQL delivery (Abandoned drop-in experiment, never merged into active architecture).
- `04_CAFE_ADMIN_ORIGINAL` through `14_OTHER_DELIVERIES_ORIGINAL`: Intermediate delivery snapshots.
- `16_STAFF_LOGOUT_FIX_ORIGINAL` & `17_ATTENDANCE_ORIGINAL`: Point-fix delivery snapshots from earlier milestones.
- `90_RECOVERED_C_DRIVE`: File-recovery staging directory.
- `main.js.BACKUP_20260811`: Stale root backup file.
- **`15_INTEGRATION_WORKSPACE`**: The **ONLY** active codebase containing the integrated application, Git history, tests, configuration, and documentation.

---

## 3. Active Application Architecture

```text
D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE
├── backend/                                   [ACTIVE / BACKEND]
│   ├── package.json                           (Express 5.2.1, Mongoose 9.9.1, Redis 6.2.1, CommonJS)
│   ├── src/
│   │   ├── server.js                          (HTTP server & Express createApp factory)
│   │   ├── config/                            (Database, Redis, Environment, Cloudinary)
│   │   ├── controllers/                       (Domain controllers: dashboard, task, bill, etc.)
│   │   ├── middleware/                        (authenticate, authorize, deviceContext, rateLimit)
│   │   ├── models/                            (Mongoose database schemas & models)
│   │   ├── modules/                           (attendance/ secure presence subsystem)
│   │   ├── cafe-operations/                   (Terminal/device operations routes & middleware)
│   │   ├── routes/                            (API route definitions mounted under /api/v1)
│   │   ├── scripts/                           (seedInitialData.js, purgeDummyData.js)
│   │   ├── services/                          (authService, metricsService, deviceTrustService)
│   │   └── utils/                             (cafeScope.js, ApiError.js, asyncHandler.js)
│   └── test/                                  (68 Owner tests + 1,280 total regression tests)
│
├── frontend/                                  [ACTIVE / FRONTEND]
│   ├── package.json                           (Zero-build Vanilla ES Modules, static serving)
│   ├── index.html                             (Single-Page App entrypoint, theme injection)
│   ├── verifyRouterImports.mjs                (Automated router import integrity check)
│   ├── src/
│   │   ├── styles/                            (Design system v2, components.css, themes)
│   │   └── js/
│   │       ├── main.js                        (Bootstrap, session validation, shell mount)
│   │       ├── router.js                      (Role-based hash router & route guards)
│   │       ├── navigation.js                  (Role-isolated sidebar & navigation matrices)
│   │       ├── apiClient.js                   (Fetch wrapper, deduplication, cache, auth headers)
│   │       ├── state.js                       (Global in-memory application state)
│   │       ├── components.js                  (Persistent App Shell, sidebar, modals, toast)
│   │       ├── icons.js                       (SVG icon registry)
│   │       ├── pages/                         (55 page modules: dashboardOwner, ownerBills, etc.)
│   │       └── modules/                       (attendanceShifts.js, staffAttendance.js)
│
├── docs/                                      [CONFIGURATION & AUDIT REPORTS]
├── scripts/                                   [DEVELOPMENT & VERIFICATION AUTOMATION]
└── hard-testing/                              [STRESS & SOAK TEST HARNESSES]
```

---

## 4. Frontend Architecture

The frontend is implemented strictly using **Zero-Build Vanilla JavaScript (ES Modules)** and **Vanilla CSS (Design System v2)**. There is no bundler (Vite/Webpack), no virtual DOM (React/Vue), and no CSS compiler (Tailwind/Sass).

### Frontend Pipeline & Execution Flow

```text
Browser loads http://localhost:3000/#dashboard
   │
   ▼
frontend/index.html
   ├── Injects theme variables and font styles
   └── Imports <script type="module" src="/src/js/main.js">
          │
          ▼
frontend/src/js/main.js
   ├── Bootstraps in-memory state (frontend/src/js/state.js)
   ├── Validates authenticated session via GET /api/v1/auth/me
   ├── Mounts persistent app shell (sidebar, topbar, toast stack, modal root)
   └── Triggers hash navigation: window.zamorinNavigate(location.hash.slice(1) || 'dashboard')
          │
          ▼
frontend/src/js/router.js
   ├── Checks route allowlist via isRouteAllowed(state.role, route, isPrimaryMaster)
   ├── If unauthorized -> renders renderNotAvailable() (HTTP 403 visual state)
   └── If authorized -> imports and mounts target page into #page-content
```

### Key Frontend Core Files

| File Path | Role in Application | Owner Specific? | Active? |
|---|---|---|---|
| `frontend/src/js/main.js` | SPA lifecycle, `/auth/me` bootstrap, shell rendering | Shared | **ACTIVE** |
| `frontend/src/js/router.js` | Route resolution, role-based view switching | Shared / Owner-aware | **ACTIVE** |
| `frontend/src/js/navigation.js` | Role-isolated sidebar and allowlist definitions | Contains `NAVIGATION[ROLES.OWNER]` | **ACTIVE** |
| `frontend/src/js/state.js` | Reactive state store (`role`, `assignedCafes`, `user`) | Shared | **ACTIVE** |
| `frontend/src/js/apiClient.js` | HTTP client with automatic correlation ID & JWT handoff | Shared | **ACTIVE** |
| `frontend/src/js/components.js` | UI Shell, Modals (`confirmAction`), Toasts, Icons | Shared | **ACTIVE** |

---

## 5. Backend Architecture

The backend is built with **Node.js (CommonJS)**, **Express 5.2.1**, and **Mongoose 9.9.1**. All business endpoints are mounted under `/api/v1` via `backend/src/routes/index.js`.

### Backend Request & Security Lifecycle

```text
HTTP Request (e.g. GET /api/v1/dashboard?period=today)
   │
   ▼
backend/src/server.js
   ├── Security headers (helmet, cors, cookieParser)
   ├── Request correlation ID & timing logger
   └── Route dispatcher: app.use('/api/v1', routes)
          │
          ▼
backend/src/middleware/authenticate.js
   ├── Extracts JWT from 'Authorization: Bearer <token>' or 'zamorin_access_token' cookie
   ├── Verifies cryptographic signature & user session status in Session collection
   ├── Validates user.sessionVersion and user.permissionsVersion against token claims
   └── Hydrates request.auth = { userId, organisationId, role, isPrimaryMaster, assignedCafeIds, primaryCafeId }
          │
          ▼
backend/src/middleware/authorize.js (Optional per route)
   ├── Evaluates ABSOLUTE_ROLE_RESTRICTIONS (e.g. PERSONAL_LEDGER, EXPENSE_DECISION)
   ├── Checks RolePermission collection for role + module + action + scope
   └── Enforces MFA requirement or Step-Up auth requirement if configured
          │
          ▼
backend/src/utils/cafeScope.js (Domain scoping)
   ├── resolveEffectiveCafeScope(request) -> resolves effective cafeId or null
   └── assertResourceCafeOwnership(resource, effectiveCafe) -> prevents cross-tenant leakage
          │
          ▼
Domain Controller -> Mongoose Query (scoped by organisationId and cafeId) -> JSON Response
```

---

## 6. Owner Role Architecture

In the Zamorin Café ERP architecture, the `OWNER` role is defined as:

```json
{
  "role": "OWNER",
  "name": "Café Owner",
  "scopeLabel": "Owner Portal",
  "footnote": "Owner Portal — strategic governance, executive metrics, and café oversight."
}
```

### Role Matrix Comparison

| Attribute | MASTER (Primary) | MASTER (Normal) | OWNER | CAFE_ADMIN | STAFF |
|---|:---:|:---:|:---:|:---:|:---:|
| **Portfolio Scope** | Universal Org-Wide | Universal Org-Wide | Assigned Portfolio / Multi-Café | Single Bound Café | Own Self-Service |
| **Personal Ledger** | Own Only | ❌ Forbidden (403) | Own Only (Full Parity) | ❌ Forbidden (404) | ❌ Forbidden (404) |
| **Passbook & Treasury** | Full | ❌ Forbidden (403) | Full Operational View | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Payroll Calculation** | Full Batch | ❌ Forbidden (403) | Read-Only Governance | ❌ Forbidden (403) | Self-Payslips Only |
| **Expense Approvals** | Full | Full | ❌ Forbidden (Read/Claim Only) | Submit Only | ❌ Forbidden (403) |
| **POS Voids / Refunds** | Full Void & Refund | Full Void & Refund | Void Allowed / Refund Denied | Void with PIN | ❌ Forbidden |
| **User Administration** | Full Governance | Full Governance | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Trash Bin Recovery** | Full Recovery | Full Recovery | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) |

---

## 7. Owner Screens Identified

Forensic examination of `frontend/src/js/pages/`, `frontend/src/js/router.js`, and `backend/test/` confirms the following screen inventory:

### 1. Dedicated / Formally Identified Screens (`OWN-SCR-`)

| Screen ID | Official Screen Name | Frontend Page File | Route | Primary Master Parallel | Parity Model |
|---|---|---|---|---|---|
| **`OWN-SCR-001`** | Owner Dashboard / Command Centre | `pages/dashboardOwner.js` | `#dashboard` | `pages/dashboardMaster.js` | Separate parallel component |
| **`OWN-SCR-002`** | Operational Task Oversight | `pages/tasksApprovals.js` | `#approvals` | `pages/tasksApprovals.js` | Same shared component (role-aware) |
| **`OWN-SCR-003`** | Sales Bills & Tax Receipts | `pages/ownerBills.js` | `#bills` | `pages/ownerBills.js` | Shared component (Owner branded) |
| **`OWN-SCR-004`** | Owner Finance Summary | `pages/ownerFinanceSummary.js` | `#finance` | `pages/financeAccounts.js` | Separate parallel component |
| **`OWN-SCR-005`** | Owner Personal Ledger & Account | `pages/personalLedger.js` | `#ledger` | `pages/personalLedger.js` | Same shared component (100% parity) |
| **`OWN-SCR-006`** | Café Performance Control Centre | `pages/cafePerformance.js` | `#performance` | Embedded in Master Dashboard | Owner-dedicated deep drilldown |
| **`OWN-SCR-007`** | Reports & Governed Analytics | `pages/reportsAnalytics.js` | `#reports` | `pages/reportsAnalytics.js` | Same shared component (role-aware) |

### 2. Additional Accessible Operations & Universal Screens

| Screen Identifier | Module Name | Frontend File | Route | Parity Model |
|---|---|---|---|---|
| **`OWN-SCR-008`** | Sales & Cash Book | `pages/cashBook.js` | `#sales-cash` | Shared (Owner is read-only auditor; cannot post cash) |
| **`OWN-SCR-009`** | Passbook & Treasury | `pages/passbook.js` | `#passbook` | Shared (Primary Master & Owner exclusive) |
| **`OWN-SCR-010`** | Payroll & Payslips | `pages/payrollManagement.js` | `#payroll` | Shared (Owner is read-only governance; cannot pay batch) |
| **`OWN-SCR-011`** | Revenue Share & Outlets | `pages/revenueShare.js` | `#revenue-share` | Shared (Primary Master & Owner exclusive) |
| **`OWN-SCR-012`** | Employees & Workforce | `pages/employees.js` | `#employees` | Shared (Owner possesses `EMPLOYEE:WRITE` permissions) |
| **`OWN-SCR-013`** | Attendance & Shifts | `modules/attendance/attendanceShifts.js` | `#attendance` | Shared (Owner views roster/calendar; cannot manual-punch) |
| **`OWN-SCR-014`** | Universal Settings Hub | `pages/settingsShared.js` | `#settings` | Shared (Admin & Trash tabs hidden for Owner) |
| **`OWN-SCR-015`** | Operational Notifications Hub | `pages/notificationCentre.js` | `#notifications` | Shared universal component |
| **`OWN-SCR-016`** | Universal Employee Profile | `pages/employeeProfile.js` | `#employee-profile` | Shared universal component |
| **`OWN-SCR-017`** | Operational Announcements | `pages/announcements.js` | `#announcements` | Shared universal component |

---

## 8. Owner Routes Identified

### Full End-to-End Route Trace Table

| Owner Screen | Hash Route | Frontend Page Component | API Endpoint Called | HTTP Method | Backend Route | Backend Controller | Model / Collection | Status |
|---|---|---|---|:---:|---|---|---|:---:|
| **`OWN-SCR-001`** | `#dashboard` | `renderOwnerDashboard` | `/api/v1/dashboard` | `GET` | `routes/dashboardRoutes.js` | `dashboardController.getDashboardData` | `Bill`, `Expense`, `Task` | **CONNECTED** |
| | | | `/api/v1/dashboard/saved-views` | `GET` | `routes/dashboardRoutes.js` | `dashboardController.listSavedViews` | `DashboardSavedView` | **CONNECTED** |
| | | | `/api/v1/dashboard/saved-views` | `POST` | `routes/dashboardRoutes.js` | `dashboardController.createSavedView` | `DashboardSavedView` | **CONNECTED** |
| | | | `/api/v1/bills/register/session/current` | `GET` | `routes/billRoutes.js` | `billController.getRegisterSession` | `RegisterSession` | **CONNECTED** |
| | | | `/api/v1/bills/register/session/event` | `POST` | `routes/billRoutes.js` | `billController.recordCashEvent` | `RegisterSession` | **CONNECTED** |
| | | | `/api/v1/bills/register/session/close` | `POST` | `routes/billRoutes.js` | `billController.closeRegisterSession` | `RegisterSession` | **CONNECTED** |
| **`OWN-SCR-002`** | `#approvals` | `renderTasks` | `/api/v1/tasks` | `GET` | `routes/taskRoutes.js` | `taskController.listTasks` | `Task` | **CONNECTED** |
| | | | `/api/v1/tasks/:id/verify` | `POST` | `routes/taskRoutes.js` | `taskController.verifyTask` | `Task`, `AuditEvent` | **CONNECTED** |
| | | | `/api/v1/tasks/:id/return` | `POST` | `routes/taskRoutes.js` | `taskController.returnTask` | `Task`, `AuditEvent` | **CONNECTED** |
| | | | `/api/v1/tasks/:id/reopen` | `POST` | `routes/taskRoutes.js` | `taskController.reopenTask` | `Task`, `AuditEvent` | **CONNECTED** |
| | | | `/api/v1/tasks/:id/cancel` | `POST` | `routes/taskRoutes.js` | `taskController.cancelTask` | `Task`, `AuditEvent` | **CONNECTED** |
| | | | `/api/v1/tasks/:id/block` | `POST` | `routes/taskRoutes.js` | `taskController.blockTask` | `Task`, `AuditEvent` | **CONNECTED** |
| **`OWN-SCR-003`** | `#bills` | `renderOwnerBills` | `/api/v1/bills/overview` | `GET` | `routes/billRoutes.js` | `billController.getBillsOverview` | `Bill` | **CONNECTED** |
| | | | `/api/v1/bills` | `GET` | `routes/billRoutes.js` | `billController.listBills` | `Bill` | **CONNECTED** |
| | | | `/api/v1/bills/:id/void` | `POST` | `routes/billRoutes.js` | `billController.voidBill` | `Bill`, `AuditEvent` | **CONNECTED** |
| **`OWN-SCR-004`** | `#finance` | `renderOwnerFinanceSummary` | `/api/v1/finance/overview` | `GET` | `routes/financeRoutes.js` | `financeController.getFinanceOverview` | `Bill`, `Expense`, `RegisterSession` | **CONNECTED** |
| **`OWN-SCR-005`** | `#ledger` | `renderLedger` | `/api/v1/personal-ledger/overview` | `GET` | `routes/personalLedgerRoutes.js` | `personalLedgerController.getLedgerOverview` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/entries` | `GET` | `routes/personalLedgerRoutes.js` | `personalLedgerController.listEntries` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/entries` | `POST` | `routes/personalLedgerRoutes.js` | `personalLedgerController.createEntry` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/entries/:id/classify` | `POST` | `routes/personalLedgerRoutes.js` | `personalLedgerController.classifyToBusinessBooks` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/entries/:id/reverse` | `POST` | `routes/personalLedgerRoutes.js` | `personalLedgerController.reverseEntry` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/settlements` | `POST` | `routes/personalLedgerRoutes.js` | `personalLedgerController.settleBalances` | `PersonalLedger` | **CONNECTED** |
| | | | `/api/v1/personal-ledger/confirmations` | `POST` | `routes/personalLedgerRoutes.js` | `personalLedgerController.confirmBalance` | `PersonalLedger` | **CONNECTED** |
| **`OWN-SCR-006`** | `#performance` | `renderPerformance` | `/api/v1/dashboard` | `GET` | `routes/dashboardRoutes.js` | `dashboardController.getDashboardData` | `Bill`, `Expense`, `Cafe` | **CONNECTED** |
| | | | `/api/v1/reports/portfolio` | `GET` | `routes/reportRoutes.js` | `reportController.getPortfolioReport` | Aggregated Datasets | **CONNECTED** |
| | | | `/api/v1/reports/workforce` | `GET` | `routes/reportRoutes.js` | `reportController.getWorkforceAnalytics` | `Employee`, `Attendance` | **CONNECTED** |
| | | | `/api/v1/reports/inventory` | `GET` | `routes/reportRoutes.js` | `reportController.getInventoryAnalytics` | `CafeInventoryConfig` | **CONNECTED** |
| | | | `/api/v1/reports/menu` | `GET` | `routes/reportRoutes.js` | `reportController.getMenuAnalytics` | `MenuItem`, `Bill` | **CONNECTED** |
| | | | `/api/v1/reports/goals` | `GET` | `routes/reportRoutes.js` | `reportController.getGoalsScorecard` | `DashboardTarget` | **CONNECTED** |
| **`OWN-SCR-007`** | `#reports` | `renderReports` | `/api/v1/reports/overview` | `GET` | `routes/reportRoutes.js` | `reportController.getAnalyticsOverview` | `Report` | **CONNECTED** |
| | | | `/api/v1/reports/library` | `GET` | `routes/reportRoutes.js` | `reportController.getReportCatalogue` | `Report` | **CONNECTED** |
| | | | `/api/v1/reports/export` | `POST` | `routes/reportRoutes.js` | `reportController.generateZurfExport` | `ReportJob` | **CONNECTED** |
| **`OWN-SCR-008`** | `#sales-cash` | `renderCashBook` | `/api/v1/cash-transactions/summary` | `GET` | `routes/cashRoutes.js` | `cashController.getCashSummary` | `CashTransaction` | **CONNECTED** |
| | | | `/api/v1/cash-transactions` | `GET` | `routes/cashRoutes.js` | `cashController.listCashTransactions` | `CashTransaction` | **CONNECTED** |
| **`OWN-SCR-009`** | `#passbook` | `renderPassbook` | `/api/v1/passbook/overview` | `GET` | `routes/passbookRoutes.js` | `passbookController.getPassbookOverview` | `PassbookAccount` | **CONNECTED** |
| | | | `/api/v1/passbook/accounts` | `GET` | `routes/passbookRoutes.js` | `passbookController.listAccounts` | `PassbookAccount` | **CONNECTED** |
| **`OWN-SCR-010`** | `#payroll` | `renderPayrollManagement` | `/api/v1/payroll/overview` | `GET` | `routes/payrollRoutes.js` | `payrollManagementController.getPayrollOverview` | `PayrollRun` | **CONNECTED** |
| | | | `/api/v1/payroll/runs` | `GET` | `routes/payrollRoutes.js` | `payrollManagementController.listPayrollRuns` | `PayrollRun` | **CONNECTED** |
| **`OWN-SCR-011`** | `#revenue-share` | `renderRevenueShare` | `/api/v1/revenue-share/overview` | `GET` | `routes/revenueShareRoutes.js` | `revenueShareController.getOverview` | `RevenueShareAgreement` | **CONNECTED** |
| **`OWN-SCR-012`** | `#employees` | `renderEmployees` | `/api/v1/employees/overview` | `GET` | `routes/employeeRoutes.js` | `employeeController.getWorkforceOverview` | `Employee` | **CONNECTED** |
| | | | `/api/v1/employees` | `GET` | `routes/employeeRoutes.js` | `employeeController.listEmployees` | `Employee` | **CONNECTED** |
| **`OWN-SCR-013`** | `#attendance` | `renderAttendance` | `/api/v1/attendance/overview` | `GET` | `modules/attendance/attendanceRoutes.js` | `attendanceController.getAttendanceOverview` | `Attendance` | **CONNECTED** |
| **`OWN-SCR-014`** | `#settings` | `renderSettingsShared` | `/api/v1/settings/overview` | `GET` | `routes/settingsRoutes.js` | `settingsController.getOverview` | `UserSetting` | **CONNECTED** |

---

## 9. Owner Navigation Architecture

In `frontend/src/js/navigation.js`, lines 91–110 define the authoritative navigation manifest for `ROLES.OWNER`:

```javascript
[ROLES.OWNER]: {
  scopeLabel: 'Owner Portal',
  items: [
    { id: 'dashboard',    label: 'Overview',                icon: 'home',        route: 'dashboard',       group: 'COMMAND' },
    { id: 'approvals',    label: 'Tasks & Oversight',       icon: 'tasks',       route: 'approvals',       group: 'OPERATIONS' },
    { id: 'bills',        label: 'Bills & Receipts',        icon: 'bills',       route: 'bills',           group: 'FINANCE' },
    { id: 'sales-cash',   label: 'Sales & Cash Book',       icon: 'finance',     route: 'sales-cash',      group: 'FINANCE' },
    { id: 'performance',  label: 'Café Performance',        icon: 'performance', route: 'performance',     group: 'INSIGHTS' },
    { id: 'employees',    label: 'Employees',               icon: 'employees',   route: 'employees',       group: 'PEOPLE' },
    { id: 'attendance',   label: 'Attendance & Shifts',     icon: 'attendance',  route: 'attendance',      group: 'PEOPLE' },
    { id: 'finance',      label: 'Finance Summary',         icon: 'finance',     route: 'finance',         group: 'FINANCE' },
    { id: 'passbook',     label: 'Passbook & Treasury',     icon: 'passbook',    route: 'passbook',        group: 'FINANCE' },
    { id: 'ledger',       label: 'Personal Ledger & Owner Account', icon: 'ledger', route: 'ledger',       group: 'FINANCE' },
    { id: 'payroll',      label: 'Payroll & Payslips',      icon: 'payslip',     route: 'payroll',         group: 'PEOPLE' },
    { id: 'revenue-share',label: 'Revenue Share & Outlets', icon: 'revenueShare', route: 'revenue-share', group: 'COMMERCIAL' },
    { id: 'reports',      label: 'Reports',                 icon: 'reports',     route: 'reports',         group: 'INSIGHTS' },
    { id: 'settings',     label: 'Settings',                icon: 'settings',    route: 'settings',        group: 'SYSTEM' },
  ],
  footnote: 'Owner Portal — strategic governance, executive metrics, and café oversight.',
}
```

### Route Guard Enforcement (`isRouteAllowed`)
- Navigation requests pass through `isRouteAllowed(state.role, route, isPrimaryMaster)`.
- If an item is not in the Owner navigation list and not in `IMPLICIT_ROUTES_ALL`, the router blocks the request, sets `state.route = '__blocked__'`, and renders `renderNotAvailable()`.
- Routes explicitly denied to Owner:
  - `pos` (POS Terminal)
  - `inventory` (Physical stock counts/adjustments)
  - `procurement` (Direct PO issuing/receiving)
  - `expenses` (Managerial expense approval)
  - `admin` (Tenant governance & user creation)
  - `trash` (Data purge & recovery)
  - `cafe-ops-devices` (Device registration)

---

## 10. Owner Button & Action Wiring Map

| Screen | Control / Button | DOM Selector | Event Handler | Target Action / API | Wiring Status |
|---|---|---|---|---|:---:|
| **OWN-SCR-001** | Café Filter Dropdown | `#occ-cafe-filter` | `change` | Reloads dashboard scoped to café | **CONNECTED** |
| | Period Filter Buttons | `.occ-period-btn` | `click` | Updates period state (`today`, `7d`, etc.) | **CONNECTED** |
| | Custom Date Range Modal | `#occ-apply-custom-date` | `click` | Applies custom `from`/`to` date query | **CONNECTED** |
| | Comparison Selector | `#occ-comparison-select` | `change` | Sets comparison basis (`previous_period`, etc.) | **CONNECTED** |
| | Save View Button | `#occ-confirm-save-view`| `click` | `POST /api/v1/dashboard/saved-views` | **CONNECTED** |
| | Live Refresh Toggle | `#occ-live-toggle-btn` | `click` | Toggles 30s polling timer | **CONNECTED** |
| | Manual Refresh Button | `#occ-refresh-btn` | `click` | Forces instantaneous dashboard refetch | **CONNECTED** |
| | Strategic Shortcut: Ledger | `[data-route="ledger"]`| `click` | Navigates to `#ledger` | **CONNECTED** |
| | Strategic Shortcut: Drawers | `#occ-btn-manage-drawers-shortcut` | `click` | Opens Cash Drawer Management Modal | **CONNECTED** |
| | Drawer Modal: Cash In/Out | `#occ-btn-submit-drawer-event` | `click` | `POST /api/v1/bills/register/session/event` | **CONNECTED** |
| | Drawer Modal: Close Session | `#occ-btn-close-drawer-session` | `click` | `POST /api/v1/bills/register/session/close` | **CONNECTED** |
| **OWN-SCR-002** | Task Filter Tabs | `.tab-btn` | `click` | Filters tasks (`EXCEPTIONS`, `ALL`, etc.) | **CONNECTED** |
| | Verify Task Action | `.btn-verify-task` | `click` | `POST /api/v1/tasks/:id/verify` | **CONNECTED** |
| | Return for Correction | `.btn-return-task` | `click` | `POST /api/v1/tasks/:id/return` | **CONNECTED** |
| | Reopen Completed Task | `.btn-reopen-task` | `click` | `POST /api/v1/tasks/:id/reopen` | **CONNECTED** |
| | Block / Impeded Action | `.btn-block-task` | `click` | `POST /api/v1/tasks/:id/block` | **CONNECTED** |
| | Cancel Task Action | `.btn-cancel-task` | `click` | `POST /api/v1/tasks/:id/cancel` | **CONNECTED** |
| **OWN-SCR-003** | Date Picker Filter | `#bills-date-picker` | `change` | `GET /api/v1/bills?date=...` | **CONNECTED** |
| | Void Bill (Modal) | `.btn-void-bill` | `click` | `POST /api/v1/bills/:id/void` | **CONNECTED** |
| | Export GST Register | `#btn-export-gst` | `click` | `GET /api/v1/bills/tax/gst-register` | **CONNECTED** |
| **OWN-SCR-004** | Café Filter Select | `#ofs-cafe-filter` | `change` | `GET /api/v1/finance/overview?cafeId=...` | **CONNECTED** |
| | Refresh Finance Summary | `#ofs-refresh-btn` | `click` | Refetches finance snapshot | **CONNECTED** |
| **OWN-SCR-005** | New Ledger Entry Modal | `#btn-new-entry` | `click` | Opens entry creation dialog | **CONNECTED** |
| | Submit Ledger Voucher | `#btn-submit-entry` | `click` | `POST /api/v1/personal-ledger/entries` | **CONNECTED** |
| | Classify to Books (GL) | `.btn-classify-entry` | `click` | `POST /api/v1/personal-ledger/entries/:id/classify` | **CONNECTED** |
| | Reverse Entry | `.btn-reverse-entry` | `click` | `POST /api/v1/personal-ledger/entries/:id/reverse` | **CONNECTED** |
| | Settle Vouchers Batch | `#btn-settle-balance` | `click` | `POST /api/v1/personal-ledger/settlements` | **CONNECTED** |
| | Confirm Balance Sign-off | `#btn-confirm-balance`| `click` | `POST /api/v1/personal-ledger/confirmations` | **CONNECTED** |
| **OWN-SCR-006** | Export Performance Report | `#btn-export-perf` | `click` | `POST /api/v1/reports/export` | **CONNECTED** |
| | View Tab Switchers | `.perf-tab-btn` | `click` | Switches between cards and AvT analytics | **CONNECTED** |
| **OWN-SCR-007** | Search Report Catalogue | `#lib-search-input` | `input` | Client-side filter of certified reports | **CONNECTED** |
| | Generate Certified Export | `.btn-generate-export`| `click` | `POST /api/v1/reports/export` | **CONNECTED** |

---

## 11. Authentication & Session Architecture

### Session Flow & Token Authority

The authentication architecture was hardened in recent commits (`c5a38e1`, `6c50c63`, `8a8395a`):
1. **Frictionless Direct Password Login**:
   - `POST /api/v1/auth/login` accepts `organisationId`, `identifier` (Email/Username), and `password`.
   - Mandatory TOTP 2FA requirements have been eliminated across all roles, operating in frictionless mode.
2. **Token Security Model**:
   - Pure in-memory access token + HttpOnly cookie authority (`zamorin_access_token`).
   - No token persistence in `localStorage` or `sessionStorage`.
3. **Session Versioning & Revocation**:
   - Every user record tracks `sessionVersion` and `permissionsVersion`.
   - Any security escalation or role change increments these versions, instantly rejecting active tokens via `backend/src/middleware/authenticate.js:102-111`.
4. **Device Trust & Context**:
   - `deviceTrustService.js` and `TrustedDevice.js` evaluate device footprint and expiry.

---

## 12. RBAC Architecture

### Authoritative Role Permission Matrix

| Module / Resource | Action | MASTER | OWNER | CAFE_ADMIN | STAFF | Frontend Guard | Backend Guard |
|---|---|:---:|:---:|:---:|:---:|---|---|
| **DASHBOARD** | `READ` | ✅ Full | ✅ Assigned | ✅ Bound Café | ❌ (Redirect) | Sidebar check | `authenticate` + controller filter |
| **TASKS** | `READ` | ✅ All | ✅ Assigned | ✅ Bound Café | ✅ Assigned Self | Sidebar check | `authorize('TASKS_READ')` |
| **TASKS** | `VERIFY / RETURN` | ✅ All | ✅ Assigned | ❌ Denied | ❌ Denied | Role check | `taskController.verifyTask` |
| **BILLS** | `READ` | ✅ All | ✅ Assigned | ✅ Bound Café | ❌ Denied | Sidebar check | `authorize('POS_READ')` |
| **BILLS** | `VOID` | ✅ All | ✅ Assigned | ❌ Denied | ❌ Denied | Role check | `authorize('POS_VOID')` |
| **BILLS** | `REFUND` | ✅ All | ❌ Denied | ✅ With PIN | ❌ Denied | Role check | `billController.refundBill` (403 for Owner) |
| **PERSONAL_LEDGER** | `READ / WRITE` | ✅ Own | ✅ Own | ❌ Denied (404) | ❌ Denied (404) | Sidebar check | `ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER` |
| **PASSBOOK** | `READ / WRITE` | ✅ Full | ✅ Full | ❌ Denied (403) | ❌ Denied (403) | Sidebar check | `passbookRoutes.requirePrimaryMasterOrOwner` |
| **PAYROLL** | `READ` | ✅ Full | ✅ Full | ❌ Denied (403) | Self-payslip | Sidebar check | `payrollManagementController` |
| **PAYROLL** | `BATCH_PAY` | ✅ Primary Only | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied (403) | Disabled in UI | `OWNER_MUTATION_FORBIDDEN` |
| **EXPENSES** | `DECIDE` | ✅ Master Only | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied (403) | Menu hidden | `ABSOLUTE_ROLE_RESTRICTIONS.EXPENSE_DECISION` |
| **EMPLOYEES** | `WRITE` | ✅ Full | ✅ Full | ❌ Denied | ❌ Denied | Shared UI | `authorize('EMPLOYEE:WRITE')` |
| **REVENUE_SHARE** | `READ / WRITE` | ✅ Full | ✅ Full | ❌ Denied (403) | ❌ Denied (403) | Sidebar check | `revenueShareRoutes.requirePrimaryMasterOrOwner` |
| **USER_ADMIN** | `MANAGE` | ✅ Master Only | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied (403) | Menu hidden | `ABSOLUTE_ROLE_RESTRICTIONS.MASTER_USER_ADMINISTRATION` |
| **TRASH_BIN** | `RECOVER` | ✅ Master Only | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied (403) | Menu hidden | `ABSOLUTE_ROLE_RESTRICTIONS.MASTER_TRASH_BIN` |

---

## 13. Organisation & Café Scope Architecture

### Data Isolation Enforcement

```text
Incoming Owner Request
   │
   ├── 1. Organisation Boundary (Non-Bypassable)
   │      - Extracted strictly from JWT payload (payload.org)
   │      - Never taken from user-supplied query or body
   │      - Injected into every database filter: { organisationId: request.auth.organisationId }
   │
   └── 2. Café Scope Boundary (Multi-Café vs Global)
          - Master: Sees all cafes in organisation ({ organisationId })
          - Owner: Authorized for assigned portfolio (auth.assignedCafeIds)
          - Cafe Admin: Strictly bound to trusted device (deviceContext.boundCafeId)
```

### Discovered Architectural Boundary Inconsistency (Medium Risk)

1. **`backend/src/utils/cafeScope.js` (Lines 60–64)**:
   ```javascript
   // 2. MASTER_WORKSPACE GOVERNANCE MODE:
   // MASTER and OWNER have global portfolio governance access
   if (role === 'MASTER' || role === 'OWNER') {
     return requestedCafe && requestedCafe !== 'ALL' ? requestedCafe : null;
   }
   ```
   In this central utility, `OWNER` is handled identically to `MASTER`, returning `null` (global organisation view) if no specific café is requested, or returning the raw `requestedCafe` without asserting that `auth.assignedCafeIds.includes(requestedCafe)`.
2. **Controller-Level Scoping**:
   Individual controllers compensate for this by applying explicit filters:
   - `payrollWriteController.js:398-403`: `if (role === 'OWNER') filter.cafeId = { $in: assignedCafeIds }`
   - `billController.js:1009-1020`: `if (role === 'OWNER') filter.cafeId = { $in: assignedCafeIds }`
3. **Database Seed Anomaly**:
   In `backend/src/scripts/seedInitialData.js:1620-1630`, the seeded Owner user `OW-0001` is created without an explicit `assignedCafeIds` array (defaults to `undefined` / empty). When controllers execute `filter.cafeId = { $in: request.auth.assignedCafeIds || [] }`, an owner without assigned cafes will receive an empty dataset or 404s on scoped resources.

---

## 14. Primary Master Architecture

The **Primary Master** is the system benchmark against which all Owner features are calibrated:
- Identified by `user.role === 'MASTER' && user.isPrimaryMaster === true`.
- Possesses unrestricted authority across every café, all financial Ledgers, User Governance, Audit Logging, and System Purge/Recovery.
- Normal Masters are restricted from Personal Ledger, Universal Payroll Batch Finalization, and Revenue Share Agreements.

---

## 15. Primary Master → Owner Parity Map

| Primary Master Module | Master Implementation Files | Owner Equivalent Module | Owner Implementation Files | Parity Status | Key Boundary / Difference |
|---|---|---|---|:---:|---|
| **Command Centre** | `pages/dashboardMaster.js` | Owner Overview (`OWN-SCR-001`) | `pages/dashboardOwner.js` | **PARTIAL (PARALLEL)** | Owner has 10-layer strategic view; Master has operational quick-actions & terminal controls. |
| **Tasks & Approvals** | `pages/tasksApprovals.js` | Operational Oversight (`OWN-SCR-002`) | `pages/tasksApprovals.js` | **FULL (SHARED)** | Same component; Owner default tab is `EXCEPTIONS`; Owner can verify tasks. |
| **Bills & Receipts** | `pages/ownerBills.js` | Bills & Receipts (`OWN-SCR-003`) | `pages/ownerBills.js` | **FULL (SHARED)** | Both use `ownerBills.js`. Owner can void bills, but CANNOT refund bills or close EOD. |
| **Finance & Accounts** | `pages/financeAccounts.js` | Owner Finance Summary (`OWN-SCR-004`) | `pages/ownerFinanceSummary.js` | **PARTIAL (PARALLEL)** | Master has GL journals and statements; Owner has executive summary, OpEx/Payroll ratios, and unit economics. |
| **Personal Ledger** | `pages/personalLedger.js` | Personal Ledger (`OWN-SCR-005`) | `pages/personalLedger.js` | **FULL (SHARED)** | 100% functional parity. Both roles can submit, classify to GL, reverse, and settle own vouchers. |
| **Café Performance** | Embedded in Master Dashboard | Café Performance (`OWN-SCR-006`) | `pages/cafePerformance.js` | **FULL (DEDICATED)** | Dedicated deep comparison table, AvT variance analytics, and weighted ABV/labor calculations. |
| **Reports & Analytics**| `pages/reportsAnalytics.js`| Reports (`OWN-SCR-007`) | `pages/reportsAnalytics.js` | **FULL (SHARED)** | Shared catalogue covering all 10 corporate domains, ZURF export engine, and metric dictionaries. |
| **Sales & Cash Book** | `pages/cashBook.js` | Sales & Cash Book (`OWN-SCR-008`)| `pages/cashBook.js` | **INTENTIONALLY RESTRICTED** | Owner has executive audit view; CANNOT post cash entries or reverse transactions. |
| **Passbook & Treasury**| `pages/passbook.js` | Passbook & Treasury (`OWN-SCR-009`) | `pages/passbook.js` | **FULL (SHARED)** | Primary Master & Owner exclusive. Full multi-café account reconciliation. |
| **Payroll Management** | `pages/payrollManagement.js`| Payroll & Payslips (`OWN-SCR-010`) | `pages/payrollManagement.js` | **INTENTIONALLY RESTRICTED** | Owner has read-only governance; CANNOT generate payment batches or finalize runs. |
| **Revenue Share** | `pages/revenueShare.js` | Revenue Share (`OWN-SCR-011`) | `pages/revenueShare.js` | **FULL (SHARED)** | Primary Master & Owner exclusive. Full agreement, lease, and settlement control. |
| **Employees** | `pages/employees.js` | Employees (`OWN-SCR-012`) | `pages/employees.js` | **FULL (SHARED)** | Owner holds `EMPLOYEE:WRITE` permissions across directory, staffing, and movements. |
| **Attendance & Shifts**| `modules/attendanceShifts.js`| Attendance (`OWN-SCR-013`) | `modules/attendanceShifts.js`| **INTENTIONALLY RESTRICTED** | Owner views live status and rosters; CANNOT manual-punch attendance. |
| **Settings** | `pages/settingsShared.js` | Settings (`OWN-SCR-014`) | `pages/settingsShared.js` | **SHARED (ROLE-AWARE)** | Administration and Trash tabs strictly hidden for Owner. |
| **POS Terminal** | `pages/posTill.js` | ❌ None | ❌ None | **INTENTIONALLY RESTRICTED** | Not accessible in Owner navigation; restricted to Master and Café Admin. |
| **Inventory** | `pages/inventory.js` | ❌ None | ❌ None | **INTENTIONALLY RESTRICTED** | Not accessible in Owner navigation; stock management restricted to Master / Ops. |
| **Procurement** | `pages/procurement.js` | ❌ None | ❌ None | **INTENTIONALLY RESTRICTED** | Not accessible in Owner navigation; backend allows PO approve/cancel. |
| **System Administration**| `pages/administration.js`| ❌ None | ❌ None | **INTENTIONALLY RESTRICTED** | Exclusively Master. |
| **Trash Bin** | `pages/trashBin.js` | ❌ None | ❌ None | **INTENTIONALLY RESTRICTED** | Exclusively Master. |

---

## 16. Shared Universal Components

The following modules are universally shared across personas, with role-based feature gating:
1. **Universal Employee Profile (`frontend/src/js/pages/employeeProfile.js`)**:
   - Consumed by all roles under `#employee-profile`, `#profile`, `#my-profile`.
   - Hydrates identity, employment records, emergency contacts, skills, and certifications.
2. **Universal Settings Hub (`frontend/src/js/pages/settingsShared.js`)**:
   - Universal preferences: Theme selection (Paper, Pearl, Midnight, Noir), language/region, device session revocation.
   - Gating: Sections `#settings/admin` and `#settings/trash` automatically fail-closed for non-Masters.
3. **Operational Notifications Hub (`frontend/src/js/pages/notificationCentre.js`)**:
   - Multi-channel notification delivery with unread badges, deep-linking, and category filtering.
4. **App Shell Infrastructure (`frontend/src/js/components.js`)**:
   - Dynamic role-aware sidebar rendering (`renderSidebar`, `wireSidebar`).
   - Topbar scope indicators, avatar menu, active café context strip (`wireCafeContextStrip`).

---

## 17. API Dependency Map

The Owner workspace interacts with the following backend API routes:

```text
OWNER WORKSPACE API CONSUMPTION
│
├── /api/v1/dashboard
│   ├── GET  /                           (Executive KPI payload & trends)
│   ├── GET  /saved-views                (List user saved views)
│   └── POST /saved-views                (Persist new filter preset)
│
├── /api/v1/bills
│   ├── GET  /overview                   (Summary KPIs & tender mix)
│   ├── GET  /                           (Bill listing & filtering)
│   ├── GET  /tax/gst-register           (Tax output breakdowns)
│   ├── POST /:id/void                   (Voiding incorrect bills)
│   ├── GET  /register/session/current   (Active cash drawer session)
│   ├── POST /register/session/event     (Cash in / Safe drop events)
│   └── POST /register/session/close     (Blind count session close)
│
├── /api/v1/tasks
│   ├── GET  /                           (Governed operational tasks)
│   ├── POST /:id/verify                 (Owner verification sign-off)
│   ├── POST /:id/return                 (Return task for correction)
│   ├── POST /:id/reopen                 (Reopen completed task)
│   ├── POST /:id/cancel                 (Cancel task)
│   └── POST /:id/block                  (Mark task blocked)
│
├── /api/v1/finance
│   └── GET  /overview                   (Financial snapshot & OpEx ratios)
│
├── /api/v1/personal-ledger
│   ├── GET  /overview                   (Ledger balance & voucher counts)
│   ├── GET  /entries                    (Transaction history)
│   ├── POST /entries                    (Create credit/debit voucher)
│   ├── POST /entries/:id/classify       (Classify to business GL)
│   ├── POST /entries/:id/reverse        (Reversing entry with audit)
│   ├── POST /settlements                (Batch settlement)
│   └── POST /confirmations              (Period balance confirmation)
│
├── /api/v1/passbook
│   ├── GET  /overview                   (Multi-café treasury overview)
│   └── GET  /accounts                   (Bank and cash vault accounts)
│
├── /api/v1/reports
│   ├── GET  /overview                   (Analytics executive overview)
│   ├── GET  /library                    (Certified report catalogue)
│   ├── GET  /portfolio                  (Cohort and LFL analytics)
│   ├── GET  /workforce                  (Labor % & attendance exceptions)
│   ├── GET  /inventory                  (Stock valuation & movements)
│   ├── GET  /menu                       (Menu engineering & contribution)
│   ├── GET  /goals                      (Target pacing scorecards)
│   └── POST /export                     (ZURF certified PDF/Excel export)
│
├── /api/v1/payroll
│   ├── GET  /overview                   (Payroll compliance & reconciliation)
│   └── GET  /runs                       (Payroll runs listing)
│
├── /api/v1/revenue-share
│   └── GET  /overview                   (Outlet agreements & settlements)
│
└── /api/v1/employees
    ├── GET  /overview                   (Workforce structure & headcount)
    ├── GET  /                           (Employee directory)
    └── POST /                           (Onboard new employee)
```

---

## 18. Database / Model Dependency Map

The Owner workspace directly reads from and writes to the following Mongoose models:

| Model Name | File Path | Primary Collections | Owner Operations |
|---|---|---|---|
| **`Bill`** | `backend/src/models/Bill.js` | `bills` | Reads sales history; updates status on `voidBill`. |
| **`RegisterSession`** | `backend/src/models/RegisterSession.js` | `registersessions` | Reads drawer status; records cash events; closes drawer session. |
| **`Task`** | `backend/src/models/Task.js` | `tasks` | Reads operational tasks; updates verification status & remarks. |
| **`PersonalLedger`** | `backend/src/models/PersonalLedger.js` | `personalledgers` | Reads own account; writes credit/debit vouchers; executes settlements. |
| **`DashboardSavedView`** | `backend/src/models/DashboardSavedView.js` | `dashboardsavedviews` | Reads & persists custom filter presets per user. |
| **`DashboardTarget`** | `backend/src/models/DashboardTarget.js` | `dashboardtargets` | Reads café financial and operational target goals. |
| **`PassbookAccount`** | `backend/src/models/PassbookAccount.js` | `passbookaccounts` | Reads treasury accounts and balances. |
| **`PayrollRun`** | `backend/src/models/PayrollRun.js` | `payrollruns` | Reads payroll run statuses, exceptions, and compliance metrics. |
| **`RevenueShareAgreement`**| `backend/src/models/RevenueShareAgreement.js` | `revenueshareagreements` | Reads leased outlet contracts and simulated settlements. |
| **`Employee`** | `backend/src/models/Employee.js` | `employees` | Reads workforce directory; writes onboarding and movement records. |
| **`Attendance`** | `backend/src/models/Attendance.js` | `attendances` | Reads presence counts, daily punches, and overtime exceptions. |
| **`AuditEvent`** | `backend/src/models/AuditEvent.js` | `auditevents` | Writes immutable audit logs for all Owner mutations (voids, verifications, reversals). |

---

## 19. Owner Test Inventory

The backend test suite contains **68 dedicated automated tests** verifying Owner functionality:

| Test Suite File | Tested Feature / Capability | Total Tests | Pass | Fail | Exit Code |
|---|---|:---:|:---:|:---:|:---:|
| `backend/test/ownerDashboardControl.test.js` | `OWN-SCR-001`: Multi-café scoping, cash drawer, ratio math, RBAC barriers | 6 | 6 | 0 | 0 |
| `backend/test/ownerTaskOversight.test.js` | `OWN-SCR-002`: Task verification, segregation of duties, lifecycle mutations | 7 | 7 | 0 | 0 |
| `backend/test/ownerSalesBills.test.js` | `OWN-SCR-003`: Bills scoping, GST splits, void/refund RBAC boundaries | 7 | 7 | 0 | 0 |
| `backend/test/ownerFinanceSummary.test.js` | `OWN-SCR-004`: Finance summary, OpEx/Payroll formulas, unit economics | 7 | 7 | 0 | 0 |
| `backend/test/ownerPersonalLedgerParity.test.js` | `OWN-SCR-005`: Ledger parity, GL classification, settlements, IDOR isolation | 6 | 6 | 0 | 0 |
| `backend/test/ownerCafePerformance.test.js` | `OWN-SCR-006`: Weighted ABV/labor math, AvT analytics, multi-café parity | 7 | 7 | 0 | 0 |
| `backend/test/ownerReportsAnalyticsParity.test.js` | `OWN-SCR-007`: 10-domain catalogue, ZURF export engine, metrics dictionary | 18 | 18 | 0 | 0 |
| `backend/test/assetOwnerScopePolicy.test.js` | Organisation-wide asset read scope for Owner vs Cafe Admin | 1 | 1 | 0 | 0 |
| `backend/test/billOwnerScopePolicy.test.js` | Organisation-wide bill read/void scope for Owner | 1 | 1 | 0 | 0 |
| `backend/test/inventoryOwnerScopePolicy.test.js` | Organisation-wide inventory read scope for Owner | 1 | 1 | 0 | 0 |
| **TOTAL** | **Dedicated Owner Test Inventory** | **10 Suites / 68 Tests** | **68** | **0** | **0** |

---

## 20. Uncovered Owner Functionality

While the 68 automated unit/integration tests pass with 100%, the following areas are identified as **CODE-TRACED** and require interactive UI/browser validation in subsequent phases:

1. **Dashboard Interactive SVG Trend Chart (`OWN-SCR-001`)**:
   - Dynamic bar chart height scaling and tooltips (`renderTrendChart` in `dashboardOwner.js:1523-1555`).
2. **Cash Drawer Modal Interaction (`OWN-SCR-001`)**:
   - Complete browser flow for blind count cash declaration and confirmation dialog.
3. **Task Correction Return Flow (`OWN-SCR-002`)**:
   - Modal reason submission and UI status badge update on `tasksApprovals.js`.
4. **Void Reason Modal Submission (`OWN-SCR-003`)**:
   - Real-time UI feedback when voiding an invoice via `ownerBills.js`.
5. **Personal Ledger Settlement Batch Execution (`OWN-SCR-005`)**:
   - Multi-voucher selection checkboxes and batch settlement trigger in the DOM.
6. **Report Export File Download Trigger (`OWN-SCR-007`)**:
   - Blob creation and browser file download handoff from `/api/v1/reports/export`.
7. **Cash Book Read-Only Presentation (`OWN-SCR-008`)**:
   - Ensuring entry creation buttons are correctly disabled/hidden for the Owner persona.

---

## 21. Duplicate / Legacy / Dead Code Candidates

| Candidate File / Component | Type | Location | Evidence / Analysis | Classification |
|---|---|---|---|---|
| `03_OWNER_PORTAL_ORIGINAL` | Abandoned Experiment | `D:\Zamorin_Cafe_ERP_Build\03_OWNER_PORTAL_ORIGINAL` | Contains standalone NestJS/Prisma owner portal. Completely unreferenced by active Express app. | **DEAD / LEGACY** |
| `main.js.BACKUP_20260811` | Stale Root Backup | `D:\Zamorin_Cafe_ERP_Build\main.js.BACKUP_20260811` | Old backup file at parent root from August 2026. | **LEGACY / DEAD** |
| `LOGIN-PAGE-2.0-main/index copy.html` | Duplicate Test File | `15_INTEGRATION_WORKSPACE/LOGIN-PAGE-2.0-main/` | Copy of login test page. Unreferenced in production. | **DUPLICATE** |
| `frontend/src/js/pages/staticAudit.js` | Misplaced Node Script | `frontend/src/js/pages/staticAudit.js` | Node.js script using `require('fs')` located inside browser SPA pages folder. Never imported by router. | **DEAD / UNREFERENCED** |
| `backend/src/routes/approvalRoutes.js` | Orphaned Route | `backend/src/routes/approvalRoutes.js` | Backend mounts `/api/v1/approvals`, but no frontend file calls `/approvals` (frontend calls `/tasks`). | **ORPHANED ROUTE** |
| `dashboardOwner.js` vs `dashboardMaster.js` | Parallel Implementations | `frontend/src/js/pages/` | Parallel dashboards. While intentional per design system, both replicate KPI fetching logic. | **SHARED ARCHITECTURE** |

---

## 22. Broken / Incomplete Wiring Candidates

1. **Undeclared Functions in `frontend/src/js/router.js` (Lines 476–477)**:
   - In `router.js:476-477`, lines invoke `renderOrgIdentity(subroute)` and `wireOrgIdentity(content, subroute)`.
   - **Neither function is imported at the top of `router.js`**.
   - If an authenticated Owner or Master navigates to `#org-identity`, execution throws a fatal runtime `ReferenceError: renderOrgIdentity is not defined`.
2. **Orphaned `/api/v1/approvals` Backend Route**:
   - The frontend's "Approvals Waiting on You" page (`tasksApprovals.js`) calls `/api/v1/tasks`.
   - The backend route `/api/v1/approvals` (`approvalRoutes.js`) is completely unused by the active frontend.
3. **Missing `assignedCafeIds` on Seeded Owner Account**:
   - In `backend/src/scripts/seedInitialData.js:1620-1630`, user `OW-0001` has no `assignedCafeIds` defined.
   - Controllers that filter with `{ $in: request.auth.assignedCafeIds || [] }` will treat this user as having zero authorized cafes.

---

## 23. Security Concerns & Vulnerability Analysis

1. **Café Scope Resolver Multi-Tenant Bypass Risk (`backend/src/utils/cafeScope.js:62-64`)**:
   - `resolveEffectiveCafeScope` returns `null` or user-specified `requestedCafe` for `role === 'OWNER'` without checking against `request.auth.assignedCafeIds`.
   - *Mitigation*: Several domain controllers perform redundant checks, but any new endpoint relying solely on `resolveEffectiveCafeScope` would inadvertently grant an Owner access to foreign cafés.
2. **Client-Side vs Server-Side Action Protection in Shared Modules**:
   - In shared pages like `employees.js`, administrative action buttons (e.g. Onboard Employee, Movements) are rendered for both Master and Owner. While the backend enforces `EMPLOYEE:WRITE`, the UI does not visually distinguish Master-exclusive versus Owner-permitted operations.
3. **No Offline Punching Invariant Preserved**:
   - Attendance verification strictly fails closed without caching punches offline, preventing time-tampering.

---

## 24. P0 / P1 / P2 / P3 Defect & Gap Findings

### P0 — Critical (Immediate Architectural or Runtime Blocker)
- **None**. No authorization bypass, cross-organisation data leak, or complete system crash was observed in active Owner workflows.

### P1 — High (Severe Functional Mismatch or Runtime Error)
- **Runtime Crash on `#org-identity` Route**: Missing `import { renderOrgIdentity, wireOrgIdentity }` in `frontend/src/js/router.js` causes an unhandled ReferenceError if navigated to.
- **Seeded Owner Missing `assignedCafeIds`**: `seedInitialData.js:1620-1630` seeds `OW-0001` without `assignedCafeIds`, causing empty datasets in café-scoped controllers.

### P2 — Medium (Inconsistency, Orphaned Routes or Scope Drift)
- **Scope Resolver Over-Privilege**: `resolveEffectiveCafeScope` treats `OWNER` as having global organisation scope instead of validating `auth.assignedCafeIds`.
- **Orphaned Approvals Backend API**: `/api/v1/approvals` exists on the backend but is disconnected from the frontend task approval workflow (`#approvals` uses `/api/v1/tasks`).

### P3 — Low (Code Cleanup & Placement)
- **Misplaced Node Script**: `frontend/src/js/pages/staticAudit.js` resides in the frontend client directory despite being a Node.js utility script.
- **Legacy Artifacts**: `03_OWNER_PORTAL_ORIGINAL` and `main.js.BACKUP_20260811` remain in the build directory.

---

## 25. Complete Owner File Inventory

| ID | Exact File Path | Layer | Role | Purpose | Called By | Calls / Dependencies | Active? | Tests | Notes |
|---|---|---|---|---|---|---|:---:|---|---|
| **FIL-01** | `frontend/src/js/pages/dashboardOwner.js` | Frontend Page | Owner Dedicated | Executive Command Centre (`OWN-SCR-001`) | `router.js` | `apiClient.js`, `components.js`, `icons.js` | **ACTIVE** | `ownerDashboardControl.test.js` | 10-layer executive intelligence |
| **FIL-02** | `frontend/src/js/pages/tasksApprovals.js` | Frontend Page | Shared | Tasks & Oversight (`OWN-SCR-002`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerTaskOversight.test.js` | Role-aware task verification |
| **FIL-03** | `frontend/src/js/pages/ownerBills.js` | Frontend Page | Shared / Owner branded | Sales Bills & Receipts (`OWN-SCR-003`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerSalesBills.test.js` | Invoice inspection & voiding |
| **FIL-04** | `frontend/src/js/pages/ownerFinanceSummary.js` | Frontend Page | Owner Dedicated | Owner Finance Summary (`OWN-SCR-004`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerFinanceSummary.test.js` | OpEx/Payroll ratio intelligence |
| **FIL-05** | `frontend/src/js/pages/personalLedger.js` | Frontend Page | Shared (Full Parity) | Personal Ledger & Account (`OWN-SCR-005`)| `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerPersonalLedgerParity.test.js`| 100% Primary Master parity |
| **FIL-06** | `frontend/src/js/pages/cafePerformance.js` | Frontend Page | Owner Dedicated | Café Performance Centre (`OWN-SCR-006`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerCafePerformance.test.js` | Weighted ABV/labor math |
| **FIL-07** | `frontend/src/js/pages/reportsAnalytics.js` | Frontend Page | Shared | Reports & Analytics (`OWN-SCR-007`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `ownerReportsAnalyticsParity.test.js`| 10-domain report catalogue |
| **FIL-08** | `frontend/src/js/pages/cashBook.js` | Frontend Page | Shared | Sales & Cash Book (`OWN-SCR-008`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `cashController.test.js` | Owner is read-only auditor |
| **FIL-09** | `frontend/src/js/pages/passbook.js` | Frontend Page | Shared (Master/Owner)| Passbook & Treasury (`OWN-SCR-009`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `passbookTreasury.test.js` | Primary Master & Owner only |
| **FIL-10** | `frontend/src/js/pages/payrollManagement.js` | Frontend Page | Shared | Payroll & Payslips (`OWN-SCR-010`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `payrollAccessApi.test.js` | Read-only governance for Owner |
| **FIL-11** | `frontend/src/js/pages/revenueShare.js` | Frontend Page | Shared (Master/Owner)| Revenue Share & Outlets (`OWN-SCR-011`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `revenueShareContract.test.js` | Leased spaces governance |
| **FIL-12** | `frontend/src/js/pages/employees.js` | Frontend Page | Shared | Workforce Management (`OWN-SCR-012`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `employeeWorkforceManagement.test.js`| Directory & onboarding |
| **FIL-13** | `frontend/src/js/modules/attendance/attendanceShifts.js` | Frontend Module | Shared | Attendance & Shifts (`OWN-SCR-013`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `attendanceManagement.test.js` | Roster and live presence |
| **FIL-14** | `frontend/src/js/pages/settingsShared.js` | Frontend Page | Shared Universal | Universal Settings Hub (`OWN-SCR-014`) | `router.js` | `apiClient.js`, `components.js` | **ACTIVE** | `settingsHubContract.test.js` | Preferences, themes, sessions |
| **FIL-15** | `frontend/src/js/navigation.js` | Frontend Core | Shared | Navigation & Sidebar allowlists | `main.js`, `router.js` | `components.js` | **ACTIVE** | `navigationRouterConsistency.test.js`| Defines `NAVIGATION[ROLES.OWNER]` |
| **FIL-16** | `frontend/src/js/router.js` | Frontend Core | Shared | Hash Router & Route Guards | `main.js` | All page components | **ACTIVE** | `verifyRouterImports.mjs` | Guards routes with `isRouteAllowed` |
| **FIL-17** | `backend/src/routes/dashboardRoutes.js` | Backend Route | Shared | Command Centre routes | `routes/index.js` | `dashboardController.js` | **ACTIVE** | `ownerDashboardControl.test.js` | Mounts `/api/v1/dashboard` |
| **FIL-18** | `backend/src/controllers/dashboardController.js` | Backend Controller | Shared | Command Centre aggregations | `dashboardRoutes.js` | `Bill`, `Expense`, `Task` models | **ACTIVE** | `ownerDashboardControl.test.js` | Multi-café KPI computation |
| **FIL-19** | `backend/src/controllers/taskController.js` | Backend Controller | Shared | Task governance & verifications | `taskRoutes.js` | `Task`, `AuditEvent` models | **ACTIVE** | `ownerTaskOversight.test.js` | `OWN-SCR-002` backend logic |
| **FIL-20** | `backend/src/controllers/billController.js` | Backend Controller | Shared | Bill queries, voiding, and drawer | `billRoutes.js` | `Bill`, `RegisterSession` models | **ACTIVE** | `ownerSalesBills.test.js` | POS void allowed; refund denied |
| **FIL-21** | `backend/src/controllers/financeController.js` | Backend Controller | Shared | Financial summaries & statements | `financeRoutes.js` | `Bill`, `Expense` models | **ACTIVE** | `ownerFinanceSummary.test.js` | `OWN-SCR-004` backend logic |
| **FIL-22** | `backend/src/controllers/personalLedgerController.js` | Backend Controller | Shared (Master/Owner)| Personal ledger transactions & GL | `personalLedgerRoutes.js`| `PersonalLedger` model | **ACTIVE** | `ownerPersonalLedgerParity.test.js`| 100% Master/Owner parity |
| **FIL-23** | `backend/src/controllers/reportController.js` | Backend Controller | Shared | Governed report catalogue & exports | `reportRoutes.js` | `Report` models | **ACTIVE** | `ownerReportsAnalyticsParity.test.js`| ZURF export engine |
| **FIL-24** | `backend/src/routes/passbookRoutes.js` | Backend Route | Shared (Master/Owner)| Passbook & Treasury routes | `routes/index.js` | `passbookController.js` | **ACTIVE** | `passbookTreasury.test.js` | Primary Master & Owner gate |
| **FIL-25** | `backend/src/routes/revenueShareRoutes.js` | Backend Route | Shared (Master/Owner)| Revenue share routes | `routes/index.js` | `revenueShareController.js` | **ACTIVE** | `revenueShareContract.test.js` | Primary Master & Owner gate |
| **FIL-26** | `backend/src/middleware/authorize.js` | Backend Middleware | Shared | RBAC & Absolute Role Restrictions | Routes | `RolePermission` model | **ACTIVE** | `full24PointValidation.test.js` | Enforces role barriers |
| **FIL-27** | `backend/src/utils/cafeScope.js` | Backend Utility | Shared | Tenant & Café scope resolution | Controllers | `ApiError.js` | **ACTIVE** | Scope unit tests | Multi-tenant boundary check |
| **FIL-28** | `backend/src/scripts/seedInitialData.js` | Backend Seed Script | Shared | System initial permissions & users | Direct script | All models | **ACTIVE** | Seed verification tests | Seeds `OW-0001` Owner account |

---

## 26. Files That Must Not Be Changed Without Prior Review

The following files represent frozen foundation milestones, shared enterprise contracts, or cryptographic security boundaries. **They must not be modified during Owner Window screen implementations without explicit review**:

1. `backend/src/modules/attendance/*` and `frontend/src/js/modules/attendance/staffAttendance.js` (Formally Frozen Attendance Milestone — Commit `4e58585`).
2. `frontend/src/js/pages/staffHome.js`, `staffLeave.js`, `staffLoansAdvances.js`, `staffDocuments.js`, `staffPayslips.js` (Formally Frozen Staff Workspace — Commit `9980e55`).
3. `backend/src/middleware/authenticate.js` and `backend/src/services/authService.js` (Frictionless Authentication & Session Authority — Commits `c5a38e1`, `6c50c63`).
4. `backend/src/middleware/deviceContext.js` and `backend/src/services/deviceTrustService.js` (31-Point Device Trust Subsystem).
5. `backend/src/models/User.js`, `Session.js`, `RolePermission.js` (Core Authentication & RBAC Schema).
6. `frontend/src/js/components.js` (App Shell persistent mounting architecture).
7. `frontend/src/js/apiClient.js` (Deduplication, caching, and in-flight request engine).

---

## 27. Recommended Order for OWNER-SCR Audit

To ensure systematic, risk-prioritized verification during subsequent Owner Window milestones, the following execution order is recommended:

1. **Milestone 1 — Executive Command Centre & Core Governance (`OWN-SCR-001` + `OWN-SCR-002`)**:
   - Audit `dashboardOwner.js` 10-layer data presentation, period filters, and cash drawer management modal.
   - Audit `tasksApprovals.js` task verification, segregation of duties, and return-for-correction workflows.
2. **Milestone 2 — Commercial & Financial Oversight (`OWN-SCR-003` + `OWN-SCR-004` + `OWN-SCR-008`)**:
   - Audit `ownerBills.js` invoice exploration, GST breakdown, and POS void execution.
   - Audit `ownerFinanceSummary.js` OpEx/Payroll ratios, gap analysis, and unit economics.
   - Audit `cashBook.js` read-only auditor view enforcement.
3. **Milestone 3 — Personal Ledger Parity & Treasury Governance (`OWN-SCR-005` + `OWN-SCR-009`)**:
   - Audit `personalLedger.js` voucher creation, business classification, batch settlements, and IDOR isolation.
   - Audit `passbook.js` multi-café account tracking and statement reconciliations.
4. **Milestone 4 — Portfolio Performance & Governed Analytics (`OWN-SCR-006` + `OWN-SCR-007`)**:
   - Audit `cafePerformance.js` weighted ABV, actual vs theoretical (AvT) food cost variance, and cohort pacing.
   - Audit `reportsAnalytics.js` 10-domain catalogue and ZURF certified export generation.
5. **Milestone 5 — Workforce, Revenue Share & Universal Hubs (`OWN-SCR-010` through `OWN-SCR-017`)**:
   - Audit `payrollManagement.js` read-only governance compliance checks.
   - Audit `revenueShare.js` leased space contracts and simulated settlements.
   - Audit `employees.js`, `attendanceShifts.js`, `settingsShared.js`, and `notificationCentre.js`.

---

## 28. Final Discovery Verdict

### Specific Architectural Assessment Questions

#### A. Have all identifiable Owner-related frontend files been mapped?
**YES**  
All 17 Owner-accessible screens (7 dedicated `OWN-SCR-` components + 10 shared/universal components), navigation manifests, router allowlists, API clients, and supporting CSS files have been forensically located, categorized, and documented.

#### B. Have all identifiable Owner-related backend files been mapped?
**YES**  
All backend routes, controllers, services, database models, middleware chains, and seed scripts involved in Owner operations have been catalogued and mapped to their corresponding frontend consumers.

#### C. Have Owner routes and navigation paths been mapped?
**YES**  
All 14 sidebar items in `NAVIGATION[ROLES.OWNER]` and 3 implicit/universal routes have been mapped end-to-end to their frontend renderers and backend route modules.

#### D. Have Owner APIs, controllers, services, and models been traced?
**YES**  
Complete traceability chains (`Action` → `Frontend Handler` → `HTTP Method/Endpoint` → `Backend Route` → `Middleware` → `Controller` → `Model`) have been established for all active Owner capabilities.

#### E. Have authentication, RBAC, and data-scope controls been located?
**YES**  
The authentication lifecycle (`authenticate.js`), absolute role restrictions (`authorize.js`), tenant boundary enforcement, and café scoping utilities (`cafeScope.js`) have been inspected and documented.

#### F. Has the Primary Master equivalent for every identifiable Owner module been located?
**YES**  
A comprehensive parity mapping has been generated comparing every Owner module against its Primary Master equivalent, categorizing each as Full Parity, Shared, Dedicated Parallel, or Intentionally Restricted.

#### G. Have shared components been distinguished from Owner-specific components?
**YES**  
Owner-specific files (e.g. `dashboardOwner.js`, `ownerFinanceSummary.js`, `cafePerformance.js`) have been strictly distinguished from shared multi-role modules (e.g. `personalLedger.js`, `tasksApprovals.js`, `reportsAnalytics.js`, `settingsShared.js`).

#### H. Have likely legacy / duplicate files been identified?
**YES**  
Archived delivery folders (`03_OWNER_PORTAL_ORIGINAL`), misplaced Node scripts (`staticAudit.js`), root backup files (`main.js.BACKUP_20260811`), and orphaned backend routes (`/api/v1/approvals`) have been identified and classified.

#### I. Have Owner-related tests been mapped?
**YES**  
All 68 automated unit/integration tests across 10 test suites covering Owner functionality have been inventoried, executed, and confirmed passing at 100%.

#### J. Are there unresolved files or code paths requiring deeper investigation?
**YES (PARTIAL — SPECIFIC GAPS FLAGGED)**  
Two specific defects have been identified for correction during implementation:
1. Runtime `ReferenceError` risk on `#org-identity` due to missing imports in `frontend/src/js/router.js`.
2. Multi-tenant scope discrepancy in `backend/src/utils/cafeScope.js:62-64` and missing `assignedCafeIds` on the seeded `OW-0001` account in `seedInitialData.js`.

---

## 29. Verification & Safety Sign-Off

- **Source Code Integrity**: **Zero application source files, CSS styles, database schemas, or permission definitions were modified during this discovery audit.**
- **Git Status**: Clean. The working tree remains identical to the baseline commit `e49f97b96f55e210a037394af1d9394f64ca6409`.
- **Created Artifacts**: Strictly limited to this single audit report: `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\ZAMORIN_OWNER_CODE_FILE_DISCOVERY_REPORT.md`.

---
*Report completed and formally certified by the Zamorin Café ERP Technical Lead.*
