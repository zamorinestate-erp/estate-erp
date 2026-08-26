# PASSBOOK & MULTI-CAFÉ TREASURY CONTROL — INTEGRATION DISCOVERY AUDIT
**Document ID**: `DOC-PBK-AUDIT-001`  
**Date**: `2026-08-24T22:45:00+05:30`  
**Author**: Antigravity Principal Architecture Engine  
**Programme**: Zamorin Café ERP — Passbook & Multi-Café Treasury Control  
**Audited Directory**: `D:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE`  

---

## 1. Executive Summary & Architectural Invariant

Per Section 0–335 and Addendum 336–468 of the Passbook Programme specification:
1. The **Passbook** is an internal ERP cash/bank/settlement movement & treasury control system, available **ONLY to Primary Master and Owner**.
2. **Strict Security Barrier**: Absolutely **NO bank APIs**, open banking, screen scraping, or stored credentials (PINs, passwords, OTPs).
3. **No Duplicate Accounting Universe**: Passbook is distinct from the General Ledger (double-entry GL) and Personal Ledger (owner drawings/advances), but links authoritatively to them where cash moves.
4. **Integration Rule**: Every discovered component in the Zamorin codebase is categorized as `REUSE`, `EXTEND`, `LINK`, `DO NOT DUPLICATE`, or `NEW COMPONENT REQUIRED`.

---

## 2. Comprehensive Component Discovery & Classification Matrix

