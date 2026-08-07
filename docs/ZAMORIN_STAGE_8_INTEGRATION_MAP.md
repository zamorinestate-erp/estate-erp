# ZAMORIN CAFE ERP — STAGE 8 INTEGRATION MAP
## Module-to-File Traceability

Generated: 2026-08-07 | Git HEAD: 6c73fe5

---

## Backend Module Integration Map

| Module | Model(s) | Controller | Routes | Mounted At | Registered in index.js |
|--------|----------|-----------|--------|-----------|----------------------|
| Personal Ledger | PersonalLedger.js | personalLedgerController.js | personalLedgerRoutes.js | /api/v1/personal-ledger | YES |
| Inventory | GlobalInventoryItem.js, CafeInventoryConfig.js, StockMovement.js | inventoryController.js | inventoryRoutes.js | /api/v1/inventory | YES |
| Vendors | Vendor.js | vendorController.js | vendorRoutes.js | /api/v1/vendors | YES |
| Procurement | PurchaseOrder.js | procurementController.js | procurementRoutes.js | /api/v1/procurement | YES |
| Menu | MenuItem.js | menuController.js | menuRoutes.js | /api/v1/menu | YES |
| POS/Billing | Bill.js | billController.js | billRoutes.js | /api/v1/bills | YES |
| Customers | Customer.js, LoyaltyLedger.js | customerController.js | customerRoutes.js | /api/v1/customers | YES |
| Tasks | Task.js | taskController.js | taskRoutes.js | /api/v1/tasks | YES |
| Approvals | Approval.js | approvalController.js | approvalRoutes.js | /api/v1/approvals | YES |
| Quality | QualityChecklist.js | qualityController.js | qualityRoutes.js | /api/v1/quality | YES |
| Assets/Maintenance | Asset.js, MaintenanceJob.js | assetController.js | assetRoutes.js | /api/v1/assets | YES |
| Department Orders | DepartmentOrder.js | departmentOrderController.js | departmentOrderRoutes.js | /api/v1/department-orders | YES |
| Revenue Share | RevenueShareAgreement.js | revenueShareController.js | revenueShareRoutes.js | /api/v1/revenue-share | YES |
| Dashboard | (aggregates Bill, Task, Approval, Expense, Cafe) | dashboardController.js | dashboardRoutes.js | /api/v1/dashboard | YES |
| Private Files | PrivateFile.js | fileController.js | fileRoutes.js | /api/v1/files | YES |
| Trash Bin | (cross-model restore) | trashController.js | trashRoutes.js | /api/v1/trash | YES |
| Global Search | (cross-model query) | searchController.js | searchRoutes.js | /api/v1/search | YES |

---

## Data Flow Chains Implemented

### POS Billing Chain
MenuItem catalogue → Bill creation (price snapshot) → Bill completion → CashTransaction auto-posted (CASH_IN if paymentMethod=CASH)

### Procurement Chain
Vendor master → PurchaseOrder DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED/RECEIVED → StockMovement (PURCHASE_RECEIPT) → CafeInventoryConfig $inc balance

### Loyalty Chain
Customer profile → Bill completion triggers loyalty earn → LoyaltyLedger entry → Balance aggregation → Redeem reduces balance atomically

### Inventory Chain
GlobalInventoryItem (master definition) → CafeInventoryConfig (per-cafe balance) → StockMovement (immutable audit trail)

### Dashboard Chain
Bill aggregation (today's sales) + CafeInventoryConfig (low stock) + Task (pending) + Approval (pending) + Cafe (active count) → /api/v1/dashboard response

---

## Pre-Stage-8 Canonical Systems (NOT Modified)

| System | Files | Notes |
|--------|-------|-------|
| User Identity | User.js, userController.js, userRoutes.js | Canonical employee identity; Stage 8 does not duplicate |
| Cash Transactions | CashTransaction.js, cashController.js, cashRoutes.js | Canonical cash book; Bill controller posts to it |
| Expenses | Expense.js, expenseController.js, expenseRoutes.js | Canonical expense workflow; MASTER-only decisions |
| Attendance | Attendance.js, attendanceController.js, attendanceRoutes.js | Canonical attendance; Stage 8 does not replace |
| Payroll | PayrollRun.js, Payslip.js, 7 payroll controllers | Fully separate pre-Stage-8 system; Stage 8 no regression |
| Notifications | Notification.js, notificationController.js | Canonical; Stage 8 does not create duplicate |
| Audit | AuditEvent.js, auditService.js, auditController.js | All Stage 8 controllers use recordRequestAudit() |
| Sequence IDs | SequenceCounter.js | All Stage 8 controllers use SequenceCounter.generateId() |
| Cafe Registry | Cafe.js, cafeController.js | Canonical cafe definition; dashboard references it |

---

## Frontend Module Map

| Frontend File | Route Key | Renders For Roles | API Connected (as of Stage 8) |
|--------------|-----------|-------------------|-------------------------------|
| dashboardMaster.js | dashboard | MASTER, OWNER | PARTIAL (API exists; hydration hardcoded) |
| dashboardAdmin.js | dashboard | CAFE_ADMIN | PARTIAL (static) |
| posTill.js | pos | CAFE_ADMIN, STAFF | NO |
| cashBook.js | sales-cash | MASTER, OWNER, CAFE_ADMIN | NO |
| financeAccounts.js | finance | MASTER, OWNER | NO (stub) |
| personalLedger.js | ledger | MASTER | NO |
| expenses.js | expenses | MASTER, OWNER, CAFE_ADMIN | NO |
| inventory.js | inventory | MASTER, OWNER, CAFE_ADMIN | NO |
| employees.js | employees | MASTER, OWNER | NO |
| attendanceShifts.js | attendance | MASTER, OWNER, CAFE_ADMIN | NO |
| tasksApprovals.js | tasks, approvals | MASTER, OWNER, CAFE_ADMIN | NO |
| reportsAnalytics.js | reports | MASTER, OWNER | NO |
| payrollManagement.js | payroll | MASTER, OWNER | PARTIAL (pre-Stage 8 integration) |
| staffPayslips.js | staff-payslips | STAFF | PARTIAL (pre-Stage 8 integration) |
| administration.js | admin | MASTER | PARTIAL (pre-Stage 8 governance API) |
| notificationCentre.js | notifications | ALL | NO |
| settingsShared.js | settings | MASTER, OWNER, CAFE_ADMIN | NO |
| staffHome.js | staff-home | STAFF | NO |
| staffAttendance.js | staff-attendance | STAFF | NO |
| staffLeave.js | staff-leave | STAFF | NO |

**Missing frontend pages (no router.js route)**: procurement, vendors, menu, customers, quality, assets, maintenance, department-orders, revenue-share, trash-bin
