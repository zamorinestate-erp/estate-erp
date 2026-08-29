'use strict';

import mongoose from '../backend/node_modules/mongoose/index.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_scale_test';

console.log('======================================================================');
console.log('       ZAMORIN CAFÉ ERP — MONGODB TOPOLOGY INSPECTION AUDIT');
console.log('======================================================================\n');

async function inspectTopology() {
  await mongoose.connect(MONGO_URI);
  const adminDb = mongoose.connection.db.admin();

  let helloResult = {};
  try {
    helloResult = await adminDb.command({ hello: 1 });
  } catch (err) {
    helloResult = await adminDb.command({ isMaster: 1 });
  }

  let rsStatus = null;
  let rsError = null;
  try {
    rsStatus = await adminDb.command({ replSetGetStatus: 1 });
  } catch (err) {
    rsError = err.message;
  }

  const isReplicaSet = Boolean(helloResult.setName || rsStatus?.set);
  const replicaSetName = helloResult.setName || rsStatus?.set || null;
  const isWritablePrimary = Boolean(helloResult.isWritablePrimary || helloResult.ismaster);
  const isTrueStandalone = !isReplicaSet;
  const memberCount = rsStatus?.members ? rsStatus.members.length : (isTrueStandalone ? 1 : 0);
  const primaryHost = rsStatus?.members?.find((m) => m.stateStr === 'PRIMARY')?.name || (isWritablePrimary ? '127.0.0.1:27017' : 'UNKNOWN');

  await mongoose.disconnect();

  console.log('======================================================================');
  console.log('               MONGODB TOPOLOGY SCORECARD');
  console.log('======================================================================');
  console.log('IS_REPLICA_SET:                   ', isReplicaSet ? 'YES' : 'NO');
  console.log('REPLICA_SET_NAME:                 ', replicaSetName || 'NONE (Standalone)');
  console.log('MEMBER_COUNT:                     ', memberCount);
  console.log('PRIMARY_ENDPOINT:                 ', primaryHost);
  console.log('IS_TRUE_STANDALONE:               ', isTrueStandalone ? 'YES' : 'NO');
  console.log('CHANGE_STREAMS_LOCAL_RUNTIME:     ', isReplicaSet ? 'AVAILABLE' : 'PENDING_REPLICA_SET_TOPOLOGY');
  console.log('PRODUCTION_TOPOLOGY_REQUIREMENT:  ', 'MULTI_MEMBER_REPLICA_SET (MongoDB Atlas / High-Availability Sharded Cluster)');
  console.log('======================================================================\n');

  if (isTrueStandalone) {
    console.log('[NOTE] Local test MongoDB instance is confirmed TRUE STANDALONE (not configured with --replSet).');
    console.log('[NOTE] MongoDB Change Streams require a Replica Set or Sharded Cluster.');
    console.log('[NOTE] Change Stream runtime validation in production is classified as: ARCHITECTURE_READY_CLUSTER_VALIDATION_PENDING.\n');
  }
}

inspectTopology().catch((err) => {
  console.error('[FATAL TOPOLOGY AUDIT FAILURE]:', err.message);
  process.exit(1);
});
