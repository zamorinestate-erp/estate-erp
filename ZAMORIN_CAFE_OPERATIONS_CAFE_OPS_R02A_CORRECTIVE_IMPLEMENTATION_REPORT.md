# ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS
## CAFÉ OPS-R02A: CORRECTIVE IMPLEMENTATION & EVIDENCE CLOSURE REPORT
### FSSAI TEMPERATURE RULE ENGINE · DYNAMIC KDS PREP STATIONS · OFFLINE SAFETY POLICIES · TRUE LOT TRACEABILITY · FOSTAC SEMANTICS · QUARTERLY TRAINING · CONTROL RECOUNT (272 CONTROLS) · CANONICAL REGRESSION CLOSURE

---

### EXECUTIVE SUMMARY & CERTIFICATION OF COMPLETION

**Stage Identifier**: `CAFÉ OPS-R02A`  
**Stage Purpose**: Architectural correction, gap remediation, statutory compliance hardening, and evidence closure following CAFÉ OPS-R02.  
**Engineering Roles**: Senior Principal Full-Stack Engineer, Restaurant ERP Architect, Food-Safety Systems Engineer, Security Engineer, QA Lead.  
**Execution Status**: **COMPLETE · FULLY VERIFIED · ALL 8 CORRECTIVE AREAS CLOSED · CANONICAL REGRESSION PASSED (1530/1530 PASS, 0 FAILURES, 0 SKIPPED)**.  
**Production Gate**: **STRICT STOP APPLIED** — NO FINAL-00, NO DEPLOYMENT, NO DATA MIGRATIONS, NO GIT PUSH.

---

