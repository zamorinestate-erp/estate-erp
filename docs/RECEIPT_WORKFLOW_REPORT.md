# Receipt Workflow & Evidence Governance Report

**Date:** 2026-08-24  
**System:** Zamorin Café ERP v2.2.2  
**Standard:** Double-Entry Supporting Evidence & Statutory Document Compliance  

---

## 1. Principles of Receipt & Payment Evidence Handling

1. **Supporting Evidence, Not Duplicate Accounting Truth**:
   - A receipt attachment does NOT generate a new financial journal entry independently.
   - It attaches cryptographically as supporting digital proof to an authoritative transaction (`VOUCHER`, `BILL`, `PO`, or `EXPENSE`).

2. **Dedicated Receipt Workspace**:
   - Accessed via `#bills/receipts` and `#expenses/evidence`.
   - Offers searchable registers displaying Receipt Number, Vendor/Payee, Linked Transaction, Tender Method, Amount (₹), SHA-256 Hash, and Statutory Status.

3. **Receipt Lifecycle Workflow States**:
   - `UPLOADED`: Stored in staging repository with metadata.
   - `UNLINKED`: Awaiting association with an authoritative bill/voucher.
   - `LINKED`: Associated with a specific expense voucher or sales transaction.
   - `MATCHED`: Verified against bank/drawer settlement records.
   - `RECONCILED`: Signed off during EOD or Period Close.
   - `VOIDED`: Marked void with immutable audit trail.

4. **Interactive Capture & Safe Preview**:
   - Drag & Drop zone with camera/file input fallback.
   - Zero execution of active scripts; inline sandboxed preview for PDF and Images.
