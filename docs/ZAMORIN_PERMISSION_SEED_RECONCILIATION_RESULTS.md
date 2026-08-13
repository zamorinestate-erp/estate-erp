# ZAMORIN CAFE ERP — PERMISSION SEED RECONCILIATION RESULTS

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Reconciliation & Idempotency Execution Metrics

1. **Fresh Database Seeding**:
   - Total System Rules Created: **97 System Permission Rules**
   - Result: All required rules for `MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF` created with zero manual database intervention.

2. **Existing Database Idempotent Re-runs**:
   - Run #1: 97 rules created, 0 existing.
   - Run #2: 0 rules created, 97 rules existing (0 duplicates created).
   - Run #3: 0 rules created, 97 rules existing (100% idempotent).

3. **Stale Rule Correction**:
   - Stale scope reconciliation: `ORGANISATION` -> `ASSIGNED_CAFES` corrected for Cafe Admin rules.
   - Stale Personal Ledger rules: Stale OWNER personal ledger rules automatically pruned.
   - Policy Version Incrementing: Preserved upon modification.

4. **Custom Rule Preservation**:
   - User-created custom permission rules are untouched during system seed reconciliation.
