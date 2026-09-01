'use strict';

/**
 * =============================================================================
 * PRE-FLIGHT PRODUCTION DEPLOYMENT VALIDATOR — ZAMORIN CAFE ERP
 * =============================================================================
 * Executes comprehensive pre-flight diagnostics on environment variables,
 * secret invariants, database replica set capability, and CORS configuration.
 *
 * Usage:
 *   node backend/src/scripts/verifyDeploymentConfig.js
 * =============================================================================
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { loadEnvironment } = require('../config/environment');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function runPreFlightCheck() {
  console.log(`\n${BOLD}${CYAN}===============================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}         ZAMORIN CAFE ERP — PRE-FLIGHT DEPLOYMENT AUDITOR & DIAGNOSTIC          ${RESET}`);
  console.log(`${BOLD}${CYAN}===============================================================================${RESET}\n`);

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const issues = [];

  function recordResult(name, pass, details = '') {
    totalChecks++;
    if (pass) {
      passedChecks++;
      console.log(`  ${GREEN}[PASS]${RESET} ${name}${details ? ` (${details})` : ''}`);
    } else {
      failedChecks++;
      console.log(`  ${RED}[FAIL]${RESET} ${name} — ${RED}${details}${RESET}`);
      issues.push({ name, details });
    }
  }

  // 1. Environment & Mode Verification
  console.log(`${BOLD}[1/4] Auditing Environment & Security Mode...${RESET}`);
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  recordResult('NODE_ENV Configuration', ['development', 'test', 'production'].includes(nodeEnv), `Active mode: ${nodeEnv}`);

  // 2. Secret Invariant Sanity
  console.log(`\n${BOLD}[2/4] Verifying Cryptographic Secrets & Token Keys...${RESET}`);
  const jwtSecret = process.env.JWT_ACCESS_SECRET || '';
  const isJwtValid = jwtSecret.length >= 32 && !jwtSecret.includes('replace-with') && !jwtSecret.includes('placeholder');
  recordResult('JWT Access Secret Strength', isJwtValid, isJwtValid ? `Length: ${jwtSecret.length} chars` : 'Must be >= 32 random chars without placeholders');

  const mfaKey = process.env.MFA_ENCRYPTION_KEY || '';
  const isMfaValid = mfaKey.length === 64 && /^[0-9a-fA-F]+$/.test(mfaKey);
  recordResult('MFA 64-Hex Encryption Key', isMfaValid, isMfaValid ? '64-hex key verified' : 'Must be exact 64-character hexadecimal key');

  // 3. CORS & Allowed Origins Validation
  console.log(`\n${BOLD}[3/4] Validating CORS & Domain Bindings...${RESET}`);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isCorsValid = allowedOrigins.length > 0 && !allowedOrigins.includes('*') && allowedOrigins.every((o) => o.startsWith('http://') || o.startsWith('https://'));
  recordResult('CORS Allowed Origins Policy', isCorsValid, isCorsValid ? `${allowedOrigins.length} origin(s) mapped` : 'Must define explicit http(s) origins without wildcards');

  // 4. Database Connection & Transaction Capability
  console.log(`\n${BOLD}[4/4] Probing Database Connectivity & Transaction Support...${RESET}`);
  const mongoUri = process.env.MONGODB_URI || '';
  const isUriConfigured = Boolean(mongoUri && !mongoUri.includes('DB_USER') && !mongoUri.includes('DB_PASSWORD'));

  if (!isUriConfigured) {
    recordResult('MongoDB Connection URI', false, 'MONGODB_URI missing or contains template placeholders');
  } else {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      recordResult('MongoDB Cluster Connectivity', true, 'Connected successfully');

      // Check if cluster supports transactions (Replica Set)
      const isReplicaSet = Boolean(mongoose.connection.client?.topology?.description?.setName || mongoose.connection.client?.topology?.description?.type?.includes('ReplicaSet'));
      
      if (isReplicaSet) {
        recordResult('MongoDB Multi-Document Transaction Support', true, 'Replica Set active');
      } else {
        // Test a lightweight transaction probe
        let txSuccess = false;
        try {
          const session = await mongoose.startSession();
          await session.withTransaction(async () => {});
          await session.endSession();
          txSuccess = true;
        } catch {
          txSuccess = false;
        }
        recordResult(
          'MongoDB Multi-Document Transaction Support',
          txSuccess,
          txSuccess ? 'Replica set transaction verified' : 'Standalone Mongo detected (Transactions require Replica Set rs0 or MongoDB Atlas)'
        );
      }

      await mongoose.disconnect();
    } catch (dbErr) {
      recordResult('MongoDB Cluster Connectivity', false, dbErr.message);
    }
  }

  // Final Summary Scorecard
  console.log(`\n${BOLD}${CYAN}===============================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                             DEPLOYMENT SCORECARD                              ${RESET}`);
  console.log(`${BOLD}${CYAN}===============================================================================${RESET}`);
  console.log(`Total Checks Executed : ${totalChecks}`);
  console.log(`Passed Checks         : ${GREEN}${passedChecks}${RESET}`);
  console.log(`Failed / Action Items : ${failedChecks > 0 ? `${RED}${failedChecks}${RESET}` : `${GREEN}0${RESET}`}`);

  if (failedChecks === 0) {
    console.log(`\n${BOLD}${GREEN}✔ ALL PRE-FLIGHT DEPLOYMENT INVARIANTS PASSED! READY FOR PRODUCTION LAUNCH.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`\n${BOLD}${YELLOW}⚠ ACTION REQUIRED BEFORE DEPLOYMENT:${RESET}`);
    issues.forEach((iss, idx) => {
      console.log(`  ${idx + 1}. [${iss.name}] ${iss.details}`);
    });
    console.log(`\nPlease address the items above in your production environment variables (.env / Render).\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runPreFlightCheck().catch((err) => {
    console.error(`${RED}[FATAL] Deployment pre-flight check crashed:${RESET}`, err);
    process.exit(1);
  });
}

module.exports = { runPreFlightCheck };
