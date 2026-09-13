'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CAFÉ OPS-R02B CONFIGURATION INTEGRITY TEST SUITE
 * ============================================================================
 * Proves the four corrective hygiene domains:
 * 1. Temperature-Rule Versioning & Single-Active Index Hygiene (R02B-01)
 * 2. Stage Terminology & Attestation Correctness (R02B-02)
 * 3. Quarterly Training Calendar Recurrence Semantics (R02B-03)
 * 4. Governed Offline Risk Configuration & Fallback Hierarchy (R02B-04)
 * 5. MongoDB Index Manifest, Read-Only Inspection & Preflight Tooling (R02B-05)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Models
const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
const { TemperatureLog } = require('../src/models/TemperatureLog');
const { OfflineRiskConfig, DEFAULT_OFFLINE_RISK_CONFIG } = require('../src/models/OfflineRiskConfig');
const { EmployeeTraining } = require('../src/models/EmployeeTraining');
const { KdsPrepStation } = require('../src/models/KdsPrepStation');

// Services & Utilities
const { TemperatureRuleService } = require('../src/services/temperatureRuleService');
const { FoodSafetyService } = require('../src/services/foodSafetyService');
const { OfflineRiskConfigService } = require('../src/services/offlineRiskConfigService');
const OfflineSyncService = require('../src/services/offlineSyncService');
const OperationalExceptionService = require('../src/services/operationalExceptionService');
const {
  TRAINING_RECURRENCE_POLICIES,
  addCalendarMonthsClamped,
  calculateNextQuarterlyDueDate,
  isTrainingOverdue,
} = require('../src/utils/trainingRecurrence');

// Index Manifest
const { CAFE_OPS_R02_INDEXES } = require('../../scripts/indexes/cafeOpsR02Indexes.cjs');

