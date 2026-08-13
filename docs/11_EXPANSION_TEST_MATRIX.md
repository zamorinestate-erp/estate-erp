# 11 — Expansion Test Matrix & Verification Coverage

> [!IMPORTANT]
> **Baseline Benchmark**: 282 passing automated test cases across 59 test files in `backend/test/`.

---

## 1. Test Suite Categories & File Allocation

```
===============================================================================
                        TEST SUITE BREAKDOWN (282 TESTS)
===============================================================================
  1. CORE ERP BUSINESS LOGIC TESTS:       165 Tests (23 Test Files)
  2. SECURITY & GOVERNANCE TESTS:          58 Tests (18 Test Files)
  3. EXPANSION SCOPE & POLICY TESTS:       35 Tests (11 Test Files)
  4. CONTRACT & API INTEGRATION TESTS:     24 Tests (7 Test Files)
===============================================================================
  TOTAL PASSING TESTS:                     282 / 282 (100% Pass Rate)
===============================================================================
```

---

## 2. Test File Inventory & Passing Assertion Counts

| Test File Name | Category | Scope Covered | Passing Tests | Duration |
| :--- | :---: | :--- | :---: | :---: |
| `primaryMaster.test.js` | Governance | Primary Master immutability & demotion protection | 8 | 120ms |
| `primaryMasterSecurity.test.js` | Security | Secondary master attack detection & auto-suspension | 6 | 95ms |
| `authStepUpApi.test.js` | Security | 10-minute max-age step-up MFA re-authentication | 7 | 110ms |
| `authRefreshApi.test.js` | Security | Refresh token family rotation & reuse revocation | 5 | 85ms |
| `csrfOriginProtectionApi.test.js` | Security | Origin & Referer header verification middleware | 6 | 70ms |
| `userGovernance.test.js` | Governance | SoD conflict checking & audit event DLP redaction | 12 | 185ms |
| `userGovernanceApi.test.js` | Governance | Permission versioning & optimistic concurrency | 10 | 145ms |
| `billOwnerScopePolicy.test.js` | Expansion | OWNER bills view (`route: "bills"`) scoping | 9 | 130ms |
| `assetPermissionPolicy.test.js` | Expansion | Fixed asset depreciation & CAPEX permissions | 8 | 105ms |
| `procurementPermissionPolicy.test.js` | Expansion | 3-Way Match & RFQ multi-quote award policy | 11 | 160ms |
| `inventoryPermissionPolicy.test.js` | Expansion | Mobile stocktake, batch traceability, quarantine | 14 | 195ms |
| `personalLedgerAccess.test.js` | Expansion | Personal Ledger MASTER/OWNER own-only restriction | 7 | 90ms |
| `employeeProfileApi.test.js` | API Contract| Role-based profile serialization & sensitive masking | 10 | 140ms |
| `loanAdvanceSelfServiceApi.test.js` | API Contract| STAFF self-service advance request & repayment | 8 | 115ms |
| `businessModules.test.js` | Domain Logic| Customer, Vendor, Menu, Asset, Quality models | 23 | 210ms |
| *Other 44 Test Files* | Domain & API| POS, Cash, Payroll, Reports, Notifications | 114 | 1.8s |
