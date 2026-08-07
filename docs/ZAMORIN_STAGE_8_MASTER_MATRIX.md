# ZAMORIN CAFE ERP — STAGE 8 MASTER MATRIX
## Evidence-Based Verification Document

Generated: 2026-08-07
Git HEAD at time of audit: `6c73fe5`
Working tree: CLEAN

---

## Section 1: Corrected Completion Summary

### Actual Mongoose Models Added (from `git diff --name-status`)

| # | Model File | Domain |
|---|-----------|--------|
| 1 | PersonalLedger.js | Finance — Personal Ledger |
| 2 | GlobalInventoryItem.js | Inventory — Global Item Catalogue |
| 3 | CafeInventoryConfig.js | Inventory — Cafe Stock Config |
| 4 | StockMovement.js | Inventory — Immutable Movement Ledger |
| 5 | Vendor.js | Procurement — Vendor Master |
| 6 | PurchaseOrder.js | Procurement — Purchase Order |
| 7 | MenuItem.js | Menu — Item Catalogue |
| 8 | Bill.js | POS — Sales Bill / Receipt |
| 9 | Customer.js | CRM — Customer Directory |
| 10 | LoyaltyLedger.js | CRM — Loyalty Points Ledger |
| 11 | Task.js | Operations — Task Tracker |
| 12 | Approval.js | Workflow — Generic Approval |
| 13 | QualityChecklist.js | Quality and Compliance |
| 14 | Asset.js | Asset Register |
| 15 | MaintenanceJob.js | Asset Maintenance |
| 16 | DepartmentOrder.js | Inter-Dept Order |
| 17 | RevenueShareAgreement.js | Finance — Revenue Share |
| 18 | PrivateFile.js | File Storage Metadata |

**CORRECT COUNT: 18 new Mongoose models** (previously stated as 14 — this was incorrect).

### Actual Controllers Added

| # | Controller File | Domain |
|---|----------------|--------|
| 1 | approvalController.js | Workflow |
| 2 | assetController.js | Assets |
| 3 | billController.js | POS |
| 4 | customerController.js | CRM |
| 5 | dashboardController.js | Command Centre |
| 6 | departmentOrderController.js | Dept Orders |
| 7 | fileController.js | File Storage |
| 8 | inventoryController.js | Inventory |
| 9 | menuController.js | Menu |
| 10 | personalLedgerController.js | Personal Ledger |
| 11 | procurementController.js | Procurement |
| 12 | qualityController.js | Quality |
| 13 | revenueShareController.js | Revenue Share |
| 14 | searchController.js | Global Search |
| 15 | taskController.js | Tasks |
| 16 | trashController.js | Trash Bin |
| 17 | vendorController.js | Vendors |

**CORRECT COUNT: 17 new controllers** (previously stated as 14 — incorrect).

### Actual Route Files Added

| # | Route File | Mounted At |
|---|-----------|-----------|
| 1 | approvalRoutes.js | /api/v1/approvals |
| 2 | assetRoutes.js | /api/v1/assets |
| 3 | billRoutes.js | /api/v1/bills |
| 4 | customerRoutes.js | /api/v1/customers |
| 5 | dashboardRoutes.js | /api/v1/dashboard |
| 6 | departmentOrderRoutes.js | /api/v1/department-orders |
| 7 | fileRoutes.js | /api/v1/files |
| 8 | inventoryRoutes.js | /api/v1/inventory |
| 9 | menuRoutes.js | /api/v1/menu |
| 10 | personalLedgerRoutes.js | /api/v1/personal-ledger |
| 11 | procurementRoutes.js | /api/v1/procurement |
| 12 | qualityRoutes.js | /api/v1/quality |
| 13 | revenueShareRoutes.js | /api/v1/revenue-share |
| 14 | searchRoutes.js | /api/v1/search |
| 15 | taskRoutes.js | /api/v1/tasks |
| 16 | trashRoutes.js | /api/v1/trash |
| 17 | vendorRoutes.js | /api/v1/vendors |

**CORRECT COUNT: 17 new route modules** (previously stated as 14 — incorrect).

---

## Section 2: Duplicate Architecture Audit

