'use strict';

/**
 * PRODUCTION DATA INVENTORY & CLASSIFICATION AUDIT
 *
 * Connects to MongoDB Atlas production database and classifies records:
 * - CANONICAL SYSTEM DATA (Permissions, Core Configuration)
 * - SYNTHETIC TEST DATA (Hard-testing VUs, synthetic attendance, load test records)
 * - REAL BUSINESS DATA (Real organizations, employees, production transactions)
 * - UNKNOWN
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI_LIVE || 'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

async function auditProductionData() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' ZAMORIN CAFE ERP — PRODUCTION DATA INVENTORY & CLASSIFICATION');
  console.log('══════════════════════════════════════════════════════════════════');

  console.log('\n[CONNECTING] Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('[CONNECTED] Connected to MongoDB Atlas.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const inventory = [];

  for (const col of collections) {
    const colName = col.name;
    if (colName.startsWith('system.')) continue;

    const count = await db.collection(colName).countDocuments();
    const sample = await db.collection(colName).find().limit(5).toArray();

    let classification = 'UNKNOWN';
    let details = '';

    if (colName === 'role_permissions' || colName === 'rolepermissions') {
      classification = 'CANONICAL SYSTEM DATA';
      details = `${count} canonical RBAC rules`;
    } else if (colName === 'users') {
      const syntheticStaffCount = await db.collection(colName).countDocuments({ userId: /^ST-\d{4,}$/ });
      const syntheticAdminCount = await db.collection(colName).countDocuments({ userId: /^AD-\d{4,}$/ });
      const primaryMasterCount = await db.collection(colName).countDocuments({ role: 'MASTER', isPrimaryMaster: true });
      classification = 'MIXED (CANONICAL + SYNTHETIC TEST)';
      details = `Primary Master: ${primaryMasterCount}, Synthetic Staff: ${syntheticStaffCount}, Synthetic Admins: ${syntheticAdminCount}, Total: ${count}`;
    } else if (colName === 'cafes') {
      classification = 'CANONICAL / TEST CONFIGURATION';
      details = `${count} cafes recorded`;
    } else if (colName === 'attendances') {
      classification = 'SYNTHETIC TEST DATA';
      details = `${count} attendance records from load/hard testing`;
    } else if (colName === 'sessions') {
      classification = 'OPERATIONAL SESSION STORE';
      details = `${count} active/historical sessions`;
    } else if (colName === 'sequence_counters' || colName === 'sequencecounters') {
      classification = 'CANONICAL SYSTEM DATA';
      details = `${count} ID sequence generators`;
    } else {
      classification = count === 0 ? 'EMPTY COLLECTION (READY FOR ONBOARDING)' : 'OPERATIONAL DATA';
      details = `${count} documents`;
    }

    inventory.push({
      collection: colName,
      count,
      classification,
      details,
    });
  }

  console.log('\n--- PRODUCTION DATABASE INVENTORY ---');
  console.table(inventory);

  await mongoose.disconnect();
  console.log('\n[COMPLETE] Production database audit completed.');
}

auditProductionData().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
