# ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS
## CAFÉ OPS-R02B: FINAL SCHEMA, CONFIGURATION & INDEX HYGIENE REPORT
### TEMPERATURE-RULE VERSIONING · QUARTERLY TRAINING SEMANTICS · OFFLINE RISK CONFIGURATION · INDEX DEPLOYMENT PREPARATION
**Status: IMPLEMENTATION COMPLETE & REGRESSION VERIFIED**  
**Gate Enforcement: NO FINAL VERIFICATION · NO FINAL-00 · NO DEPLOYMENT**  
**Date: September 7, 2026**  

---

## 1. BASELINE

At the conclusion of CAFÉ OPS-R02A, the engineering baseline demonstrated full domain closure across all 10 core operational areas:
- **Canonical Regression**: 1,530 / 1,530 PASS (0 failures, 0 skipped)
- **Defects**: P0 = 0, P1 = 0, P2 = 0, P3 = 0
- **Operational Controls**: 272 controls mapped and verified (`CTL-001` through `CTL-272`)
- **Security Invariants**:
  - Cross-Café Leakage = 0
  - Cross-Organisation Leakage = 0
  - IDOR = 0
  - Privilege Escalation = 0

CAFÉ OPS-R02B was commissioned as a dedicated corrective engineering pass to resolve specific schema index conflicts, eliminate hardcoded offline risk magic numbers, enforce date-safe calendar recurrence for FoSTaC onsite training, and generate a machine-readable index manifest with preflight inspection tooling.

---

## 2. SCOPE

CAFÉ OPS-R02B addressed exactly the six defined areas without expanding scope:
- **R02B-01**: `FoodSafetyTemperatureRule` versioning and index conflict resolution.
- **R02B-02**: Governance terminology correction ("Certified" → "IMPLEMENTATION COMPLETE & REGRESSION VERIFIED").
- **R02B-03**: Quarterly training calendar-month recurrence engine and overdue logic unification.
- **R02B-04**: Governed offline risk configuration (`OfflineRiskConfig`), moving magic constants (40%, ₹25,000) to minor-unit paise configuration with administrative boundaries.
- **R02B-05**: MongoDB index manifest (`cafeOpsR02Indexes.js`, `cafeOpsR02Indexes.json`), read-only inspection script, dry-run planner, and duplicate preflight checks.
- **R02B-06**: Targeted integrity suite and full canonical backend regression verification.

---

## 3. TEMPERATURE RULE INDEX CONFLICT

In R02A, `FoodSafetyTemperatureRule` contained an index conflict:
- The schema declared support for rule versioning (`version: Number`).
- However, the index definition on `{ organisationId: 1, processType: 1, foodCategory: 1, active: 1 }` or compound uniqueness prevented historical rule versions from coexisting under the same process and category once new versions were introduced.
- In R02B, this index conflict has been fully rectified:
  1. The version number is explicitly incorporated into the version unique index:
     `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1, version: 1 }` with `unique: true`.
  2. The single active rule constraint is enforced via a partial unique index:
     `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 }` with `{ unique: true, partialFilterExpression: { active: true } }`.

---

## 4. VERSIONED RULE ARCHITECTURE

Under the versioned rule architecture:
- Multiple versions of a statutory rule (e.g. `COOKING / VEGETARIAN / Version 1`, `Version 2`, `Version 3`) coexist historically within the same organisation and café scope.
- Superseded rules are NEVER overwritten or deleted. When a new version is created or activated:
  - The previous active version is marked with `status = 'SUPERSEDED'`, `active = false`, and timestamped with `effectiveTo = new Date()`.
  - The new version is instantiated with `status = 'ACTIVE'`, `active = true`, and `version = N`.
- Duplicate version numbers within the same scope are rejected with HTTP 409 (`DUPLICATE_RULE_VERSION`).

---

## 5. ACTIVE RULE ENFORCEMENT

The database guarantees that only one rule can be active simultaneously per scope:
- MongoDB enforces uniqueness on `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 }` **only** for documents matching `{ active: true }`.
- Inactive or superseded records (`active: false`) are ignored by this partial index, allowing unbounded historical retention while preventing split-brain statutory standards.
- In-memory service pre-validation also enforces this invariant before write operations.

