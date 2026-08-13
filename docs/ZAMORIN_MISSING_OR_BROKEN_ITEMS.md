# ZAMORIN CAFE ERP — GAP REPORT & DEFECT REGISTER (SECTION 141.3)

> **Status**: ZERO P0 / ZERO P1 RELEASE-BLOCKING DEFECTS

## Defect Classification Summary

| ID | Requirement / Scope | Severity | Affected Roles | Root Cause | Status | Verification Test |
| :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **GAP-01** | Primary Master Attack | P0 | MASTER | Secondary master takeover attempt risk | FIXED | `primaryMasterSecurity.test.js` |
| **GAP-02** | Personal Ledger Exposure | P0 | OWNER / ADMIN / STAFF | Improper role scoping in authorization middleware | FIXED | `personalLedgerAccessApi.test.js` |
| **GAP-03** | Local Dev Database | P0 | ALL | Cloud MongoDB URI required local fallback | FIXED | `startDev.js` (In-Memory MongoDB) |
| **GAP-04** | Sidebar Display Sorting | P1 | ALL | Menu options were not sorted alphabetically by display label | FIXED | `navigation.js` (Commit `81515a0`) |
| **GAP-05** | API Base URL Proxy | P1 | ALL | Local static server returned 404 on `/api/v1` routes | FIXED | `apiClient.js` & `index.html` |
