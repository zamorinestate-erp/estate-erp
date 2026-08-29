# ZAMORIN CAFÉ ERP — SUPPORTING FILES MAIN MERGE BASELINE

**Document Identifier**: `BASE-MERGE-SUPP-001`  
**Date**: `August 2026`  
**Base Main Head**: `62a66127faff34b0bbb30be02c6e6b1cf3e37937`  
**Feature Branch Head**: `9c85569e1cc800eee6393fd604a1dbebe517d7e1`  
**Merge Base**: `62a66127faff34b0bbb30be02c6e6b1cf3e37937`  
**Ancestry Result**: `ANCESTOR_EXIT = 0` (True Fast-Forward Merge Eligible)

---

## 1. Commit Lineage & History Graph

```
* 9c85569 (feature/supporting-files-integration) test(app): close exact-head supporting file regression gate
* fdf649c test(app): finalize route export and template reconciliation
* f34568a chore(audit): add source-derived route arithmetic and governance assertions
* 1aad3c0 test(app): reconcile final supporting-file coverage
* 7c3ac5a test(app): close supporting-file exact coverage gate
* 5f66af8 feat(app): complete application-wide supporting file integration
* 62a6612 (main) test(login): increase cold-start navigation delay for CDP stage 5 browser audit
* 0966c6f docs(login): record main merge history reconciliation and browser security test ownership matrix
* b6ccbfe docs(login): add main merge delta, merge report, and integration freeze gate
* dede55c (feature/login-integration) fix(auth): align scrypt cost with password security baseline
```

---

## 2. Certified Feature Scope Summary

1. **Route Destination Set**: 149 Canonical (145 General + 4 Terminal), 154 Browser-Routable, 0 Mismatches.
2. **Export Engine**: Pure Binary Standard PDF 1.4 (`%PDF-1.4 ... %%EOF`), Pure Binary OpenXML Excel (`.xlsx` / `PK\x03\x04`), and Sanitized RFC 4180 CSV with formula injection defense.
3. **MailOps Posture**: 0 static runtime imports, 0 dynamic runtime imports, safe `#mailops` redirect, active background outbox.
4. **Template Coverage**: 3 template engines, 9 document template families, 6 automated dependency assertions.
5. **Governance Invariants**: ACT-017 and ACT-018 blocked, Settings user review pending, Cloud Storage & DR production validation pending.
6. **Master Backend Regression**: 901 / 901 tests passing (`pass 901, fail 0, skipped 0, todo 0`).