---

## 6. HISTORICAL RULE PRESERVATION

Historical compliance records remain audit-ready for regulatory inspections under FSSAI Schedule 4:
- When a newer statutory rule becomes effective, the older rule is retained with full audit metadata (`sourceReference`, `criteria`, `createdByUserId`, `createdAt`, `effectiveTo`).
- Regulatory auditors can inspect exactly which criteria were active on any date in the past without ambiguous data overwrites.

---

## 7. RULE-VERSION TRACEABILITY

Every evaluated temperature check permanently records:
- `ruleId`: The unique statutory rule ID (e.g. `TRULE-ZAMORIN-COOK-VEG-V2`).
- `ruleVersion`: The explicit numeric version active at the time of evaluation.
- `temperatureRuleId`: Canonical alias reference.
- `ruleEvaluationStatus`: Outcome (`PASS`, `FAIL`, `RULE_NOT_CONFIGURED`).

Historical temperature logs are never re-evaluated retroactively against newer rule versions, preserving immutable food-safety legal evidence.

---

## 8. QUARTERLY TRAINING SEMANTICS

In R02A, quarterly onsite food-handler training used a flat `+90 days` timestamp addition (`90 * 24 * 3600 * 1000`). While conservative, this created ambiguity between calendar quarters and day counts.
In R02B, explicit recurrence semantics have been established:
- `frequency`: `QUARTERLY`
- `recurrenceMode`: `CALENDAR_MONTHS`
- `recurrenceInterval`: `3`
- `calculation`: `nextDueDate = sessionDate + 3 calendar months` (with calendar month-end clamping).

---

## 9. DATE RECURRENCE ENGINE

The canonical date recurrence engine in `backend/src/utils/trainingRecurrence.js`:
- Advances exactly 3 calendar months from the base date.
- Implements month-end date clamping to prevent invalid calendar dates:
  - **January 31** → **April 30** (April has 30 days)
  - **March 31** → **June 30** (June has 30 days)
  - **August 31** → **November 30** (November has 30 days)
  - **December 31** → **March 31** (Year increment + 31 days)
  - **November 30 (Leap Year)** → **February 29** (e.g. 2024, 2028)
  - **November 30 (Standard Year)** → **February 28** (e.g. 2026)
- Unifies overdue evaluation between `EmployeeTraining` scheduling and `OperationalExceptionService` Check 6.

---

## 10. OFFLINE RISK CONFIGURATION

Hardcoded offline risk thresholds (`40%` discount and `₹25,000` total) have been removed from `offlineSyncService.js` and replaced with governed configuration via `OfflineRiskConfig`:
- `maxDiscountPercent`: Configurable discount percentage (default: `40%`, bounds: `0` to `100`).
- `highValueAmountPaise`: Configurable high-value offline transaction ceiling represented in integer minor units (default: `2,500,000 paise` = ₹25,000).
- `allowCafeOverride`: Boolean flag controlling whether individual cafés may specify local overrides.

---

## 11. THRESHOLD GOVERNANCE

Strict governance rules protect offline risk configuration:
1. **Administrative Permission Boundary**:
   - Only administrative roles (`MASTER`, `ADMIN`, `ORG_ADMIN`, `COMPANY_ADMIN`, `FINANCE_DIRECTOR`) can modify risk configuration.
   - Cashiers, baristas, and café operators are denied access with HTTP 403 (`FORBIDDEN_RISK_CONFIG`).
2. **Fallback Hierarchy**:
   - Validated café-specific override (if permitted by organisation) → Organisation default → Safe application defaults (`40%`, `₹25,000`).
3. **Numeric & Currency Validation**:
   - Discounts must be finite numbers between `0` and `100`. Negative values, `NaN`, and `Infinity` are rejected.
   - Financial ceilings must be non-negative integers in paise. Fractional currency is rejected.
4. **Offline Policy Classes Preserved**:
   - Threshold adjustments do NOT weaken offline safety classes. Prohibited offline operations (`REFUND`, `CASH_REVERSAL`, card/electronic payments) remain strictly blocked by `ONLINE_REQUIRED` and `PAYMENT_PROVIDER_DEPENDENT` regardless of threshold settings.

