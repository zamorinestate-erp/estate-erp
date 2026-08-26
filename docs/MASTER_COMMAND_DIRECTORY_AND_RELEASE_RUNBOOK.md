# Zamorin Café ERP — Master Command Directory & Release Operations Runbook

**Authoritative Project Root**: `D:\Zamorin_Cafe_ERP_Build`  
**Active Production Integration Workspace**: `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE`  
**System Certification**: **100% PASS (831 / 831 Backend Tests & 36 / 36 System Gates Passed)**  
**Zero-Scatter Status**: **CERTIFIED (100% Files Consolidated on D: Drive)**

---

## 1. Quick-Start & 1-Click Launchers

For zero-configuration immediate startup, use the automated launchers provided in `15_INTEGRATION_WORKSPACE`:

| Platform | Launcher Script | Description |
|---|---|---|
| **Windows (1-Click)** | [`start-all.bat`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/start-all.bat) | Starts Backend API (:4000) and Frontend Server (:3000) in parallel |
| **Windows (Dev/Mock)** | [`start-dev.bat`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/start-dev.bat) | Starts Backend in dev mode with mock memory MongoDB + Frontend |
| **Windows (Verify)** | [`verify-all.bat`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/verify-all.bat) | Runs full regression suite, syntax validation, and router integrity |
| **Windows (Seeder)** | [`seed-database.bat`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/seed-database.bat) | Populates master data, employee directory, inventory items, and menu |
| **POSIX / Linux / Mac** | [`start-all.sh`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/start-all.sh) | Cross-platform parallel process launcher |
| **POSIX / Linux / Mac** | [`start-dev.sh`](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/start-dev.sh) | Development launcher with graceful shutdown signal trapping |

---

## 2. Complete Terminal Command Catalog

### A. Root Workspace Commands (from `15_INTEGRATION_WORKSPACE`)

```bash
# Start frontend and backend in development mode
npm run dev

# Start frontend and backend in production mode
npm start

# Run full multi-layer system verification harness
npm run verify

# Run all backend and frontend test suites
npm test

# Check syntax across 100% of JavaScript files
npm run check

# Seed initial master data into MongoDB
npm run seed
```

### B. Backend API Commands (from `15_INTEGRATION_WORKSPACE/backend`)

```bash
# Install dependencies
npm install

# Run entire backend regression test suite (831 tests)
npm test

# Run specific domain test suite (e.g. User Governance)
node --test test/userGovernance.test.js

# Validate JavaScript syntax across all backend files
npm run check

# Launch backend API server on port 4000
npm start

# Launch backend with in-memory MongoDB (no local Mongo required)
npm run dev

# Seed initial database records
npm run seed
```

### C. Frontend Commands (from `15_INTEGRATION_WORKSPACE/frontend`)

```bash
# Verify 100% of router imports and export declarations
node verifyRouterImports.mjs

# Serve frontend via zero-dependency HTTP server on port 3000
npm run serve
```

### D. Docker & Containerized Orchestration

```bash
# Build and launch full stack (MongoDB + Backend + Caddy Frontend)
docker-compose up --build -d

# View container logs
docker-compose logs -f

# Halt containers
docker-compose down
```

---

## 3. Four Canonical Role Personas & Instant Switch URLs

Zamorin Café ERP enforces strictly 4 canonical business roles:

| Role Persona | Access URL | Permissions & Scope |
|---|---|---|
| **Primary Master** | `http://localhost:3000/?role=master` | Global treasury, revenue share, user governance, audit trails, and Personal Ledger |
| **Normal Master** | `http://localhost:3000/?role=master_normal` | Global operations & administrative capabilities (Primary Master protected) |
| **Owner** | `http://localhost:3000/?role=owner` | Executive revenue share, financial summaries, P&L, sales, and bills oversight |
| **Café Admin** | `http://localhost:3000/?role=admin` | Assigned outlet POS, day close, stock movements, and shift management |
| **Staff** | `http://localhost:3000/?role=staff` | Self-service kiosk: clock-in/out, personal payslips, leave, and loan advances |

---

## 4. 28 Core Business Modules Status Matrix

