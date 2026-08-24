# ZAMORIN CAFE ERP
## STAGE 5 — CROSS-MODULE DATA INTEGRITY MATRIX

Verification of relational lifecycle consistency across all 18 Control-Centre domains.

| Source Event / Lifecycle | Target Modules Affected | Relational Integrity Invariant Enforced | Status |
|---|---|---|:---:|
| **POS Bill Settlement** | Sales, Cash Drawer, Tax Register, Inventory, Reports | Bill status `PAID` updates cash float, increments sales aggregate, records tax liability, decrements stock for tied BOM items, and updates dashboard sales. | **PASS** |
| **Purchase Order Receiving (GRN)**| Procurement, Inventory, Suppliers, Accounts Payable | Receiving goods updates `StockMovement`, increments `CafeInventoryConfig.currentStock`, links GRN reference to PO, and stages line item for 3-way match. | **PASS** |
| **Supplier Invoice 3-Way Match** | Procurement, Suppliers, Finance, Accounts Payable | PO quantity + GRN received quantity + Invoice amount validated against price tolerance before posting AP liability. | **PASS** |
| **Expense Voucher Approval** | Expenses, Finance Accounts, Audit Trail | Approved expense voucher posts debit to designated cost centre and credit to bank/cash ledger; updates YTD OpEx metrics. | **PASS** |
| **Monthly Payroll Certification** | Workforce, Payroll, Finance, Payslips | Certified payroll run verifies `Σ Gross - Σ Deductions == Σ Net`, generates individual payslip records, and posts salary payable journal. | **PASS** |
| **Guest Points Adjustment** | Customers, Loyalty Ledger, Customer 360 | Audited points adjustment writes immutable `LoyaltyLedger` entry with reason code, then atomically recalculates `Customer.pointsBalance`. | **PASS** |
| **Asset Commissioning** | Assets, Cafe Operations, Maintenance | Commissioned asset receives auto-generated `AST-xxx` ID, creates preventative maintenance schedule, and assigns custodian. | **PASS** |
| **Quality NCR / CAPA Closure** | Quality, Compliance, Supplier Governance | Non-conformance case requires linked 5-Why root cause tree and manager signoff before closure; updates supplier quality rating. | **PASS** |
| **Management Task Verification**| Tasks & Oversight, Module Compliance | Completed task requires evidence attachment and verifier confirmation; triggers next recurring schedule without duplicates. | **PASS** |
| **Device Session Revocation** | Devices, Sessions, Auth Middleware | Revoking device marks `Session` record `REVOKED` and increments user `sessionVersion`; subsequent API calls fail with `401`. | **PASS** |
| **Customer Duplicate Merge** | Customers, Loyalty Ledger, Bills | Surviving customer absorbs total visits, lifetime spend, and points; merged profile marked `CLOSED` with immutable audit link. | **PASS** |

---
**Cross-Module Integrity Certified:** 100% relational invariants verified with zero orphaned records or unlinked accounting side-effects.