---

## 12. INDEX INVENTORY

A complete inventory of all 30 MongoDB indexes introduced or modified across R02, R02A, and R02B was conducted across 11 collections:
1. `foodsafetytemperaturerules` (3 indexes: `ruleId_1`, `uniq_trule_org_cafe_proc_cat_ver`, `uniq_trule_org_cafe_proc_cat_active`)
2. `temperaturelogs` (3 indexes: `logId_1`, `idx_templog_org_cafe_recorded`, `idx_templog_org_cafe_excursion_status`)
3. `kds_prep_stations` (3 indexes: `prepStationId_1`, `uniq_kds_station_org_cafe_code`, `idx_kds_station_org_cafe_order`)
4. `kdstickets` (4 indexes: `ticketId_1`, `idx_kds_ticket_org_cafe_status_received`, `idx_kds_ticket_org_cafe_station_status`, `idx_kds_ticket_org_cafe_order`)
5. `inventorylots` (4 indexes: `lotId_1`, `idx_lot_fefo_expiry`, `idx_lot_supplier_po`, `idx_lot_supplier_batch`)
6. `bills` (1 multikey index: `org_lineitem_consumed_lot`)
7. `employeetrainings` (3 indexes: `trainingId_1`, `idx_emptrn_org_user_status`, `idx_emptrn_org_cafe_type_due`)
8. `incominginspections` (3 indexes: `inspectionId_1`, `idx_insp_org_cafe_status_date`, `idx_insp_org_po`)
9. `foodsafetyincidents` (3 indexes: `incidentId_1`, `idx_fsi_org_cafe_status_date`, `idx_fsi_org_lot`)
10. `shifthandovers` (2 indexes: `handoverId_1`, `idx_handover_org_cafe_date`)
11. `offlineriskconfigs` (1 index: `uniq_offline_risk_cfg_org_cafe`)

---

## 13. MACHINE-READABLE INDEX MANIFEST

The index manifest has been codified into machine-readable formats:
- **CommonJS / ES Module**: `scripts/indexes/cafeOpsR02Indexes.js` & `scripts/indexes/cafeOpsR02Indexes.cjs`
- **JSON Data Manifest**: `config/cafeOpsR02Indexes.json`

Every index entry specifies:
- `collection`: Target MongoDB collection name
- `model`: Mongoose model name
- `indexName`: Canonical index identifier
- `keys`: Key specification object
- `unique`: Boolean uniqueness constraint
- `partialFilterExpression`: Filter expression (if partial)
- `sparse`: Boolean sparse indicator
- `purpose`: Functional and regulatory justification
- `introducedByStage`: Stage provenance (`R02`, `R02A`, `R02B`)
- `productionExistingStatus`: Deployment status
- `creationRequired`: Boolean deployment requirement
- `riskLevel`: Risk classification (`LOW`, `MEDIUM`, `HIGH`)

---

## 14. INDEX INSPECTION SCRIPT

A dedicated, non-destructive read-only inspection script was authored:
```bash
node scripts/indexes/inspectCafeOpsIndexes.js [--uri <mongodb-uri>]
```
- Operates in `READ-ONLY / INSPECT` mode by default.
- Compares actual database indexes against manifest expectations.
- Reports matching, missing, and differing indexes without mutating database state.
- Supports offline manifest syntax validation when no database URI is provided.

---

## 15. INDEX DRY-RUN

A dry-run deployment planner was authored:
```bash
node scripts/indexes/prepareCafeOpsIndexes.js --dry-run [--uri <mongodb-uri>]
```
- Evaluates target collections and compiles an execution plan.
- Categorizes each index as: `INDEX_ALREADY_EXISTS`, `WOULD_BE_CREATED_DRY_RUN`, or `REQUIRES_MANUAL_REVIEW`.
- Enforces strict safety: Direct execution without `--dry-run` is blocked by policy.
- Verified dry-run execution confirmed **0 database mutations**.

---

## 16. UNIQUE INDEX PREFLIGHT

