# ZAMORIN CAFE ERP
## STAGE 4 — TRANSACTIONAL INTEGRITY REPORT

### Critical Mutation Standards & Verification

1. **Financial Mutations & Ledger Integrity**:
   - **Double-Entry Balance Updates**: Personal ledger and bill settlement transactions execute with strict mathematical balancing (`Debits == Credits`). Direct client-side mutation of totals is strictly forbidden.
   - **Immutable Audit Log**: Mutations in `Finance`, `Personal Ledger`, and `Revenue Share` record before/after state snapshots via `auditService.js`. Deletions of financial history are prevented; reversal/contra entries are enforced.
   - **Idempotency & Double-Click Protection**: Transaction submission buttons employ automatic pending disablement and client request debounce tokens to prevent duplicate payment / settlement ledger creation.

2. **Loyalty Ledger & Point Adjustments**:
   - **Atomic Increment / Decrement**: Points adjustments record an authoritative ledger entry in `LoyaltyLedger` before updating the cached `Customer.pointsBalance`.
   - **Reason Code Enforcement**: Every points modification requires a mandatory audit reason code and operator ID.

3. **Supplier & Three-Way Matching Governance**:
   - **3-Way Match Invariants**: Purchase Orders, Goods Received Notes (GRN), and Invoices must match within tolerance thresholds before posting to Accounts Payable.
   - **Maker-Checker for Sensitive Data**: High-risk changes to supplier bank accounts create pending verification records in `RolePermission` / Maker-Checker queues rather than executing instant unverified updates.

4. **Inventory Movements & Stock Atomicity**:
   - **Stock Movements**: Inventory receipts, adjustments, transfers, and wastage write immutable records to `StockMovement` and atomically update `CafeInventoryConfig.currentStock`.
   - **Duplicate SKU Prevention**: New inventory items enforce global uniqueness on `itemCode` / `sku` across the organisation.

5. **Device Revocation & Session Invalidation (DEF-STG3-003)**:
   - **Strict Version Bumping**: Session revocation instantly increments `User.sessionVersion` or marks the specific `Session` record `REVOKED`.
   - **Middleware Rejection**: Subsequent requests from revoked access tokens fail immediately in `authenticate.js` with `401 AUTHENTICATION_REQUIRED` / `SECURITY_VERSION_CHANGED`.

---
**Integrity Certified:** All critical workflows adhere to transactional integrity, idempotency, and audit standards.