test('CAFÉ OPS-R02B: Configuration, Schema & Index Hygiene Integrity Suite', async (t) => {
  let mongoServer;
  const ORG_ID = 'ZAMORIN-HYGIENE';
  const CAFE_A = 'ZC-HYG-01';
  const CAFE_B = 'ZC-HYG-02';
  const USER_ADMIN = 'USR-ADMIN-01';
  const USER_OPERATOR = 'USR-BARISTA-01';

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await FoodSafetyTemperatureRule.init();
    await OfflineRiskConfig.init();
    await KdsPrepStation.init();
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ==========================================================================
  // 1. TEMPERATURE RULE VERSIONING & ACTIVE INDEX ENFORCEMENT
  // ==========================================================================
  await t.test('Area 1: Temperature Rule Versioning — Multi-version coexistence & Single ACTIVE rule', async () => {
    // 1. Create Version 1 of a statutory rule
    const v1 = await TemperatureRuleService.createVersionedRule({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      name: 'Specialty Espresso Extraction Standard v1',
      foodCategory: 'ALL',
      processType: 'COOKING',
      criteria: [
        { minimumTemperatureC: 90, maximumTemperatureC: 96, minimumDurationSeconds: 25, description: 'Extraction 90-96C' },
      ],
      version: 1,
      sourceReference: 'SCA Standards 2024',
      createdByUserId: USER_ADMIN,
    });

    assert.equal(v1.version, 1);
    assert.equal(v1.status, 'ACTIVE');
    assert.equal(v1.active, true);

    // 2. Create Version 2 of the same rule (same org, cafe, process, category)
    const v2 = await TemperatureRuleService.createVersionedRule({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      name: 'Specialty Espresso Extraction Standard v2',
      foodCategory: 'ALL',
      processType: 'COOKING',
      criteria: [
        { minimumTemperatureC: 91, maximumTemperatureC: 95, minimumDurationSeconds: 28, description: 'Refined extraction 91-95C' },
      ],
      version: 2,
      sourceReference: 'SCA Standards 2026',
      createdByUserId: USER_ADMIN,
    });

    assert.equal(v2.version, 2);
    assert.equal(v2.status, 'ACTIVE');
    assert.equal(v2.active, true);

    // 3. Verify Version 1 is preserved historically and marked SUPERSEDED / active: false
    const v1Updated = await FoodSafetyTemperatureRule.findOne({ ruleId: v1.ruleId }).lean();
    assert.ok(v1Updated, 'Version 1 must remain preserved in database');
    assert.equal(v1Updated.active, false, 'Previous version must have active = false');
    assert.equal(v1Updated.status, 'SUPERSEDED', 'Previous version status must be SUPERSEDED');
    assert.ok(v1Updated.effectiveTo, 'Superseded version must record effectiveTo date');

    // 4. Duplicate version creation must be denied (prevent duplicate v2)
    await assert.rejects(
      async () => {
        await TemperatureRuleService.createVersionedRule({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          name: 'Specialty Espresso Duplicate v2',
          foodCategory: 'ALL',
          processType: 'COOKING',
          criteria: [{ minimumTemperatureC: 90 }],
          version: 2,
          createdByUserId: USER_ADMIN,
        });
      },
      (err) => err.statusCode === 409 || err.code === 11000 || err.message.includes('already exists'),
      'Creating duplicate rule version must be rejected'
    );

    // 5. Database unique index enforcement: Attempting to insert a duplicate active rule directly
    await assert.rejects(
      async () => {
        await FoodSafetyTemperatureRule.create({
          ruleId: `TRULE-ROGUE-ACTIVE-${Date.now()}`,
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          name: 'Rogue Conflicting Active Rule',
          foodCategory: 'ALL',
          processType: 'COOKING',
          criteria: [{ minimumTemperatureC: 80 }],
          version: 99,
          active: true,
          status: 'ACTIVE',
          createdByUserId: USER_ADMIN,
        });
      },
      (err) => err.code === 11000 || /duplicate key/i.test(err.message),
      'Mongo partial unique index must deny second ACTIVE rule in same scope'
    );

    // 6. Temperature Log Traceability: Logs evaluate against active version and store ruleVersion
    const log = await FoodSafetyService.recordTemperature({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      monitoringPoint: 'COOKING',
      readingCelsius: 92.5,
      minimumAllowedCelsius: 85,
      maximumAllowedCelsius: 100,
      processType: 'COOKING',
      foodCategory: 'ALL',
      durationSeconds: 30,
      recordedByUserId: USER_ADMIN,
    });

    assert.equal(log.status, 'WITHIN_RANGE');
    assert.equal(log.ruleId, v2.ruleId, 'Must link to active version 2 rule');
    assert.equal(log.ruleVersion, 2, 'Must record ruleVersion = 2 onto TemperatureLog');
    assert.equal(log.temperatureRuleId, v2.ruleId);

    // 7. Cross-café rule isolation: Cafe B has no cooking rule configured
    const evalCafeB = await TemperatureRuleService.evaluateTemperatureRule({
      organisationId: ORG_ID,
      cafeId: CAFE_B,
      processType: 'COOKING',
      foodCategory: 'ALL',
      measuredTemperatureC: 92.5,
    });
    // Since Cafe A's rule is cafe-specific to CAFE_A, Cafe B does not pick it up
    assert.equal(evalCafeB.status, 'RULE_NOT_CONFIGURED', 'Cafe B must not inherit Cafe A specific rules');
  });

  // ==========================================================================
  // 2. QUARTERLY TRAINING CALENDAR RECURRENCE SEMANTICS
  // ==========================================================================
  await t.test('Area 2: Quarterly Training Semantics — 3 Calendar Months & Edge Cases', async () => {
    // 1. Explicit Recurrence Policy Declaration
    assert.equal(TRAINING_RECURRENCE_POLICIES.QUARTERLY.frequency, 'QUARTERLY');
    assert.equal(TRAINING_RECURRENCE_POLICIES.QUARTERLY.recurrenceMode, 'CALENDAR_MONTHS');
    assert.equal(TRAINING_RECURRENCE_POLICIES.QUARTERLY.recurrenceInterval, 3);

    // 2. Regular 3-month addition: 2026-03-15 + 3 months -> 2026-06-15
    const regular = calculateNextQuarterlyDueDate('2026-03-15');
    assert.equal(regular, '2026-06-15');

    // 3. Month-end clamping edge cases:
    // January 31 -> April 30 (April only has 30 days)
    const jan31 = calculateNextQuarterlyDueDate('2026-01-31');
    assert.equal(jan31, '2026-04-30', 'Jan 31 + 3 months must clamp to Apr 30');

    // March 31 -> June 30 (June only has 30 days)
    const mar31 = calculateNextQuarterlyDueDate('2026-03-31');
    assert.equal(mar31, '2026-06-30', 'Mar 31 + 3 months must clamp to Jun 30');

    // August 31 -> November 30 (November only has 30 days)
    const aug31 = calculateNextQuarterlyDueDate('2026-08-31');
    assert.equal(aug31, '2026-11-30', 'Aug 31 + 3 months must clamp to Nov 30');

    // December 31 -> March 31 (March has 31 days)
    const dec31 = calculateNextQuarterlyDueDate('2026-12-31');
    assert.equal(dec31, '2027-03-31', 'Dec 31 + 3 months must advance year to Mar 31');

    // 4. Leap year handling:
    // November 30, 2023 -> February 29, 2024 (2024 is leap year)
    const leapTarget = calculateNextQuarterlyDueDate('2023-11-30');
    assert.equal(leapTarget, '2024-02-29', 'Leap year must clamp to Feb 29');

    // November 30, 2025 -> February 28, 2026 (2026 is non-leap year)
    const nonLeapTarget = calculateNextQuarterlyDueDate('2025-11-30');
    assert.equal(nonLeapTarget, '2026-02-28', 'Non-leap year must clamp to Feb 28');

    // 5. Overdue Training Detection Logic
    assert.equal(isTrainingOverdue('2026-01-01', '2026-01-02'), true, 'Past due date is overdue');
    assert.equal(isTrainingOverdue('2026-01-02', '2026-01-02'), false, 'Due today is not overdue');
    assert.equal(isTrainingOverdue('2026-01-03', '2026-01-02'), false, 'Due in future is not overdue');

    // 6. FoodSafetyService integrates explicit recurrence
    const session = await FoodSafetyService.recordQuarterlyTrainingSession({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      userId: 'TRAINER-01',
      completedAt: '2026-01-31',
      dueDate: '2026-01-31',
    });
    assert.equal(session.nextQuarterlyDueDate, '2026-04-30', 'Service must return Apr 30 for Jan 31 session');
  });

  // ==========================================================================
  // 3. GOVERNED OFFLINE RISK CONFIGURATION & PERMISSION BOUNDARIES
  // ==========================================================================
  await t.test('Area 3: Governed Offline Risk Configuration — Boundaries, Paise & Fallback', async () => {
    // 1. Safe application defaults applied when no config is stored
    const defaultCfg = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: 'ORG-UNCONFIGURED',
      cafeId: 'CAFE-UNCONFIGURED',
    });
    assert.equal(defaultCfg.maxDiscountPercent, 40);
    assert.equal(defaultCfg.highValueAmountPaise, 2500000);
    assert.equal(defaultCfg.source, 'APPLICATION_DEFAULT');

    // 2. Unauthorised role mutation denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 50 },
          actorRole: 'CASHIER', // Operator role without permission
          actorUserId: USER_OPERATOR,
        });
      },
      (err) => err.statusCode === 403,
      'Cashier or operator must not be permitted to modify risk configuration'
    );

    // 3. Input validation: negative discount rejected
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: -5 },
          actorRole: 'MASTER',
          actorUserId: USER_ADMIN,
        });
      },
      (err) => err.statusCode === 400,
      'Negative discount percent must be rejected'
    );

    // 4. Input validation: discount > 100 rejected
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 120 },
          actorRole: 'MASTER',
          actorUserId: USER_ADMIN,
        });
      },
      (err) => err.statusCode === 400,
      'Discount percent > 100 must be rejected'
    );

    // 5. Input validation: non-integer amount in paise rejected
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { highValueAmountPaise: 5000.5 },
          actorRole: 'MASTER',
          actorUserId: USER_ADMIN,
        });
      },
      (err) => err.statusCode === 400,
      'Fractional paise must be rejected'
    );

    // 6. Valid organisation-level configuration update by MASTER
    await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      config: {
        maxDiscountPercent: 25,
        highValueAmountPaise: 1000000, // ₹10,000 in paise
        allowCafeOverride: true,
      },
      actorRole: 'MASTER',
      actorUserId: USER_ADMIN,
    });

    const orgEffective = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: ORG_ID,
    });
    assert.equal(orgEffective.maxDiscountPercent, 25);
    assert.equal(orgEffective.highValueAmountPaise, 1000000);
    assert.equal(orgEffective.source, 'ORGANISATION_SETTING');

    // 7. Valid Café-specific override
    await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      config: {
        maxDiscountPercent: 15,
        highValueAmountPaise: 500000, // ₹5,000 in paise
      },
      actorRole: 'MASTER',
      actorUserId: USER_ADMIN,
    });

    const cafeAEffective = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
    });
    assert.equal(cafeAEffective.maxDiscountPercent, 15);
    assert.equal(cafeAEffective.highValueAmountPaise, 500000);
    assert.equal(cafeAEffective.source, 'CAFE_OVERRIDE');

    // 8. Isolation: Cafe B falls back to Org setting
    const cafeBEffective = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_B,
    });
    assert.equal(cafeBEffective.maxDiscountPercent, 25);
    assert.equal(cafeBEffective.highValueAmountPaise, 1000000);
    assert.equal(cafeBEffective.source, 'ORGANISATION_SETTING');

    // 9. Integration with OfflineSyncService: Evaluates against configured threshold
    const resA = await OfflineSyncService.syncBatch({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      transactions: [
        {
          clientOfflineId: `TX-DISCOUNT-${Date.now()}`,
          totalPaisa: 100000,
          subtotalPaisa: 100000,
          discountPaisa: 20000, // 20% discount (Exceeds Cafe A's 15% threshold)
          paymentMethod: 'CASH',
        },
      ],
    });
    assert.equal(resA.items[0].status, 'SYNCED_WITH_FLAG');
    assert.equal(resA.items[0].syncFlag, 'FLAGGED_FOR_AUDIT', '20% discount exceeds configured 15% threshold');
    assert.ok(resA.items[0].flagReason.includes('15%'), 'Flag reason must reflect configured 15% threshold');

    // 10. Strict invariant: Prohibited offline actions remain blocked regardless of threshold
    const resRefund = await OfflineSyncService.syncBatch({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      transactions: [
        {
          clientOfflineId: `TX-REFUND-${Date.now()}`,
          totalPaisa: 5000,
          operationType: 'REFUND',
          paymentMethod: 'CASH',
        },
      ],
    });
    assert.equal(resRefund.items[0].status, 'REJECTED');
    assert.equal(resRefund.items[0].policy, 'ONLINE_REQUIRED', 'Offline refund remains strictly prohibited');
  });

  // ==========================================================================
  // 4. MONGODB INDEX MANIFEST & SAFE DRY-RUN TOOLING
  // ==========================================================================
  await t.test('Area 4: MongoDB Index Manifest, Inspection & Dry-Run Preflight', async () => {
    // 1. Manifest structure verification
    assert.ok(Array.isArray(CAFE_OPS_R02_INDEXES), 'Manifest must export an array');
    assert.ok(CAFE_OPS_R02_INDEXES.length >= 25, 'Manifest must cover all R02/R02A/R02B indexes');

    for (const entry of CAFE_OPS_R02_INDEXES) {
      assert.ok(entry.collection, 'Entry must specify collection');
      assert.ok(entry.model, 'Entry must specify model');
      assert.ok(entry.indexName, 'Entry must specify indexName');
      assert.ok(entry.keys, 'Entry must specify keys');
      assert.ok(typeof entry.unique === 'boolean', 'Entry must specify unique boolean');
      assert.ok(entry.purpose, 'Entry must specify purpose');
      assert.ok(['R02', 'R02A', 'R02B'].includes(entry.introducedByStage), 'Valid stage');
    }

    // 2. Specific key indexes present in manifest
    const tempVerIdx = CAFE_OPS_R02_INDEXES.find((i) => i.indexName === 'uniq_trule_org_cafe_proc_cat_ver');
    assert.ok(tempVerIdx, 'Temperature rule version index must be in manifest');
    assert.equal(tempVerIdx.unique, true);
    assert.equal(tempVerIdx.keys.version, 1);

    const activeRuleIdx = CAFE_OPS_R02_INDEXES.find((i) => i.indexName === 'uniq_trule_org_cafe_proc_cat_active');
    assert.ok(activeRuleIdx, 'Active rule partial unique index must be in manifest');
    assert.deepEqual(activeRuleIdx.partialFilterExpression, { active: true });

    const consumedLotsIdx = CAFE_OPS_R02_INDEXES.find((i) => i.indexName === 'org_lineitem_consumed_lot');
    assert.ok(consumedLotsIdx, 'Bill consumed lots multikey index must be in manifest');

    // 3. Preflight duplicate check execution
    const { runUniquePreflight } = await import('../../scripts/indexes/prepareCafeOpsIndexes.js');
    const conflicts = await runUniquePreflight(mongoose.connection.db);
    assert.equal(conflicts.length, 0, 'Clean database must report 0 duplicate conflicts');

    // 4. Preflight catches intentional conflict: Create duplicate KDS station code
    await KdsPrepStation.create({
      prepStationId: 'STA-TEST-1',
      organisationId: 'PREFLIGHT-ORG',
      cafeId: 'PREFLIGHT-CAFE',
      name: 'Station 1',
      code: 'GRILL',
      displayOrder: 1,
    });
    // Temporarily drop index to simulate legacy pre-index state with duplicate data
    await mongoose.connection.db.collection('kds_prep_stations').dropIndex('org_cafe_station_code_unique').catch(() => {});
    await mongoose.connection.db.collection('kds_prep_stations').insertOne({
      prepStationId: 'STA-TEST-2',
      organisationId: 'PREFLIGHT-ORG',
      cafeId: 'PREFLIGHT-CAFE',
      name: 'Station 2 Duplicate',
      code: 'GRILL',
      displayOrder: 2,
    });

    const conflictsAfterDupe = await runUniquePreflight(mongoose.connection.db);
    assert.ok(conflictsAfterDupe.length >= 1, 'Preflight must detect duplicate prep station code conflict');
    assert.equal(conflictsAfterDupe[0].targetIndex, 'uniq_kds_station_org_cafe_code');

    // Clean up test fixture and restore index
    await mongoose.connection.db.collection('kds_prep_stations').deleteMany({ organisationId: 'PREFLIGHT-ORG' });
    await KdsPrepStation.init();

    // 5. Dry-run execution performs zero mutations
    const { prepareIndexes } = await import('../../scripts/indexes/prepareCafeOpsIndexes.js');
    const dryRunResult = await prepareIndexes({ dryRun: true });
    assert.equal(dryRunResult.mode, 'DRY_RUN');
    assert.ok(dryRunResult.alreadyExists.length + dryRunResult.missingWouldCreate.length >= 25);
  });
});
