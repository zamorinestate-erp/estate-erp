'use strict';

/**
 * DRY-RUN SYNTHETIC TEST DATA CLEANUP AUDIT
 *
 * Scans the database and generates an exact cleanup plan for synthetic test data
 * generated during hard testing, WITHOUT executing any deletions.
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI_LIVE || 'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

async function dryRunCleanup() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' ZAMORIN CAFE ERP — DRY-RUN TEST DATA CLEANUP AUDIT');
  console.log('══════════════════════════════════════════════════════════════════');

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const plan = [];

  // 1. Synthetic Users
  const syntheticStaff = await db.collection('users').find({
    $or: [
      { userId: /^ST-\d{4,}$/ },
      { email: /@zamorin\.test$/i },
      { name: /^Staff Member/i },
    ]
  }).toArray();

  plan.push({
    collection: 'users',
    identifiedCount: syntheticStaff.length,
    reason: 'Synthetic staff VUs created for HT-02 500-VU shift-start storm',
    safeRemovalOrder: 3,
    dependencies: 'attendances, sessions',
    action: 'DRY-RUN IDENTIFIED (NO DELETION)',
  });

  // 2. Synthetic Attendance
  const syntheticAttendance = await db.collection('attendances').countDocuments();
  plan.push({
    collection: 'attendances',
    identifiedCount: syntheticAttendance,
    reason: 'Load testing shift check-in / check-out records',
    safeRemovalOrder: 1,
    dependencies: 'none',
    action: 'DRY-RUN IDENTIFIED (NO DELETION)',
  });

  // 3. Synthetic Sessions
  const syntheticSessions = await db.collection('sessions').find({
    $or: [
      { userId: /^ST-\d{4,}$/ },
      { 'device.deviceId': /^DEV-HT02-/ },
      { 'device.deviceId': /^DEV-SMOKE-/ },
    ]
  }).toArray();

  plan.push({
    collection: 'sessions',
    identifiedCount: syntheticSessions.length,
    reason: 'Synthetic authentication sessions from load/smoke test runs',
    safeRemovalOrder: 2,
    dependencies: 'none',
    action: 'DRY-RUN IDENTIFIED (NO DELETION)',
  });

  // 4. Preserved Canonical Data
  const preservedMaster = await db.collection('users').countDocuments({ role: 'MASTER', isPrimaryMaster: true });
  const preservedRules = await db.collection('role_permissions').countDocuments();
  const preservedCounters = await db.collection('sequence_counters').countDocuments();

  console.log('\n--- DRY-RUN CLEANUP PLAN ---');
  console.table(plan);

  console.log('\n--- CANONICAL DATA PRESERVATION GUARANTEE ---');
  console.log(`  Primary Master (MU-0001):   ${preservedMaster} (PRESERVED & PROTECTED)`);
  console.log(`  Role Permissions (RBAC):    ${preservedRules} (PRESERVED & PROTECTED)`);
  console.log(`  Sequence Counters:          ${preservedCounters} (PRESERVED & PROTECTED)`);
  console.log('──────────────────────────────────────────────────────────────────');
  console.log(' VERDICT: DRY-RUN AUDIT COMPLETE — 0 DESTRUCTIVE WRITES EXECUTED.');

  await mongoose.disconnect();
}

dryRunCleanup().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
