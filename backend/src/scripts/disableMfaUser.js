'use strict';

/**
 * ZAMORIN CAFÉ ERP — ZERO TOTP DATABASE MIGRATION SCRIPT
 * 
 * Clears MFA flags and encrypted secrets for user accounts in MongoDB,
 * restoring 100% direct password login across all environments.
 * 
 * Usage:
 *   node src/scripts/disableMfaUser.js [targetEmail]
 *   node src/scripts/disableMfaUser.js --all
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models/User');

async function main() {
  const target = process.argv[2] || process.env.INITIAL_MASTER_EMAIL || 'pradeeshk331@gmail.com';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_cafe_erp';

  console.log(`[Zero TOTP] Connecting to database...`);
  await mongoose.connect(mongoUri);

  const filter = target === '--all' 
    ? {} 
    : { email: target.trim().toLowerCase() };

  console.log(`[Zero TOTP] Clearing 2FA requirement for filter:`, filter);

  const result = await User.updateMany(filter, {
    $set: {
      mfaEnabled: false,
      mfaMethod: 'NONE',
      mfaSecretEncrypted: null,
      pendingMfaSecretEncrypted: null,
      recoveryCodeHashes: [],
    },
  });

  console.log(`[Zero TOTP] Updated ${result.modifiedCount} user record(s). All targeted users can now log in directly with password.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Zero TOTP] Migration failed:', err.message);
  process.exit(1);
});