The index preparation tool incorporates an automated unique index preflight conflict scanner (`runUniquePreflight`):
- Audits target collections for pre-existing duplicate documents that would cause unique index creation to abort with `E11000`.
- Scans:
  1. `kds_prep_stations`: Duplicate prep station codes per café.
  2. `foodsafetytemperaturerules`: Duplicate rule versions in the same scope.
  3. `foodsafetytemperaturerules`: Multiple active rules in the same scope.
  4. `offlineriskconfigs`: Duplicate risk configurations in the same scope.
- Reports all conflicting records with document IDs for operator review without modifying or deleting data.

---

## 17. MONGOOSE AUTOINDEX REVIEW

Mongoose `autoIndex` production behavior was evaluated:
- Mongoose defaults `autoIndex` to `true` when unconfigured.
- In production high-scale MongoDB replica sets, automatic index builds on server boot can introduce performance bottlenecks, lock tables, or impact connection latency.
- However, because the Zamorin Café ERP infrastructure does not yet feature an automated external CI/CD index deployment job, globally disabling `autoIndex` at this stage would risk missing indexes on freshly deployed models.
- **Decision**: `autoIndex` remains at standard repository defaults for now, with explicit operational scripts (`prepareCafeOpsIndexes.js`) provided for governed pre-deployment creation.

---

## 18. PRODUCTION INDEX RECOMMENDATION

For future deployment stages:
1. Run preflight conflict verification: `node scripts/indexes/prepareCafeOpsIndexes.js --dry-run`.
2. Resolve any reported duplicate records.
3. Build new indexes during scheduled maintenance windows with rolling index builds or background builds on replica sets.
4. Verify index installation: `node scripts/indexes/inspectCafeOpsIndexes.js`.
5. Once external index automation is in place, set `mongoose.set('autoIndex', process.env.NODE_ENV !== 'production')`.

---

## 19. TARGETED TESTS

The targeted configuration integrity test suite (`backend/test/cafeOpsR02BConfigurationIntegrity.test.js`) was executed:
```text
▶ CAFÉ OPS-R02B: Configuration, Schema & Index Hygiene Integrity Suite
  ✔ Area 1: Temperature Rule Versioning — Multi-version coexistence & Single ACTIVE rule (1572.7ms)
  ✔ Area 2: Quarterly Training Semantics — 3 Calendar Months & Edge Cases (7.1ms)
  ✔ Area 3: Governed Offline Risk Configuration — Boundaries, Paise & Fallback (65.5ms)
  ✔ Area 4: MongoDB Index Manifest, Inspection & Dry-Run Preflight (83.6ms)
✔ CAFÉ OPS-R02B: Configuration, Schema & Index Hygiene Integrity Suite (1940.2ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
```
Additionally, all existing test suites were verified:
- `cafeOpsR02CorrectiveIntegrity.test.js`: 8 / 8 PASS
- `cafeOpsR02AllDomains.test.js`: 11 / 11 PASS

---

## 20. FULL REGRESSION

The complete canonical backend test suite was executed across all 152 test files:
```text
Total Test Suites: 152
Total Tests Run   : 1,535
Total Passed     : 1,535
Total Failed     : 0
Total Skipped    : 0
Total Cancelled  : 0
Duration         : 330.6s
```
Test count increased from 1,530 to 1,535 with zero regressions across all modules.

---

## 21. STATIC VALIDATION

Static checks and code quality gates were fully satisfied:
- **Backend JavaScript Validation**: `npm --prefix backend run check` → 377 files PASS.
- **Frontend Syntax Validation**: `node scripts/check_syntax.mjs` → 78 files PASS.
- **Router & Module Parity Audit**: `node scripts/validate_routes.mjs` → 55 frontend routers, 44 backend routers, 25 Café Ops screens PASS.
- **Global File Verification**: `node scripts/verify_all.js` → 458 JS files PASS.
- **Git Diff Hygiene**: `git diff --check` → 0 syntax/whitespace errors.

---

## 22. SECURITY REGRESSION

All core security invariants remain strictly intact:
- **Vulnerabilities**: P0 = 0, P1 = 0, P2 = 0, P3 = 0.
- **Cross-Café Isolation**: Verified. Café-specific temperature rules, KDS stations, and offline risk overrides never leak across café boundaries.
- **Cross-Organisation Isolation**: Strict tenant scoping maintained across all database models.
- **IDOR Resistance**: Verified.
- **Privilege Escalation Resistance**: Verified. Non-administrative operators cannot modify risk thresholds.
- **Offline Replay Guards**: Verified. Operator session verification, device registration validation, and deterministic client ID deduplication remain active.

