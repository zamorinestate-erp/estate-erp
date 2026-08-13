# ZAMORIN CAFE ERP — ROUTE, NAVIGATION, AUTH & SEED GAP REGISTER

> **Status**: ALL GAPS RESOLVED & RECONCILED  
> **Release Baseline**: `v1.2.0`  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Gap Register & Resolution Summary

| Gap ID | Severity | Module | Description of Issue | Affected File(s) | Root Cause | Remediation Applied | Automated Test Verification | Status |
|---|---|---|---|---|---|---|---|---|
| **GAP-01** | **P0** | Treasury | OWNER had own-ledger Personal Ledger access in navigation and seed rules | `navigation.js`, `authorize.js`, `seedInitialData.js`, `searchController.js` | Stale historical documentation allowed OWNER personal ledger access | Removed Personal Ledger from OWNER navigation; updated `authorize.js` `PERSONAL_LEDGER` to `['MASTER']` only; removed OWNER seed rules; updated Global Search | `personalLedgerAccessApi.test.js`, `personalLedgerPermissionPolicy.test.js`, `globalSearchPersonalLedger.test.js` | **RESOLVED** |
| **GAP-02** | **P1** | Security | Unseeded route permission codes detected by automated consistency runner | `expansionModulesRoutes.js`, `seedInitialData.js` | Newly added routes referenced `QUALITY_*`, `REVENUE_SHARE_*`, `TASKS_*`, `TRASH_*`, `DASHBOARD_*` codes not present in `DEFAULT_PERMISSION_RULES` | Added missing permission rules for all four roles to `DEFAULT_PERMISSION_RULES` in `seedInitialData.js` | `routeSeedConsistency.test.js` | **RESOLVED** |
| **GAP-03** | **P1** | HRMS | Naming mismatch for employee route permission code in expansion modules | `expansionModulesRoutes.js` | `expansionModulesRoutes.js` referenced `EMPLOYEES_READ`/`EMPLOYEES_WRITE` instead of canonical `EMPLOYEE:READ`/`EMPLOYEE:WRITE` | Aligned `expansionModulesRoutes.js` to use `EMPLOYEE:READ` and `EMPLOYEE:WRITE` | `routeSeedConsistency.test.js` | **RESOLVED** |
| **GAP-04** | **P2** | Navigation | Missing navigation-to-router consistency test to prevent dead routes | `navigationRouterConsistency.test.js` | No automated CI check existed to verify navigation routes mapped to router cases | Created `navigationRouterConsistency.test.js` to automatically validate all navigation keys | `navigationRouterConsistency.test.js` | **RESOLVED** |
