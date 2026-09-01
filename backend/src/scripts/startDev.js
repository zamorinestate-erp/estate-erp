'use strict';

/**
 * startDev.js
 *
 * Development-only startup script.
 * Spins up mongodb-memory-server, seeds the MASTER account,
 * then starts the Zamorin Cafe ERP backend on PORT 4000.
 *
 * Usage: node src/scripts/startDev.js
 */

require('dotenv').config();

const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  connectDatabase,
  disconnectDatabase,
} = require('../config/database');

const {
  seedMasterUser,
  seedPermissionRules,
  seedSystemCommunicationSettings,
  seedCafeOperationsData,
} = require('./seedInitialData');

const { seedPassbookData } = require('./seedPassbookData');

async function main() {
  console.log('[dev] Starting in-memory MongoDB...');

  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'zamorin_cafe_erp' },
  });

  const uri = mongod.getUri();

  // Override MONGODB_URI so the environment validator accepts it
  process.env.MONGODB_URI = uri;

  console.log(`[dev] MongoDB ready at ${uri}`);

  // Connect once for seeding
  await connectDatabase({ uri });

  const organisationId =
    process.env.INITIAL_ORGANISATION_ID || 'ZAMORIN';
  const masterName =
    process.env.INITIAL_MASTER_NAME || 'Zamorin Master';
  const masterEmail =
    process.env.INITIAL_MASTER_EMAIL || 'master@example.com';
  const masterPassword =
    process.env.INITIAL_MASTER_PASSWORD ||
    'PK@NilaVega_8427!Cedar';

  console.log('[dev] Seeding MASTER account and canonical role users...');

  const masterUser = await seedMasterUser({
    organisationId,
    masterName,
    masterEmail,
    masterPassword,
  });

  await seedPermissionRules({
    organisationId,
    masterUserId: masterUser.userId,
  });

  await seedSystemCommunicationSettings({
    organisationId,
    masterEmail,
  });

  await seedCafeOperationsData(organisationId, masterUser.userId);

  await seedPassbookData();

  console.log(
    `[dev] Seed complete — login: ${masterEmail} / ${masterPassword}`
  );

  await disconnectDatabase();

  // Now start the full Express server
  const { startServer, registerShutdownHandlers } =
    require('../server');

  const { server } = await startServer();

  registerShutdownHandlers(server);

  // Keep mongod alive for the server lifetime
  process.on('exit', async () => {
    await mongod.stop();
  });
}

main().catch((error) => {
  console.error('[dev] Startup failed:', error.message);
  process.exitCode = 1;
});
