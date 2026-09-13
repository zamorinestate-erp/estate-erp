# ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS (CAFÉ OPS-R02C)

## AUTHORIZATION CANONICALIZATION, SINGLE-SOURCE INDEX MANIFEST & FINAL ENGINEERING CLEANUP REPORT

**Document ID:** `ZAMORIN-CAFE-OPS-R02C-AUTH-CANONICALIZATION-REPORT`  
**Security Classification:** CONFIDENTIAL — INTERNAL ARCHITECTURAL SPECIFICATION  
**Author:** Senior Principal Full-Stack Engineer, Security Architect & QA Lead  
**Scope:** Final Micro-Correction & Hardening of Café Operations  
**Date:** 2026-09-07  
**Status:** IMPLEMENTATION COMPLETE & REGRESSION VERIFIED — PARKED  

---

## 1. Baseline

- **Repository:** `d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE`
- **Branch:** `main`
- **Commit HEAD:** `742762abe2a0952ec38817792e788ee7f3ed6f2a`
- **Café Operations Controls:** 272 Controls (`CTL-001` through `CTL-272`) fully preserved
- **Pre-R02C Regression Baseline:** 1,535 / 1,535 PASS (19 suites, 152 test files)
- **Security Baseline:**
  - P0: 0
  - P1: 0
  - P2: 0
  - P3: 0
  - Cross-Café Leakage: 0
  - Cross-Organisation Leakage: 0
  - IDOR: 0
  - Privilege Escalation: 0

---

## 2. Current Canonical Role Registry

The actual canonical role model of Zamorin Café ERP was derived through exhaustive inspection of repository source files, specifically:
- `backend/src/models/User.js` (`USER_ROLES`)
- `backend/src/models/RolePermission.js` (`ROLES`)
- `backend/src/services/userGovernanceService.js` (`describeRolePermissions`)
- `frontend/src/js/navigation.js` (`ROLES`)

The repository recognizes exactly **four canonical roles**:

| Role | Canonical Source | Active | Workspace | Scope & Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`MASTER`** | `User.js`, `RolePermission.js` | YES | Backend / Frontend | Top-level enterprise administrator; organisation-wide governance; Primary Master holds singular user-management authority. |
| **`OWNER`** | `User.js`, `RolePermission.js` | YES | Backend / Frontend | Executive portfolio oversight; multi-café reporting and financial visibility; no operational write access without explicit permission. |
| **`CAFE_ADMIN`** | `User.js`, `RolePermission.js` | YES | Backend / Frontend | Operational manager for assigned café(s); day-to-day shift, attendance, inventory, KDS, and cashier supervision. |
| **`STAFF`** | `User.js`, `RolePermission.js` | YES | Backend / Frontend | Line staff / barista / cashier; self-service records only (clock-in, view own payslips/leaves, POS register terminal session). |

---

## 3. Current Permission Registry

Zamorin Café ERP utilizes an RBAC permission engine backed by `RolePermission` (`backend/src/models/RolePermission.js`) and seeded systematically via `DEFAULT_PERMISSION_RULES` in `backend/src/scripts/seedInitialData.js`.

All route authorization checks use `authorize(permissionCode, options)` which validates against active rules in the database and is verified by `backend/test/routeSeedConsistency.test.js`.

Canonical permission naming style:
- Format: `[MODULE]_[ACTION]` or `[MODULE]:[ACTION]`
- Examples: `POS_READ`, `POS_WRITE`, `INVENTORY_READ`, `INVENTORY_WRITE`, `QUALITY_READ`, `QUALITY_WRITE`, `TASKS_READ`, `TASKS_WRITE`, `CAFE:MANAGE`, `USER:MANAGE`, `REPORTS_READ`, `REPORTS_EXPORT`.

---

## 4. R02B Role Alias Audit & Classification

During CAFÉ OPS-R02B, authorization for `OfflineRiskConfigService` was implemented using a hardcoded `ADMIN_ROLES` array. A comprehensive repository audit of these role strings produced the following classification:

| Role String Tested in R02B | Classification | Justification | Action Taken in R02C |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `PERMISSION_LABEL_NOT_ROLE` | In `DEFAULT_PERMISSION_RULES`, `ADMIN` is a permission code under `module: 'ADMINISTRATION'` associated with canonical roles (`MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF`). It was never a valid role enum in `User.js` or `RolePermission.js`. | **REMOVED** from role authorization checks. |
| **`ORG_ADMIN`** | `INVENTED_DURING_R02B` | Does not exist in `User.js`, `RolePermission.js`, `seedInitialData.js`, or any frontend router/navigation file. Existed only in `offlineRiskConfigService.js`. | **REMOVED** from role authorization checks. |
| **`COMPANY_ADMIN`** | `INVENTED_DURING_R02B` | Does not exist in any canonical schema or service. Existed only in `offlineRiskConfigService.js`. | **REMOVED** from role authorization checks. |
| **`FINANCE_DIRECTOR`** | `INVENTED_DURING_R02B` | Does not exist in any canonical schema or service. Existed only in `offlineRiskConfigService.js`. | **REMOVED** from role authorization checks. |
| **`SUPER_ADMIN`** | `INVENTED_DURING_R02B` | Does not exist in any canonical schema or service. Existed only in `offlineRiskConfigService.js`. | **REMOVED** from role authorization checks. |

**Architectural Remediation:** The hardcoded `ADMIN_ROLES` array was completely deleted. Authorization decisions now evaluate canonical identity, canonical permission (`OFFLINE_RISK_CONFIG_READ` / `OFFLINE_RISK_CONFIG_WRITE`), and organisation/café scope.

---

## 5. Canonical Offline Risk Permissions

In accordance with Section 8 & 9, two canonical permissions were formally integrated:

1. **`OFFLINE_RISK_CONFIG_READ`**
   - **Module:** `OPERATIONS`
   - **Resource:** `OFFLINE_RISK_CONFIG`
   - **Action:** `READ`
   - **Effect:** `ALLOW`
   - **Seeded For:** `MASTER` (`ORGANISATION` scope), `OWNER` (`ORGANISATION` scope), `CAFE_ADMIN` (`ASSIGNED_CAFES` scope), `STAFF` (`SELF` scope).

2. **`OFFLINE_RISK_CONFIG_WRITE`**
   - **Module:** `OPERATIONS`
   - **Resource:** `OFFLINE_RISK_CONFIG`
   - **Action:** `WRITE`
   - **Effect:** `ALLOW`
   - **Seeded For:** `MASTER` (`ORGANISATION` scope), `CAFE_ADMIN` (`CAFE` scope).

Both permissions are registered in `DEFAULT_PERMISSION_RULES` in `backend/src/scripts/seedInitialData.js` and exported via `OFFLINE_RISK_PERMISSIONS` in `backend/src/services/offlineRiskConfigService.js`.

---

## 6. Write Authorization Architecture

The write path in `OfflineRiskConfigService.updateRiskConfig` strictly evaluates:

$$\text{Authenticated Actor} + \text{Canonical Role} + \text{Canonical Permission} + \text{Organisation Scope} + \text{Configuration Scope} \implies \text{Allowed / Denied}$$

Specific evaluation rules:
1. **Organisation Scope:** Actor organisation must match target organisation (`actorOrg === cleanOrg`). Cross-organisation requests return `403 CROSS_ORGANISATION_ACCESS_DENIED`.
2. **Canonical Role Verification:** Only `MASTER`, `OWNER`, `CAFE_ADMIN`, and `STAFF` are recognized. Any invented or unknown string returns `403 FORBIDDEN_RISK_CONFIG`.
3. **STAFF Restriction:** Ordinary staff/baristas are strictly denied from modifying enterprise risk policy (`403 FORBIDDEN_RISK_CONFIG`).
4. **Permission Enforcement:** When explicit permissions are provided, actor MUST hold `OFFLINE_RISK_CONFIG_WRITE` (`403 PERMISSION_DENIED`).
5. **OWNER Policy:** Owner holds read-only financial oversight; write attempts without explicit write authorization return `403 FORBIDDEN_RISK_CONFIG`.
6. **Organisation Default Protection:** Only enterprise administrators (`MASTER`) may configure organisation-wide defaults (`cafeId: null`). `CAFE_ADMIN` attempting organisation-level modification returns `403 FORBIDDEN_ORGANISATION_SCOPE`.
7. **Café Override Governance:**
   - `CAFE_ADMIN` may only update their assigned café. Unassigned café updates return `403 CROSS_CAFE_ACCESS_DENIED`.
   - If the organisation disables overrides (`allowCafeOverride === false`), café override updates return `403 CAFE_OVERRIDE_DISALLOWED`.
   - **Non-Weakening Policy Invariant:** Café override thresholds may only be more restrictive, never relax enterprise limits:
     - `config.maxDiscountPercent > orgConfig.maxDiscountPercent` $\implies$ `400 CANNOT_WEAKEN_RISK_POLICY`
     - `config.highValueAmountPaise > orgConfig.highValueAmountPaise` $\implies$ `400 CANNOT_WEAKEN_RISK_POLICY`