---

## 23. CHANGED FILES

The following files were created or modified during CAFÉ OPS-R02B:

### Backend Models & Schemas
- [FoodSafetyTemperatureRule.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/models/FoodSafetyTemperatureRule.js) — Added `cafeId`, `status`, compound version unique index, and partial unique active index.
- [TemperatureLog.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/models/TemperatureLog.js) — Added `ruleVersion` and `temperatureRuleId` fields.
- [OfflineRiskConfig.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/models/OfflineRiskConfig.js) — New model for governed offline risk thresholds.

### Backend Services & Utilities
- [temperatureRuleService.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/temperatureRuleService.js) — Versioned rule creation, superseding, café fallback, and `ruleVersion` output.
- [foodSafetyService.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/foodSafetyService.js) — Passes `cafeId`, persists `ruleVersion`, and integrates explicit quarterly recurrence.
- [trainingRecurrence.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/utils/trainingRecurrence.js) — Canonical recurrence calculation with calendar-month addition and month-end clamping.
- [operationalExceptionService.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/operationalExceptionService.js) — Uses unified `isTrainingOverdue` check.
- [offlineRiskConfigService.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/offlineRiskConfigService.js) — Governance service for offline risk thresholds with permission checking.
- [offlineSyncService.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/src/services/offlineSyncService.js) — Ingests governed risk configuration replacing hardcoded numbers.

### Index Manifest & Tooling
- [cafeOpsR02Indexes.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/scripts/indexes/cafeOpsR02Indexes.js) — ES Module index manifest.
- [cafeOpsR02Indexes.cjs](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/scripts/indexes/cafeOpsR02Indexes.cjs) — CommonJS index manifest.
- [cafeOpsR02Indexes.json](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/config/cafeOpsR02Indexes.json) — JSON index manifest.
- [inspectCafeOpsIndexes.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/scripts/indexes/inspectCafeOpsIndexes.js) — Read-only inspection CLI tool.
- [prepareCafeOpsIndexes.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/scripts/indexes/prepareCafeOpsIndexes.js) — Dry-run index planner and duplicate preflight scanner.

### Test Suites
- [cafeOpsR02BConfigurationIntegrity.test.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/test/cafeOpsR02BConfigurationIntegrity.test.js) — New targeted integrity test suite (5/5 PASS).
- [cafeOpsR02CorrectiveIntegrity.test.js](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/backend/test/cafeOpsR02CorrectiveIntegrity.test.js) — Updated quarterly due date expectation for calendar-month semantics (8/8 PASS).

### Governance Reports
- [ZAMORIN_CAFE_OPERATIONS_CAFE_OPS_R02A_CORRECTIVE_IMPLEMENTATION_REPORT.md](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/ZAMORIN_CAFE_OPERATIONS_CAFE_OPS_R02A_CORRECTIVE_IMPLEMENTATION_REPORT.md) — Corrected governance wording.

---

## 24. GOVERNANCE WORDING CORRECTION

All premature "Certified" wording in R02A documentation has been replaced with:
`IMPLEMENTATION COMPLETE & REGRESSION VERIFIED`
The signature block has been corrected to "Report Attested By". No unapproved certification claims remain.

---

## 25. FINAL R02B STATUS

**CAFÉ OPS-R02B IMPLEMENTATION COMPLETE & REGRESSION VERIFIED**  
- **Production Index Creation Executed**: NO
- **Production Migrations Executed**: NO
- **Final Verification / FINAL-00**: NOT PERFORMED
- **Production Deployment**: NOT PERFORMED
- **Git Push**: NOT PERFORMED
- **Status**: PAUSED — WAITING FOR OWNER INSTRUCTION

---

**Report Attested By**:  
*Senior Principal Full-Stack Engineer, Restaurant ERP Architect, Food-Safety Systems Engineer, Security Engineer and QA Lead*  
*Zamorin Café Operations Engineering Team*  
*Timestamp: September 7, 2026*  
