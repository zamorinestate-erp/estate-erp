'use strict';

/**
 * ============================================================================
 * CAFÉ OPS-R02C: AUTHORIZATION CANONICALIZATION, SINGLE-SOURCE INDEX MANIFEST
 * & ACTIVE-RULE SEMANTICS INTEGRITY TEST SUITE
 * ============================================================================
 * Covers:
 * 1. Canonical role discovery & strict rejection of invented role strings
 * 2. Offline risk write authorization (RBAC, scope, non-weakening policy)
 * 3. Offline risk read authorization (hierarchical fallback, cross-org/cafe isolation)
 * 4. Single-source index manifest, drift impossibility, and 30-index/11-collection audit
 * 5. Partial unique index AT MOST ONE active rule guarantee & safe missing-rule handling
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('node:fs');
const path = require('node:path');

// Models
const { User } = require('../src/models/User');
const { RolePermission } = require('../src/models/RolePermission');
const { FoodSafetyTemperatureRule } = require('../src/models/FoodSafetyTemperatureRule');
const { TemperatureLog } = require('../src/models/TemperatureLog');
const { OfflineRiskConfig } = require('../src/models/OfflineRiskConfig');
const { DEFAULT_PERMISSION_RULES } = require('../src/scripts/seedInitialData');

// Services & Utilities
const {
  OfflineRiskConfigService,
  OFFLINE_RISK_PERMISSIONS,
  CANONICAL_ROLES,
} = require('../src/services/offlineRiskConfigService');
const { TemperatureRuleService } = require('../src/services/temperatureRuleService');
const { FoodSafetyService } = require('../src/services/foodSafetyService');
const OperationalExceptionService = require('../src/services/operationalExceptionService');

// Index Manifests
const jsonPath = path.resolve(__dirname, '../../config/cafeOpsR02Indexes.json');
const canonicalJsonManifest = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { CAFE_OPS_R02_INDEXES: cjsManifest } = require('../../scripts/indexes/cafeOpsR02Indexes.cjs');

test('CAFÉ OPS-R02C: Authorization Canonicalization, Single-Source Manifest & Rule Semantics Suite', async (t) => {
  let mongoServer;
  const ORG_ID = 'ZAMORIN-CORP';
  const OTHER_ORG = 'COMPETITOR-CORP';
  const CAFE_A = 'ZC-CALICUT-01';
  const CAFE_B = 'ZC-COCHIN-01';

  const ACTOR_MASTER = {
    userId: 'USR-MASTER-01',
    organisationId: ORG_ID,
    role: 'MASTER',
    permissions: [OFFLINE_RISK_PERMISSIONS.READ, OFFLINE_RISK_PERMISSIONS.WRITE],
  };

  const ACTOR_CAFE_ADMIN = {
    userId: 'USR-CAFEADMIN-01',
    organisationId: ORG_ID,
    role: 'CAFE_ADMIN',
    assignedCafeIds: [CAFE_A],
    permissions: [OFFLINE_RISK_PERMISSIONS.READ, OFFLINE_RISK_PERMISSIONS.WRITE],
  };

  const ACTOR_STAFF = {
    userId: 'USR-STAFF-01',
    organisationId: ORG_ID,
    role: 'STAFF',
    assignedCafeIds: [CAFE_A],
    permissions: [OFFLINE_RISK_PERMISSIONS.READ],
  };

  const ACTOR_OWNER = {
    userId: 'USR-OWNER-01',
    organisationId: ORG_ID,
    role: 'OWNER',
    permissions: [OFFLINE_RISK_PERMISSIONS.READ],
  };

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await FoodSafetyTemperatureRule.init();
    await OfflineRiskConfig.init();
    await TemperatureLog.init();
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ==========================================================================
  // 1. CANONICAL ROLE DISCOVERY & INVENTED ROLE REJECTION
  // ==========================================================================
  await t.test('Area 1: Canonical Role Registry & Invented Role Audit', async () => {
    // 1.1 Verify canonical roles defined in User and RolePermission schemas
    const userRoleEnums = User.schema.paths.role.enumValues;
    const rolePermissionRoleEnums = RolePermission.schema.paths.role.enumValues;

    assert.deepEqual(
      userRoleEnums.slice().sort(),
      ['CAFE_ADMIN', 'MASTER', 'OWNER', 'STAFF'].sort(),
      'User schema enum must contain exactly the 4 canonical roles'
    );
    assert.deepEqual(
      rolePermissionRoleEnums.slice().sort(),
      ['CAFE_ADMIN', 'MASTER', 'OWNER', 'STAFF'].sort(),
      'RolePermission schema enum must contain exactly the 4 canonical roles'
    );
    assert.deepEqual(
      CANONICAL_ROLES.slice().sort(),
      ['CAFE_ADMIN', 'MASTER', 'OWNER', 'STAFF'].sort(),
      'OfflineRiskConfigService must recognize only the 4 canonical roles'
    );

    // 1.2 Verify invented roles from R02B are strictly rejected
    const inventedRoles = [
      'ADMIN',
      'ORG_ADMIN',
      'COMPANY_ADMIN',
      'FINANCE_DIRECTOR',
      'SUPER_ADMIN',
      'UNKNOWN_ROLE',
      'CASHIER',
      'BARISTA',
    ];

    for (const invRole of inventedRoles) {
      await assert.rejects(
        async () => {
          await OfflineRiskConfigService.updateRiskConfig({
            organisationId: ORG_ID,
            config: { maxDiscountPercent: 20 },
            actorRole: invRole,
            actorUserId: 'USR-TEST',
          });
        },
        (err) => err.statusCode === 403 && err.message.includes('not a recognized canonical role'),
        `Invented or non-canonical role '${invRole}' must be strictly rejected with HTTP 403`
      );
    }
  });

  // ==========================================================================
  // 2. OFFLINE RISK CONFIGURATION WRITE AUTHORIZATION
  // ==========================================================================
  await t.test('Area 2: Offline Risk Configuration Write Authorization & Scope Policy', async () => {
    // 2.1 Cross-organisation write denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 20 },
          actor: { ...ACTOR_MASTER, organisationId: OTHER_ORG },
        });
      },
      (err) => err.statusCode === 403 && err.code === 'CROSS_ORGANISATION_ACCESS_DENIED',
      'Cross-organisation risk configuration write must be denied with HTTP 403'
    );

    // 2.2 STAFF denied write by default
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 20 },
          actor: ACTOR_STAFF,
        });
      },
      (err) => err.statusCode === 403 && err.code === 'FORBIDDEN_RISK_CONFIG',
      'STAFF must be denied risk configuration write with HTTP 403'
    );

    // 2.3 OWNER without explicit write permission denied write
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 20 },
          actor: ACTOR_OWNER,
        });
      },
      (err) => err.statusCode === 403 && (err.code === 'FORBIDDEN_RISK_CONFIG' || err.code === 'PERMISSION_DENIED'),
      'OWNER without explicit write permission must be denied write with HTTP 403'
    );

    // 2.4 Tampered permission array (missing OFFLINE_RISK_CONFIG_WRITE) denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          config: { maxDiscountPercent: 20 },
          actor: {
            ...ACTOR_MASTER,
            permissions: [OFFLINE_RISK_PERMISSIONS.READ], // lacks WRITE
          },
        });
      },
      (err) => err.statusCode === 403 && err.code === 'PERMISSION_DENIED',
      'Missing OFFLINE_RISK_CONFIG_WRITE permission must be rejected with HTTP 403'
    );

    // 2.5 CAFE_ADMIN cannot modify organisation-wide policy (cafeId: null)
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          cafeId: null,
          config: { maxDiscountPercent: 20 },
          actor: ACTOR_CAFE_ADMIN,
        });
      },
      (err) => err.statusCode === 403 && err.code === 'FORBIDDEN_ORGANISATION_SCOPE',
      'CAFE_ADMIN must not configure organisation-wide risk defaults'
    );

    // 2.6 CAFE_ADMIN cannot modify unassigned café (CAFE_B)
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_B,
          config: { maxDiscountPercent: 20 },
          actor: ACTOR_CAFE_ADMIN, // assigned to CAFE_A only
        });
      },
      (err) => err.statusCode === 403 && err.code === 'CROSS_CAFE_ACCESS_DENIED',
      'CAFE_ADMIN must not modify risk config for an unassigned cafe'
    );

    // 2.7 MASTER successfully configures organisation default
    const orgSaved = await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      config: {
        maxDiscountPercent: 30,
        highValueAmountPaise: 2000000, // ₹20,000 in paise
        allowCafeOverride: true,
      },
      actor: ACTOR_MASTER,
    });
    assert.equal(orgSaved.maxDiscountPercent, 30);
    assert.equal(orgSaved.highValueAmountPaise, 2000000);
    assert.equal(orgSaved.allowCafeOverride, true);

    // 2.8 CAFE_ADMIN cannot relax/weaken organisation policy (discount > org limit)
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          config: { maxDiscountPercent: 40 }, // Org max is 30%
          actor: ACTOR_CAFE_ADMIN,
        });
      },
      (err) => err.statusCode === 400 && err.code === 'CANNOT_WEAKEN_RISK_POLICY',
      'Café Admin cannot exceed enterprise discount threshold'
    );

    // 2.9 CAFE_ADMIN cannot relax/weaken organisation policy (paise > org limit)
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          config: { highValueAmountPaise: 3000000 }, // Org max is 2,000,000 paise
          actor: ACTOR_CAFE_ADMIN,
        });
      },
      (err) => err.statusCode === 400 && err.code === 'CANNOT_WEAKEN_RISK_POLICY',
      'Café Admin cannot exceed enterprise high-value amount threshold'
    );

    // 2.10 CAFE_ADMIN successfully sets stricter café override within org bounds
    const cafeSaved = await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      config: {
        maxDiscountPercent: 20, // Stricter than 30%
        highValueAmountPaise: 1000000, // Stricter than 2,000,000 paise
      },
      actor: ACTOR_CAFE_ADMIN,
    });
    assert.equal(cafeSaved.maxDiscountPercent, 20);
    assert.equal(cafeSaved.highValueAmountPaise, 1000000);

    // 2.11 If Organisation disables cafe overrides, CAFE_ADMIN update is disallowed
    await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      config: { allowCafeOverride: false },
      actor: ACTOR_MASTER,
    });

    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.updateRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          config: { maxDiscountPercent: 15 },
          actor: ACTOR_CAFE_ADMIN,
        });
      },
      (err) => err.statusCode === 403 && err.code === 'CAFE_OVERRIDE_DISALLOWED',
      'Café Admin cannot override risk thresholds when organisation disallows it'
    );

    // Re-enable for subsequent tests
    await OfflineRiskConfigService.updateRiskConfig({
      organisationId: ORG_ID,
      config: { allowCafeOverride: true },
      actor: ACTOR_MASTER,
    });
  });

  // ==========================================================================
  // 3. OFFLINE RISK CONFIGURATION READ AUTHORIZATION & FALLBACK HIERARCHY
  // ==========================================================================
  await t.test('Area 3: Offline Risk Configuration Read Authorization & Fallback', async () => {
    // 3.1 Authorized read with fallback to cafe override
    const cafeRead = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_A,
      actor: ACTOR_CAFE_ADMIN,
    });
    assert.equal(cafeRead.maxDiscountPercent, 20);
    assert.equal(cafeRead.highValueAmountPaise, 1000000);
    assert.equal(cafeRead.source, 'CAFE_OVERRIDE');

    // 3.2 Cafe B (no override) falls back to Organisation setting
    const cafeBRead = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: ORG_ID,
      cafeId: CAFE_B,
      actor: ACTOR_MASTER,
    });
    assert.equal(cafeBRead.maxDiscountPercent, 30);
    assert.equal(cafeBRead.highValueAmountPaise, 2000000);
    assert.equal(cafeBRead.source, 'ORGANISATION_SETTING');

    // 3.3 Unconfigured organisation falls back to APPLICATION_DEFAULT
    const unconfigRead = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: 'ORG-BLANK-NEW',
      cafeId: 'CAFE-X',
    });
    assert.equal(unconfigRead.maxDiscountPercent, 40);
    assert.equal(unconfigRead.highValueAmountPaise, 2500000);
    assert.equal(unconfigRead.source, 'APPLICATION_DEFAULT');

    // 3.4 Cross-organisation read denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.getEffectiveRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          actor: { ...ACTOR_STAFF, organisationId: OTHER_ORG },
        });
      },
      (err) => err.statusCode === 403 && err.code === 'CROSS_ORGANISATION_ACCESS_DENIED',
      'Cross-organisation read must be denied with HTTP 403'
    );

    // 3.5 Cross-cafe read for unassigned cafe by CAFE_ADMIN denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.getEffectiveRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_B,
          actor: ACTOR_CAFE_ADMIN, // assigned only to CAFE_A
        });
      },
      (err) => err.statusCode === 403 && err.code === 'CROSS_CAFE_ACCESS_DENIED',
      'CAFE_ADMIN cannot read risk config for unassigned cafe'
    );

    // 3.6 Unknown role on read denied
    await assert.rejects(
      async () => {
        await OfflineRiskConfigService.getEffectiveRiskConfig({
          organisationId: ORG_ID,
          cafeId: CAFE_A,
          actor: { organisationId: ORG_ID, role: 'INVENTED_ROLE' },
        });
      },
      (err) => err.statusCode === 403 && err.code === 'FORBIDDEN_RISK_CONFIG',
      'Invented role on read path must be rejected with HTTP 403'
    );
  });

  // ==========================================================================
  // 4. SINGLE CANONICAL INDEX MANIFEST & DRIFT IMPOSSIBILITY
  // ==========================================================================
  await t.test('Area 4: Single-Source Index Manifest, Drift Prevention & Collection Count', async () => {
    // 4.1 Verify CJS loader and canonical JSON manifest have exact deep equality
    assert.deepEqual(
      cjsManifest,
      canonicalJsonManifest,
      'CJS manifest and config/cafeOpsR02Indexes.json must have exact deep equality (Zero drift)'
    );

    // 4.2 Verify index count is exactly 30
    assert.equal(canonicalJsonManifest.length, 30, 'Canonical index manifest must contain exactly 30 indexes');

    // 4.3 Verify collection count is exactly 11 distinct collections
    const collections = new Set(canonicalJsonManifest.map((idx) => idx.collection));
    assert.equal(collections.size, 11, 'Canonical index manifest must span exactly 11 distinct collections');

    const expectedCollections = [
      'foodsafetytemperaturerules',
      'temperaturelogs',
      'kds_prep_stations',
      'kdstickets',
      'inventorylots',
      'bills',
      'employeetrainings',
      'incominginspections',
      'foodsafetyincidents',
      'shifthandovers',
      'offlineriskconfigs',
    ];
    for (const col of expectedCollections) {
      assert.ok(collections.has(col), `Manifest must include collection '${col}'`);
    }

    // 4.4 Verify active temperature rule index purpose statement semantics
    const activeRuleIdx = canonicalJsonManifest.find(
      (idx) => idx.indexName === 'uniq_trule_org_cafe_proc_cat_active'
    );
    assert.ok(activeRuleIdx, 'uniq_trule_org_cafe_proc_cat_active must be present in manifest');
    assert.ok(
      activeRuleIdx.purpose.includes('at most one active rule') ||
      activeRuleIdx.purpose.includes('preventing more than one ACTIVE rule'),
      'Index purpose must accurately state AT MOST ONE active rule guarantee'
    );

    // 4.5 Verify DEFAULT_PERMISSION_RULES contains canonical offline risk permissions
    const readRules = DEFAULT_PERMISSION_RULES.filter(
      (r) => r.permissionCode === OFFLINE_RISK_PERMISSIONS.READ
    );
    const writeRules = DEFAULT_PERMISSION_RULES.filter(
      (r) => r.permissionCode === OFFLINE_RISK_PERMISSIONS.WRITE
    );
    assert.ok(readRules.length >= 4, 'Must seed OFFLINE_RISK_CONFIG_READ for all canonical roles');
    assert.ok(writeRules.length >= 2, 'Must seed OFFLINE_RISK_CONFIG_WRITE for MASTER and CAFE_ADMIN');
    for (const r of [...readRules, ...writeRules]) {
      assert.ok(
        CANONICAL_ROLES.includes(r.role),
        `Permission seed rule role '${r.role}' must be a canonical role`
      );
    }
  });

  // ==========================================================================
  // 5. ACTIVE TEMPERATURE RULE SEMANTICS & MISSING-RULE BEHAVIOUR
  // ==========================================================================
  await t.test('Area 5: Active Temperature Rule Semantics & Missing-Rule Safety', async () => {
    const TEST_ORG = 'ORG-RULE-SEMANTICS';
    const TEST_CAFE = 'CAFE-SEMANTICS-01';

    // 5.1 When zero active rules exist, evaluateTemperatureRule must return RULE_NOT_CONFIGURED safely
    const unconfiguredResult = await TemperatureRuleService.evaluateTemperatureRule({
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
      processType: 'COOKING',
      foodCategory: 'VEGETARIAN',
      measuredTemperatureC: 85,
      durationSeconds: 60,
    });
    assert.equal(unconfiguredResult.status, 'RULE_NOT_CONFIGURED');
    assert.equal(unconfiguredResult.reason, 'RULE_NOT_CONFIGURED');
    assert.equal(unconfiguredResult.matchedRuleId, null);
    assert.equal(unconfiguredResult.ruleVersion, null);

    // 5.2 FoodSafetyService logs unconfigured rule as an excursion and out of range (never assumed compliant)
    const logResult = await FoodSafetyService.recordTemperature({
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
      monitoringPoint: 'COOKING',
      readingCelsius: 85,
      processType: 'COOKING',
      foodCategory: 'VEGETARIAN',
      durationSeconds: 60,
      recordedByUserId: 'USR-CHEF-01',
    });
    assert.equal(logResult.isExcursion, true, 'Unconfigured rule reading must be marked as excursion');
    assert.equal(logResult.status, 'OUT_OF_RANGE', 'Unconfigured rule reading must be marked OUT_OF_RANGE');
    assert.equal(logResult.ruleEvaluationStatus, 'RULE_NOT_CONFIGURED');

    // 5.3 OperationalExceptionService flags it as an operational exception
    const res = await OperationalExceptionService.getCafeExceptions({
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
    });
    const tempExcs = res.exceptions.filter((e) => e.category === 'TEMPERATURE_EXCURSION');
    assert.ok(tempExcs.length > 0, 'Excursion from unconfigured rule must appear in operational exceptions');

    // 5.4 Database partial unique index guarantees AT MOST ONE active rule per scope:
    // Create one active rule
    const rule1 = await FoodSafetyTemperatureRule.create({
      ruleId: `TRULE-TEST-01-${Date.now()}`,
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
      name: 'Standard Cooking v1',
      processType: 'COOKING',
      foodCategory: 'VEGETARIAN',
      criteria: [{ minimumTemperatureC: 75, minimumDurationSeconds: 15 }],
      version: 1,
      active: true,
      status: 'ACTIVE',
      createdByUserId: 'USR-MASTER',
    });
    assert.ok(rule1, 'First active rule must succeed');

    // Inserting a second active rule for the exact same scope must be rejected by the database partial unique index
    await assert.rejects(
      async () => {
        await FoodSafetyTemperatureRule.create({
          ruleId: `TRULE-TEST-02-${Date.now()}`,
          organisationId: TEST_ORG,
          cafeId: TEST_CAFE,
          name: 'Conflicting Cooking v2 Active Rule',
          processType: 'COOKING',
          foodCategory: 'VEGETARIAN',
          criteria: [{ minimumTemperatureC: 70 }],
          version: 2,
          active: true,
          status: 'ACTIVE',
          createdByUserId: 'USR-MASTER',
        });
      },
      (err) => err.code === 11000,
      'Database partial unique index must reject a second active rule for the exact same scope'
    );

    // 5.5 Superseding rule transitions previous rule to SUPERSEDED and active: false
    const v2Rule = await TemperatureRuleService.createVersionedRule({
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
      name: 'Standard Cooking v2 Superseding',
      processType: 'COOKING',
      foodCategory: 'VEGETARIAN',
      criteria: [{ minimumTemperatureC: 76, minimumDurationSeconds: 20 }],
      version: 2,
      createdByUserId: 'USR-MASTER',
    });
    assert.equal(v2Rule.active, true);
    assert.equal(v2Rule.version, 2);

    const rule1After = await FoodSafetyTemperatureRule.findOne({ ruleId: rule1.ruleId }).lean();
    assert.equal(rule1After.active, false, 'Previous version must now be active: false');
    assert.equal(rule1After.status, 'SUPERSEDED', 'Previous version status must be SUPERSEDED');
    assert.ok(rule1After.effectiveTo, 'Superseded version must have effectiveTo timestamp');

    // Historical version remains accessible
    assert.ok(rule1After._id, 'Historical version remains accessible in database');
  });
});