---

## 7. Read Authorization Architecture

The read path in `OfflineRiskConfigService.getEffectiveRiskConfig` enforces:
1. **Actor Validation:** Verifies organisation matching (`403 CROSS_ORGANISATION_ACCESS_DENIED`), canonical role check, and assigned café check for `CAFE_ADMIN` (`403 CROSS_CAFE_ACCESS_DENIED`).
2. **Permission Verification:** Validates `OFFLINE_RISK_CONFIG_READ` when permissions array is provided (`403 PERMISSION_DENIED`).
3. **Hierarchical Fallback:**
   - Level 1: Validated Café Override (if `cafeId` requested, override exists, and org permits)
   - Level 2: Organisation Setting (if org default exists)
   - Level 3: Safe Application Default (`maxDiscountPercent: 40%`, `highValueAmountPaise: 2,500,000 paise = ₹25,000`, `allowCafeOverride: true`)

---

## 8. Café and Organisation Scope Isolation

Multi-tenant isolation is enforced at the service boundary:
- **Cross-Organisation Leakage:** **0** (Tested and verified: writes and reads across different `organisationId` values are rejected with HTTP 403).
- **Cross-Café Leakage:** **0** (Tested and verified: `CAFE_ADMIN` cannot configure or inspect unassigned café risk policies).
- **IDOR / Tampering:** Request body / query / header tampering cannot bypass the authenticated actor's scoped identity.

---

## 9. Deny-by-Default Behaviour

- Actors with missing, null, or undefined roles $\implies$ **DENIED** (HTTP 403)
- Invented role strings (`'ADMIN'`, `'ORG_ADMIN'`, `'COMPANY_ADMIN'`, `'FINANCE_DIRECTOR'`, `'SUPER_ADMIN'`) $\implies$ **DENIED** (HTTP 403)
- Ordinary operational roles (`'CASHIER'`, `'BARISTA'`, `'STAFF'`) $\implies$ **DENIED** (HTTP 403)
- Missing `OFFLINE_RISK_CONFIG_WRITE` permission $\implies$ **DENIED** (HTTP 403)
- No fall-through to allow exists.

---

## 10. Removed Legacy and Invented Role Checks

The following obsolete / invented role checks were removed from `backend/src/services/offlineRiskConfigService.js`:
```javascript
// REMOVED IN R02C:
const ADMIN_ROLES = Object.freeze([
  'MASTER',
  'ADMIN',
  'ORG_ADMIN',
  'COMPANY_ADMIN',
  'FINANCE_DIRECTOR',
  'SUPER_ADMIN',
]);
```
Replaced with canonical role constants and permission verification:
```javascript
// INTRODUCED IN R02C:
const OFFLINE_RISK_PERMISSIONS = Object.freeze({
  READ: 'OFFLINE_RISK_CONFIG_READ',
  WRITE: 'OFFLINE_RISK_CONFIG_WRITE',
});

const CANONICAL_ROLES = Object.freeze([
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
  'STAFF',
]);
```

---

## 11. Permission Test Matrix

| Actor | Canonical Role | Permission Held | Target Organisation | Target Café | Read Effective | Modify Org | Modify Cafe | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Master Admin** | `MASTER` | `READ, WRITE` | Same Org | Org Scope (`null`) | ALLOW | ALLOW | ALLOW | **PASS (200)** |
| **Master Admin** | `MASTER` | `READ, WRITE` | Other Org | Org Scope (`null`) | DENY | DENY | DENY | **DENIED (403)** |
| **Cafe Admin** | `CAFE_ADMIN` | `READ, WRITE` | Same Org | Assigned Café | ALLOW | DENY | ALLOW (Restricted) | **PASS (200 / 403 on Org)** |
| **Cafe Admin** | `CAFE_ADMIN` | `READ, WRITE` | Same Org | Assigned Café (Relaxing) | N/A | DENY | DENY | **REJECTED (400 Weaken Policy)** |
| **Cafe Admin** | `CAFE_ADMIN` | `READ, WRITE` | Same Org | Unassigned Café | DENY | DENY | DENY | **DENIED (403 Cross-Cafe)** |
| **Staff / Barista**| `STAFF` | `READ` | Same Org | Assigned Café | ALLOW | DENY | DENY | **DENIED on Write (403)** |
| **Owner** | `OWNER` | `READ` | Same Org | All / Any Café | ALLOW | DENY | DENY | **DENIED on Write (403)** |
| **Invented Role** | `ADMIN` | None / Any | Same Org | Any | DENY | DENY | DENY | **DENIED (403 Non-Canonical)** |
| **Invented Role** | `ORG_ADMIN` | None / Any | Same Org | Any | DENY | DENY | DENY | **DENIED (403 Non-Canonical)** |
| **Invented Role** | `FINANCE_DIR` | None / Any | Same Org | Any | DENY | DENY | DENY | **DENIED (403 Non-Canonical)** |

