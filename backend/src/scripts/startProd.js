'use strict';

/**
 * PRODUCTION SERVER STARTUP SCRIPT — ZAMORIN CAFE ERP
 *
 * Connects to the production MongoDB database cluster, verifies/seeds initial
 * Primary Master user and permission rules (idempotent), and starts the Express API server.
 */

const { startServer, registerShutdownHandlers } = require('../server');
const { runSeed } = require('./seedInitialData');

async function startProductionServer() {
  console.log('================================================================');
  console.log(' ZAMORIN CAFE ERP — PRODUCTION SERVER BOOTSTRAP (v1.1.0)');
  console.log('================================================================');

  // Seed default data & permissions if missing (idempotent)
  console.log('[INIT] Verifying database seeding and permission rules...');
  try {
    await runSeed();
    console.log('[INIT] Database seeding verified.');
  } catch (seedErr) {
    console.warn('[INIT] Database seed note (may already be initialized):', seedErr.message);
  }

  // Start HTTP Express Server using canonical server.js bootstrap
  const { server, environment } = await startServer();
  registerShutdownHandlers(server);

  console.log(`================================================================`);
  console.log(`🚀 Zamorin Cafe ERP Production API running at http://${environment.host}:${environment.port}`);
  console.log(`   Health Check: http://${environment.host}:${environment.port}/api/v1/health`);
  console.log(`================================================================`);

  return { server, environment };
}

if (require.main === module) {
  startProductionServer().catch((error) => {
    console.error('[FATAL] Production server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { startProductionServer };