| Component Area | Existing Workspace File(s) / Model(s) | Current Functionality | Passbook Architectural Action | Integration & Design Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Bank Account Master** | `backend/src/models/BankAccount.js` | Basic bank account model (`accountAlias`, `maskedAccountNumber`, `bookBalancePaisa`, `ifscCode`, `accountType`). | **EXTEND & LINK** | Extend to support `scopeType` (`CAFE_SPECIFIC`, `ORGANISATION_GLOBAL`, `SHARED_MULTI_CAFE`), `assignedCafeIds`, `primaryCafeId`, bank subtypes (`CURRENT`, `SAVINGS`, `CASH_CREDIT`, `PETTY_CASH`, `RESERVE`, `SETTLEMENT_CLEARING`), opening balance traceability, and reconciliation cadence. |
| **Cash Account / Operations** | `backend/src/models/CashTransaction.js`, `backend/src/controllers/cashController.js` | Cafe operational physical cash movements, cash in/out, opening balance, banking deposits. | **LINK & REUSE** | Operational cash transactions remain in cash book; Passbook links to cash drawer EOD deposits and float funding via `sourceType: 'CASH_BOOK'` without creating duplicate operational records. |
| **General Ledger & Journals** | `backend/src/models/Journal.js`, `backend/src/models/ChartOfAccount.js` | Double-entry journal lines (`debitPaisa`, `creditPaisa`, `accountCode`, `dimensionCafeId`). | **LINK (DO NOT DUPLICATE)** | Passbook transactions that arise from authoritative financial events store `journalId` and `journalLineId`. No second accounting universe is created. |
| **Financial Periods & Fiscal Years** | `backend/src/models/FinancialPeriod.js`, `backend/src/controllers/financeController.js` | Fiscal years (`FY 2026-27`), period numbers, `OPEN`/`CLOSED`/`REOPENED` states, and close snapshots. | **REUSE & LINK** | Passbook utilizes the canonical `FinancialPeriod` model for period continuity, month-end snapshots, and carry-forward balances. |
| **Personal Ledger & Owner Accounts** | `backend/src/models/PersonalLedger.js`, `backend/src/routes/personalLedgerRoutes.js` | Director loans, advances, drawings, reimbursements, capital contributions. | **LINK (DO NOT DUPLICATE)** | Passbook remains cash/bank movement view. When Owner reimbursement or capital contribution moves through an account, Passbook creates a cash leg linking `sourceType: 'PERSONAL_LEDGER'` with `sourceId: plEntryId`. |
| **Expenses & Vouchers** | `backend/src/models/Expense.js`, `backend/src/routes/expenseRoutes.js` | Business expense vouchers, payment modes, receipt attachments, approval states. | **LINK** | When expense status transitions to `PAID`, Passbook records a debit linked to `sourceId: expenseId` (`EV-...`). Accruals remain unposted until disbursement. |
| **Bills & AP Invoices** | `backend/src/models/Bill.js`, `backend/src/models/APInvoice.js` | Vendor bills, payment terms, TDS deductions, line items. | **LINK** | Bill creation is an AP accrual (no Passbook movement). When a bill or payment batch is paid, Passbook records an outflow linked to `billId` / `paymentBatchId`. |
| **Supplier / Vendor Registry** | `backend/src/models/Vendor.js`, `backend/src/routes/vendorRoutes.js` | Vendor profiles, bank details (masked), GSTIN, payment terms. | **REUSE & LINK** | Passbook transaction counterparties link directly to `vendorId` entities rather than using unverified free-text strings. |
| **POS Sales & Settlement** | `backend/src/models/Bill.js`, `backend/src/models/MarketplaceSettlement.js`, `backend/src/models/RegisterSession.js` | Orders, tenders (Cash, UPI, Card), batch closures, marketplace commission deductions. | **LINK & REUSE** | Settlement & Clearing workspace tracks gross sales vs net bank receipts (MDR fees, GST on fees, marketplace deductions). |
| **Payroll Disbursements** | `backend/src/models/PayrollRun.js`, `backend/src/models/Payslip.js`, `backend/src/models/PaymentRun.js` | Monthly payroll runs, statutory deductions, net payable batches. | **LINK** | When payroll is disbursed, Passbook records a batch payment debit linked to `payrollRunId` rather than flooding the bank ledger with individual line items. |
| **Revenue Share Payments** | `backend/src/models/RevenueSharePayment.js`, `backend/src/models/RevenueShareSettlement.js` | Lease agreements, recorded outlet payouts. | **LINK** | Passbook records actual payment movements linked to `revenueSharePaymentId`. Preserves `ACT-017` & `ACT-018` governance blocks. |
| **Document Vault & Attachments** | `backend/src/models/AttachmentRegistry.js`, `backend/src/models/PrivateFile.js`, `backend/src/controllers/fileController.js` | Secure file registry, mime validation, SHA-256 checksums, size limits. | **REUSE** | Statement PDFs, deposit slips, payment receipts, and balance confirmation evidence reuse the central private file vault. No isolated upload system. |
| **Audit Service & Trail** | `backend/src/models/AuditEvent.js`, `backend/src/utils/auditLogger.js` | Immutable audit events (`AE-YYYYMMDD-XXXX`), actor IDs, roles, diffs (`before`/`after`), IP/device context. | **REUSE & EXTEND** | All Passbook mutations (balance adjustments, transfers, reversals, reconciliations, closures) write non-disableable audit events to `AuditEvent`. |
| **Monotonic ID Generator** | `backend/src/models/SequenceCounter.js` | Atomic sequential counters (`getNextNumber`) with prefix & zero-padding. | **REUSE** | Standardized IDs: `PBK-YYYYMM-XXXX` (Transactions), `TRF-YYYYMM-XXXX` (Transfers), `REC-YYYYMM-XXXX` (Reconciliations), `STM-YYYYMM-XXXX` (Statements), `RES-YYYYMM-XXXX` (Reservations). |
| **Monetary Precision & Safe Math** | `backend/src/models/Journal.js`, `backend/src/models/PersonalLedger.js` | Integer paisa (`1 INR = 100 paise`) representation to eliminate floating point rounding errors. | **REUSE & ENFORCE** | All Passbook account balances, transaction amounts, allocations, and tolerances are stored and calculated strictly in integer paise. |
| **Database Transactions (MongoDB)** | `mongoose.startSession()`, `session.withTransaction()` | Multi-document ACID transactional integrity. | **REUSE & ENFORCE** | Internal transfers (origin debit + destination credit), multi-cafe allocations, and balance adjustments execute inside atomic MongoDB sessions. |
| **Cafe Multi-Tenancy & Scoping** | `backend/src/utils/cafeScope.js`, `backend/src/models/Cafe.js` | Cafe scoping, ownership assertion, global portfolio aggregation. | **REUSE & EXTEND** | Enforces economic cafe attribution rules: transactions on shared accounts must have explicit cafe allocations or remain marked `UNALLOCATED`. |
| **Role Authorization & RBAC** | `backend/src/middleware/authorize.js`, `backend/src/models/RolePermission.js` | Strict role verification, `isPrimaryMaster` assertions, 403 error codes. | **REUSE & EXTEND** | Enforce `requirePrimaryMasterOrOwner` across all Passbook endpoints. Normal Master, Cafe Admin, and Staff are strictly DENIED with `403 PASSBOOK_ACCESS_RESTRICTED`. |
| **Notifications Engine** | `backend/src/models/Notification.js`, `backend/src/services/NotificationService.js` | In-app notification dispatch with priority and category filters. | **REUSE** | Passbook events (large adjustments, low free balance, old unreconciled differences, integrity failures) dispatch in-app notifications without approval bottlenecks. |
| **Universal Corporate Export (ZURF v1)** | `backend/src/services/zurfService.js` | ZURF v1 PDF/HTML/CSV/JSON export engine with corporate headers, GSTIN, watermark, and Run IDs. | **REUSE** | All Passbook report exports (Account Statements, Day Book, Cash Flow, Reconciliation Reports) hook into `ZurfService`. No ad-hoc PDF engines. |
| **Frontend Shell & SPA Router** | `frontend/src/js/router.js`, `frontend/src/js/navigation.js`, `frontend/src/js/moduleHubShared.js` | Persistent shell, Google Fonts, 4 themes, universal large workspace buttons. | **REUSE & EXTEND** | Register `#passbook` control centre and dedicated subroutes (`#passbook/accounts`, `#passbook/transactions`, `#passbook/reconciliation`, etc.) with breadcrumbs and full URL state restoration. |
| **Passbook Core Domain Models** | *None currently existing* | New dedicated Passbook models required for accounts, transactions, transfers, reconciliations, statements, reservations, and mappings. | **NEW COMPONENT REQUIRED** | Create dedicated Mongoose models: `PassbookAccount.js`, `PassbookTransaction.js`, `PassbookTransfer.js`, `PassbookReconciliation.js`, `PassbookStatementImport.js`, `PassbookReservation.js`, `PassbookMapping.js`. |
| **Passbook Domain Services** | *None currently existing* | Isolated business logic services for ledger calculations, reconciliation matching, balance adjustment, and integrity checks. | **NEW COMPONENT REQUIRED** | Create `passbookAccountService.js`, `passbookTransactionService.js`, `passbookReconciliationService.js`, `passbookIntegrityService.js`, `passbookAnalyticsService.js`. |