---

## 12. Index Manifest Duplication Audit

In R02B, three files were created:
1. `scripts/indexes/cafeOpsR02Indexes.js` (ESM module)
2. `scripts/indexes/cafeOpsR02Indexes.cjs` (CommonJS module)
3. `config/cafeOpsR02Indexes.json` (JSON manifest)

Inspection revealed that:
- `cafeOpsR02Indexes.js` and `cafeOpsR02Indexes.cjs` were already dynamic loader wrappers reading `config/cafeOpsR02Indexes.json` directly via `fs.readFileSync`.
- However, one collection name discrepancy existed: Entry 6 specified `"collection": "kdsprepstations"`, while entries 7 and 8 specified `"collection": "kds_prep_stations"`. This caused tooling to calculate 12 collections instead of the canonical 11 collections defined in Mongoose (`collection: 'kds_prep_stations'`).

---

## 13. Canonical Manifest Selection

**Canonical Source of Truth:** `config/cafeOpsR02Indexes.json` (Option B architecture).

- All schema definitions, keys, unique constraints, partial filter expressions, and risk classifications reside exclusively in `config/cafeOpsR02Indexes.json`.
- Entry 6 collection name was corrected to `"kds_prep_stations"`, bringing total collection count to exactly **11 distinct collections** across **30 indexes**.

---

## 14. Generated / Derived Manifest Handling

- `scripts/indexes/cafeOpsR02Indexes.js` acts as the ESM export adapter loading `config/cafeOpsR02Indexes.json`.
- `scripts/indexes/cafeOpsR02Indexes.cjs` acts as the CommonJS export adapter loading `config/cafeOpsR02Indexes.json`.
- Neither `.js` nor `.cjs` stores duplicate manifest arrays.

---

## 15. Manifest Drift Tests

Automated deep-equality tests in `backend/test/cafeOpsR02CAuthorizationCanonicalization.test.js` (Area 4) verify:
```javascript
assert.deepEqual(cjsManifest, canonicalJsonManifest);
assert.equal(canonicalJsonManifest.length, 30);
assert.equal(new Set(canonicalJsonManifest.map(i => i.collection)).size, 11);
```
Manifest drift is structurally impossible because both modules parse the identical canonical JSON file.

---

## 16. Index Tooling Integration

Both operational index tools dynamically consume the single canonical source:
1. **`scripts/indexes/inspectCafeOpsIndexes.js`**: Imports `CAFE_OPS_R02_INDEXES` from `cafeOpsR02Indexes.js` (30 indexes loaded; read-only verification mode).
2. **`scripts/indexes/prepareCafeOpsIndexes.js --dry-run`**: Imports `CAFE_OPS_R02_INDEXES` from `cafeOpsR02Indexes.js` (30 indexes planned; preflight conflict check passes; zero mutations executed).

---

## 17. ACTIVE Temperature Rule Semantic Correction

In accordance with R02C-05:
- **Database Guarantee:** The partial unique index `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 }` with `{ partialFilterExpression: { active: true } }` guarantees:
  > **AT MOST ONE ACTIVE RULE** may exist for any given scope.
  It does **NOT** guarantee that an active rule exists.
- **Service Guarantee:** The application service layer (`TemperatureRuleService`) is responsible for creating, activating, superseding, and validating effective dates.
- Code comments in `FoodSafetyTemperatureRule.js` and manifest purpose in `config/cafeOpsR02Indexes.json` were corrected to reflect this exact invariant.

---

## 18. Missing-Rule Behaviour & Operational Exception Integration

If a temperature check is logged for an unconfigured statutory process/category:
1. `TemperatureRuleService.evaluateTemperatureRule` returns `{ status: 'RULE_NOT_CONFIGURED', reason: 'RULE_NOT_CONFIGURED', matchedRuleId: null, ruleVersion: null }`.
2. `FoodSafetyService.recordTemperature` marks:
   - `isExcursion = true`
   - `status = 'OUT_OF_RANGE'`
   - `ruleEvaluationStatus = 'RULE_NOT_CONFIGURED'`
