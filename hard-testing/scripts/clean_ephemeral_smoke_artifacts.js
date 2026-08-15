'use strict';

/**
 * CLEAN EPHEMERAL SMOKE ARTIFACTS
 *
 * Purges ephemeral smoke-test sessions and temporary test users created during smoke testing.
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI_LIVE || 'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

async function cleanEphemeral() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const delSessions = await db.collection('sessions').deleteMany({
    $or: [
      { 'device.deviceId': /^DEV-SMOKE-/ },
      { 'device.deviceId': /^DEV-HT02-/ },
      { 'device.deviceId': 'dev-001' },
      { 'device.deviceId': 'mfa-device-001' },
      { userId: { $ne: 'MU-0001' } }
    ]
  });
  console.log('Test sessions deleted:', delSessions.deletedCount);

  const delUsers = await db.collection('users').deleteMany({
    userId: { $in: ['OW-0001', 'AD-0001', 'ST-0001'] },
    isPrimaryMaster: { $ne: true }
  });
  console.log('Temporary test users deleted:', delUsers.deletedCount);

  const remainingSessions = await db.collection('sessions').countDocuments();
  const remainingUsers = await db.collection('users').countDocuments();
  const primaryMaster = await db.collection('users').findOne({ role: 'MASTER', isPrimaryMaster: true });

  console.log('Remaining sessions:', remainingSessions);
  console.log('Remaining users:', remainingUsers);
  console.log('Primary Master intact:', primaryMaster ? primaryMaster.userId : false);

  await mongoose.disconnect();
}

cleanEphemeral().catch(err => {
  console.error(err);
  process.exit(1);
});
