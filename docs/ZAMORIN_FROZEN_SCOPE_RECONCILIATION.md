# ZAMORIN CAFE ERP — FROZEN SCOPE RECONCILIATION

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0` (Commit `4765c2c`)  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Frozen Product Scope Reconciliation Table

| Feature / Module | Product Owner Approval | Implemented Status | Active API / Route | Keep / Remove | Evidence |
|---|---|---|---|---|---|
| Core ERP Foundation (Auth, Cafes, Roles) | APPROVED | COMPLETE | Active (`/api/v1/auth`, `/api/v1/cafes`, `/api/v1/users`) | KEEP | `authRoutes.js`, `cafeRoutes.js`, `userRoutes.js` |
| HRMS & Employee Registry | APPROVED | COMPLETE | Active (`/api/v1/employees`) | KEEP | `employeeRoutes.js`, `employeeController.js` |
| Shift Scheduling & Attendance | APPROVED | COMPLETE | Active (`/api/v1/attendance`) | KEEP | `attendanceRoutes.js` |
| Leave Management & Loans/Advances | APPROVED | COMPLETE | Active (`/api/v1/loan-advances`) | KEEP | `loanAdvanceRoutes.js` |
| POS & Billing Engine | APPROVED | COMPLETE | Active (`/api/v1/bills`) | KEEP | `billRoutes.js`, `pos.js` |
| Menu Management & Pricing Rules | APPROVED | COMPLETE | Active (`/api/v1/menu`) | KEEP | `menuRoutes.js` |
| Cash Drawer Registers & Sales Ledger | APPROVED | COMPLETE | Active (`/api/v1/cash-transactions`) | KEEP | `cashRoutes.js` |
| Expense Management (Master Decision) | APPROVED | COMPLETE | Active (`/api/v1/expenses`) | KEEP | `expenseRoutes.js` (Master-only decisions) |
| General Ledger & Finance | APPROVED | COMPLETE | Active (`/api/v1/cash-transactions`) | KEEP | `cashRoutes.js` |
| Personal Ledger (Master-Only) | APPROVED (MASTER ONLY) | COMPLETE | Active (`/api/v1/personal-ledger`) | KEEP (MASTER Only) | `personalLedgerRoutes.js` (`authorize.js`) |
| Inventory & Stock Levels | APPROVED | COMPLETE | Active (`/api/v1/inventory`) | KEEP | `inventoryRoutes.js` |
| Batch Traceability & Expiry | APPROVED | COMPLETE | Active (`/api/v1/inventory`) | KEEP | `inventoryController.js` |
| Quarantine & Recalls | APPROVED | COMPLETE | Active (`/api/v1/inventory/adjustments`) | KEEP | `inventoryController.js` |
| Reorder Engine & Stocktake | APPROVED | COMPLETE | Active (`/api/v1/inventory`) | KEEP | `inventoryController.js` |
| Vendor Registry & Procurement (POs) | APPROVED | COMPLETE | Active (`/api/v1/vendors`, `/api/v1/procurement`) | KEEP | `vendorRoutes.js`, `procurementRoutes.js` |
| 3-Way Match & Invoice Processing | APPROVED | COMPLETE | Active (`/api/v1/procurement`) | KEEP | `procurementController.js` |
| External Supplier Portal | APPROVED | COMPLETE | Active (`/api/v1/supplier-portal/orders`) | KEEP | `expansionModulesRoutes.js` |
| Customers & Loyalty Registry | APPROVED | COMPLETE | Active (`/api/v1/customers`) | KEEP | `customerRoutes.js` |
| Asset Management & CAPEX | APPROVED | COMPLETE | Active (`/api/v1/assets`) | KEEP | `assetRoutes.js` |
| Department Orders | APPROVED | COMPLETE | Active (`/api/v1/department-orders`) | KEEP | `departmentOrderRoutes.js` |
| Revenue Share Agreements | APPROVED | COMPLETE | Active (`/api/v1/revenue-share`) | KEEP | `revenueShareRoutes.js` |
| Quality & Compliance (HACCP) | APPROVED | COMPLETE | Active (`/api/v1/quality`) | KEEP | `qualityRoutes.js` |
| Governance Trash Bin | APPROVED | COMPLETE | Active (`/api/v1/trash`) | KEEP | `trashRoutes.js` (Master-only) |
| Global Search Engine | APPROVED | COMPLETE | Active (`/api/v1/search`) | KEEP | `searchController.js` |
| PWA Service Worker & Offline Cache | APPROVED | COMPLETE | Active (`/sw.js`) | KEEP | `sw.js`, `pwa.js` |
| **Recruitment / ATS** | **REJECTED (FROZEN SCOPE)** | **DEACTIVATED** | **Inactive** (API routes removed) | **REMOVE / DORMANT** | `expansionModulesRoutes.js` (Routes deactivated) |
| **Kitchen Operations & KDS** | **REJECTED (EXCLUDED)** | **NONE** | **None** | **EXCLUDED** | No code exists |
| **Compare Locations Module** | **REJECTED (EXCLUDED)** | **NONE** | **None** | **EXCLUDED** | No code exists |
