# ZAMORIN CAFE ERP — 38 CAPABILITY SCOPE AUDIT

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0` (Commit `4765c2c`)  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. 38 Advanced Capability Audit Matrix

| # | Capability Name | Classification | Model / Schema Evidence | API Endpoint | Frontend Page | Permission | Test Status | Final Status |
|---|---|---|---|---|---|---|---|---|
| 01 | Internal Controls | APPROVED SUPPORTING | `User.governanceHistory` | `/api/v1/users/:userId/role` | `administration.js` | `USER:MANAGE` | PASS | COMPLETE |
| 02 | Contracts Engine | APPROVED SUPPORTING | `RevenueShareAgreement` | `/api/v1/revenue-share` | `contracts.js` | `REVENUE_SHARE_READ` | PASS | COMPLETE |
| 03 | Compliance Management | APPROVED SUPPORTING | `ChecklistLog` | `/api/v1/quality` | `quality.js` | `QUALITY_READ` | PASS | COMPLETE |
| 04 | Financial Close | APPROVED SUPPORTING | `CashRegisterSession` | `/api/v1/cash-transactions` | `cash.js` | `FINANCE_READ` | PASS | COMPLETE |
| 05 | Treasury Management | APPROVED SUPPORTING | `PersonalLedgerEntry` | `/api/v1/personal-ledger` | `personalLedger.js` | `PERSONAL_LEDGER_READ` | PASS | COMPLETE |
| 06 | Supplier Portal | APPROVED SUPPORTING | `PurchaseOrder` | `/api/v1/supplier-portal/orders` | `vendors.js` | `VENDORS_READ` | PASS | COMPLETE |
| 07 | RFQ Management | APPROVED SUPPORTING | `PurchaseOrder.rfqReference` | `/api/v1/procurement` | `procurement.js` | `PROCUREMENT_READ` | PASS | COMPLETE |
| 08 | 3-Way Match Engine | APPROVED SUPPORTING | `PurchaseOrder.matchStatus` | `/api/v1/procurement` | `procurement.js` | `PROCUREMENT_WRITE` | PASS | COMPLETE |
| 09 | Vendor Risk Scoring | APPROVED SUPPORTING | `Vendor.riskRating` | `/api/v1/vendors` | `vendors.js` | `VENDORS_READ` | PASS | COMPLETE |
| 10 | Automated Reorder | APPROVED SUPPORTING | `StockLevel.minReorderLevel` | `/api/v1/inventory` | `inventory.js` | `INVENTORY_READ` | PASS | COMPLETE |
| 11 | Stocktake Audit | APPROVED SUPPORTING | `StockMovement.type = ADJUSTMENT` | `/api/v1/inventory/adjustments` | `inventory.js` | `INVENTORY_WRITE` | PASS | COMPLETE |
| 12 | Batch Traceability | APPROVED SUPPORTING | `StockMovement.batchNumber` | `/api/v1/inventory` | `inventory.js` | `INVENTORY_READ` | PASS | COMPLETE |
| 13 | Quarantine & Recalls | APPROVED SUPPORTING | `StockMovement.quarantined` | `/api/v1/inventory/adjustments` | `inventory.js` | `INVENTORY_WRITE` | PASS | COMPLETE |
| 14 | Asset Accounting | APPROVED SUPPORTING | `Asset.depreciationRate` | `/api/v1/assets` | `assets.js` | `ASSET_READ` | PASS | COMPLETE |
| 15 | CAPEX Tracking | APPROVED SUPPORTING | `Asset.purchaseCost` | `/api/v1/assets` | `assets.js` | `ASSET_READ` | PASS | COMPLETE |
| 16 | Insurance Claims | APPROVED SUPPORTING | `Asset.insurancePolicyNo` | `/api/v1/assets` | `assets.js` | `ASSET_READ` | PASS | COMPLETE |
| 17 | **Recruitment / ATS** | **UNAPPROVED / DEACTIVATED** | `Candidate` (Model Internal) | **None** (Route Deactivated) | **None** | `EMPLOYEE:READ` | PASS (Schema only) | **DEACTIVATED** |
| 18 | Certifications Vault | APPROVED SUPPORTING | `Employee.certifications` | `/api/v1/employees/me` | `employees.js` | `EMPLOYEE:READ_SELF` | PASS | COMPLETE |
| 19 | Goal Management | APPROVED SUPPORTING | `Employee.goals` | `/api/v1/employees/me` | `employees.js` | `EMPLOYEE:READ_SELF` | PASS | COMPLETE |
| 20 | Shift Swaps | APPROVED SUPPORTING | `AttendanceLog.shiftSwapStatus` | `/api/v1/attendance` | `attendance.js` | `ATTENDANCE_READ` | PASS | COMPLETE |
| 21 | Helpdesk Tickets | APPROVED SUPPORTING | `DepartmentOrder.ticketNotes` | `/api/v1/department-orders` | `departmentOrders.js` | `DEPT_ORDER_READ` | PASS | COMPLETE |
| 22 | Document Vault | APPROVED SUPPORTING | `Employee.documents` | `/api/v1/employees/me` | `employees.js` | `EMPLOYEE:READ_SELF` | PASS | COMPLETE |
| 23 | Attestation Management | APPROVED SUPPORTING | `ChecklistLog.attestedBy` | `/api/v1/quality` | `quality.js` | `QUALITY_READ` | PASS | COMPLETE |
| 24 | Workflow Designer | TECHNICAL CAPABILITY | `WorkflowDefinition` | `/api/v1/workflows` | `administration.js` | `ADMIN` | PASS | COMPLETE |
| 25 | Business Rules Engine | TECHNICAL CAPABILITY | `WorkflowDefinition.steps` | `/api/v1/workflows` | `administration.js` | `ADMIN` | PASS | COMPLETE |
| 26 | Custom Fields Engine | TECHNICAL CAPABILITY | `CustomFieldDefinition` | `/api/v1/custom-fields` | `administration.js` | `ADMIN` | PASS | COMPLETE |
| 27 | Calendar Engine | APPROVED SUPPORTING | `AttendanceLog.shiftDate` | `/api/v1/attendance` | `attendance.js` | `ATTENDANCE_READ` | PASS | COMPLETE |
| 28 | Approval Inbox | APPROVED SUPPORTING | `ExpenseClaim` / `StaffLoanAdvance` | `/api/v1/approvals` | `approvals.js` | `APPROVALS_READ` | PASS | COMPLETE |
| 29 | Decision Cases | APPROVED SUPPORTING | `ExpenseClaim.decidedByUserId` | `/api/v1/expenses` | `expenses.js` | `EXPENSE_DECIDE` | PASS | COMPLETE |
| 30 | CAPA Actions | APPROVED SUPPORTING | `ChecklistLog.capaAction` | `/api/v1/quality` | `quality.js` | `QUALITY_WRITE` | PASS | COMPLETE |
| 31 | Shift Checklists | APPROVED SUPPORTING | `ChecklistLog.shiftType` | `/api/v1/quality` | `quality.js` | `QUALITY_READ` | PASS | COMPLETE |
| 32 | Sustainability Tracking | APPROVED SUPPORTING | `SustainabilityLog` | `/api/v1/sustainability` | `dashboard.js` | `DASHBOARD_READ` | PASS | COMPLETE |
| 33 | Privacy Controls | APPROVED SUPPORTING | User Data Masking & Redaction | `/api/v1/users` | `administration.js` | `ADMIN` | PASS | COMPLETE |
| 34 | Lineage Tracking | TECHNICAL CAPABILITY | `StockMovement.parentBatch` | `/api/v1/inventory` | `inventory.js` | `INVENTORY_READ` | PASS | COMPLETE |
| 35 | Reconciliation Engine | APPROVED SUPPORTING | `CashRegisterSession.variance` | `/api/v1/cash-transactions` | `cash.js` | `FINANCE_READ` | PASS | COMPLETE |
| 36 | Data Quality Engine | TECHNICAL CAPABILITY | Schema Validation & Regex | All Models | All Pages | System Guards | PASS | COMPLETE |
| 37 | SLA Tracking | APPROVED SUPPORTING | `PurchaseOrder.deliveryEta` | `/api/v1/procurement` | `procurement.js` | `PROCUREMENT_READ` | PASS | COMPLETE |
| 38 | Benchmarking Analytics | APPROVED SUPPORTING | Cafe Performance KPI Comparisons | `/api/v1/reports` | `reports.js` | `REPORT_READ` | PASS | COMPLETE |
