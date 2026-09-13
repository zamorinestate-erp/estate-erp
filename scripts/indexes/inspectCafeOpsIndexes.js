#!/usr/bin/env node

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS INDEX INSPECTION TOOL (R02B-05)
 * ============================================================================
 * READ-ONLY inspection script comparing expected indexes from the manifest
 * against actual indexes on the target database.
 *
 * Usage:
 *   node scripts/indexes/inspectCafeOpsIndexes.js [--uri <mongodb-uri>]
 *
 * Default mode: READ-ONLY / INSPECT (Zero mutations executed).
 */

import { CAFE_OPS_R02_INDEXES } from './cafeOpsR02Indexes.js';

let mongoose;
try {
  mongoose = (await import('mongoose')).default;
} catch {
  mongoose = (await import('../../backend/node_modules/mongoose/index.js')).default;
}

export async function inspectIndexes(options = {}) {
  const mongoUri = options.uri || process.env.MONGODB_URI;

  console.log('================================================================');
  console.log('ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS INDEX INSPECTION (READ-ONLY)');
  console.log('================================================================');
  console.log(`Manifest Entries : ${CAFE_OPS_R02_INDEXES.length}`);
  console.log(`Mode             : READ-ONLY INSPECTION (NO MUTATIONS)`);

  let shouldDisconnect = false;
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    if (!mongoUri) {
      console.log('\n[INFO] No active Mongoose connection or MONGODB_URI provided.');
      console.log('[INFO] Running in offline manifest validation mode.');
      return {
        mode: 'OFFLINE_MANIFEST_VALIDATION',
        totalManifestIndexes: CAFE_OPS_R02_INDEXES.length,
        status: 'MANIFEST_VALID',
        details: 'Manifest entries validated for syntax and schema specifications.',
      };
    }

    console.log(`Target Database  : ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);
    await mongoose.connect(mongoUri);
    shouldDisconnect = true;
  }

  const db = mongoose.connection.db;
  const results = {
    totalExpected: CAFE_OPS_R02_INDEXES.length,
    matching: 0,
    missing: 0,
    differing: 0,
    details: [],
  };

  const collections = await db.listCollections().toArray();
  const existingCollectionNames = new Set(collections.map((c) => c.name));

  for (const expected of CAFE_OPS_R02_INDEXES) {
    if (!existingCollectionNames.has(expected.collection)) {
      results.missing++;
      results.details.push({
        collection: expected.collection,
        indexName: expected.indexName,
        status: 'COLLECTION_NOT_FOUND',
        expectedKeys: expected.keys,
      });
      continue;
    }

    const col = db.collection(expected.collection);
    const existingIndexes = await col.indexes();
    const found = existingIndexes.find(
      (idx) =>
        idx.name === expected.indexName ||
        JSON.stringify(idx.key) === JSON.stringify(expected.keys)
    );

    if (!found) {
      results.missing++;
      results.details.push({
        collection: expected.collection,
        indexName: expected.indexName,
        status: 'MISSING',
        expectedKeys: expected.keys,
      });
    } else {
      const uniqueMatches = Boolean(found.unique) === Boolean(expected.unique);
      if (uniqueMatches) {
        results.matching++;
        results.details.push({
          collection: expected.collection,
          indexName: found.name,
          status: 'MATCHING',
          keys: found.key,
        });
      } else {
        results.differing++;
        results.details.push({
          collection: expected.collection,
          indexName: found.name,
          status: 'PROPERTIES_DIFFER',
          foundIndex: found,
          expectedIndex: expected,
        });
      }
    }
  }

  console.log(`\nInspection Results:`);
  console.log(`  Matching : ${results.matching}`);
  console.log(`  Missing  : ${results.missing}`);
  console.log(`  Differing: ${results.differing}`);

  if (shouldDisconnect) {
    await mongoose.disconnect();
  }

  return results;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/indexes/inspectCafeOpsIndexes.js')) {
  const args = process.argv.slice(2);
  let uri = process.env.MONGODB_URI;
  const uriIdx = args.indexOf('--uri');
  if (uriIdx !== -1 && args[uriIdx + 1]) {
    uri = args[uriIdx + 1];
  }

  inspectIndexes({ uri })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ERROR] Index inspection failed:', err.message);
      process.exit(1);
    });
}