| New File | Domain | Existing Related Model/Route/Service | Duplicate? | Reason Required | Canonical |
|---------|--------|-------------------------------------|------------|-----------------|-----------|
| PersonalLedger.js | Finance | None | NO | New MASTER-only financial journal | PersonalLedger.js |
| GlobalInventoryItem.js | Inventory | None | NO | Global item catalogue with unique itemId | GlobalInventoryItem.js |
| CafeInventoryConfig.js | Inventory | None | NO | Per-cafe stock balance separate from item definition | CafeInventoryConfig.js |
| StockMovement.js | Inventory | None | NO | Immutable movement ledger | StockMovement.js |
| Vendor.js | Procurement | None | NO | Vendor master with tax/bank details | Vendor.js |
| PurchaseOrder.js | Procurement | None (Expense.js is for staff claims) | NO | PO lifecycle distinct from expenses | PurchaseOrder.js |
| MenuItem.js | Menu | None | NO | Menu catalogue with price history | MenuItem.js |
| Bill.js | POS | CashTransaction.js exists but is downstream | NO | Bill is the upstream source; Bill generates CashTransaction | Bill.js |
| Customer.js | CRM | User.js (internal employees only) | NO | External guests separate from employees | Customer.js |
| LoyaltyLedger.js | CRM | None | NO | Immutable loyalty points ledger | LoyaltyLedger.js |
| Task.js | Operations | None | NO | Staff/cafe task tracking | Task.js |
| Approval.js | Workflow | Expense.js has own approval states | PARTIAL OVERLAP - see gap | Generic approval; MUST NOT intercept expense/overtime | Expense.js for expenses; Approval.js for generic tasks only |
| QualityChecklist.js | Quality | None | NO | New domain | QualityChecklist.js |
| Asset.js | Assets | None | NO | Asset register | Asset.js |
| MaintenanceJob.js | Maintenance | None | NO | Maintenance job lifecycle | MaintenanceJob.js |
| DepartmentOrder.js | Dept Orders | None (PurchaseOrder is external vendor PO) | NO | Internal cross-dept requisition | DepartmentOrder.js |
| RevenueShareAgreement.js | Revenue Share | None | NO | Owner revenue distribution | RevenueShareAgreement.js |
| PrivateFile.js | File Storage | None | NO | Metadata wrapper for private object storage | PrivateFile.js |

**Approval Bypass Gap**: decideApproval allows OWNER/CAFE_ADMIN to decide approval records with any entityType. A bad actor could tag entityType: 'EXPENSE' on a generic Approval record. This must be fixed with an entityType blocklist in decideApproval. See Gap Register.

---

## Section 3: 28-Module Status Matrix

