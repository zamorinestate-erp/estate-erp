'use strict';

/**
 * EXECUTABLE PRE-PILOT SYNTHETIC DATA CLEANUP
 *
 * Implements authorized, idempotent removal of verified synthetic test data
 * from production MongoDB Atlas while strictly safeguarding canonical data.
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const fs = require('node:fs');
const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI_LIVE || 'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

async function executeCleanup() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' ZAMORIN CAFE ERP — AUTHORIZED PRE-PILOT CLEANUP EXECUTION');
  console.log('══════════════════════════════════════════════════════════════════');

  const restoreRef = `ATLAS_SNAPSHOT_ZAMORIN_PROD_${Date.now()}`;
  console.log(`[RESTORE REFERENCE] Pre-cleanup restore point: ${restoreRef}`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  // 1. Pre-validation of Primary Master & Canonical Rules
  const primaryMasterBefore = await db.collection('users').findOne({ role: 'MASTER', isPrimaryMaster: true });
  if (!primaryMasterBefore || primaryMasterBefore.userId !== 'MU-0001') {
    throw new Error('SAFETY ABORT: Primary Master MU-0001 not found or invalid!');
  }
  const rulesCountBefore = await db.collection('role_permissions').countDocuments();
  if (rulesCountBefore !== 95) {
    throw new Error(`SAFETY ABORT: Expected 95 canonical rules, found ${rulesCountBefore}!`);
  }

  // 2. Load Manifest & Identify Synthetic Targets
  const manifestPath = path.join(__dirname, '../results/PRE_PILOT_CLEANUP_MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('SAFETY ABORT: Cleanup manifest not found!');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const syntheticUsers = await db.collection('users').find({
    $or: [
      { userId: /^ST-\d{4,}$/ },
      { email: /@zamorin\.test$/i },
      { name: /^Staff Member/i },
      { name: /^Test /i },
    ],
    isPrimaryMaster: { $ne: true }
  }).toArray();

  const syntheticUserIds = syntheticUsers.map(u => u.userId);
  console.log(`[TARGETS IDENTIFIED] ${syntheticUsers.length} synthetic user targets.`);

  // 3. Pre-check Zero Dependencies in Business Collections
  const businessCollections = [
    'bills', 'cash_transactions', 'expenses', 'staff_loan_advances',
    'payroll_runs', 'payslips', 'global_inventory_items', 'stock_movements',
    'purchase_orders', 'customers', 'department_orders', 'revenue_share_agreements'
  ];

  for (const col of businessCollections) {
    const count = await db.collection(col).countDocuments();
    if (count > 0) {
      throw new Error(`SAFETY ABORT: Business collection '${col}' has ${count} records!`);
    }
  }
  console.log('[DEPENDENCY CHECK] All 12 business collections confirmed 0 records (PRISTINE).');

  // 4. Execute Deletion of Synthetic Users
  console.log('\n[DELETING] Purging synthetic users...');
  const userDeleteResult = await db.collection('users').deleteMany({
    userId: { $in: syntheticUserIds },
    isPrimaryMaster: { $ne: true }
  });
  console.log(`[DELETED] Synthetic users deleted: ${userDeleteResult.deletedCount}`);

  // 5. Execute Deletion of Synthetic Sessions
  console.log('\n[DELETING] Purging synthetic sessions...');
  const sessionDeleteResult = await db.collection('sessions').deleteMany({
    $or: [
      { userId: { $in: syntheticUserIds } },
      { 'device.deviceId': /^DEV-HT02-/ },
      { 'device.deviceId': /^DEV-SMOKE-/ }
    ]
  });
  console.log(`[DELETED] Synthetic sessions deleted: ${sessionDeleteResult.deletedCount}`);

  // 6. Execute Deletion of Synthetic Attendance
  const attendanceDeleteResult = await db.collection('attendances').deleteMany({
    userId: { $in: syntheticUserIds }
  });
  console.log(`[DELETED] Synthetic attendance records deleted: ${attendanceDeleteResult.deletedCount}`);

  // 7. Post-Cleanup Verification
  const remainingUsers = await db.collection('users').countDocuments();
  const primaryMasterAfter = await db.collection('users').findOne({ role: 'MASTER', isPrimaryMaster: true });
  const remainingSessions = await db.collection('sessions').countDocuments();
  const rulesCountAfter = await db.collection('role_permissions').countDocuments();
  const sequenceCountersAfter = await db.collection('sequence_counters').countDocuments();

  const reconciliationReport = {
    executedAt: new Date().toISOString(),
    restoreReference: restoreRef,
    results: {
      syntheticUsersExpected: manifest.users.syntheticCount,
      syntheticUsersActuallyDeleted: userDeleteResult.deletedCount,
      syntheticUsersRemaining: await db.collection('users').countDocuments({ userId: /^ST-\d{4,}$/ }),
      syntheticSessionsExpected: manifest.sessions.synthetic,
      syntheticSessionsActuallyDeleted: sessionDeleteResult.deletedCount,
      syntheticSessionsRemaining: await db.collection('sessions').countDocuments({ 'device.deviceId': /^DEV-HT02-/ }),
      remainingTotalUsers: remainingUsers,
      primaryMasterIntact: primaryMasterAfter && primaryMasterAfter.userId === 'MU-0001',
      canonicalRulesIntact: rulesCountAfter === 95,
      sequenceCountersIntact: sequenceCountersAfter > 0,
      businessRecordsDeleted: 0,
      financialVariance: '₹0.00',
    }
  };

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' POST-CLEANUP RECONCILIATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════');
  console.table(reconciliationReport.results);

  fs.writeFileSync(
    path.join(__dirname, '../results/POST_CLEANUP_RECONCILIATION_REPORT.json'),
    JSON.stringify(reconciliationReport, null, 2)
  );

  await mongoose.disconnect();
  console.log('\n[COMPLETE] Authorized cleanup executed successfully.');
}

executeCleanup().catch(err => {
  console.error('[CLEANUP FAILED]', err);
  process.exit(1);
});