---

## 3. Clear Boundaries: Passbook vs. General Ledger vs. Personal Ledger

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               ZAMORIN FINANCIAL UNIVERSE                               │
├─────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│    GENERAL LEDGER (GL)  │    PERSONAL LEDGER (PL)      │    PASSBOOK & TREASURY        │
├─────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ • Double-entry journal  │ • Owner / Director equity    │ • Multi-café cash & bank      │
│ • Chart of accounts     │ • Director loans & advances  │ • Physical cash & till floats │
│ • P&L and Balance Sheet │ • Expense reimbursements     │ • Settlement & clearing       │
│ • Depreciation & Taxes  │ • Capital infusions          │ • Statement reconciliation    │
│ • Accruals & Deferrals  │ • Declared dividends         │ • Reserved funds & Runway     │
│                         │                              │ • Running balances & Evidence │
└────────────┬────────────┴──────────────┬───────────────┴───────────────┬───────────────┘
             │                           │                               │
             └───────────────────────────┴───────────────────────────────┘
                     Authoritative Cross-Module Links & Integrity
                     (sourceType, sourceId, journalId, correlationId)
```

---

## 4. Discovery Conclusion & Next Action

All existing core utilities (ID generator, audit logger, file vault, ZURF export engine, money precision, MongoDB session handling, RBAC) are **100% reusable**.  
The new Passbook module will cleanly plug into these foundation services and provide an enterprise-grade treasury control system without duplicate accounting engines or unauthorized bank API integrations.