| # | Module | Responsive UI | API | MongoDB | Permissions | Audit | Notifications | Reports/Exports | Tests | Status | Evidence |
|---|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|--------|----------|
| 1 | Command Centre | UI exists but hardcoded mock data | dashboardController.js live aggregation | Bill, Task, Approval | Role-scoped filter | None | None | None | None | PARTIAL | hydrateMasterDashboard() fills with fabricated hardcoded strings — not from API |
| 2 | POS and Billing | posTill.js rendered | billController.js complete | Bill.js | CAFE_ADMIN+STAFF | recordRequestAudit | None | None | Model tests only | BACKEND_ONLY | posTill.js does not call /api/v1/bills |
| 3 | Sales and Cash | cashBook.js rendered | cashController.js (pre-Stage 8); bill auto-posts CashTransaction | CashTransaction.js | cashController guards | recordRequestAudit | None | reportController.js | cashController tests | PARTIAL | cashBook.js does not call live API |
| 4 | Finance and Accounts | financeAccounts.js is static stub | No dedicated finance endpoints | CashTransaction.js | None | None | None | None | None | BACKEND_ONLY | financeAccounts.js returns placeholder UI only |
| 5 | Personal Ledger | personalLedger.js honest empty state | personalLedgerController.js MASTER-only | PersonalLedger.js immutable | absoluteRestriction PERSONAL_LEDGER | recordRequestAudit | None | None | businessModules model tests | PARTIAL | wireLedger() does not fetch from /api/v1/personal-ledger |
| 6 | Expenses | expenses.js rendered | expenseController.js (pre-Stage 8) | Expense.js canonical | MASTER-only decisions | recordRequestAudit | Notification used | reportController.js | expenseController tests | PARTIAL | expenses.js frontend not calling live API |
| 7 | Procurement | None | procurementController.js full PO lifecycle | PurchaseOrder.js + StockMovement | Role-scoped | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 8 | Vendors | None | vendorController.js CRUD + lifecycle | Vendor.js | MASTER/OWNER | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 9 | Inventory | inventory.js rendered | inventoryController.js complete | GlobalInventoryItem + CafeInventoryConfig + StockMovement | Role-scoped | recordRequestAudit | None | None | Model tests | PARTIAL | inventory.js does not call /api/v1/inventory live |
| 10 | Menu and Pricing | None | menuController.js complete | MenuItem.js | MASTER/OWNER/CAFE_ADMIN | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No menu management page in router.js |
| 11 | Employees and HR | employees.js rendered | employeeController.js search only; GET /:userId MISSING | User.js canonical | EMPLOYEE:READ | None | None | None | employeeSearchApi.test.js | PARTIAL | GET /employees/:userId and GET /employees/me not implemented |
| 12 | Attendance, Shifts, Leave | attendanceShifts.js, staffAttendance.js, staffLeave.js | attendanceController.js (pre-Stage 8) | Attendance.js canonical | attendanceRoutes | None | None | None | None | PARTIAL | Stage 4 calendar/auto-absence/overtime approval not completed |
| 13 | Payroll, Payslips, Loans | payrollManagement.js, staffPayslips.js | 7 payroll sub-controllers | PayrollRun.js + Payslip.js | payrollRoutes | recordRequestAudit | None | reportController.js | payrollController tests | COMPLETE_AND_VERIFIED | Stage 8 did not regress payroll; pre-existing complete system |
| 14 | Customers and Loyalty | None | customerController.js earn/redeem/balance | Customer.js + LoyaltyLedger.js | Role-scoped | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 15 | Quality and Compliance | None | qualityController.js checklist CRUD | QualityChecklist.js | Role-scoped | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 16 | Assets and Maintenance | None | assetController.js asset + maintenance lifecycle | Asset.js + MaintenanceJob.js | Role-scoped | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 17 | Tasks and Approvals | tasksApprovals.js rendered | taskController.js + approvalController.js | Task.js + Approval.js | MASTER/OWNER/CAFE_ADMIN | recordRequestAudit | None | None | Model tests | PARTIAL | Frontend does not call /api/v1/tasks or /api/v1/approvals live |
| 18 | Revenue Share | None | revenueShareController.js agreement CRUD | RevenueShareAgreement.js | MASTER/OWNER | recordRequestAudit | None | None | Model tests | BACKEND_ONLY + BLOCKED | Calculation formula not defined: BLOCKED/PENDING BUSINESS CONFIRMATION |
| 19 | Department Orders | None | departmentOrderController.js full lifecycle | DepartmentOrder.js | Role-scoped | recordRequestAudit | None | None | Model tests | BACKEND_ONLY | No frontend page |
| 20 | Reports and Analytics | reportsAnalytics.js rendered | reportController.js (pre-Stage 8) | Multiple models | Role-scoped | None | None | PDF/XLSX/CSV | None | PARTIAL | reportsAnalytics.js does not call live API; Stage 7 watermark not formally tested |
| 21 | Integrations | None | None | None | N/A | N/A | N/A | N/A | None | MISSING | No external integrations documented or implemented |
| 22 | Administration | administration.js rendered | userController.js + governance (pre-Stage 8) | User.js canonical | MASTER-only user admin | recordRequestAudit | None | None | userGovernanceApi.test.js | COMPLETE_AND_VERIFIED | Uses canonical secure user governance; no bypass introduced |
| 23 | Settings and Profile | settingsShared.js + staffSettings.js | authController.js /auth/me exists | User.js | authenticate | None | None | None | None | PARTIAL | Pages do not persist to backend live |
| 24 | Notification Centre | notificationCentre.js rendered | notificationController.js (pre-Stage 8) | Notification.js canonical | notificationRoutes | N/A | N/A | None | None | PARTIAL | No second notification system; canonical used. Frontend not calling live API |
| 25 | Private Files | None | fileController.js metadata only | PrivateFile.js | authenticate + authorize | recordRequestAudit | None | None | Model tests | PARTIAL / PENDING CLOUD VALIDATION | No real object storage configured; cloud deployment dependency |
| 26 | Trash Bin and Audit | Audit via admin page; no trash UI | trashController.js MASTER-only | User.js + AuditEvent.js | trashRoutes MASTER only | recordRequestAudit | None | None | auditController | BACKEND_ONLY | No trash bin frontend page |
| 27 | Universal IDs and Numbering | N/A | All 17 new controllers use SequenceCounter.generateId() | SequenceCounter.js canonical | Backend-generated only | N/A | N/A | N/A | Implicit in model tests | COMPLETE_AND_VERIFIED | All Stage 8 business IDs: backend-generated, sequential, immutable |
| 28 | Role Portals | MASTER/OWNER/CAFE_ADMIN/STAFF nav enforced | Role-scoped API filters in all controllers | organisationId+cafeId in all models | authorize() on all routes | N/A | N/A | N/A | userGovernanceApi.test.js | PARTIAL | Frontend defaults to MASTER hardcoded; /auth/me bootstrap not connected (Stage 9 gap) |

---

## Section 4: Status Summary

| Status | Count | Modules |
|--------|-------|---------|
| COMPLETE_AND_VERIFIED | 3 | Payroll, Administration, Universal IDs |
| PARTIAL | 11 | Command Centre, Sales/Cash, Personal Ledger, Expenses, Inventory, Employees, Attendance, Tasks/Approvals, Reports, Settings, Notifications, Role Portals |
| BACKEND_ONLY | 9 | POS/Billing, Finance, Procurement, Vendors, Menu, Customers, Quality, Assets, Dept Orders, Trash Bin |
| MISSING | 1 | Integrations |
| BLOCKED | 1 | Revenue Share (calculation formula) |
| PARTIAL/PENDING CLOUD | 1 | Private Files object storage |

**FORMAL STAGE 8 DECISION: STAGE_8_NOT_COMPLETE**

The frontend is running as a hardcoded demo shell without real API connections. 9 modules are BACKEND_ONLY with no frontend screens. The mandatory full-stack integration requirement is not satisfied.
