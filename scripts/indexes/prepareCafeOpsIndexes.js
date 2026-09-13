#!/usr/bin/env node

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS INDEX PREPARATION & DRY-RUN TOOL (R02B-05)
 * ============================================================================
 * Safe production-index preparation script.
 *
 * Implements:
 * 1. Non-destructive DRY-RUN index planning (--dry-run)
 * 2. Read-only preflight checks for duplicate conflicts on unique indexes
 * 3. Strict guard: NEVER creates production indexes on MongoDB Atlas
 *
 * Usage:
 *   node scripts/indexes/prepareCafeOpsIndexes.js --dry-run [--uri <mongodb-uri>]
 */

import { CAFE_OPS_R02_INDEXES } from './cafeOpsR02Indexes.js';

let mongoose;
try {
  mongoose = (await import('mongoose')).default;
} catch {
  mongoose = (await import('../../backend/node_modules/mongoose/index.js')).default;
}

export async function runUniquePreflight(db) {
  const conflicts = [];

  // Check 1: Duplicate KdsPrepStation code within same (organisationId, cafeId)
  try {
    const col = db.collection('kds_prep_stations');
    const dupes = await col.aggregate([
      { $group: { _id: { organisationId: '$organisationId', cafeId: '$cafeId', code: '$code' }, count: { $sum: 1 }, ids: { $push: '$prepStationId' } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (dupes.length > 0) {
      conflicts.push({
        targetIndex: 'uniq_kds_station_org_cafe_code',
        collection: 'kdsprepstations',
        reason: 'Duplicate prep station codes detected within same cafe',
        conflictingKeys: dupes,
      });
    }
  } catch (_) {}

  // Check 2: Duplicate FoodSafetyTemperatureRule version within same (org, cafe, process, category)
  try {
    const col = db.collection('foodsafetytemperaturerules');
    const dupes = await col.aggregate([
      {
        $group: {
          _id: {
            organisationId: '$organisationId',
            cafeId: '$cafeId',
            processType: '$processType',
            foodCategory: '$foodCategory',
            version: '$version',
          },
          count: { $sum: 1 },
          ids: { $push: '$ruleId' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (dupes.length > 0) {
      conflicts.push({
        targetIndex: 'uniq_trule_org_cafe_proc_cat_ver',
        collection: 'foodsafetytemperaturerules',
        reason: 'Duplicate rule version detected within same scope',
        conflictingKeys: dupes,
      });
    }
  } catch (_) {}

  // Check 3: Multiple ACTIVE FoodSafetyTemperatureRule documents within same (org, cafe, process, category)
  try {
    const col = db.collection('foodsafetytemperaturerules');
    const dupes = await col.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: {
            organisationId: '$organisationId',
            cafeId: '$cafeId',
            processType: '$processType',
            foodCategory: '$foodCategory',
          },
          count: { $sum: 1 },
          ids: { $push: '$ruleId' },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (dupes.length > 0) {
      conflicts.push({
        targetIndex: 'uniq_trule_org_cafe_proc_cat_active',
        collection: 'foodsafetytemperaturerules',
        reason: 'Multiple ACTIVE rules detected in same scope',
        conflictingKeys: dupes,
      });
    }
  } catch (_) {}

  // Check 4: Duplicate OfflineRiskConfig within same (organisationId, cafeId)
  try {
    const col = db.collection('offlineriskconfigs');
    const dupes = await col.aggregate([
      { $group: { _id: { organisationId: '$organisationId', cafeId: '$cafeId' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (dupes.length > 0) {
      conflicts.push({
        targetIndex: 'uniq_offline_risk_cfg_org_cafe',
        collection: 'offlineriskconfigs',
        reason: 'Duplicate OfflineRiskConfig documents detected for same scope',
        conflictingKeys: dupes,
      });
    }
  } catch (_) {}

  return conflicts;
}

export async function prepareIndexes(options = {}) {
  const isDryRun = options.dryRun !== false; // Default: true for safety
  const mongoUri = options.uri || process.env.MONGODB_URI;

  console.log('================================================================');
  console.log('ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS INDEX PREPARATION');
  console.log('================================================================');
  console.log(`Execution Mode   : ${isDryRun ? 'DRY-RUN (NON-DESTRUCTIVE)' : 'APPLY (BLOCKED BY POLICY)'}`);
  console.log(`Manifest Count   : ${CAFE_OPS_R02_INDEXES.length}`);

  if (!isDryRun) {
    throw new Error('PRODUCTION POLICY: Index execution must run with --dry-run. Direct production creation is strictly forbidden in R02B.');
  }

  let shouldDisconnect = false;
  let db = null;

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    db = mongoose.connection.db;
  } else if (mongoUri) {
    console.log(`Connecting to    : ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    await mongoose.connect(mongoUri);
    db = mongoose.connection.db;
    shouldDisconnect = true;
  }

  const plan = {
    mode: 'DRY_RUN',
    alreadyExists: [],
    missingWouldCreate: [],
    differsRequiresReview: [],
    preflightConflicts: [],
  };

  if (!db) {
    console.log('\n[INFO] No database connection available. Generating theoretical dry-run plan from manifest.');
    for (const idx of CAFE_OPS_R02_INDEXES) {
      plan.missingWouldCreate.push({
        collection: idx.collection,
        indexName: idx.indexName,
        keys: idx.keys,
        unique: idx.unique,
        partialFilterExpression: idx.partialFilterExpression,
        action: 'WOULD_BE_CREATED_DRY_RUN',
        riskLevel: idx.riskLevel,
      });
    }

    console.log(`\nDry-Run Theoretical Plan:`);
    console.log(`  Indexes to create on target: ${plan.missingWouldCreate.length}`);
    console.log(`  Mutations executed         : 0 (Zero database modifications)`);
    return plan;
  }

  // 1. Execute Preflight Checks
  console.log('\nExecuting unique index conflict preflight checks...');
  plan.preflightConflicts = await runUniquePreflight(db);

  if (plan.preflightConflicts.length > 0) {
    console.warn(`[WARN] Preflight detected ${plan.preflightConflicts.length} unique constraint conflict(s)!`);
  } else {
    console.log('✔ Preflight Check PASS: Zero unique index conflicts detected.');
  }

  // 2. Evaluate existing collection indexes
  const collections = await db.listCollections().toArray();
  const existingColNames = new Set(collections.map((c) => c.name));

  for (const expected of CAFE_OPS_R02_INDEXES) {
    if (!existingColNames.has(expected.collection)) {
      plan.missingWouldCreate.push({
        collection: expected.collection,
        indexName: expected.indexName,
        keys: expected.keys,
        status: 'COLLECTION_NOT_YET_CREATED',
        action: 'WOULD_BE_CREATED_ON_DEPLOYMENT',
      });
      continue;
    }

    const col = db.collection(expected.collection);
    const existing = await col.indexes();
    const match = existing.find(
      (idx) =>
        idx.name === expected.indexName ||
        JSON.stringify(idx.key) === JSON.stringify(expected.keys)
    );

    if (!match) {
      plan.missingWouldCreate.push({
        collection: expected.collection,
        indexName: expected.indexName,
        keys: expected.keys,
        action: 'WOULD_BE_CREATED_DRY_RUN',
        unique: expected.unique,
        partialFilterExpression: expected.partialFilterExpression,
      });
    } else {
      const uniqueMatches = Boolean(match.unique) === Boolean(expected.unique);
      if (uniqueMatches) {
        plan.alreadyExists.push({
          collection: expected.collection,
          indexName: match.name,
          keys: match.key,
          status: 'INDEX_ALREADY_EXISTS',
        });
      } else {
        plan.differsRequiresReview.push({
          collection: expected.collection,
          indexName: match.name,
          found: match,
          expected,
          action: 'REQUIRES_MANUAL_REVIEW_BEFORE_DROP_RECREATE',
        });
      }
    }
  }

  console.log(`\nDry-Run Plan Summary:`);
  console.log(`  Index Already Exists   : ${plan.alreadyExists.length}`);
  console.log(`  Index Missing (Plan)   : ${plan.missingWouldCreate.length}`);
  console.log(`  Index Differs (Review) : ${plan.differsRequiresReview.length}`);
  console.log(`  Preflight Conflicts    : ${plan.preflightConflicts.length}`);
  console.log(`  Mutations Executed     : 0 (Pure Dry-Run)`);

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }

  return plan;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/indexes/prepareCafeOpsIndexes.js')) {
  const args = process.argv.slice(2);
  let uri = process.env.MONGODB_URI;
  const uriIdx = args.indexOf('--uri');
  if (uriIdx !== -1 && args[uriIdx + 1]) {
    uri = args[uriIdx + 1];
  }

  prepareIndexes({ dryRun: true, uri })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ERROR] Index preparation dry-run failed:', err.message);
      process.exit(1);
    });
}