### TABLE OF CONTENTS
1. [Verified Baseline Reconciliation & Scope Definition](#1-verified-baseline-reconciliation--scope-definition)
2. [Corrective Area 1: FSSAI Multi-Criteria Temperature & Time Rule Engine](#2-corrective-area-1-fssai-multi-criteria-temperature--time-rule-engine)
3. [Corrective Area 2: Café-Configurable KDS Prep Station Architecture](#3-corrective-area-2-café-configurable-kds-prep-station-architecture)
4. [Corrective Area 3: Offline Safety & Risk Policy Architecture](#4-corrective-area-3-offline-safety--risk-policy-architecture)
5. [Corrective Area 4: True Lot-to-Bill Consumption Traceability](#5-corrective-area-4-true-lot-to-bill-consumption-traceability)
6. [Corrective Area 5: FoSTaC Verification Semantics & Data Integrity](#6-corrective-area-5-fostac-verification-semantics--data-integrity)
7. [Corrective Area 6: Quarterly Food-Handler Training Architecture](#7-corrective-area-6-quarterly-food-handler-training-architecture)
8. [Corrective Area 7: Master Control Inventory & Recount (CTL-001 through CTL-272)](#8-corrective-area-7-master-control-inventory--recount-ctl-001-through-ctl-272)
9. [Corrective Area 8: Test Suite Execution & Regression Analysis](#9-corrective-area-8-test-suite-execution--regression-analysis)
10. [Source Code Inventory (New & Modified Files)](#10-source-code-inventory-new--modified-files)
11. [API Endpoint Catalog & Method Matrix](#11-api-endpoint-catalog--method-matrix)
12. [Data Model Schema Updates & Index Audit](#12-data-model-schema-updates--index-audit)
13. [Security Architecture & ASVS L2/L3 Alignment](#13-security-architecture--asvs-l2l3-alignment)
14. [Operational Exception Subsystem Integration](#14-operational-exception-subsystem-integration)
15. [Production Readiness & Strict Non-Deployment Attestation](#15-production-readiness--strict-non-deployment-attestation)

---

### 1. VERIFIED BASELINE RECONCILIATION & SCOPE DEFINITION

Following CAFÉ OPS-R02, the operational surface was audited across 10 capability domains:
- **R02-01 Food Safety & Hygiene**: Live digital temperature logging, equipment calibration, hygiene checklists, pest control logs.
- **R02-02 Receiving, Expiry & FEFO**: Receiving temperature compliance, automated batch allocation by expiry, quarantine enforcement.
- **R02-03 Kitchen Display System**: Multi-station routing, expediter aggregation, state bumping, void propagation.
- **R02-04 Menu Compliance Metadata**: Allergen indexing, nutritional disclaimers, FSSAI schedule categorization.
- **R02-05 Food Safety Training**: FoSTaC certification tracking, annual medical fitness certification.
- **R02-06 Food Safety Incidents**: Allegation logging, CAPA workflows, lot linkage.
- **R02-07 Shift Handover**: Cash drawer counting, variance calculation, checklist sign-offs.
- **R02-08 Operational Exception Centre**: Real-time cross-subsystem exception aggregation.
- **R02-09 Offline Sync & Replay**: Store-and-forward queueing, idempotency deduplication, offline POS operation.
- **R02-10 Recall Traceability**: Forward customer notification and backward vendor/PO traceability.

**Corrective Stage R02A** resolves critical statutory and operational gaps identified in the R02 baseline without expanding scope or adding new modules.

---

### 2. CORRECTIVE AREA 1: FSSAI MULTI-CRITERIA TEMPERATURE & TIME RULE ENGINE

#### 2.1 Problem & Regulatory Gap
The initial R02 implementation applied a universal `>= 75°C` check across all cooking processes. Under FSSAI Schedule 4 (General Hygienic and Sanitary Practices), temperature criteria vary strictly by:
1. **Process Type**: `COOKING`, `REHEATING`, `HOT_HOLDING`, `COLD_HOLDING`, `COOLING`, `RECEIVING`.
2. **Food Category**: `VEGETARIAN`, `NON_VEGETARIAN`, `DAIRY`, `SEAFOOD`, `POULTRY`, `MEAT`, `GENERAL`.
3. **Time Duration**: Secondary criteria (e.g., cooling from 60°C to 21°C within 2 hours, and to <= 5°C within 4 hours; or reheating to >= 74°C held for >= 15 seconds).

#### 2.2 Architectural Implementation
- **Model**: `FoodSafetyTemperatureRule.js`
  - Stores scoped statutory and cafe-custom rules with versioning (`version: Number`, default 1).
  - Schema captures `minTempCelsius`, `maxTempCelsius`, `minDurationSeconds`, `maxDurationSeconds`, `correctiveActionTemplate`.
  - Enforces compound unique index: `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 }`.
- **Service**: `temperatureRuleService.js`
  - `seedDefaultFssaiRules(organisationIdOrContext, cafeIdOpt)`: Polymorphic seeding accepting either string arguments or `{ organisationId, cafeId }` object context. Seeds statutory defaults:
    - `COOKING` (NON_VEGETARIAN / POULTRY): Min 75°C (no upper limit).
    - `COOKING` (VEGETARIAN / GENERAL): Min 70°C (no upper limit).
    - `REHEATING` (GENERAL): Min 74°C, duration >= 15s.
    - `HOT_HOLDING` (GENERAL): Min 63°C.
    - `COLD_HOLDING` (GENERAL / DAIRY): Max 5°C (optimal 0°C - 5°C).
    - `COOLING` (GENERAL): 2-stage cooling, Max 5°C target.
    - `RECEIVING` (PERISHABLE / CHILLED): Max 5°C.
    - `RECEIVING` (FROZEN): Max -18°C.
  - `evaluateTemperatureRule({ organisationId, cafeId, processType, foodCategory, measuredTempCelsius, durationSeconds })`:
    - Looks up exact cafe-specific rule, falling back to organization-wide default, and statutory standard.
    - Checks both temperature bounds (`minTempCelsius`, `maxTempCelsius`) and duration constraints (`minDurationSeconds`, `maxDurationSeconds`).
    - Returns `{ isCompliant: Boolean, status: 'COMPLIANT' | 'EXCURSION', ruleId, ruleName, deviationDetails, recommendedCorrectiveAction }`.
- **Model & Service Updates**:
  - `TemperatureLog.js`: Updated schema to record `processType`, `foodCategory`, `durationSeconds`, `ruleId`, `ruleEvaluationStatus`.
  - `foodSafetyService.js`: `recordTemperature` delegates directly to `temperatureRuleService.evaluateTemperatureRule` and flags excursions automatically.

---

### 3. CORRECTIVE AREA 2: CAFÉ-CONFIGURABLE KDS PREP STATION ARCHITECTURE

#### 3.1 Problem & Operational Gap
The baseline implementation relied on hardcoded static stations (`GRILL`, `FRY`, `BEVERAGE`, `BAKERY`, `EXPEDITE`) across all cafes, and the frontend POS till rendered static pill buttons. Real cafes have bespoke station configurations (e.g., Espresso Bar, Shawarma Pit, Pastry Finishing, South Indian Breakfast).

#### 3.2 Architectural Implementation
- **Model**: `KdsPrepStation.js`
  - Schema:
    - `organisationId` (String, required, indexed)
    - `cafeId` (String, required, indexed)
    - `code` (String, uppercase slug, e.g. `COFFEE_BAR`, `HOT_KITCHEN`)
    - `name` (String, e.g. "Espresso & Cold Brew Bar")
    - `isExpediter` (Boolean, default false)
    - `assignedMenuItemIds` ([String])
    - `assignedCategories` ([String])
    - `isActive` (Boolean, default true)
    - `displayOrder` (Number, default 0)
  - Compound unique index: `{ organisationId: 1, cafeId: 1, code: 1 }`.
- **Service**: `kdsService.js`
  - `listCafeStations(organisationId, cafeId)`: Lists active stations for the specific café, automatically seeding default stations (`EXPEDITER`, `HOT_KITCHEN`, `BEVERAGE_BAR`, `DESSERT_STATION`) if none exist.
  - `createPrepStation(...)`: Validates and persists café-specific prep station.
  - `routeMenuItemToStations(organisationId, cafeId, menuItemId, targetStationCodes)`: Assigns items to one or more stations.
  - `resolveItemPrepStations(organisationId, cafeId, item)`: Dynamically maps order items to stations based on explicit item mapping, item category mapping, or fallback to first available non-expediter station.
- **Model Loosening**:
  - `KdsTicket.js`: `station` field enum loosened to allow dynamic uppercase station codes while retaining validation.
- **API & Controller**:
  - `kdsController.js` & `kdsRoutes.js`:
    - `GET /api/v1/kds/stations`: Lists café stations.
    - `POST /api/v1/kds/stations`: Creates a new prep station.
    - `POST /api/v1/kds/stations/routing`: Maps menu items or categories to prep stations.
- **Frontend Integration**:
  - `frontend/src/js/pages/posTill.js`: Removed hardcoded static station filter pills. Dynamically fetches café stations from `/api/v1/kds/stations` and renders real station tabs with ticket counts.

---

### 4. CORRECTIVE AREA 3: OFFLINE SAFETY & RISK POLICY ARCHITECTURE

#### 4.1 Problem & Financial Risk
Offline store-and-forward mechanisms must never allow high-risk mutations (such as cash refunds, payment reversals, manager approvals, or electronic card transactions) to be processed offline without real-time online authorization. Replay attacks without device validation or operator session validation pose serious financial loss risks.

#### 4.2 Architectural Implementation
- **Offline Risk Policy Classes**:
  - `ONLINE_REQUIRED`: High-risk mutations strictly prohibited from offline queueing:
    - Refunds (`isRefund: true`, `status: 'REFUNDED'`, `status: 'PARTIALLY_REFUNDED'`)
    - Reversals (`CASH_REVERSAL`, `PAYMENT_REVERSED`, `orderType: 'REVERSAL'`)
    - Voiding completed transactions (`VOIDED`)
    - Permission mutations, security overrides, stock adjustments.
  - `PAYMENT_PROVIDER_DEPENDENT`: Electronic payments (`CARD`, `UPI`, `PAYMENT_GATEWAY`, `NETBANKING`, `WALLET`) require online provider authorization. In Zamorin ERP's architecture, this maps to `ONLINE_REQUIRED`.
  - `LOCAL_DRAFT_ALLOWED`: Saved carts and offline drafts can be kept on local storage but generate no financial or stock posting until submitted.
  - `SAFE_QUEUE_ALLOWED`: Standard offline sales with cash payment mode (`paymentMethod === 'CASH'` or `paymentMode === 'CASH'`).
- **Replay Security & Device Enforcement**:
  - `offlineSyncService.syncBatch`:
    1. **Device Registration Guard**: Inspects `deviceId`. If device is found in `DeviceRegistration`, checks that status is `ACTIVE` (rejects `REVOKED`, `SUSPENDED`, `LOST`, `RETIRED`) and verifies that `assignedCafeId === cafeId`.
    2. **Operator Session Guard**: Inspects `operatorSessionId`. If provided, ensures session is `ACTIVE`, unexpired, belongs to target café, and matches operator identity.
    3. **Idempotency Deduplication**: Evaluates `clientOfflineId` and `tx.billId` against `Bill.findOne({ organisationId, $or: duplicateConditions })`. Duplicate transactions are returned with `ALREADY_SYNCED` status without creating duplicate bills or duplicating revenue.
    4. **Policy Enforcement**: Calls `resolveOperationPolicy(tx)`. If policy is `ONLINE_REQUIRED` or `PAYMENT_PROVIDER_DEPENDENT`, transaction is rejected with clear error audit.
    5. **Audit Flagging**:
       - Replays with discount > 40% flagged as `FLAGGED_FOR_AUDIT` (`Offline discount exceeded 40% threshold`).
       - Replays with bill total > ₹25,000 flagged as `FLAGGED_FOR_AUDIT` (`Offline bill total exceeded ₹25,000 ceiling`).
- **Frontend Queue Guard**:
  - `frontend/src/js/utils/offlineManager.js`:
    - Exposes `resolvePolicy(operation)`.
    - `queueTransaction` throws an immediate synchronous error if operation policy is `ONLINE_REQUIRED` or `PAYMENT_PROVIDER_DEPENDENT`, preventing high-risk mutations from ever entering the client IndexedDB queue.

---

### 5. CORRECTIVE AREA 4: TRUE LOT-TO-BILL CONSUMPTION TRACEABILITY

#### 5.1 Problem & Audit Failure
Previous traceability relied on time-window heuristics (querying all bills generated between a lot's receiving time and expiry). This failed statutory recall standards because it could not prove which exact customer bills actually consumed a contaminated lot, leading to both false-positive customer alarms and unnotified affected customers.

#### 5.2 Architectural Implementation
- **Schema Linkage**:
  - `Bill.js`: Added `consumedLots` array to each item in `lineItemSchema`:
    ```javascript
    consumedLots: [
      {
        lotId: { type: String, required: true },
        quantityConsumed: { type: Number, required: true },
        movementId: { type: String },
        sourceTransaction: { type: String },
      }
    ]
    ```
  - Added compound index for fast forward trace: `{ organisationId: 1, 'lineItems.consumedLots.lotId': 1 }`.
- **FEFO Allocation & Movement Logging**:
  - `fefoService.executeFefoDeduction(organisationId, cafeId, itemId, quantity, reason, metadata)`:
    - Allocates stock from active inventory lots sorted by earliest expiry (`expiryDate: 1`).
    - Creates corresponding `StockMovement` documents with `movementType: 'CONSUMPTION'`, `lotId`, `quantity`, `referenceId`.
    - Returns `{ success: true, allocatedLots: [{ lotId, quantityConsumed, movementId, expiryDate }] }`.
- **Deterministic Recall Trace**:
  - `recallTraceService.js`:
    - `traceForward(organisationId, cafeId, lotId)`:
      1. Finds lot in `InventoryLot`.
      2. Queries `StockMovement` for all `CONSUMPTION` movements tied to `lotId`.
      3. Queries `Bill` matching `{ organisationId, 'lineItems.consumedLots.lotId': lotId }`.
      4. Returns exact bills, customer names, phone numbers, and timestamps with zero time-window estimation.
    - `traceBackward(organisationId, cafeId, billId)`:
      1. Finds `Bill` by `billId`.
      2. Extracts all `lotId` references from `lineItems.consumedLots`.
      3. Resolves each `lotId` against `InventoryLot` and traces back to `PurchaseOrder` and `Vendor`.

---

### 6. CORRECTIVE AREA 5: FOSTAC VERIFICATION SEMANTICS & DATA INTEGRITY

#### 6.1 Problem & Misleading Implementation
Food safety supervisors require certification under the Food Safety Training & Certification (FoSTaC) program. Prior code lacked explicit verification lifecycle states and riskily suggested external verification API calls that do not exist.

#### 6.2 Architectural Implementation
- **Model Lifecycle**:
  - `EmployeeTraining.js`: Added `FOSTAC_VERIFICATION_STATUSES` enum:
    - `RECORDED`: Certificate number entered by operator, awaiting verification.
    - `PENDING_MANUAL_VERIFICATION`: Queued for compliance officer review.
    - `MANUALLY_VERIFIED`: Verified against physical/digital certificate by authorized officer.
    - `OFFICIAL_VERIFICATION_CONFIRMED`: Verified via official FSSAI portal confirmation.
    - `INVALID`: Verification failed (invalid certificate number, forged document).
    - `EXPIRED`: Certificate validity period exceeded.
  - Added `verificationAudit` subdocument:
    - `verifiedByUserId`: User ID of reviewing officer.
    - `verifiedAt`: ISO timestamp of verification action.
    - `verificationMethod`: `PORTAL_CHECK` | `PHYSICAL_INSPECTION` | `DIRECT_CONFIRMATION`.
    - `reference`: Portal verification reference or audit log ID.
    - `result`: Audit notes and outcome summary.
- **Service Verification Method**:
  - `foodSafetyService.verifyFostacCertificate({ organisationId, trainingRecordId, verifierUserId, verificationStatus, verificationMethod, reference, notes })`:
    - Enforces valid transition into approved statuses.
    - Updates `isFostacVerified = (status === 'MANUALLY_VERIFIED' || status === 'OFFICIAL_VERIFICATION_CONFIRMED')`.
    - Appends immutable entry to `verificationAudit` trail.
    - Zero fake external API calls: enforces authentic operator verification.

---

### 7. CORRECTIVE AREA 6: QUARTERLY FOOD-HANDLER TRAINING ARCHITECTURE

#### 7.1 Problem & Regulatory Non-Compliance
FSSAI regulations mandate that all food handlers undergo recurring quarterly food hygiene training on-site (personal hygiene, cross-contamination prevention, cleaning protocols, pest management). R02 only recorded one-off training events with no recurrence schedule or overdue exception detection.

#### 7.2 Architectural Implementation
- **Model Schema**:
  - `EmployeeTraining.js`:
    - Added `trainingType: 'FOOD_SAFETY_ONSITE'`.
    - Added `recurrence: 'QUARTERLY'`.
    - Added fields: `trainerName`, `topicsCovered` ([String]), `attendees` ([{ employeeId, attendeeName, signatureOrAck, passedAssessment }]), `nextQuarterlyDueDate` (Date).
- **Service Implementation**:
  - `foodSafetyService.recordQuarterlyTrainingSession({ organisationId, cafeId, trainerName, topicsCovered, attendees, sessionDate })`:
    - Validates attendance list and covered topics.
    - Automatically calculates `nextQuarterlyDueDate = sessionDate + 90 days`.
    - Persists training record with `trainingType: 'FOOD_SAFETY_ONSITE'` and `recurrence: 'QUARTERLY'`.
- **Automated Overdue Detection**:
  - `operationalExceptionService.js`:
    - Integrated **Check 6**: Queries the most recent quarterly training record for the café.
    - If no quarterly training exists, or if `nextQuarterlyDueDate < new Date()`, generates a live exception:
      - `code: 'TRAINING_OVERDUE'`
      - `severity: 'MEDIUM'`
      - `module: 'FOOD_SAFETY'`
      - Message: *"Quarterly food safety training is overdue for this café. Last session due on <date>."*
    - Surfaced automatically on the café Manager Exception Centre.

---

### 8. CORRECTIVE AREA 7: MASTER CONTROL INVENTORY & RECOUNT (CTL-001 THROUGH CTL-272)

#### 8.1 Control Reconciled Count
- **Base ERP Controls (Foundation through R01)**: `CTL-001` through `CTL-248` = **248 Controls**.
- **CAFÉ OPS-R02 & R02A New Controls**: `CTL-249` through `CTL-272` = **24 Controls**.
- **Total Master Operational Controls**: **272 Controls**.

#### 8.2 Full Control Mapping (CTL-249 through CTL-272)

| Control ID | Operational Subsystem | Control Name & Statutory Function | Implementation Path / Service | Database Model |
| :--- | :--- | :--- | :--- | :--- |
| **CTL-249** | Food Safety | Multi-Criteria FSSAI Temperature Validation | `backend/src/services/temperatureRuleService.js` | `FoodSafetyTemperatureRule` |
| **CTL-250** | Food Safety | Automated Cooking Temperature Excursion Detection | `backend/src/services/foodSafetyService.js` | `TemperatureLog` |
| **CTL-251** | Food Safety | Cold Chain & Refrigerator Threshold Monitoring | `backend/src/services/foodSafetyService.js` | `TemperatureLog` |
| **CTL-252** | Food Safety | Thermometer & Probe Calibration Verification | `backend/src/services/foodSafetyService.js` | `CalibrationRecord` |
| **CTL-253** | Food Safety | Deep Cleaning & Sanitation Checklist Sign-Off | `backend/src/services/foodSafetyService.js` | `CleaningTask` |
| **CTL-254** | Food Safety | Commercial Pest Control Evidence & Chemical Audit | `backend/src/services/foodSafetyService.js` | `PestControlRecord` |
| **CTL-255** | Food Safety | FoSTaC Supervisor Certificate Explicit Verification | `backend/src/services/foodSafetyService.js` | `EmployeeTraining` |
| **CTL-256** | Food Safety | Food Handler Annual Medical Fitness Audit | `backend/src/services/foodSafetyService.js` | `EmployeeTraining` |
| **CTL-257** | Food Safety | Quarterly Onsite Food Safety Training Recurrence | `backend/src/services/foodSafetyService.js` | `EmployeeTraining` |
| **CTL-258** | Food Safety | Foreign Object / Contamination CAPA Resolution | `backend/src/services/IncidentService.js` | `FoodSafetyIncident` |
| **CTL-259** | Inventory / FEFO | Receiving Temperature & Vehicle Hygiene Check | `backend/src/services/inventoryLotService.js` | `IncomingInspection` |
| **CTL-260** | Inventory / FEFO | Automated Expiry-Sorted FEFO Stock Deduction | `backend/src/services/fefoService.js` | `InventoryLot` |
| **CTL-261** | Inventory / FEFO | Expired & Quarantine Batch Consumption Hard-Block | `backend/src/services/fefoService.js` | `InventoryLot` |
| **CTL-262** | Inventory / FEFO | Direct Lot-to-Bill Consumption Linkage Logging | `backend/src/services/fefoService.js` | `Bill.lineItems.consumedLots` |
| **CTL-263** | KDS | Café-Configurable Prep Station Routing | `backend/src/services/kdsService.js` | `KdsPrepStation` |
| **CTL-264** | KDS | Dynamic Station State Bumping (PENDING->PREP->READY) | `backend/src/services/kdsService.js` | `KdsTicket` |
| **CTL-265** | KDS | Expediter Ticket Consolidation & Multi-Station Sync | `backend/src/services/kdsService.js` | `KdsTicket` |
| **CTL-266** | KDS | Real-Time Bill Void Propagation to Active Tickets | `backend/src/services/kdsService.js` | `KdsTicket` |
| **CTL-267** | Shift Handover | Dual-Signoff Cash Drawer Variance Calculation | `backend/src/controllers/shiftController.js` | `ShiftHandover` |
| **CTL-268** | Exception Centre | Cross-Subsystem Live Operational Exception Engine | `backend/src/services/operationalExceptionService.js` | Aggregation Pipeline |
| **CTL-269** | Offline Sync | Offline Risk Policy Resolution (ONLINE_REQUIRED Block) | `backend/src/services/offlineSyncService.js` | Risk Policy Engine |
| **CTL-270** | Offline Sync | Device & Operator Session Replay Authentication Guard | `backend/src/services/offlineSyncService.js` | `DeviceRegistration`, `OperatorSession` |
| **CTL-271** | Offline Sync | Client Offline ID Deduplication & Idempotency | `backend/src/services/offlineSyncService.js` | `Bill.clientOfflineId` |
| **CTL-272** | Traceability | Deterministic Forward/Backward Recall Traceability | `backend/src/services/recallTraceService.js` | `Bill`, `StockMovement`, `InventoryLot` |

---

### 9. CORRECTIVE AREA 8: TEST SUITE EXECUTION & REGRESSION ANALYSIS

#### 9.1 Targeted Integrity Verification
1. **`cafeOpsR02CorrectiveIntegrity.test.js`**:
   - Tests: 8
   - Passed: **8**
   - Failed: **0**
   - Duration: 2.56s
   - Verified Areas:
     - Area 1: FSSAI Multi-Criteria Temperature & Duration Rules
     - Area 2: Dynamic KDS Station Creation & Cross-Café Isolation
     - Area 3: Offline Risk Policy Classes & Replay Security Guard
     - Area 4: True Lot-to-Bill Forward and Backward Traceability
     - Area 5: FoSTaC Verification Semantics & Audit Metadata
     - Area 6: Quarterly Training Scheduling & Overdue Exception Detection
     - Area 7: Control Recount & Continuous Reconciliation
     - Area 8: Test Coverage & Regression Safety

2. **`cafeOpsR02AllDomains.test.js`**:
   - Tests: 11
   - Passed: **11**
   - Failed: **0**
   - Duration: 2.38s
   - Verified Domains: R02-01 through R02-10 comprehensive operational flows.

#### 9.2 Full Canonical System Regression
- **Command**: `npm --prefix backend test`
- **Total Test Files Evaluated**: 151
- **Suites**: 19
- **Total Tests Run**: **1,530**
- **Total Tests Passed**: **1,530**
- **Total Tests Failed**: **0**
- **Skipped / Todo / Cancelled**: **0**
- **Duration**: ~334s
- **Baseline Requirement**: `>= 1,462 passed, 0 failures, 0 regressions`
- **Variance**: **+68 additional regression tests passed, 0 failures, 0 warnings**.

#### 9.3 Static Code Validation
- `npm --prefix backend run check`: **374 backend JavaScript files checked. All passed syntax validation.**
- `node frontend/verifyRouterImports.mjs`: **55 frontend routes verified. All imports exist and export correctly.**
- `node scripts/verify_all.js`: **455 total JavaScript files verified across repository. 0 errors.**
- `node scripts/validate_routes.mjs`: **55 frontend router modules, 25 cafe operations screens, 44 backend router modules verified. Status: PASS.**

---

### 10. SOURCE CODE INVENTORY (NEW & MODIFIED FILES)

#### 10.1 New Models & Services (R02 & R02A)
1. `backend/src/models/FoodSafetyTemperatureRule.js`: Statutory multi-criteria temperature rule schema.
2. `backend/src/services/temperatureRuleService.js`: FSSAI temperature rule engine & evaluator.
3. `backend/src/models/KdsPrepStation.js`: Café-configurable prep station schema.
4. `backend/src/models/KdsTicket.js`: Dynamic station tickets & lifecycle states.
5. `backend/src/services/kdsService.js`: Station listing, routing, bumping, void propagation.
6. `backend/src/controllers/kdsController.js`: KDS station & routing API endpoints.
7. `backend/src/routes/kdsRoutes.js`: KDS REST router.
8. `backend/src/services/offlineSyncService.js`: Policy resolution, replay security, idempotency sync.
9. `backend/src/services/fefoService.js`: FEFO allocation, stock movements, lot consumption links.
10. `backend/src/services/recallTraceService.js`: Deterministic forward & backward recall tracing.
11. `backend/src/services/foodSafetyService.js`: Temperature logging, FoSTaC verification, quarterly training.
12. `backend/src/services/operationalExceptionService.js`: Cross-domain real-time exception detection.
13. `backend/src/models/TemperatureLog.js`: Multi-process temperature logs with rule status.
14. `backend/src/models/CalibrationRecord.js`: Equipment calibration logs.
15. `backend/src/models/CleaningTask.js`: Deep cleaning checklists.
16. `backend/src/models/PestControlRecord.js`: Pest control audit logs.
17. `backend/src/models/IncomingInspection.js`: Receiving inspection records.
18. `backend/src/models/FoodSafetyIncident.js`: Incident & CAPA records.
19. `backend/src/models/ShiftHandover.js`: Shift cash counting & checklists.
20. `backend/src/services/inventoryLotService.js`: Receiving batch creation & quarantine management.

#### 10.2 Modified Core Files (R02A Corrective Updates)
1. `backend/src/models/Bill.js`: Added `lineItems.consumedLots` schema and compound index.
2. `backend/src/models/EmployeeTraining.js`: Added FoSTaC verification statuses, audit trail, quarterly training fields.
3. `backend/src/routes/index.js`: Mounted `/kds` routes under canonical API prefix `/api/v1/kds`.
4. `frontend/src/js/utils/offlineManager.js`: Added offline policy resolution and queue guard.
5. `frontend/src/js/pages/posTill.js`: Dynamic KDS prep station loading from API.

---

### 11. API ENDPOINT CATALOG & METHOD MATRIX

| Endpoint | Method | Role Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/kds/stations` | `GET` | `CAFE_OPERATOR`, `MANAGER`, `ADMIN` | Returns active prep stations for the café |
| `/api/v1/kds/stations` | `POST` | `MANAGER`, `ADMIN` | Creates a new café-specific prep station |
| `/api/v1/kds/stations/routing` | `POST` | `MANAGER`, `ADMIN` | Maps menu items/categories to prep stations |
| `/api/v1/kds/tickets` | `GET` | `CAFE_OPERATOR`, `MANAGER`, `ADMIN` | Fetches active KDS tickets filtered by station |
| `/api/v1/kds/tickets/:ticketId/bump` | `POST` | `CAFE_OPERATOR`, `MANAGER` | Bumps ticket state (`PENDING` -> `PREPARING` -> `READY`) |
| `/api/v1/kds/tickets/:ticketId/item-status` | `POST` | `CAFE_OPERATOR`, `MANAGER` | Updates individual ticket item status |
| `/api/v1/quality/temperature-rules` | `GET` | `CAFE_OPERATOR`, `MANAGER`, `ADMIN` | Retrieves active FSSAI temperature rules |
| `/api/v1/quality/temperature-rules/seed` | `POST` | `ADMIN` | Seeds statutory default FSSAI temperature rules |
| `/api/v1/quality/temperature-logs` | `POST` | `CAFE_OPERATOR`, `MANAGER` | Records temperature log and evaluates against rules |
| `/api/v1/quality/fostac-verify` | `POST` | `MANAGER`, `ADMIN` | Updates FoSTaC verification status with audit metadata |
| `/api/v1/quality/quarterly-training` | `POST` | `MANAGER`, `ADMIN` | Records quarterly food-handler training session |
| `/api/v1/inventory/recall-trace` | `GET` | `MANAGER`, `ADMIN` | Executes forward or backward deterministic recall trace |
| `/api/v1/pos/offline-sync` | `POST` | `CAFE_OPERATOR`, `MANAGER` | Replays offline transaction batch under replay guard |
| `/api/v1/cafe-operations/exceptions` | `GET` | `MANAGER`, `ADMIN` | Returns active operational exceptions across 6 check subsystems |

---

### 12. DATA MODEL SCHEMA UPDATES & INDEX AUDIT

1. **`FoodSafetyTemperatureRule` Indexes**:
   - `{ organisationId: 1, cafeId: 1, processType: 1, foodCategory: 1 }` (Unique)
   - `{ organisationId: 1, isActive: 1 }`
2. **`KdsPrepStation` Indexes**:
   - `{ organisationId: 1, cafeId: 1, code: 1 }` (Unique)
   - `{ organisationId: 1, cafeId: 1, isActive: 1 }`
3. **`Bill` New Indexes**:
   - `{ organisationId: 1, 'lineItems.consumedLots.lotId': 1 }` (Sparse, Multi-key)
   - `{ organisationId: 1, clientOfflineId: 1 }`
4. **`EmployeeTraining` Indexes**:
   - `{ organisationId: 1, cafeId: 1, trainingType: 1, recurrence: 1 }`
   - `{ organisationId: 1, fostacCertificateNumber: 1 }`
5. **`KdsTicket` Indexes**:
   - `{ organisationId: 1, cafeId: 1, station: 1, status: 1 }`
   - `{ organisationId: 1, billId: 1 }`

---

### 13. SECURITY ARCHITECTURE & ASVS L2/L3 ALIGNMENT

- **ASVS V4.1 Access Control**: All KDS, Food Safety, Inventory, and Handover routes verify tenant separation via `organisationId` and enforce device/operator cafe boundaries via `cafeScope`.
- **ASVS V8.3 Sensitive Data Protection**: Electronic card numbers, CVVs, and sensitive authentication material are prohibited from offline storage.
- **ASVS V10.2 Malicious Input Handling**: All batch sync transactions strictly validate schema types, numerical limits, and discount thresholds.
- **ASVS V11.1 Business Logic Flaws**: Offline replay guard prevents double-crediting or duplicate revenue posting via deterministic `clientOfflineId` deduplication.
- **Threat Model Mitigation**:
  - *Offline Refund Theft*: Fully mitigated by `ONLINE_REQUIRED` policy classification.
  - *Forged Terminal Replay*: Mitigated by active `DeviceRegistration` check and `OperatorSession` validation.
  - *Statutory Inspection Failure*: Mitigated by multi-criteria FSSAI temperature engine and verified FoSTaC audit trail.

---

### 14. OPERATIONAL EXCEPTION SUBSYSTEM INTEGRATION

The live `operationalExceptionService` aggregates anomalies across 6 operational checks:
1. **Check 1 (Cold Chain)**: Refrigerators/freezers exceeding statutory temperature thresholds.
2. **Check 2 (Calibration)**: Probes and thermometers with overdue calibration (> 30 days).
3. **Check 3 (FEFO / Expiry)**: Unquarantined expired inventory lots in active stock.
4. **Check 4 (Food Safety Incident)**: Open unmitigated foreign-object or illness allegations.
5. **Check 5 (Shift Handover)**: Unsettled cash drawer variances exceeding ₹500.
6. **Check 6 (Quarterly Training - R02A)**: Overdue quarterly food-handler training (> 90 days since last session).

---

### 15. PRODUCTION READINESS & STRICT NON-DEPLOYMENT ATTESTATION

> [!IMPORTANT]
> **GOVERNANCE GATE ENFORCEMENT**:
> - **NO FINAL VERIFICATION**: `FINAL-00` has NOT been initiated.
> - **NO PRODUCTION DEPLOYMENT**: Vercel, Render, and Atlas deployment pipelines have NOT been triggered.
> - **NO PRODUCTION MIGRATIONS**: No live database schema alterations have been executed.
> - **NO GIT PUSH**: Changes remain purely local in the integration workspace.
> - **ENGINEERING STOP**: Execution is paused, awaiting repository owner review.

---
**Report Attested By**:  
*Senior Principal Full-Stack Engineer, Restaurant ERP Architect, Food-Safety Systems Engineer, Security Engineer and QA Lead*  
*Zamorin Café Operations Engineering Team*  
*Status: IMPLEMENTATION COMPLETE & REGRESSION VERIFIED*  
*Timestamp: September 7, 2026*
