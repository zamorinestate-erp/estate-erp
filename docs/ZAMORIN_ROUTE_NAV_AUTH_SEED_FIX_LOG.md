# ZAMORIN CAFE ERP — ROUTE, NAV, AUTH & SEED FIX LOG

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Fix Log of All Source Code Modifications

1. **`frontend/src/js/navigation.js`**:
   - Removed `{ id: "ledger", label: "Personal Ledger", icon: "ledger", route: "ledger" }` from `[ROLES.OWNER].items`.
   - Updated footnote to clarify Personal Ledger is MASTER-only.

2. **`backend/src/middleware/authorize.js`**:
   - Updated `ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER` from `['MASTER', 'OWNER']` to `['MASTER']` only.

3. **`backend/src/scripts/seedInitialData.js`**:
   - Removed `OWNER` `PERSONAL_LEDGER_READ` and `PERSONAL_LEDGER_WRITE` rules from `DEFAULT_PERMISSION_RULES`.
   - Appended missing system permission rules for `QUALITY_READ`, `QUALITY_WRITE`, `REVENUE_SHARE_READ`, `REVENUE_SHARE_WRITE`, `TASKS_READ`, `TASKS_WRITE`, `TRASH_READ`, `TRASH_RESTORE`, `DASHBOARD_READ`, and `EMPLOYEE:WRITE`.

4. **`backend/src/controllers/searchController.js`**:
   - Updated Personal Ledger search guard from `['MASTER', 'OWNER'].includes(role)` to `role === 'MASTER'` only.

5. **`backend/src/routes/expansionModulesRoutes.js`**:
   - Aligned recruitment route authorization from `EMPLOYEES_READ`/`EMPLOYEES_WRITE` to canonical `EMPLOYEE:READ` and `EMPLOYEE:WRITE`.

6. **`backend/test/personalLedgerAccessApi.test.js`**:
   - Updated balance API test to assert that `MASTER` is allowed, while `OWNER`, `CAFE_ADMIN`, and `STAFF` are blocked with status `403` and error code `ABSOLUTE_ROLE_RESTRICTION`.

7. **`backend/test/personalLedgerPermissionPolicy.test.js`**:
   - Updated test to assert 2 Personal Ledger seed rules (MASTER-only) instead of 4.

8. **`backend/test/globalSearchPersonalLedger.test.js`**:
   - Updated test to assert that `MASTER` searches own Personal Ledger while `OWNER`, `CAFE_ADMIN`, and `STAFF` are denied.

9. **`backend/test/routeSeedConsistency.test.js`**:
   - Created automated consistency test to verify every `authorize(permissionCode)` call in backend routes has a corresponding seed rule in `seedInitialData.js`.

10. **`backend/test/navigationRouterConsistency.test.js`**:
   - Created automated consistency test to verify every navigation route in `navigation.js` maps to a valid case in `router.js`.