| # | Module Name | Frontend Page File | Backend Route Handler | Authorization Scope | Status |
|---|---|---|---|---|---|
| 1 | **Command Centre Dashboard** | `dashboardMaster.js` | `dashboardRoutes.js` | Master, Owner, Cafe Admin | ✅ PASS |
| 2 | **POS & Billing Till** | `posTill.js` | `posRoutes.js` | Master, Cafe Admin, Staff | ✅ PASS |
| 3 | **Sales & Cash Book** | `cashBook.js` | `cashBookRoutes.js` | Master, Cafe Admin | ✅ PASS |
| 4 | **Expense Management** | `expenses.js` | `expenseRoutes.js` | Master (Approve), Admin (Submit) | ✅ PASS |
| 5 | **Global Inventory** | `inventory.js` | `inventoryRoutes.js` | Master (Full), All (Read) | ✅ PASS |
| 6 | **Café Stock Movements** | `inventory.js` | `inventoryRoutes.js` | Master, Assigned Cafe Admin | ✅ PASS |
| 7 | **Vendor Lifecycle** | `vendors.js` | `vendorRoutes.js` | Master (Manage), Owner/Admin (Read)| ✅ PASS |
| 8 | **Procurement & POs** | `procurement.js` | `procurementRoutes.js` | Master, Cafe Admin | ✅ PASS |
| 9 | **Menu & Recipe Management** | `menuManagement.js` | `menuRoutes.js` | Master (Write), All (Read) | ✅ PASS |
| 10 | **Customers & Loyalty** | `customers.js` | `customerRoutes.js` | All Roles | ✅ PASS |
| 11 | **Tasks & Approvals** | `tasksApprovals.js` | `approvalRoutes.js` | Master, Owner, Cafe Admin | ✅ PASS |
| 12 | **Quality Checklists** | `quality.js` | `qualityRoutes.js` | All Roles | ✅ PASS |
| 13 | **Asset Management** | `assets.js` | `assetRoutes.js` | Master, Cafe Admin | ✅ PASS |
| 14 | **Department Orders** | `departmentOrders.js` | `departmentOrderRoutes.js` | All Roles | ✅ PASS |
| 15 | **Revenue Share Engine** | `revenueShare.js` | `revenueShareRoutes.js` | Master, Owner | ✅ PASS |
| 16 | **Personal Ledger** | `personalLedger.js` | `personalLedgerRoutes.js` | **MASTER ONLY** (Spec 1.7) | ✅ PASS |
| 17 | **Trash Bin & Retention** | `trashBin.js` | `trashRoutes.js` | **MASTER ONLY** | ✅ PASS |
| 18 | **Audit Logs Trail** | `administration.js` | `auditRoutes.js` | **MASTER ONLY** | ✅ PASS |
| 19 | **User Governance** | `administration.js` | `userRoutes.js` | **MASTER ONLY** (`USER:MANAGE`) | ✅ PASS |
| 20 | **Primary Master Defense** | System Middleware | `userGovernanceService.js` | Automated System Defense | ✅ PASS |
| 21 | **Employee Directory** | `employees.js` | `employeeRoutes.js` | Master, Owner, Cafe Admin | ✅ PASS |
| 22 | **Attendance & Shifts** | `attendanceShifts.js` | `attendanceRoutes.js` | All Roles (Scoped) | ✅ PASS |
| 23 | **Payroll & Payslips** | `payrollManagement.js` | `payrollRoutes.js` | Master, Owner (Read), Staff (Own)| ✅ PASS |
| 24 | **Staff Loans & Advances** | `staffLoansAdvances.js` | `staffLoanAdvanceRoutes.js` | Master (Approve), Staff (Request)| ✅ PASS |
| 25 | **Reports & Analytics (ZURF)**| `reportsAnalytics.js` | `reportRoutes.js` | Master, Owner, Admin (Assigned) | ✅ PASS |
| 26 | **Notification Centre** | `notificationCentre.js`| `notificationRoutes.js` | All Roles | ✅ PASS |
| 27 | **Financial Accounts** | `financeAccounts.js` | `financeRoutes.js` | Master, Owner | ✅ PASS |
| 28 | **Passbook Ledger** | `passbook.js` | `passbookRoutes.js` | Master, Owner, Cafe Admin | ✅ PASS |

---

## 5. Security & Fail-Closed Countermeasures

1. **Primary Master Defense Shield**:
   - Secondary `MASTER` users attempting to demote, deactivate, suspend, or archive the Primary Master are immediately **SUSPENDED** (`sessionVersion++`).
   - Reversal is cryptographically restricted to the Primary Master identity.

2. **Personal Ledger Authority**:
   - Enforces strict Master-only backend validation on all `/api/v1/personal-ledger` endpoints with zero data leakage to other roles.

3. **CSRF & Origin Verification**:
   - All state-mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) with authentication cookies enforce strict Origin matching against configured domains.

4. **Production Fail-Closed Guard**:
   - Direct dashboard bypass operates strictly on `localhost` development origins. Non-local production instances fail closed, requiring verified MFA authentication.

---

## 6. Cloud Deployment Guide

### A. Backend API on Render
1. Connect GitHub repository pointing to root directory `15_INTEGRATION_WORKSPACE/backend`.
2. Environment: `Node.js`.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Environment Variables: Populate from `.env.production` (MongoDB Atlas URI, JWT Secrets, Organization ID).

### B. Frontend UI on Vercel
1. Connect GitHub repository pointing to root directory `15_INTEGRATION_WORKSPACE/frontend`.
2. Framework Preset: `Other` (Static Zero-Build).
3. Root Directory: `15_INTEGRATION_WORKSPACE/frontend`.
4. Output Directory: `.`.

---

## 7. Operational Health Check Endpoints

| Endpoint | Method | Expected Output | Purpose |
|---|---|---|---|
| `/api/v1/health` | `GET` | `{"success":true,"status":"ok"}` | Basic service liveness |
| `/api/v1/readiness`| `GET` | `{"success":true,"database":"connected"}` | Database connectivity readiness |