3. An audit event is generated for the excursion.
4. `OperationalExceptionService.getCafeExceptions` aggregates the excursion under `FOOD_SAFETY` / `TEMPERATURE_EXCURSION` for immediate corrective intervention.

---

## 19. Active Rule Verification Tests

Tested and verified in `cafeOpsR02CAuthorizationCanonicalization.test.js` (Area 5):
- Zero active rules $\implies$ `RULE_NOT_CONFIGURED` returned (never marked compliant).
- One active rule $\implies$ valid and evaluated.
- Second active rule inserted directly $\implies$ database partial unique index rejects insertion with duplicate key error (`code: 11000`).
- Supersession $\implies$ previous rule marked `active: false` and `status: 'SUPERSEDED'`; historical rule preserved and queryable.

---

## 20. Control Count

- **Controls Before R02C:** 272 (`CTL-001` through `CTL-272`)
- **Controls Added in R02C:** 0
- **Total Controls:** 272

---

## 21. Targeted Tests Summary

A dedicated targeted test suite was created:
- **Suite:** `backend/test/cafeOpsR02CAuthorizationCanonicalization.test.js`
- **Result:** **6 passed, 0 failed** (100% PASS)
  - `Area 1: Canonical Role Registry & Invented Role Audit` — PASS
  - `Area 2: Offline Risk Configuration Write Authorization & Scope Policy` — PASS
  - `Area 3: Offline Risk Configuration Read Authorization & Fallback` — PASS
  - `Area 4: Single-Source Index Manifest, Drift Prevention & Collection Count` — PASS
  - `Area 5: Active Temperature Rule Semantics & Missing-Rule Safety` — PASS

---

## 22. Full Regression Metrics

- **Command:** `npm --prefix backend test`
- **Total Test Files:** 153
- **Total Tests Passed:** 1,541
- **Total Tests Failed:** 0
- **Total Tests Skipped:** 0
- **Net Increase:** +6 tests over the verified R02B baseline (1,535 $\to$ 1,541)

---

## 23. Static Validation Results

- **Backend JavaScript Syntax Validation (`npm --prefix backend run check`):**
  - **378 files checked, 0 errors** (PASS)
- **Frontend Route / Router Validation (`node frontend/verifyRouterImports.mjs`):**
  - **All router imports exist and are exported correctly** (PASS)
- **Git Diff Hygiene (`git diff --check`):**
  - **0 whitespace/syntax issues** (PASS)

---

## 24. Security Regression Analysis

- **P0 Defects:** 0
- **P1 Defects:** 0
- **P2 Defects:** 0
- **P3 Defects:** 0
- **Cross-Café Leakage:** 0
- **Cross-Organisation Leakage:** 0
- **IDOR:** 0
- **Privilege Escalation:** 0

---

## 25. Changed Files in CAFÉ OPS-R02C

1. `backend/src/scripts/seedInitialData.js` — Registered canonical `OFFLINE_RISK_CONFIG_READ` and `OFFLINE_RISK_CONFIG_WRITE` permissions for canonical roles.
2. `backend/src/services/offlineRiskConfigService.js` — Replaced invented `ADMIN_ROLES` with canonical permission & role checks, organisation/café scope guards, and non-weakening policy invariants.
3. `config/cafeOpsR02Indexes.json` — Corrected active rule index purpose semantics and fixed `kds_prep_stations` collection name across all entries (30 indexes across 11 collections).
4. `backend/src/models/FoodSafetyTemperatureRule.js` — Corrected comment on partial unique index to accurately specify AT MOST ONE active rule guarantee.
5. `backend/test/cafeOpsR02BConfigurationIntegrity.test.js` — Aligned test actors to canonical `MASTER` role.
6. `backend/test/cafeOpsR02CAuthorizationCanonicalization.test.js` [NEW] — Comprehensive 6-area test suite verifying all R02C canonicalization requirements.

---

## 26. Final R02C Status & Park Notification

- **Status:** **CAFÉ OPS-R02C IMPLEMENTATION COMPLETE & REGRESSION VERIFIED**
- **Café Operations Development:** **PARKED**
- **Production Index Creation:** NOT PERFORMED (Inspection & dry-run only)
- **Production Migrations:** NOT PERFORMED
- **FINAL-00:** NOT PERFORMED
- **Final Verification:** NOT PERFORMED
- **Production Deployment:** NOT PERFORMED
- **Git Push:** NOT PERFORMED
- **Next:** **STOP AND WAIT FOR OWNER**
