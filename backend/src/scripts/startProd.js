'use strict';

/**
 * PRODUCTION SERVER STARTUP SCRIPT — ZAMORIN CAFE ERP
 *
 * Checks required production environment variables, connects to the MongoDB
 * database cluster, verifies database indexes, seeds initial Primary Master
 * user and role permissions if empty, and launches the HTTP API server.
 */

const { connectDatabase } = require('../config/database');
const { loadEnvironment } = require('../config/environment');
const { seedInitialData } = require('./seedInitialData');
const { app } = require('../app');

async function startProductionServer() {
  console.log('================================================================');
  console.log(' ZAMORIN CAFE ERP — PRODUCTION SERVER BOOTSTRAP (v1.1.0)');
  console.log('================================================================');

  // Load environment variables
  const env = loadEnvironment();

  console.log(`[INIT] Environment: ${env.NODE_ENV}`);
  console.log(`[INIT] Timezone: ${env.TZ || 'Asia/Kolkata'}`);
  console.log(`[INIT] Port: ${env.PORT || 4000}`);

  // Connect to production MongoDB cluster
  console.log('[INIT] Connecting to MongoDB cluster...');
  await connectDatabase({
    uri: env.mongodbUri,
    serverSelectionTimeoutMs: env.mongodbServerSelectionTimeoutMs,
    maxPoolSize: env.mongodbMaxPoolSize,
    minPoolSize: env.mongodbMinPoolSize,
  });
  console.log('[INIT] Connected to MongoDB database successfully.');

  // Seed default data & permissions if missing (idempotent)
  console.log('[INIT] Verifying database seeding and permission rules...');
  await seedInitialData({
    organisationId: process.env.INITIAL_ORGANISATION_ID || 'ZAMORIN',
    masterName: process.env.INITIAL_MASTER_NAME || 'Zamorin Master',
    masterEmail: process.env.INITIAL_MASTER_EMAIL || 'master@example.com',
    masterPassword: process.env.INITIAL_MASTER_PASSWORD || 'PK@NilaVega_8427!Cedar',
  });
  console.log('[INIT] Database seeding verified.');

  // Start HTTP Express Server
  const port = env.PORT || 4000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 Zamorin Cafe ERP Production API running at http://0.0.0.0:${port}`);
    console.log(`   Health Check: http://0.0.0.0:${port}/api/v1/health`);
    console.log(`================================================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Closing HTTP server...`);
    server.close(() => {
      console.log('[SHUTDOWN] HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  startProductionServer().catch((error) => {
    console.error('[FATAL] Production server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { startProductionServer };
